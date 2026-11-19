import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { Logger } from 'pino';
import { today } from '../../shared/dates';
import { hashPassword, MIN_PASSWORD_LENGTH } from '../auth/password';
import type { Config } from '../config';
import { seedDemo } from '../demo/seed';
import { FatalError } from '../errors';
import { countUsers, insertUser } from '../repo/users';
import { migrate } from './migrate';
import { db, tx } from './pool';
import type { PoolClient } from 'pg';

async function waitForDatabase(log: Logger): Promise<void> {
  const deadline = Date.now() + 60_000;
  let delay = 500;
  for (;;) {
    try {
      await db().query('SELECT 1');
      return;
    } catch (err) {
      if (Date.now() > deadline) {
        throw new FatalError(`Datenbank nicht erreichbar: ${(err as Error).message}`);
      }
      log.info(`Warte auf die Datenbank … (${(err as Error).message})`);
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 2, 5000);
    }
  }
}

function markerPath(cfg: Config): string {
  return path.join(cfg.dataDir, '.initialized');
}

function writeMarker(cfg: Config): void {
  mkdirSync(cfg.dataDir, { recursive: true });
  writeFileSync(markerPath(cfg), `Pitstop eingerichtet am ${new Date().toISOString()}\n`);
}

export async function createAdminFromEnv(client: PoolClient, cfg: Config): Promise<void> {
  if (!cfg.adminEmail || !cfg.adminPassword) {
    throw new FatalError('Es gibt noch keinen Benutzer. Bitte ADMIN_EMAIL und ADMIN_PASSWORD in der .env setzen und neu starten.');
  }
  if (cfg.adminPassword.length < MIN_PASSWORD_LENGTH) {
    throw new FatalError(`ADMIN_PASSWORD muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
  }
  const existing = await client.query('SELECT 1 FROM users WHERE email = lower($1)', [cfg.adminEmail]);
  if (existing.rowCount) return;
  await insertUser(client, {
    email: cfg.adminEmail,
    displayName: 'Administrator',
    role: 'admin',
    employeeId: null,
    passwordHash: await hashPassword(cfg.adminPassword),
    mustChangePassword: true,
  });
}

/** Erststart: Migrationen, erster Admin, ggf. Demo-Daten, Marker data/.initialized (siehe TECHNICAL.md 4.3). */
export async function initialize(cfg: Config, log: Logger): Promise<void> {
  await waitForDatabase(log);
  await migrate(log);
  const users = await countUsers(db());
  if (users === 0) {
    if (existsSync(markerPath(cfg))) {
      throw new FatalError(
        'Datenbank leer, aber Pitstop war schon eingerichtet (data/.initialized existiert). ' +
          'Wahrscheinlich nach einem Postgres-Hauptversionswechsel oder ohne ./db gestartet – siehe README, Abschnitt Update/Sonderfall. ' +
          'Ist eine neue, leere Firma gewollt, die Datei data/.initialized löschen.',
      );
    }
    await tx(async (client) => {
      if (cfg.demoMode) {
        log.info('Demo-Modus: spiele Demo-Daten ein …');
        await seedDemo(client, today());
      }
      await createAdminFromEnv(client, cfg);
    });
    log.info(cfg.demoMode ? 'Pitstop mit Demo-Daten eingerichtet.' : 'Pitstop eingerichtet, Admin aus der .env angelegt.');
  }
  if (!existsSync(markerPath(cfg))) writeMarker(cfg);
}
