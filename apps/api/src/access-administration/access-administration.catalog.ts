export const ACCESS_PERMISSION_CATALOG = [
  { id: 'read', name: 'Read', description: 'View tenant resources.' },
  { id: 'create', name: 'Create', description: 'Create tenant resources.' },
  { id: 'update', name: 'Update', description: 'Change tenant resources.' },
  { id: 'delete', name: 'Delete', description: 'Delete tenant resources.' },
  {
    id: 'manage_access',
    name: 'Manage access',
    description: 'Assign and revoke tenant access.',
  },
] as const;

export const ACCESS_ROLE_CATALOG = [
  {
    id: 'owner',
    name: 'Owner',
    description: 'Tenant owner with all permissions and ownership safeguards.',
    permissionIds: ['read', 'create', 'update', 'delete', 'manage_access'],
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Tenant administrator with full operational access.',
    permissionIds: ['read', 'create', 'update', 'delete', 'manage_access'],
  },
  {
    id: 'editor',
    name: 'Editor',
    description: 'Can view, create, and update tenant resources.',
    permissionIds: ['read', 'create', 'update'],
  },
  {
    id: 'viewer',
    name: 'Viewer',
    description: 'Can view tenant resources.',
    permissionIds: ['read'],
  },
] as const;

export type AccessRoleId = (typeof ACCESS_ROLE_CATALOG)[number]['id'];
export type AccessPermissionId = (typeof ACCESS_PERMISSION_CATALOG)[number]['id'];

export function normalizeMembershipRole(role: string): AccessRoleId | undefined {
  if (role === 'member') {
    return 'viewer';
  }
  return ACCESS_ROLE_CATALOG.some((catalogRole) => catalogRole.id === role)
    ? (role as AccessRoleId)
    : undefined;
}
