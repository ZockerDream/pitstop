// Serververwaltung (nur Server-Admins): Konten, Firmen, Sicherungen, Export, Protokoll, Ankündigungen.
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Announcement, BackupFile } from '../../shared/types';
import { generatePassword, hashPassword } from '../auth/password';
import { requireServerAdmin, requireUser } from '../auth/guards';
import { deleteUserSessions } from '../auth/sessions';
import type { Config } from '../config';
import { db, tx } from '../db/pool';
import { badRequest, notFound, parseBody, zId, zRequired, zText } from '../errors';
import { audit, createCompany, listAudit, listServerCompanies, updateCompany } from '../repo/companies';
import { countServerAdmins, getUser, insertUser, listAccounts, setPassword, updateUser } from '../repo/users';
import { EXPORT_SETS, exportRows, toCsv } from './export';
import { idParam, type RouteOptions } from './util';

/** Reihenfolge für Sicherung und Wiederherstellung (Fremdschlüssel). Sitzungen werden nicht gesichert. */
const BACKUP_TABLES = [
  'settings', 'users', 'companies', 'memberships', 'groups', 'group_members', 'permission_exceptions', 'customers', 'vehicles',
  'courses', 'services', 'orders', 'callouts', 'bills', 'transactions', 'duty_sessions', 'audit_log', 'announcements',
  'parts', 'shifts', 'payslips', 'course_progress', 'dyno_runs', 'race_events', 'race_cars', 'race_entries',
  'part_moves', 'part_orders', 'bays', 'bay_bookings', 'tools', 'fleet', 'fleet_log', 'championship', 'setups', 'laps', 'trackday_bookings',
  'contracts', 'messages', 'ranks', 'applications', 'absences', 'duty_corrections', 'course_sessions', 'licenses', 'cash_closings',
  'standing_orders', 'goals', 'rule_docs', 'rule_acks', 'posts', 'post_reads', 'poll_votes', 'webhooks', 'api_keys', 'integration_votes',
  'order_photos', 'game_keys',
];
const SEQUENCES: [string, string, string][] = [
  ['customer_no_seq', 'customers', 'number'], ['order_no_seq', 'orders', 'number'], ['callout_no_seq', 'callouts', 'number'],
  ['bill_no_seq', 'bills', 'number'], ['audit_log_id_seq', 'audit_log', 'id'],
];
const BACKUP_NAME = /^pitstop-\d{4}-\d{2}-\d{2}-\d{6}\.json\.gz$/;

const backupDir = (cfg: Config) => path.join(cfg.dataDir, 'backups');

export async function createBackup(cfg: Config): Promise<BackupFile> {
  const data: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) data[t] = (await db().query(`SELECT * FROM ${t}`)).rows;
  const { rows } = await db().query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  const name = `pitstop-${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}-${stamp.slice(9, 15)}.json.gz`;
  mkdirSync(backupDir(cfg), { recursive: true });
  const file = path.join(backupDir(cfg), name);
  writeFileSync(file, gzipSync(JSON.stringify({ format: 'pitstop-backup-1', migrations: rows.map((r) => r.version), createdAt: new Date().toISOString(), data })));
  return { name, size: statSync(file).size, createdAt: new Date().toISOString() };
}

function listBackups(cfg: Config): BackupFile[] {
  if (!existsSync(backupDir(cfg))) return [];
  return readdirSync(backupDir(cfg))
    .filter((f) => BACKUP_NAME.test(f))
    .map((name) => {
      const st = statSync(path.join(backupDir(cfg), name));
      return { name, size: st.size, createdAt: st.mtime.toISOString() };
    })
    .sort((a, b) => b.name.localeCompare(a.name));
}

const accountSchema = z.object({ email: z.email({ message: 'Ungültige E-Mail-Adresse' }), displayName: zRequired(80), discord: zText(60).default(''), isServerAdmin: z.boolean().default(false) });
const accountPatch = z.object({ displayName: zRequired(80).optional(), discord: zText(60).optional(), active: z.boolean().optional(), isServerAdmin: z.boolean().optional() });

