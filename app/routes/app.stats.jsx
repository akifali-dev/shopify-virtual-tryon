import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useMemo, useState } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  InlineStack,
  Divider,
  ProgressBar,
  Tag,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PLANS } from "../plans";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const store = await prisma.store.findUnique({
    where: { shop: session.shop },
  });

  // Active subscription (most recent)
  const subscription = await prisma.subscription.findFirst({
    where: { shop: session.shop, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });

  return json({ store, subscription });
};

function getRenewalDate(updatedAt, interval) {
  if (!updatedAt || !interval) return null;
  const last = new Date(updatedAt);
  const isAnnual =
    interval === "ANNUAL" ||
    interval === "EVERY_365_DAYS" ||
    interval === "ANNUALLY";
  const ms = (isAnnual ? 365 : 30) * 24 * 60 * 60 * 1000;
  return new Date(last.getTime() + ms);
}

function getCycleDays(updatedAt, interval) {
  if (!updatedAt || !interval) return { daysUsed: 0, daysTotal: 0, percent: 0 };
  const last = new Date(updatedAt);
  const now = new Date();

  const isAnnual =
    interval === "ANNUAL" ||
    interval === "EVERY_365_DAYS" ||
    interval === "ANNUALLY";

  const daysTotal = isAnnual ? 365 : 30;
  const daysUsed = Math.max(
    0,
    Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const percent = daysTotal
    ? Math.min(100, Math.round((daysUsed / daysTotal) * 100))
    : 0;

  return { daysUsed, daysTotal, percent };
}

export default function StatsPage() {
  const { store, subscription } = useLoaderData();

  // ==== Source values from DB ====
  const creditsRemainingLive = store?.credits ?? 0; // live credits in wallet
  const totalCreditsPlan = subscription?.credits ?? 0; // plan allocation (credits)

  // ==== Convert to try-ons (primary unit) ====
  const TRYON_TO_CREDITS = 4;
  const toTryOns = (credits) => Math.floor((credits || 0) / TRYON_TO_CREDITS);

  const tryOnsAlloc = toTryOns(totalCreditsPlan); // plan allocation in try-ons / cycle
  const tryOnsLive = toTryOns(creditsRemainingLive); // currently available in try-ons (wallet)

  // We present plan allocation vs usage this cycle (ignoring extra wallet surplus)
  const surplusTryOns = Math.max(0, tryOnsLive - tryOnsAlloc); // rollover/extra beyond plan
  const planTryOnsRemaining = Math.min(tryOnsLive, tryOnsAlloc); // capped remaining within plan
  const tryOnsUsed = Math.max(tryOnsAlloc - planTryOnsRemaining, 0); // used within allocation
  const usagePercentTryOns = tryOnsAlloc
    ? Math.min(100, Math.round((tryOnsUsed / tryOnsAlloc) * 100))
    : 0;

  // Plan & cycle info
  const planName = subscription
    ? PLANS?.[subscription.planKey]?.name || subscription.planKey
    : "None";

  const renewal = subscription
    ? getRenewalDate(subscription.updatedAt, subscription.interval)
    : null;

  const {
    daysUsed,
    daysTotal,
    percent: cyclePercent,
  } = subscription
    ? getCycleDays(subscription.updatedAt, subscription.interval)
    : { daysUsed: 0, daysTotal: 0, percent: 0 };

  // Pace / forecast
  const avgDailyUsageTryOns = useMemo(() => {
    return daysUsed ? (tryOnsUsed / daysUsed).toFixed(2) : `${tryOnsUsed}`;
  }, [tryOnsUsed, daysUsed]);

  const projectedTryOns = useMemo(() => {
    if (!daysUsed) return tryOnsUsed;
    return Math.round((tryOnsUsed / daysUsed) * daysTotal);
  }, [tryOnsUsed, daysUsed, daysTotal]);

  const projectedRemaining = Math.max(0, tryOnsAlloc - projectedTryOns);
  const paceLabel =
    projectedTryOns > tryOnsAlloc
      ? "Over pace"
      : projectedTryOns === tryOnsAlloc
        ? "On pace"
        : "Under pace";

  return (
    <Page title="Try-on usage" subtitle="Track your try-ons and cycle progress">
      <BlockStack gap="400">
        {/* Top summary row */}
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Plan
                </Text>
                {subscription?.status && <Tag>{subscription.status}</Tag>}
              </InlineStack>

              <Text variant="headingLg">{planName}</Text>

              {renewal && (
                <Text tone="subdued">
                  Next renewal: {renewal.toDateString()}
                </Text>
              )}

              <Divider />

              <InlineStack align="space-between">
                <Text tone="subdued">Allocation</Text>
                <Text as="p" variant="headingLg">
                  {tryOnsAlloc.toLocaleString()} try-ons
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Try-on usage
              </Text>

              <InlineGrid columns={{ xs: 1, sm: 3 }}>
                <BlockStack gap="050">
                  <Text tone="subdued">Used</Text>
                  <Text variant="headingLg">{tryOnsUsed.toLocaleString()}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text tone="subdued">Remaining</Text>
                  <Text variant="headingLg">
                    {planTryOnsRemaining.toLocaleString()}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text tone="subdued">Surplus</Text>
                  <Text variant="headingLg">
                    {surplusTryOns.toLocaleString()}
                  </Text>
                </BlockStack>
              </InlineGrid>

              <Divider />

              <BlockStack gap="150">
                <Text tone="subdued">Allocation used</Text>
                <ProgressBar
                  progress={usagePercentTryOns}
                  ariaLabelledby="usage-tryons"
                />
                <InlineStack align="space-between">
                  <Text id="usage-tryons" tone="subdued">
                    {usagePercentTryOns}% used
                  </Text>
                  <Text tone="subdued">
                    {planTryOnsRemaining.toLocaleString()} remaining
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Cycle progress
              </Text>

              <BlockStack gap="150">
                <ProgressBar
                  progress={cyclePercent}
                  ariaLabelledby="cycle-label"
                />
                <InlineStack align="space-between">
                  <Text id="cycle-label" tone="subdued">
                    {daysUsed} days elapsed
                  </Text>
                  <Text tone="subdued">
                    {Math.max(0, daysTotal - daysUsed)} days left
                  </Text>
                </InlineStack>
              </BlockStack>

              <Divider />

              <InlineGrid columns={{ xs: 1, sm: 2 }}>
                <BlockStack gap="050">
                  <Text tone="subdued">Avg/day</Text>
                  <Text variant="headingLg">{avgDailyUsageTryOns}</Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text tone="subdued">Pace</Text>
                  <Text variant="headingLg">{paceLabel}</Text>
                </BlockStack>
              </InlineGrid>
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Details & forecast */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card title="Details">
            <BlockStack gap="200">
              <Text tone="subdued">
                Your current plan provides{" "}
                <strong>{tryOnsAlloc.toLocaleString()}</strong> try-ons per
                cycle.
              </Text>
              <Text tone="subdued">
                You’ve used <strong>{tryOnsUsed.toLocaleString()}</strong>{" "}
                try-ons so far ({usagePercentTryOns}% of your allocation).
              </Text>
              {surplusTryOns > 0 && (
                <Text tone="subdued">
                  You have <strong>{surplusTryOns.toLocaleString()}</strong>{" "}
                  surplus try-ons available.
                </Text>
              )}
              <Divider />
              <Text alignment="center" tone="subdued">
                Try-ons are the primary unit of metering.
              </Text>
            </BlockStack>
          </Card>

          <Card title="Forecast">
            <BlockStack gap="200">
              <InlineGrid columns={{ xs: 1, sm: 2 }}>
                <BlockStack gap="050">
                  <Text tone="subdued">Projected usage</Text>
                  <Text variant="headingLg">
                    {projectedTryOns.toLocaleString()} /{" "}
                    {tryOnsAlloc.toLocaleString()}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text tone="subdued">Projected remaining</Text>
                  <Text variant="headingLg">
                    {projectedRemaining.toLocaleString()}
                  </Text>
                </BlockStack>
              </InlineGrid>
              <Text tone="subdued">
                Projection assumes your current daily average continues for the
                rest of the cycle.
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
