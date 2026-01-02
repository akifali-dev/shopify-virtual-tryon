// app/routes/apps.virtual-tryon.jsx
/* eslint-disable */
import {
  json,
  unstable_parseMultipartFormData,
  unstable_createMemoryUploadHandler,
} from "@remix-run/node";
import axios from "axios";
import crypto from "crypto";
import { authenticate, unauthenticated } from "../shopify.server";
import prisma from "../db.server";
import { uploadBase64ImageHelper } from "../../lib/helpers";
import { GoogleAuth } from "google-auth-library";
import {
  buildUsageIdempotencyKey,
  createUsageCharge,
  getActiveUsageSubscription,
} from "../usage-billing.server";

// ====== ENV ======
const {
  SHOPIFY_API_SECRET: SECRET,
  VERTEX_AI_PROJECT_ID,
  VERTEX_AI_LOCATION = "us-central1",
} = process.env;

const UPLOAD_MAX = 10_000_000;
const CREDIT_COST = 1;

const VTO_MODEL_ID = "virtual-try-on-preview-08-04";
const VERTEX_ENDPOINT = `https://${VERTEX_AI_LOCATION}-aiplatform.googleapis.com/v1/projects/${VERTEX_AI_PROJECT_ID}/locations/${VERTEX_AI_LOCATION}/publishers/google/models/${VTO_MODEL_ID}:predict`;

// Early env sanity logs (once at module load)
if (!SECRET) console.warn("[VTO] WARN: SHOPIFY_API_SECRET is missing.");
if (!VERTEX_AI_PROJECT_ID)
  console.warn("[VTO] WARN: VERTEX_AI_PROJECT_ID is missing.");
if (!VERTEX_AI_LOCATION)
  console.warn("[VTO] WARN: VERTEX_AI_LOCATION is missing (using default).");
if (
  !process.env.GOOGLE_APPLICATION_CREDENTIALS &&
  !process.env.SERVICE_ACCOUNT_JSON
) {
  console.warn(
    "[VTO] WARN: No GOOGLE_APPLICATION_CREDENTIALS or SERVICE_ACCOUNT_JSON found. Are you on GCP workload identity?",
  );
}

// ====== LOG HELPERS ======
const now = () => new Date().toISOString();
const mask = (str, keep = 6) => {
  if (!str || typeof str !== "string") return "";
  if (str.length <= keep) return str;
  return `${str.slice(0, keep)}…(${str.length})`;
};
function logCtx(prefix, ctx) {
  console.log(`[${now()}] ${prefix}`, ctx);
}

function logErr(prefix, err, extra = {}) {
  const base = {
    message: err?.message,
    name: err?.name,
    code: err?.code,
    stack: err?.stack?.split("\n").slice(0, 3).join(" | "),
    ...extra,
  };
  // If axios error, attach response basics (without huge payloads)
  if (err?.isAxiosError) {
    base.axios = {
      url: err.config?.url,
      method: err.config?.method,
      status: err.response?.status,
      statusText: err.response?.statusText,
      headers: err.response?.headers,
      dataType: typeof err.response?.data,
      dataSnippet:
        typeof err.response?.data === "string"
          ? err.response?.data?.slice(0, 1000)
          : JSON.stringify(err.response?.data)?.slice(0, 500),
    };
  }
  console.error(`[${now()}] ${prefix}`, base);
}

// ====== UTILS ======
function getExt(name = "") {
  const parts = String(name).split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "png";
}

function verifyProxy(params) {
  const { signature, ...rest } = params;
  if (typeof signature !== "string") return false;
  const message = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce(
      (acc, [k, v]) => acc + `${k}=${Array.isArray(v) ? v.join(",") : v}`,
      "",
    );
  const digest = crypto
    .createHmac("sha256", SECRET || "")
    .update(message)
    .digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(digest, "hex"),
    );
  } catch {
    return false;
  }
}

