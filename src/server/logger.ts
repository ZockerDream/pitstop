import { accessSync, constants, mkdirSync } from 'node:fs';
import path from 'node:path';
import pino, { type Logger, type TransportTargetOptions } from 'pino';
import type { Config } from './config';

/** JSON-Logs auf stdout (docker compose logs) und täglich rotiert nach logs/ (14 Dateien). */
export function createLogger(cfg: Pick<Config, 'logLevel' | 'logsDir'>): Logger {
  const targets: TransportTargetOptions[] = [{ target: 'pino/file', level: cfg.logLevel, options: { destination: 1 } }];
  let fileWarning: string | null = null;
  try {
    mkdirSync(cfg.logsDir, { recursive: true });
    accessSync(cfg.logsDir, constants.W_OK);
    targets.push({
      target: 'pino-roll',
      level: cfg.logLevel,
      options: {
        file: path.join(cfg.logsDir, 'pitstop'),
        frequency: 'daily',
        dateFormat: 'yyyy-MM-dd',
        mkdir: true,
        limit: { count: 13 },
      },
    });
  } catch (err) {
    fileWarning = `Log-Verzeichnis ${cfg.logsDir} ist nicht beschreibbar, Logs nur auf stdout: ${(err as Error).message}`;
  }
  const logger = pino(
    {
      level: cfg.logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
      redact: ['req.headers.cookie', 'req.headers.authorization', '*.password', '*.currentPassword', '*.newPassword'],
    },
    pino.transport({ targets }),
  );
  if (fileWarning) logger.warn(fileWarning);
  return logger;
}
