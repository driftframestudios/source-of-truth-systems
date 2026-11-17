import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import {
  FileCheck2, FlaskConical, Layers, Shield, Sparkles,
  Anchor, Rocket, Ruler, Terminal, Hexagon, FileText,
} from 'lucide-react';
import { STORE } from '../../data';
import type { Artifact } from '../../types';
import { arcLabel } from '../../services/cartographyService';
import type { Band, SlideSpec, Theme, ThemeId } from '../presentation/presentationModel';
import { PresentationPlayer } from '../presentation/PresentationPlayer';
import type { FormatId, PresentationIdentity } from '../presentation/presentationFormats';

/**
 * Source-owned curated decks and artifact composition share a section grammar.
 * Visual identity remains independent from Briefing, Evidence review and Report
 * pacing; PresentationPlayer owns the receiving navigation and viewport.
 */

// =============================================================================
// THEME ENGINE
// =============================================================================

type StyleSelection = 'deck-styles' | ThemeId;
const ARTIFACT_THEME: ThemeId = 'blueprint';

function resolveThemeId(selection: StyleSelection, original: ThemeId): ThemeId {
  return selection === 'deck-styles' ? original : selection;
}

const THEMES: Record<ThemeId, Theme> = {
  'bold-signal': {
    id: 'bold-signal',
    label: 'Editorial Brief',
    blurb: 'Editorial color blocks · clear section hierarchy',
    audience: 'Internal review · pre-board rehearsal',
    bg: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 50%, #1a1a1a 100%)',
    surface: 'rgba(255,255,255,0.04)',
    surfaceMuted: 'rgba(255,255,255,0.02)',
    ink: '#ffffff',
    inkDim: 'rgba(255,255,255,0.55)',
    rule: 'rgba(255,255,255,0.12)',
    accent: '#FF5722',
    accent2: '#00C2A8',
    accent3: '#FFD400',
    accent4: '#6E5BFF',
    accent5: '#FF3CAC',
    textOnAccent: '#1a1a1a',
    fontDisplay: '"Archivo Black", sans-serif',
    fontBody: '"Space Grotesk", sans-serif',
    cornerRadius: 4,
    icon: Sparkles,
  },
  'deep-meridian': {
    id: 'deep-meridian',
    label: 'Deep Meridian',
    blurb: 'Nautical brass · navy seas · weathered cream',
    audience: 'Sponsor briefings · investigator collaborations',
    bg: 'radial-gradient(ellipse at 30% 0%, #0c2030 0%, #061320 60%, #03080f 100%)',
    surface: 'rgba(220,200,140,0.06)',
    surfaceMuted: 'rgba(220,200,140,0.03)',
    ink: '#f2e8c9',
    inkDim: 'rgba(242,232,201,0.55)',
    rule: 'rgba(220,200,140,0.18)',
    accent: '#d4a544',
    accent2: '#2dd4bf',
    accent3: '#f5d978',
    accent4: '#5b9bd5',
    accent5: '#c45a3a',
    textOnAccent: '#0a1828',
    fontDisplay: '"Playfair Display", serif',
    fontBody: '"DM Sans", sans-serif',
    cornerRadius: 2,
    slideOverlay: 'repeating-linear-gradient(90deg, transparent 0 79px, rgba(220,200,140,0.04) 79px 80px)',
    icon: Anchor,
  },
  'spectrum': {
    id: 'spectrum',
    label: 'Spectrum',
    blurb: 'Violet field · luminous accents · technical precision',
    audience: 'Innovation summit · research demo days',
    bg: 'radial-gradient(circle at 80% 20%, #2a0a4a 0%, #0a0220 50%, #02000a 100%)',
    surface: 'rgba(180,80,255,0.08)',
    surfaceMuted: 'rgba(180,80,255,0.04)',
    ink: '#f4f0ff',
    inkDim: 'rgba(244,240,255,0.55)',
    rule: 'rgba(255,80,200,0.22)',
    accent: '#ff2d92',
    accent2: '#00ffd1',
    accent3: '#ffe14a',
    accent4: '#a855f7',
    accent5: '#22d3ee',
    textOnAccent: '#0a0220',
    fontDisplay: '"Archivo Black", sans-serif',
    fontBody: '"JetBrains Mono", monospace',
    cornerRadius: 0,
    slideOverlay: 'repeating-linear-gradient(0deg, transparent 0 3px, rgba(255,255,255,0.012) 3px 4px)',
    icon: Rocket,
  },
  blueprint: {
    id: 'blueprint',
    label: 'Blueprint',
    blurb: 'Technical drawing · high contrast · molecular tumor board',
    audience: 'Molecular tumor board · clinical case review',
    bg: 'linear-gradient(180deg, #0a3b8a 0%, #0a3580 100%)',
    surface: 'rgba(255,255,255,0.04)',
    surfaceMuted: 'rgba(255,255,255,0.02)',
    ink: '#f6f9ff',
    inkDim: 'rgba(246,249,255,0.7)',
    rule: 'rgba(246,249,255,0.4)',
    accent: '#ffffff',
    accent2: '#7dd3fc',
    accent3: '#fcd34d',
    accent4: '#86efac',
    accent5: '#fca5a5',
    textOnAccent: '#0a3580',
    fontDisplay: '"Archivo Black", sans-serif',
    fontBody: '"JetBrains Mono", monospace',
    cornerRadius: 0,
    slideOverlay:
      'repeating-linear-gradient(0deg, transparent 0 39px, rgba(255,255,255,0.06) 39px 40px),' +
      'repeating-linear-gradient(90deg, transparent 0 39px, rgba(255,255,255,0.06) 39px 40px)',
    icon: Ruler,
  },
  'clinic-mono': {
    id: 'clinic-mono',
    label: 'Clinic Mono',
    blurb: 'Pure black-on-cream · monospace · publication-grade',
    audience: 'Manuscript figures · regulatory submission',
    bg: 'linear-gradient(180deg, #f4f1e6 0%, #ece8d8 100%)',
    surface: 'rgba(0,0,0,0.04)',
    surfaceMuted: 'rgba(0,0,0,0.02)',
    ink: '#0a0a0a',
    inkDim: 'rgba(10,10,10,0.55)',
    rule: 'rgba(10,10,10,0.2)',
    accent: '#0a0a0a',
    accent2: '#c45a3a',
    accent3: '#1a1a1a',
    accent4: '#5a5a5a',
    accent5: '#c45a3a',
    textOnAccent: '#f4f1e6',
    fontDisplay: '"JetBrains Mono", monospace',
    fontBody: '"JetBrains Mono", monospace',
    cornerRadius: 0,
    icon: Terminal,
  },
  'gestalt-bloom': {
    id: 'gestalt-bloom',
    label: 'Gestalt Bloom',
    blurb: 'Mid-century chunky shapes · mustard, rust, deep teal',
    audience: 'Team townhall · all-hands lab meeting',
    bg: 'linear-gradient(135deg, #f4ecd4 0%, #e8dfc0 100%)',
    surface: 'rgba(10,10,10,0.05)',
    surfaceMuted: 'rgba(10,10,10,0.02)',
    ink: '#1a1208',
    inkDim: 'rgba(26,18,8,0.6)',
    rule: 'rgba(26,18,8,0.18)',
    accent: '#c8741a',
    accent2: '#2a6f6a',
    accent3: '#d4a544',
    accent4: '#8a3a2a',
    accent5: '#2a4a6a',
    textOnAccent: '#fff8ea',
    fontDisplay: '"Archivo Black", sans-serif',
    fontBody: '"DM Sans", sans-serif',
    cornerRadius: 12,
    icon: Hexagon,
  },
};

const THEME_ORDER: ReadonlyArray<ThemeId> = [
  'bold-signal', 'deep-meridian', 'spectrum', 'blueprint', 'clinic-mono', 'gestalt-bloom',
];

// =============================================================================
// CURATED BIOPHARMA DECKS
// =============================================================================

interface DeckPreset {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  readonly domain: string;
  readonly presenter: string;
  readonly defaultTheme: ThemeId;
  readonly slides: ReadonlyArray<SlideSpec>;
}

