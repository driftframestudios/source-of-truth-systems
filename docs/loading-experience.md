# Loading and ready content

Loading uses a small horizontal plate with twelve sample discs. The discs rise and settle with staggered, gentle timing; the status names the work being awaited. Initial startup reads **Initializing system…**. A deferred module reads **Opening plate…**, **Opening linked record…**, or its existing receiving label.

## Workspace download contract

The composition borrows the existing plate edge, navy ground, teal, blue, violet and gold from semantic theme roles. It is an HTML/CSS drawing and does not load the Plate renderer, data or an animation dependency. The twelve-disc grid, rounded plate, shallow edge and fixed light direction remain consistent in the HTML and React carriers. A full startup occupies the viewport; subsequent loads stay inside their receiving workspace, with navigation available outside it.

When the actual view mounts, the plate rotates from its horizontal perspective toward the visitor. A sparse field of translucent rectangular tiles rises and recedes using the system colors. The ready reveal lasts at most 900ms; its controls are already available because the decorative overlay has no pointer capture. A fallback cleanup removes interrupted exits. There is no minimum loading duration or estimated progress. Already available deferred views skip the local loading reveal.

Reduced motion keeps the plate still and reveals ready content directly. Hidden receiving panels pause the local graphic. Failed downloads retain an explicit reload path; startup failure uses the HTML carrier before React is available. The visual describes application loading, not sample processing or a scientific result.

## Primary record companion

Sample history reserves its record tray as soon as the mode is selected, while the camera springs into place. Available record content unfurls over 240ms in parallel with the gossamer thread. Selection replaces the prior record directly; camera completion, prior-record exit and child staggering no longer gate readable content. Reduced motion reveals the record directly. The tray geometry, three scrolling columns and semantic palettes remain intact.

The tray shell owns one stable source strip above its replaceable content. Mobile uses the equivalent strip beside its record. When a selected well's GraphQL request is pending, six muted theme-colored rectangles gently change opacity. The label identifies the well and says that example history remains in view while its source is checked. The rectangles dissolve over 160ms on settlement; they never hold the content or fabricate completion percentage. The record body carries its own busy state, with the status announcement outside that subtree. Reduced motion keeps the rectangles still.

The request owner supplies `idle`, `loading`, `ready` or `unavailable`. An unread local hover is idle; a cached selection or hover is ready on its first render with its retained source. If C3 is being checked while B4 is previewed, B4 retains its own example or cached-source identity and receives no C3 loading cue. Successful empty and missing histories retain their source outcome. Failure shows the existing local Retry. The previous request is cancelled when selection changes, and its late response cannot replace the current key.

This supersedes the thread-first, sequential record reveal. Existing examples supply useful content throughout the current history check, so this implementation uses the small inline indicator. A panel-shaped geometric skeleton remains an extension for a future primary panel that truly lacks usable content. [The loading research](research/component-loading.md) compares that option with spinners and progress bars and maps the application's other asynchronous owners. Domain states such as restore requested or rebuild queued keep their own meaning.

## Ownership and extension

- `index.html` owns first-paint markup and entry-download recovery. Keep its small grid aligned with `PlateLoading.tsx`.
- `components/loading/plate-loading.css` owns both carriers’ geometry, palette roles and finite motion.
- `components/loading/initialLoad.ts` removes the startup carrier when the receiving workspace commits.
- `components/DeferredView.tsx` retains Suspense and error recovery, and adds local waiting/ready composition. It preserves its child workspace across the reveal.
- `services/plateHistory/context.tsx` owns keyed request/cache readiness; the request helper owns abort and stale-response protection.
- `plate/PlateHistorySource.tsx` and `plate-history.css` project source, recovery and local activity from props, without fetching or inventing progress.
- `PlateScene3D`, `ResultTray` and `MobilePlate` place that projection beside the current primary record. Rendering and decorative motion retain separate lifetimes from requests.

[Guided exploration](research/guided-exploration.md) now presents its optional invitation after application loading and offers header replay. The guide owns its scene sequence and cancellation; loading graphics only communicate waiting and readiness.

## Evidence

The loading browser journeys hold entry/module downloads to observe waiting and cleanup, navigate away during deferred Plate loading, exercise reduced motion, and recover an entry failure. Primary-history journeys observe the tray during camera motion, local hover with zero reads, held and reversed history responses, exact well identity, cached return, retry, and mobile reduced motion. Existing download-recovery and startup-manifest checks retain mobile deferral and payload boundaries. Focused visual review covers primary-panel geometry; real network speed determines whether a visitor sees a waiting frame.
