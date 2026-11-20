import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import cookie from '@fastify/cookie';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyBaseLogger, type FastifyError, type FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { registerAuth } from './auth/guards';
import type { Config } from './config';
import { HttpError } from './errors';
import { authRoutes } from './routes/auth';
import { companyRoutes } from './routes/company';
import { demoRoutes } from './routes/demo';
import { publicRoutes } from './routes/public';
import { serverRoutes } from './routes/server';
import { moduleRoutes } from './routes/modules';
import { moreRoutes } from './routes/more';
import { platformRoutes } from './routes/platform';
import { discordRoutes } from './routes/discord';
import { gameRoutes } from './routes/game';
import { photoRoutes } from './routes/photos';
import { workRoutes } from './routes/work';

// LogController ersetzt ab Fastify 5.x die Option disableRequestLogging, ist aber (noch) nicht typisiert.
const require = createRequire(import.meta.url);
const { LogController } = require('fastify') as { LogController?: new (opts: { disableRequestLogging: boolean }) => unknown };

export async function buildApp(cfg: Config, log: Logger): Promise<FastifyInstance> {
  const requestLogging = LogController
    ? { logController: new LogController({ disableRequestLogging: true }) }
    : { disableRequestLogging: true };
  const app = Fastify({
    loggerInstance: log as unknown as FastifyBaseLogger,
    trustProxy: 'loopback, linklocal, uniquelocal',
    bodyLimit: 1024 * 1024,
    ...(requestLogging as object),
  });

  // Nur JSON-Bodies: Formulare fremder Seiten (text/plain, urlencoded) werden abgelehnt.
  app.removeContentTypeParser('text/plain');

  await app.register(cookie);
  await app.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: cfg.secureCookies ? [] : null,
      },
    },
    hsts: cfg.secureCookies ? { maxAge: 15552000 } : false,
    crossOriginEmbedderPolicy: false,
  });
  await app.register(rateLimit, { global: false });

  registerAuth(app, cfg);

  app.addHook('onResponse', async (req, reply) => {
    if (!req.url.startsWith('/api/') || req.url === '/api/health') return;
    req.log.info({ method: req.method, url: req.url, status: reply.statusCode, ms: Math.round(reply.elapsedTime) }, 'Anfrage');
  });

  app.setErrorHandler((err: FastifyError & { code?: string }, req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.status).send({ error: { code: err.code, message: err.message, fields: err.fields } });
    }
    if (err.statusCode === 429) {
      return reply.code(429).send({ error: { code: 'RATE_LIMIT', message: 'Zu viele Versuche. Bitte in einigen Minuten erneut versuchen.' } });
    }
    if (err.code === '23505') {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Dieser Eintrag existiert bereits.' } });
    }
    if (err.code === '23503') {
      return reply.code(409).send({ error: { code: 'CONFLICT', message: 'Der Eintrag verweist auf etwas, das es nicht (mehr) gibt.' } });
    }
    if (err.statusCode && err.statusCode >= 400 && err.statusCode < 500) {
      const message =
        err.statusCode === 415 ? 'Nur JSON-Anfragen werden akzeptiert.' : err.statusCode === 413 ? 'Die Anfrage ist zu groß.' : 'Ungültige Anfrage.';
      return reply.code(err.statusCode).send({ error: { code: err.code ?? 'BAD_REQUEST', message } });
    }
    req.log.error({ err }, 'Unerwarteter Fehler');
    return reply.code(500).send({ error: { code: 'INTERNAL', message: 'Interner Fehler. Details stehen im Log.' } });
  });

  const opts = { cfg };
  await app.register(
    async (api) => {
      await api.register(publicRoutes, opts);
      await api.register(authRoutes, opts);
      await api.register(companyRoutes, opts);
      await api.register(workRoutes, opts);
      await api.register(moduleRoutes, opts);
      await api.register(moreRoutes, opts);
      await api.register(platformRoutes, opts);
      await api.register(discordRoutes, opts);
      await api.register(gameRoutes, opts);
      await api.register(photoRoutes, opts);
      await api.register(serverRoutes, opts);
      await api.register(demoRoutes, opts);
    },
    { prefix: '/api' },
  );

  // Ausgelieferte SPA (nur nach `npm run build`; lokal liefert Vite den Client aus).
  const clientDir = path.join(process.cwd(), 'dist', 'client');
  const hasClient = existsSync(path.join(clientDir, 'index.html'));
  if (hasClient) {
    await app.register(fastifyStatic, {
      root: clientDir,
      prefix: '/',
      index: ['index.html'],
      setHeaders(reply, filePath) {
        const immutable = filePath.includes(`${path.sep}assets${path.sep}`);
        reply.header('Cache-Control', immutable ? 'public, max-age=31536000, immutable' : 'no-cache');
      },
    });
  }

  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/') || !hasClient) {
      return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Nicht gefunden.' } });
    }
    reply.header('Cache-Control', 'no-cache');
    return reply.sendFile('index.html');
  });

  return app;
}
