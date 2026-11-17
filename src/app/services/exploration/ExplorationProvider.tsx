import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { STORE } from "../../data";
import { DEFAULT_CONTROL } from "../../components/corridor/CorridorScene";
import type {
  ControlState,
  SceneMode,
} from "../../components/corridor/CorridorScene";
import {
  DEFAULT_PLATE_UI,
  preferredResult,
} from "../../components/plate/plateState";
import { DEFAULT_NAVIGATION, parseNavigation } from "../navigation/navigationUrl";
import type { AppSection, ShareableNavigation } from "../navigation/navigationUrl";
import type {
  PlateStackUi,
  StackFocus,
} from "../../components/plate/plateState";

type Setter<T> = Dispatch<SetStateAction<T>>;
type CompactPlateView = "board" | "3d";

interface ExplorationNavigation {
  section: AppSection;
  selectSection: (section: AppSection) => void;
  restoreNavigation: (navigation: ShareableNavigation) => void;
  scene: SceneMode;
  selectScene: (scene: SceneMode, presentation: "desktop" | "compact") => void;
  plateVisited: boolean;
}

interface PlateExploration {
  plateUi: PlateStackUi;
  setPlateUi: Setter<PlateStackUi>;
  selectedWellId: string | null;
  setSelectedWellId: Setter<string | null>;
  focus: StackFocus | null;
  setFocus: Setter<StackFocus | null>;
  compactPlateView: CompactPlateView;
  setCompactPlateView: Setter<CompactPlateView>;
}

const NavigationContext = createContext<ExplorationNavigation | null>(null);
const CorridorContext = createContext<{
  control: ControlState;
  setControl: Setter<ControlState>;
} | null>(null);
const PlateContext = createContext<PlateExploration | null>(null);

/** Visitor intent survives a change of layout; each workspace owns its rendering. */
export function ExplorationProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => parseNavigation(window.location.search) ?? DEFAULT_NAVIGATION);
  const [section, selectSection] = useState<AppSection>(initial.section);
  const [control, setControl] = useState<ControlState>(() => ({ ...DEFAULT_CONTROL, scene: initial.scene }));
  const [plateUi, setPlateUi] = useState<PlateStackUi>(() => ({ ...DEFAULT_PLATE_UI, upright: initial.plate === "history", lens: initial.lens }));
  const [selectedWellId, setSelectedWellId] = useState<string | null>(null);
  const [focus, setFocus] = useState<StackFocus | null>(null);
  const [compactPlateView, setCompactPlateView] =
    useState<CompactPlateView>(initial.scene === "plate" ? "3d" : "board");
  const [plateVisited, setPlateVisited] = useState(initial.scene === "plate");
  const restoreNavigation = useCallback((next: ShareableNavigation) => {
    selectSection(next.section);
    setControl(current => ({ ...current, scene: next.scene }));
    setPlateUi(current => ({ ...current, upright: next.plate === "history", lens: next.lens }));
    if (next.scene === "plate") {
      setPlateVisited(true);
      setCompactPlateView("3d");
    }
  }, []);

  const selectScene = useCallback(
    (scene: SceneMode, presentation: "desktop" | "compact") => {
      selectSection("lanes");
      setControl((current) =>
        current.scene === scene ? current : { ...current, scene },
      );
      if (scene !== "plate") return;
      // Explicit desktop navigation projects the same 3D plate onto a smaller screen.
      // A first mobile visit keeps its existing touch-board entry and featured sample.
      if (presentation === "desktop") setCompactPlateView("3d");
      else if (!plateVisited) {
        setSelectedWellId("B4");
        const resultId = preferredResult(
          STORE.wellResults.filter((result) => result.wellId === "B4"),
        );
        setFocus(resultId ? { resultId, pinned: true } : null);
      }
      setPlateVisited(true);
    },
    [plateVisited],
  );

  const navigation = useMemo(
    () => ({ section, selectSection, restoreNavigation, scene: control.scene, selectScene, plateVisited }),
    [section, restoreNavigation, control.scene, selectScene, plateVisited],
  );
  const corridor = useMemo(() => ({ control, setControl }), [control]);
  const plate = useMemo(
    () => ({
      plateUi,
      setPlateUi,
      selectedWellId,
      setSelectedWellId,
      focus,
      setFocus,
      compactPlateView,
      setCompactPlateView,
    }),
    [plateUi, selectedWellId, focus, compactPlateView],
  );
  // Plate hover/focus updates stay out of Corridor and workspace navigation.
  return (
    <NavigationContext.Provider value={navigation}>
      <CorridorContext.Provider value={corridor}>
        <PlateContext.Provider value={plate}>{children}</PlateContext.Provider>
      </CorridorContext.Provider>
    </NavigationContext.Provider>
  );
}

function requireExploration<T>(value: T | null): T {
  if (!value) throw new Error("ExplorationProvider is required");
  return value;
}

export function useExplorationNavigation() {
  return requireExploration(useContext(NavigationContext));
}

export function useCorridorExploration() {
  return requireExploration(useContext(CorridorContext));
}

export function usePlateExploration() {
  return requireExploration(useContext(PlateContext));
}