export async function serverRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.get('/server/overview', async (req) => {
    requireServerAdmin(req);
    const { rows } = await db().query<{ companies: number; paused: number; accounts: number; locked: number; admins: number; active: number }>(
      `SELECT (SELECT count(*)::int FROM companies) AS companies, (SELECT count(*)::int FROM companies WHERE status = 'paused') AS paused,
              (SELECT count(*)::int FROM users) AS accounts, (SELECT count(*)::int FROM users WHERE NOT active) AS locked,
              (SELECT count(*)::int FROM users WHERE is_server_admin AND active) AS admins,
              (SELECT count(DISTINCT user_id)::int FROM sessions WHERE last_seen_at > now() - interval '15 minutes') AS active`,
    );
    const size = await db().query<{ size: string }>('SELECT pg_size_pretty(pg_database_size(current_database())) AS size');
    return { ...rows[0], dbSize: size.rows[0].size, lastBackup: listBackups(cfg)[0] ?? null, log: await listAudit(db(), null, 8) };
  });

  // --- Konten ---------------------------------------------------------------
  app.get('/server/accounts', async (req) => {
    requireServerAdmin(req);
    return { accounts: await listAccounts(db()) };
  });
  app.post('/server/accounts', async (req) => {
    const me = requireServerAdmin(req);
    const b = parseBody(accountSchema, req.body);
    const startPassword = generatePassword();
    const user = await insertUser(db(), { ...b, passwordHash: await hashPassword(startPassword), mustChangePassword: true });
    await audit(db(), null, me.id, 'Konten', `Konto ${b.displayName} angelegt${b.isServerAdmin ? ' (Server-Admin)' : ''}`);
    return { user, startPassword };
  });
  app.patch('/server/accounts/:id', async (req) => {
    const me = requireServerAdmin(req);
    const id = idParam(req);
    const b = parseBody(accountPatch, req.body);
    if ((b.isServerAdmin === false || b.active === false) && (await countServerAdmins(db(), id)) === 0) {
      const target = await getUser(db(), id);
      if (target?.isServerAdmin) throw badRequest('Mindestens ein aktiver Server-Admin muss bleiben.');
    }
    const user = await updateUser(db(), id, b);
    if (!user) throw notFound();
    if (b.active === false) await deleteUserSessions(id);
    const what = b.isServerAdmin !== undefined ? (b.isServerAdmin ? 'ist jetzt Server-Admin' : 'ist kein Server-Admin mehr') : b.active !== undefined ? (b.active ? 'entsperrt' : 'gesperrt') : 'geändert';
    await audit(db(), null, me.id, 'Konten', `${user.displayName} ${what}`);
    return { user };
  });
  app.post('/server/accounts/:id/reset-password', async (req) => {
    const me = requireServerAdmin(req);
    const id = idParam(req);
    const startPassword = generatePassword();
    const user = await setPassword(db(), id, await hashPassword(startPassword), true);
    if (!user) throw notFound();
    await deleteUserSessions(id);
    await audit(db(), null, me.id, 'Konten', `Startpasswort für ${user.displayName} erzeugt`);
    return { startPassword };
  });

  // --- Firmen ---------------------------------------------------------------
  app.get('/server/companies', async (req) => {
    requireServerAdmin(req);
    return { companies: await listServerCompanies(db()) };
  });
  app.post('/server/companies', async (req) => {
    const me = requireServerAdmin(req);
    const b = parseBody(z.object({ name: zRequired(80), short: zText(8).default(''), ownerId: zId }), req.body);
    if (!(await getUser(db(), b.ownerId))) throw badRequest('Inhaber-Konto nicht gefunden.', { ownerId: 'Unbekanntes Konto' });
    const id = await tx(async (q) => {
      const cid = await createCompany(q, b.name, b.short, b.ownerId);
      await audit(q, null, me.id, 'Firmen', `Firma ${b.name} angelegt`);
      await audit(q, cid, me.id, 'Firma', 'Firma angelegt');
      return cid;
    });
    return { id };
  });
  app.patch('/server/companies/:id', async (req) => {
    const me = requireServerAdmin(req);
    const id = idParam(req);
    const b = parseBody(z.object({ name: zRequired(80).optional(), status: z.enum(['active', 'paused']).optional() }), req.body);
    await updateCompany(db(), id, b);
    await audit(db(), null, me.id, 'Firmen', `Firma ${b.name ?? ''} ${b.status === 'paused' ? 'pausiert' : b.status === 'active' ? 'fortgesetzt' : 'geändert'}`.replace('  ', ' '));
    return { ok: true };
  });
  /** Inhaber übertragen: neue Person bekommt die Inhaber-Gruppe (und wird Mitglied). */
  app.post('/server/companies/:id/owner', async (req) => {
    const me = requireServerAdmin(req);
    const id = idParam(req);
    const { userId } = parseBody(z.object({ userId: zId }), req.body);
    await tx(async (q) => {
      const g = await q.query<{ id: string }>('SELECT id FROM groups WHERE company_id = $1 AND is_owner', [id]);
      if (!g.rowCount) throw notFound();
      await q.query("INSERT INTO memberships (company_id, user_id, rank) VALUES ($1, $2, 'Inhaber') ON CONFLICT DO NOTHING", [id, userId]);
      await q.query('DELETE FROM group_members WHERE group_id = $1', [g.rows[0].id]);
      await q.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [g.rows[0].id, userId]);
      await audit(q, id, me.id, 'Firma', 'Inhaber übertragen');
      await audit(q, null, me.id, 'Firmen', 'Inhaber einer Firma übertragen');
    });
    return { ok: true };
  });

  // --- Sicherungen ----------------------------------------------------------
  app.get('/server/backups', async (req) => {
    requireServerAdmin(req);
    return { backups: listBackups(cfg) };
  });
  app.post('/server/backups', async (req) => {
    const me = requireServerAdmin(req);
    const file = await createBackup(cfg);
    await audit(db(), null, me.id, 'Sicherung', `Sicherung ${file.name} erstellt`);
    return file;
  });
  app.get('/server/backups/:name', async (req, reply) => {
    requireServerAdmin(req);
    const name = (req.params as Record<string, string>).name;
    if (!BACKUP_NAME.test(name) || !existsSync(path.join(backupDir(cfg), name))) throw notFound();
    reply.header('Content-Disposition', `attachment; filename="${name}"`);
    return reply.type('application/gzip').send(readFileSync(path.join(backupDir(cfg), name)));
  });
  app.post('/server/backups/:name/restore', async (req) => {
    const me = requireServerAdmin(req);
    const name = (req.params as Record<string, string>).name;
    const { confirm } = parseBody(z.object({ confirm: z.string() }), req.body);
    if (confirm !== 'WIEDERHERSTELLEN') throw badRequest('Zum Bestätigen WIEDERHERSTELLEN eintippen.', { confirm: 'Bitte WIEDERHERSTELLEN eintippen' });
    if (!BACKUP_NAME.test(name) || !existsSync(path.join(backupDir(cfg), name))) throw notFound();
    const dump = JSON.parse(gunzipSync(readFileSync(path.join(backupDir(cfg), name))).toString('utf8')) as { format: string; migrations: string[]; data: Record<string, unknown[]> };
    const current = (await db().query<{ version: string }>('SELECT version FROM schema_migrations ORDER BY version')).rows.map((r) => r.version);
    if (dump.format !== 'pitstop-backup-1' || dump.migrations.join() !== current.join()) {
      throw badRequest('Diese Sicherung passt nicht zur Datenbank-Version (andere Migrationen).');
    }
    const before = await createBackup(cfg);
    await tx(async (q) => {
      await q.query(`TRUNCATE ${[...BACKUP_TABLES].reverse().join(', ')}, sessions CASCADE`);
      for (const t of BACKUP_TABLES) {
        const rows = dump.data[t] ?? [];
        if (rows.length) await q.query(`INSERT INTO ${t} SELECT * FROM json_populate_recordset(null::${t}, $1)`, [JSON.stringify(rows)]);
      }
      for (const [seq, table, col] of SEQUENCES) await q.query(`SELECT setval('${seq}', greatest((SELECT coalesce(max(${col}), 0) FROM ${table}), 1))`);
    });
    // Nach dem Zurückspielen gibt es keine Sitzungen mehr; den Vorgang trotzdem festhalten, falls das Konto noch existiert.
    if (await getUser(db(), me.id)) await audit(db(), null, me.id, 'Sicherung', `Sicherung ${name} wiederhergestellt (vorher gesichert als ${before.name})`);
    return { ok: true, safety: before.name };
  });

  // --- Export ---------------------------------------------------------------
  app.get('/server/export/:set', async (req, reply) => {
    const me = requireServerAdmin(req);
    const set = (req.params as Record<string, string>).set;
    const def = EXPORT_SETS.find((s) => s.id === set);
    if (!def) throw notFound();
    let companyId: string | null = null;
    if (def.scope === 'company') {
      companyId = z.uuid().safeParse((req.query as Record<string, string>).company).data ?? null;
      if (!companyId) throw badRequest('Firma fehlt.');
      const { rows } = await db().query<{ support: boolean }>('SELECT support_access AS support FROM companies WHERE id = $1', [companyId]);
      if (!rows[0]) throw notFound();
      if (!rows[0].support) throw badRequest('Firmendaten nur, wenn die Firma Support-Zugriff erlaubt hat. Sonst exportiert die Firma selbst.');
      await audit(db(), companyId, me.id, 'Export', `Server-Admin exportiert ${def.label}`);
    }
    await audit(db(), null, me.id, 'Export', `Export ${def.label}`);
    reply.header('Content-Disposition', `attachment; filename="pitstop-${set}.csv"`);
    return reply.type('text/csv; charset=utf-8').send(toCsv(await exportRows(db(), set, companyId)));
  });

  app.get('/server/log', async (req) => {
    requireServerAdmin(req);
    return { entries: await listAudit(db(), null) };
  });

  // --- Ankündigungen (lesen: alle angemeldeten) -----------------------------
  app.get('/announcements', async (req): Promise<{ announcements: Announcement[] }> => {
    requireUser(req);
    const { rows } = await db().query<Announcement>(
      `SELECT a.id, a.title, a.body, a.tone, coalesce(u.display_name, 'Server') AS "authorName", a.created_at AS "createdAt"
         FROM announcements a LEFT JOIN users u ON u.id = a.author_id ORDER BY a.created_at DESC LIMIT 30`,
    );
    return { announcements: rows };
  });
  app.post('/announcements', async (req) => {
    const me = requireServerAdmin(req);
    const b = parseBody(z.object({ title: zRequired(120), body: zText(2000).default(''), tone: z.enum(['info', 'warn']).default('info') }), req.body);
    await db().query('INSERT INTO announcements (title, body, tone, author_id) VALUES ($1, $2, $3, $4)', [b.title, b.body, b.tone, me.id]);
    return { ok: true };
  });
  app.delete('/announcements/:id', async (req) => {
    requireServerAdmin(req);
    await db().query('DELETE FROM announcements WHERE id = $1', [idParam(req)]);
    return { ok: true };
  });
}
