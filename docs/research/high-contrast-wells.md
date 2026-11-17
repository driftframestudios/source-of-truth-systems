# High contrast Plate cues

## Receiving decision

High contrast gives failed QC a restrained diagonal face mark in every lens, and gives the existing green/violet category pair a gold/blue projection with sparse category marks. Dark and Light keep their existing colors, gradients and patterns. This is a small Plate experiment for review and community feedback, with the receiving evidence described below.

The receiving task is to distinguish a category while scanning small wells and result discs. The selected record and labelled legend still explain its meaning. No theme or simulation establishes a universal color-vision guarantee.

## Evidence that changes the design

| Evidence and class | Design consequence and limit |
| --- | --- |
| The [National Eye Institute](https://www.nei.nih.gov/eye-health-information/eye-conditions-and-diseases/color-blindness/types-color-vision-deficiency) distinguishes deuteranomaly from deuteranopia and describes difficulty with particular red/green shades. Official clinical summary. | Test actual rendered colors instead of treating every green/purple pair as equivalent. Hue names alone do not predict whether these particular categories will be distinguishable for a particular visitor. |
| [Machado, Oliveira and Fernandes (2009)](https://pubmed.ncbi.nlm.nih.gov/19834201/) model normal vision, anomalous trichromacy and dichromacy in one framework, with experimental evaluation. Primary research. | Simulation is a useful design probe. Its population/model assumptions and a visitor's actual perception remain distinct; a full-severity rendering does not demonstrate every deuteranomaly severity. |
| [W3C technique G111](https://www.w3.org/WAI/WCAG22/Techniques/general/G111) pairs color and pattern and repeats both in the legend. Official guidance. | Generate face and legend from one paint projection. Text remains available in the key and selected record; the marks add a second visual channel without a new label on every well. |
| [W3C non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) calls attention to adjacent surfaces, gradients and thin anti-aliased marks. Official guidance. | Inspect the actual 26–28 px faces and small legend swatches. A nominal color calculation alone does not establish that a projected, shaded mark remains readable. |
| [Chrome's rendering tools](https://developer.chrome.com/docs/devtools/rendering/apply-effects#emulate-vision-deficiencies) provide deuteranopia and achromatopsia emulation. Official implementation documentation. | Capture the same Plate under those two probes. The test tool's available modes are the evidence boundary; it does not supply a graded deuteranomaly preview. |

## Options and synthesis

Hue-only adjustment keeps the scene quiet but leaves categories dependent on color. A repeated diagonal or dotted texture is stronger at larger sizes, but the existing frost and consent hatch already have domain meanings and dense texture becomes busy across a plate. Zoom-only signifiers improve inspection after selection while leaving the initial overview unchanged. Large letters or icons would compete with well coordinates and the selected-result labels.

Use a single diagonal for failed QC, combined with the existing glossy face. This result-level cue remains available as the visitor changes lenses and does not require every well to gain a symbol. Consent holds and cancelled faces take priority; frozen-file texture stays visible beneath the quality mark. Status labels and the key describe the failure.

The additional category-pair experiment uses a small dot or short bar:

| Source hue | High contrast face | Additional cue | Receiving categories |
| --- | --- | --- | --- |
| Green `#34d399` | Gold `#ffd166` | Center dot | Orthogonal result, Standard storage, Queryable |
| Violet `#a78bfa` | Sky blue `#87c9ff` | Short center bar on an otherwise unpatterned face | Reanalysis; Glacier Flexible keeps its existing frost instead |

Marker ink is `#06101d`. The failed-QC diagonal suppresses the optional dot/bar on that face, keeping one foreground mark. Other category colors retain their current High contrast derivation. Gold may approach other warm categories, and blue may approach longitudinal results; the face mark is the additional distinction. Existing consent hatching, cancelled hollow faces and frozen-file textures take precedence. Dot/bar patterns mean the category shown in the current lens. The separately owned diagonal means failed QC across lenses; the key names that distinction.

`stackLens.ts` owns the mode-specific category projection, pattern precedence and CSS face painting. Its typed paint data feeds desktop overview wells, 3D history, mobile board and both legend presentations. `usePlateColors` receives the same color mapping for record companions. No additional renderer, dependency or camera state is introduced.

## Observation and next receiver

Focused checks compare affected paints with their labelled keys, carry the failed-QC mark across lenses, preserve consent and storage-pattern precedence, and retain the established Dark/Light pair. A cycle-scoped comparison checks every status/kind/lens combination against the accepted pre-change paint function in Dark and Light. Browser observations cover the High contrast desktop and compact views, mode switching and selected history. The local Chromium captures show the dot/bar distinction on the 390 px board and the failed-QC diagonal in its key and selected history under ordinary, deuteranopia and achromatopsia rendering. Warm categories move toward similar yellows under the deuteranopia probe, making the dot useful. Steep 3D angles shrink every face mark; the existing camera, zoom and selected record remain the inspection route. These screenshots are diagnostic artifacts, not perceptual validation or a conformance certification.

Invite feedback on three concrete questions: is the failed-QC diagonal useful at ordinary zoom; do the dot/bar category marks and their key make the gold/blue pair clearer; does any cue become distracting across the plate? Revisit cue size or the narrow palette pair from that evidence. Broader category redesign and graded color-vision evaluation remain separate decisions.