const DECK_PRESETS: ReadonlyArray<DeckPreset> = [
  {
    id: 'mtb-krasg12c',
    title: 'KRAS G12C Defense',
    subtitle: 'Adagrasib · acquired Y96C · combination logic',
    domain: 'Molecular Tumor Board · NSCLC',
    presenter: 'Thoracic MTB · Dr. K. Maroon',
    defaultTheme: 'blueprint',
    slides: [
      { kind: 'title', kicker: 'NSCLC · Stage IV · 3L', h1: 'PT-2418. Adagrasib resistance — what next.',
        meta: ['Tumor Board', 'May 2026', 'Adenocarcinoma · KRAS G12C / Y96C'],
        stamp: 'MTB · CASE 24-118', corner: 'CLIA · CAP' },
      { kind: 'verdict', kicker: 'Recommendation',
        h1: 'Switch to RMC-6236 trial arm. Hold ICI.',
        sub: 'Y96C abrogates G12C(OFF) inhibitor binding. Pan-RAS(ON) inhibition is the only molecularly coherent next step that does not require a wash-out we cannot afford.',
        cardNum: '01', cardLabel: 'Two-question gate',
        cardH3: 'Is the Y96C clonal? Is performance status compatible with NCT05379985 inclusion?',
        cardP: 'Bulk ctDNA shows VAF 18% rising from 4% across two cycles. ECOG 1, no symptomatic CNS disease.' },
      { kind: 'sdlc', kicker: 'Decision stage', h2: 'Where this case sits.',
        sub: 'Past first-line chemoimmunotherapy. Past one targeted line. Pre-trial referral. No evidence yet for transformation.',
        stages: ['1L Pembro-chemo', '2L Adagrasib', 'Progression', 'Re-biopsy', 'Trial enroll'],
        here: 3, cardH3: 'Re-biopsy returned. Decision lives in the next 14 days.',
        cardP: 'Wash-out window closes ahead of screening labs. Slot held in pulmonology for bronch if tissue is needed.' },
      { kind: 'lenses', kicker: 'Three lenses', h2: 'Molecular. Clinical. Patient.',
        sub: 'Every recommended action interrogated through all three before it leaves the room.',
        items: [
          { n: '01', h: 'Molecular',
            p: 'Y96C lies in the switch-II pocket; sotorasib and adagrasib both lose affinity. RMC-6236 binds the RAS(ON) state, agnostic to switch-II.' },
          { n: '02', h: 'Clinical',
            p: 'ORR 38% across solid tumors at 300 mg in Ph1 (KRYSTAL-equivalent dose). G3 rash 11%, manageable with prophylactic doxycycline.' },
          { n: '03', h: 'Patient',
            p: 'Patient prioritizes oral therapy and out-of-state travel < monthly. Site has remote PK monitoring.' },
        ]},
      { kind: 'kpi', kicker: 'Trial fit', h1: 'NCT05379985 · arm B',
        sub: 'Pre-screen pass rate among matched candidates over the last 90 days.',
        metrics: [
          { num: '38%', label: 'Pan-tumor ORR @ 300mg', note: 'Investigator-assessed, Ph1 update' },
          { num: '7.6 mo', label: 'Median DoR', note: 'Censored at data cutoff' },
          { num: '11%', label: 'G3+ rash', note: 'Prophylaxable' },
          { num: '< 14d', label: 'Slot to screening', note: 'Local site logistics' },
        ]},
      { kind: 'severity', kicker: 'Hazard rollup', h2: 'What can fail.',
        sub: 'Quantified against equivalent panels run on this case-mix in the prior 90 days.',
        items: [
          { lbl: 'P0', ct: '01', desc: 'Subclonal off-target mutation not yet captured by tissue NGS' },
          { lbl: 'P1', ct: '02', desc: 'Hepatic AE under RMC-6236 with concurrent acetaminophen' },
          { lbl: 'P2', ct: '03', desc: 'Slow tumor uptake of contrast in 8-week restaging CT' },
          { lbl: 'P3', ct: '04', desc: 'Insurance friction for off-label bridge if trial slot slips' },
        ]},
      { kind: 'methods', kicker: 'Controls in force', h2: 'Three orthogonal anchors before sign-out.',
        sub: 'Disagreement between anchors halts the recommendation and escalates back to the board.',
        items: [
          { num: '01', h: 'Orthogonal ctDNA', p: 'Guardant 360 confirms Y96C at VAF >5%; Tempus xT corroborates within 7 days.' },
          { num: '02', h: 'Tissue re-biopsy', p: 'Endobronchial sample at LLL nodule, FFPE, 60% tumor purity by pathologist read.' },
          { num: '03', h: 'Pharmacy bridge', p: 'Investigational pharmacy holds adagrasib continuation if screening slips by >7 days.' },
        ]},
      { kind: 'closing', kicker: 'Defense questions', h1: 'Ask the board.',
        sub: 'The questions I expect, with the artifacts I will produce in response.',
        items: [
          'Show me Y96C VAF trajectory across the last three draws.',
          'What is the trial PI\'s response on combination with cetuximab?',
          'If RMC-6236 is not accessible, what is the bridge plan?',
          'Have we ruled out small-cell transformation on path?',
        ]},
    ],
  },
  {
    id: 'adc-her2low',
    title: 'T-DXd · HER2-low and Ultralow',
    subtitle: 'Bystander payload economics · DESTINY-Breast06 readout',
    domain: 'Breast oncology · ADC mechanism',
    presenter: 'Translational ADC working group',
    defaultTheme: 'deep-meridian',
    slides: [
      { kind: 'title', kicker: 'Antibody-Drug Conjugate · DESTINY-Breast06', h1: 'Trastuzumab deruxtecan beyond HER2+.',
        meta: ['ADC WG', 'May 2026', 'HER2-low · HER2-ultralow · HR+/HER2−'],
        stamp: 'T-DXd · 5.4 mg/kg', corner: 'AstraZeneca · Daiichi Sankyo' },
      { kind: 'verdict', kicker: 'The verdict',
        h1: 'HER2-low is no longer a stratifier. It is a therapeutic class.',
        sub: 'DESTINY-Breast06 extends benefit to IHC 0 with FISH-negative ultralow expression, recasting the diagnostic question from "is it HER2+?" to "is there any HER2 signal at all?".',
        cardNum: '01', cardLabel: 'Two questions',
        cardH3: 'Where is the IHC reproducibility floor? What pathology infrastructure must scale?',
        cardP: 'A 1+ vs 0 call drives a treatment decision. Inter-reader concordance at the 0/1+ boundary remains the weakest link.' },
      { kind: 'lenses', kicker: 'Three lenses', h2: 'Payload. Antibody. Linker.',
        sub: 'Why T-DXd outperforms first-generation HER2 ADCs in the low-expression setting.',
        items: [
          { n: '01', h: 'Payload (DXd)', p: 'Topoisomerase I inhibitor, membrane-permeable, drives the bystander effect that reaches HER2-negative neighbors.' },
          { n: '02', h: 'Antibody (trastuzumab)', p: 'Validated binder; the question is internalization efficiency at sub-amplified expression levels.' },
          { n: '03', h: 'Linker (cleavable tetrapeptide)', p: 'DAR ~8 with stable plasma circulation and tumor-selective cleavage.' },
        ]},
      { kind: 'kpi', kicker: 'DESTINY-Breast06 headline', h1: 'PFS 13.2 vs 8.1 months',
        sub: 'HR+/HER2-low or ultralow after one prior endocrine line. HR 0.62.',
        metrics: [
          { num: '13.2 mo', label: 'mPFS T-DXd', note: 'Investigator-assessed' },
          { num: '8.1 mo',  label: 'mPFS chemo', note: 'Physician\'s choice' },
          { num: '0.62',    label: 'Hazard ratio', note: '95% CI 0.51–0.74' },
          { num: '11.3%',   label: 'G3+ ILD',     note: 'Pneumonitis remains the watch' },
        ]},
      { kind: 'severity', kicker: 'Safety rollup', h2: 'Manage the bystander, manage the lung.',
        sub: 'Top-of-mind AEs from real-world post-marketing surveillance.',
        items: [
          { lbl: 'P0', ct: '01', desc: 'Drug-induced ILD — interrupt, steroid, do not rechallenge G≥2' },
          { lbl: 'P1', ct: '02', desc: 'Severe nausea — triplet antiemetic premedication required' },
          { lbl: 'P2', ct: '03', desc: 'Cytopenias — neutropenia G3+ in ~15%' },
          { lbl: 'P3', ct: '04', desc: 'Alopecia, fatigue — quality-of-life counseling' },
        ]},
      { kind: 'methods', kicker: 'IHC scoring discipline', h2: 'Calibrate the diagnostic before scaling treatment.',
        sub: 'Three orthogonal practices to keep HER2-low/ultralow calls reproducible.',
        items: [
          { num: '01', h: 'Dual scoring', p: 'Two-pathologist concordance required at the 0/1+ boundary; arbitration by a third for discordant cases.' },
          { num: '02', h: 'Control TMA', p: 'Each batch carries a known HER2-low calibrator slide; staining intensity logged.' },
          { num: '03', h: 'Quantitative IHC', p: 'Where available, digital pathology with continuous scoring (HER2-CONNECT, QuantHER) supplements categorical calls.' },
        ]},
      { kind: 'timeline', kicker: 'Where this fits', h2: 'Treatment sequencing in HR+/HER2-low.',
        sub: 'A working algorithm pending NCCN incorporation.',
        milestones: [
          { date: '1L',  label: 'CDK4/6 + AI', note: 'Standard endocrine + abemaciclib / ribociclib / palbociclib' },
          { date: '2L',  label: 'ESR1 → elacestrant', note: 'If ESR1-mut; otherwise capivasertib + fulvestrant if AKT pathway altered' },
          { date: '3L',  label: 'T-DXd', note: 'DESTINY-Breast06 frames this as the preferred ADC for HER2-low/ultralow' },
          { date: '4L+', label: 'Sacituzumab govitecan', note: 'Trop-2 ADC, ASCENT signal preserved post-T-DXd' },
        ]},
      { kind: 'closing', kicker: 'Open questions', h1: 'For the working group.',
        sub: 'What we owe each other before the next call.',
        items: [
          'Define the IHC ultralow operational threshold our lab will adopt.',
          'Pneumonitis monitoring cadence in patients with baseline ILA.',
          'How early do we sequence T-DXd in HER2-low TNBC?',
          'Re-biopsy policy: when does HER2 status get re-checked across lines?',
        ]},
    ],
  },
  {
    id: 'cart-toxicity',
    title: 'CAR-T Toxicity Protocol',
    subtitle: 'CRS · ICANS · HLH-like · the first 30 days',
    domain: 'Cell therapy · Hematology',
    presenter: 'Cell Therapy Service · ICU consult',
    defaultTheme: 'spectrum',
    slides: [
      { kind: 'title', kicker: 'BCMA · ide-cel & cilta-cel · CD19', h1: 'CAR-T cytokine biology, mapped to the bedside.',
        meta: ['Cell Therapy', 'May 2026', 'ASTCT grading · tocilizumab · steroids · anakinra'],
        stamp: 'D0 → D30', corner: 'INPATIENT' },
      { kind: 'verdict', kicker: 'Operating posture',
        h1: 'Grade early. Treat through the grade. Do not chase fever with antibiotics alone.',
        sub: 'CRS is a clinical syndrome with a cytokine signature, not a culture-defined infection. Time-to-tocilizumab is the variable our service most reliably controls.',
        cardNum: '01', cardLabel: 'Two questions on admission',
        cardH3: 'When was the infusion? Has the patient had a fever within 6 hours?',
        cardP: 'Those two answers route the entire first 12 hours of management.' },
      { kind: 'sdlc', kicker: 'Trajectory', h2: 'A typical post-infusion arc.',
        sub: 'Median onset windows are guides, not contracts — outliers exist and define the service standard.',
        stages: ['D0 infuse', 'D1–3 fever', 'D3–7 CRS peak', 'D5–14 ICANS', 'D14–30 cytopenias'],
        here: 2,
        cardH3: 'Day 5 is the cliff. ICANS rises as CRS resolves.',
        cardP: 'Steroid escalation policy diverges between ide-cel and cilta-cel — service must internalize both.' },
      { kind: 'severity', kicker: 'ASTCT grading', h2: 'CRS, four grades.',
        sub: 'The grade drives the agent. Do not improvise the order.',
        items: [
          { lbl: 'G1', ct: '01', desc: 'Fever ≥ 38°C, no hypotension, no hypoxia — supportive + acetaminophen' },
          { lbl: 'G2', ct: '02', desc: 'Hypotension responsive to fluids OR low-flow O₂ — tocilizumab 8 mg/kg' },
          { lbl: 'G3', ct: '03', desc: 'Pressors OR high-flow O₂ — toci + dexamethasone 10 mg q6h' },
          { lbl: 'G4', ct: '04', desc: 'Multiple pressors OR positive-pressure ventilation — methylpred 1 g, anakinra' },
        ]},
      { kind: 'lenses', kicker: 'Three lenses', h2: 'Cytokine. Endothelium. Brain.',
        sub: 'The biology behind the protocol — why we choose what we choose.',
        items: [
          { n: '01', h: 'Cytokine storm',  p: 'IL-6 from monocyte/macrophage activation; tocilizumab blocks the receptor without depleting CAR-T cells.' },
          { n: '02', h: 'Endotheliopathy', p: 'Capillary leak, ferritin spike, fibrinogen drop — overlapping with HLH-like physiology; consider anakinra early.' },
          { n: '03', h: 'Neurotoxicity',   p: 'ICE score nightly. Subclinical edema on MRI predates clinical deterioration in cilta-cel cases.' },
        ]},
      { kind: 'methods', kicker: 'Standing orders', h2: 'Three reflexes the service rehearses.',
        sub: 'Every cell-therapy patient gets these the moment they\'re flagged for fever.',
        items: [
          { num: '01', h: 'Cytokine panel', p: 'IL-6, IL-10, IFN-γ, ferritin, CRP, fibrinogen, LDH on every fever spike.' },
          { num: '02', h: 'ICE q-shift',    p: 'Bedside ICE score every nursing shift through D14; <7 escalates to neurology.' },
          { num: '03', h: 'Toci on the unit',p: 'Two doses dispensed to the floor at admission so the second-dose decision is bedside, not pharmacy.' },
        ]},
      { kind: 'closing', kicker: 'Service questions', h1: 'For the next QI review.',
        sub: 'The metrics we are committing to track and the changes we are committing to test.',
        items: [
          'Median fever-to-tocilizumab time, by product and by shift.',
          'Subclinical MRI changes preceding ICANS — yield vs. cost.',
          'Anakinra timing in cilta-cel — early vs. salvage.',
          'Discharge criteria post-ICANS resolution — are we discharging too late?',
        ]},
    ],
  },
  {
    id: 'aav-cmc',
    title: 'AAV CMC Defensibility',
    subtitle: 'Capsid integrity · empty:full · potency assay',
    domain: 'Gene therapy · CMC',
    presenter: 'Process Sciences · Tech Ops',
    defaultTheme: 'clinic-mono',
    slides: [
      { kind: 'title', kicker: 'Recombinant AAV9 · scale-up', h1: 'CMC defense, scale-up cohort 24.',
        meta: ['Tech Ops', 'May 2026', 'rAAV9 · serotype 9 · 1×10¹⁴ vg/kg'],
        stamp: 'BATCH B24-11', corner: 'PHASE 3 SUPPLY' },
      { kind: 'verdict', kicker: 'Posture',
        h1: 'Material is releasable. Two methods need a pre-submission alignment.',
        sub: 'Empty:full ratio by AUC sits within spec. The potency assay re-qualification has open observations from the agency that we will pre-empt with a Type C meeting.',
        cardNum: '01', cardLabel: 'Two questions',
        cardH3: 'Is the bioassay matrix the right surrogate for dystrophin restoration in vivo? Is the cell line drift documented?',
        cardP: 'The agency has telegraphed an interest in both. Address before we are asked.' },
      { kind: 'kpi', kicker: 'Lot release dashboard', h1: 'Batch B24-11 metrics',
        sub: 'All within spec; flagged values italicized.',
        metrics: [
          { num: '78%',  label: 'Full capsid (AUC)',     note: 'spec ≥ 70%' },
          { num: '1.2%', label: 'Aggregates (SEC-MALS)', note: 'spec ≤ 5%' },
          { num: '< LOD',label: 'Residual HCP',          note: 'ELISA — Sf9' },
          { num: '92%',  label: 'Potency (relative)',    note: 'spec 70–130%' },
        ]},
      { kind: 'severity', kicker: 'Risk rollup', h2: 'What the inspector will ask.',
        sub: 'Pre-rehearsed responses, in plain English, with the data citation.',
        items: [
          { lbl: 'P0', ct: '01', desc: 'Potency assay matrix relevance to in vivo dystrophin endpoint' },
          { lbl: 'P1', ct: '02', desc: 'Cell line authentication cadence for the producer line' },
          { lbl: 'P2', ct: '03', desc: 'Empty:full method bridging from AUC to mass-photometry' },
          { lbl: 'P3', ct: '04', desc: 'Comparability after the column-chromatography swap in B24-08' },
        ]},
      { kind: 'methods', kicker: 'Analytical control strategy', h2: 'Three orthogonal capsid measurements.',
        sub: 'No single method tells the whole story; the agreement among methods is the story.',
        items: [
          { num: '01', h: 'Analytical ultracentrifugation', p: 'Gold standard for empty:full; sedimentation velocity separates partial and full capsids.' },
          { num: '02', h: 'Mass photometry', p: 'Single-particle MW distribution; cross-checks AUC on every lot since Q2.' },
          { num: '03', h: 'Cryo-EM (lot-pilot)', p: 'Quarterly visual confirmation of capsid integrity at < 4 Å resolution.' },
        ]},
      { kind: 'cost', kicker: 'Cost of a hold', h2: 'Time · Material · Trust · Inspection.',
        sub: 'A clinical hold on a single batch reverberates across the cohort.',
        items: [
          { h: 'Time',       p: 'Patient enrollment pauses for 11 weeks median while replacement material is manufactured and tested.' },
          { h: 'Material',   p: 'A failed lot at scale represents ~$3.8M in raw material, plant time, and analytical re-runs.' },
          { h: 'Trust',      p: 'Investigator sites delay screening; lost trust takes 2–3 quarters to fully recover.' },
          { h: 'Inspection', p: 'A repeat observation triggers an enhanced review on the next BLA supplement.' },
        ]},
      { kind: 'closing', kicker: 'Pre-meeting questions', h1: 'For the Type C agenda.',
        sub: 'The four items we want acknowledgement on before we submit.',
        items: [
          'Bioassay surrogate adequacy for the in vivo endpoint.',
          'Cell line drift documentation cadence post-MCB qualification.',
          'Mass-photometry as a release method, AUC retained as orthogonal.',
          'Comparability protocol after the chromatography column swap.',
        ]},
    ],
  },
  {
    id: 'accelerated-approval',
    title: 'Accelerated Approval Defense',
    subtitle: 'Confirmatory trial design · Subpart H commitments',
    domain: 'Regulatory · clinical strategy',
    presenter: 'Regulatory Affairs · Clinical Lead',
    defaultTheme: 'gestalt-bloom',
    slides: [
      { kind: 'title', kicker: 'Subpart H · post-marketing', h1: 'Accelerated approval, with conviction.',
        meta: ['Reg Affairs', 'May 2026', 'Surrogate endpoint · ORR · DoR'],
        stamp: 'CONFIRMATORY', corner: 'PMR · 506(c)' },
      { kind: 'verdict', kicker: 'Position',
        h1: 'The surrogate stood up. The confirmatory must outlive the noise.',
        sub: 'Accelerated approval based on ORR. The PMR is now the asset — we propose a confirmatory design that survives the FORCE-style scrutiny applied to recent withdrawals.',
        cardNum: '01', cardLabel: 'Two questions for the steering committee',
        cardH3: 'Will the confirmatory study read out before the post-marketing requirement deadline? Does the comparator reflect the standard of care that will exist at readout, not today?',
        cardP: 'Both questions were the proximate cause of two recent accelerated-approval withdrawals. We answer them before they\'re asked.' },
      { kind: 'lenses', kicker: 'Three lenses', h2: 'Endpoint. Comparator. Population.',
        sub: 'The three knobs the agency turns. We propose specific positions for each.',
        items: [
          { n: '01', h: 'Endpoint',    p: 'PFS as primary; OS as key secondary, powered for non-inferiority floor. Avoid OS as primary in a setting where crossover is ethically inevitable.' },
          { n: '02', h: 'Comparator',  p: 'Investigator\'s choice from a pre-specified list, refreshed annually as standards shift.' },
          { n: '03', h: 'Population',  p: 'Enroll into the indication granted, with stratification by biomarker subgroups defined a priori.' },
        ]},
      { kind: 'kpi', kicker: 'Confirmatory study metrics', h1: 'CONFIRM-2 study at a glance',
        sub: 'Operational targets and pre-specified analyses.',
        metrics: [
          { num: '470',  label: 'Planned enrollment', note: '1:1 randomization' },
          { num: 'PFS',  label: 'Primary endpoint',   note: 'BICR-assessed' },
          { num: '0.70', label: 'HR target',          note: '90% power at α=0.025' },
          { num: 'Q4-27',label: 'Topline readout',    note: 'Within PMR window' },
        ]},
      { kind: 'severity', kicker: 'Withdrawal-mode prevention', h2: 'What sinks confirmatory studies.',
        sub: 'Patterns from the last decade of withdrawn accelerated approvals.',
        items: [
          { lbl: 'P0', ct: '01', desc: 'Comparator obsolescence by readout date' },
          { lbl: 'P1', ct: '02', desc: 'Underpowered subgroups that drove approval signal' },
          { lbl: 'P2', ct: '03', desc: 'Crossover eroding OS interpretability' },
          { lbl: 'P3', ct: '04', desc: 'Site mix dominated by sites who already use the drug commercially' },
        ]},
      { kind: 'methods', kicker: 'Trial discipline', h2: 'Three commitments embedded in the protocol.',
        sub: 'Each one addresses a known failure mode in confirmatory design.',
        items: [
          { num: '01', h: 'Pre-specified subgroup analyses', p: 'Locked in the protocol; no fishing post-hoc.' },
          { num: '02', h: 'Independent BICR',                p: 'Blinded independent central review for the primary endpoint.' },
          { num: '03', h: 'Real-world arm registry',         p: 'A parallel external control built from registry data, used as supportive context only.' },
        ]},
      { kind: 'closing', kicker: 'Open with the agency', h1: 'Type C agenda.',
        sub: 'The four alignment items we propose for the next interaction.',
        items: [
          'Comparator refresh mechanism through study lifetime.',
          'BICR vs investigator-assessed disagreement adjudication.',
          'Subgroup powering — biomarker-positive vs. all-comers.',
          'Real-world data submission package format and timing.',
        ]},
    ],
  },
  {
    id: 'ctdna-mrd',
    title: 'ctDNA · MRD Post-Resection',
    subtitle: 'Surveillance cadence · tumor-informed vs. agnostic',
    domain: 'Oncology · liquid biopsy',
    presenter: 'GI Oncology · liquid biopsy WG',
    defaultTheme: 'bold-signal',
    slides: [
      { kind: 'title', kicker: 'Stage II–III colorectal · adjuvant question', h1: 'ctDNA MRD — escalate or de-escalate?',
        meta: ['GI Onc WG', 'May 2026', 'Tumor-informed assays · 8-week post-op cadence'],
        stamp: 'MRD COHORT', corner: 'CRC · adjuvant' },
      { kind: 'verdict', kicker: 'Operating principle',
        h1: 'MRD-positive escalates. MRD-negative does not de-escalate — yet.',
        sub: 'DYNAMIC and COBRA validate escalation. The de-escalation arm of CIRCULATE-NORTH still requires confirmation before MRD-negativity becomes a license to skip adjuvant chemo.',
        cardNum: '01', cardLabel: 'Two questions',
        cardH3: 'Is the assay tumor-informed? What is the post-surgical timing relative to landmark?',
        cardP: 'Both drive sensitivity at the clinically actionable detection limit.' },
      { kind: 'methods', kicker: 'Assay choice', h2: 'Three live design choices.',
        sub: 'The biology dictates the operating range; assay design must follow.',
        items: [
          { num: '01', h: 'Tumor-informed',  p: 'Whole-exome sequencing of the resected tumor seeds a bespoke panel of patient-specific variants. Sensitivity at < 0.01% VAF.' },
          { num: '02', h: 'Tumor-agnostic',  p: 'Fixed panel; lower sensitivity but faster turnaround, useful when tumor tissue is exhausted.' },
          { num: '03', h: 'Methylation overlay', p: 'Fragmentomics + methylation calls complement variant detection in low-shedding tumors.' },
        ]},
      { kind: 'kpi', kicker: 'Cohort performance', h1: 'DYNAMIC + COBRA snapshot',
        sub: 'Recurrence-free survival difference at 24 months, MRD-positive vs negative.',
        metrics: [
          { num: '38%',  label: 'RFS · MRD-positive', note: 'No adjuvant' },
          { num: '92%',  label: 'RFS · MRD-negative', note: 'No adjuvant' },
          { num: '0.21', label: 'HR for recurrence',  note: 'MRD− vs MRD+' },
          { num: '4 wk', label: 'Landmark window',     note: 'Post-op draw' },
        ]},
      { kind: 'timeline', kicker: 'Surveillance schedule', h2: 'Twelve months of cadence.',
        sub: 'Operational defaults; case-by-case modification permitted.',
        milestones: [
          { date: 'Wk 4',  label: 'Landmark draw',     note: 'Establish post-op baseline; results in 14 days' },
          { date: 'Wk 12', label: 'First surveillance',note: 'If MRD+ at landmark, escalate; if MRD−, continue surveillance' },
          { date: 'Wk 24', label: 'Imaging + ctDNA',   note: 'CT chest/abd/pelvis + ctDNA draw paired' },
          { date: 'Wk 52', label: 'One-year review',   note: 'Survivorship handoff or oncologic continuation' },
        ]},
      { kind: 'severity', kicker: 'Where MRD misleads', h2: 'Failure modes to label upfront.',
        sub: 'Patients deserve a clear statement of what the test does not see.',
        items: [
          { lbl: 'P0', ct: '01', desc: 'Low-shedding tumor — false negative at landmark' },
          { lbl: 'P1', ct: '02', desc: 'Clonal hematopoiesis interference with WBC-derived variants' },
          { lbl: 'P2', ct: '03', desc: 'Sample-prep contamination from operative-room handling' },
          { lbl: 'P3', ct: '04', desc: 'Insurance non-coverage for serial draws' },
        ]},
      { kind: 'closing', kicker: 'Working-group decisions', h1: 'Items we close this quarter.',
        sub: 'Each one converts a clinical gestalt into a protocol line.',
        items: [
          'Standardize on tumor-informed for stage II–III; tumor-agnostic for exhausted-tissue cases.',
          'Establish a CH-aware analysis pipeline with paired WBC subtraction.',
          'Refer all MRD+ patients to the recurrence-prevention trial registry.',
          'Add patient counseling sheet that names false-negative possibility explicitly.',
        ]},
    ],
  },
  {
    id: 'biomarker-strat',
    title: 'Biomarker Stratification Standards',
    subtitle: 'PD-L1 · MSI-H · HRD · TMB · ctDNA — the operational reality',
    domain: 'Translational pathology',
    presenter: 'Translational Medicine · Biomarker steering',
    defaultTheme: 'blueprint',
    slides: [
      { kind: 'title', kicker: 'Biomarker discipline', h1: 'Stratify well. Treat well.',
        meta: ['Translational Medicine', 'May 2026', 'IHC · NGS · methylation'],
        stamp: 'STRATIFY', corner: 'CDx · LDT' },
      { kind: 'verdict', kicker: 'Position',
        h1: 'A biomarker without a discontinuation rule is decoration.',
        sub: 'Every biomarker our service adopts ships with three artifacts: a positivity threshold, a re-test cadence, and a discontinuation criterion. Without all three, the marker generates traffic instead of decisions.',
        cardNum: '01', cardLabel: 'Two questions',
        cardH3: 'Who owns the threshold? Who owns the re-test cadence?',
        cardP: 'If the answers are different people, the protocol drifts within a quarter.' },
      { kind: 'lenses', kicker: 'Three lenses', h2: 'Analytic. Clinical. Operational.',
        sub: 'A biomarker that passes all three lenses earns a place in the order set.',
        items: [
          { n: '01', h: 'Analytic',   p: 'Reproducibility, dynamic range, pre-analytic robustness. The thing you can measure tomorrow on a fresh draw.' },
          { n: '02', h: 'Clinical',   p: 'Effect size at the threshold, validated in a population you treat. Not the average — the marginal patient.' },
          { n: '03', h: 'Operational',p: 'Turn-around time compatible with the decision deadline. A 21-day result on a 14-day treatment decision is decorative.' },
        ]},
      { kind: 'severity', kicker: 'Marker-by-marker rollup', h2: 'Where the failure modes cluster.',
        sub: 'A snapshot from the last 90 days of marker-driven treatment decisions.',
        items: [
          { lbl: 'P0', ct: '01', desc: 'PD-L1 CPS at the 1/10 boundary — inter-lab discordance' },
          { lbl: 'P1', ct: '02', desc: 'HRD score variant — Myriad vs FoundationOne calls disagree at 42 cutoff' },
          { lbl: 'P2', ct: '03', desc: 'TMB unit reporting — mutations/Mb vs. raw count drift' },
          { lbl: 'P3', ct: '04', desc: 'MSI-H by PCR vs. NGS — concordance excellent but reporting cadence differs' },
        ]},
      { kind: 'kpi', kicker: 'This-quarter performance', h1: 'Marker → decision conversion',
        sub: 'How often a marker result actually changed the recommended treatment.',
        metrics: [
          { num: '71%', label: 'PD-L1 → ICI add', note: '≥CPS 10' },
          { num: '88%', label: 'MSI-H → ICI 1L',  note: 'dMMR confirmed' },
          { num: '52%', label: 'HRD → PARPi',     note: 'Ovarian platinum-sensitive' },
          { num: '39%', label: 'TMB-H → ICI',     note: 'Tissue-agnostic indication' },
        ]},
      { kind: 'methods', kicker: 'Three reflexes', h2: 'Practices that prevent drift.',
        sub: 'Each addresses a class of reproducibility failure.',
        items: [
          { num: '01', h: 'Lab-to-lab calibration', p: 'Quarterly exchange of TMAs and synthetic cell lines across partner labs.' },
          { num: '02', h: 'Threshold lock',         p: 'Single source-of-truth threshold per biomarker, owned by the medical director.' },
          { num: '03', h: 'Discontinuation rule',   p: 'Every biomarker ships with the criterion under which we stop ordering it.' },
        ]},
      { kind: 'closing', kicker: 'Steering committee', h1: 'Decisions we close.',
        sub: 'The agenda for the next stratification committee meeting.',
        items: [
          'Adopt CPS ≥ 10 for the platinum-eligible cohort; revisit at year-end.',
          'Standardize HRD reporting unit across vendors.',
          'Add a discontinuation rule for TMB-H ordering in adenocarcinomas.',
          'Tie marker re-test cadence to disease-specific NCCN updates.',
        ]},
    ],
  },
  {
    id: 'lims-build-vs-buy',
    title: 'LIMS Build-vs-Buy',
    subtitle: 'Pilot 001 · LabVantage vs STARLIMS vs keep-and-extend',
    domain: 'Platform Engineering · Lab Informatics',
    presenter: 'Informatics Steering · Pilot 001',
    defaultTheme: 'blueprint',
    slides: [
      { kind: 'title', kicker: 'Lab Informatics · Enterprise LIMS', h1: 'Build, buy, or extend the specimen backbone.',
        meta: ['Informatics Steering', 'Q2 2026', 'GxP · CLIA · 21 CFR Part 11 · HIPAA'],
        stamp: 'PILOT-001', corner: 'BUILD vs BUY' },
      { kind: 'verdict', kicker: 'Recommendation',
        h1: 'Buy leads — but the race is close. Pilot two, decide on interfacing.',
        sub: 'LabVantage (81) and STARLIMS (79) are in a dead heat on the weighted rubric; the buy path leads keep-and-extend on total capability but not on cost. The deciding axis is enterprise interfacing (LIS/HL7/FHIR) and configurability without custom code.',
        cardNum: '01', cardLabel: 'Two-question gate',
        cardH3: 'Does the platform meet Part 11 out of the box? Can it interface our LIS/EHR without a bespoke engine?',
        cardP: 'Both shortlist leaders clear audit-trail and e-signature natively. The separation shows up in FHIR R4 maturity and configuration-vs-code for workflows.' },
      { kind: 'sdlc', kicker: 'Where we are', h2: 'Eleven candidates, shortlist of five.',
        sub: 'Screened 11 platforms across 10 evaluation dimensions; five advanced to scored pilot; two advance to hands-on bake-off.',
        stages: ['Longlist 11', 'Shortlist 5', 'Scored pilot', 'Bake-off 2', 'Decision'],
        here: 2, cardH3: 'The scored pilot is complete. Two finalists advance to a hands-on bake-off.',
        cardP: 'Decision gate is a live specimen round-trip: accession → wet-lab QC → sequencing link → result release, measured against our own SLAs.' },
      { kind: 'lenses', kicker: 'Three lenses', h2: 'Compliance. Interfacing. Configurability.',
        sub: 'Every candidate interrogated through the three axes that actually separated the field.',
        items: [
          { n: '01', h: 'Compliance',
            p: 'GxP validation package, CLIA workflow coverage, 21 CFR Part 11 audit trail + e-signature, HIPAA controls. Table stakes — but validation effort varies 3x.' },
          { n: '02', h: 'Interfacing',
            p: 'LIS/EHR connectivity, HL7 v2, FHIR R4, ASTM analyzer links. This is where the leaders separate: FHIR R4 maturity is uneven across vendors.' },
          { n: '03', h: 'Configurability',
            p: 'Workflow, sample lifecycle, and report changes by configuration vs. custom code. Determines total cost of ownership more than license price.' },
        ]},
      { kind: 'kpi', kicker: 'Weighted scorecard', h1: 'Buy path leads on capability',
        sub: 'Composite score across ten dimensions (sample lifecycle, workflow, instrument integration, ELN, QA, stability, inventory, reporting, audit, RBAC).',
        metrics: [
          { num: '81', label: 'LabVantage', note: 'buy · leader' },
          { num: '79', label: 'STARLIMS',   note: 'buy · dead heat' },
          { num: '68', label: 'Keep + extend', note: 'lowest TCO' },
          { num: '54', label: 'Build in-house', note: 'highest risk' },
        ]},
      { kind: 'cost', kicker: 'Five-year TCO', h2: 'License is not the cost. Ownership is.',
        sub: 'Fully-loaded five-year total cost including validation, integration, and run.',
        items: [
          { h: 'Keep-and-extend · $2.13M', p: 'Lowest cash outlay, but caps out on interfacing and carries validation debt on the existing stack.' },
          { h: 'LabVantage (buy) · $4.05M', p: 'Highest capability, strongest FHIR R4 story, configuration-first. Validation package shortens qualification.' },
          { h: 'Build in-house · $5.95M', p: 'Most control, highest risk. Re-creates audit-trail, e-signature, and interfacing we can buy validated.' },
          { h: 'Cost of a bad hold', p: 'A release gate that cannot two-person-sign in the tool becomes a manual process — the hidden cost that dwarfs license delta.' },
        ]},
      { kind: 'methods', kicker: 'Feature matrix', h2: 'Twelve capabilities, scored head-to-head.',
        sub: 'The dimensions that carried the most weight in the rubric.',
        items: [
          { num: '01', h: 'Sample lifecycle + workflow', p: 'Accession → extraction → library → sequencing → secondary → review → release, modeled as configurable states.' },
          { num: '02', h: 'Audit trail + e-signature',   p: '21 CFR Part 11 immutable audit, two-person review-release, and reason-for-change capture, native — not bolted on.' },
          { num: '03', h: 'Interfacing + RBAC',          p: 'HL7 v2 / FHIR R4 / ASTM plus role-based access with clearance ceilings and consent propagation from the Consent Registry.' },
        ]},
      { kind: 'severity', kicker: 'Risk rollup', h2: 'What the steering committee must weigh.',
        sub: 'Ranked by impact on the specimen backbone and clinical release path.',
        items: [
          { lbl: 'P0', ct: '01', desc: 'FHIR R4 maturity gap — one finalist requires a custom mapping layer for DiagnosticReport' },
          { lbl: 'P1', ct: '02', desc: 'Validation debt on keep-and-extend blocks GxP promotion' },
          { lbl: 'P2', ct: '03', desc: 'Configuration-vs-code drift inflates five-year TCO if custom workflows accrue' },
          { lbl: 'P3', ct: '04', desc: 'Consent propagation — hold semantics must be first-class, not a report filter' },
        ]},
      { kind: 'closing', kicker: 'Steering decisions', h1: 'What we close this quarter.',
        sub: 'The agenda for the platform steering committee.',
        items: [
          'Advance LabVantage and STARLIMS to a hands-on specimen round-trip bake-off.',
          'Weight enterprise interfacing (FHIR R4) and configuration-first as the deciding axes.',
          'Require native two-person review-release and consent-hold semantics in the bake-off script.',
          'Bring five-year TCO — not license price — to the final vote.',
        ]},
    ],
  },
];

