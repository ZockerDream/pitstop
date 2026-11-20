import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/guards';
import { clearSessionCookie, createSession, deleteSessionByHash, setSessionCookie } from '../auth/sessions';
import { createAdminFromEnv } from '../db/init';
import { db, tx } from '../db/pool';
import { DEMO_PERSONAS, seedDemo, wipeAll } from '../demo/seed';
import { notFound, parseBody } from '../errors';
import { touchLogin } from '../repo/users';
import type { RouteOptions } from './util';

const loginSchema = z.object({ persona: z.enum(DEMO_PERSONAS.map((p) => p.key) as [string, ...string[]]) });

/** Nur im Demo-Modus; sonst antworten die Endpunkte mit 404. */
export async function demoRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.get('/demo/personas', async () => {
    if (!cfg.demoMode) throw notFound();
    return { personas: DEMO_PERSONAS.map((p) => ({ key: p.key, name: p.name, rank: p.rank })) };
  });

  app.post('/demo/login', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!cfg.demoMode) throw notFound();
    const { persona } = parseBody(loginSchema, req.body);
    const email = DEMO_PERSONAS.find((p) => p.key === persona)!.email;
    const { rows } = await db().query<{ id: string }>('SELECT id FROM users WHERE email = $1 AND is_demo AND active', [email]);
    if (!rows[0]) throw notFound('Demo-Person nicht gefunden. Bitte Demo zurücksetzen.');
    if (req.sessionTokenHash) await deleteSessionByHash(req.sessionTokenHash);
    const token = await createSession(rows[0].id, false);
    await touchLogin(db(), rows[0].id);
    setSessionCookie(reply, token, false, cfg.secureCookies);
    return { ok: true };
  });

  app.post('/demo/reset', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!cfg.demoMode) throw notFound();
    requireUser(req);
    await tx(async (q) => {
      await wipeAll(q);
      await seedDemo(q);
      await createAdminFromEnv(q, cfg);
    });
    clearSessionCookie(reply);
    return { ok: true };
  });
}
