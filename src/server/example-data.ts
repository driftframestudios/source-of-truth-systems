import { permissionCatalog } from "../app/services/permissionScope";
import { STORE } from "../app/data";
import { PLATE_ID, RESULTS_AS_OF, wellIdOf } from "../app/data/wellResults";

// A build-time projection of the same synthetic baseline the browser receives.
// This entry is bundled into build/server, never the public Vite output.
export const exampleData = {
  permissionCatalog,
  sources: STORE.sources,
  ownership: {
    plateId: PLATE_ID,
    geography: "us_east",
    specimens: STORE.specimens.map(
      ({ id, plateWell, geographyCode, consent, dataClass }) => ({
        id,
        plateWell,
        geographyCode,
        consent,
        dataClass,
      }),
    ),
  },
  asOf: RESULTS_AS_OF,
  plateId: PLATE_ID,
  lanes: STORE.lanes,
  cards: STORE.laneCards,
  connections: STORE.laneArrows,
  wells: STORE.plate.map((well) => ({
    ...well,
    id: wellIdOf(well.row, well.col),
  })),
  results: STORE.wellResults,
};

// Domain preparation is shared with browser commands and remains in this private build.
export {
  createSourceSession,
  prepareSourceCommand,
} from "../app/services/sourceSession";
