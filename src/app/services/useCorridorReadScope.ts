import { decidePermission } from '../../../shared/permission-scope.mjs';
import { usePermissionScope } from './permissionScenario';

/** The workflow diagram is shared synthetic context; membership still scopes its receiver. */
export function useCorridorReadScope() {
  const { scope } = usePermissionScope();
  const { principalId, roleId, environment } = scope.selection;
  return decidePermission({ principalId, role: roleId, environment, action: 'resource.read' }, scope.catalog);
}
