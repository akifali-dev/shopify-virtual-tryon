import crypto from "crypto";
// import shopify, { PLAN_KEYS } from "./shopify.server";
import {
  OVERAGE_TRYON_CURRENCY,
  OVERAGE_TRYON_PRICE,
  OVERAGE_TRYON_TERMS,
} from "./plans";


// usage-billing.server.js
const ACTIVE_SUB_QUERY = `
  query ActiveSubs {
    currentAppInstallation {
      activeSubscriptions {
        id
        name
        status
        createdAt
        trialDays
        lineItems {
          id
          plan {
            pricingDetails {
              __typename
              ... on AppUsagePricing {
                cappedAmount { amount currencyCode }
                terms
              }
              ... on AppRecurringPricing {
                interval
                price { amount currencyCode }
              }
            }
          }
        }
      }
    }
  }
`;

function findUsageLineItem(subscription) {
  const items = subscription?.lineItems || [];
  return (
    items.find(
      (li) => li?.plan?.pricingDetails?.__typename === "AppUsagePricing",
    ) || null
  );
}

export async function getActiveUsageSubscription({ admin }) {
  if (!admin?.graphql) throw new Error("admin graphql client is required");

  const resp = await admin.graphql(ACTIVE_SUB_QUERY);
  const data = await resp.json();

  const subs = data?.data?.currentAppInstallation?.activeSubscriptions || [];
  const subscription = subs.find((s) => s.status === "ACTIVE") || null;

  const usageLineItem = findUsageLineItem(subscription);

  return {
    subscription,
    usageLineItemId: usageLineItem?.id || null,
    admin,
  };
}

export function buildUsageIdempotencyKey(shop) {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${shop}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const CREATE_USAGE = `
mutation CreateUsage($subscriptionLineItemId: ID!, $description: String!, $price: MoneyInput!, $idempotencyKey: String) {
  appUsageRecordCreate(
    subscriptionLineItemId: $subscriptionLineItemId,
    description: $description,
    price: $price,
    idempotencyKey: $idempotencyKey
  ) {
    appUsageRecord { id }
    userErrors { field message }
  }
}
`;

export async function createUsageCharge({
  admin,
  usageLineItemId,
  description,
  idempotencyKey,
  isTest = false, // keep if you want in payload logic, but Shopify uses test mode at subscription level
}) {
  console.log("Admin : ", admin);

  const price = {
    amount: OVERAGE_TRYON_PRICE,
    currencyCode: OVERAGE_TRYON_CURRENCY,
  };

  const resp = await admin.graphql(CREATE_USAGE, {
    variables: {
      subscriptionLineItemId: usageLineItemId,
      description,
      price,
      idempotencyKey,
    },
  });
  const json = await resp.json();

  const errors = json?.data?.appUsageRecordCreate?.userErrors;
  if (errors?.length) {
    throw new Error(errors.map((e) => e.message).join(", "));
  }

  return json.data.appUsageRecordCreate.appUsageRecord;
}
