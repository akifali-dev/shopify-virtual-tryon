import crypto from "crypto";
import shopify, { PLAN_KEYS } from "./shopify.server";
import {
  OVERAGE_TRYON_CURRENCY,
  OVERAGE_TRYON_PRICE,
  OVERAGE_TRYON_TERMS,
} from "./plans";

const USAGE_INTERVAL = "USAGE";

function findUsageLineItem(subscription) {
  if (!subscription?.lineItems) return null;
  return subscription.lineItems.find((item) => {
    const details = item?.plan?.pricingDetails;
    const typeName = details?.__typename;

    if (typeName === "AppUsagePricing") return true;

    const interval = details?.interval || details?.pricingDetails?.interval;
    return String(interval || "").toUpperCase() === USAGE_INTERVAL;
  });
}

export async function getActiveUsageSubscription({ billing, session }) {
  const billingCheck = billing
    ? await billing.check({ plans: PLAN_KEYS, isTest: false })
    : await shopify.api.billing.check({
        session,
        plans: PLAN_KEYS,
        isTest: false,
      });

  const subscription = billingCheck?.appSubscriptions?.find(
    (sub) => sub.status === "ACTIVE",
  );

  const usageLineItem = findUsageLineItem(subscription);

  return {
    subscription,
    usageLineItemId: usageLineItem?.id,
  };
}

export function buildUsageIdempotencyKey(shop) {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${shop}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function createUsageCharge({
  billing,
  session,
  usageLineItemId,
  description = OVERAGE_TRYON_TERMS,
  idempotencyKey,
  isTest = false,
}) {
  const price = {
    amount: OVERAGE_TRYON_PRICE,
    currencyCode: OVERAGE_TRYON_CURRENCY,
  };

  const payload = {
    description,
    price,
    isTest,
    ...(usageLineItemId ? { subscriptionLineItemId: usageLineItemId } : {}),
    ...(idempotencyKey ? { idempotencyKey } : {}),
  };

  if (billing?.createUsageRecord) {
    return billing.createUsageRecord(payload);
  }

  if (session) {
    return shopify.api.billing.createUsageRecord({
      session,
      ...payload,
    });
  }

  throw new Error("Unable to create usage record without billing context");
}
