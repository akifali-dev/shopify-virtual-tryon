import { BillingInterval } from "@shopify/shopify-app-remix/server";

/** 1 try-on = 4 credits (for any legacy conversion needs) */
export const TRYON_TO_CREDITS = 4;

/** Plan keys */
export const BASIC = "BASIC";
export const GROWTH = "GROWTH";
export const ADVANCED = "ADVANCED";
export const PRO = "PRO";
export const BUSINESS = "BUSINESS";
export const ENTERPRISE = "ENTERPRISE";

export const PLANS = {
  [BASIC]: {
    key: BASIC,
    name: "Basic",
    quota: 50, // try-ons / month
    amount: 32, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "50 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#E3F2FD",
    priceText: "$32/mo",
  },

  [GROWTH]: {
    key: GROWTH,
    name: "Growth",
    quota: 125, // try-ons / month
    amount: 75, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "125 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#E8F5E9",
    priceText: "$75/mo",
  },

  [ADVANCED]: {
    key: ADVANCED,
    name: "Advanced",
    quota: 250, // try-ons / month
    amount: 130, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "250 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#FFF3E0",
    priceText: "$130/mo",
  },

  [PRO]: {
    key: PRO,
    name: "Pro",
    quota: 500, // try-ons / month
    amount: 240, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "500 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#F3E5F5",
    priceText: "$240/mo",
  },

  [BUSINESS]: {
    key: BUSINESS,
    name: "Business",
    quota: 1000, // try-ons / month
    amount: 480, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "1,000 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#E0F7FA",
    priceText: "$480/mo",
  },

  [ENTERPRISE]: {
    key: ENTERPRISE,
    name: "Enterprise",
    quota: 2000, // try-ons / month
    amount: 960, // USD
    currencyCode: "USD",
    interval: BillingInterval.Every30Days,
    features: [
      "2,000 try-ons per month",
      "Product-page Try On button",
      "Button styling",
      "Email support",
      "Usage statistics",
    ],
    color: "#FBE9E7",
    priceText: "$960/mo",
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
