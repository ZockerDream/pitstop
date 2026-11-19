import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { LegalInfo } from '../../shared/types';
import type { Config } from '../config';
import { db } from '../db/pool';
import { notFound } from '../errors';
import { getCompany } from '../repo/settings';
import type { RouteOptions } from './util';

const LOGO_FILES: [string, string][] = [
  ['logo.svg', 'image/svg+xml'],
  ['logo.png', 'image/png'],
  ['logo.webp', 'image/webp'],
  ['logo.jpg', 'image/jpeg'],
];

export function findLogo(cfg: Config): { file: string; type: string } | null {
  for (const [name, type] of LOGO_FILES) {
    const file = path.join(cfg.confDir, name);
    if (existsSync(file)) return { file, type };
  }
  return null;
}

function readDatenschutz(cfg: Config): string | null {
  const file = path.join(cfg.confDir, 'datenschutz.md');
  try {
    return existsSync(file) ? readFileSync(file, 'utf8') : null;
  } catch {
    return null;
  }
}

export async function publicRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.get('/public/legal', async (): Promise<LegalInfo> => {
    const company = await getCompany(db()).catch(() => null);
    return {
      companyName: company?.name || cfg.impressum?.name || 'Pitstop',
      hasLogo: findLogo(cfg) !== null,
      demoMode: cfg.demoMode,
      impressum: cfg.impressum,
      datenschutz: readDatenschutz(cfg),
    };
  });

  app.get('/public/logo', async (_req, reply) => {
    const logo = findLogo(cfg);
    if (!logo) throw notFound('Kein Logo hinterlegt.');
    reply.header('Cache-Control', 'no-cache');
    reply.header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'");
    return reply.type(logo.type).send(readFileSync(logo.file));
  });

  app.get('/health', async (_req, reply) => {
    try {
      await db().query('SELECT 1');
      return { ok: true, db: true };
    } catch {
      return reply.code(503).send({ ok: false, db: false });
    }
  });
}
