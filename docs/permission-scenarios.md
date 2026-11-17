# Permission scenarios, scoped reads and accepted commands

Profile lets a visitor choose a synthetic persona, workspace role and audience perspective. Choices apply immediately. The scenario, accepted records, file recovery and refusal notices belong to the application session and survive desktop/mobile layout changes. Reload starts a fresh example session.

This is a public portfolio scenario. Its finite actor and role selectors demonstrate permission behavior; verified identity and private data require the separately planned server identity boundary. Public workflow examples in the other desktop sections remain demonstration context. The Corridor receiver and Plate records, GraphQL reads, Access Grid and accepted commands use the boundaries below.

## Policy ownership

`shared/permission-scope.mjs` owns explicit job capabilities, scenario validation, grant replay, canonical record ownership and field projections. The browser and server receive the same catalog from `services/accessService.ts` through `permissionScope.ts`. Feature records remain deferred. The API creates one immutable scope per request alongside its request-owned data repository.

Lab Operator manages samples and orders; Clinical Reviewer reviews results; Analyst runs analysis and recovery. Viewer and Auditor can read permitted records and file locations. Release Lead combines working capabilities. Administrator adds policy configuration. Selecting another role retains the persona's environment assignments and clearance. Selecting another persona restores its baseline role and audience. Audience perspective changes presentation independently of authority.

A decision checks supported input, consent, environment write settings, membership, canonical resource sensitivity and the requested capability. A record command additionally requires a sufficient resource/geography grant. Validation and Production retain their read-only setting. Reading skips the write-setting requirement while retaining the other boundaries.

## Access Grid

The acting scenario authorizes Save grants. The inspected person identifies whose matrix will change; inspecting an Administrator does not give the acting visitor that role. Effective scope uses the acting role for the active persona and the inspected person's baseline role for other people. Resource-specific task capabilities remain a separate requirement from a read/write grant.

The session owner accepts a complete known matrix synchronously, validates every cell and rechecks the current actor and environment. Each changed cell becomes a bounded grant command carrying its actor, target, resource, geography and level. The server replays the same validated commands against canonical seeds rather than accepting a claimed capability set or effective matrix. The log accepts up to 64 saved cell-change entries, including repeated changes to one cell. A save that changes no cells adds no entries. An over-limit save preserves the accepted scope and open draft, and names **Reset scenario grants** as recovery. Unsupported inputs also preserve the accepted scope.

**Reset scenario grants** restores every person’s canonical example grants, clears the accepted command log and replaces the open Access Grid draft with those restored values. It retains the acting persona, role, environment and audience, the inspected person and effective-scope display choice, and unrelated accepted records, file recovery and exploration. The accepted owner updates synchronously so the grid reads the restored matrix immediately.

This local recovery is available in Viewer and read-only scenarios whenever saved grant changes or an open draft exist. It restarts the public experiment; **Save grants** continues to require the current policy-edit capability and a writable environment. This replaces reload-only recovery for grant experiments. Reload still starts a fresh application session. Verified identity and durable policy administration retain separate owners.

The scope key includes the normalized persona, role, environment and accepted grant commands. Two different grant sets cannot collide merely because they have the same edit count. Server cursors use a bounded digest of this key. The digest namespaces paging; it grants no authority.

## Read projection

The generic Corridor is public workflow context with no patient ownership on its cards. Its receiver checks the scenario's read capability and environment membership. Plate has a stricter record projection:

- A well requires plate-map scope at its canonical geography; a result also requires run-metadata scope and its permitted anchor well.
- Known specimens supply geography, classification and consent. Legacy stored rows use this same canonical ownership. Unlinked generated examples use the declared collection geography. Unknown specimen ownership receives a bounded refusal rather than an actor-region guess.
- Coordinates, sequence, kind, state, date and short navigation labels form the minimum de-identified timeline. Clinical titles, reasons, findings, triggers and related narrative require the classification ceiling and variant scope. Withheld detail receives a neutral description.
- Patient linkage, quality measurements, contamination and laboratory fields follow their own resource grants and classification ceiling. Field omission represents an unavailable field, never a zero measurement.
- A restricted file projection carries its scope provenance. Readiness describes withheld information as outside scope; an absent visible file does not establish that no file was produced. Permitted file rows and their known availability remain inspectable.
- Reviewer, Auditor, Release Lead and Administrator may inspect a bounded consent-hold explanation. Analysis and file operations still obey the hold. A newer canonical hold takes precedence over an older active stored alias.
- Lists filter before counts, page cursors and relationship links. Direct IDs, superseded results and reused-file references use the same receiving policy.

