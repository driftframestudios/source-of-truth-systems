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
const { createNotificationState, reduceNotifications } = await import(
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
    assert.equal(next.notifications.at(-1).id, `later-${notification.id}`);
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
