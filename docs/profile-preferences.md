# Profile workspace and preferences

Profile groups its navigation by the visitor's task: **Scenario & access**, **Your workspace**, and **Tools & examples**. The current section remains marked. The acting persona and environment stay visible; inspecting another person's access grid leaves that actor unchanged.

At compact desktop widths, the grouped navigation moves above the workspace so forms and the Access Grid keep their working width. Wide screens retain a side rail. Both layouts use the same mounted content and providers: a desktop resize retains the selected section, access draft and accepted preferences. The content owns vertical scrolling; the Access Grid and diagnostic log keep their local horizontal overflow where their records require it. `profile-layout.css` owns this composition, leaving the mobile Corridor/Plate receiver unchanged.

Profile offers two personal presentation choices with existing consumers. **Appearance** uses the shared theme selector; its browser-local persistence, desktop/mobile projection and colors retain the theme contract. **Informational toasts** changes ordinary confirmations and information notices immediately for this browser session. Preferences and Notifications show the same accepted choice.

Quieting informational toasts removes optional information already visible and filters later optional toasts. Warnings, errors, critical notices, all banners, error-linked feedback and explicitly persistent notices remain available. Reset notification preferences admits new informational notices again; previously suppressed notices stay discarded. Reset leaves appearance and accepted record edits intact.

`notificationState.ts` owns the typed state and reducer. The existing `NotificationProvider` retains preferences above responsive workspaces and reduces each incoming notice against the current choice. A personal display preference remains independent of record-write permissions. Reload starts with informational toasts enabled; the existing theme owner separately remembers appearance.

The Preferences panel reuses the existing compact switch and theme treatments. Unsupported density, animation, reflection, automatic-comparison and default-view settings have retired because they had no consuming behavior. Notifications states the availability of Slack, email and mobile-push delivery directly. Connections and Error Lab retain their explicit previews; they neither contact external services nor change operational records.

Focused reducer checks cover required feedback, current/future optional filtering and reset without backlog replay. Browser journeys at 1024 and 1512 pixels verify separated actor/inspection context, a fully reachable Access Grid and selected-section retention through desktop resizing. Preference journeys observe the real notification overlay, shared appearance, navigation/viewport retention, reset and permission refusals. The startup bundle check protects the mobile budget.

This contract supersedes the earlier disabled preference/routing controls. External notification delivery remains a separate future integration.
