import type { Role } from './types';

// Rechte im Format bereich:aktion. Der Server prüft sie bei jeder Route (guards.ts),
// die Oberfläche blendet damit aus. Fachliche Matrix: CONCEPT.md Abschnitt 3.

export type Permission =
  | 'finance:view'
  | 'customer:edit'
  | 'customer:viewInvoices'
  | 'employee:edit'
  | 'employee:viewRate'
  | 'employee:viewFile:any'
  | 'absence:decide'
  | 'absence:createForOthers'
  | 'absence:reportSick'
  | 'task:manage'
  | 'settings:manage'
  | 'users:manage';

const MATRIX: Record<Permission, Role[]> = {
  'finance:view': ['admin'],
  'customer:edit': ['admin'],
  'customer:viewInvoices': ['admin'],
  'employee:edit': ['admin'],
  'employee:viewRate': ['admin'],
  'employee:viewFile:any': ['admin'],
  'absence:decide': ['admin'],
  'absence:createForOthers': ['admin'],
  'absence:reportSick': ['admin'],
  'task:manage': ['admin'],
  'settings:manage': ['admin'],
  'users:manage': ['admin'],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[permission].includes(role);
}
