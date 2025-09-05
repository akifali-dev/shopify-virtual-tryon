
// webhooks.app.scoped_update.jsx
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  console.log("request------------------------->:", request);
  try {
    const { payload, session, topic, shop } =
      await authenticate.webhook(request);

    console.log("Session:", session);
    console.log("payload:", payload);

    console.log(`Received ${topic} webhook for ${shop}`);
    const currentScopes = payload.current;

    if (!session) {
      console.warn(`No session found for shop ${shop} during scopes update`);
      return new Response("Session not found", { status: 404 });
    }

    console.log("currentScopes:", currentScopes);

    // Convert scopes array to comma-separated string
    const scopeString = currentScopes.join(", ");

    // Use shop as identifier instead of session.id
    await prisma.session.updateMany({
      where: {
        shop: shop,
      },
      data: {
        scope: scopeString,
      },
    });

    // console.log(`Updated scopes for shop ${shop}: ${scopeString}`);
    return new Response(null, { status: 200 });
  } catch (error) {
    console.error("Error handling scoped_update webhook:", error);
    return new Response("Internal server error", { status: 500 });
  }
};
