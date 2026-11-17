import { test, expect } from "@playwright/test";
test.use({ storageState: { cookies: [], origins: [] } });

test("first invitation is optional, remembered and replayable in the real corridor", async ({
  page,
}) => {
  await page.goto("/");
  const invitation = page.getByRole("complementary", {
    name: "Follow a sample.",
  });
  await expect(invitation).toBeVisible();
  await expect(invitation).toContainText("Driftframe Studios");
  await invitation.getByRole("button", { name: "Explore on my own" }).click();
  await expect(invitation).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Guide", exact: true }),
  ).toBeVisible();
  await expect(invitation).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /^corridor/i }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  await expect(invitation).toBeVisible();
});

test("guide uses C3 scoped history, preserves exploration on close, and leaves writes untouched", async ({
  page,
}) => {
  const writes = [];
  page.on("request", (request) => {
    if (request.url().includes("/workspace/graphql"))
      writes.push(request.url());
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Why was this result revisited?" })
    .click();
  const guide = page.getByRole("region", { name: "Follow a sample guide" });
  await expect(guide).toHaveAttribute("data-step", "history");
  await expect(
    guide.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await expect(page.locator("[data-plate-phase]")).toHaveAttribute(
    "data-plate-phase",
    "locked",
  );
  await expect(
    page
      .getByText("Annotation refresh · ClinVar 2026-08", { exact: true })
      .first(),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await expect(guide).toHaveAttribute("data-step", "resources");
  await expect(
    guide.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await guide.getByRole("button", { name: "Keep exploring" }).click();
  await expect(guide).toHaveCount(0);
  await expect(page.locator("[data-plate-phase]")).toHaveAttribute(
    "data-plate-phase",
    "locked",
  );
  expect(writes).toEqual([]);
});

test("direct navigation pauses playback and a stale reading timer cannot take the view back", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Watch walkthrough" }).click();
  const guide = page.getByRole("region", { name: "Follow a sample guide" });
  await expect(
    guide.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /^Sources/ }).click();
  await expect(
    guide.getByRole("button", { name: "Play", exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(17_000);
  await expect(page.getByPlaceholder("Search sources...")).toBeVisible();
  await expect(guide).toHaveAttribute("data-step", "workflow");
});

test("mobile guide opens files for C3 and keeps its history on desktop resize", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "What data do we need now?" }).click();
  const guide = page.getByRole("region", { name: "Follow a sample guide" });
  await expect(
    guide.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  const record = page.getByRole("article", { name: "Result R2 in well C3" });
  await expect(record).toBeVisible();
  await expect(
    record.getByRole("button", { name: "Files", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1512, height: 982 });
  await expect(page.locator("[data-plate-phase]")).toHaveAttribute(
    "data-plate-phase",
    "locked",
  );
  await expect(
    page
      .getByText("Annotation refresh · ClinVar 2026-08", { exact: true })
      .first(),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Keep exploring" }).click();
});

test("unavailable history keeps its recovery state and stops guided playback", async ({
  page,
}) => {
  await page.route("**/graphql", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: '{"errors":[{"message":"Temporarily unavailable"}]}',
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Why was this result revisited?" })
    .click();
  const guide = page.getByRole("region", { name: "Follow a sample guide" });
  await expect(guide).toContainText(
    "unavailable in the current view or access scope",
  );
  await expect(
    guide.getByRole("button", { name: "Play", exact: true }),
  ).toBeDisabled();
  await guide.getByRole("button", { name: "Close guide" }).click();
  await expect(guide).toHaveCount(0);
});

test("wheel exploration hands back control and prevents an automatic scene change", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.goto("/");
  await page.getByRole("button", { name: "Watch walkthrough" }).click();
  const guide = page.getByRole("region", { name: "Follow a sample guide" });
  await expect(
    guide.getByRole("button", { name: "Pause", exact: true }),
  ).toBeEnabled();
  await page.mouse.move(750, 550);
  await page.mouse.wheel(0, -100);
  await expect(
    guide.getByRole("button", { name: "Show this scene" }),
  ).toBeVisible();
  await page.waitForTimeout(17_000);
  await expect(guide).toHaveAttribute("data-step", "workflow");
  await expect(
    page.getByRole("button", { name: /^corridor/i }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("a late history response after exit cannot take the corridor back", async ({
  page,
}) => {
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  let observed;
  const requested = new Promise((resolve) => {
    observed = resolve;
  });
  await page.route("**/graphql", async (route) => {
    const response = await route.fetch();
    observed();
    await gate;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await page.goto("/");
    await page
      .getByRole("button", { name: "Why was this result revisited?" })
      .click();
    await requested;
    const guide = page.getByRole("region", { name: "Follow a sample guide" });
    await expect(guide).toContainText("Opening the view");
    await guide.getByRole("button", { name: "Close guide" }).click();
    await page.getByRole("button", { name: /^corridor/i }).click();
    release();
    await expect(
      page.getByRole("button", { name: /^corridor/i }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(guide).toHaveCount(0);
    await expect(page.locator("[data-plate-phase]")).toHaveCount(0);
  } finally {
    release();
  }
});

test("blocked preference storage and reduced motion preserve stepwise exploration", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() =>
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new DOMException("Blocked", "SecurityError");
      },
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Explore step by step" }).click();
  const guide = page.getByRole("region", { name: "Follow a sample guide" });
  await expect(guide).toContainText("Drag the corridor");
  await expect(
    guide.getByRole("button", { name: "Play", exact: true }),
  ).toHaveCount(0);
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.locator("[data-plate-phase]")).toHaveAttribute(
    "data-plate-phase",
    "locked",
  );
  await expect(guide).toContainText("Select another disc");
});

test("accepted Source edits survive guided exploration and responsive handoff", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore on my own" }).click();
  await page.getByRole("button", { name: /^Sources/ }).click();
  const source = page.locator('[data-record-id="notion_fragment"]');
  await source.click();
  const details = page.getByLabel("Source details", { exact: true });
  await details
    .getByRole("button", { name: "Edit metadata", exact: true })
    .click();
  const editor = details.getByRole("form", { name: "Edit source metadata" });
  await editor
    .getByLabel("Display title", { exact: true })
    .fill("Reviewed sample intake brief");
  await editor.getByRole("button", { name: "Save metadata" }).click();
  await expect(source).toContainText("Reviewed sample intake brief");
  await page.getByRole("button", { name: "Guide", exact: true }).click();
  await page
    .getByRole("button", { name: "Why was this result revisited?" })
    .click();
  const guide = page.getByRole("region", { name: "Follow a sample guide" });
  await expect(
    guide.getByRole("button", { name: "Play", exact: true }),
  ).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("article", { name: "Result R2 in well C3" }),
  ).toBeVisible();
  await guide.getByRole("button", { name: "Close guide" }).click();
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.getByRole("button", { name: /^Sources/ }).click();
  await expect(source).toHaveAttribute('aria-pressed', 'true');
  await expect(
    details.getByRole("heading", { name: "Reviewed sample intake brief" }),
  ).toBeVisible();
});
