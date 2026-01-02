import { BillingInterval } from "@shopify/shopify-app-remix/server";

/** 1 try-on = 4 credits (for any legacy conversion needs) */
export const TRYON_TO_CREDITS = 1;
export const OVERAGE_TRYON_PRICE = 0.1;
export const OVERAGE_TRYON_CURRENCY = "USD";
export const OVERAGE_TRYON_TERMS =
  "Additional try-ons billed at $0.10 each after your plan allocation.";
const OVERAGE_TRYON_CAP = 500; // USD capped amount for usage-based billing

/** Plan keys */
export const BASIC = "BASIC";
export const GROWTH = "GROWTH";
export const ADVANCED = "ADVANCED";
export const PRO = "PRO";
export const BUSINESS = "BUSINESS";
export const ENTERPRISE = "ENTERPRISE";

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
    amount: 19, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "100 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#E3F2FD",
    priceText: "$32/mo",
    lineItems: [
      {
        amount: 19,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
      usageLineItem,
    ],
  },

  [GROWTH]: {
    key: GROWTH,
    name: "Growth",
    quota: 200, // try-ons / month
    amount: 36, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "200 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#E8F5E9",
    priceText: "$75/mo",
    lineItems: [
      {
        amount: 36,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
      usageLineItem,
    ],
  },

  [ADVANCED]: {
    key: ADVANCED,
    name: "Advanced",
    quota: 350, // try-ons / month
    amount: 59, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "350 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#FFF3E0",
    priceText: "$130/mo",
    lineItems: [
      {
        amount: 59,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
      usageLineItem,
    ],
  },

  [PRO]: {
    key: PRO,
    name: "Pro",
    quota: 650, // try-ons / month
    amount: 113, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "650 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#F3E5F5",
    priceText: "$240/mo",
    lineItems: [
      {
        amount: 113,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
      usageLineItem,
    ],
  },

  [BUSINESS]: {
    key: BUSINESS,
    name: "Business",
    quota: 1300, // try-ons / month
    amount: 226, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "1300 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#E0F7FA",
    priceText: "$480/mo",
    lineItems: [
      {
        amount: 226,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
      usageLineItem,
    ],
  },

  [ENTERPRISE]: {
    key: ENTERPRISE,
    name: "Enterprise",
    quota: 2600, // try-ons / month
    amount: 450, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "2600 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#FBE9E7",
    priceText: "$960/mo",
    lineItems: [
      {
        amount: 450,
        currencyCode: "USD",
        interval: BillingInterval.Every30Days,
      },
      usageLineItem,
    ],
  },
};

// export const PLAN_ALIASES = {
//   [ADVANCED_ANNUAL]: ADVANCED_YEARLY,
// };

export const PLAN_ALIASES = {};

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
