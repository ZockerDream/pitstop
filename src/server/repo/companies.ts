import { existsSync } from 'node:fs';
import path from 'node:path';
import { computeRights, GROUP_TEMPLATES, supportRights, type Rights } from '../../shared/permissions';
import type { AuditEntry, Company, CompanyRef, Group, Member, PermissionException, ServerCompany } from '../../shared/types';
import type { Queryable } from '../db/pool';
import { dispatchWebhooks } from '../hooks';

const companyCols = `id, name, short, status, modules, lock_wins AS "lockWins", support_access AS "supportAccess", info, extra,
  map_bounds AS "mapBounds", created_at AS "createdAt"`;

export function mapFile(dataDir: string, companyId: string): string | null {
  for (const ext of ['jpg', 'png', 'webp']) {
    const f = path.join(dataDir, 'maps', `${companyId}.${ext}`);
    if (existsSync(f)) return f;
  }
  return null;
}

export async function getCompany(q: Queryable, id: string, dataDir: string): Promise<Company | null> {
  const { rows } = await q.query<Omit<Company, 'hasMap'>>(`SELECT ${companyCols} FROM companies WHERE id = $1`, [id]);
  return rows[0] ? { ...rows[0], hasMap: mapFile(dataDir, id) !== null } : null;
}

export async function updateCompany(
  q: Queryable,
  id: string,
  patch: Partial<Pick<Company, 'name' | 'short' | 'status' | 'modules' | 'lockWins' | 'supportAccess' | 'info' | 'mapBounds' | 'extra'>>,
): Promise<void> {
  const map: Record<string, string> = { name: 'name', short: 'short', status: 'status', modules: 'modules', lockWins: 'lock_wins', supportAccess: 'support_access', info: 'info', mapBounds: 'map_bounds', extra: 'extra' };
  const sets: string[] = [];
  const values: unknown[] = [id];
  for (const [k, col] of Object.entries(map)) {
    if (!(k in patch) || (patch as Record<string, unknown>)[k] === undefined) continue;
    const v = (patch as Record<string, unknown>)[k];
    values.push(k === 'info' || k === 'mapBounds' || k === 'extra' ? JSON.stringify(v) : v);
    sets.push(`${col} = $${values.length}`);
  }
  if (sets.length) await q.query(`UPDATE companies SET ${sets.join(', ')} WHERE id = $1`, values);
}

/** Firmen, in denen die Person Mitglied ist (gesperrte Mitgliedschaften zählen nicht). */
export async function companiesOfUser(q: Queryable, userId: string, includeSupport: boolean): Promise<CompanyRef[]> {
  const { rows } = await q.query<CompanyRef>(
    `SELECT c.id, c.name, c.short, c.status FROM companies c
      WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.company_id = c.id AND m.user_id = $1 AND NOT m.locked)
         OR ($2 AND c.support_access)
      ORDER BY c.name`,
    [userId, includeSupport],
  );
  return rows;
}

export async function listServerCompanies(q: Queryable): Promise<ServerCompany[]> {
  const { rows } = await q.query<ServerCompany>(
    `SELECT c.id, c.name, c.short, c.status, c.modules, c.support_access AS "supportAccess", c.created_at AS "createdAt",
            (SELECT count(*)::int FROM memberships m WHERE m.company_id = c.id) AS members,
            coalesce((SELECT string_agg(u.display_name, ', ') FROM groups g JOIN group_members gm ON gm.group_id = g.id
                       JOIN users u ON u.id = gm.user_id WHERE g.company_id = c.id AND g.is_owner), '–') AS "ownerName"
       FROM companies c ORDER BY c.name`,
  );
  return rows;
}

