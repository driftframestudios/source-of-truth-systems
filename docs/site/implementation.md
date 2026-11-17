# Extend the documentation entry

`docs/content-manifest.json` admits articles, their reading metadata, the two build profiles and the broader source population published in the LLM text bundle. An author edits Markdown or the owning schema, then rebuilds the projection.

## Two receiving profiles

- `npm run build` creates the application, private server projection and documentation at `/docs/`. The docs build owns `dist/docs/`; it leaves the application's initial bundle and manifest intact.
- `npm run build:foundation` creates the same articles at the site root in `dist-foundation/`, with `https://kindlight.foundation` as its canonical origin. This command builds static files; publication and host configuration remain explicit owner actions.
- `npm run build:docs` rebuilds only the `/docs/` projection after dependencies are installed. The ordinary Node server still needs its application and server builds.

Both routes work from an ordinary source ZIP without Git, a database or network documentation fetches. Application origin comes from `.figma/make/site.json`; the documentation manifest supplies the separate foundation origin and base. Change those owners when the receiving host changes.

## Add an article

Add one unique slug, source, title, description and navigation group to the manifest. The build reads only ordinary source files and rejects symlinked inputs. Keep the title and description useful to a reader choosing a route. Relative links to admitted articles become ordinary article links; other Markdown and source paths remain visible repository references. The footer links to the complete text bundle explicitly; plain-text fragments are machine-readable coordinates rather than browser article anchors.

The build-time Markdown renderer keeps raw HTML as text and admits ordinary HTTP(S), mail and owned document links. It renders fenced code as escaped text. Authors use Markdown instead of executable MDX. The article is complete HTML before JavaScript starts; a separate React entry mounts only the existing ThemeProvider and appearance selector. App, scene fixtures, session owners and GraphQL clients remain outside that entry.

## Keep the graph reference authoritative

`server/graphql/schema.graphql` and `server/workspaces/schema.graphql` own the schemas. Their operation registries validate the approved source documents and compute hashes from the exact original bytes. The documentation generator uses those owners to produce the reference and LLM companion. Readers can copy an approved hash and supply its declared variables; these pages execute no API requests or mutations. Production operation admission and the local-only explorer remain unchanged.

## Receive a request

The Node server reads the generated route manifest and serves each article with its own document policy and `no-cache`. Slashless admitted routes redirect to their canonical slash form; unrelated paths keep their normal 404. Static article assets remain under the documentation base. The standalone build includes a meaningful static 404 page. Appearance reuses the application's preference key and typed palette without importing its state. Vite generates the initial CSS variables from that same typed dark theme, so first paint and the interactive selector share one color authority.

## Verify a change

Build both profiles, run the documentation and startup tests, then inspect one direct article and an internal link at mobile and desktop widths. Change appearance and refresh the article. The build manifest proves the docs entry stays separate from the application's initial import closure. HTTP checks cover exact routes, HEAD, cache/CSP and unknown paths. These observations establish local build and serving behavior; a published host remains its own receiving check.

The implementation follows [Vite's multi-page build](https://v6.vite.dev/guide/build.html#multi-page-app), [Markdown-it's safe defaults and renderer](https://github.com/markdown-it/markdown-it), and [React root isolation](https://react.dev/reference/react-dom/client/createRoot). Vite 6 uses `build.rollupOptions.input`; the separate output directory and base preserve each receiver's asset paths.
