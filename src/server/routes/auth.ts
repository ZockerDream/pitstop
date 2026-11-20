import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MIN_PASSWORD_LENGTH, hashPassword, verifyDummy, verifyPassword } from '../auth/password';
import { clearSessionCookie, createSession, deleteSessionByHash, deleteUserSessions, setSessionCookie } from '../auth/sessions';
import { db } from '../db/pool';
import { badRequest, conflict, HttpError, parseBody, unauthorized } from '../errors';
import { newSecret, otpauthUrl, verifyTotp } from '../auth/totp';
import { audit } from '../repo/companies';
import { APP_VERSION } from '../../shared/version';
import type { MeData } from '../../shared/types';
import { requireUser } from '../auth/guards';
import { companiesOfUser } from '../repo/companies';
import { getPasswordHash, getUserWithHashByEmail, setPassword, touchLogin, updateUser } from '../repo/users';
import { serverSettings } from '../settings';
import type { RouteOptions } from './util';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Bitte E-Mail-Adresse eingeben').max(200),
  password: z.string().min(1, 'Bitte Passwort eingeben').max(500),
  remember: z.boolean().optional().default(false),
  /** Code aus der Authenticator-App, nur bei aktiver Zwei-Faktor-Anmeldung */
  code: z.string().trim().max(12).optional(),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Bitte das bisherige Passwort eingeben').max(500),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen`).max(500, 'Höchstens 500 Zeichen'),
});

