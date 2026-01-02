import { useEffect } from "react";
import { useFetcher, useNavigate } from "@remix-run/react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Button,
  Divider,
  List,
  Banner,
  Box,
  Icon,
  CalloutCard,
} from "@shopify/polaris";
import { TitleBar, useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";

import {
  ProductIcon,
  CreditCardIcon,
  ViewIcon,
  ChartLineIcon,
} from "@shopify/polaris-icons";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  return null;
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const color = ["Red", "Orange", "Yellow", "Green"][
    Math.floor(Math.random() * 4)
  ];
  const response = await admin.graphql(
    `#graphql
      mutation populateProduct($product: ProductCreateInput!) {
        productCreate(product: $product) {
          product {
            id
            title
            handle
            status
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  barcode
                  createdAt
                }
              }
            }
          }
        }
      }`,
    {
      variables: {
        product: {
          title: `${color} Snowboard`,
        },
      },
    },
  );

  const responseJson = await response.json();
  const product = responseJson.data.productCreate.product;
  const variantId = product.variants.edges[0].node.id;
  const variantResponse = await admin.graphql(
    `#graphql
    mutation shopifyRemixTemplateUpdateVariant($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
        productVariants {
          id
          price
          barcode
          createdAt
        }
      }
    }`,
    {
      variables: {
        productId: product.id,
        variants: [{ id: variantId, price: "100.00" }],
      },
    },
  );
  const variantResponseJson = await variantResponse.json();

  return {
    product: responseJson.data.productCreate.product,
    variant: variantResponseJson.data.productVariantsBulkUpdate.productVariants,
  };
};

export default function Index() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const isLoading =
    ["loading", "submitting"].includes(fetcher.state) &&
    fetcher.formMethod === "POST";
  const productId = fetcher.data?.product?.id.replace(
    "gid://shopify/Product/",
    "",
  );

  useEffect(() => {
    if (productId) {
      shopify.toast.show("Product created");
    }
  }, [productId, shopify]);
  const generateProduct = () => fetcher.submit({}, { method: "POST" });

  const goToPricing = () => navigate("/app/pricing");

  return (
    <Page title="Virtual Try-On Dashboard">
      <TitleBar
        title="Virtual Try-On Dashboard"
        // primaryAction={{
        //   content: "Generate a product",
        //   onAction: generateProduct,
        // }}
        secondaryActions={[
          { content: "Purchase subscription", onAction: goToPricing },
        ]}
      />

      <BlockStack gap="500">
        {/* Top banner for quick guidance */}
        <Banner
          title="Welcome to the AiFrame Virtual Try-On app"
          tone="success"
        >
          <p>
            Launch interactive product previews and manage your shop’s plan from
            one place.
          </p>
        </Banner>

        {/* Hero / Value strip */}
        <Card>
          <BlockStack gap="400">
            <InlineStack align="space-between" blockAlign="center" wrap={false}>
              <BlockStack gap="150">
                <Text as="h2" variant="headingLg">
                  Bring your products to life with Virtual Try-On
                </Text>
                <Text as="p" tone="subdued">
                  Engage shoppers, boost conversion, and track performance — all
                  inside Shopify.
                </Text>
              </BlockStack>

              <InlineStack gap="200">
                {/* <Button onClick={generateProduct}>Generate a product</Button> */}
                <Button variant="primary" onClick={goToPricing}>
                  Purchase subscription
                </Button>
              </InlineStack>
            </InlineStack>

            <Divider />

            <InlineGrid columns={{ xs: 1, sm: 2, lg: 4 }} gap="400">
              <Card padding="300" background="bg-surface-secondary">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={ProductIcon} tone="base" />
                  <Text as="h3" variant="headingMd">
                    Upload & Manage
                  </Text>
                </InlineStack>
                <Box paddingBlockStart="200">
                  <Text tone="subdued">
                    Upload products and assets for customers to try on
                    virtually.
                  </Text>
                </Box>
              </Card>

              <Card padding="300" background="bg-surface-secondary">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={ViewIcon} tone="base" />
                  <Text as="h3" variant="headingMd">
                    Realistic Previews
                  </Text>
                </InlineStack>
                <Box paddingBlockStart="200">
                  <Text tone="subdued">
                    Showcase true-to-life previews that increase engagement.
                  </Text>
                </Box>
              </Card>

              <Card padding="300" background="bg-surface-secondary">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={ChartLineIcon} tone="base" />
                  <Text as="h3" variant="headingMd">
                    Built-in Analytics
                  </Text>
                </InlineStack>
                <Box paddingBlockStart="200">
                  <Text tone="subdued">
                    Track impressions, try-ons, and conversions in one view.
                  </Text>
                </Box>
              </Card>

              <Card padding="300" background="bg-surface-secondary">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={CreditCardIcon} tone="base" />
                  <Text as="h3" variant="headingMd">
                    Simple Subscriptions
                  </Text>
                </InlineStack>
                <Box paddingBlockStart="200">
                  <Text tone="subdued">
                    Pick a plan and scale usage with transparent monthly
                    pricing.
                  </Text>
                </Box>
              </Card>
            </InlineGrid>
          </BlockStack>
        </Card>

        {/* Quick-start checklist */}
        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Get started in minutes
            </Text>
            <List type="bullet">
              <List.Item>
                Upload products for customers to try on virtually
              </List.Item>
              <List.Item>Engage shoppers with realistic previews</List.Item>
              <List.Item>Track performance with built-in analytics</List.Item>
              <List.Item>
                Manage subscription plans and try-ons easily
              </List.Item>
            </List>
          </BlockStack>
        </Card>

        {/* Subscription callout */}
        <CalloutCard
          title="Ready to unlock more try-ons?"
          illustration=""
          primaryAction={{
            content: "Purchase subscription",
            onAction: goToPricing,
          }}
          secondaryAction={{ content: "Learn more", onAction: goToPricing }}
        >
          Choose a plan that fits your growth. You can upgrade or downgrade
          anytime.
        </CalloutCard>

        <Box as="div" marginBlockStart="600"></Box>

        {/* Footer note */}
        {/* <Card>
          <Text tone="subdued" alignment="center">
            Note: <strong>1 try-on = 4 credits</strong>. Usage and quotas are
            tracked in try-ons.
          </Text>
        </Card> */}
      </BlockStack>
    </Page>
  );
}