// =============================================================================
// SLIDE RENDERERS — one per kind. All read from theme via CSS vars set on the
// slide element, so swapping themes is a tokens swap and a re-render.
// =============================================================================

const BAND_META: Record<Band, { label: string; icon: typeof Layers; blurb: string }> = {
  source:     { label: 'SOURCE-BANDED',     icon: Layers,       blurb: 'Raw lineage — instruments, capture, chain of custody' },
  scientific: { label: 'SCIENTIFIC-BANDED', icon: FlaskConical, blurb: 'Method, controls, statistics, biological reasoning' },
  visual:     { label: 'VISUAL-BANDED',     icon: Sparkles,     blurb: 'Plots, gels, IGV captures, plate maps' },
  exec:       { label: 'EXECUTIVE-BANDED',  icon: Shield,       blurb: 'Defense narrative — for board, regulator, sponsor' },
};

function bandColor(band: Band, theme: Theme): string {
  switch (band) {
    case 'source':     return theme.accent;
    case 'scientific': return theme.accent2;
    case 'visual':     return theme.accent3;
    case 'exec':       return theme.accent4;
  }
}

function bandOf(a: Artifact): Band {
  if (a.type === 'yaml' || a.type === 'json') return 'source';
  if (a.type === 'markdown') return 'exec';
  if (a.type === 'svg' || a.type === 'png') return 'visual';
  return 'scientific';
}

