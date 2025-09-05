import { Button, CalloutCard, Card, Page, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { BASIC, PLAN_KEYS } from "../plans";

import { upsertSubscription, upsertStore } from "../models/store.server";
import { Form, json, redirect, useLoaderData } from "@remix-run/react";

export const loader = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);
  //   console.log("Request--------------------------->:", request);
  const checkBilling = await billing.check();

  await upsertStore(
    session.shop,
    session?.onlineAccessInfo?.associated_user?.email ?? null,
  );

  if (checkBilling?.appSubscriptions?.[0]) {
    await upsertSubscription(session.shop, checkBilling.appSubscriptions[0]);
  }

  await billing.require({
    // plans: [BASIC_MONTHLY],
    plans: PLAN_KEYS,
    isTest: false,
    onFailure: async () => billing.request({ plan: BASIC }),
  });

  return json({ checkBilling, session, request });
};

export const action = async ({ request }) => {
  // 2. Re‑authenticate
  const { billing, session } = await authenticate.admin(request);

  // 3. Ensure there *is* an active subscription to cancel
  const { appSubscriptions } = await billing.require({
    plans: PLAN_KEYS,
    onFailure: () => billing.request({ plan: BASIC, isTest: false }),
  });

  const subscription = appSubscriptions[0];
  if (!subscription) {
    return json({ error: "No active subscription found." }, { status: 400 });
  }

  // 4. Cancel it
  const cancelled = await billing.cancel({
    subscriptionId: subscription.id,
    isTest: false, // set to false in prod
    prorate: true, // prorate unused time
  });

  if (cancelled) {
    await upsertSubscription(session.shop, {
      ...subscription,
      status: "CANCELLED",
    });
  }

  if (!cancelled) {
    return json({ error: "Failed to cancel subscription." }, { status: 500 });
  }

  // 5. Redirect back to the Pricing page with a query param (optional)
  return redirect("/app/pricing?cancelled=true");
};

export default function PricingPage() {
  const { checkBilling } = useLoaderData();

  console.log("CheckBilling:", checkBilling);
  const isActive = checkBilling?.appSubscriptions?.length > 0;
  const subscription = checkBilling?.appSubscriptions?.[0];

  console.log("isActive subscription:", isActive);
  console.log("checkBilling length:", checkBilling?.appSubscriptions?.length);

  return (
    <Page title="Your Subscription">
      <Card sectioned>
        {isActive ? (
          <>
            <Text variation="strong">
              You’re on the <code>{subscription?.name}</code> plan.
            </Text>
            <Text>
              Status: {subscription?.status} • Renews every{" "}
              {subscription?.lineItems?.[0]?.plan?.pricingDetails?.interval?.toLowerCase()}
            </Text>

            {/* Cancel form */}
            <Form method="post">
              <Button destructive submit>
                Cancel subscription
              </Button>
            </Form>
          </>
        ) : (
          <CalloutCard
            title="No active subscription"
            primaryAction={{
              content: "Subscribe now",
              url: `/create-subscription`, // your subscribe flow
            }}
            description="You need an active plan to use the try‑on feature."
          />
        )}
      </Card>
    </Page>
  );
}
