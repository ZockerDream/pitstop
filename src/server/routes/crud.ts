// Gemeinsamer Baustein für einfache Firmenlisten: Anlegen, Ändern, Löschen mit Bereichsrecht, Verknüpfungsprüfung und Protokoll.
import type { FastifyInstance } from 'fastify';
import type { z } from 'zod';
import type { Area } from '../../shared/permissions';
import { companyCtx, type Ctx } from '../auth/guards';
import type { Config } from '../config';
import { db, type Queryable } from '../db/pool';
import { badRequest, notFound, parseBody } from '../errors';
import { audit, getMembership } from '../repo/companies';
import { deleteRow, getRow, insertRow, updateRow, type Kind, type RowOf } from '../repo/records';
import { idParam } from './util';

/** Verknüpfte Felder: Tabelle (gleiche Firma) oder 'member' (Mitglied der Firma). */
export type Refs = Record<string, Kind | 'member'>;

export async function checkRefs(q: Queryable, companyId: string, refs: Refs, body: Record<string, unknown>): Promise<void> {
  for (const [field, target] of Object.entries(refs)) {
    const v = body[field];
    if (typeof v !== 'string' || !v) continue;
    if (target === 'member') {
      if (!(await getMembership(q, companyId, v))) throw badRequest('Diese Person ist nicht in der Firma.', { [field]: 'Nicht in der Firma' });
    } else if (!(await getRow(q, target, companyId, v))) throw badRequest('Verknüpfung gehört nicht zu dieser Firma.', { [field]: 'Unbekannt' });
  }
}

export interface CrudOpts<K extends Kind> {
  kind: K;
  path: string;
  area: Area;
  /** Bereich im Protokoll (und Live-Feed) */
  log: string;
  name: (row: RowOf[K]) => string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schema: z.ZodObject<any>;
  refs?: Refs;
  /** Stufe zum Anlegen/Ändern (Standard 2) und Löschen (Standard 3) */
  write?: 2 | 3;
  remove?: 2 | 3;
  /** Zusatzfelder beim Anlegen (z. B. createdBy) */
  extra?: (c: Ctx) => Record<string, unknown>;
  /** Eigene Prüfung vor dem Schreiben */
  check?: (c: Ctx, body: Record<string, unknown>, old: RowOf[K] | null) => Promise<void> | void;
  /** Ohne Protokoll beim Ändern (z. B. häufige Kleinigkeiten) */
  quietPatch?: boolean;
}

export function crud<K extends Kind>(app: FastifyInstance, cfg: Config, o: CrudOpts<K>): void {
  const base = `/c/:companyId/${o.path}`;
  app.post(base, async (req) => {
    const c = await companyCtx(req, cfg);
    c.need(o.area, o.write ?? 2);
    const b = parseBody(o.schema, req.body) as Record<string, unknown>;
    await checkRefs(db(), c.company.id, o.refs ?? {}, b);
    await o.check?.(c, b, null);
    const row = await insertRow(db(), o.kind, c.company.id, { ...b, ...(o.extra?.(c) ?? {}) });
    await audit(db(), c.company.id, c.user.id, o.log, `${o.name(row)} angelegt`);
    return row;
  });
  app.patch(`${base}/:id`, async (req) => {
    const c = await companyCtx(req, cfg);
    c.need(o.area, o.write ?? 2);
    const old = await getRow(db(), o.kind, c.company.id, idParam(req));
    if (!old) throw notFound();
    const b = parseBody(o.schema.partial(), req.body) as Record<string, unknown>;
    await checkRefs(db(), c.company.id, o.refs ?? {}, b);
    await o.check?.(c, b, old);
    const row = await updateRow(db(), o.kind, c.company.id, (old as { id: string }).id, b);
    if (!o.quietPatch) await audit(db(), c.company.id, c.user.id, o.log, `${o.name(row!)} geändert`);
    return row;
  });
  app.delete(`${base}/:id`, async (req) => {
    const c = await companyCtx(req, cfg);
    c.need(o.area, o.remove ?? 3);
    const old = await getRow(db(), o.kind, c.company.id, idParam(req));
    if (!old) throw notFound();
    await o.check?.(c, {}, old);
    await deleteRow(db(), o.kind, c.company.id, (old as { id: string }).id);
    await audit(db(), c.company.id, c.user.id, o.log, `${o.name(old)} gelöscht`);
    return { ok: true };
  });
}