interface ShellProps {
  theme: Theme;
  num: string;
  total: number;
  accentVar?: string;
  children: ReactNode;
  footL?: string;
}

function SlideShell({ theme, num, total, accentVar, children, footL = 'DEFENSE BRIEF' }: ShellProps) {
  const accent = accentVar ?? theme.accent;
  return (
    <section
      data-slide
      className="presentation-slide grid"
      style={{
        minHeight: 'var(--presentation-page-height, 100dvh)',
        gridTemplateColumns: '1fr 1fr',
        gridTemplateRows: 'auto 1fr auto',
        gap: '2rem',
        padding: 'clamp(1.5rem, 4vw, 4rem)',
        background: theme.bg,
        color: theme.ink,
        fontFamily: theme.fontBody,
        scrollSnapAlign: 'start',
        position: 'relative',
        ['--accent' as any]: accent,
        ['--ink' as any]: theme.ink,
        ['--ink-dim' as any]: theme.inkDim,
        ['--rule' as any]: theme.rule,
        ['--surface' as any]: theme.surface,
      }}
    >
      {theme.slideOverlay && (
        <div aria-hidden style={{
          position: 'absolute', inset: 0, background: theme.slideOverlay,
          pointerEvents: 'none', opacity: 0.8,
        }} />
      )}
      <div className="reveal" style={{ fontFamily: theme.fontDisplay, letterSpacing: '0.08em', position: 'relative' }}>
        {num}
      </div>
      <div className="reveal flex justify-end gap-8 uppercase" style={{
        fontSize: '0.78rem', letterSpacing: '0.16em', color: theme.inkDim, position: 'relative',
      }}>
        <span style={{ color: theme.ink }}>{footL}</span>
      </div>

      {children}

      <div className="reveal flex justify-between items-center uppercase" style={{
        gridColumn: '1 / -1', paddingTop: '1rem',
        borderTop: `1px solid ${theme.rule}`,
        fontSize: '0.78rem', letterSpacing: '0.16em', color: theme.inkDim, fontWeight: 500, position: 'relative',
      }}>
        <span>{footL}</span>
        <span>{num} / {String(total).padStart(2, '0')}</span>
      </div>
    </section>
  );
}

