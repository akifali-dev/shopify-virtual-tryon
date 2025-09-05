// app/routes/webhooks.ts
import { authenticate } from "../shopify.server";

export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // No customer data stored → acknowledge
      break;
    case "CUSTOMERS_REDACT":
      // No per-customer data to purge → acknowledge
      break;
    case "SHOP_REDACT":
      // Purge shop-level data you keep (tokens, settings, logs)
      // await db.deleteShopData(shop)
      break;
    default:
      // ok to ignore
      break;
  }
  return new Response(null, { status: 200 });
};

export const loader = () => new Response("OK");