async function fetchAsBuffer(url, requestId) {
  try {
    const res = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 60000,
    });
    const buf = Buffer.from(res.data);
    buf.name = `remote.${getExt(new URL(url).pathname)}`;
    logCtx(`[VTO ${requestId}] fetchAsBuffer ok`, {
      url,
      size: buf.length,
      name: buf.name,
    });
    return buf;
  } catch (err) {
    logErr(`[VTO ${requestId}] fetchAsBuffer error`, err, { url });
    throw err;
  }
}

function inferMimeFromName(name) {
  const ext = getExt(name);
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  return "image/png";
}

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp"]);

// ====== VERTEX AUTH ======
async function getVertexAccessToken(requestId) {
  try {
    const auth = new GoogleAuth({
      credentials: JSON.parse(
        process.env.GOOGLE_APPLICATION_CREDENTIALS || "{}",
      ),
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const tokenResp = await client.getAccessToken();
    if (!tokenResp || !tokenResp.token) {
      throw new Error("No access token from GoogleAuth");
    }
    logCtx(`[VTO ${requestId}] getAccessToken ok`, {
      tokenPreview: mask(tokenResp.token),
    });
    return tokenResp.token;
  } catch (err) {
    logErr(`[VTO ${requestId}] getAccessToken failed`, err);
    throw err;
  }
}

// ====== VERTEX CALL ======
/**
 * Calls Vertex AI Virtual Try-On
 *  - modelBuf = person image Buffer (with .name)
 *  - dressBuf = product/garment image Buffer (with .name)
 * Returns: { base64, mimeType }
 */
async function runTryOnOnceWithBuffers({ modelBuf, dressBuf, requestId }) {
  const accessToken = await getVertexAccessToken(requestId);

  const personB64 = modelBuf.toString("base64");
  const productB64 = dressBuf.toString("base64");

  const body = {
    // Request multiple images by increasing sampleCount (1..4)
    instances: [
      {
        personImage: { image: { bytesBase64Encoded: personB64 } },
        productImages: [{ image: { bytesBase64Encoded: productB64 } }],
      },
    ],
    parameters: { sampleCount: 1 },
  };

  logCtx(`[VTO ${requestId}] predict request`, {
    endpoint: VERTEX_ENDPOINT,
    personSize: personB64.length,
    productSize: productB64.length,
    sampleCount: body.parameters.sampleCount,
  });

  try {
    const resp = await axios.post(VERTEX_ENDPOINT, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      timeout: 120000,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    const preds = resp?.data?.predictions || [];
    logCtx(`[VTO ${requestId}] predict response`, {
      status: resp?.status,
      predictionsCount: preds.length,
      keys: Object.keys(resp?.data || {}),
    });

    if (!Array.isArray(preds) || preds.length === 0) {
      throw new Error("Vertex VTO: empty predictions");
    }

    const first = preds[0];
    const base64 = first?.bytesBase64Encoded;
    const mimeType = first?.mimeType || "image/png";

    if (!base64) throw new Error("Vertex VTO: missing image bytes");

    logCtx(`[VTO ${requestId}] predict success`, {
      mimeType,
      base64Len: base64.length,
    });

    return { base64, mimeType };
  } catch (err) {
    logErr(`[VTO ${requestId}] predict failed`, err);
    throw err;
  }
}

// ====== BACKGROUND JOB ======
async function processSessionInBackground({
  store,
  sessionId,
  modelUrl,
  dressUrl,
  category, // optional
  requestId,
  usedCredits = true,
  usageBilling,
  billingSession,
}) {
  logCtx(`[VTO ${requestId}] BG start`, {
    sessionId,
    modelUrl,
    dressUrl,
    category,
  });

  try {
    // 1) download both URLs to buffers
    const [modelBuf, dressBuf] = await Promise.all([
      fetchAsBuffer(modelUrl, requestId),
      fetchAsBuffer(dressUrl, requestId),
    ]);

    const modelType = inferMimeFromName(modelBuf.name);
    const dressType = inferMimeFromName(dressBuf.name);

    logCtx(`[VTO ${requestId}] input types`, { modelType, dressType });

    if (!ALLOWED.has(modelType) || !ALLOWED.has(dressType)) {
      // mark FAILED + refund
      logCtx(`[VTO ${requestId}] unsupported mime`, { modelType, dressType });
      const txOps = [
        prisma.tryOnResult.create({
          data: {
            storeId: store.id,
            taskId: `session-${sessionId}`,
            resultId: `session-${sessionId}_1`,
            status: "FAILED",
            errorMsg: "Unsupported image type. Use PNG/JPEG/WEBP.",
            fileUrl: null,
            refunded: usedCredits,
            tryOnSessionId: sessionId,
          },
        }),
      ];

      if (usedCredits) {
        txOps.unshift(
          prisma.store.update({
            where: { id: store.id },
            data: { credits: { increment: CREDIT_COST } },
          }),
        );
      }

      await prisma.$transaction(txOps);
      return;
    }

    // 2) generate via Vertex AI
    const { base64, mimeType } = await runTryOnOnceWithBuffers({
      modelBuf,
      dressBuf,
      requestId,
    });

    const taskId = `session-${sessionId}`;
    const resultId = `${taskId}_1`;

    // 3) upload
    let fileUrl = null;
    try {
      fileUrl = await uploadBase64ImageHelper(
        Buffer.from(base64, "base64"),
        mimeType,
        "tryon",
      );
      logCtx(`[VTO ${requestId}] upload ok`, { fileUrl });
    } catch (err) {
      logErr(`[VTO ${requestId}] upload failed`, err, {
        mimeType,
        base64Len: base64.length,
      });
      throw err;
    }

    if (usageBilling) {
      try {
        await createUsageCharge({
          session: billingSession,
          usageLineItemId: usageBilling.usageLineItemId,
          idempotencyKey: buildUsageIdempotencyKey(store.shop),
        });
      } catch (err) {
        logErr(`[VTO ${requestId}] usage charge failed`, err, {
          shop: store.shop,
        });
        throw new Error("Unable to record usage charge for try-on");
      }
    }

    // 4) persist success
    await prisma.tryOnResult.create({
      data: {
        storeId: store.id,
        taskId,
        resultId,
        status: "SUCCESS",
        fileUrl,
        refunded: false,
        tryOnSessionId: sessionId,
      },
    });

    logCtx(`[VTO ${requestId}] BG done`, {
      status: "SUCCESS",
      taskId,
      resultId,
      fileUrl,
    });
  } catch (err) {
    // refund + failed row
    logErr(`[VTO ${requestId}] BG error`, err, { sessionId });
    try {
      const txOps = [
        prisma.tryOnResult.create({
          data: {
            storeId: store.id,
            taskId: `session-${sessionId}`,
            resultId: `session-${sessionId}_1`,
            status: "FAILED",
            errorMsg: String(err?.message || err),
            fileUrl: null,
            refunded: usedCredits,
            tryOnSessionId: sessionId,
          },
        }),
      ];

      if (usedCredits) {
        txOps.unshift(
          prisma.store.update({
            where: { id: store.id },
            data: { credits: { increment: CREDIT_COST } },
          }),
        );
      }

      await prisma.$transaction(txOps);
      logCtx(`[VTO ${requestId}] BG refund recorded`, { sessionId });
    } catch (txErr) {
      logErr(`[VTO ${requestId}] BG refund txn failed`, txErr, { sessionId });
    }
  }
}

// ====== ROUTER ======
// export async function loader() {
//   return new Response("Method Not Allowed", { status: 405 });
// }

export async function loader({ request }) {
  return json({ ok: true, t: Date.now() });
}

export async function action({ request }) {
  // One requestId for the entire lifecycle
  const requestId = `req_${Math.random().toString(36).slice(2, 10)}`;
  logCtx(`[VTO ${requestId}] action start`, {
    method: request.method,
    url: request.url,
    hasBody: request.method !== "GET",
  });

  const { session } = await authenticate.public.appProxy(request);
  const { shop } = session;

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const sig = params.signature;
  const type = params.type || "createSession";

  logCtx(`[VTO ${requestId}] proxy params`, {
    shop,
    type,
    sigPresent: Boolean(sig),
  });

  if (!shop || !sig || !verifyProxy(params)) {
    logCtx(`[VTO ${requestId}] proxy verify failed`, {
      hasShop: !!shop,
      hasSig: !!sig,
    });
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // ---- return SUCCESS result by sessionId (hydrate) ----
    if (type === "result") {
      const sessionId = params.sessionId;
      if (!sessionId) {
        logCtx(`[VTO ${requestId}] result missing sessionId`, {});
        return json({ error: "Missing sessionId" }, { status: 400 });
      }

      const rec = await prisma.tryOnResult.findFirst({
        where: { tryOnSessionId: sessionId, status: "SUCCESS" },
        orderBy: { createdAt: "desc" },
        select: { fileUrl: true, resultId: true, taskId: true },
      });

      logCtx(`[VTO ${requestId}] result query`, { found: !!rec, sessionId });
      if (!rec?.fileUrl)
        return json({ error: "Result not found" }, { status: 404 });
      return json(rec, { status: 200 });
    }

    // ---- confirm (status) by sessionId ----
    if (type === "confirm") {
      const sessionId = params.sessionId;
      if (!sessionId) {
        logCtx(`[VTO ${requestId}] confirm missing sessionId`, {});
        return json({ error: "Missing sessionId" }, { status: 400 });
      }

      const list = await prisma.tryOnResult.findMany({
        where: { tryOnSessionId: sessionId },
        orderBy: { createdAt: "desc" },
        select: {
          status: true,
          fileUrl: true,
          resultId: true,
          taskId: true,
          errorMsg: true,
        },
      });

      const success = list.find((r) => r.status === "SUCCESS");
      logCtx(`[VTO ${requestId}] confirm check`, {
        sessionId,
        total: list.length,
        success: !!success,
      });

      if (success)
        return json({ status: "SUCCESS", ...success }, { status: 200 });

      const failedOnly =
        list.length > 0 && list.every((r) => r.status === "FAILED");
      if (failedOnly) return json({ status: "FAILED", list }, { status: 200 });

      return json({ status: "PENDING", list }, { status: 200 });
    }

    // ---- createSession ----
    if (type === "createSession") {
      console.log("Type Create session.....")

      // Quick env assert per request (useful on serverless cold starts)
      if (!VERTEX_AI_PROJECT_ID) {
        logCtx(`[VTO ${requestId}] missing VERTEX_AI_PROJECT_ID`, {});
        return json(
          { error: "Server misconfigured: VERTEX_AI_PROJECT_ID" },
          { status: 500 },
        );
      }

      const uploadHandler = unstable_createMemoryUploadHandler({
        maxPartSize: UPLOAD_MAX,
      });
      let formData;
      try {
        formData = await unstable_parseMultipartFormData(
          request,
          uploadHandler,
        );
      } catch (err) {
        logErr(`[VTO ${requestId}] parseMultipart failed`, err);
        return json({ error: "Invalid multipart form" }, { status: 400 });
      }

      const dressInput = formData.get("dressImage"); // File or URL
      const modelInput = formData.get("modelImage"); // File or URL
      const category = formData.get("category"); // optional for Vertex

      logCtx(`[VTO ${requestId}] createSession inputs`, {
        hasDress: !!dressInput,
        hasModel: !!modelInput,
        category,
        dressType: dressInput?.constructor?.name,
        modelType: modelInput?.constructor?.name,
      });

      if (!dressInput || !modelInput || !category) {
        return json({ error: "Missing fields" }, { status: 400 });
      }

      // 1) reserve credits or prepare usage billing fallback
      let store = null;
      let usedCredits = false;
      let usageBilling = null;
      let billingSession = null;

      const reservedStore = await prisma.store
        .update({
          where: { shop, credits: { gte: CREDIT_COST } },
          data: { credits: { decrement: CREDIT_COST } },
        })
        .catch((err) => {
          logErr(`[VTO ${requestId}] credit reserve failed`, err, { shop });
          return null;
        });

      if (reservedStore) {
        store = reservedStore;
        usedCredits = true;
      } else {
        try {
          const adminContext = await unauthenticated.admin(shop);
          billingSession = adminContext.session;

          const usageContext = await getActiveUsageSubscription({
            session: billingSession,
          });

          if (!usageContext.subscription) {
            return json({ error: "Insufficient credits" }, { status: 402 });
          }

          if (!usageContext.usageLineItemId) {
            return json(
              {
                error:
                  "Active subscription missing usage billing configuration.",
              },
              { status: 402 },
            );
          }

          usageBilling = usageContext;
          store = await prisma.store.findUnique({ where: { shop } });

          if (!store) {
            return json({ error: "Store not found" }, { status: 404 });
          }
        } catch (err) {
          logErr(`[VTO ${requestId}] usage billing lookup failed`, err, {
            shop,
          });
          return json({ error: "Insufficient credits" }, { status: 402 });
        }
      }

      // 2) Normalize inputs to URLs (upload files immediately)
      let modelUrl;
      let dressUrl;

      try {
        if (typeof modelInput === "string") {
          modelUrl = modelInput;
        } else {
          const ab = Buffer.from(await modelInput.arrayBuffer());
          const mime = inferMimeFromName(modelInput.name);
          const uploaded = await uploadBase64ImageHelper(
            ab,
            mime,
            "tryon-inputs",
          );
          modelUrl = uploaded;
        }

        if (typeof dressInput === "string") {
          dressUrl = dressInput;
        } else {
          const ab = Buffer.from(await dressInput.arrayBuffer());
          const mime = inferMimeFromName(dressInput.name);
          const uploaded = await uploadBase64ImageHelper(
            ab,
            mime,
            "tryon-inputs",
          );
          dressUrl = uploaded;
        }
      } catch (err) {
        logErr(`[VTO ${requestId}] input upload failed`, err);
        // refund immediately if upload fails
        if (usedCredits) {
          try {
            await prisma.store.update({
              where: { id: store.id },
              data: { credits: { increment: CREDIT_COST } },
            });
          } catch (txErr) {
            logErr(
              `[VTO ${requestId}] refund after upload fail failed`,
              txErr,
            );
          }
        }
        return json({ error: "Failed to process inputs" }, { status: 500 });
      }

      // 3) persist a TryOnSession
      const sessionRow = await prisma.tryOnSession.create({
        data: {
          storeId: store.id,
          category: String(category),
          modelUrl,
          dressUrl,
          variants: 1,
        },
        select: { id: true },
      });

      logCtx(`[VTO ${requestId}] session created`, {
        sessionId: sessionRow.id,
        modelUrl,
        dressUrl,
      });

      // 4) start background job (detached)
      setImmediate(() =>
        processSessionInBackground({
          store,
          sessionId: sessionRow.id,
          modelUrl,
          dressUrl,
          category: String(category),
          requestId,
          usedCredits,
          usageBilling,
          billingSession,
        }).catch((err) => logErr(`[VTO ${requestId}] BG top-level fail`, err)),
      );

      // 5) return sessionId immediately
      return json({ sessionId: sessionRow.id }, { status: 200 });
    }

    // fallback
    logCtx(`[VTO ${requestId}] unsupported type`, { type });
    return json({ error: "Unsupported type" }, { status: 400 });
  } catch (err) {
    logErr(`[VTO ${requestId}] action fatal`, err, { type });
    return json({ error: "Internal error" }, { status: 500 });
  } finally {
    logCtx(`[VTO ${requestId}] action end`, { type });
  }
}
