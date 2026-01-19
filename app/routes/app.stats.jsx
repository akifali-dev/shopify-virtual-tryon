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
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PLANS } from "../plans";

const FREE_TRIAL_DAYS = 7;
const TRIAL_DAILY_CREDITS = 20;

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const store = await prisma.store.findUnique({
    where: { shop: session.shop },
  });

  const subscription = await prisma.subscription.findFirst({
    where: { shop: session.shop, status: "ACTIVE" },
    orderBy: { updatedAt: "desc" },
  });

  let todayUsage = 0;
  if (store?.id) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    todayUsage = await prisma.tryOnResult.count({
      where: {
        storeId: store.id,
        status: "SUCCESS",
        createdAt: {
          gte: today,
          lt: tomorrow,
        },
      },
    });
  }

  return json({ store, subscription, todayUsage });
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

function getTrialInfo(subscription) {
  if (!subscription?.trialStartedAt) {
    return { isActive: false, daysUsed: 0, daysLeft: 0, percent: 0 };
  }

  const startDate = new Date(subscription.trialStartedAt);
  if (Number.isNaN(startDate.getTime())) {
    return { isActive: false, daysUsed: 0, daysLeft: 0, percent: 0 };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  startDate.setHours(0, 0, 0, 0);

  const daysUsed = Math.max(
    0,
    Math.floor(
      (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    ),
  );

  const daysLeft = Math.max(0, FREE_TRIAL_DAYS - daysUsed);
  const isActive = daysUsed < FREE_TRIAL_DAYS;
  const percent = FREE_TRIAL_DAYS
    ? Math.min(100, Math.round((daysUsed / FREE_TRIAL_DAYS) * 100))
    : 0;

  return { isActive, daysUsed, daysLeft, percent };
}

export default function StatsPage() {
  const { store, subscription, todayUsage } = useLoaderData();

  const creditsRemainingLive = store?.credits ?? 0;

  const hasSubscription = Boolean(subscription);
  const planKey = subscription?.planKey;
  const planFromConfig = planKey ? PLANS?.[planKey] : undefined;
  const trialInfo = getTrialInfo(subscription);
  const isTrial = hasSubscription && trialInfo.isActive;
  const trialCreditsRemaining = Math.max(
    0,
    TRIAL_DAILY_CREDITS - todayUsage,
  );

  // Allocation:
  // - Paid plan: subscription.quota (fallback to plan config)
  // - Trial: daily trial credits
  const allocationCredits = isTrial
    ? TRIAL_DAILY_CREDITS
    : hasSubscription
      ? (subscription?.quota ?? planFromConfig?.quota ?? 0)
      : 0;

  // Usage (within allocation)
  const planCreditsRemaining = isTrial
    ? trialCreditsRemaining
    : hasSubscription
      ? Math.min(creditsRemainingLive, allocationCredits)
      : 0;
  const creditsUsed = isTrial
    ? Math.min(TRIAL_DAILY_CREDITS, todayUsage)
    : Math.max(allocationCredits - planCreditsRemaining, 0);
  const usagePercent = allocationCredits
    ? Math.min(100, Math.round((creditsUsed / allocationCredits) * 100))
    : 0;

  const surplusCredits =
    hasSubscription && !isTrial
      ? Math.max(0, creditsRemainingLive - allocationCredits)
      : 0;

  // Labels
  const planName = hasSubscription
    ? planFromConfig?.name || subscription?.planKey || "Plan"
    : "No active plan";

  const renewal = hasSubscription && !isTrial
    ? getRenewalDate(subscription.updatedAt, subscription.interval)
    : null;

  const {
    daysUsed,
    daysTotal,
    percent: cyclePercent,
  } = hasSubscription && !isTrial
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
        {isTrial && trialCreditsRemaining === 0 && (
          <Banner
            tone="critical"
            title="Daily trial limit reached"
          >
            <p>
              You’ve used all {TRIAL_DAILY_CREDITS} trial credits for today.
              You can keep using the app tomorrow, or upgrade for unlimited
              access right away.
            </p>
          </Banner>
        )}

        {/* Top summary row */}
        <InlineGrid columns={{ xs: 1, md: 3 }} gap="400">
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h3" variant="headingMd">
                  Plan
                </Text>
                <Tag>
                  {hasSubscription
                    ? (subscription?.status ?? "ACTIVE")
                    : "INACTIVE"}
                </Tag>
              </InlineStack>

              <Text variant="headingLg">{planName}</Text>

              {isTrial && (
                <Text tone="subdued">
                  Trial ends in {trialInfo.daysLeft} days. Your subscription
                  starts immediately after the trial ends.
                </Text>
              )}
              {!isTrial && hasSubscription && renewal && (
                <Text tone="subdued">
                  Next renewal: {renewal.toDateString()}
                </Text>
              )}
              {!hasSubscription && (
                <Text tone="subdued">
                  Subscribe to start your 7-day free trial with 20 credits per
                  day.
                </Text>
              )}

              <Divider />

              <InlineStack align="space-between">
                <Text tone="subdued">
                  {isTrial
                    ? "Daily trial credits"
                    : hasSubscription
                      ? "Allocation (per cycle)"
                      : "Allocation"}
                </Text>
                <Text as="p" variant="headingLg">
                  {allocationCredits.toLocaleString()}{" "}
                  {isTrial ? "Credits" : "Try-ons"}
                </Text>
              </InlineStack>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingMd">
                Usage {isTrial ? "today" : hasSubscription ? "this cycle" : ""}
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
                    {isTrial
                      ? "Remaining today"
                      : hasSubscription
                        ? "Remaining (in plan)"
                        : "Remaining"}
                  </Text>
                  <Text variant="headingLg">
                    {planCreditsRemaining.toLocaleString()}
                  </Text>
                </BlockStack>
                {hasSubscription && !isTrial && (
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
                  {isTrial
                    ? "Trial credits used today"
                    : hasSubscription
                      ? "Allocation used"
                      : "Allocation used"}
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
                {isTrial
                  ? "Trial progress"
                  : hasSubscription
                    ? "Cycle progress"
                    : "Get started"}
              </Text>

              {isTrial ? (
                <>
                  <BlockStack gap="150">
                    <ProgressBar
                      progress={trialInfo.percent}
                      ariaLabelledby="trial-bar"
                    />
                    <InlineStack align="space-between">
                      <Text id="trial-bar" tone="subdued">
                        {trialInfo.daysUsed} days elapsed
                      </Text>
                      <Text tone="subdued">
                        {trialInfo.daysLeft} days left
                      </Text>
                    </InlineStack>
                  </BlockStack>

                  <Divider />

                  <Text tone="subdued">
                    Trial usage is capped at {TRIAL_DAILY_CREDITS} credits per
                    day. Your full plan starts immediately after the trial.
                  </Text>
                </>
              ) : !hasSubscription ? (
                <Text tone="subdued">
                  Choose a subscription to unlock the 7-day free trial and
                  start generating try-ons.
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
              {isTrial ? (
                <>
                  <Text tone="subdued">
                    You’re currently in a free trial with{" "}
                    <strong>{TRIAL_DAILY_CREDITS}</strong> credits per day.
                  </Text>
                  <Text tone="subdued">
                    Today you’ve used{" "}
                    <strong>{creditsUsed.toLocaleString()}</strong> credits,{" "}
                    leaving{" "}
                    <strong>{planCreditsRemaining.toLocaleString()}</strong>{" "}
                    for the rest of the day.
                  </Text>
                  <Text tone="subdued">
                    Trial ends in {trialInfo.daysLeft} days, and your paid
                    subscription starts immediately after.
                  </Text>
                </>
              ) : !hasSubscription ? (
                <>
                  <Text tone="subdued">
                    No active subscription is on file for this store yet.
                  </Text>
                  <Text tone="subdued">
                    Subscribe to start your 7-day free trial with 20 credits
                    per day.
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

          <Card title={isTrial || !hasSubscription ? "Why subscribe?" : "Forecast"}>
            <BlockStack gap="200">
              {isTrial || !hasSubscription ? (
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
