import { STORE } from "../../data";
import { PLATE_ID } from "../../data/wellResults";
import type { RecordOwnership } from "../../../../shared/permission-scope.mjs";

/** Unlinked example wells belong to the declared collection geography, never the actor's region. */
export const PLATE_OWNERSHIP: RecordOwnership = {
  plateId: PLATE_ID,
  geography: "us_east",
  specimens: STORE.specimens,
};
export const PLATE_WELLS = STORE.plate;
