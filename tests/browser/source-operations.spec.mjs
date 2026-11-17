import { test, expect } from "@playwright/test";

test("source metadata stays with its exact record through navigation, responsive reading and recovery", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Sources/ }).click();
  const source = page.locator('[data-record-id="notion_fragment"]');
  await source.click();
  const details = page.getByLabel("Source details", { exact: true });
  const title = "Sample intake program brief";
  const originalDate = await details.getByText(/^Source updated /).textContent();
  await details
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  const editor = details.getByRole("form", { name: "Edit source metadata" });
  await editor.getByLabel("Display title", { exact: true }).fill(title);
  await editor
    .getByRole("textbox", { name: "Summary", exact: true })
    .fill("Sample receipt, provenance and source ownership.");
  await editor.getByLabel(/^Tags/).fill("genomics, intake");
  await editor.getByRole("button", { name: "Save metadata" }).click();
  await expect(details.getByRole("status")).toHaveText(
    "Metadata saved for this browser session.",
  );
  await expect(details.getByRole("heading", { name: title })).toBeVisible();
  await expect(source).toContainText(title);
  await expect(details.getByText(/^Source updated /)).toHaveText(originalDate);
  await page.getByRole("button", { name: /^Requirements/ }).click();
  await page.getByRole("button", { name: /^Sources/ }).click();
  await expect(source).toHaveAttribute("aria-pressed", "true");
  await expect(details.getByRole("heading", { name: title })).toBeVisible();
  await page.getByRole("searchbox", { name: "Find sources" }).fill("intake");
  await expect(source).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page
    .getByRole("button", { name: /Process.*Sample Intake.*View record/ })
    .click();
  const companion = page.locator("dialog[open]");
  await companion
    .getByRole("button", { name: /sources.*Genomics program brief/ })
    .click();
  await expect(companion.getByRole("heading", { name: title })).toBeVisible();
  await expect(companion).toContainText(
    "Sample receipt, provenance and source ownership.",
  );
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.getByRole("button", { name: /^Sources/ }).click();
  await expect(details.getByRole("heading", { name: title })).toBeVisible();
  await details.getByRole("button", { name: "Restore bundled source" }).click();
  await expect(details.getByRole("status")).toHaveText(
    "Bundled source restored for this session.",
  );
  await expect(
    details.getByRole("heading", { name: "Genomics program brief" }),
  ).toBeVisible();
  await details.getByRole("button", { name: "Restore bundled source" }).click();
  await expect(details.getByRole("status")).toHaveText(
    "Bundled source is already current.",
  );
});

test("source drafts survive a denied save and permission changes govern accepted metadata", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.locator('[data-record-id="notion_fragment"]').click();
  const details = page.getByLabel("Source details", { exact: true });
  await details.getByRole("button", { name: "Edit metadata" }).click();
  const editor = details.getByRole("form", { name: "Edit source metadata" });
  await editor
    .getByLabel("Display title", { exact: true })
    .fill("Retained source draft");
  await page.getByRole("button", { name: /^RES ·/ }).click();
  await page.getByRole("option", { name: /^VAL/ }).click();
  await editor.getByRole("button", { name: "Save metadata" }).click();
  await expect(editor.getByRole("alert")).toContainText(
    "Write actions are disabled",
  );
  await expect(editor.getByLabel("Display title", { exact: true })).toHaveValue(
    "Retained source draft",
  );
  await expect(
    details.getByRole("heading", { name: "Genomics program brief" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^VAL ·/ }).click();
  await page.getByRole("option", { name: /^RES/ }).click();
  await editor.getByRole("button", { name: "Save metadata" }).click();
  await expect(
    details.getByRole("heading", { name: "Retained source draft" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Profile", exact: true })
    .first()
    .click();
  await page
    .getByRole("group", { name: "Workspace role" })
    .getByRole("button", { name: "Viewer", exact: true })
    .click();
  await page.getByRole("button", { name: /^Sources/ }).click();
  await details.getByRole("button", { name: "Restore bundled source" }).click();
  await expect(details.getByRole("status")).toContainText(
    "Viewer does not include",
  );
  await expect(
    details.getByRole("heading", { name: "Retained source draft" }),
  ).toBeVisible();
});
