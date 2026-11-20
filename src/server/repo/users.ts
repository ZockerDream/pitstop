import type { Prefs, ServerAccount, User } from '../../shared/types';
import type { Queryable } from '../db/pool';

export function userCols(a = 'users'): string {
  return `${a}.id, ${a}.email, ${a}.display_name AS "displayName", ${a}.discord, ${a}.is_server_admin AS "isServerAdmin",
    ${a}.active, ${a}.must_change_password AS "mustChangePassword", ${a}.prefs, ${a}.last_login_at AS "lastLoginAt", ${a}.created_at AS "createdAt",
    ${a}.totp_enabled AS "totpEnabled", ${a}.discord_id IS NOT NULL AS "discordLinked"`;
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

export async function countServerAdmins(q: Queryable, excludeId?: string): Promise<number> {
  const { rows } = await q.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM users WHERE is_server_admin AND active AND id <> coalesce($1::uuid, '00000000-0000-0000-0000-000000000000')`,
    [excludeId ?? null],
  );
  return rows[0].n;
}

export interface NewUser {
  email: string;
  displayName: string;
  passwordHash: string;
  mustChangePassword: boolean;
  isServerAdmin?: boolean;
  discord?: string;
  isDemo?: boolean;
}

export async function insertUser(q: Queryable, u: NewUser): Promise<User> {
  const { rows } = await q.query<User>(
    `INSERT INTO users (email, display_name, password_hash, must_change_password, is_server_admin, discord, is_demo)
     VALUES (lower($1), $2, $3, $4, $5, $6, $7) RETURNING ${userCols()}`,
    [u.email.trim(), u.displayName, u.passwordHash, u.mustChangePassword, u.isServerAdmin ?? false, u.discord ?? '', u.isDemo ?? false],
  );
  return rows[0];
}

export async function updateUser(
  q: Queryable,
  id: string,
  patch: Partial<{ displayName: string; discord: string; active: boolean; isServerAdmin: boolean; prefs: Prefs }>,
): Promise<User | null> {
  const map: Record<string, string> = { displayName: 'display_name', discord: 'discord', active: 'active', isServerAdmin: 'is_server_admin', prefs: 'prefs' };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [key, col] of Object.entries(map)) {
    if (key in patch && (patch as Record<string, unknown>)[key] !== undefined) {
      const v = (patch as Record<string, unknown>)[key];
      values.push(key === 'prefs' ? JSON.stringify(v) : v);
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

export async function listAccounts(q: Queryable): Promise<ServerAccount[]> {
  const { rows } = await q.query<ServerAccount>(
    `SELECT u.id, u.email, u.display_name AS "displayName", u.discord, u.is_server_admin AS "isServerAdmin", u.active, u.totp_enabled AS "totpEnabled",
            u.last_login_at AS "lastLoginAt", u.created_at AS "createdAt",
            coalesce(array_agg(c.name ORDER BY c.name) FILTER (WHERE c.id IS NOT NULL), '{}') AS companies
       FROM users u
       LEFT JOIN memberships m ON m.user_id = u.id
       LEFT JOIN companies c ON c.id = m.company_id
      GROUP BY u.id
      ORDER BY u.display_name`,
  );
  return rows;
}
