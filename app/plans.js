import { BillingInterval } from "@shopify/shopify-app-remix/server";

/** 1 try-on = 4 credits (for any legacy conversion needs) */
export const TRYON_TO_CREDITS = 1;
export const OVERAGE_TRYON_PRICE = 0.12;
export const OVERAGE_TRYON_CURRENCY = "USD";
export const OVERAGE_TRYON_TERMS =
  "Additional try-ons billed at $0.12 each after your plan allocation.";
const OVERAGE_TRYON_CAP = 500; // USD capped amount for usage-based billing
export const TRIAL_DAYS = 7;
export const BASIC_TRIAL_DAILY_CREDITS = 10;
export const DEFAULT_TRIAL_DAILY_CREDITS = 20;

/** Plan keys */
export const BASIC = "BASIC";
export const GROWTH = "GROWTH";
export const ADVANCED = "ADVANCED";
export const PRO = "PRO";
// export const BUSINESS = "BUSINESS";
// export const ENTERPRISE = "ENTERPRISE";

const usageLineItem = {
  interval: BillingInterval.Usage,
  amount: OVERAGE_TRYON_CAP,
  currencyCode: OVERAGE_TRYON_CURRENCY,
  terms: OVERAGE_TRYON_TERMS,
};

export const PLANS = {
  [BASIC]: {
    key: BASIC,
    name: "Basic",
    quota: 100, // try-ons / month
    amount: 19.99, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: TRIAL_DAYS,
    features: [
      "100 customer try-ons per month",
      "Increase buyer confidence",
      "1-click try-on button on product page",
      "Customizable button styling",
      "Email support",
    ],
    color: "#E3F2FD",
    priceText: "$32/mo",
  },

  [GROWTH]: {
    key: GROWTH,
    name: "Growth",
    quota: 500, // try-ons / month
    amount: 49.99, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: TRIAL_DAYS,
    features: [
      "500 customer try-ons per month",
      "Increase buyer confidence",
      "1-click try-on button on product page",
      "Customizable button styling",
      "Email support",
    ],
    color: "#E8F5E9",
    priceText: "$75/mo",
  },

  [ADVANCED]: {
    key: ADVANCED,
    name: "Advanced",
    quota: 2000, // try-ons / month
    amount: 299.99, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: TRIAL_DAYS,
    features: [
      "2000 customer try-ons per month",
      "Increase buyer confidence",
      "1-click try-on button on product page",
      "Customizable button styling",
      "Email support",
    ],
    color: "#FFF3E0",
    priceText: "$130/mo",
  },

  [PRO]: {
    key: PRO,
    name: "Pro",
    quota: 2000, // try-ons / month
    amount: 299.99, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    trialDays: TRIAL_DAYS,
    features: [
      "Extra try-ons at $0.12 per try-on",
      "2000 customer try-ons per month",
      "Increase buyer confidence",
      "1-click try-on button on product page",
      "Customizable button styling",
      "Email support",
    ],
    color: "#F3E5F5",
    priceText: "$240/mo",
    lineItems: [
      {
        amount: 299.99,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
      usageLineItem,
    ],
  },

  // [BUSINESS]: {
  //   key: BUSINESS,
  //   name: "Business",
  //   quota: 1300, // try-ons / month
  //   amount: 226, // USD
  //   currencyCode: "USD",
  //   interval: BillingInterval.Every30Days,
  //   features: [
  //     "1300 try-ons per month",
  //     "Product-page Try On button",
  //     "Button styling",
  //     "Email support",
  //     "Usage statistics",
  //   ],
  //   color: "#E0F7FA",
  //   priceText: "$480/mo",
  //   lineItems: [
  //     {
  //       amount: 226,
  //       currencyCode: "USD",
  //       interval: BillingInterval.Every30Days,
  //     },
  //     usageLineItem,
  //   ],
  // },

  // [ENTERPRISE]: {
  //   key: ENTERPRISE,
  //   name: "Enterprise",
  //   quota: 2600, // try-ons / month
  //   amount: 450, // USD
  //   currencyCode: "USD",
  //   interval: BillingInterval.Every30Days,
  //   features: [
  //     "2600 try-ons per month",
  //     "Product-page Try On button",
  //     "Button styling",
  //     "Email support",
  //     "Usage statistics",
  //   ],
  //   color: "#FBE9E7",
  //   priceText: "$960/mo",
  //   lineItems: [
  //     {
  //       amount: 450,
  //       currencyCode: "USD",
  //       interval: BillingInterval.Every30Days,
  //     },
  //     usageLineItem,
  //   ],
  // },
};

// export const PLAN_ALIASES = {
//   [ADVANCED_ANNUAL]: ADVANCED_YEARLY,
// };

export const PLAN_ALIASES = {};

export function getPlanKeyFromName(planKeyOrName) {
  if (!planKeyOrName) return "";
  const raw = String(planKeyOrName).trim();
  const upper = raw.toUpperCase();

  if (PLANS[raw]) return raw;
  if (PLANS[upper]) return upper;

  const alias = PLAN_ALIASES[raw] || PLAN_ALIASES[upper];
  if (alias) return alias;

  const entry = Object.entries(PLANS).find(([, plan]) => {
    return String(plan?.name || "").trim().toUpperCase() === upper;
  });

  return entry ? entry[0] : "";
}

export function getTrialDailyCredits(planKeyOrName) {
  const resolvedKey = getPlanKeyFromName(planKeyOrName);
  if (resolvedKey === BASIC) {
    return BASIC_TRIAL_DAILY_CREDITS;
  }

  return DEFAULT_TRIAL_DAILY_CREDITS;
}

export const PLAN_KEYS = Array.from(
  new Set([...Object.keys(PLANS), ...Object.keys(PLAN_ALIASES)]),
);

// export const ALL_PLANS = Object.values(PLANS);
export const ALL_PLANS = Object.entries(PLANS)
  .filter(([key]) => !PLAN_ALIASES[key])
  .map(([key, value]) => ({
    ...value,
    key,
  }));
