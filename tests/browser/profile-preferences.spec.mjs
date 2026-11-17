import { test, expect } from "@playwright/test";
const openPreferences = async (page) => {
  await page
    .getByRole("button", { name: "Profile", exact: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Preferences", exact: true }).click();
};

test("personal preferences affect appearance and notifications with navigation retention and a bounded reset", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await openPreferences(page);
  const preferences = page.getByRole("region", {
    name: "Workspace preferences",
  });
  const toggle = preferences.getByRole("switch", {
    name: "Informational toasts",
    exact: true,
  });
  await preferences
    .getByRole("button", { name: "Preview informational toast" })
    .click();
  await expect(
    page.getByText("Informational notice preview", { exact: true }),
  ).toBeVisible();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect(
    page.getByText("Informational notice preview", { exact: true }),
  ).toHaveCount(0);
  await expect(
    preferences.getByRole("button", { name: "Preview informational toast" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Informational notice preview", { exact: true }),
  ).toHaveCount(0);
  await preferences.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(page.locator("html")).toHaveAttribute(
    "data-appearance",
    "light",
  );
  await page
    .getByRole("button", { name: "Notifications", exact: true })
    .click();
  await expect(
    page.getByRole("switch", { name: "Informational toasts", exact: true }),
  ).not.toBeChecked();
  await page.getByRole("button", { name: /^Sources/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("combobox", { name: "Appearance" })).toHaveValue(
    "light",
  );
  await page.setViewportSize({ width: 1512, height: 982 });
  await openPreferences(page);
  await expect(toggle).not.toBeChecked();
  await expect(
    preferences.getByRole("radio", { name: "Light", exact: true }),
  ).toBeChecked();
  await page.locator("#initial-load").waitFor({ state: "hidden" });
  await page.locator(".deferred-reveal").waitFor({ state: "hidden" });
  await page.screenshot({ path: ".visual-runs/profile-preferences-light.png" });
  await preferences
    .getByRole("button", { name: "Reset notification preferences" })
    .click();
  await expect(toggle).toBeChecked();
  await expect(
    preferences.getByRole("radio", { name: "Light", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText("Informational notice preview", { exact: true }),
  ).toHaveCount(0);
  await preferences
    .getByRole("button", { name: "Preview informational toast" })
    .click();
  await expect(
    page.getByText("Informational notice preview", { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("quiet information retains warning previews, banners and actual permission refusals", async ({
  page,
}) => {
  await page.goto("/");
  await openPreferences(page);
  await page
    .getByRole("switch", { name: "Informational toasts", exact: true })
    .click();
  await page.getByRole("button", { name: "Connections", exact: true }).click();
  await page
    .getByRole("button", { name: "Preview connection notice", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Connection notice preview", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Error Lab", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "success toast", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "raise info banner", exact: true })
    .click();
  await expect(page.getByText("Heads up", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "clear all", exact: true }).click();
  await page.getByRole("button", { name: /^Comparisons/ }).click();
  await page.getByRole("button", { name: /RES.*us-west/ }).click();
  await page.getByRole("option", { name: /PROD.*Production/ }).click();
  const comparison = page.getByRole("region", {
    name: "Pipeline Stage Bound to LIMS Specimen State",
    exact: true,
  });
  await comparison
    .getByRole("button", { name: "Resolve", exact: true })
    .click();
  await expect(page.getByText(/Resolve comparison blocked/)).toBeVisible();
  await expect(comparison.getByRole("status")).toHaveText("Pending");
});