/** Neue Firma mit Inhaber-Gruppe und den Gruppenvorlagen. */
export async function createCompany(q: Queryable, name: string, short: string, ownerId: string): Promise<string> {
  // Standard-Module aus den Server-Einstellungen (fehlt = Spaltenvorgabe)
  const st = await q.query<{ value: { defaultModules?: string[] } }>("SELECT value FROM settings WHERE key = 'server'");
  const mods = st.rows[0]?.value.defaultModules;
  const { rows } = mods
    ? await q.query<{ id: string }>('INSERT INTO companies (name, short, modules) VALUES ($1, $2, $3) RETURNING id', [name, short, mods])
    : await q.query<{ id: string }>('INSERT INTO companies (name, short) VALUES ($1, $2) RETURNING id', [name, short]);
  const id = rows[0].id;
  await q.query('INSERT INTO memberships (company_id, user_id, rank) VALUES ($1, $2, $3)', [id, ownerId, 'Inhaber']);
  const owner = await q.query<{ id: string }>(
    `INSERT INTO groups (company_id, name, color, description, is_owner, position) VALUES ($1, 'Inhaber', '#ffb547', 'Hat immer alle Rechte.', true, 0) RETURNING id`,
    [id],
  );
  await q.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [owner.rows[0].id, ownerId]);
  let pos = 1;
  for (const t of GROUP_TEMPLATES) {
    await q.query(
      'INSERT INTO groups (company_id, name, color, description, levels, own, specials, position) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
      [id, t.name, t.color, t.description, JSON.stringify(t.levels), JSON.stringify(t.own ?? {}), JSON.stringify(t.specials ?? {}), pos++],
    );
  }
  return id;
}

export async function getMembership(q: Queryable, companyId: string, userId: string): Promise<{ locked: boolean } | null> {
  const { rows } = await q.query<{ locked: boolean }>('SELECT locked FROM memberships WHERE company_id = $1 AND user_id = $2', [companyId, userId]);
  return rows[0] ?? null;
}

export async function listMembers(q: Queryable, companyId: string): Promise<Member[]> {
  const { rows } = await q.query<Member>(
    `SELECT u.id AS "userId", u.display_name AS "displayName", u.email, u.discord, m.rank, m.phone, m.locked, m.game_id AS "gameId",
            m.joined_at AS "joinedAt", u.last_login_at AS "lastLoginAt",
            (SELECT d.started_at FROM duty_sessions d WHERE d.company_id = m.company_id AND d.user_id = u.id AND d.ended_at IS NULL) AS "onDutySince"
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.company_id = $1 ORDER BY u.display_name`,
    [companyId],
  );
  return rows;
}

export async function listGroups(q: Queryable, companyId: string): Promise<Group[]> {
  const { rows } = await q.query<Group>(
    `SELECT g.id, g.name, g.color, g.description, g.is_owner AS "isOwner", g.levels, g.own, g.specials, g.position,
            coalesce(array_agg(gm.user_id) FILTER (WHERE gm.user_id IS NOT NULL), '{}') AS members
       FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id
      WHERE g.company_id = $1 GROUP BY g.id ORDER BY g.is_owner DESC, g.position, g.name`,
    [companyId],
  );
  return rows;
}

export async function listExceptions(q: Queryable, companyId: string): Promise<PermissionException[]> {
  const { rows } = await q.query<PermissionException>(
    `SELECT id, user_id AS "userId", area, level, until, reason FROM permission_exceptions WHERE company_id = $1 ORDER BY created_at`,
    [companyId],
  );
  return rows;
}

/** Effektive Rechte einer Person in einer Firma; null = kein Zugang. */
export async function rightsFor(q: Queryable, company: Company, userId: string, isServerAdmin: boolean, today: string): Promise<Rights | null> {
  const m = await getMembership(q, company.id, userId);
  if (!m || m.locked) return isServerAdmin && company.supportAccess ? supportRights(company.modules) : null;
  const groups = (await listGroups(q, company.id)).filter((g) => g.members.includes(userId));
  const exceptions = (await listExceptions(q, company.id)).filter((e) => e.userId === userId);
  return computeRights(groups, exceptions, company.lockWins, today, company.modules);
}

export async function audit(q: Queryable, companyId: string | null, userId: string | null, area: string, action: string): Promise<void> {
  await q.query('INSERT INTO audit_log (company_id, user_id, area, action) VALUES ($1, $2, $3, $4)', [companyId, userId, area, action]);
  if (companyId) dispatchWebhooks(companyId, userId, area, action);
}

export async function listAudit(q: Queryable, companyId: string | null, limit = 200): Promise<AuditEntry[]> {
  const { rows } = await q.query<AuditEntry>(
    `SELECT a.id, a.user_id AS "userId", coalesce(u.display_name, 'System') AS "userName", a.area, a.action, a.created_at AS "createdAt"
       FROM audit_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.company_id IS NOT DISTINCT FROM $1 ORDER BY a.created_at DESC LIMIT $2`,
    [companyId, limit],
  );
  return rows;
}
