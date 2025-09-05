import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  try {
    const { shop, topic } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    console.log(
      "Session:",
      await prisma.session.findFirst({ where: { shop } }),
    );

    console.log(
      "Subscription:",
      await prisma.subscription.findFirst({ where: { shop } }),
    );

    console.log("Store:", await prisma.store.findFirst({ where: { shop } }));
    
    await Promise.all([
      prisma.session.deleteMany({ where: { shop } }),
      prisma.subscription.deleteMany({ where: { shop } }),
      prisma.store.deleteMany({ where: { shop } }),
      // any other shop-scoped tables …
    ]);

    console.log(`✔️  Cleaned up data for ${shop}`);
    return new Response("OK");
  } catch (err) {
    if (err instanceof Response) {
      console.warn("uninstall webhook response:", err.status);
      return err;
    }
    console.error("uninstall webhook error:", err);
    return new Response("Server error", { status: 500 });
  }
};
