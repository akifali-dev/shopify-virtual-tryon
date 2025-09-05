import {
  json,
  unstable_parseMultipartFormData,
  unstable_createMemoryUploadHandler,
} from "@remix-run/node";
import axios from "axios";
import crypto from "crypto";
// import prisma from "../db.server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { uploadImageFromUrl } from "../../lib/helpers";

const {
  SHOPIFY_API_SECRET: SECRET,
  SELLER_PIC_AUTH_KEY: API_KEY,
  SELLER_PIC_REQ_UPLOAD_URL: UPLOAD_URL,
} = process.env;

const TRYON_URL = "https://api.sellerpic.ai/v1/api/generate/tryOnApparel";
const CHECK_URL = "https://api.sellerpic.ai/v1/api/generate";
const SELLER_PIC_DOWNLOAD_URL = "https://api.sellerpic.ai/v1/api/download";
const CREDIT_COST = 4;
const UPLOAD_MAX = 10_000_000; // 10 MB

// sanity-check our env
if (!SECRET || !API_KEY || !UPLOAD_URL) {
  throw new Error("Missing required configuration for Shopify or SellerPic");
}

// Utility: extract file extension
function getExt(name) {
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "png";
}

// Utility: fetch remote URL as Buffer
async function fetchAsBuffer(url) {
  const res = await axios.get(url, { responseType: "arraybuffer" });
  const buf = Buffer.from(res.data);
  buf.name = `remote.${getExt(new URL(url).pathname)}`;
  return buf;
}

// Utility: unified converter for File vs URL string
async function toBuffer(input) {
  if (input instanceof File) {
    const arrayBuffer = await input.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    buf.name = input.name;
    return buf;
  }
  if (typeof input === "string") {
    return fetchAsBuffer(input);
  }
  throw new Error("Invalid image input; must be File or URL string");
}

// Utility: upload a Buffer to SellerPic and return its key
async function uploadToSellerPic(blob) {
  const ext = getExt(blob.name || "file.png");
  const { data } = await axios.get(`${UPLOAD_URL}?format=${ext}`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const { imageUrl, fileKey } = data.data;

  await axios.put(imageUrl, blob, {
    headers: { "Content-Type": "application/octet-stream" },
  });

  return fileKey;
}

// Shopify proxy verification
function verifyProxy(params) {
  const { signature, ...rest } = params;
  if (typeof signature !== "string") return false; // avoid crash if missing

  const message = Object.entries(rest)
    .sort(([a], [b]) => a.localeCompare(b))
    .reduce(
      (acc, [key, value]) =>
        acc + `${key}=${Array.isArray(value) ? value.join(",") : value}`,
      "",
    );

  const digest = crypto
    .createHmac("sha256", SECRET)
    .update(message)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature, "hex"),
    Buffer.from(digest, "hex"),
  );
}

export async function loader({ request }) {
  // const { session, proxy } = await authenticate.public.appProxy(request, {
  //   apiKey: process.env.SHOPIFY_API_KEY,
  //   apiSecretKey: process.env.SHOPIFY_API_SECRET,
  // });

  // console.log("Proxy:", proxy);
  // console.log("Session of Proxy:", session);

  return new Response("Method Not Allowed", { status: 405 });
}

