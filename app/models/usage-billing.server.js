import shopify, { PLAN_KEYS, sessionStorage } from "../shopify.server";
import {
  TRYON_USAGE_PRICE,
  TRYON_USAGE_CURRENCY,
} from "../plans";

const BILLING_IS_TEST = process.env.SHOPIFY_BILLING_TEST_MODE === "true";
const USAGE_DESCRIPTION = "Virtual try-on overage";

function findUsageLineItem(subscription) {
  if (!subscription?.lineItems) return null;

  return subscription.lineItems.find((item) => {
    const pricingDetails = item?.plan?.pricingDetails;
    return (
      pricingDetails &&
      typeof pricingDetails?.terms === "string" &&
      pricingDetails?.cappedAmount
    );
  });
}

export async function loadUsageBillingContext(shop) {
  const offlineSession = await sessionStorage.loadSession(`offline_${shop}`);
  if (!offlineSession) return null;

  try {
    const billingCheck = await shopify.api.billing.check({
      session: offlineSession,
      plans: PLAN_KEYS,
      isTest: BILLING_IS_TEST,
      returnObject: true,
    });

    const subscription =
      billingCheck?.appSubscriptions?.find(
        (sub) => sub?.status === "ACTIVE" || sub?.status === "ACCEPTED",
      ) || null;

    if (!subscription) return null;

    const usageLineItem = findUsageLineItem(subscription);
    if (!usageLineItem) return null;

    return { session: offlineSession, subscription, usageLineItem };
  } catch (err) {
    console.error("[Billing] usage check failed", {
      shop,
      message: err?.message,
      name: err?.name,
    });
    return null;
  }
}

export async function createTryOnUsageRecord(shop, { idempotencyKey } = {}) {
  const context = await loadUsageBillingContext(shop);
  if (!context) {
    throw new Error("Usage billing unavailable for this shop");
  }

  const { session, usageLineItem } = context;
  const currencyCode =
    usageLineItem?.plan?.pricingDetails?.cappedAmount?.currencyCode ||
    TRYON_USAGE_CURRENCY;

  return shopify.api.billing.createUsageRecord({
    session,
    description: USAGE_DESCRIPTION,
    price: {
      amount: TRYON_USAGE_PRICE,
      currencyCode,
    },
    isTest: BILLING_IS_TEST,
    subscriptionLineItemId: usageLineItem?.id,
    idempotencyKey,
  });
}

export async function hasUsageBilling(shop) {
  return Boolean(await loadUsageBillingContext(shop));
}
