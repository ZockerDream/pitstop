import { buildApp } from './app';
import { ConfigError, loadConfig } from './config';
import { initialize } from './db/init';
import { closePool, initPool } from './db/pool';
import { FatalError } from './errors';
import { createLogger } from './logger';

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main(): Promise<void> {
  let cfg;
  try {
    cfg = loadConfig();
  } catch (err) {
    console.error(err instanceof ConfigError ? err.message : err);
    process.exit(1);
  }

  const log = createLogger(cfg);
  initPool(cfg);

  try {
    await initialize(cfg, log);
  } catch (err) {
    const message = err instanceof FatalError ? err.message : `Start fehlgeschlagen: ${(err as Error).message}`;
    console.error(message);
    log.fatal({ err }, message);
    await pause(300);
    await closePool();
    process.exit(1);
  }

  const app = await buildApp(cfg, log);
  await app.listen({ host: '0.0.0.0', port: cfg.port });
  log.info(`Pitstop läuft auf Port ${cfg.port}, öffentliche Adresse ${cfg.publicUrl}${cfg.demoMode ? ' (Demo-Modus)' : ''}`);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info(`${signal} empfangen, Pitstop wird beendet …`);
    await app.close();
    await closePool();
    await pause(200);
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

void main();
