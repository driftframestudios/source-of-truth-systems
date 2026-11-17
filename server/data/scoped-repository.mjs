import { GraphQLError } from "graphql";
import {
  canReadWell,
  canReadResult,
  projectWellFields,
  projectResultFields,
  resolveResultOwner,
  resolveWellOwner,
  decideScopedPermission,
  decidePermission,
  effectiveGrant,
} from "../../shared/permission-scope.mjs";

const refused = () =>
  new GraphQLError("This scenario cannot read the requested record.", {
    extensions: { code: "FORBIDDEN" },
  });
const unavailable = () =>
  new GraphQLError("The record has no recognized canonical owner.", {
    extensions: { code: "OWNERSHIP_UNAVAILABLE" },
  });

/** Request-owned projection. Raw repositories stay read-only and scope-neutral. */
export function createScopedRepository(repository, scope, ownership) {
  // A request owns one read-only snapshot; aliases reuse its canonical anchors.
  const anchors = new Map();
  const readWell = (plateId, wellId) => {
    const key = JSON.stringify([plateId, wellId]);
    if (!anchors.has(key))
      anchors.set(key, Promise.resolve(repository.getWell(plateId, wellId)));
    return anchors.get(key);
  };
  const baseRead = decidePermission(
    {
      principalId: scope.selection.principalId,
      role: scope.selection.roleId,
      environment: scope.selection.environment,
      action: "resource.read",
      resource: "plate_map",
    },
    scope.catalog,
  );
  const plateAllowed =
    baseRead.ok &&
    scope.catalog.geographies.some(
      (geo) =>
        effectiveGrant(
          scope,
          scope.selection.principalId,
          "plate_map",
          geo.id,
        ) !== "none",
    );
  const requirePlate = () => {
    if (!plateAllowed) throw refused();
  };
  const validPlate = (id) => id === ownership.plateId;
  const resolveAnchor = async (result) => {
    if (!validPlate(result.anchorPlateId)) throw unavailable();
    const well = await readWell(result.anchorPlateId, result.wellId);
    if (!well || !resolveResultOwner(result, ownership, well))
      throw unavailable();
    return well;
  };
  return Object.freeze({
    async getPlate(id) {
      requirePlate();
      const plate = await repository.getPlate(id);
      if (plate && !validPlate(plate.id)) throw unavailable();
      return plate;
    },
    async getWell(plateId, id, { relation = false } = {}) {
      requirePlate();
      const well = await readWell(plateId, id);
      if (!well) return null;
      if (!validPlate(plateId) || !resolveWellOwner(well, ownership))
        throw unavailable();
      if (!canReadWell(scope, well, ownership).ok) {
        if (relation) return null;
        throw refused();
      }
      return projectWellFields(scope, well, ownership);
    },
    async listWells(plateId) {
      requirePlate();
      if (!validPlate(plateId)) throw unavailable();
      const wells = await repository.listWells(plateId);
      for (const well of wells)
        anchors.set(JSON.stringify([plateId, well.id]), Promise.resolve(well));
      return wells
        .map((well) => projectWellFields(scope, well, ownership))
        .filter(Boolean);
    },
    async listHistory(plateId, wellId) {
      requirePlate();
      const well = await readWell(plateId, wellId);
      if (!well) return [];
      if (!validPlate(plateId) || !resolveWellOwner(well, ownership))
        throw unavailable();
      if (!canReadWell(scope, well, ownership).ok) throw refused();
      const owner = resolveWellOwner(well, ownership);
      if (
        !owner ||
        !decideScopedPermission(scope, {
          action: "resource.read",
          resource: "run_metadata",
          geography: owner.geography,
          consent: owner.consent,
          purpose: "explanation",
        }).ok
      )
        throw refused();
      const results = await repository.listHistory(plateId, wellId);
      // Ownership failures mean unavailable data, never an unrestricted fallback.
      for (const result of results)
        if (!resolveResultOwner(result, ownership, well)) throw unavailable();
      const projected = results
        .map((result) => projectResultFields(scope, result, ownership, well))
        .filter(Boolean);
      if (results.length && !projected.length) throw refused();
      return projected;
    },
    async getResult(id, { relation = false } = {}) {
      requirePlate();
      const result = await repository.getResult(id);
      if (!result) return null;
      const well = await resolveAnchor(result);
      if (
        !canReadWell(scope, well, ownership).ok ||
        !canReadResult(scope, result, ownership, well).ok
      ) {
        if (relation) return null;
        throw refused();
      }
      return projectResultFields(scope, result, ownership, well);
    },
  });
}
