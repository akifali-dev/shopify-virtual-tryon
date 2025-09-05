import "@shopify/shopify-app-remix/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-remix/server";
import { PrismaMongoSessionStorage } from "./db.server";
import { PLANS } from "./plans";

const apiSecretKey = process.env.SHOPIFY_API_SECRET;
if (!apiSecretKey) {
  throw new Error("SHOPIFY_API_SECRET environment variable is required");
}

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  // apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiSecretKey,
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaMongoSessionStorage(),
  distribution: AppDistribution.AppStore,
  billing: PLANS,
  future: {
    unstable_newEmbeddedAuthStrategy: true,
    removeRest: true,
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export const sessionStorage = shopify.sessionStorage;
export {
  PLANS,
  PLAN_KEYS,
  ALL_PLANS,
  BASIC,
  ADVANCED,
  BUSINESS,
  ENTERPRISE,
  PLAN_ALIASES,
  PRO,
  GROWTH,
  TRYON_TO_CREDITS,
} from "./plans";
