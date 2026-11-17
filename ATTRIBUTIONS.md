# Attributions

The repository's [LICENSE](LICENSE) carries the owner's copyright and MIT terms. Preserve it together with the upstream notices that apply to adapted components and redistributed dependencies.

## Components

The Figma Make starting material included [shadcn/ui](https://ui.shadcn.com/) components. The retained [ScrollArea](src/app/components/ui/scroll-area.tsx) and [class-name utility](src/app/components/ui/utils.ts) preserve that component lineage; ScrollArea composes the installed Radix primitive. The [upstream MIT notice](LICENSES/shadcn-ui.txt) is included locally from [shadcn/ui's license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).

Other packages retain their own licenses in their distributed packages. [package.json](package.json) and [pnpm-lock.yaml](pnpm-lock.yaml) identify the actual dependency graph; this attribution file does not relicense those dependencies.

## Images

[source-of-truth-systems-social-preview.png](public/source-of-truth-systems-social-preview.png) is the maintainer-supplied screenshot of the application's Plate, used for social previews and repository orientation. The current tracked image and imports contain no Unsplash photograph. This supersedes the starter's generic Unsplash credit; restore a specific photographer/image attribution if such a photo is deliberately added later.

The five [README screenshots](docs/images/readme/) were captured locally from the working application using its bundled synthetic examples. They show the desktop Corridor, Sample history and Cohort Builder, plus the mobile Corridor and Sample history. They retain the project's copyright and contain no added stock photography.

## Fonts

[src/styles/fonts.css](src/styles/fonts.css) requests Playfair Display, DM Sans, JetBrains Mono, Archivo Black and Space Grotesk through Google Fonts. The browser contacts Google's stylesheet and font delivery services; font binaries are not bundled in the current source. An offline or network-restricted environment uses the declared fallback fonts, so its typography may differ.

A deployment that needs self-hosted fonts should obtain the selected families and versions from their authoritative distributions, retain each applicable license/notice and review the resulting asset loading. The [Google Fonts FAQ](https://fonts.google.com/faq) describes its licensing and hosting model. Self-hosting is a separate change; the current delivery remains external.

## Creation tools

The owner-confirmed credit is: “Built with Figma Make (Claude Opus 5.5) and ChatGPT/Codex (GPT-6 Astra), using custom coding harnesses from kindlight.systems.” [ShowcaseCredit.tsx](src/app/components/ShowcaseCredit.tsx) owns the visible wording. Git authorship and reviewed contributions identify subsequent work; tool credit does not replace copyright or upstream attribution.

[Return to the repository](README.md)
