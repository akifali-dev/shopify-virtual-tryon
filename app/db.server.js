import "@shopify/shopify-api/adapters/node";
import { PrismaClient } from "@prisma/client";
import { Session } from "@shopify/shopify-api";

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export class PrismaMongoSessionStorage {
  async storeSession(session) {
    const { id, shop, state, isOnline, scope, expires } = session;
    console.log("Session:", { id, shop, state, isOnline, scope, expires });

    // await prisma.session.upsert({
    //   where: { sessionId: session.id }, // unique string
    //   create: {
    //     sessionId: session.id,
    //     shop: session.shop,
    //     state: session.state,
    //     isOnline: session.isOnline,
    //     scope: session.scope,
    //     expires: session.expires?.toISOString() ?? null,
    //     accessToken: session.accessToken,
    //     userId: session.onlineAccessInfo?.associated_user?.id ?? null,
    //     // _id field will auto‑generate ObjectId
    //   },
    //   update: {
    //     shop: session.shop,
    //     state: session.state,
    //     isOnline: session.isOnline,
    //     scope: session.scope,
    //     expires: session.expires?.toISOString() ?? null,
    //     accessToken: session.accessToken,
    //     userId: session.onlineAccessInfo?.associated_user?.id ?? null,
    //   },
    // });
    // return true;

    await prisma.session.upsert({
      where: { sessionId: session.id },
      create: {
        sessionId: session.id,
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        expires: session.expires ?? null, // pass Date | null
        accessToken: session.accessToken ?? null,
        userId: session.onlineAccessInfo?.associated_user?.id ?? null,
      },
      update: {
        shop: session.shop,
        state: session.state,
        isOnline: session.isOnline,
        scope: session.scope,
        expires: session.expires ?? null,
        accessToken: session.accessToken ?? null,
        userId: session.onlineAccessInfo?.associated_user?.id ?? null,
      },
    });
    return true;
  }

  async loadSession(id) {
    const rec = await prisma.session.findUnique({ where: { sessionId: id } });
    if (!rec) return undefined;

    // 🔑  Wrap mongo doc in a real Session
    return new Session({
      id: rec.sessionId,
      shop: rec.shop,
      state: rec.state,
      isOnline: rec.isOnline,
      // empty string if null to satisfy constructor
      scope: rec.scope ?? "",
      accessToken: rec.accessToken,
      expires: rec.expires ?? undefined,
    });
  }

  /* ---------- delete one ---------- */
  async deleteSession(id) {
    await prisma.session.deleteMany({ where: { sessionId: id } });
    return true;
  }

  /* ---------- delete many ---------- */
  async deleteSessions(ids) {
    await prisma.session.deleteMany({ where: { sessionId: { in: ids } } });
    return true;
  }
}

export default prisma;
