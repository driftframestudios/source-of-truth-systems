import { lazy } from 'react';
import { MobileShowcase } from './components/mobile/MobileShowcase';
import { DeferredView, InitialViewReady } from './components/DeferredView';
import { useCompactViewport } from './useCompactViewport';
import { ExplorationProvider } from './services/exploration/ExplorationProvider';
import { BrowserSessionProvider } from './services/browserSessionContext';
import { EnvironmentProvider } from './services/environment';
import { PermissionScenarioProvider } from './services/permissionScenario';
import { NotificationProvider } from './services/notifications';
import { GuideProvider } from './components/guide/GuideProvider';
import { NavigationHistory } from './services/navigation/NavigationHistory';

const DesktopWorkspace = lazy(() => import('./DesktopWorkspace'));

export default function App() {
  return <EnvironmentProvider><PermissionScenarioProvider><NotificationProvider><BrowserSessionProvider><ExplorationProvider><GuideProvider><NavigationHistory /><ResponsiveWorkspace /></GuideProvider></ExplorationProvider></BrowserSessionProvider></NotificationProvider></PermissionScenarioProvider></EnvironmentProvider>;
}

function ResponsiveWorkspace() {
  const compact = useCompactViewport();
  return compact ? <><MobileShowcase /><InitialViewReady /></> : (
    <DeferredView label="workspace"><DesktopWorkspace /><InitialViewReady /></DeferredView>
  );
}
