import { test, expect } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function expectPaintedWithinViewport(page, locator) {
  await expect(locator).toBeVisible();
  await locator.scrollIntoViewIfNeeded();
  const measured = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(
      rect.x + rect.width / 2,
      rect.y + rect.height / 2,
    );
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      bottom: rect.bottom,
      viewport: innerHeight,
      painted: !!hit && (element.contains(hit) || hit.contains(element)),
    };
  });
  expect(measured.width).toBeGreaterThan(0);
  expect(measured.height).toBeGreaterThan(0);
  expect(measured.top).toBeGreaterThanOrEqual(0);
  expect(measured.bottom).toBeLessThanOrEqual(measured.viewport);
  expect(measured.painted).toBe(true);
}

test("mobile Corridor gives controls their own room and paints deferred companions in both orientations", async ({
  page,
}) => {
  let releaseDetails;
  const heldDetails = new Promise((resolve) => {
    releaseDetails = resolve;
  });
  await page.route("**/assets/MobileCorridorDetails-*.js", async (route) => {
    await heldDetails;
    await route.continue();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Orbit", exact: true }).click();
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 360, height: 640 },
  ]) {
    await page.setViewportSize(viewport);
    const boxes = await page
      .locator(
        ".mobile-corridor-canvas,.mobile-corridor-camera,.mobile-corridor-orbit-steps,.mobile-corridor-steps",
      )
      .evaluateAll((elements) =>
        elements.map((element) => {
          const rect = element.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, width: rect.width };
        }),
      );
    expect(boxes[0].bottom).toBeLessThanOrEqual(boxes[1].top);
    expect(boxes[1].bottom).toBeLessThanOrEqual(boxes[2].top);
    expect(boxes[2].bottom).toBeLessThanOrEqual(boxes[3].top);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(viewport.width);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const firstRecord = page.getByRole("button", {
    name: /Process.*Sample Intake/,
  });
  await firstRecord.focus();
  await firstRecord.press("Enter");
  const dialog = page.locator("dialog[open]");
  try {
    await expectPaintedWithinViewport(page, dialog.getByRole("status"));
    await expect(dialog).toContainText("Opening workflow record");
  } finally {
    releaseDetails();
  }
  await expect(
    dialog.getByRole("heading", { name: "Sample Intake", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".deferred-reveal")).toHaveCount(0);
  await expectPaintedWithinViewport(
    page,
    dialog.getByRole("heading", { name: "Sample Intake", exact: true }),
  );
  await dialog.getByRole("button", { name: "Close step details" }).click();
  await expect(firstRecord).toBeFocused();

  for (const viewport of [
    { width: 390, height: 844 },
    { width: 844, height: 390 },
  ]) {
    await page.setViewportSize(viewport);
    const laneDetails = page.getByRole("button", {
      name: "Lane details",
      exact: true,
    });
    await laneDetails.focus();
    await laneDetails.press("Enter");
    await expectPaintedWithinViewport(
      page,
      dialog.getByRole("heading", { name: "Accession + Plate", exact: true }),
    );
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Lane details", exact: true }),
    ).toBeFocused();
    await firstRecord.click();
    await expectPaintedWithinViewport(
      page,
      dialog.getByRole("heading", { name: "Sample Intake", exact: true }),
    );
    await dialog.getByRole("button", { name: "Close step details" }).click();
    await page.getByRole("button", { name: "Explore", exact: true }).click();
    await expect(dialog.locator(".deferred-reveal")).toHaveCount(0);
    await expectPaintedWithinViewport(
      page,
      dialog.getByRole("heading", { name: "Explore the corridor" }),
    );
    await expectPaintedWithinViewport(
      page,
      dialog.getByRole("button", { name: "Show corridor", exact: true }),
    );
    await dialog
      .getByRole("button", { name: "Show corridor", exact: true })
      .click();
  }
});

test("Overview reaches readable close inspection and returns to the original single-lane framing", async ({
  page,
}) => {
  await page.goto("/");
  const canvas = page.locator(".mobile-corridor-canvas");
  const scene = canvas.locator(":scope > div").nth(1).locator(":scope > div");
  const original = await scene.getAttribute("style");
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.waitForTimeout(1000); // The existing Reset spring settles before direct zoom starts.
  const fitted = await scene.getAttribute("style");
  const scale = (style) => Number(style.match(/\bscale\(([^)]+)\)/)[1]);
  const zoomIn = page.getByRole("button", { name: "Zoom into corridor" });
  for (let step = 0; step < 30 && (await zoomIn.isEnabled()); step += 1)
    await zoomIn.click();
  await expect(zoomIn).toBeDisabled();
  expect(scale(await scene.getAttribute("style")) / scale(fitted)).toBeCloseTo(
    6,
    2,
  );
  const beforePan = await scene.getAttribute("style");
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x: box.x + 180, y: box.y + 150 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [{ x: box.x + 230, y: box.y + 180 }],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect.poll(() => scene.getAttribute("style")).not.toBe(beforePan);
  // Close inspection must still reach beyond one screen's worth of the overview.
  await canvas.focus();
  for (let step = 0; step < 25; step += 1)
    await page.keyboard.press("ArrowRight");
  const moved = await scene.getAttribute("style");
  expect(Number(moved.match(/translate\(([-.\d]+)px/)[1])).toBeGreaterThan(
    box.width,
  );

  await page.getByRole("button", { name: "Zoom out of corridor" }).click();
  await canvas.hover();
  await page.mouse.wheel(0, -3000);
  await expect(zoomIn).toBeDisabled();
  expect(scale(await scene.getAttribute("style")) / scale(fitted)).toBeCloseTo(
    6,
    2,
  );
  await page.getByRole("button", { name: "Zoom out of corridor" }).click();
  await canvas.scrollIntoViewIfNeeded();
  const pinchBox = await canvas.boundingBox();
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [
      { x: pinchBox.x + 150, y: pinchBox.y + 150 },
      { x: pinchBox.x + 240, y: pinchBox.y + 150 },
    ],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchMove",
    touchPoints: [
      { x: pinchBox.x + 100, y: pinchBox.y + 150 },
      { x: pinchBox.x + 290, y: pinchBox.y + 150 },
    ],
  });
  await touch.send("Input.dispatchTouchEvent", {
    type: "touchEnd",
    touchPoints: [],
  });
  await expect(zoomIn).toBeDisabled();
  expect(scale(await scene.getAttribute("style")) / scale(fitted)).toBeCloseTo(
    6,
    2,
  );
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await expect
    .poll(() => scene.getAttribute("style"), { timeout: 4000 })
    .toBe(original);
  await expect(zoomIn).toBeEnabled();

  // Explore's scope control retains the pose while respecting the receiving lane's bounds.
  await page.getByRole("button", { name: "Overview", exact: true }).click();
  await page.waitForTimeout(1000);
  await canvas.focus();
  for (let step = 0; step < 30; step += 1) await page.keyboard.press("+");
  for (let step = 0; step < 25; step += 1)
    await page.keyboard.press("ArrowRight");
  await page.getByRole("button", { name: "Explore", exact: true }).click();
  await page.getByRole("button", { name: "One lane", exact: true }).click();
  await page
    .getByRole("button", { name: "Show corridor", exact: true })
    .click();
  const lanePose = await scene.getAttribute("style");
  expect(
    Number(lanePose.match(/translate\(([-.\d]+)px/)[1]),
  ).toBeLessThanOrEqual(box.width);
  expect(scale(lanePose) / scale(original)).toBeCloseTo(2.5, 2);
  await expect(zoomIn).toBeDisabled();
});
