import { existsSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { ImpressumData } from '../shared/types';

// Lokal (ohne NODE_ENV=production) liest der Server .env und .impressum selbst.
// Im Container kommen die Werte über env_file aus docker-compose.yml.
const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  for (const file of ['.env', '.impressum']) {
    if (existsSync(file)) process.loadEnvFile(file);
  }
}

export class ConfigError extends Error {}

const emptyToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const bool = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.enum(['true', 'false', '1', '0', 'yes', 'no', 'ja', 'nein', '']).default('false'),
).transform((v) => ['true', '1', 'yes', 'ja'].includes(v));

const schema = z.object({
  PUBLIC_URL: z.preprocess(emptyToUndefined, z.url({ message: 'muss eine Adresse wie https://pitstop.example.de sein' }).default('http://localhost:8080')),
  PORT: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(3000)),
  DEMO_MODE: bool,
  ADMIN_EMAIL: z.preprocess(emptyToUndefined, z.email({ message: 'ist keine gültige E-Mail-Adresse' }).optional()),
  ADMIN_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  LOG_LEVEL: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'], { message: 'muss debug, info, warn oder error sein' }).default('info'),
  ),
  PGHOST: z.preprocess(emptyToUndefined, z.string().default('localhost')),
  PGPORT: z.preprocess(emptyToUndefined, z.coerce.number().int().default(5432)),
  PGUSER: z.preprocess(emptyToUndefined, z.string().optional()),
  PGPASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  PGDATABASE: z.preprocess(emptyToUndefined, z.string().optional()),
  POSTGRES_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  POSTGRES_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  POSTGRES_DB: z.preprocess(emptyToUndefined, z.string().optional()),
  DISCORD_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().regex(/^\d{5,30}$/, { message: 'muss die Zahlen-ID der Discord-Anwendung sein' }).optional()),
  DISCORD_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().optional()),
  DISCORD_API: z.preprocess(emptyToUndefined, z.url().default('https://discord.com/api')),
});

export interface Config {
  isProduction: boolean;
  publicUrl: string;
  origin: string;
  secureCookies: boolean;
  port: number;
  demoMode: boolean;
  adminEmail?: string;
  adminPassword?: string;
  logLevel: string;
  dataDir: string;
  logsDir: string;
  confDir: string;
  db: { host: string; port: number; user: string; password: string; database: string };
  impressum: ImpressumData | null;
  /** Anmeldung mit Discord, nur wenn Client-ID und Secret gesetzt sind. */
  discord: { clientId: string; clientSecret: string; api: string } | null;
}

const IMPRESSUM_KEYS: Record<keyof ImpressumData, string> = {
  name: 'IMPRESSUM_NAME',
  representedBy: 'IMPRESSUM_VERTRETEN_DURCH',
  street: 'IMPRESSUM_STRASSE',
  zipCity: 'IMPRESSUM_PLZ_ORT',
  phone: 'IMPRESSUM_TELEFON',
  email: 'IMPRESSUM_EMAIL',
  register: 'IMPRESSUM_REGISTER',
  vatId: 'IMPRESSUM_UST_ID',
  responsible: 'IMPRESSUM_VERANTWORTLICH',
  extra: 'IMPRESSUM_ZUSATZ',
};

function readImpressum(env: NodeJS.ProcessEnv): ImpressumData | null {
  const data = {} as ImpressumData;
  let any = false;
  for (const [field, key] of Object.entries(IMPRESSUM_KEYS) as [keyof ImpressumData, string][]) {
    const value = (env[key] ?? '').trim();
    data[field] = value;
    if (value) any = true;
  }
  return any ? data : null;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new ConfigError(`Ungültige Konfiguration in der .env:\n${lines.join('\n')}`);
  }
  const e = parsed.data;
  const password = e.PGPASSWORD ?? e.POSTGRES_PASSWORD;
  if (!password) {
    throw new ConfigError('POSTGRES_PASSWORD ist nicht gesetzt. Bitte in der .env eintragen (siehe README, Abschnitt Konfiguration).');
  }
  const url = new URL(e.PUBLIC_URL);
  const cwd = process.cwd();
  return {
    isProduction,
    publicUrl: e.PUBLIC_URL,
    origin: url.origin,
    secureCookies: url.protocol === 'https:',
    port: e.PORT,
    demoMode: e.DEMO_MODE,
    adminEmail: e.ADMIN_EMAIL?.toLowerCase(),
    adminPassword: e.ADMIN_PASSWORD,
    logLevel: e.LOG_LEVEL,
    dataDir: path.join(cwd, 'data'),
    logsDir: isProduction ? path.join(cwd, 'logs') : path.join(cwd, 'logs', 'app'),
    confDir: path.join(cwd, 'conf'),
    db: {
      host: e.PGHOST,
      port: e.PGPORT,
      user: e.PGUSER ?? e.POSTGRES_USER ?? 'pitstop',
      password,
      database: e.PGDATABASE ?? e.POSTGRES_DB ?? 'pitstop',
    },
    impressum: readImpressum(env),
    discord: e.DISCORD_CLIENT_ID && e.DISCORD_CLIENT_SECRET ? { clientId: e.DISCORD_CLIENT_ID, clientSecret: e.DISCORD_CLIENT_SECRET, api: e.DISCORD_API.replace(/\/$/, '') } : null,
  };
}
