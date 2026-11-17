import { test, expect } from "@playwright/test";

// This receiving journey uses an explicitly initialized disposable database store.
// The ordinary browser suite keeps its no-database local-example contract.
test.skip(
  !process.env.WORKSPACE_BROWSER_DATABASE,
  "Run with the isolated workspace database server.",
);

async function openSource(page) {
  await page.goto("/");
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.locator("#initial-load").waitFor({ state: "hidden" });
  await page.locator('[data-record-id="yaml_context"]').click();
  return page.getByLabel("Source details", { exact: true });
}
async function openEditor(details, title) {
  await details
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  const editor = details.getByRole("form", { name: "Edit source metadata" });
  if (title)
    await editor.getByLabel("Display title", { exact: true }).fill(title);
  return editor;
}

test("workspace edits survive reload, stay isolated and render HTML-like input as literal source metadata", async ({
  page,
  browser,
}) => {
  const details = await openSource(page);
  const title = '<img src=x onerror="window.sourceExecuted=true">';
  const summary =
    'Pipeline text: key: "<script>window.sourceExecuted=true</script>"; SELECT * FROM samples;';
  const editor = await openEditor(details, title);
  await editor
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill(summary);
  await editor
    .getByRole("button", { name: "Save metadata", exact: true })
    .click();
  await expect(
    details.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset workspace", exact: true }),
  ).toBeVisible();
  await expect(details.locator("img")).toHaveCount(0);
  expect(await page.evaluate(() => window.sourceExecuted)).toBeUndefined();
  await details.getByText("Saved source edits", { exact: true }).click();
  await expect(
    details.getByText("Metadata saved · revision 1", { exact: true }),
  ).toBeVisible();
  const isolated = await browser.newContext();
  try {
    const other = await isolated.newPage();
    const otherDetails = await openSource(other);
    await expect(
      otherDetails.getByRole("heading", {
        name: "Pipeline configuration manifest",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      other.getByRole("button", { name: "Reset workspace", exact: true }),
    ).toHaveCount(0);
  } finally {
    await isolated.close();
  }
  await page.reload();
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.locator('[data-record-id="yaml_context"]').click();
  await expect(
    details.getByRole("heading", { name: title, exact: true }),
  ).toBeVisible();
  await expect(details.getByText(summary, { exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.sourceExecuted)).toBeUndefined();
  await page.locator("#initial-load").waitFor({ state: "hidden" });
  await details.getByText("Saved source edits", { exact: true }).click();
  await expect(
    details.getByText("Metadata saved · revision 1", { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: ".visual-runs/source-workspace-dark.png" });
  await page
    .getByRole("button", { name: "Reset workspace", exact: true })
    .click();
  await expect(
    details.getByRole("heading", {
      name: "Pipeline configuration manifest",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Reset workspace", exact: true }),
  ).toHaveCount(0);
});

test("an uncertain accepted save retries once and stale drafts survive another tab’s accepted revision", async ({
  page,
  context,
}) => {
  const details = await openSource(page);
  const editor = await openEditor(details, "Retry-safe pipeline summary");
  let dropped = false;
  await page.route("**/workspace/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (!dropped && body.variables?.input?.metadata) {
      dropped = true;
      await route.fetch();
      await route.abort();
      return;
    }
    await route.continue();
  });
  await editor
    .getByRole("button", { name: "Save metadata", exact: true })
    .click();
  await expect(editor.getByRole("alert")).toContainText("retry");
  await expect(editor.getByLabel("Display title", { exact: true })).toHaveValue(
    "Retry-safe pipeline summary",
  );
  await editor
    .getByRole("button", { name: "Save metadata", exact: true })
    .click();
  await expect(
    details.getByRole("heading", {
      name: "Retry-safe pipeline summary",
      exact: true,
    }),
  ).toBeVisible();
  await details.getByText("Saved source edits", { exact: true }).click();
  await expect(
    details.getByText("Metadata saved · revision 1", { exact: true }),
  ).toBeVisible();
  await expect(details.locator(".sources-view__history li")).toHaveCount(1);
  const draft = await openEditor(details, "Retained concurrent draft");
  const other = await context.newPage();
  try {
    const otherDetails = await openSource(other);
    const otherEditor = await openEditor(
      otherDetails,
      "Accepted in another tab",
    );
    await otherEditor
      .getByRole("button", { name: "Save metadata", exact: true })
      .click();
    await expect(
      otherDetails.getByRole("heading", {
        name: "Accepted in another tab",
        exact: true,
      }),
    ).toBeVisible();
    await draft
      .getByRole("button", { name: "Save metadata", exact: true })
      .click();
    await expect(draft.getByRole("alert")).toContainText("changed");
    await expect(
      draft.getByLabel("Display title", { exact: true }),
    ).toHaveValue("Retained concurrent draft");
    await expect(
      details.getByRole("heading", {
        name: "Accepted in another tab",
        exact: true,
      }),
    ).toBeVisible();
    await draft.getByRole("button", { name: "Cancel", exact: true }).click();
    const refreshed = await openEditor(details, "Accepted after reopening");
    await refreshed
      .getByRole("button", { name: "Save metadata", exact: true })
      .click();
    await expect(
      details.getByRole("heading", {
        name: "Accepted after reopening",
        exact: true,
      }),
    ).toBeVisible();
  } finally {
    await other.close();
  }
  await page
    .getByRole("button", { name: "Reset workspace", exact: true })
    .click();
});

test("a pending save freezes its submitted fields and Cancel cannot reopen a competing editor", async ({
  page,
}) => {
  const details = await openSource(page);
  const editor = await openEditor(details, "Confirmed after slow response");
  let release;
  let received;
  const releaseResponse = new Promise((resolve) => {
    release = resolve;
  });
  const saveReceived = new Promise((resolve) => {
    received = resolve;
  });
  await page.route("**/workspace/graphql", async (route) => {
    const body = route.request().postDataJSON();
    if (body.variables?.input?.metadata) {
      const response = await route.fetch();
      received();
      await releaseResponse;
      await route.fulfill({ response });
      return;
    }
    await route.continue();
  });
  try {
    await editor
      .getByRole("button", { name: "Save metadata", exact: true })
      .click();
    await saveReceived;
    await expect(
      editor.getByLabel("Display title", { exact: true }),
    ).toBeDisabled();
    await expect(
      editor.getByRole("textbox", { name: "Summary", exact: true }),
    ).toBeDisabled();
    await expect(editor.getByLabel(/^Tags/)).toBeDisabled();
    await expect(
      details.getByRole("button", { name: "Edit metadata", exact: true }),
    ).toBeDisabled();
    await expect(
      editor.getByLabel("Display title", { exact: true }),
    ).toHaveValue("Confirmed after slow response");
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(
      details.getByRole("button", { name: "Edit metadata", exact: true }),
    ).toBeDisabled();
    release();
    await expect(
      details.getByRole("heading", {
        name: "Confirmed after slow response",
        exact: true,
      }),
    ).toBeVisible();
    const reopened = await openEditor(details);
    await expect(
      reopened.getByLabel("Display title", { exact: true }),
    ).toBeEnabled();
    await expect(
      reopened.getByLabel("Display title", { exact: true }),
    ).toHaveValue("Confirmed after slow response");
    await reopened.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByRole("button", { name: "Reset workspace", exact: true })
      .click();
  } finally {
    release();
  }
});
