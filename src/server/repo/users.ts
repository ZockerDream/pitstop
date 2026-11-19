import type { Role, User } from '../../shared/types';
import type { Queryable } from '../db/pool';

export function userCols(a = 'users'): string {
  return `${a}.id, ${a}.email, ${a}.display_name AS "displayName", ${a}.role, ${a}.employee_id AS "employeeId",
    ${a}.active, ${a}.must_change_password AS "mustChangePassword", ${a}.last_login_at AS "lastLoginAt", ${a}.created_at AS "createdAt"`;
}

export async function listUsers(q: Queryable): Promise<User[]> {
  const { rows } = await q.query<User>(`SELECT ${userCols()} FROM users ORDER BY role, display_name`);
  return rows;
}

export async function getUser(q: Queryable, id: string): Promise<User | null> {
  const { rows } = await q.query<User>(`SELECT ${userCols()} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function getUserWithHashByEmail(q: Queryable, email: string): Promise<(User & { passwordHash: string }) | null> {
  const { rows } = await q.query<User & { passwordHash: string }>(
    `SELECT ${userCols()}, password_hash AS "passwordHash" FROM users WHERE email = lower($1)`,
    [email.trim()],
  );
  return rows[0] ?? null;
}

export async function getPasswordHash(q: Queryable, id: string): Promise<string | null> {
  const { rows } = await q.query<{ hash: string }>('SELECT password_hash AS hash FROM users WHERE id = $1', [id]);
  return rows[0]?.hash ?? null;
}

export async function countUsers(q: Queryable): Promise<number> {
  const { rows } = await q.query<{ n: number }>('SELECT count(*)::int AS n FROM users');
  return rows[0].n;
}

export async function countActiveAdmins(q: Queryable, excludeId?: string): Promise<number> {
  const { rows } = await q.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM users WHERE role = 'admin' AND active AND id <> coalesce($1::uuid, '00000000-0000-0000-0000-000000000000')`,
    [excludeId ?? null],
  );
  return rows[0].n;
}

export interface NewUser {
  email: string;
  displayName: string;
  role: Role;
  employeeId: string | null;
  passwordHash: string;
  mustChangePassword: boolean;
  isDemo?: boolean;
}

export async function insertUser(q: Queryable, u: NewUser): Promise<User> {
  const { rows } = await q.query<User>(
    `INSERT INTO users (email, display_name, role, employee_id, password_hash, must_change_password, is_demo)
     VALUES (lower($1), $2, $3, $4, $5, $6, $7) RETURNING ${userCols()}`,
    [u.email.trim(), u.displayName, u.role, u.employeeId, u.passwordHash, u.mustChangePassword, u.isDemo ?? false],
  );
  return rows[0];
}

export async function updateUser(
  q: Queryable,
  id: string,
  patch: Partial<{ displayName: string; role: Role; active: boolean; employeeId: string | null }>,
): Promise<User | null> {
  const map: Record<string, string> = { displayName: 'display_name', role: 'role', active: 'active', employeeId: 'employee_id' };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, col] of Object.entries(map)) {
    if (key in patch) {
      values.push((patch as Record<string, unknown>)[key]);
      sets.push(`${col} = $${values.length}`);
    }
  }
  if (sets.length === 0) return getUser(q, id);
  const { rows } = await q.query<User>(`UPDATE users SET ${sets.join(', ')} WHERE id = $1 RETURNING ${userCols()}`, values);
  return rows[0] ?? null;
}

export async function setPassword(q: Queryable, id: string, passwordHash: string, mustChange: boolean): Promise<User | null> {
  const { rows } = await q.query<User>(
    `UPDATE users SET password_hash = $2, must_change_password = $3 WHERE id = $1 RETURNING ${userCols()}`,
    [id, passwordHash, mustChange],
  );
  return rows[0] ?? null;
}

export async function touchLogin(q: Queryable, id: string): Promise<void> {
  await q.query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

export async function getDemoUserId(q: Queryable, role: Role): Promise<string | null> {
  const { rows } = await q.query<{ id: string }>('SELECT id FROM users WHERE is_demo AND role = $1 AND active ORDER BY created_at LIMIT 1', [role]);
  return rows[0]?.id ?? null;
}
