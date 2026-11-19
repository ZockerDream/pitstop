import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { today } from '../../shared/dates';
import { requireUser } from '../auth/guards';
import { clearSessionCookie, createSession, deleteSessionByHash, setSessionCookie } from '../auth/sessions';
import { createAdminFromEnv } from '../db/init';
import { db, tx } from '../db/pool';
import { seedDemo, wipeAll } from '../demo/seed';
import { notFound, parseBody } from '../errors';
import { getDemoUserId, getUser, touchLogin } from '../repo/users';
import type { RouteOptions } from './util';

const loginSchema = z.object({ persona: z.enum(['admin', 'employee']) });

/** Nur im Demo-Modus; sonst antworten die Endpunkte mit 404. */
export async function demoRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.post('/demo/login', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!cfg.demoMode) throw notFound();
    const { persona } = parseBody(loginSchema, req.body);
    const userId = await getDemoUserId(db(), persona);
    if (!userId) throw notFound('Demo-Benutzer nicht gefunden. Bitte die Demo-Daten zurücksetzen.');
    if (req.sessionTokenHash) await deleteSessionByHash(req.sessionTokenHash);
    const token = await createSession(userId, false);
    await touchLogin(db(), userId);
    setSessionCookie(reply, token, false, cfg.secureCookies);
    return { user: await getUser(db(), userId) };
  });

  app.post('/demo/reset', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    if (!cfg.demoMode) throw notFound();
    requireUser(req);
    await tx(async (c) => {
      await wipeAll(c);
      await seedDemo(c, today());
      if (cfg.adminEmail && cfg.adminPassword) await createAdminFromEnv(c, cfg);
    });
    req.log.info('Demo-Daten zurückgesetzt');
    clearSessionCookie(reply);
    return reply.code(204).send();
  });
}
