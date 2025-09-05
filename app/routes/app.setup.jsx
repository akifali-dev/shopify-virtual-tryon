// app/routes/app.setup.jsx
import React from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigation } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Button,
  Text,
  List,
  Banner,
  Select,
  Divider,
  SkeletonBodyText,
} from "@shopify/polaris";

export const config = { runtime: "nodejs" };

/**
 * GraphQL helpers
 */
const THEMES_QUERY = `#graphql
  query ThemeList($first: Int!) {
    themes(first: $first) {
      nodes { id name role }
    }
  }
`;

// Check for OS 2.0 by seeing if templates/product.json exists
const THEME_JSON_CHECK = `#graphql
  query ThemeJsonCheck($id: ID!) {
    theme(id: $id) {
      id
      files(filenames: ["templates/product.json"], first: 1) {
        nodes { filename }
      }
    }
  }
`;

function toNumericId(gidOrId) {
  if (!gidOrId) return "";
  // gid://shopify/Theme/123456789 -> 123456789
  const parts = String(gidOrId).split("/");
  return parts[parts.length - 1];
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  // 1) List themes via GraphQL
  const themeResp = await admin.graphql(THEMES_QUERY, {
    variables: { first: 25 },
  });
  const themeJson = await themeResp.json();

  if (themeJson.errors) {
    throw new Response("Failed to fetch themes", { status: 500 });
  }

  const themesRaw = themeJson.data?.themes?.nodes ?? [];

  // 2) For each theme, probe for templates/product.json via GraphQL `files`
  const themes = await Promise.all(
    themesRaw.map(async (t) => {
      const checkResp = await admin.graphql(THEME_JSON_CHECK, {
        variables: { id: t.id },
      });
      const checkJson = await checkResp.json();
      const nodes = checkJson?.data?.theme?.files?.nodes ?? [];
      const supportsJson = nodes.length > 0; // OS 2.0 heuristic
      return { id: t.id, name: t.name, role: t.role, supportsJson };
    }),
  );

  // Sort with MAIN first for a good default
  themes.sort((a, b) => (a.role === "MAIN" ? -1 : b.role === "MAIN" ? 1 : 0));

  return json({
    apiKey: process.env.SHOPIFY_API_KEY, // client_id (safe)
    appBlockHandle: "app-block", // TODO: replace with your real block handle
    appEmbedHandle: "app-embed", // TODO: replace with your real embed handle
    supportedTemplates: ["product"], // where your widget appears
    themes,
    shop: session.shop,
  });
};

export default function SetupPage() {
  const nav = useNavigation();

  const {
    apiKey,
    appBlockHandle,
    appEmbedHandle,
    supportedTemplates,
    themes,
    shop,
  } = useLoaderData();

  const defaultThemeId =
    themes.find((t) => t.role === "MAIN")?.id || themes[0]?.id || "";
  const [selectedThemeId, setSelectedThemeId] = React.useState(defaultThemeId);

  const selectedTheme = themes.find((t) => t.id === selectedThemeId);
  const isOS20 = !!selectedTheme?.supportsJson;

  // ✅ Use numeric ID (or `current`) for the Theme Editor path
  const numericThemeId = toNumericId(selectedThemeId);
  const themeEditorPath = numericThemeId
    ? `/admin/themes/${encodeURIComponent(numericThemeId)}/editor`
    : `/admin/themes/current/editor`;

  // ✅ Deep link for App Embed (works on all themes)
  const activateEmbedUrl =
    `https://${shop}${themeEditorPath}` +
    `?context=apps` +
    `&template=${encodeURIComponent(supportedTemplates[0])}` +
    `&activateAppId=${encodeURIComponent(apiKey)}/${encodeURIComponent(appEmbedHandle)}`;

  // ✅ Deep link for App Block (OS 2.0 only); uses newAppsSection target
  const addBlockUrl = isOS20
    ? `https://${shop}${themeEditorPath}` +
      `?template=${encodeURIComponent(supportedTemplates[0])}` +
      `&addAppBlockId=${encodeURIComponent(apiKey)}/${encodeURIComponent(appBlockHandle)}` +
      `&target=newAppsSection`
    : null;

  const themeOptions =
    themes?.map((t) => ({
      label: `${t.name}${t.role === "MAIN" ? " (Main)" : ""}${t.supportsJson ? "" : " — Vintage"}`,
      value: t.id,
    })) ?? [];

  return (
    <Page
      title="Install Virtual Try-On"
      subtitle="Enable the app embed and (optionally) add the app block to your theme"
    >
      <Layout>
        {/* Theme picker */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Choose a theme
              </Text>
              {nav.state === "loading" ? (
                <SkeletonBodyText />
              ) : (
                <Select
                  label="Theme"
                  options={themeOptions}
                  value={selectedThemeId}
                  onChange={setSelectedThemeId}
                />
              )}
              {!isOS20 && selectedThemeId && (
                <Banner tone="warning">
                  The selected theme is <strong>Vintage</strong> (no JSON
                  templates).
                  <strong> App blocks aren’t supported.</strong> You can still
                  enable the
                  <strong> App embed</strong>, or switch to an Online Store 2.0
                  theme.
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* App Embed (works on all themes) */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                App Embed — Quick start (works on all themes)
              </Text>
              <List type="number">
                <List.Item>
                  Click <strong>Enable App Embed</strong> to open the Theme
                  Editor (Apps context), then toggle{" "}
                  <em>AI Frame – Virtual Try-On</em> on.
                  <BlockStack gap="200" />
                  <InlineStack align="start">
                    <Button
                      url={activateEmbedUrl}
                      target="_top"
                      variant="primary"
                      disabled={!activateEmbedUrl}
                    >
                      Enable App Embed
                    </Button>
                  </InlineStack>
                </List.Item>
                <List.Item>
                  The embed auto-places a <strong>Try On</strong> button on{" "}
                  <code>{supportedTemplates.join(", ")}</code> templates.
                  Configure placement in embed settings (Auto-place, CSS
                  selector, hide “Powered by …”).
                </List.Item>
                <List.Item>
                  Save, then preview a product page and click{" "}
                  <strong>Try On</strong>.
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* App Block (OS 2.0 only) */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                App Block — Precise placement (OS 2.0)
              </Text>
              {!isOS20 && (
                <Banner tone="critical">
                  This theme doesn’t support app blocks. Use an Online Store 2.0
                  theme or continue with the App Embed above.
                </Banner>
              )}
              <List type="number">
                <List.Item>
                  Use a supported template (usually{" "}
                  <code>{supportedTemplates.join(", ")}</code>).
                </List.Item>
                <List.Item>
                  Click <strong>Add App Block</strong>, then click{" "}
                  <strong>Save</strong>.
                  <BlockStack gap="200" />
                  <InlineStack align="start">
                    <Button
                      url={addBlockUrl}
                      target="_top"
                      variant="primary"
                      disabled={!addBlockUrl}
                    >
                      Add App Block (Product)
                    </Button>
                  </InlineStack>
                </List.Item>
                <List.Item>
                  In the Theme Editor sidebar you can add/remove/reorder the
                  block and adjust settings.
                </List.Item>
              </List>

              <Divider />
              <Text as="h3" variant="headingMd">
                Tips & troubleshooting
              </Text>
              <List>
                <List.Item>
                  If a deep link lands oddly, open{" "}
                  <em>Online Store → Themes → Customize</em>, enable the
                  <em> App embed</em> (puzzle icon), then add the{" "}
                  <em>App block</em> to the <em>Product</em> template.
                </List.Item>
              </List>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
