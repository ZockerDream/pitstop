// Fotos zu Aufträgen (Fahrzeugannahme, Schäden): Dateien in data/photos/<firma>/<id>.<endung>, Zeile in order_photos.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { companyCtx, type Ctx } from '../auth/guards';
import type { Config } from '../config';
import { db } from '../db/pool';
import { badRequest, conflict, forbidden, notFound } from '../errors';
import { audit } from '../repo/companies';
import { getRow } from '../repo/records';
import { idParam, type RouteOptions } from './util';

const TYPES: Record<string, 'jpg' | 'png' | 'webp'> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const MIME = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' } as const;
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_PER_ORDER = 20;

export const photoDir = (cfg: Config, companyId: string) => path.join(cfg.dataDir, 'photos', companyId);
export const photoFile = (cfg: Config, companyId: string, id: string, ext: string) => path.join(photoDir(cfg, companyId), `${id}.${ext}`);

/** Darf die Person diesen Auftrag sehen (bei „nur eigene“: zugeteilt oder selbst angelegt)? */
function canSeeOrder(c: Ctx, o: { assigneeId: string | null; createdBy: string | null }) {
  return !c.ownOnly('auftraege') || o.assigneeId === c.user.id || o.createdBy === c.user.id;
}

/** Löscht die Dateien der Fotos eines Auftrags (die Zeilen gehen per ON DELETE CASCADE mit). */
export async function removeOrderPhotos(cfg: Config, companyId: string, orderId: string): Promise<void> {
  const { rows } = await db().query<{ id: string; ext: string }>('SELECT id, ext FROM order_photos WHERE company_id = $1 AND order_id = $2', [companyId, orderId]);
  for (const r of rows) rmSync(photoFile(cfg, companyId, r.id, r.ext), { force: true });
}

export async function photoRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.register(async (scope) => {
    scope.addContentTypeParser(Object.keys(TYPES), { parseAs: 'buffer', bodyLimit: MAX_BYTES }, (_req, body, done) => done(null, body));
    scope.put('/c/:companyId/orders/:id/photos', { bodyLimit: MAX_BYTES }, async (req) => {
      const c = await companyCtx(req, cfg);
      c.need('auftraege', 2);
      const ext = TYPES[req.headers['content-type'] ?? ''];
      if (!ext || !Buffer.isBuffer(req.body) || !req.body.length) throw badRequest('Bitte ein Foto (JPG, PNG oder WebP, bis 10 MB) hochladen.');
      const order = await getRow(db(), 'orders', c.company.id, idParam(req));
      if (!order || !canSeeOrder(c, order)) throw notFound();
      const n = Number((await db().query<{ n: string }>('SELECT count(*) AS n FROM order_photos WHERE order_id = $1', [order.id])).rows[0].n);
      if (n >= MAX_PER_ORDER) throw conflict(`Höchstens ${MAX_PER_ORDER} Fotos je Auftrag.`);
      const note = String((req.query as { note?: string }).note ?? '').slice(0, 120);
      const { rows } = await db().query<{ id: string }>('INSERT INTO order_photos (company_id, order_id, ext, size, note, created_by) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id', [
        c.company.id, order.id, ext, req.body.length, note, c.user.id,
      ]);
      mkdirSync(photoDir(cfg, c.company.id), { recursive: true });
      writeFileSync(photoFile(cfg, c.company.id, rows[0].id, ext), req.body);
      await audit(db(), c.company.id, c.user.id, 'Werkstatt', `Foto zu W-${order.number} hochgeladen`);
      return { id: rows[0].id };
    });
  });

  app.get('/c/:companyId/photos/:id', async (req, reply) => {
    const c = await companyCtx(req, cfg);
    c.need('auftraege', 1);
    const p = (await db().query<{ id: string; ext: 'jpg' | 'png' | 'webp'; orderId: string }>('SELECT id, ext, order_id AS "orderId" FROM order_photos WHERE company_id = $1 AND id = $2', [c.company.id, idParam(req)])).rows[0];
    if (!p) throw notFound();
    const order = await getRow(db(), 'orders', c.company.id, p.orderId);
    if (!order || !canSeeOrder(c, order)) throw notFound();
    let data: Buffer;
    try {
      data = readFileSync(photoFile(cfg, c.company.id, p.id, p.ext));
    } catch {
      throw notFound('Die Bilddatei fehlt (z. B. nach dem Wiederherstellen einer Sicherung).');
    }
    reply.header('Cache-Control', 'private, max-age=86400');
    return reply.type(MIME[p.ext]).send(data);
  });

  app.delete('/c/:companyId/photos/:id', async (req) => {
    const c = await companyCtx(req, cfg);
    c.need('auftraege', 2);
    const p = (await db().query<{ id: string; ext: string; createdBy: string | null }>('SELECT id, ext, created_by AS "createdBy" FROM order_photos WHERE company_id = $1 AND id = $2', [c.company.id, idParam(req)])).rows[0];
    if (!p) throw notFound();
    if (p.createdBy !== c.user.id && c.rights.areas.auftraege.level < 3) throw forbidden('Nur eigene Fotos löschen.');
    await db().query('DELETE FROM order_photos WHERE id = $1', [p.id]);
    rmSync(photoFile(cfg, c.company.id, p.id, p.ext), { force: true });
    return { ok: true };
  });
}
