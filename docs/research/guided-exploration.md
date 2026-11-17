# Guided exploration: follow a sample

A visitor can watch the existing Corridor and Plate scenes explain one sample, take over at any point, and return to the walkthrough from the header. The research was assessed against the application at `682a33f`. It records the implementation contract; receiving checks establish delivery.

## Decision and alternatives

Combine a small first-arrival invitation with a three-scene demonstration in the working interface. **Watch walkthrough** advances after the receiving scene has settled and a short reading interval. Selecting a question leaves advancement with the visitor; reduced-motion mode offers **Explore step by step**. Both offer the same subjects, visible progress, Back/Next, and a direct way to take control or dismiss. Header replay remains available. The invitation sits outside the navigation hierarchy and appears after application loading.

| Option | Useful contribution | Fit for this pass |
| --- | --- | --- |
| Opening explanation or question cards | Makes the purpose recognizable quickly | Keep one short introduction and an immediate exploration choice |
| Continuous automatic tour | Shows the existing camera, history and record animations | Start only after an explicit Watch action; divide it into observable scenes |
| Contextual guided sample | Connects instructions with the exact record and controls | Use as the main composition; hands-on exploration remains available throughout |
| Task checklist | Makes a long learning sequence recoverable | Three scenes and header replay provide enough structure here |
| Conversational guide | Could answer individual questions | Remains with the separately scoped AI work |

The goal is orientation and an engaging first encounter. Learning gains and completion rates remain questions for visitor observation, rather than claims implied by the animation.

**Developer docs** opens the independent `/docs/` reading view in a separate tab.
The desktop sidebar, Guide invitation and mobile information dialog share the
same labelled link. In Guide and mobile information, it sits directly above the
copyright credit. The current scene, Guide position and unsaved editors remain
mounted in the application tab. The independent foundation/repository invitation
joins this location after its publication destination has been verified; the
working local documentation link remains available during that handoff.

## Evidence that changes the design