const profileSchema = z.object({
  displayName: z.string().trim().min(1, 'Pflichtfeld').max(80).optional(),
  discord: z.string().trim().max(60).optional(),
  prefs: z
    .object({
      skin: z.enum(['boxengasse', 'nacht', 'racinggreen', 'hell', 'lemans', 'auto']).optional(),
      density: z.enum(['bequem', 'kompakt']).optional(),
      nav: z.enum(['breit', 'schmal']).optional(),
      text: z.enum(['normal', 'groß', 'sehr groß']).optional(),
      motion: z.enum(['normal', 'reduziert']).optional(),
      start: z.string().max(40).optional(),
      widgets: z.array(z.string().regex(/^[a-z-]{1,30}:\d{1,2}$/)).max(30).optional(),
      boards: z
        .array(z.object({ id: z.string().regex(/^b-[a-z0-9]{1,16}$/), name: z.string().trim().min(1, 'Name fehlt').max(40), widgets: z.array(z.string().regex(/^[a-z-]{1,30}:\d{1,2}$/)).max(30) }))
        .max(12)
        .optional(),
    })
    .optional(),
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
    if (user.totpEnabled) {
      if (!body.code) throw new HttpError(401, 'TOTP_REQUIRED', 'Bitte den Code aus der Authenticator-App eingeben.');
      const t = (await db().query<{ secret: string; last: string }>('SELECT totp_secret AS secret, totp_last_step AS last FROM users WHERE id = $1', [user.id])).rows[0];
      const step = verifyTotp(t.secret, body.code, Number(t.last));
      if (step === null) throw new HttpError(401, 'TOTP_INVALID', 'Der Code stimmt nicht (oder wurde schon benutzt).');
      await db().query('UPDATE users SET totp_last_step = $2 WHERE id = $1', [user.id, step]);
    }
    const m = serverSettings();
    if (m.maintenance && !user.isServerAdmin) throw new HttpError(503, 'MAINTENANCE', m.maintenanceText);
    if (req.sessionTokenHash) await deleteSessionByHash(req.sessionTokenHash);
    const token = await createSession(user.id, body.remember, req.headers['user-agent'] ?? '');
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

  app.get('/me', async (req): Promise<MeData> => {
    const user = requireUser(req);
    return { user, companies: await companiesOfUser(db(), user.id, user.isServerAdmin), demoMode: cfg.demoMode, version: APP_VERSION };
  });

  app.patch('/me', async (req) => {
    const user = requireUser(req);
    const body = parseBody(profileSchema, req.body);
    return { user: await updateUser(db(), user.id, { ...body, prefs: body.prefs ? { ...user.prefs, ...body.prefs } : undefined }) };
  });

  // Angemeldete Geräte: Kennung = Anfang des Sitzungs-Hashes (nicht das Token selbst)
  app.get('/me/sessions', async (req) => {
    const user = requireUser(req);
    const { rows } = await db().query<{ id: string; agent: string; createdAt: string; lastSeenAt: string; current: boolean }>(
      `SELECT left(token_hash, 16) AS id, user_agent AS agent, created_at AS "createdAt", last_seen_at AS "lastSeenAt", token_hash = $2 AS current
         FROM sessions WHERE user_id = $1 AND expires_at > now() ORDER BY last_seen_at DESC`,
      [user.id, req.sessionTokenHash],
    );
    return { sessions: rows };
  });
  app.delete('/me/sessions/:id', async (req) => {
    const user = requireUser(req);
    const id = (req.params as Record<string, string>).id;
    if (!/^[0-9a-f]{16}$/.test(id)) throw badRequest('Ungültige Kennung.');
    await db().query('DELETE FROM sessions WHERE user_id = $1 AND left(token_hash, 16) = $2 AND token_hash <> $3', [user.id, id, req.sessionTokenHash]);
    return { ok: true };
  });

  // --- Zwei-Faktor-Anmeldung (TOTP) -----------------------------------------
  app.post('/me/totp/setup', async (req) => {
    const user = requireUser(req);
    if (user.totpEnabled) throw conflict('Zwei-Faktor ist schon eingerichtet.');
    const secret = newSecret();
    await db().query('UPDATE users SET totp_secret = $2, totp_last_step = 0 WHERE id = $1', [user.id, secret]);
    return { secret, url: otpauthUrl(secret, user.email) };
  });
  app.post('/me/totp/enable', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req) => {
    const user = requireUser(req);
    const { code } = parseBody(z.object({ code: z.string().trim().max(12) }), req.body);
    const t = (await db().query<{ secret: string | null }>('SELECT totp_secret AS secret FROM users WHERE id = $1', [user.id])).rows[0];
    if (!t?.secret) throw conflict('Erst „Einrichten“ wählen.');
    const step = verifyTotp(t.secret, code);
    if (step === null) throw badRequest('Der Code stimmt nicht. Uhrzeit am Handy prüfen und den aktuellen Code eingeben.', { code: 'Code stimmt nicht' });
    await db().query('UPDATE users SET totp_enabled = true, totp_last_step = $2 WHERE id = $1', [user.id, step]);
    await audit(db(), null, user.id, 'Konten', 'Zwei-Faktor-Anmeldung eingeschaltet');
    return { ok: true };
  });
  app.post('/me/totp/disable', { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } }, async (req) => {
    const user = requireUser(req);
    const { password, code } = parseBody(z.object({ password: z.string().min(1, 'Passwort fehlt').max(500), code: z.string().trim().max(12) }), req.body);
    const t = (await db().query<{ secret: string | null; last: string; hash: string }>('SELECT totp_secret AS secret, totp_last_step AS last, password_hash AS hash FROM users WHERE id = $1', [user.id])).rows[0];
    if (!user.totpEnabled || !t.secret) throw conflict('Zwei-Faktor ist nicht eingeschaltet.');
    if (!(await verifyPassword(password, t.hash))) throw badRequest('Passwort stimmt nicht.', { password: 'Passwort stimmt nicht' });
    if (verifyTotp(t.secret, code, Number(t.last)) === null) throw badRequest('Der Code stimmt nicht.', { code: 'Code stimmt nicht' });
    await db().query('UPDATE users SET totp_enabled = false, totp_secret = NULL WHERE id = $1', [user.id]);
    await audit(db(), null, user.id, 'Konten', 'Zwei-Faktor-Anmeldung ausgeschaltet');
    return { ok: true };
  });

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
