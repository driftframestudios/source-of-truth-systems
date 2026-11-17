---
name: responsive-intent-handoff
description: Preserves scene intent across responsive receivers, deferred loading, and guided playback. Applies when remounts, late readiness, camera motion, or manual takeover can replace the visitor's current exploration.
---

# Responsive intent handoff

## Contract

- **What:** Separate retained exploration intent from the lifetime of its current renderer and automatic presentation effects.
- **When:** A viewport change, lazy scene, guided step, or camera transition can replay an old selection or lose a current one.
- **Boundaries:** This method owns presentation continuity. Accepted edits and permission scope stay with their existing owners. A spacing-only change usually needs direct layout work instead.
- **Result:** The receiving layout shows the current permitted scene and selection, while obsolete work relinquishes control.

## Fit and attention

- **Useful when:** Resizing replaces a renderer, a guide waits for a lazy scene, or direct input competes with pending navigation, scrolling or camera motion.
- **Poor fit when:** A panel only needs spacing or width changes and retains the same owner. An accepted-record conflict belongs to its data workflow even when resizing exposes it.
- **Smallest useful dose:** Trace one retained selection through a receiver change and one competing manual action.
- **May under-attend:** State continuity can be correct while the scene remains visually crowded or offscreen. A settled viewport observation supplies that separate layout evidence.
- **Interactions:** [Scoped record boundaries](../scoped-record-boundaries/SKILL.md) determines which selection remains permitted; [async draft recovery](../async-draft-recovery/SKILL.md) owns pending saves independently of presentation.

## Inputs, defaults and output

Read the parent state owner, responsive/deferred receiver, effect cleanup and relevant scene contract. Classify each value before moving it:

| State or effect | Default lifetime |
| --- | --- |
| Selected scene, well/result, intended history mode | Shared exploration intent across compatible receivers |
| Local rail visibility, DOM measurements, pointer capture | Current renderer, unless the task explicitly requires persistence |
| Frame handle, timer, scroll callback | Effect instance with explicit cancellation |
| Guide step and readiness | One identified scene request |
| Accepted edit or recovery deadline | Existing accepted-state owner above renderer replacement |

Define what “ready” means for this receiver: current data, a settled camera, an available companion panel, or a stated combination. Prefer existing selection and scope owners. If a receiver cannot resolve a selection yet, preserve the intent and show the existing pending/unavailable state rather than manufacturing a replacement. The output is a bounded ownership repair, a current/obsolete event trace and the fitting state or visible-scene observation.

## Rules

### Rule: Classify before lifting state

Scene choice, selected well/result and intended history mode can outlive a renderer. DOM measurements, open local rails, pointer capture and animation handles belong to that renderer. Accepted recovery deadlines belong to the accepted-state owner; remounting a view resumes the remaining work rather than restarting its duration. Move each value only as high as its required lifetime.

### Rule: Readiness belongs to a request and an observable receiver

A scene request identifies one navigation intent. Data arrival and camera settlement may both be required before its reading interval starts. A mounted component or elapsed delay alone establishes neither. A terminal unavailable or denied result hands control back through the existing receiver.

### Rule: Cancellation changes ownership, not only playback

Pause, dismissal, a newer request and direct interaction invalidate pending automatic selection and scrolling. Include wheel zoom and queued resize frames when they control the scene. Every delayed callback checks current ownership before publishing. A late acknowledgement can describe readiness without restarting playback. An explicit reopen issues a fresh request; its recovery control remains reachable on compact screens.

### Rule: Preserve the receiving surface

A responsive handoff may replace composition while keeping selected identity and accepted state. Scene preparation routes through existing navigation and scope owners. It does not manufacture a default result over an explicit selection. Inspect the actual scene in the smallest supported orientation: guidance can be readable while accidentally pushing its subject outside the visible area.

### Rule: Motion preference changes delivery, not intent

