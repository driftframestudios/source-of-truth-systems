import { test, expect } from "@playwright/test";

async function settledSection(player, index) {
  await expect
    .poll(() =>
      player.locator(".presentation-scroll").evaluate((root, expected) => {
        const target = root.querySelector(`[data-section-index="${expected}"]`);
        const top =
          target.getBoundingClientRect().top -
          root.getBoundingClientRect().top +
          root.scrollTop;
        return Math.abs(
          root.scrollTop - Math.min(top, root.scrollHeight - root.clientHeight),
        );
      }, index),
    )
    .toBeLessThan(2);
}

test("formats retain the source section while changing pacing and layout", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: /^Presentations/ }).click();
  await page
    .getByRole("article", { name: "KRAS G12C Defense", exact: true })
    .getByRole("button", { name: "Open brief" })
    .click();
  const player = page.getByRole("region", {
    name: "Presentation: KRAS G12C Defense",
    exact: true,
  });
  const formats = player.getByRole("group", { name: "Presentation format" });
  const progress = player.locator(".presentation-pagination > span");
  await expect(player).toHaveAttribute("data-format", "briefing");
  await expect(player.locator("[data-slide]")).toHaveCount(1);
  await player
    .getByRole("button", { name: "Next section", exact: true })
    .click();
  await expect(progress).toHaveText("2 / 8 · Recommendation");
  await expect(
    player.getByRole("heading", {
      name: "Switch to RMC-6236 trial arm. Hold ICI.",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: ".visual-runs/presentation-briefing.png",
    animations: "disabled",
  });

  await formats.getByRole("button", { name: "Report", exact: true }).click();
  await expect(progress).toHaveText("2 / 8 · Recommendation");
  await expect(player.locator("[data-section-index]")).toHaveCount(8);
  const contents = player.getByRole("navigation", { name: "Report contents" });
  await expect(
    contents.getByRole("button", { name: /02 Recommendation/ }),
  ).toHaveAttribute("aria-current", "location");
  await contents.getByRole("button", { name: /08 Defense questions/ }).click();
  await expect(progress).toHaveText("8 / 8 · Defense questions");
  await expect(
    player.getByText("Have we ruled out small-cell transformation on path?", {
      exact: true,
    }),
  ).toBeInViewport();
  await expect(
    player.getByRole("button", { name: "Next section", exact: true }),
  ).toBeDisabled();
  await settledSection(player, 7);
  await page.screenshot({
    path: ".visual-runs/presentation-report.png",
    animations: "disabled",
  });

  await formats
    .getByRole("button", { name: "Evidence review", exact: true })
    .click();
  await expect(progress).toHaveText("8 / 8 · Defense questions");
  await expect(
    player.getByRole("heading", { name: "Ask the board.", exact: true }),
  ).toBeInViewport();
  const chapters = player.getByRole("navigation", {
    name: "Presentation chapters",
  });
  await chapters
    .getByRole("button", { name: "05 Trial fit", exact: true })
    .click();
  await expect(progress).toHaveText("5 / 8 · Trial fit");
  await expect(
    player.getByRole("heading", { name: "NCT05379985 · arm B", exact: true }),
  ).toBeInViewport();
  await settledSection(player, 4);
  await page.screenshot({
    path: ".visual-runs/presentation-evidence.png",
    animations: "disabled",
  });
  await formats.getByRole("button", { name: "Briefing", exact: true }).click();
  await expect(progress).toHaveText("5 / 8 · Trial fit");
  await expect(player.locator(".presentation-metrics")).toContainText("7.6 mo");

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await player
    .getByRole("button", { name: "Next section", exact: true })
    .click();
  await expect(progress).toHaveText("6 / 8 · Hazard rollup");
  expect(
    await player
      .locator(".presentation-briefing-page")
      .evaluate((node) => node.getAnimations().length),
  ).toBe(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".visual-runs/presentation-briefing-compact.png",
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(
    page
      .getByRole("group", { name: "Presentation styles" })
      .getByRole("button", { name: /^Deck styles/ }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("a light deck keeps long source content reachable in compact and high-contrast formats", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/");
  await page.getByRole("button", { name: /^Presentations/ }).click();
  await page
    .getByRole("article", { name: "AAV CMC Defensibility", exact: true })
    .getByRole("button", { name: "Open brief" })
    .click();
  const player = page.getByRole("region", {
    name: "Presentation: AAV CMC Defensibility",
    exact: true,
  });
  const formats = player.getByRole("group", { name: "Presentation format" });
  await expect(player.locator(".presentation-document")).toHaveCSS(
    "background-image",
    "linear-gradient(rgb(244, 241, 230) 0%, rgb(236, 232, 216) 100%)",
  );
  await formats
    .getByRole("button", { name: "Evidence review", exact: true })
    .click();
  await settledSection(player, 0);
  await page.screenshot({
    path: ".visual-runs/presentation-evidence-compact.png",
    animations: "disabled",
  });
  expect(
    await player
      .locator(".presentation-scroll")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);

  await formats.getByRole("button", { name: "Report", exact: true }).click();
  const sections = player.locator("[data-section-index]");
  await expect(sections).toHaveCount(7);
  const contents = player.getByRole("navigation", { name: "Report contents" });
  await contents.getByRole("button").last().click();
  await settledSection(player, 6);
  await expect(
    player.getByRole("button", { name: "Next section", exact: true }),
  ).toBeDisabled();
  await expect(sections.last().getByRole("listitem").last()).toBeInViewport();
  await page
    .getByRole("group", { name: "Appearance", exact: true })
    .getByRole("radio", { name: "High contrast", exact: true })
    .check();
  await expect(player.locator(".presentation-document")).toHaveCSS(
    "background-color",
    "rgb(0, 0, 0)",
  );
  await expect(sections.last().getByRole("heading")).toHaveCSS(
    "color",
    "rgb(255, 255, 255)",
  );
  await page.screenshot({
    path: ".visual-runs/presentation-report-contrast.png",
    animations: "disabled",
  });
  await formats.getByRole("button", { name: "Briefing", exact: true }).click();
  await expect(player.locator("[data-slide]")).toHaveCount(1);
  await expect(
    player.locator(".presentation-questions li").last(),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to library", exact: true })
    .click();
  await page
    .getByRole("article", { name: "KRAS G12C Defense", exact: true })
    .getByRole("button", { name: "Open brief" })
    .click();
  await expect(page.locator(".presentation-player")).toHaveAttribute(
    "data-format",
    "briefing",
  );
});

test("long Evidence covers reserve space for the angled stamp at compact laptop width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: /^Presentations/ }).click();
  await page
    .getByRole("article", { name: "Accelerated Approval Defense", exact: true })
    .getByRole("button", { name: "Open brief" })
    .click();
  const player = page.getByRole("region", {
    name: "Presentation: Accelerated Approval Defense",
    exact: true,
  });
  await player
    .getByRole("group", { name: "Presentation format" })
    .getByRole("button", { name: "Evidence review", exact: true })
    .click();
  const cover = player.locator(".presentation-slide--title");
  const title = cover.locator(".presentation-cover-title");
  const titleBox = await title.boundingBox();
  const stampBox = await cover
    .locator(".presentation-cover-stamp")
    .boundingBox();
  expect(titleBox.y).toBeGreaterThan(stampBox.y + stampBox.height);
  expect(
    await title.evaluate((node) => {
      const range = document.createRange();
      range.setStart(node.firstChild, 0);
      range.setEnd(node.firstChild, "Accelerated".length);
      return range.getClientRects().length;
    }),
  ).toBe(1);
  expect(
    await player
      .locator(".presentation-scroll")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.screenshot({
    path: ".visual-runs/presentation-long-cover-compact.png",
    animations: "disabled",
  });
});
