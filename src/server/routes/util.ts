import type { FastifyRequest } from 'fastify';
import type { Config } from '../config';
import { notFound } from '../errors';

export interface RouteOptions {
  cfg: Config;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** ID aus der URL; ungültige IDs ergeben 404 statt eines Datenbankfehlers. */
export function idParam(req: FastifyRequest, name = 'id'): string {
  const value = (req.params as Record<string, string>)[name];
  if (!value || !UUID.test(value)) throw notFound();
  return value;
}