Reduced motion may settle immediately and keep guidance stepwise; it still reaches the selected scene and its readiness outcome. A restored view resumes an accepted recovery deadline from its remaining time. Cosmetic camera motion and accepted operational time retain different owners.

## Operating sequence

1. **Reconstruct:** Start with the current selection and name the event that replaces or defers its renderer. Separate retained values from renderer-local handles.
2. **Bind:** Give the automatic request an identity and identify its readiness sources. Decide which owner can authorize selection, camera motion, scrolling and a reading timer.
3. **Trace takeover:** Follow pointer, wheel, keyboard, dismissal and newer-request paths that actually control the scene. Name where each invalidates pending automatic effects; pausing a timer alone leaves other callbacks live.
4. **Repair locally:** Place retained intent above the relevant remount boundary. Guard delayed callbacks at publication and cancel owned frames/listeners at cleanup. Keep accepted records in their existing owner.
5. **Observe the discriminator:** Delay readiness, make the competing selection and release the delay. Check the selected identity and playback separately. A responsive round trip must retain explicit intent; an explicit reopen must issue fresh authority.
6. **Inspect the receiver:** At the affected portrait/landscape or compact/wide boundary, verify that the selected scene and recovery control remain visible. Use controlled time for phase assertions and settled visual review for spatial claims.
7. **Return:** Name the retained intent, withdrawn effect and observed outcome. A reducer test establishes state transitions; browser and viewport observations establish their receiving UI behavior.

## Local receivers

- [ExplorationProvider](../../../src/app/services/exploration/ExplorationProvider.tsx): retained scene and selection intent.
- [GuideProvider](../../../src/app/components/guide/GuideProvider.tsx) and [guide receivers](../../../src/app/components/guide/useGuideScene.ts): request identity, takeover and scoped readiness.
- [Scene transition owner](../../../src/app/components/plate/sceneTransition.ts): cancellable frames, delays and motion.
- [Responsive journeys](../../../tests/browser/responsive-session.spec.mjs) and [guide journeys](../../../tests/browser/guided-exploration.spec.mjs): executable receiving observations. The [mobile contract](../../../docs/mobile-showcase.md) owns composition details.

[Responsive exploration journeys](../../../tests/browser/responsive-exploration.spec.mjs) cover Plate/Board intent across both directions of the breakpoint. [Guide reducer tests](../../../tests/guided-exploration.test.mjs) cover stale acknowledgement, pause, replay and completion; the guide browser cases exercise wheel takeover, late history after exit and compact scene receiving. [Scene transition tests](../../../tests/scene-transition.test.mjs) own cancellable motion mechanics. These links identify assertions to inspect or execute, rather than a standing pass claim. Use the [local writing guide](../declarative-skill-authoring/references/writing-and-evidence.md) when readiness messages or substantial handback prose change.

## Authored routing example

- **Given:** A guide requests history while its scene and data load.
- **When:** The visitor selects another scene before readiness arrives.
- **Then:** The old read may finish its own lifecycle, while current exploration retains control. That completion cannot reselect history or restart playback. An explicit reopen issues a fresh request and remains reachable on a compact screen.

This authored example explains the ownership branch. The guide's late-history and takeover tests carry the implemented assertions; the prose itself supplies no runtime result.

## Recovery and re-entry

If preparation is interrupted, keep the visitor's current scene and offer the existing explicit reopen control. If scoped data is denied or unavailable, let its receiver show the reason and recovery route; automatic playback pauses there. If a motion or resize callback survives cleanup, identify its owner and withdraw that authority before adding another delay.

Re-enter when a new renderer, deferred companion, automatic effect or breakpoint changes who can publish selection. A layout-only adjustment can return to direct visual work once continuity is already established.

## Completion

Complete when the current permitted selection reaches its new renderer, obsolete callbacks leave it intact, manual exploration keeps control and the relevant receiver remains visibly usable. Record the tested transition and viewport separately so each claim retains its evidence.