function TitleSide({ theme, kicker, h1, h2, sub }: { theme: Theme; kicker: string; h1?: string; h2?: string; sub?: string }) {
  return (
    <div className="reveal flex flex-col justify-end pr-4" style={{ position: 'relative' }}>
      <p className="uppercase mb-4" style={{
        fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.22em', color: 'var(--accent)',
      }}>
        {kicker}
      </p>
      {h1 && <h1 style={{
        fontFamily: theme.fontDisplay, fontSize: 'clamp(2rem, 6vw, 5.5rem)',
        lineHeight: 0.92, letterSpacing: '-0.02em', maxWidth: '14ch', color: theme.ink,
      }}>{h1}</h1>}
      {h2 && <h2 style={{
        fontFamily: theme.fontDisplay, fontSize: 'clamp(1.5rem, 3.8vw, 3rem)',
        lineHeight: 0.98, letterSpacing: '-0.01em', maxWidth: '18ch', color: theme.ink,
      }}>{h2}</h2>}
      {sub && <p style={{ marginTop: '1rem', fontSize: '1rem', maxWidth: '48ch', color: theme.inkDim }}>{sub}</p>}
    </div>
  );
}

function BoldCard({
  theme, bg, num, label, h3, p, light = false,
}: { theme: Theme; bg: string; num: string; label: string; h3: string; p: string; light?: boolean }) {
  const textColor = light ? 'var(--presentation-on-emphasis, #fff)' : theme.textOnAccent;
  return (
    <div className="reveal flex flex-col justify-center items-stretch" style={{ position: 'relative' }}>
      <div style={{
        background: bg, color: textColor,
        padding: 'clamp(1.25rem, 2.5vw, 2.5rem)',
        borderRadius: theme.cornerRadius, minHeight: '60%',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ fontFamily: theme.fontDisplay, fontSize: 'clamp(3rem, 8vw, 8rem)', lineHeight: 0.85, letterSpacing: '-0.04em' }}>
          {num}
        </div>
        <div className="uppercase" style={{
          fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.18em', marginTop: '0.5rem', opacity: 0.85,
        }}>{label}</div>
        <h3 style={{
          fontFamily: theme.fontDisplay, fontSize: 'clamp(1.1rem, 2vw, 1.8rem)',
          lineHeight: 1.05, marginTop: '1.25rem', maxWidth: '24ch', letterSpacing: '-0.01em',
        }}>{h3}</h3>
        <p style={{ fontWeight: 500, fontSize: '1rem', marginTop: '0.75rem', lineHeight: 1.5, maxWidth: '42ch' }}>
          {p}
        </p>
      </div>
    </div>
  );
}

