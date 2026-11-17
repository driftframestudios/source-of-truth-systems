import { useEffect, useRef } from "react";
import { useGuide } from "../../components/guide/GuideProvider";
import {
  useExplorationNavigation,
  usePlateExploration,
} from "../exploration/ExplorationProvider";
import {
  DEFAULT_NAVIGATION,
  navigationHistoryMode,
  parseNavigation,
  serializeNavigation,
} from "./navigationUrl";
import type { ShareableNavigation } from "./navigationUrl";

/** The URL observes existing state owners and sends one bounded command on history travel. */
export function NavigationHistory() {
  const { section, scene, restoreNavigation } = useExplorationNavigation();
  const { plateUi } = usePlateExploration();
  const { send } = useGuide();
  const previous = useRef<ShareableNavigation | null>(null);
  const current = {
    section,
    scene,
    plate: plateUi.upright ? "history" : "overview",
    lens: plateUi.lens,
  } as const;
  const encoded = serializeNavigation(current);

  useEffect(() => {
    const receive = () => {
      // Invalidate pending automatic selections before any receiving layout applies the URL.
      send({ type: "close" });
      const next =
        parseNavigation(window.location.search) ?? DEFAULT_NAVIGATION;
      previous.current = next;
      restoreNavigation(next);
      window.history.replaceState(
        null,
        "",
        window.location.pathname + serializeNavigation(next),
      );
    };
    window.addEventListener("popstate", receive);
    return () => window.removeEventListener("popstate", receive);
  }, [restoreNavigation, send]);

  useEffect(() => {
    const method = previous.current
      ? navigationHistoryMode(previous.current, current)
      : "replaceState";
    const destination = window.location.pathname + encoded;
    if (
      window.location.search !== encoded ||
      window.location.hash ||
      previous.current === null
    ) {
      window.history[method](null, "", destination);
    }
    previous.current = current;
  }, [section, scene, plateUi.upright, plateUi.lens, encoded]);
  return null;
}
