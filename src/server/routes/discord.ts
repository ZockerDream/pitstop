// Anmeldung mit Discord (OAuth2 „authorization code“, Scope identify). Nur für Konten, die ihr Discord-Konto unter
// „Mein Konto“ verknüpft haben – Discord legt keine Konten an. Aktiv, wenn DISCORD_CLIENT_ID und DISCORD_CLIENT_SECRET gesetzt sind.
import { randomBytes } from 'node:crypto';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { requireUser } from '../auth/guards';
import { createSession, setSessionCookie } from '../auth/sessions';
import { db } from '../db/pool';
import { notFound, parseBody } from '../errors';
import { audit } from '../repo/companies';
import { touchLogin } from '../repo/users';
import { serverSettings } from '../settings';
import type { RouteOptions } from './util';

/** Rücksprung in die App mit Ergebnis als Abfrageparameter (die Anmeldeseite bzw. „Mein Konto“ zeigt es an). */
const back = (reply: FastifyReply, result: string, hash = '') => reply.redirect(`/?discord=${encodeURIComponent(result)}${hash}`, 302);

export async function discordRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  const redirectUri = `${cfg.publicUrl.replace(/\/$/, '')}/api/auth/discord/callback`;

  app.get('/auth/discord/start', async (req, reply) => {
    const d = cfg.discord;
    if (!d) throw notFound('Anmeldung mit Discord ist auf diesem Server nicht eingerichtet.');
    const q = req.query as { mode?: string; remember?: string };
    const mode = q.mode === 'link' ? 'link' : 'login';
    const userId = mode === 'link' ? requireUser(req).id : null;
    const state = randomBytes(24).toString('base64url');
    await db().query("DELETE FROM oauth_states WHERE created_at < now() - interval '10 minutes'");
    await db().query('INSERT INTO oauth_states (state, purpose, user_id, remember) VALUES ($1, $2, $3, $4)', [state, mode, userId, q.remember === '1']);
    const url = new URL(`${d.api}/oauth2/authorize`);
    url.search = new URLSearchParams({ response_type: 'code', client_id: d.clientId, scope: 'identify', state, redirect_uri: redirectUri, prompt: 'consent' }).toString();
    return reply.redirect(url.toString(), 302);
  });

  app.get('/auth/discord/callback', async (req, reply) => {
    const d = cfg.discord;
    if (!d) throw notFound();
    const q = req.query as { code?: string; state?: string; error?: string };
    if (q.error) return back(reply, 'abgebrochen');
    const st = q.state ? (await db().query<{ purpose: 'login' | 'link'; userId: string | null; remember: boolean }>(
      `DELETE FROM oauth_states WHERE state = $1 AND created_at > now() - interval '10 minutes' RETURNING purpose, user_id AS "userId", remember`, [q.state],
    )).rows[0] : undefined;
    if (!st || !q.code) return back(reply, 'ungueltig');
    // Code gegen Token tauschen, dann die Discord-ID holen
    let discordId: string, name: string;
    try {
      const tok = await fetch(`${d.api}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ client_id: d.clientId, client_secret: d.clientSecret, grant_type: 'authorization_code', code: q.code, redirect_uri: redirectUri }),
        signal: AbortSignal.timeout(8000),
      });
      if (!tok.ok) throw new Error(`Token ${tok.status}`);
      const { access_token } = (await tok.json()) as { access_token: string };
      const me = await fetch(`${d.api}/users/@me`, { headers: { Authorization: `Bearer ${access_token}` }, signal: AbortSignal.timeout(8000) });
      if (!me.ok) throw new Error(`Profil ${me.status}`);
      const p = (await me.json()) as { id: string; username: string };
      discordId = String(p.id);
      name = String(p.username ?? '').slice(0, 60);
    } catch (err) {
      req.log.warn({ err }, 'Discord-Anmeldung fehlgeschlagen');
      return back(reply, 'fehler');
    }
    if (!/^\d{5,30}$/.test(discordId)) return back(reply, 'fehler');

    if (st.purpose === 'link') {
      const taken = await db().query('SELECT 1 FROM users WHERE discord_id = $1 AND id <> $2', [discordId, st.userId]);
      if (taken.rowCount) return back(reply, 'vergeben', '#konto');
      await db().query("UPDATE users SET discord_id = $2, discord = CASE WHEN discord = '' THEN $3 ELSE discord END WHERE id = $1", [st.userId, discordId, name]);
      await audit(db(), null, st.userId, 'Konten', 'Discord-Konto verknüpft');
      return back(reply, 'verknuepft', '#konto');
    }

    const u = (await db().query<{ id: string; active: boolean; admin: boolean; totp: boolean }>(
      'SELECT id, active, is_server_admin AS admin, totp_enabled AS totp FROM users WHERE discord_id = $1', [discordId],
    )).rows[0];
    if (!u || !u.active) return back(reply, 'unbekannt');
    // Zwei-Faktor gilt auch hier: solche Konten melden sich mit E-Mail, Passwort und Code an.
    if (u.totp) return back(reply, 'zweifaktor');
    if (serverSettings().maintenance && !u.admin) return back(reply, 'wartung');
    const token = await createSession(u.id, st.remember, req.headers['user-agent'] ?? '');
    await touchLogin(db(), u.id);
    setSessionCookie(reply, token, st.remember, cfg.secureCookies);
    req.log.info({ userId: u.id }, 'Anmeldung mit Discord');
    return reply.redirect('/', 302);
  });

  app.post('/me/discord/unlink', async (req) => {
    const user = requireUser(req);
    parseBody(z.object({}).passthrough(), req.body ?? {});
    await db().query('UPDATE users SET discord_id = NULL WHERE id = $1', [user.id]);
    await audit(db(), null, user.id, 'Konten', 'Discord-Konto getrennt');
    return { ok: true };
  });
}
