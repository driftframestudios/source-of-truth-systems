/** Shared by the About dialog and future welcome surface. */
export const SHOWCASE_COPYRIGHT = '© 2026 Vikrant Varun Kudesia · Driftframe Studios, Limited Liability Company';
export const SHOWCASE_CREATION_CREDIT = 'Built with Figma Make (Claude Opus 5.5) and ChatGPT/Codex (GPT-6 Astra), using custom coding harnesses from kindlight.systems.';

export function ShowcaseCredit() {
  return (
    <footer className="mt-4 text-[10px] leading-relaxed text-[var(--sot-shell-muted)]">
      <div>{SHOWCASE_COPYRIGHT}</div>
      <div className="mt-2">{SHOWCASE_CREATION_CREDIT}</div>
    </footer>
  );
}
