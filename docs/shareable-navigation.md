# Shareable application views

A visitor can copy the current address to reopen a section, Corridor or Plate scene, Plate overview or Sample history, and the selected Plate lens. The existing interface supplies these choices; the URL follows them. A plain application address opens Lanes/Corridor. A valid shared address opens its declared view on first load and reload.

## Finite address contract

| Query key | Accepted values | Default |
| --- | --- | --- |
| `section` | `map`, `lanes`, `specimens`, `cohort`, `qc`, `biomarkers`, `sources`, `requirements`, `artifacts`, `comparisons`, `decisions`, `release-plan`, `presentations`, `profile` | `lanes` |
| `scene` | `corridor`, `plate` | `corridor` |
| `plate` | `overview`, `history` | `overview` |
| `lens` | `status`, `kind`, `storage`, `athena` | `status` |

For example, `/?scene=plate&plate=history&lens=storage` opens Sample history through the Storage lens. `/?section=requirements` opens the existing Requirements receiver; its internal identifier remains `instructions`. Release plan likewise retains its internal `next-arc` identifier.

`services/navigation/navigationUrl.ts` parses at most 1,024 query characters and accepts known values of at most 32 characters. Duplicate known keys or an unsupported known value refuse the complete navigation input and recover to Lanes/Corridor. Unknown keys carry no navigation authority. Serialization emits only declared nondefault values, in a stable order. Canonicalization removes unrelated query keys and fragments; history entries carry a null state payload.

The address contains view choices. Persona, role, environment, grants, workspace identity, cookies, record metadata, editor text and free-text search retain their existing owners and stay outside this codec. Selected wells and results also remain local exploration state; sharing an exact record requires a separately bounded extension. Documentation article navigation has its own receiving surface.

## Ownership and browser travel

`ExplorationProvider` owns section, scene and Plate preferences above both responsive workspaces. `NavigationHistory`, mounted beneath `GuideProvider`, observes those owners. Section or scene changes add a browser return point with `pushState`; Plate mode and lens changes replace the current point. Initial canonicalization also uses `replaceState`.

Back and Forward synchronously close the guide and invalidate its pending selection authority before the existing state owners receive the parsed address. A delayed history result can populate its scoped data cache, while the visitor's chosen section remains in control. The desktop shell restores a prior Corridor query and releases its return rail on browser travel. Accepted records and permission scenarios retain their independent lifetime.

Mobile continues to provide Corridor and Plate. A desktop-only section remains selected in shared state while the compact layout shows the current scene; widening returns to that section. Choosing Corridor or Plate explicitly on mobile selects Lanes. A Plate URL opens the 3D representation at either size; the mobile touch-board choice remains a local display preference.

## Source draft continuity

`services/sourceEditor.ts` keeps unfinished Source title, summary and tags in the app session, keyed by exact source identity and workspace namespace. Section navigation, browser travel and responsive remounts retain an open editor. Hiding and reopening the same draft retains its original expected revision, so an intervening accepted edit still produces the normal conflict response. Cancel discards that source's draft; a confirmed Save closes only its submitted editor generation. Reload ends unfinished in-memory drafts. Hosted accepted metadata retains its separate workspace recovery.

Explicit workspace recovery rebases the currently open draft to the new revision namespace while preserving its text for review. Opening a dormant draft in a different namespace starts from that workspace's accepted metadata. The existing Source command owner checks workspace generation, workspace identity and current permission scope before publishing an asynchronous completion. URL navigation neither accepts an edit nor changes those checks.

## Focused evidence

`tests/navigation-url.test.mjs` distinguishes finite input, ambiguous/refused input, exclusion of unrelated data and push/replace semantics. `tests/source-editor.test.mjs` exercises retained text and expected revision, stale editor completion, cancellation and namespace recovery. Existing Source workspace tests continue to cover late responses, exact retries and permission changes.

`tests/browser/shareable-navigation.spec.mjs` receives a shared link in the actual Plate, crosses responsive layouts, returns through Back/Forward to an unfinished Source draft, and takes control during delayed guided history. The build-dependent startup test checks that the bridge preserves the deferred desktop/Plate delivery boundary. These are application navigation checks; external hosting and documentation publication retain their own delivery checks.

[Application owners](../src/app/README.md) · [Source recovery](visitor-workspaces.md) · [Documentation](README.md)
