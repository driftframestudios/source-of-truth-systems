---
name: resource-admission-lifetimes
description: Aligns request admission with the lifetime of unfinished handlers and owned resources. Applies when deadlines, aborts, plugin wrapping, or shared API routes can report completion before connections or work actually settle.
---

# Resource admission lifetimes

## Contract

- **What:** Bound active work using its real completion boundary while returning a timely, recoverable response.
- **When:** A request deadline, cancellation path, connection wrapper or API route changes how work is admitted and released.
- **Boundaries:** This is process-local resource ownership, not a distributed quota, identity system or general performance audit. Choose a limit from the receiving workload and existing owner; the showcase's current number is not a universal default.
- **Result:** Excess work is refused before expensive acquisition, and capacity returns only when the admitted handler and its owned cleanup settle.

## Fit and attention

- **Useful when:** A timeout response precedes query completion, routes use separate counters over one resource, or plugin order obscures the lifetime being counted.
- **Poor fit when:** The only issue is a slow pure calculation, idle animation or upstream account quota. Inspect that owner directly before adding admission machinery.
- **Smallest useful dose:** Hold one handler past its response deadline, then observe refusal before release and acceptance after cleanup.
- **May under-attend:** A correct cap bounds admitted work. Throughput, fairness, queueing policy and the appropriate cap value require their own workload evidence.
- **Interactions:** [Async draft recovery](../async-draft-recovery/SKILL.md) owns a write whose commit may outlive its response. A capacity release alone leaves commit status unresolved.

## Inputs, defaults and output

Read the installed wrappers, their construction order, the acquisition/close owner and current limits. Capture these boundaries for one route:

| Boundary | Required question |
| --- | --- |
| Admission | Which counter is shared, and what is refused before acquisition? |
| Acquisition | Can opening finish after abort? Who disposes that late resource? |
| Work | Which promise represents the actual handler or driver operation? |
| Response | Which deadline can return before that promise settles? |
| Cleanup | Which awaited path closes connections, listeners and transport? |
| Release | Which `finally` returns capacity after cleanup? |

Default to the existing bounded refusal and retry route. Preserve the accepted limit unless the task supplies a reason to change it. If driver cancellation is uncertain, retain the slot through actual completion and name that limitation. The output is an inspectable lifetime trace, a focused repair when needed, and an observation that distinguishes response completion from resource release.

## Rules

### Rule: Separate response time from work lifetime

A deadline can produce a response while the handler continues. Count that unfinished work until its own `finally` completes. Releasing a slot when the timeout response wins allows repeated timeouts to accumulate more underlying work than the cap describes.

### Rule: Draw the actual wrapper order

Plugin registration order may construct wrappers in reverse execution order. Trace request entry, admission, resource acquisition, deadline response and cleanup separately. Put admission around the handler lifetime that includes storage cleanup, with the deadline able to return independently. Confirm composition through the installed wrapper's behavior rather than relying on a comment or array position.

### Rule: A shared resource earns a shared admission owner

Routes drawing on the same bounded process capacity receive the same counter instance. An overflow response starts no repository or workspace work. Required error headers and a short retry instruction belong to that outer response; resolver-level decoration may be bypassed by a deadline or admission refusal.

### Rule: Abort reaches the resource that can release it

An abort signal and a stopped UI do not prove that a driver command or socket settled. Account for cancellation while opening, while querying and while closing. Own an idempotent cleanup path that disposes late-opened resources and removes listeners. Preserve the original failure while cleanup releases the underlying capacity.

### Rule: Reads and uncertain writes retain different recovery

A stopped read can return unavailability after disposal. A write may have committed before its response or connection failed. Keep retry identity and receipts with the write owner. A capacity release authorizes another request; it does not authorize replaying an uncertain mutation under a new identity.

## Operating sequence

1. **Locate:** Choose the actual route and shared resource. Follow the configured plugin/library far enough to establish wrapper execution order.
2. **Trace:** Write entry → admission → acquisition → work → response → cleanup → release, allowing response to occur earlier. Mark the promise or callback owning each event.
3. **Constrain:** Confirm overflow exits before resource creation and related routes use the intended instance. Inspect the outer refusal's status, cache headers and retry message.
4. **Exercise:** Hold the first handler beyond its deadline. Attempt another request while work is held; release cleanup; attempt again. This distinguishes a work cap from a response-only cap.
5. **Expand where touched:** Add a thrown handler, late connection or shared-route case when the repair changes that branch. Inspect a throwing cleanup separately when the driver supports that failure. Use driver integration for socket/transaction claims.
6. **Receive:** Report the lifetime bounded and cleanup observed. A held-handler observation leaves distributed capacity and load performance unmeasured.

## Local receivers

- [Request admission](../../../server/security/request-admission.mjs): shared unfinished-handler counter and overflow response.
- [Read API](../../../server/graphql/api.mjs), [workspace API](../../../server/workspaces/graphql.mjs), and [HTTP composition](../../../scripts/serve.mjs): actual wrappers and shared instance.
- [Read connection scope](../../../server/data/connection.mjs) and [workspace transaction connection](../../../server/workspaces/connection.mjs): distinct owned cleanup paths.
- [Admission observations](../../../tests/request-admission.test.mjs): executable delayed-handler, failure and shared-route cases. [GraphQL contract](../../../docs/graphql-read-api.md) owns current operational bounds.

[Connection tests](../../../tests/database-connection.test.mjs) own the covered lazy-open and read-cancellation cases. [Storage unit cases](../../../tests/workspace-storage.test.mjs) inspect write/read transaction cleanup through a controlled adapter; [SQL cases](../../../tests/mysql-workspaces.mjs) supply a separate engine observation. Choose the receiving layer matching the claim. These links identify available checks; record executed results only when that route runs. Use the [local writing guide](../declarative-skill-authoring/references/writing-and-evidence.md) when refusal or recovery prose changes.

## Authored routing example

- **Given:** One admitted handler remains blocked after its deadline response and the process cap is one.
- **When:** A request reaches the other route sharing that capacity owner.
- **Then:** It receives the busy response before opening storage. After the original handler's cleanup settles, a retry can enter.

This authored example names the discriminator. The admission tests supply the executable held-handler observation; a browser timeout alone cannot establish it.

## Recovery and re-entry

If a driver cannot cancel work, retain the slot until completion and offer the existing retry response. If a wrapper upgrade changes composition, return to the lifecycle trace and observe that installed composition before changing limits. Keep incomplete cleanup visible as an unresolved owner question. A move to multiple processes reopens capacity ownership because a local counter bounds only its own process.

## Completion

Complete when admission, response and cleanup have distinct verified owners, the relevant refusal acquires no expensive resource, and a retry succeeds after release. Re-enter when a route, driver, wrapper or deployment topology changes the shared lifetime.
