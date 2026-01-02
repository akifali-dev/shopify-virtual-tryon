import prisma from "../db.server";
import { PLANS, PLAN_ALIASES, TRYON_TO_CREDITS } from "../plans";

const PLAN_NAME_TO_KEY = Object.fromEntries(
  Object.entries(PLANS).map(([key, value]) => [value.name, key]),
);

export async function upsertStore(shop, ownerEmail) {
  return prisma.store.upsert({
    where: { shop },
    update: { ownerEmail },
    create: { shop, ownerEmail, credits: 15 },
  });
}

export async function upsertSubscription(shop, subscription) {
  if (!subscription) return;

  let planKey = PLAN_NAME_TO_KEY[subscription.name] || subscription.name;
  planKey =
    PLAN_ALIASES[planKey] || PLAN_ALIASES[planKey.toUpperCase()] || planKey;
  const plan = PLANS[planKey] || {};
  await prisma.$transaction(async (tx) => {
    const store = await tx.store.findUnique({ where: { shop } });

    const existing = await tx.subscription.findUnique({
      where: { subscriptionId: subscription.id },
    });

    console.log("Existing subscription:", existing);

    const tryonsPerMonth = plan.quota ?? 0;
    const creditsPerMonth = tryonsPerMonth * TRYON_TO_CREDITS;

    await tx.subscription.upsert({
      where: { subscriptionId: subscription.id },
      update: {
        shop,
        planKey,
        // quota: plan.quota ?? 0,
        quota: tryonsPerMonth,
        status: subscription.status,
        interval:
          plan.interval ??
          subscription?.lineItems?.[0]?.plan?.pricingDetails?.interval ??
          "",
        storeId: store?.id,
      },
      create: {
        shop,
        subscriptionId: subscription.id,
        planKey,
        // quota: plan.quota ?? 0,
        // credits: plan.quota ?? 0,

        quota: tryonsPerMonth, // TRY-ONS
        credits: creditsPerMonth,
        status: subscription.status,
        interval:
          plan.interval ??
          subscription?.lineItems?.[0]?.plan?.pricingDetails?.interval ??
          "",
        storeId: store?.id,
        lastCreditedAt: new Date(),
      },
    });

    // if (plan.quota) {
    //   const creditDelta = plan.quota - (existing?.quota ?? 0);
    //   if (creditDelta !== 0) {
    //     await tx.store.update({
    //       where: { shop },
    //       data: { credits: { increment: creditDelta } },
    //     });
    //   }
    // }

    // If plan changed, adjust store credits IN CREDITS (not try-ons)
    if (tryonsPerMonth) {
      const prevTryons = existing?.quota ?? 0;
      const tryonDelta = tryonsPerMonth - prevTryons;
      const creditDelta = tryonDelta * TRYON_TO_CREDITS;
      if (creditDelta !== 0) {
        await tx.store.update({
          where: { shop },
          data: { credits: { increment: creditDelta } },
        });
      }
    }
  });
}

export async function addSubscriptionCredits(subscriptionId) {
  console.log("subscriptionId:", subscriptionId);
  return prisma.$transaction(async (tx) => {
    const subscription = await tx.subscription.findUnique({
      where: { subscriptionId },
    });

    if (!subscription) return null;

    const intervalDays = {
      EVERY_30_DAYS: 30,
      ANNUAL: 365,
    };

    const now = new Date();
    const days = intervalDays[subscription.interval] ?? 30;
    if (subscription.lastCreditedAt) {
      const lastCredit = new Date(subscription.lastCreditedAt);
      const nextCreditDate = new Date(lastCredit);
      nextCreditDate.setDate(nextCreditDate.getDate() + days);
      if (now < nextCreditDate) {
        return subscription;
      }
    }

    await tx.subscription.update({
      where: { subscriptionId },
      data: {
        credits: { increment: subscription.quota },
        // credits: { increment: subscription.quota * TRYON_TO_CREDITS },
        lastCreditedAt: now,
      },
    });

    return tx.store.update({
      where: { shop: subscription.shop },
      data: { credits: { increment: subscription.quota } },
      // data: { credits: { increment: subscription.quota * TRYON_TO_CREDITS } },
    });
  });
}
