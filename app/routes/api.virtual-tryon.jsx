import {
  json,
  unstable_parseMultipartFormData,
  unstable_createMemoryUploadHandler,
} from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import axios from "axios";
// import { cors } from "remix-utils";

const API_KEY = process.env.SELLER_PIC_AUTH_KEY;
const UPLOAD_URL = process.env.SELLER_PIC_REQ_UPLOAD_URL;
const TRYON_URL = "https://api.sellerpic.ai/v1/api/generate/tryOnApparel";
const CHECK_URL = "https://api.sellerpic.ai/v1/api/generate";
const CREDIT_COST = 4;
const UPLOAD_MAX = 10_000_000; // 10 MB per file
const POLL_INTERVAL = 6000; // ms between polls
const MAX_ATTEMPTS = 40; // give up after this many polls

// // CORS headers for both preflight and actual responses
// const CORS_HEADERS = {
//   "Access-Control-Allow-Origin": "*",
//   "Access-Control-Allow-Methods": "POST, OPTIONS",
//   "Access-Control-Allow-Headers": "Content-Type, Authorization",
//   "Access-Control-Allow-Credentials": "true",
// };
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  // If you're including credentials, you cannot use "*"
  const allowedOrigin = origin;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
  };
}

export const loader = async () => {
  return json({
    ok: true,
    message: "Hello from api",
  });

  // return new Response("Method Not Allowed", {
  //   status: 405,
  // });
};

// Utility: grab extension from a filename or path
function getExt(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "png";
}

// Utility: fetch a remote image URL into a Buffer-like object
async function fetchAsBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  const ext = getExt(new URL(url).pathname);
  const buf = Buffer.from(res.data);
  buf.name = `remote.${ext}`;
  return buf;
}

// Utility: upload a Buffer or File to SellerPic and return its generated key
async function uploadToSellerPic(blob) {
  const name = blob.name || `upload.${getExt("file")}`;
  const ext = getExt(name);

  // 1️⃣ Get a signed upload URL
  const uploadRes = await axios.get(`${UPLOAD_URL}?format=${ext}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const { imageUrl, fileKey } = uploadRes.data.data;

  // 2️⃣ PUT the raw bytes
  await axios.put(imageUrl, blob, {
    headers: { "Content-Type": "application/octet-stream" },
  });

  return fileKey;
}

export const action = async ({ request }) => {
  // const origin = request.headers.get("Origin") || "*";

  const origin = request.headers.get("Origin") || "";
  const CORS = getCorsHeaders(request);

  console.log("Shop origin:", origin);

  // // ↪️ Handle CORS preflight
  // if (request.method === "OPTIONS") {
  //   return new Response(null, {
  //     status: 204,
  //     headers: CORS_HEADERS,
  //   });
  // }
  // console.log("Shop origin:", origin);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: CORS,
    });
  }

  // Only POST allowed
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", {
      status: 405,
      headers: CORS,
    });
  }

  // 🔐 Authenticate the Shopify session
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  console.log("Shop Session:", session);

  // 📦 Parse the multipart/form-data body exactly once
  const uploadHandler = unstable_createMemoryUploadHandler({
    maxPartSize: UPLOAD_MAX,
  });
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler,
  );

  // 🧩 Extract dressImage, modelImage, category
  let dress = formData.get("dressImage");
  let model = formData.get("modelImage");
  const category = formData.get("category");

  console.log("dress---------------------->:", dress);
  console.log("model---------------------->:", model);
  console.log("category---------------------->:", category);

  if (!dress || !model || !category) {
    return json(
      { error: "dressImage, modelImage & category are all required" },
      {
        status: 400,
        headers: CORS,
      },
    );
  }

  // 💳 Conditionally deduct credits in one step
  const store = await prisma.store
    .update({
      where: { shop, credits: { gte: CREDIT_COST } },
      data: { credits: { decrement: CREDIT_COST } },
    })
    .catch(() => null);

  if (!store) {
    return json(
      { error: "Insufficient credits" },
      {
        status: 402,
        headers: CORS,
      },
    );
  }

  try {
    // 🛠 Normalize inputs: if string URL, fetch into Buffer
    const [dressBlob, modelBlob] = await Promise.all([
      typeof dress === "string" ? fetchAsBuffer(dress) : dress,
      typeof model === "string" ? fetchAsBuffer(model) : model,
    ]);

    // 🚀 Upload both to SellerPic
    const [dressKey, modelKey] = await Promise.all([
      uploadToSellerPic(dressBlob),
      uploadToSellerPic(modelBlob),
    ]);

    console.log("dressKey", dressKey);
    console.log("modelKey", modelKey);

    // 📑 Build the try-on payload
    const payload = { modelImageKey: modelKey };
    if (category === "top") payload.top = { imageKey: dressKey };
    else if (category === "bottom") payload.bottom = { imageKey: dressKey };
    else throw new Error("Invalid category");

    console.log("payload", payload);

    // // 🏁 Start the generation task
    // const createRes = await axios.post(TRYON_URL, payload, {
    //   headers: {
    //     Authorization: `Bearer ${API_KEY}`,
    //     "Content-Type": "application/json",
    //   },
    // });
    // const taskId = createRes.data?.data?.id;
    // if (!taskId) throw new Error("Task ID missing");

    // // ⏳ Poll for completion
    // let fileUrl = null;
    // for (let i = 0; i < MAX_ATTEMPTS; i++) {
    //   console.log("poll Attempt:", i);
    //   await new Promise((r) => setTimeout(r, POLL_INTERVAL));
    //   const pollRes = await axios.get(`${CHECK_URL}?id=${taskId}`, {
    //     headers: { Authorization: `Bearer ${API_KEY}` },
    //   });
    //   console.log(`Attempt result ${i}`, pollRes.data?.data?.resultList);

    //   const list = pollRes.data?.data?.resultList;
    //   console.log(`Attempt result ${i}`, list);

    //   if (!Array.isArray(list) || list.length === 0) {
    //     throw new Error("Empty polling result list");
    //   }

    //   // look for any SUCCESS
    //   const successItem = list.find((item) => item.status === "SUCCESS");
    //   if (successItem) {
    //     fileUrl = successItem.fileUrl;
    //     break;
    //   }

    //   // optionally catch an outright failure
    //   const failedItem = list.find((item) => item.status === "FAILED");
    //   if (failedItem) {
    //     throw new Error(failedItem.errorMsg || "Generation failed");
    //   }

    //   // const result = pollRes.data?.data?.resultList?.[0];

    //   // console.log(`result ${i}`, result);

    //   // if (!result) throw new Error("Empty polling result");
    //   // if (result.status === "SUCCESS") {
    //   //   fileUrl = result.fileUrl;
    //   //   break;
    //   // }

    //   // if (result.status === "FAILED") {
    //   //   throw new Error(result.errorMsg || "Generation failed");
    //   // }
    // }
    // if (!fileUrl) throw new Error("Generation timed out");

    // // ✅ Success: return the generated image URL
    // return json(
    //   { url: fileUrl },
    //   {
    //     status: 200,
    //     headers: CORS_HEADERS,
    //   },
    // );
  } catch (err) {
    console.error("Error in virtual-tryon:", err);

    // 💸 Refund credits on any failure
    await prisma.store.update({
      where: { shop },
      data: { credits: { increment: CREDIT_COST } },
    });

    return json(
      { error: err.message || "Unknown error" },
      {
        status: 500,
        headers: CORS,
      },
    );
  }
};
