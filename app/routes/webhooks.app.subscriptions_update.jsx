// import { authenticate } from "../shopify.server";
// import {
//   upsertSubscription,
//   addSubscriptionCredits,
// } from "../models/store.server";

// export const action = async ({ request }) => {
//   console.log("Subscription Webhook:", request);
//   try {
//     const { payload, shop, topic } = await authenticate.webhook(request);
//     console.log(`Received ${topic} webhook for ${shop}`);
//     console.log(`Subscription Payload:`, payload);

//     const subscription = payload?.app_subscription ?? payload;
//     await upsertSubscription(shop, subscription);
//     if (subscription?.status === "ACTIVE") {
//       await addSubscriptionCredits(subscription.id);
//     }

//     return new Response(null, { status: 200 });
//   } catch (error) {
//     console.log("subscription update webhook error:", error);
//     return new Response("Server error", { status: 500 });
//   }
// };

// app/routes/webhooks.app.subscriptions_update.jsx
import crypto from "crypto";
import {
  upsertSubscription,
  addSubscriptionCredits,
} from "../models/store.server";

export const config = { runtime: "nodejs" }; // ensure Node on Vercel

function safeEqual(a = "", b = "") {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

export const action = async ({ request }) => {
  const shop = request.headers.get("x-shopify-shop-domain") || "";
  const topic = request.headers.get("x-shopify-topic") || "";
  const headerHmac = request.headers.get("x-shopify-hmac-sha256") || "";

  // 1) Read raw body once
  const raw = await request.text();

  // 2) Compute expected HMAC
  const expected = crypto
    .createHmac("sha256", process.env.SHOPIFY_API_SECRET)
    .update(raw, "utf8")
    .digest("base64");

  // 3) Reject invalid signatures with 401 (what Shopify expects)
  if (!safeEqual(headerHmac, expected)) {
    return new Response("Invalid HMAC", { status: 401 });
  }

  // 4) Parse payload & handle only the topic we care about
  if (topic !== "app_subscriptions/update") {
    return new Response(null, { status: 200 });
  }

  const payload = JSON.parse(raw);
  const sub = payload?.app_subscription ?? payload;

  await upsertSubscription(shop, sub);

  const status = sub?.status ?? sub?.appSubscription?.status;
  if (status === "ACTIVE") {
    await addSubscriptionCredits(sub.id);
  }

  return new Response(null, { status: 200 });
};
