import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
const { outputText } = ts.transpileModule(
  await readFile(
    new URL("../src/app/services/notificationState.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  },
);
const {
  createNotificationState,
  reduceNotifications,
  nextNotificationDeadline,
  notificationDisplay,
  NOTIFICATION_LIMITS,
} = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const notice = (id, fields = {}) => ({
  id,
  kind: "toast",
  severity: "info",
  title: "Notice",
  message: "Local feedback",
  persistent: false,
  createdAt: 0,
  ...fields,
});
const push = (state, notification) =>
  reduceNotifications(state, { type: "push", notification });

test("quiet information filters current and future optional toasts while preserving every attention-bearing notice", () => {
  let state = push(createNotificationState(), notice("optional"));
  const attention = [
    notice("warning", { severity: "warning" }),
    notice("error", { severity: "error" }),
    notice("critical", { severity: "critical" }),
    notice("banner", { kind: "banner" }),
    notice("persistent", { persistent: true }),
    notice("refusal", { errorRef: "permission-refusal" }),
  ];
  for (const notification of attention) state = push(state, notification);
  state = reduceNotifications(state, {
    type: "informational-toasts",
    enabled: false,
  });
  assert.deepEqual(
    state.notifications.map((item) => item.id),
    attention.map((item) => item.id),
  );
  assert.equal(push(state, notice("later-optional")), state);
  for (const notification of attention) {
    const next = push(state, {
      ...notification,
      id: `later-${notification.id}`,
    });
    assert.equal(
      next.notifications.find((item) => item.id === notification.id)
        .occurrences,
      2,
    );
  }
});

test("dismiss and clear preserve preferences; reset admits new information without replaying suppressed notices", () => {
  let state = createNotificationState();
  assert.equal(state.preferences.informationalToasts, true);
  state = reduceNotifications(state, {
    type: "informational-toasts",
    enabled: false,
  });
  const quiet = state;
  assert.equal(
    reduceNotifications(state, {
      type: "informational-toasts",
      enabled: "false",
    }),
    quiet,
  );
  state = push(state, notice("skipped"));
  state = push(state, notice("required", { severity: "error" }));
  state = reduceNotifications(state, { type: "dismiss", id: "required" });
  state = reduceNotifications(state, { type: "clear" });
  assert.equal(state.preferences.informationalToasts, false);
  state = reduceNotifications(state, { type: "reset-preferences" });
  assert.equal(state.preferences.informationalToasts, true);
  assert.deepEqual(state.notifications, []);
  state = push(state, notice("fresh"));
  assert.deepEqual(
    state.notifications.map((item) => item.id),
    ["fresh"],
  );
});

test("deadlines survive neighboring messages, preference changes and grouping within the active window", () => {
  let state = push(
    createNotificationState(),
    notice("a", { createdAt: 1000, severity: "warning" }),
  );
  state = push(state, notice("b", { createdAt: 5000, title: "B" }));
  assert.equal(nextNotificationDeadline(state.notifications), 6000);
  state = push(
    state,
    notice("a-repeat", { createdAt: 5500, severity: "warning" }),
  );
  assert.equal(state.notifications[0].occurrences, 2);
  assert.equal(nextNotificationDeadline(state.notifications), 6000);
  state = reduceNotifications(state, { type: "dismiss", id: "b" });
  state = reduceNotifications(state, {
    type: "informational-toasts",
    enabled: false,
  });
  assert.equal(nextNotificationDeadline(state.notifications), 6000);
  state = reduceNotifications(state, { type: "expire", now: 6000 });
  assert.equal(state.notifications[0].active, false);
  assert.equal(nextNotificationDeadline(state.notifications), null);
  state = push(
    state,
    notice("new-attempt", { createdAt: 7000, severity: "warning" }),
  );
  assert.deepEqual(
    notificationDisplay(state.notifications).toasts.map((n) => n.id),
    ["new-attempt"],
  );
  assert.equal(nextNotificationDeadline(state.notifications), 12000);
});

test("expiry settles hidden toasts, retains required feedback, and preserves persistent banners", () => {
  let state = createNotificationState();
  for (let i = 0; i < 6; i++)
    state = push(
      state,
      notice(`notice-${i}`, {
        title: `Notice ${i}`,
        severity: i === 0 ? "info" : "warning",
      }),
    );
  state = push(state, notice("banner", { kind: "banner", persistent: true }));
  assert.equal(notificationDisplay(state.notifications).toasts.length, 3);
  state = reduceNotifications(state, { type: "expire", now: 9000 });
  assert.equal(notificationDisplay(state.notifications).toasts.length, 0);
  assert.equal(state.notifications.length, 6);
  assert.deepEqual(
    notificationDisplay(state.notifications).banners.map((n) => n.id),
    ["banner"],
  );
  assert.equal(
    state.notifications.find((n) => n.id === "notice-1").active,
    false,
  );
});

test("bounded capacity gives required feedback priority and explicitly counts omitted detail", () => {
  let state = createNotificationState();
  for (let i = 0; i < 50; i++)
    state = push(
      state,
      notice(`required-${i}`, { title: `Required ${i}`, persistent: true }),
    );
  const old = state.notifications;
  state = push(state, notice("optional"));
  assert.equal(state.notifications, old);
  assert.equal(state.omitted, 1);
  state = push(state, notice("important", { severity: "critical" }));
  assert.equal(state.notifications.length, 50);
  assert.equal(state.notifications[0].id, "required-1");
  assert.equal(state.notifications.at(-1).id, "important");
  assert.equal(state.omitted, 2);
  state = reduceNotifications(state, { type: "clear" });
  assert.equal(state.omitted, 0);
  state = push(state, notice("optional-first"));
  for (let i = 0; i < 50; i++)
    state = push(
      state,
      notice(`needed-${i}`, { title: `Needed ${i}`, persistent: true }),
    );
  assert.equal(
    state.notifications.some((n) => n.id === "optional-first"),
    false,
  );
  assert.equal(state.notifications[0].id, "needed-0");
  for (let i = 50; i < 1000; i++)
    state = push(
      state,
      notice(`needed-${i}`, { title: `Needed ${i}`, persistent: true }),
    );
  assert.equal(state.notifications.length, NOTIFICATION_LIMITS.retained);
  assert.equal(state.omitted, 951);
  assert.equal(notificationDisplay(state.notifications).toasts.length, 3);
});

test("correlation references distinguish equal-looking messages and optional notices settle completely", () => {
  let state = push(
    createNotificationState(),
    notice("one", { errorRef: "one" }),
  );
  state = push(state, notice("two", { errorRef: "two" }));
  assert.equal(state.notifications.length, 2);
  state = push(state, notice("optional"));
  state = reduceNotifications(state, { type: "expire", now: 5000 });
  assert.deepEqual(
    state.notifications.map((n) => n.id),
    ["one", "two"],
  );
  assert.ok(state.notifications.every((n) => !n.active));
  assert.equal(
    reduceNotifications(state, { type: "expire", now: 10000 }),
    state,
  );
});