Default grants preserve C3 file recovery. A9's protected details and repair require Dr. A. Okafor and Staging; choose the Analyst role for its partition-repair example. The default scope retains its minimal timeline. Clinical approval also remains PHI-class: the default Platform Lead's limited clearance cannot approve it by changing role alone. Choose Dr. A. Okafor, Clinical Reviewer and Staging to explore approval.

## History and responsive recovery

The Plate cache partitions reads by the complete permission scope and collection/well identity. Switching scope changes the rendered projection immediately, cancels the former request and checks the captured scope again before a response can publish. A late response cannot fill the current scope's cache. Returning to a previously permitted scope may reuse its own successful read. Resetting grants derives the seed scope key for the current selection, so this same reconciliation restores its permitted projection and may reuse its existing cache partition. Reset leaves history caches and accepted file-recovery owners intact.

The source strip distinguishes permitted history, denied access, missing records, empty histories and retryable unavailability. Denied access and unknown or conflicting stored ownership suppress both earlier cached records and examples. Ownership uncertainty offers Retry and remains suppressed until a confirmed successful read. Missing or empty successful reads replace earlier example history. A transport failure may retain only the examples allowed by the current scope, with an explicit unavailable source. Selected details, hover cards, story links and counts receive the same projection; permission changes leave accepted edits and the visitor's underlying exploration selection with their existing owners.

## Accepted commands

Callers submit identifiers and intent. `recordCommands.ts` resolves the current specimen or biomarker owner, checks its canonical consent and geography, evaluates the action/resource contract and asks `recordSession.ts` for the legal transition. Operational sample/order management uses the wet-lab or accessioning resource clearance; clinical approval uses the stricter clinical-report resource. These public workflow commands retain that boundary independently of access to protected Plate findings and files. Unknown records, missing ownership and repeated transitions return tagged refusals.

| Workflow | Capability | Canonical resource |
| --- | --- | --- |
| Sample progression | Manage samples | Wet-lab process |
| Order place, start, hold, release, fulfill or cancel | Manage samples | Accessioning |
| Specimen and biomarker review, approval or sign-off | Review clinical results | Clinical report |

`plateCommands.ts` receives the collection plate, anchor well and result ID, plus an action and file kind or restore-tier ID. The collection plate may differ from the physical run plate. Current permitted stored history takes precedence over bundled examples. File restore requires analysis capability and a write grant for the file's resource; partition repair uses variant-call write scope; file-location copy uses read scope. Every Plate command also checks canonical record classification, so readable timeline metadata alone permits no operation on protected files. The command owner resolves the current record and owner again before effects.

Accepted file restores retain their physical object identity while each receiving result keeps its consent. Accepted query repairs keep their completion deadline across layouts. A later permission change governs new commands; previously accepted work completes, with record-specific notifications shown only in a still-permitted scope. These remain local showcase actions. Plate histories keep their indexed, parameterized read-only path; the separate disposable Source workspace uses its own transaction owner; SQL views cannot identify a browser persona through one hosted application account.

## Evidence and continuation

Focused policy/API cases compare direct and nested reads, field omission, canonical holds, malformed grant replay, filtered counts and cursor boundaries. Client cases cover acting versus inspected authority, scope downgrades, late-response cancellation, denial without example fallback and responsive return to a permitted cache. The grant-recovery cases exercise seed restoration, the saved-entry boundary and retention of independent accepted work. Command and browser regressions retain the working recovery and clinical-review paths.

These checks target consistent finite-scenario behavior. [Disposable Source workspaces](visitor-workspaces.md) use server-issued origin-bound cookies and current simulated policy at their command boundary. Saved metadata has bounded history and expiry. Verified identity remains a separate design and acceptance boundary for private records or real multi-user work. The ordinary Node server and PostgreSQL clone retain their stored-history boundary.
