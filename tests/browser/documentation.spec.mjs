import { test, expect } from "@playwright/test";
import { preview } from "vite";
import { fileURLToPath } from "node:url";
import { buildDocumentationSite } from "../../scripts/documentation/build.mjs";
const root = fileURLToPath(new URL("../../", import.meta.url));
let foundation, foundationUrl;
test.beforeAll(async () => {
  await buildDocumentationSite({ root, profile: "foundation" });
  foundation = await preview({
    configFile: false,
    root,
    base: "/",
    appType: "mpa",
    build: { outDir: "dist-foundation" },
    preview: { host: "127.0.0.1", port: 0, strictPort: true },
  });
  foundationUrl = `http://127.0.0.1:${foundation.httpServer.address().port}`;
});
test.afterAll(async () => {
  if (foundation)
    await new Promise((resolve) => foundation.httpServer.close(resolve));
});

test("documentation stays readable through direct loads, theme changes and mobile navigation", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const response = await page.goto("/docs/getting-started/");
  expect(response.status()).toBe(200);
  await expect(
    page.getByRole("heading", {
      name: "Run and explore the example",
      level: 1,
    }),
  ).toBeVisible();
  for (const [name, mode] of [
    ["Light", "light"],
    ["High contrast", "contrast"],
    ["Dark", "dark"],
  ]) {
    await page.getByRole("radio", { name, exact: true }).check();
    await expect(page.locator("html")).toHaveAttribute("data-appearance", mode);
    await page.screenshot({
      path: `.visual-runs/documentation-desktop-${mode}.png`,
    });
  }
  await page
    .getByRole("navigation", { name: "Documentation", exact: true })
    .getByRole("link", { name: "GraphQL reference", exact: true })
    .click();
  await expect(page).toHaveURL(/\/docs\/graphql-reference\/$/);
  await expect(
    page.getByRole("heading", { name: "GraphQL reference", level: 1 }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator("article")).toContainText("WorkspaceSnapshot");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/docs/");
  await expect(
    page.getByRole("heading", { name: "Build with Source of Truth", level: 1 }),
  ).toBeVisible();
  await expect(page.locator(".docs-sidebar details")).not.toHaveAttribute(
    "open",
    "",
  );
  for (const [name, mode] of [
    ["Light", "light"],
    ["High contrast", "contrast"],
    ["Dark", "dark"],
  ]) {
    await page.getByRole("radio", { name, exact: true }).check();
    await page.screenshot({
      path: `.visual-runs/documentation-mobile-${mode}.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.locator(".docs-sidebar summary").click();
  await page
    .getByRole("navigation", { name: "Documentation" })
    .getByRole("link", { name: "Understand the examples" })
    .click();
  await expect(page).toHaveURL(/\/docs\/fixture-provenance\/$/);
  await page.locator(".docs-sidebar summary").click();
  await page.locator(".docs-sidebar summary").click();
  await page.setViewportSize({ width: 1512, height: 982 });
  await expect(page.locator(".docs-sidebar summary")).toBeVisible();
  await page.locator(".docs-sidebar summary").click();
  await expect(
    page
      .getByRole("navigation", { name: "Documentation" })
      .getByRole("link", { name: "Run and explore" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("foundation serves the same articles at site root with its own canonical identity", async ({
  page,
}) => {
  const response = await page.goto(`${foundationUrl}/graphql-reference/`);
  expect(response.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: "GraphQL reference", level: 1 }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://kindlight.foundation/graphql-reference/",
  );
  await page.getByRole("radio", { name: "Light", exact: true }).check();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "light",
  );
  await page
    .getByRole("navigation", { name: "Documentation" })
    .getByRole("link", { name: "Run and explore" })
    .click();
  await expect(page).toHaveURL(`${foundationUrl}/getting-started/`);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".docs-sidebar summary").click();
  await expect(
    page.getByRole("heading", {
      name: "Run and explore the example",
      level: 1,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: ".visual-runs/documentation-foundation-mobile.png",
  });
  expect((await page.request.get(`${foundationUrl}/missing/`)).status()).toBe(
    404,
  );
  await page.goto(`${foundationUrl}/404.html`);
  await expect(
    page.getByRole("heading", { name: "Document not found" }),
  ).toBeVisible();
});
