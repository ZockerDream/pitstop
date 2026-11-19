import type { FastifyInstance, FastifyRequest } from 'fastify';
import { can, type Permission } from '../../shared/permissions';
import type { User } from '../../shared/types';
import type { Config } from '../config';
import { forbidden, HttpError, unauthorized } from '../errors';
import { clearSessionCookie, findSession, SESSION_COOKIE } from './sessions';

declare module 'fastify' {
  interface FastifyRequest {
    user: User | null;
    sessionTokenHash: string | null;
  }
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Liest die Sitzung aus dem Cookie und prüft bei schreibenden Anfragen die Herkunft (CSRF-Schutz). */
export function registerAuth(app: FastifyInstance, cfg: Config): void {
  app.decorateRequest('user', null);
  app.decorateRequest('sessionTokenHash', null);

  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return;
    if (!SAFE_METHODS.has(req.method)) checkOrigin(req, cfg);
    const token = req.cookies[SESSION_COOKIE];
    if (!token) return;
    const session = await findSession(token);
    if (session) {
      req.user = session.user;
      req.sessionTokenHash = session.tokenHash;
    } else {
      clearSessionCookie(reply);
    }
  });
}

function checkOrigin(req: FastifyRequest, cfg: Config): void {
  const origin = req.headers.origin;
  if (!origin || origin === 'null') return;
  if (origin === cfg.origin) return;
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.headers.host;
  try {
    if (host && new URL(origin).host === host) return;
  } catch {
    // ungültiger Origin-Header → ablehnen
  }
  throw new HttpError(403, 'ORIGIN', 'Anfrage von fremder Herkunft abgelehnt.');
}

/** Angemeldeter Benutzer, der sein Startpasswort bereits geändert hat. */
export function requireUser(req: FastifyRequest): User {
  if (!req.user) throw unauthorized();
  if (req.user.mustChangePassword) {
    throw new HttpError(403, 'PASSWORD_CHANGE_REQUIRED', 'Bitte zuerst ein neues Passwort festlegen.');
  }
  return req.user;
}

export function requirePermission(req: FastifyRequest, permission: Permission): User {
  const user = requireUser(req);
  if (!can(user.role, permission)) throw forbidden();
  return user;
}