function renderSlide(spec: SlideSpec, theme: Theme, num: string, total: number): ReactNode {
  switch (spec.kind) {
    case 'title': return (
      <section
        data-slide
        className="presentation-slide presentation-slide--title relative"
        style={{
          minHeight: 'var(--presentation-page-height, 100dvh)', padding: 'clamp(1.5rem, 4vw, 4rem)',
          background: theme.bg, color: theme.ink, scrollSnapAlign: 'start',
          display: 'grid', gridTemplateRows: 'auto 1fr auto', gap: '2rem',
          fontFamily: theme.fontBody, ['--accent' as any]: theme.accent,
        }}
      >
        {theme.slideOverlay && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: theme.slideOverlay, pointerEvents: 'none', opacity: 0.8 }} />
        )}
        <div className="presentation-cover-rail reveal">
          <div className="presentation-cover-index" style={{ fontFamily: theme.fontDisplay, letterSpacing: '0.08em', position: 'relative' }}>
            {num} / {String(total).padStart(2, '0')} · {spec.corner}
          </div>
          <div className="presentation-cover-stamp" style={{
            background: theme.accent, transform: 'rotate(-3deg)',
            display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
            padding: '1.25rem', borderRadius: theme.cornerRadius, color: theme.textOnAccent,
          }}>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 'clamp(.75rem, 1.3cqw, 1.2rem)' }}>{spec.corner}</div>
            <div style={{ fontFamily: theme.fontDisplay, fontSize: 'clamp(.75rem, 1.5cqw, 1.2rem)', lineHeight: 0.95 }}>{spec.stamp}</div>
          </div>
        </div>
        <div className="reveal flex flex-col justify-end" style={{ position: 'relative' }}>
          <p className="uppercase" style={{
            fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.22em', color: theme.accent, marginBottom: '1.5rem',
          }}>{spec.kicker}</p>
          <h1 className="presentation-cover-title" style={{
            fontFamily: theme.fontDisplay, color: theme.ink,
          }}>{spec.h1}</h1>
          <div className="flex gap-10 mt-8 uppercase flex-wrap" style={{
            fontWeight: 600, fontSize: '1rem', letterSpacing: '0.16em', color: theme.inkDim,
          }}>
            {spec.meta.map((m) => <span key={m}>{m}</span>)}
          </div>
        </div>
        <div className="reveal flex justify-between uppercase" style={{
          fontSize: '0.78rem', letterSpacing: '0.16em', color: theme.inkDim,
          borderTop: `1px solid ${theme.rule}`, paddingTop: '1rem', fontWeight: 500, position: 'relative',
        }}>
          <span>{theme.label}</span>
          <span>{spec.corner}</span>
        </div>
      </section>
    );

    case 'verdict': return (
      <SlideShell theme={theme} num={num} total={total}>
        <TitleSide theme={theme} kicker={spec.kicker} h1={spec.h1} sub={spec.sub} />
        <BoldCard theme={theme} bg={theme.accent} num={spec.cardNum} label={spec.cardLabel} h3={spec.cardH3} p={spec.cardP} />
      </SlideShell>
    );

    case 'sdlc': return (
      <SlideShell theme={theme} num={num} total={total} accentVar={theme.accent2}>
        <div className="reveal flex flex-col justify-end pr-4" style={{ position: 'relative' }}>
          <p className="uppercase mb-3" style={{ fontWeight: 700, fontSize: '0.78rem', letterSpacing: '0.22em', color: theme.accent2 }}>
            {spec.kicker}
          </p>
          <h2 style={{
            fontFamily: theme.fontDisplay, fontSize: 'clamp(1.5rem, 3.8vw, 3rem)',
            lineHeight: 0.98, letterSpacing: '-0.01em', maxWidth: '18ch', color: theme.ink,
          }}>{spec.h2}</h2>
          <p style={{ marginTop: '1rem', fontSize: '1rem', maxWidth: '48ch', color: theme.inkDim }}>{spec.sub}</p>
          <div className="grid mt-6" style={{ gridTemplateColumns: `repeat(${spec.stages.length}, 1fr)`, gap: 4 }}>
            {spec.stages.map((s, i) => (
              <div key={s} className="text-center" style={{
                padding: '0.85rem 0.5rem',
                background: i === spec.here ? theme.accent2 : theme.surface,
                border: i === spec.here ? '1px solid transparent' : `1px solid ${theme.rule}`,
                color: i === spec.here ? theme.textOnAccent : theme.inkDim,
                fontFamily: theme.fontDisplay, fontSize: '1rem',
                borderRadius: theme.cornerRadius,
              }}>
                <span style={{
                  display: 'block', fontFamily: theme.fontBody, fontWeight: 600,
                  fontSize: '0.7rem', letterSpacing: '0.16em', opacity: 0.7, marginBottom: '0.2rem',
                }}>{String(i + 1).padStart(2, '0')}</span>
                {s}
              </div>
            ))}
          </div>
        </div>
        <BoldCard theme={theme} bg={theme.accent2} num={num} label="Stage placement" h3={spec.cardH3} p={spec.cardP} />
      </SlideShell>
    );

    case 'lenses': return (
      <SlideShell theme={theme} num={num} total={total} accentVar={theme.accent3}>
        <TitleSide theme={theme} kicker={spec.kicker} h2={spec.h2} sub={spec.sub} />
        <div className="reveal flex flex-col justify-center gap-2" style={{ position: 'relative' }}>
          {spec.items.map((l) => (
            <div key={l.n} style={{
              padding: '0.9rem', background: theme.surface, border: `1px solid ${theme.rule}`,
              borderRadius: theme.cornerRadius,
            }}>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: '1.6rem', color: theme.accent3 }}>{l.n}</div>
              <h3 style={{ fontFamily: theme.fontDisplay, fontSize: '1.1rem', marginTop: '0.3rem', color: theme.ink }}>{l.h}</h3>
              <p style={{ fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.45, marginTop: '0.4rem', color: theme.inkDim }}>{l.p}</p>
            </div>
          ))}
        </div>
      </SlideShell>
    );

    case 'severity': return (
      <SlideShell theme={theme} num={num} total={total}>
        <TitleSide theme={theme} kicker={spec.kicker} h2={spec.h2} sub={spec.sub} />
        <div className="reveal grid grid-cols-2 gap-3 self-center" style={{ position: 'relative' }}>
          {spec.items.map((s, i) => (
            <div key={s.lbl} style={{
              background: i === 0 ? theme.accent : theme.surface,
              color: i === 0 ? theme.textOnAccent : theme.ink,
              border: i === 0 ? '1px solid transparent' : `1px solid ${theme.rule}`,
              padding: '1rem', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              minHeight: '9rem', borderRadius: theme.cornerRadius,
            }}>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: '1.2rem' }}>{s.lbl}</div>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: '3.5rem', lineHeight: 0.85 }}>{s.ct}</div>
              <div style={{ fontWeight: 500, fontSize: '0.78rem', lineHeight: 1.4, opacity: i === 0 ? 1 : 0.85 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </SlideShell>
    );

    case 'cost': return (
      <SlideShell theme={theme} num={num} total={total} accentVar={theme.accent4}>
        <TitleSide theme={theme} kicker={spec.kicker} h2={spec.h2} sub={spec.sub} />
        <div className="reveal grid grid-cols-2 gap-3 self-center" style={{ position: 'relative' }}>
          {spec.items.map((c, i) => {
            const colors = [theme.accent, theme.accent2, theme.accent3, theme.accent4];
            return (
              <div key={c.h} style={{
                padding: '1rem', background: theme.surface, borderTop: `4px solid ${colors[i % 4]}`,
                borderRadius: theme.cornerRadius,
              }}>
                <h3 style={{ fontFamily: theme.fontDisplay, fontSize: '1.2rem', marginBottom: '0.5rem', color: theme.ink }}>{c.h}</h3>
                <p style={{ fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.5, color: theme.inkDim }}>{c.p}</p>
              </div>
            );
          })}
        </div>
      </SlideShell>
    );

    case 'methods': return (
      <SlideShell theme={theme} num={num} total={total} accentVar={theme.accent2}>
        <TitleSide theme={theme} kicker={spec.kicker} h2={spec.h2} sub={spec.sub} />
        <div className="reveal flex flex-col justify-center gap-2" style={{ position: 'relative' }}>
          {spec.items.map((m) => (
            <div key={m.num} style={{
              padding: '0.9rem', background: theme.surface, border: `1px solid ${theme.rule}`,
              borderRadius: theme.cornerRadius,
            }}>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: '1.6rem', color: theme.accent2 }}>{m.num}</div>
              <h3 style={{ fontFamily: theme.fontDisplay, fontSize: '1.1rem', marginTop: '0.3rem', color: theme.ink }}>{m.h}</h3>
              <p style={{ fontWeight: 500, fontSize: '0.85rem', lineHeight: 1.45, marginTop: '0.4rem', color: theme.inkDim }}>{m.p}</p>
            </div>
          ))}
        </div>
      </SlideShell>
    );

    case 'kpi': return (
      <SlideShell theme={theme} num={num} total={total}>
        <TitleSide theme={theme} kicker={spec.kicker} h1={spec.h1} sub={spec.sub} />
        <div className="reveal grid grid-cols-2 gap-3 self-center" style={{ position: 'relative' }}>
          {spec.metrics.map((m, i) => {
            const colors = [theme.accent, theme.accent2, theme.accent3, theme.accent4];
            const isLead = i === 0;
            return (
              <div key={m.label} style={{
                background: isLead ? colors[i] : theme.surface,
                color: isLead ? theme.textOnAccent : theme.ink,
                padding: '1.25rem', borderRadius: theme.cornerRadius,
                border: isLead ? '1px solid transparent' : `1px solid ${theme.rule}`,
                borderTop: isLead ? '1px solid transparent' : `4px solid ${colors[i % 4]}`,
                display: 'flex', flexDirection: 'column', gap: '0.4rem', minHeight: '8rem',
              }}>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: 'clamp(2rem, 4vw, 3.2rem)', lineHeight: 0.9 }}>{m.num}</div>
                <div className="uppercase" style={{
                  fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.16em', opacity: 0.85,
                }}>{m.label}</div>
                {m.note && <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{m.note}</div>}
              </div>
            );
          })}
        </div>
      </SlideShell>
    );

    case 'timeline': return (
      <SlideShell theme={theme} num={num} total={total} accentVar={theme.accent4}>
        <TitleSide theme={theme} kicker={spec.kicker} h2={spec.h2} sub={spec.sub} />
        <div className="reveal flex flex-col justify-center gap-2" style={{ position: 'relative' }}>
          {spec.milestones.map((m, i) => (
            <div key={m.label} style={{
              display: 'grid', gridTemplateColumns: '5rem 1fr',
              padding: '0.9rem 1rem', background: theme.surface,
              borderLeft: `4px solid ${theme.accent4}`, borderRadius: theme.cornerRadius,
              gap: '1rem',
            }}>
              <div style={{ fontFamily: theme.fontDisplay, fontSize: '1.2rem', color: theme.accent4 }}>{m.date}</div>
              <div>
                <div style={{ fontFamily: theme.fontDisplay, fontSize: '1rem', color: theme.ink }}>{m.label}</div>
                <div style={{ fontSize: '0.85rem', color: theme.inkDim, marginTop: '0.2rem' }}>{m.note}</div>
              </div>
              <div style={{ gridColumn: '1 / -1', height: i === spec.milestones.length - 1 ? 0 : 1, background: 'transparent' }} />
            </div>
          ))}
        </div>
      </SlideShell>
    );

    case 'artifact': {
      const meta = BAND_META[spec.band];
      const color = bandColor(spec.band, theme);
      const light = spec.band === 'exec';
      return (
        <SlideShell theme={theme} num={num} total={total} accentVar={color}>
          <TitleSide
            theme={theme}
            kicker={meta.label}
            h2={spec.artifact.title}
            sub={`${arcLabel(spec.artifact.arc)} · revision ${spec.artifact.pass} · hash ${spec.artifact.contentHash.slice(0, 12)} — ${meta.blurb}.`}
          />
          <BoldCard
            theme={theme}
            bg={color}
            light={light}
            num={String(spec.idx + 1).padStart(2, '0')}
            label={spec.artifact.type}
            h3={
              spec.band === 'exec' ? 'Defense posture: every claim downstream of this artifact can be reconstructed from the source record.'
              : spec.band === 'source' ? 'Lineage anchor: this artifact pins identity, custody, and instrument state.'
              : spec.band === 'scientific' ? 'Method anchor: this artifact encodes the controls and statistical thresholds in force.'
              : 'Visual anchor: this artifact is the figure a reviewer will scrutinize first.'
            }
            p={`Derived from ${spec.artifact.derivedFrom.length} upstream sources · ${spec.artifact.changed.length} changed surfaces · ${spec.artifact.acceptanceChecks.length} acceptance checks recorded.`}
          />
        </SlideShell>
      );
    }

    case 'closing': return (
      <SlideShell theme={theme} num={num} total={total} accentVar={theme.accent5} footL="CLOSE OF DEFENSE">
        <TitleSide theme={theme} kicker={spec.kicker} h1={spec.h1} sub={spec.sub} />
        <div className="reveal flex flex-col justify-center" style={{ position: 'relative' }}>
          <ol style={{ listStyle: 'none' }}>
            {spec.items.map((q, i) => (
              <li key={q} style={{
                display: 'grid', gridTemplateColumns: '3.5em 1fr',
                padding: '0.7rem 0', borderBottom: `1px solid ${theme.rule}`,
                fontSize: '1rem', alignItems: 'start', color: theme.ink,
              }}>
                <span style={{ fontFamily: theme.fontDisplay, color: theme.accent5, fontSize: '1.4rem' }} aria-hidden>
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </div>
      </SlideShell>
    );
  }
}

// =============================================================================
// Build slides for the "from artifacts" mode — wraps curated frame + artifacts.
// =============================================================================

interface BandedArtifact { readonly artifact: Artifact; readonly band: Band; }

function buildBriefFromArtifacts(picks: ReadonlyArray<BandedArtifact>): ReadonlyArray<SlideSpec> {
  const out: SlideSpec[] = [];
  out.push({
    kind: 'title', kicker: 'Translational Genomics · Defense Brief',
    h1: 'Scientific Defense. Release 02.',
    meta: ['Dr. K. Maroon', 'May 2026', `${picks.length} artifacts`],
    stamp: 'SOURCE · METHOD · VISUAL · EXEC',
    corner: 'cartography / release 02 / defense',
  });
  out.push({
    kind: 'verdict', kicker: 'The defense',
    h1: 'Validated assay. Defensible call set.',
    sub: 'Wet-lab to variant call traversed under documented controls — every transition is reproducible from accessioning through the signed HGVS report.',
    cardNum: '02', cardLabel: 'Two questions for the review committee',
    cardH3: 'What evidence threshold elevates a variant to actionable? Who signs when the model and the molecular pathologist disagree?',
    cardP: 'Without crisp answers, the next case produces a different defense for the same shape of finding.',
  });
  out.push({
    kind: 'sdlc', kicker: 'Lifecycle stage', h2: 'Where this assay sits in the lifecycle.',
    sub: 'Past validation. Active under IRB-118. Not yet routine clinical.',
    stages: ['Concept', 'Validation', 'IRB / IND', 'Clinical', 'Surveillance'], here: 2,
    cardH3: 'Validated alpha — running on real specimens under documented controls.',
    cardP: 'The bridge to routine clinical is governance, not chemistry.',
  });
  picks.forEach((p, idx) => out.push({ kind: 'artifact', band: p.band, artifact: p.artifact, idx }));
  out.push({
    kind: 'closing', kicker: 'Closing defense', h1: 'Ask me anything.',
    sub: 'The questions I expect — and the artifacts I will produce in response.',
    items: [
      'Show me the FFPE block that produced PT-2418\'s TP53 call.',
      'Where is the lot number of the polymerase used on run 24-118?',
      'Which UDI pair disambiguates the duplicate read collapsed in well G7?',
      'If we re-run tomorrow, which steps are deterministic and which are stochastic?',
    ],
  });
  return out;
}

// =============================================================================
// LIBRARY UI — curated decks + artifact picker, with theme picker
// =============================================================================

function ThemePicker({
  selected, onChange,
}: { selected: StyleSelection; onChange: (id: StyleSelection) => void }) {
  const useDeckStyles = selected === 'deck-styles';
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Presentation styles">
      <button
        onClick={() => onChange('deck-styles')}
        aria-pressed={useDeckStyles}
        className="flex items-center gap-2 px-3 py-2 rounded text-left transition-all"
        style={{
          border: `1px solid ${useDeckStyles ? 'var(--sot-shell-accent, #38bdf8)' : 'var(--sot-shell-border, #2c4058)'}`,
          background: useDeckStyles ? 'var(--sot-shell-selected, #183c3b)' : 'var(--sot-shell-surface, #101927)',
          color: useDeckStyles ? 'var(--sot-shell-selected-text, #8af2dc)' : 'var(--sot-shell-text, #c8d8ee)',
          minWidth: 200, maxWidth: 260,
        }}
      >
        <span className="w-7 h-7 flex items-center justify-center flex-shrink-0" aria-hidden><Layers size={14} /></span>
        <span className="flex-1 min-w-0">
          <span className="block text-[11px] font-mono uppercase tracking-widest">Deck styles</span>
          <span className="block text-[10px]">Each brief’s original style</span>
        </span>
      </button>
      {THEME_ORDER.map((id) => {
        const t = THEMES[id];
        const Icon = t.icon;
        const isSel = id === selected;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            aria-pressed={isSel}
            className="flex items-center gap-2 px-3 py-2 rounded text-left transition-all"
            style={{
              border: `1px solid ${isSel ? t.accent : 'var(--sot-shell-border)'}`,
              background: isSel ? 'var(--sot-shell-selected, #183c3b)' : 'var(--sot-shell-surface, #101927)',
              minWidth: 200, maxWidth: 260,
            }}
          >
            <span
              className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: t.accent, color: t.textOnAccent }}
              aria-hidden
            >
              <Icon size={14} />
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-mono uppercase tracking-widest" style={{ color: isSel ? 'var(--sot-shell-selected-text, #8af2dc)' : 'var(--sot-shell-text, #c8d8ee)' }}>
                {t.label}
              </span>
              <span className="block text-[10px] text-[var(--sot-shell-muted)] truncate">{t.blurb}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CuratedDeckCard({
  deck, themeId, onPlay,
}: { deck: DeckPreset; themeId: ThemeId; onPlay: () => void }) {
  const t = THEMES[themeId];
  return (
    <article
      aria-label={deck.title}
      className="rounded border overflow-hidden flex flex-col"
      style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 12%, transparent)', backgroundColor: 'rgba(255,255,255,0.02)' }}
    >
      <div style={{
        padding: '14px 16px', background: t.bg, color: t.ink,
        borderBottom: `1px solid ${t.rule}`, position: 'relative', overflow: 'hidden',
      }}>
        {t.slideOverlay && (
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: t.slideOverlay, opacity: 0.6, pointerEvents: 'none' }} />
        )}
        <div className="text-[9px] font-mono uppercase tracking-widest" style={{ color: t.accent, position: 'relative' }}>
          {deck.domain}
        </div>
        <div className="mt-1 leading-tight" style={{ fontFamily: t.fontDisplay, fontSize: 22, position: 'relative' }}>
          {deck.title}
        </div>
        <div className="mt-1 text-[11px]" style={{ color: t.inkDim, position: 'relative' }}>
          {deck.subtitle}
        </div>
      </div>
      <div className="p-3 flex items-center justify-between gap-2">
        <div>
          <div className="text-[10px] font-mono text-[var(--sot-shell-muted)]">{deck.presenter}</div>
          <div className="text-[10px] font-mono text-[var(--sot-shell-muted)]">{deck.slides.length} slides · {THEMES[themeId].label}</div>
        </div>
        <button
          onClick={onPlay}
          className="px-3 py-1.5 rounded text-[11px] font-mono uppercase tracking-widest flex items-center gap-1.5"
          style={{
            background: t.accent, color: t.textOnAccent, border: 'none',
            fontFamily: t.fontDisplay,
          }}
        >
          <FileText size={11} /> Open brief
        </button>
      </div>
    </article>
  );
}

