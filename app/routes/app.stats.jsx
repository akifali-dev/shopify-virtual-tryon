import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useMemo } from "react";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PLANS } from "../plans";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const store = await prisma.store.findUnique({
    where: { shop: session.shop },
  });

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

  const creditsRemainingLive = store?.credits ?? 0;

  const isFree = !subscription; // <— no active subscription
  const planKey = subscription?.planKey;
  const planFromConfig = planKey ? PLANS?.[planKey] : undefined;

  // Allocation:
  // - Paid plan: subscription.quota (fallback to plan config)
  // - Free plan: show wallet balance (one-time free credits) as allocation
  const allocationCredits = isFree
    ? creditsRemainingLive
    : (subscription?.quota ?? planFromConfig?.quota ?? 0);

  // Usage (within allocation)
  const planCreditsRemaining = Math.min(
    creditsRemainingLive,
    allocationCredits,
  );
  const creditsUsed = Math.max(allocationCredits - planCreditsRemaining, 0);
  const usagePercent = allocationCredits
    ? Math.min(100, Math.round((creditsUsed / allocationCredits) * 100))
    : 0;

  const surplusCredits = Math.max(0, creditsRemainingLive - allocationCredits);

  // Labels
  const planName = isFree
    ? "Free"
    : planFromConfig?.name || subscription?.planKey || "Plan";

  const renewal = !isFree
    ? getRenewalDate(subscription.updatedAt, subscription.interval)
    : null;

  const {
    daysUsed,
    daysTotal,
    percent: cyclePercent,
  } = !isFree
    ? getCycleDays(subscription.updatedAt, subscription.interval)
    : { daysUsed: 0, daysTotal: 0, percent: 0 };

  // Pace / forecast (skip for Free to avoid confusion)
  const avgDailyUsage = useMemo(() => {
    return daysUsed ? (creditsUsed / daysUsed).toFixed(2) : `${creditsUsed}`;
  }, [creditsUsed, daysUsed]);

  const projectedUsed = useMemo(() => {
    if (!daysUsed) return creditsUsed;
    return Math.round((creditsUsed / daysUsed) * daysTotal);
  }, [creditsUsed, daysUsed, daysTotal]);

  const projectedRemaining = Math.max(0, allocationCredits - projectedUsed);
  const paceLabel =
    projectedUsed > allocationCredits
      ? "Over pace"
      : projectedUsed === allocationCredits
        ? "On pace"
        : "Under pace";

  return (
    <Page title="Usage (Try-ons)" subtitle="Track your try-ons and progress">
      <BlockStack gap="400">
        {/* Top summary row */}
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Plan
                </Text>
                <Tag>
                  {isFree ? "FREE" : (subscription?.status ?? "ACTIVE")}
                </Tag>
              </InlineStack>

              <Text variant="headingLg">{planName}</Text>

              {!isFree && renewal && (
                <Text tone="subdued">
                  Next renewal: {renewal.toDateString()}
                </Text>
              )}
              {isFree && (
                <Text tone="subdued">
                  You’re on the Free plan with one-time trial credits.
                </Text>
              )}

              <Divider />

              <InlineStack align="space-between">
                <Text tone="subdued">
                  {isFree ? "Available (one-time)" : "Allocation (per cycle)"}
                </Text>
                <Text as="p" variant="headingLg">
                  {allocationCredits.toLocaleString()} Try-ons
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Usage {isFree ? "" : "this cycle"}
              </Text>

              <InlineGrid columns={{ xs: 1, sm: 3 }}>
                <BlockStack gap="050">
                  <Text tone="subdued">Used</Text>
                  <Text variant="headingLg">
                    {creditsUsed.toLocaleString()}
                  </Text>
                </BlockStack>
                <BlockStack gap="050">
                  <Text tone="subdued">
                    {isFree ? "Remaining" : "Remaining (in plan)"}
                  </Text>
                  <Text variant="headingLg">
                    {planCreditsRemaining.toLocaleString()}
                  </Text>
                </BlockStack>
                {!isFree && (
                  <BlockStack gap="050">
                    <Text tone="subdued">Surplus (wallet)</Text>
                    <Text variant="headingLg">
                      {surplusCredits.toLocaleString()}
                    </Text>
                  </BlockStack>
                )}
              </InlineGrid>

              <Divider />

              <BlockStack gap="150">
                <Text tone="subdued">
                  {isFree ? "Trial credits used" : "Allocation used"}
                </Text>
                <ProgressBar
                  progress={usagePercent}
                  ariaLabelledby="usage-bar"
                />
                <InlineStack align="space-between">
                  <Text id="usage-bar" tone="subdued">
                    {usagePercent}% used
                  </Text>
                  <Text tone="subdued">
                    {planCreditsRemaining.toLocaleString()} remaining
                  </Text>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                {isFree ? "Upgrade for monthly allocation" : "Cycle progress"}
              </Text>

              {isFree ? (
                <Text tone="subdued">
                  Upgrade to a paid plan to get a monthly try-on allocation and
                  renewals.
                </Text>
              ) : (
                <>
                  <BlockStack gap="150">
                    <ProgressBar
                      progress={cyclePercent}
                      ariaLabelledby="cycle-bar"
                    />
                    <InlineStack align="space-between">
                      <Text id="cycle-bar" tone="subdued">
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
                      <Text variant="headingLg">{avgDailyUsage}</Text>
                    </BlockStack>
                    <BlockStack gap="050">
                      <Text tone="subdued">Pace</Text>
                      <Text variant="headingLg">{paceLabel}</Text>
                    </BlockStack>
                  </InlineGrid>
                </>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>

        {/* Details & forecast */}
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
          <Card title="Details">
            <BlockStack gap="200">
              {isFree ? (
                <>
                  <Text tone="subdued">
                    You currently have{" "}
                    <strong>{allocationCredits.toLocaleString()}</strong> free
                    try-ons available.
                  </Text>
                  <Text tone="subdued">
                    Free credits are one-time. Upgrade to get a recurring
                    monthly allocation and advanced features.
                  </Text>
                </>
              ) : (
                <>
                  <Text tone="subdued">
                    Your current plan provides{" "}
                    <strong>{allocationCredits.toLocaleString()}</strong>{" "}
                    try-ons per cycle.
                  </Text>
                  <Text tone="subdued">
                    You’ve used <strong>{creditsUsed.toLocaleString()}</strong>{" "}
                    try-ons so far ({usagePercent}% of your allocation).
                  </Text>
                  {surplusCredits > 0 && (
                    <Text tone="subdued">
                      You have{" "}
                      <strong>{surplusCredits.toLocaleString()}</strong> surplus
                      try-ons in your wallet beyond this cycle’s allocation.
                    </Text>
                  )}
                </>
              )}
            </BlockStack>
          </Card>

          <Card title={isFree ? "Why upgrade?" : "Forecast"}>
            <BlockStack gap="200">
              {isFree ? (
                <Text tone="subdued">
                  Paid plans unlock a monthly try-on pool, auto-renewals, and
                  priority support — perfect for steady growth.
                </Text>
              ) : (
                <>
                  <InlineGrid columns={{ xs: 1, sm: 2 }}>
                    <BlockStack gap="050">
                      <Text tone="subdued">Projected usage</Text>
                      <Text variant="headingLg">
                        {projectedUsed.toLocaleString()} /{" "}
                        {allocationCredits.toLocaleString()}
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
                    Projection assumes your current daily average continues for
                    the rest of the cycle.
                  </Text>
                </>
              )}
            </BlockStack>
          </Card>
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}
