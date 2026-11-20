import type { FastifyInstance, FastifyRequest } from 'fastify';
import { today } from '../../shared/dates';
import { hasSpecial, type Area, type Rights, type SpecialKey } from '../../shared/permissions';
import type { Company, User } from '../../shared/types';
import type { Config } from '../config';
import { db } from '../db/pool';
import { forbidden, HttpError, notFound, unauthorized } from '../errors';
import { getCompany, rightsFor } from '../repo/companies';
import { serverSettings } from '../settings';
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
      // Wartungsmodus: nur Server-Admins arbeiten weiter; Abmelden und „wer bin ich“ bleiben erlaubt.
      const m = serverSettings();
      if (m.maintenance && !session.user.isServerAdmin && !/^\/api\/(auth\/(logout|me)|public\/|health)/.test(req.url)) {
        throw new HttpError(503, 'MAINTENANCE', m.maintenanceText);
      }
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

export function requireServerAdmin(req: FastifyRequest): User {
  const user = requireUser(req);
  if (!user.isServerAdmin) throw forbidden('Nur für Server-Admins.');
  return user;
}

/** Firmenkontext einer Anfrage unter /api/c/:companyId/… */
export interface Ctx {
  user: User;
  company: Company;
  rights: Rights;
  /** Mindeststufe für einen Bereich, sonst 403. */
  need(area: Area, min?: 1 | 2 | 3): void;
  needSpecial(key: SpecialKey): void;
  /** true, wenn der Bereich auf „nur eigene“ begrenzt ist. */
  ownOnly(area: Area): boolean;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function companyCtx(req: FastifyRequest, cfg: Config): Promise<Ctx> {
  const user = requireUser(req);
  const id = (req.params as Record<string, string>).companyId;
  if (!id || !UUID.test(id)) throw notFound();
  const company = await getCompany(db(), id, cfg.dataDir);
  if (!company) throw notFound('Firma nicht gefunden.');
  const rights = await rightsFor(db(), company, user.id, user.isServerAdmin, today());
  if (!rights) throw forbidden('Kein Zugang zu dieser Firma.');
  if (company.status === 'paused' && !rights.owner && !user.isServerAdmin) throw forbidden('Diese Firma ist pausiert.');
  return {
    user,
    company,
    rights,
    need(area, min = 1) {
      const r = rights.areas[area];
      if (r.level < min) throw forbidden(r.locked ? `Gesperrt durch: ${r.source}` : 'Dafür fehlt die Berechtigung.');
    },
    needSpecial(key) {
      if (!hasSpecial(rights, key)) throw forbidden('Dafür fehlt das Sonderrecht.');
    },
    ownOnly(area) {
      return rights.areas[area].own;
    },
  };
}