function ArtifactPickerSection({
  banded, selected, onToggle, themeId, onGenerate,
}: {
  banded: ReadonlyArray<BandedArtifact>;
  selected: ReadonlySet<string>;
  onToggle: (id: string) => void;
  themeId: ThemeId;
  onGenerate: () => void;
}) {
  const byBand = useMemo(() => {
    const g: Record<Band, BandedArtifact[]> = { source: [], scientific: [], visual: [], exec: [] };
    banded.forEach((b) => g[b.band].push(b));
    return g;
  }, [banded]);
  const t = THEMES[themeId];

  return (
    <section className="space-y-4" aria-label="Compose an artifact brief">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--sot-shell-muted)]">Build from my artifacts</div>
          <h2 className="text-[var(--sot-shell-text)]" style={{ fontFamily: 'Playfair Display, serif', fontSize: 20 }}>
            Pick artifacts across bands. Generate a defense brief.
          </h2>
        </div>
        <button
          onClick={onGenerate}
          disabled={selected.size === 0}
          className="px-5 py-2.5 rounded text-[12px] uppercase tracking-widest flex items-center gap-2"
          style={{
            backgroundColor: selected.size === 0 ? `color-mix(in srgb, ${t.accent} 14.902%, transparent)` : t.accent,
            color: selected.size === 0 ? `color-mix(in srgb, ${t.accent} 50.196%, transparent)` : t.textOnAccent,
            fontFamily: t.fontDisplay,
            cursor: selected.size === 0 ? 'not-allowed' : 'pointer',
            border: `1px solid color-mix(in srgb, ${t.accent} 40.000%, transparent)`,
          }}
        >
          <FileText size={14} /> Generate Brief · {selected.size}
        </button>
      </div>

      <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {(Object.keys(BAND_META) as Band[]).map((band) => {
          const meta = BAND_META[band];
          const Icon = meta.icon;
          const items = byBand[band];
          const color = bandColor(band, t);
          return (
            <div key={band} className="rounded border" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 10%, transparent)', backgroundColor: 'rgba(255,255,255,0.02)' }}>
              <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)' }}>
                <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: color, color: t.textOnAccent }}>
                  <Icon size={13} />
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest" style={{ color }}>{meta.label}</div>
                  <div className="text-[10px] text-[var(--sot-shell-muted)]">{meta.blurb}</div>
                </div>
                <div className="ml-auto text-[10px] font-mono text-[var(--sot-shell-muted)]">{items.length}</div>
              </div>
              <div className="p-3 space-y-1.5 max-h-60 overflow-y-auto">
                {items.length === 0 && (
                  <div className="text-[10px] font-mono text-[var(--sot-shell-muted)] italic px-2 py-3">No artifacts in this band yet.</div>
                )}
                {items.map(({ artifact }) => {
                  const isSel = selected.has(artifact.id);
                  return (
                    <button
                      key={artifact.id}
                      onClick={() => onToggle(artifact.id)}
                      aria-pressed={isSel}
                      className="w-full text-left rounded px-3 py-2 flex items-start gap-2 transition-colors"
                      style={{
                        backgroundColor: isSel ? `color-mix(in srgb, ${color} 13.333%, transparent)` : 'rgba(255,255,255,0.02)',
                        border: `1px solid ${isSel ? color : 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)'}`,
                      }}
                    >
                      <div className="mt-0.5 w-3 h-3 rounded-sm flex-shrink-0" style={{
                        backgroundColor: isSel ? color : 'transparent',
                        border: `1px solid ${color}`,
                      }}>
                        {isSel && <FileCheck2 size={11} color={t.textOnAccent} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-[var(--sot-shell-text)] truncate">{artifact.title}</div>
                        <div className="text-[9px] font-mono text-[var(--sot-shell-muted)] mt-0.5">
                          {artifact.type} · {arcLabel(artifact.arc)} · revision {artifact.pass}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// =============================================================================
// VIEW ROOT
// =============================================================================

export function PresentationsView() {
  const banded = useMemo<ReadonlyArray<BandedArtifact>>(
    () => STORE.artifacts.map((artifact) => ({ artifact, band: bandOf(artifact) })),
    [],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [format, setFormat] = useState<FormatId>('briefing');
  const [styleSelection, setStyleSelection] = useState<StyleSelection>('deck-styles');
  const artifactThemeId = resolveThemeId(styleSelection, ARTIFACT_THEME);
  const [playing, setPlaying] = useState<null | {
    slides: ReadonlyArray<SlideSpec>;
    themeId: ThemeId;
    identity: PresentationIdentity;
  }>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const picks = useMemo(
    () => banded.filter((b) => selected.has(b.artifact.id)),
    [banded, selected],
  );

  if (playing) {
    const activeTheme = THEMES[playing.themeId];
    return (
      <PresentationPlayer
        identity={playing.identity}
        slides={playing.slides}
        theme={activeTheme}
        format={format}
        onFormatChange={setFormat}
        renderEvidence={renderSlide}
        onExit={() => setPlaying(null)}
      />
    );
  }

  const t = THEMES[artifactThemeId];

  return (
    <div className="h-full overflow-y-auto" style={{ backgroundColor: 'var(--sot-shell-background)' }}>
      <div className="px-8 pt-8 pb-6 border-b" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)' }}>
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--sot-shell-muted)] mb-2">
          Presentations · Defense Workbench
        </div>
        <h1 className="text-[var(--sot-shell-text)]" style={{ fontFamily: 'Playfair Display, serif', fontSize: 28 }}>
          A library of briefs. A theme for every room.
        </h1>
        <p className="mt-2 text-[12px] text-[var(--sot-shell-muted)] max-w-3xl">
          Choose a curated brief from the library, or compose one from artifacts in your cartography.
          Each curated brief opens in its original style. Choose a common style to compare or present
          briefs for a different audience.
        </p>

        <div className="mt-5">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--sot-shell-muted)] mb-2">
            Presentation style
          </div>
          <ThemePicker selected={styleSelection} onChange={setStyleSelection} />
          <div className="mt-2 text-[10px] text-[var(--sot-shell-muted)]">
            {styleSelection === 'deck-styles'
              ? 'Curated briefs retain their own styles. Artifact briefs use Blueprint.'
              : <><span className="text-[var(--sot-shell-text)]">{t.label}</span> · {t.audience}</>}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[var(--sot-shell-muted)] mb-3">
          Curated briefs · biopharma & therapeutics
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
          {DECK_PRESETS.map((deck) => (
            <CuratedDeckCard
              key={deck.id}
              deck={deck}
              themeId={resolveThemeId(styleSelection, deck.defaultTheme)}
              onPlay={() => setPlaying({ slides: deck.slides, themeId: resolveThemeId(styleSelection, deck.defaultTheme), identity: { id: deck.id, title: deck.title, presenter: deck.presenter, source: 'curated-example' } })}
            />
          ))}
        </div>
      </div>

      <div className="px-8 pb-10 pt-2 border-t" style={{ borderColor: 'color-mix(in srgb, var(--sot-shell-strong-border) 8%, transparent)' }}>
        <div className="mt-6">
          <ArtifactPickerSection
            banded={banded}
            selected={selected}
            onToggle={toggle}
            themeId={artifactThemeId}
            onGenerate={() => setPlaying({ slides: buildBriefFromArtifacts(picks), themeId: artifactThemeId, identity: { id: 'artifact-brief', title: 'Scientific Defense · Selected artifacts', presenter: 'Artifact composition', source: 'artifact-composition' } })}
          />
        </div>
      </div>
    </div>
  );
}

// Silence unused-import warnings for ReactNode/CSSProperties if the bundler is strict.
export type { CSSProperties };
