# Presentation visual fidelity contract

The presentation library preserves each brief's visual identity while visitors choose how to read its content. **Deck styles** uses each curated brief's declared style. **Briefing**, **Evidence review** and **Report** provide distinct pacing and structure over the same source sections. [The research decision](research/presentation-formats.md) records the evidence, alternatives and transfer limits.

## Identity and selection

The six styles retain their existing colors, typography, cover art and curated content. **Editorial Brief** names the color-block style without implying confidence in a scientific finding; it supersedes the former display name while retaining its stable internal key. **Spectrum** names the violet field, luminous accents and technical typography. Selecting a named style applies an explicit common override to every cover and the artifact composer; returning to **Deck styles** restores the original identities. Artifact composition starts in Blueprint.

Opening a brief resolves one concrete style and source identity. Back to library or Escape retains style, format and selected artifacts. Opening another brief starts at its first section. Within a brief, changing format retains the source section so the visitor can compare views without losing their place.

## Format composition

| Format | Reading structure | Navigation and visual rhythm |
| --- | --- | --- |
| Briefing | A prominent source headline and supporting evidence share a two-column page. Measures keep their labels, units and qualifiers; explanatory prose remains available. | Previous/Next and a section counter replace the page. A short 180ms arrival makes the change legible. The local viewport scrolls when content exceeds the available height. |
| Evidence review | The established oversized titles, angled stamps, color fields, grids and expressive cards remain the visual vocabulary. The angled cover stamp has its own header slot; title type scales with the available document width. Pages grow to fit their content. | A persistent chapter rail identifies the source sequence. Selecting a chapter scrolls to it; an arriving page reveals its content with the existing gentle upward movement. |
| Report | Continuous sections use 28px headings, 15–16px prose, approximately 1.6 line spacing and a maximum reading column near 78ch. The deck identity remains above the document. | A contents rail carries section labels and their full headings. Previous/Next also moves between sections. Values and explanations stay together in reading order. |

The toolbar and bottom navigation remain in place while the content viewport scrolls. Contents and chapters have their own scroll area when needed. At compact laptop widths the rail narrows and content padding decreases; long prose continues vertically instead of being clipped. Reduced motion presents content immediately and uses immediate section navigation.

## Appearance boundaries

The application appearance controls the surrounding workspace, format controls and selected style's text/surface pair. A style's accent remains a swatch and border in the library. Under Dark and Light, deck paint retains its own identity. High contrast maps document foregrounds, surfaces, rules and accents to shared semantic tokens; it preserves source content and layout. The implementation uses local paint roles rather than color inversion or filters.

## Content and state ownership

- `views/PresentationsView.tsx` owns curated examples, style defaults, artifact selection and the concrete playback snapshot. Its existing expressive renderer supplies Evidence review.
- `presentation/presentationModel.ts` defines the shared discriminated content union and style contract.
- `presentation/presentationFormats.ts` owns the typed format registry, stable section projection, identity metadata and local paint roles.
- `presentation/PresentationPlayer.tsx` owns current section, local scrolling, keyboard return/navigation and format presentation. The view retains the selected format when playback closes.
- `presentation/SectionEvidence.tsx` renders the complete supporting content for Briefing and Report. It reads the original section object, including artifact facts and recorded acceptance checks.
- `presentation/presentation-formats.css` owns composition, typography, local semantic paint, responsive density and reduced motion.

The current projection retains source wording and numerical qualifiers. The synthetic examples remain examples; format selection creates no new scientific claims. Future outline generation has a typed receiving boundary and a separate approval route.

## Focused evidence

`tests/presentation-formats.test.mjs` checks stable section identity, original content ownership and the three distinct navigation contracts. `tests/browser/presentation-formats.spec.mjs` exercises section continuity across formats, full-document access, end navigation, two different deck identities at desktop and compact laptop widths, reduced motion and High contrast. `tests/browser/presentation-styles.spec.mjs` verifies individual defaults, common overrides, return navigation and retained artifact picks.

These checks establish behavior and paint on the exercised browser paths. Local screenshots support visual review of settled states. Scientific validity and audience comprehension remain separate evaluations. Mobile continues to prioritize Corridor and Plate through its existing compact navigation.
