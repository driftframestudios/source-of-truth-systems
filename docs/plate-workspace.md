# Plate workspace at compact desktop widths

The Plate scene retains room for the selected sample and its result record at 1024px. Its scene-preserving layout sits alongside the other [bounded record workspaces](workspace-layout.md).

## Composition and ownership

`LanesView.tsx` holds the local disclosure selection; `PlateWorkspace.tsx` renders the two reading rails and owns their entry/return focus. At desktop widths from 1024 through 1359px, **Sample histories** and **Sample details** remain visible above the scene. Each opens its existing rail over the scene and focuses its close button for immediate keyboard entry; opening one closes the other. Choosing a story returns focus to its trigger and reveals the selected result. A rail's close button or Escape closes that rail and restores trigger focus. Escape elsewhere retains the Plate's existing release behavior.

From 1360px, both rails sit beside the scene as before. Below 1024px, the existing mobile Plate composition takes over. The compact disclosure does not change the scene's dimensions or refit its camera when it opens. Its scrollable contents stay mounted while closed. Visual order and DOM order remain histories, scene, sample details.

This arrangement keeps the three-column result tray instead of introducing a second desktop record renderer. Persistent compact rails left too little room for those columns; a separate modal would interrupt the sample/result relationship. Local overlays leave the current well, result, pin state, request/source feedback and retry path owned by the existing exploration and history services. The toolbar identifies the selected well even when its details are closed. The result header can wrap its metadata while its close and pin controls remain inside the tray.

`plate.css` owns the desktop rail geometry and uses existing shell tokens. The Plate camera, scene motion, lenses, history spacing, depth, result commands and mobile layouts retain their existing owners. The empty sample rail now invites selecting a well instead of displaying the Corridor drafting key.

## Receiving evidence

`tests/browser/plate-workspace.spec.mjs` checks the 1024px scene width, rail exclusivity, visible selection and source state, keyboard close/return, unchanged scene width during disclosure, one read for the selected history, the bounded record close control, and retained R2 selection across 1512px and the 1023px mobile boundary. Existing Plate layout and history-feedback checks cover spacing/depth, pinned selection, loading feedback, late-response isolation and cached reads. Settled before/after captures cover 1024×768 and 1512×982, with a mobile-boundary capture at 1023×768.

These observations establish the Plate layout and its retained operations. They leave the other workspace families and live hosted-database behavior to their own receiving checks.

## Scoped read retention and projection

The app-owned history cache retains the current permission scope and three recently used scopes. Reading a recent scope refreshes its retention position. Eviction clears its histories, blocked entries and derived projection; the retired partition rejects late responses even if the visitor later returns to the same scope key. A new partition then uses the ordinary selected-history read. Accepted edits and exploration remain under their separate browser-session owners.

Each partition publishes a stable numeric revision through `useSyncExternalStore`; mounted graphic and companion consumers receive the same accepted revision. The projection caches one immutable result for its scope, plate, well templates, example stacks, ownership and cache revision. Snapshot copies keep an earlier projection's metadata and results coherent. This follows [React's external-store snapshot contract](https://18.react.dev/reference/react/useSyncExternalStore). Scope keys retain their full authorization meaning.

A fresh projection reuses each template well in one coordinate pass; standalone command lookup uses a weak-key index of the immutable template array. At 96 wells, the focused probe reads row coordinates 384 times including policy/field projection, and reusing the same snapshot adds zero reads. This measures bounded source work rather than device frame rate. Result and permission-policy traversal retain their separate costs.

Retention and freshness remain separate: accepted histories survive recent-scope returns and desktop/mobile remounts; explicit Retry refreshes the selected history and ordinary reload starts a fresh app cache. Denied, missing and authoritatively unavailable histories retain their established disclosure/fallback rules. Focused tests cover eviction, delayed receipts, subscriber agreement and coordinate work; the existing history, scope and responsive Plate journeys own the visible interaction checks.

## Local recovery completion and replay

The existing file and query actions now lead to a complete browser-session
example. **Complete example** settles a requested restore or query recovery
immediately; **Replay** returns that task to its original fixture posture so the
visitor can choose a tier or request recovery again. The small control rail sits
beside the affected file or query and uses the existing shell tokens in both
result layouts. Real-world ETAs remain contextual. These controls change local
state; hosted files and query services retain their own operational adapters.

`plateCommands.ts` resolves the current result, ownership, consent and permission
for every completion and replay. `plateOverlayState.ts` assigns a monotonically
increasing generation to each accepted task; completion and replay name that
exact generation. Stale actions leave the new task intact. File tasks retain
physical-key identity, so completion/replay updates every permitted alias while
each result's consent remains authoritative. Query completion affects only its
result. Other accepted tasks stay in place.

The immutable scientific snapshot still owns lifecycle age. Explicit completion
uses that same injected snapshot time for a seven-day restored-copy window; it
requires neither wall-clock waiting nor animation. Partition repair retains its
existing short local deadline, now guarded by task generation. The retained
browser-session resource survives navigation and responsive remounts. A reload
starts a fresh local example. Current read scope still controls projections and
current permissions guard new actions; local completion grants no additional
access.

Focused reducer/command cases exercise shared files, queryability, replay,
obsolete generations, consent and changed permissions. The recovery browser
journey exercises direct completion, replay and retained state across desktop
and mobile with reduced motion. Hosted execution remains a separate boundary.