export async function action({ request }) {
  const { session } = await authenticate.public.appProxy(request);
  const { shop } = session;
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);
  const sig = params.signature;
  const type = params.type || "create";

  if (!shop || !sig || !verifyProxy(params)) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const refundCredits = async (imageId) => {
    try {
      // Check if credits were already refunded
      const image = await prisma.tryOnResult.findUnique({
        where: { id: imageId },
      });

      if (image?.refunded) {
        console.log(`Credits already refunded for imageId: ${imageId}`);
        return;
      }

      // Refund credits and mark as refunded in a transaction
      await prisma.$transaction([
        prisma.store.update({
          where: { shop },
          data: { credits: { increment: 1 } },
        }),

        prisma.tryOnResult.update({
          where: { id: imageId },
          data: { refunded: true },
        }),
      ]);
    } catch (err) {
      console.error("Credit refund failed:", err);
    }
  };

  // const refundCredits = async (imageId) => {
  //   try {
  //     await prisma.$transaction(async (tx) => {
  //       // Flip refunded -> true ONLY if it was false; count===1 means we won the race
  //       const updated = await tx.tryOnResult.updateMany({
  //         where: { id: imageId, refunded: false },
  //         data: { refunded: true },
  //       });
  //       if (updated.count === 1) {
  //         await tx.store.update({
  //           where: { shop },
  //           data: { credits: { increment: 1 } },
  //         });
  //       }
  //     });
  //   } catch (err) {
  //     console.error("Credit refund failed:", err);
  //   }
  // };

  switch (type) {
    // case "confirm": {
    //   const taskId = params.taskId;
    //   if (!taskId) {
    //     return json({ error: "Missing taskId" }, { status: 400 });
    //   }

    //   try {
    //     const pollRes = await axios.get(`${CHECK_URL}?id=${taskId}`, {
    //       headers: { Authorization: `Bearer ${API_KEY}` },
    //     });

    //     const resultList = pollRes.data?.data?.resultList || [];

    //     const store = await prisma.store.findUnique({
    //       where: { shop },
    //     });

    //     for (const item of resultList) {
    //       try {
    //         const imageRecord = await prisma.tryOnResult.findFirst({
    //           where: {
    //             taskId,
    //             resultId: item.id,
    //           },
    //         });

    //         if (item?.status === "SUCCESS") {
    //           if (
    //             imageRecord.fileUrl === "" &&
    //             (imageRecord.status === "CREATED" ||
    //               imageRecord.status === "RUNNING")
    //           ) {
    //             const downloadResponse = await axios.get(
    //               `${SELLER_PIC_DOWNLOAD_URL}?downloadFormat=png&id=${item?.id}`,
    //               {
    //                 headers: {
    //                   Authorization: `Bearer ${API_KEY}`,
    //                   "Content-Type": "application/json",
    //                 },
    //               },
    //             );

    //             const fileUrl = downloadResponse?.data?.data?.fileUrl;
    //             if (!fileUrl) {
    //               throw new Error("No fileUrl provided for successful result");
    //             }

    //             const uploadedUrl = await uploadImageFromUrl(fileUrl);

    //             await prisma.tryOnResult.update({
    //               where: { id: imageRecord.id },
    //               data: {
    //                 storeId: store?.id,
    //                 fileUrl: uploadedUrl,
    //                 taskId: taskId,
    //                 resultId: item.id,
    //                 status: item.status,
    //               },
    //             });
    //           }
    //         }

    //         if (item?.status === "FAILED") {
    //           await prisma.tryOnResult.update({
    //             where: { id: imageRecord.id },
    //             data: {
    //               storeId: store?.id,
    //               fileUrl: null,
    //               taskId: taskId,
    //               resultId: item.id,
    //               status: item.status,
    //               errorMsg: item.errorMsg,
    //             },
    //           });
    //           await refundCredits(imageRecord.id);
    //         }
    //       } catch (uploadErr) {
    //         console.error("Image upload failed:", uploadErr);
    //       }
    //     }

    //     const allFailed =
    //       resultList.length > 0 &&
    //       resultList.every((item) => item.status === "FAILED");
    //     if (allFailed) {
    //       await prisma.store.update({
    //         where: { shop },
    //         data: { credits: { increment: CREDIT_COST } },
    //       });
    //       return json({ resultList, refunded: true });
    //     }

    //     return json({ resultList });
    //   } catch (err) {
    //     console.log("Error while cofirmation:", err);

    //     await prisma.store.update({
    //       where: { shop },
    //       data: { credits: { increment: CREDIT_COST } },
    //     });
    //     return json({ error: err.message || "Unknown error" }, { status: 500 });
    //   }
    // }

    case "confirm": {
      const taskId = params.taskId;
      if (!taskId) {
        return json({ error: "Missing taskId" }, { status: 400 });
      }

      try {
        // 1) Poll SellerPic
        const pollRes = await axios.get(`${CHECK_URL}?id=${taskId}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
        });

        const resultList = pollRes.data?.data?.resultList || [];

        const store = await prisma.store.findUnique({ where: { shop } });
        if (!store) return json({ error: "Store not found" }, { status: 404 });

        // console.log("ResultList:", resultList);

        // 2) Upsert & reconcile each result by (taskId, resultId)
        for (const item of resultList) {
          try {
            const resultId = item.id;
            const status = (item?.status || "").toUpperCase();
            const errorMsg = item?.errorMsg || null;

            // Upsert guarantees a row exists; capture the returned record
            const record = await prisma.tryOnResult.findFirst({
              where: { taskId, resultId },
            });

            if (status === "SUCCESS" && !record.fileUrl) {
              // Ask SellerPic for a downloadable URL
              const dl = await axios.get(
                `${SELLER_PIC_DOWNLOAD_URL}?downloadFormat=png&id=${resultId}`,
                { headers: { Authorization: `Bearer ${API_KEY}` } },
              );

              const remoteUrl = dl?.data?.data?.fileUrl;
              if (remoteUrl) {
                // Upload to your bucket → canonical URL
                const uploadedUrl = await uploadImageFromUrl(remoteUrl);

                await prisma.tryOnResult.update({
                  where: { id: record.id },
                  data: { fileUrl: uploadedUrl, status },
                });
              }
            }

            if (status === "FAILED") {
              // Ensure DB reflects failure
              await prisma.tryOnResult.update({
                where: { id: record.id },
                data: { fileUrl: null, errorMsg, status },
              });
              // Refund exactly once per failed result
              await refundCredits(record.id);
            }
          } catch (perItemErr) {
            console.error("Per-result reconciliation failed:", perItemErr);
          }
        }

        // 3) Return your canonical DB state
        const results = await prisma.tryOnResult.findMany({
          where: { taskId },
          orderBy: { createdAt: "asc" },
        });

        return json({ resultList: results }, { status: 200 });
      } catch (err) {
        console.log("Error while confirmation:", err);
        // Do NOT blanket refund here; you refund per FAILED result above.
        return json({ error: err.message || "Unknown error" }, { status: 500 });
      }
    }

    case "create":
    default: {
      const uploadHandler = unstable_createMemoryUploadHandler({
        maxPartSize: UPLOAD_MAX,
      });

      const formData = await unstable_parseMultipartFormData(
        request,
        uploadHandler,
      );

      const dressInput = formData.get("dressImage");
      const modelInput = formData.get("modelImage");
      const category = formData.get("category");

      if (!dressInput || !modelInput || !category) {
        return json({ error: "Missing fields" }, { status: 400 });
      }

      console.log("dressInput", dressInput);
      console.log("modelInput", modelInput);
      console.log("category", category);

      const store = await prisma.store
        .update({
          where: { shop, credits: { gte: CREDIT_COST } },
          data: { credits: { decrement: CREDIT_COST } },
        })
        .catch(() => null);
      if (!store) {
        return json({ error: "Insufficient credits" }, { status: 402 });
      }

      try {
        const [dressBuffer, modelBuffer] = await Promise.all([
          toBuffer(dressInput),
          toBuffer(modelInput),
        ]);
        const [dressKey, modelKey] = await Promise.all([
          uploadToSellerPic(dressBuffer),
          uploadToSellerPic(modelBuffer),
        ]);

        const payload = { modelImageKey: modelKey };

        if (category === "top") payload.top = { imageKey: dressKey };
        else if (category === "bottom") payload.bottom = { imageKey: dressKey };
        else if (category === "one-piece")
          payload.onePiece = { imageKey: dressKey };
        else throw new Error("Invalid category");

        const createRes = await axios.post(TRYON_URL, payload, {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
            "Content-Type": "application/json",
          },
        });

        console.log("Task Response:", createRes);

        const taskId = createRes.data?.data?.id;

        const pollRes = await axios.get(`${CHECK_URL}?id=${taskId}`, {
          headers: { Authorization: `Bearer ${API_KEY}` },
        });

        const resultList = pollRes?.data?.data?.resultList;

        if (!taskId || !Array.isArray(resultList)) {
          throw new Error("Task ID missing");
        }

        if (createRes?.data?.code === 0) {
          for (const item of resultList) {
            try {
              await prisma.tryOnResult.create({
                data: {
                  storeId: store?.id,
                  fileUrl: "",
                  taskId: taskId,
                  resultId: item.id,
                  status: item.status,
                },
              });
            } catch (uploadErr) {
              console.error("Image upload failed:", uploadErr);
            }
          }
        } else {
          //
        }

        return json({ resultList, taskId }, { status: 200 });
      } catch (err) {
        console.log("Error while creation:", err);
        await prisma.store.update({
          where: { shop },
          data: { credits: { increment: CREDIT_COST } },
        });
        return json({ error: err.message || "Unknown error" }, { status: 500 });
      }
    }
  }
}
