import { authenticate } from "../shopify.server";
import { ALL_PLANS, PLAN_KEYS } from "../plans"; // uses your updated plans
import { upsertStore, upsertSubscription } from "../models/store.server";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  InlineGrid,
  InlineStack,
  Layout,
  List,
  Page,
  Tag,
  Text,
  Tooltip,
} from "@shopify/polaris";
import { BillingInterval } from "@shopify/shopify-app-remix/server";

export const loader = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);
  const checkBilling = await billing.check();

  await upsertStore(
    session.shop,
    session?.onlineAccessInfo?.associated_user?.email ?? null,
  );

  if (checkBilling?.appSubscriptions?.[0]) {
    await upsertSubscription(session.shop, checkBilling.appSubscriptions[0]);
  }

  return json({ checkBilling });
};

export const action = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "subscribe") {
    const planKey = form.get("planKey");

    if (!PLAN_KEYS.includes(planKey)) {
      return json({ error: "Invalid plan selected." }, { status: 400 });
    }

    const { confirmationUrl } = await billing.request({
      plan: planKey,
      isTest: false,
    });

    // return redirect("/app/pricing");
    return redirect(confirmationUrl);
  }

  if (intent === "cancel") {
    const { appSubscriptions } = await billing.require({
      plans: PLAN_KEYS,
      onFailure: () =>
        billing.request({
          plan: ALL_PLANS?.[0]?.key, // fallback to first defined plan
          isTest: false,
        }),
    });

    const sub = appSubscriptions[0];

    if (!sub) {
      return json({ error: "No active subscription." }, { status: 400 });
    }

    await billing.cancel({
      subscriptionId: sub.id,
      isTest: false,
      prorate: true,
    });

    await upsertSubscription(session.shop, { ...sub, status: "CANCELLED" });

    return redirect("/app/pricing?cancelled=true");
  }

  return json({ error: "Unknown intent." }, { status: 400 });
};

export default function PricingPage() {
  const { checkBilling } = useLoaderData();
  const activeSubs = checkBilling?.activeSubscriptions;
  const hasPlan = activeSubs?.length > 0;
  const currentPlan = hasPlan ? activeSubs[0] : null;
  const subscription = checkBilling?.appSubscriptions?.[0];

  return (
    <Page
      title="Your Subscription"
      subtitle="Pick the plan that fits your monthly try-on needs"
    >
      <Layout>
        {subscription ? (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">
                    You’re on the <code>{subscription?.name}</code> plan
                  </Text>
                  <Tag>{subscription?.status}</Tag>
                </InlineStack>

                <Text tone="subdued">
                  Renews every{" "}
                  {subscription?.lineItems?.[0]?.plan?.pricingDetails?.interval?.toLowerCase?.() ??
                    "month"}
                </Text>

                <Divider />

                <InlineStack align="end">
                  <Form method="post">
                    <input type="hidden" name="intent" value="cancel" />
                    <Button variant="primary" tone="critical" submit>
                      Cancel subscription
                    </Button>
                  </Form>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>
        ) : (
          <>
            <Layout.Section>
              <InlineGrid gap="400" columns={{ xs: 1, sm: 2, lg: 3 }}>
                {ALL_PLANS?.map((plan) => {
                  const isMonthly = plan?.interval !== BillingInterval.Annual; // all plans are monthly per your spec
                  const intervalText = isMonthly ? "mo" : "yr";
                  const price =
                    typeof plan?.amount === "number"
                      ? `$${plan.amount.toLocaleString()}/${intervalText}`
                      : (plan?.priceText ?? "");

                  // Mark Pro as "Most popular"
                  const isMostPopular =
                    String(plan?.name || "").toLowerCase() === "pro";

                  return (
                    <Card
                      key={plan?.key}
                      background="bg-surface-secondary"
                      padding="400"
                    >
                      <BlockStack gap="300">
                        {/* Header row with plan name + price */}
                        <InlineStack align="space-between" blockAlign="center">
                          <InlineStack gap="200" blockAlign="center">
                            <Text as="h3" variant="headingMd">
                              {plan?.name}
                            </Text>
                            {isMostPopular && (
                              <Tag tone="success">Most popular</Tag>
                            )}
                          </InlineStack>

                          <InlineStack blockAlign="end" align="end">
                            <Box paddingInlineStart="200">
                              <Text as="span" variant="headingLg">
                                {price}
                              </Text>
                            </Box>
                          </InlineStack>
                        </InlineStack>

                        {/* Subhead: quota */}
                        <Text tone="subdued">
                          {plan?.quota?.toLocaleString()} try-ons / month
                        </Text>

                        <Divider />

                        {/* Features */}
                        <List type="bullet">
                          {plan?.features?.map((feature) => (
                            <List.Item key={feature}>{feature}</List.Item>
                          ))}
                        </List>

                        <Divider />

                        {/* Subscribe CTA */}
                        <InlineStack align="end">
                          <Form method="post">
                            <input
                              type="hidden"
                              name="intent"
                              value="subscribe"
                            />
                            <input
                              type="hidden"
                              name="planKey"
                              value={plan?.key}
                            />
                            <Button variant="primary" submit>
                              Choose {plan?.name}
                            </Button>
                            {/* <Tooltip
                              content="Each try-on uses 4 credits in legacy reports."
                              dismissOnMouseOut
                            >
                            </Tooltip> */}
                          </Form>
                        </InlineStack>
                      </BlockStack>
                    </Card>
                  );
                })}
              </InlineGrid>
            </Layout.Section>

            {/* Bottom note: conversion */}
            <Layout.Section>
              {/* <Card>
                <Text alignment="center" tone="subdued">
                  Note: <strong>1 try-on = 4 credits</strong>. Usage and quotas
                  are tracked in <strong>try-ons</strong>.
                </Text>
              </Card> */}
            </Layout.Section>
          </>
        )}
      </Layout>
    </Page>
  );
}
