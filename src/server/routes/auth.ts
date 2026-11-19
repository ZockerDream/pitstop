import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH, hashPassword, verifyDummy, verifyPassword } from '../auth/password';
import { clearSessionCookie, createSession, deleteSessionByHash, deleteUserSessions, setSessionCookie } from '../auth/sessions';
import { db } from '../db/pool';
import { badRequest, HttpError, parseBody, unauthorized } from '../errors';
import { getPasswordHash, getUserWithHashByEmail, setPassword, touchLogin } from '../repo/users';
import type { RouteOptions } from './util';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Bitte E-Mail-Adresse eingeben').max(200),
  password: z.string().min(1, 'Bitte Passwort eingeben').max(500),
  remember: z.boolean().optional().default(false),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Bitte das bisherige Passwort eingeben').max(500),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`).max(500, 'Höchstens 500 Zeichen'),
});

const invalidCredentials = () => new HttpError(401, 'INVALID_CREDENTIALS', 'E-Mail oder Passwort falsch.');

export async function authRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.post('/auth/login', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req, reply) => {
    const body = parseBody(loginSchema, req.body);
    const user = await getUserWithHashByEmail(db(), body.email);
    if (!user || !user.active) {
      await verifyDummy(body.password);
      throw invalidCredentials();
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) throw invalidCredentials();
    if (req.sessionTokenHash) await deleteSessionByHash(req.sessionTokenHash);
    const token = await createSession(user.id, body.remember);
    await touchLogin(db(), user.id);
    setSessionCookie(reply, token, body.remember, cfg.secureCookies);
    const { passwordHash: _hash, ...safeUser } = user;
    void _hash;
    req.log.info({ userId: user.id }, 'Anmeldung');
    return { user: safeUser };
  });

  app.post('/auth/logout', async (req, reply) => {
    if (req.sessionTokenHash) await deleteSessionByHash(req.sessionTokenHash);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  // Ohne Sitzung 200 mit user: null (kein 401), damit die Browser-Konsole beim Start sauber bleibt.
  app.get('/auth/me', async (req) => ({ user: req.user ?? null, demoMode: cfg.demoMode }));

  app.post('/auth/password', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req) => {
    if (!req.user) throw unauthorized();
    const body = parseBody(passwordSchema, req.body);
    const hash = await getPasswordHash(db(), req.user.id);
    if (!hash || !(await verifyPassword(body.currentPassword, hash))) {
      throw badRequest('Bitte die markierten Angaben prüfen.', { currentPassword: 'Das bisherige Passwort stimmt nicht.' });
    }
    if (body.newPassword === body.currentPassword) {
      throw badRequest('Bitte die markierten Angaben prüfen.', { newPassword: 'Das neue Passwort muss sich vom bisherigen unterscheiden.' });
    }
    const user = await setPassword(db(), req.user.id, await hashPassword(body.newPassword), false);
    await deleteUserSessions(req.user.id, req.sessionTokenHash ?? undefined);
    return { user };
  });
}