| Evidence and class | Consequence for this implementation | Transfer boundary |
| --- | --- | --- |
| Carroll and Rosson describe task-oriented exploration and the tension between accomplishing work and investing in instruction. [Original chapter, 1987](https://research.cs.vt.edu/ns/cs5724papers/4.mental.mental.carroll.paradox.pdf) | Teach through the actual scene and offer immediate control; keep instruction close to the action it explains. | Early office-software observations inform a design hypothesis for this scientific showcase, rather than a universal account of every visitor. |
| Pirolli and Card model the value of information against the effort of finding and processing it. [Original ACM paper, 1995](https://chi1995.acm.org/proceedings/papers/ppp_bdy.htm) | Name the question each scene helps answer: workflow, reason for reanalysis, available files. Preserve the selected sample as visitors move between these views. | Information-foraging theory supplies a useful navigation lens; it does not prescribe this exact three-scene interface. |
| Apple recommends brief, optional, interactive onboarding, contextual guidance, and an easy way to revisit a skipped tutorial. [Current Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/onboarding) | Offer Watch and stepwise routes after loading; preserve dismissal and header replay; show guidance beside its receiving scene. | Platform guidance informs interaction choices, not a measured outcome for this application. |
| NN/G describes tutorials that interrupt a current task and require remembering instructions away from their controls. [Original practitioner observations](https://www.nngroup.com/articles/onboarding-tutorials/) | Returning browsers enter their requested view directly. Replay stays voluntary, and the guide leaves the working scene available. | These observations challenge forced onboarding; they do not establish that every optional showcase tour is ineffective. |
| A registered conceptual replication with kidney-function material found no significant cognitive-load, retention or transfer benefit from segmentation. [Soicher and Becker-Blease, 2020](https://onlinelibrary.wiley.com/doi/abs/10.1111/jcal.12485) | Use pauses and short scenes for visitor control, interruption recovery and readable pacing. Keep comprehension claims modest. | This health-education study bounds transfer from multimedia-learning findings; it does not test this interface. |

## The three receiving scenes

1. **Follow the work.** Show the real Corridor and its existing spring transition into an informative view. Explain that the lanes connect processing steps and their supporting records. The visitor can orbit or move the scene directly.
2. **Understand a repeated analysis.** Open C3 in Sample history and select its R2 annotation refresh. The bundled C3 example distinguishes reanalysis of existing reads from a new physical run: R2 updates annotation, while R3 represents a separate orthogonal confirmation in progress. Caption the currently returned record and keep its source status visible.
3. **See what data is ready.** Stay with the selected result and reveal Files and lifecycle information. This connects reused files, availability and restoration windows with resource choices. The visitor can continue exploring the existing controls. Exact cost estimates, patient lookup and actions that are not supplied by the current record remain outside the guide's claims.

The guide changes navigation, selection and presentation only. Restore, rebuild, metadata saves, grants and other accepted commands remain explicit visitor actions through their existing owners. Completion hands back the current scene; it preserves accepted work and the selected sample.

## Source ownership and receiving APIs

| Existing owner | Integration contract |
| --- | --- |
| `services/exploration/ExplorationProvider.tsx` | Share scene intent, selected well, result focus and Plate options above responsive workspaces. A guide request selects Plate, then C3 and the intended available result. The first compact Plate selection otherwise supplies its own B4 default. |
| `DesktopWorkspace.tsx` | `Shell` currently owns the active section and exact-record return context. A typed guide receiver selects Lanes while retaining the ordinary navigation path. Header replay enters the same guide owner. |
| `components/views/LanesView.tsx` | Receive the guide's Corridor preset and Plate selection intent through owned callbacks. `presetMotion`, selected Corridor card/lane and compact Plate rail are local presentation state. |
| `components/mobile/MobileCorridor.tsx` | Receive equivalent scene intent through its local camera, lane and view owners. Its camera differs from the shared desktop control; assigning the desktop camera alone cannot animate the compact scene. |
| `components/corridor/useCorridorPresetMotion.ts` | Reuse the cancellable spring and nearest-yaw projection. A narrow completion signal can acknowledge the current guide request after the movement settles. Direct input cancels the requested movement. |
| `components/plate/PlateScene3D.tsx`, `sceneTransition.ts` | Setting `plateUi.upright` already runs the wind-up, spring entrance and extrusion. Expose readiness through a typed callback at the settled phase. Existing DOM data attributes remain browser-observation hooks. |
| `services/plateHistory/context.tsx` | The current well, policy scope and request phase decide which history can be shown. Loading holds progression. A terminal unavailable, denied or missing result keeps its recovery state visible and hands control back; the guide preserves the current permissions. |
| `components/plate/ResultTray.tsx` | Desktop already presents Why, Files and lifecycle columns together. Compact records own a local Why/Files/Lifecycle/Sample selection; a bounded section request can reveal Files without a simulated click. |
| `components/mobile/MobilePlate.tsx` | Continue using shared well/result selection and its actual compact record. Bring the receiving record into view through component-owned refs after it is ready. |
| `services/recordNavigation.ts` | Use canonical record targets if a later branch opens a supporting source. Result files stay with their actual Plate record; the guide does not invent an association with the separate Artifact gallery. |

The guide needs a small typed state owner and a finite scene/request union. Existing React and Motion capabilities cover this route. Scene receivers report the current request's readiness and receive cancellation; a tour dependency or a second scene renderer would add ownership without improving this bounded journey.

## State, pacing and recovery

Keep guide progress separate from accepted records, permission scenarios, appearance and hosted Source workspaces. A request generation identifies each explicit scene choice. A separate interruption marker cancels pending guide-owned selection after Pause or direct input; responsive receivers share the current request. Exit removes that request from active receivers. Each receiver cleans up its timer or animation when superseded. These choices apply React's effect cleanup and state-ownership guidance to the real timing boundary. [React effects](https://react.dev/learn/synchronizing-with-effects), [state structure](https://react.dev/learn/choosing-the-state-structure).

Watch mode starts its reading interval after the scene's readiness acknowledgement. A timer alone cannot establish that the selected history arrived or the camera settled. Direct pointer, wheel or keyboard interaction, window blur, a hidden document and reduced-motion preference pause automatic progression. Stepwise controls retain access to the same content. A denied or unavailable source exposes its existing outcome and recovery controls instead of advancing as though the expected record had loaded. Pause, resume and dismissal remain visible near the guide; motion control follows the same intent as the [W3C pause/stop/hide guidance](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html), while explicit-start playback has its own activation condition.

First-arrival recognition uses one versioned, allowlisted browser preference. Record the visit once the guide owner mounts; retain the initial render decision in memory so persisting that flag does not instantly remove the invitation. Returning browsers open Lanes/Corridor unless a [shared application address](../shareable-navigation.md) selects another view. Browser Back/Forward closes the guide before applying that bounded view choice. The flag records presentation preference, not identity, authentication or participation in a clinical workflow. Read/write failures fall back to an in-memory choice for the current application lifetime. Browser-local storage may be cleared or unavailable, and differs by origin; a different browser or deployment origin can therefore receive the invitation again. [MDN localStorage contract](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage).

## Proportionate receiving evidence

Observe first-arrival invitation, dismissal and replay; the actual Corridor transition; C3's selected returned history and Files handoff; and the visitor's ability to take control. Exercise one delayed history response followed by Exit or a newer selection to establish that stale readiness cannot resume playback. Preserve an accepted edit while navigating through the guide and crossing a compact/desktop boundary. Check reduced motion, denied/unavailable history and blocked local storage as distinct receiving conditions. A settled desktop and phone capture should show readable guidance beside an operable scene. Retain the existing startup-bundle and production build checks because the guide crosses the initial rendering boundary.

These checks establish working navigation, cancellation, state retention and visual fit. A later brief visitor observation can assess whether the three questions make the application easier to understand; it remains separate from executable delivery evidence.
