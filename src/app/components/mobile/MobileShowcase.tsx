import { lazy } from 'react';
import { useExplorationNavigation } from '../../services/exploration/ExplorationProvider';
import * as Dialog from '@radix-ui/react-dialog';
import { Activity, Grid3X3, Info, Layers, X } from 'lucide-react';
import { MobileCorridor } from './MobileCorridor';
import { DeferredView } from '../DeferredView';
import { ShowcaseCredit } from '../ShowcaseCredit';
import { DeveloperDocsLink } from '../DeveloperDocsLink';
import { ThemeSelector } from '../../theme/ThemeSelector';
import { GuideButton, GuideSlot } from '../guide/GuideProvider';
import './mobile-showcase.css';

const MobilePlate = lazy(() => import('./MobilePlate').then(({ MobilePlate }) => ({ default: MobilePlate })));

export function MobileShowcase() {
  const { scene: view, selectScene, plateVisited } = useExplorationNavigation();
  return (
    <div className="mobile-showcase">
      <header className="mobile-showcase-header">
        <div className="mobile-showcase-brand">
          <Activity size={20} aria-hidden="true" />
          <div><strong>Source of Truth</strong><span>for Life Sciences</span></div>
        </div>
        <ThemeSelector presentation="compact" />
        <GuideButton />
        <Dialog.Root>
          <Dialog.Trigger className="mobile-showcase-info" aria-label="About this showcase">
            <Info size={20} aria-hidden="true" />
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="mobile-showcase-overlay" />
            <Dialog.Content className="mobile-showcase-about">
              <Dialog.Title>From sample to insight</Dialog.Title>
              <Dialog.Description>
                Explore the connections behind a genomics workflow. Follow a corridor,
                then look inside a plate to compare its results.
              </Dialog.Description>
              <p>A design showcase by Vikrant Varun Kudesia. Example data; the full workspace is available on a larger screen.</p>
              <DeveloperDocsLink />
              <ShowcaseCredit />
              <Dialog.Close className="mobile-showcase-close" aria-label="Close about this showcase"><X size={20} /></Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </header>
      <nav className="mobile-showcase-nav" aria-label="Explore the showcase">
        <button type="button" aria-pressed={view === 'corridor'} aria-controls="mobile-corridor-panel" onClick={() => selectScene('corridor', 'compact')}><Layers size={17} aria-hidden="true" />Corridor</button>
        <button type="button" aria-pressed={view === 'plate'} aria-controls="mobile-plate-panel" onClick={() => selectScene('plate', 'compact')}><Grid3X3 size={17} aria-hidden="true" />Plate</button>
      </nav>
      <GuideSlot />
      <main className="mobile-showcase-main">
        <section id="mobile-corridor-panel" aria-label="Corridor" hidden={view !== 'corridor'}><MobileCorridor active={view === 'corridor'} /></section>
        <section id="mobile-plate-panel" aria-label="Plate" hidden={view !== 'plate'}>{plateVisited && <DeferredView label="plate"><MobilePlate active={view === 'plate'} /></DeferredView>}</section>
      </main>
    </div>
  );
}
