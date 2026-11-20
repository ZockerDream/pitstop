import { createHash, randomBytes } from 'node:crypto';
import type { FastifyReply } from 'fastify';
import type { User } from '../../shared/types';
import { db } from '../db/pool';
import { userCols } from '../repo/users';

export const SESSION_COOKIE = 'pitstop_session';
const IDLE_MS = 8 * 60 * 60 * 1000;
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
const TOUCH_INTERVAL_MS = 60 * 1000;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, remember: boolean, userAgent = ''): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + (remember ? REMEMBER_MS : IDLE_MS));
  await db().query('DELETE FROM sessions WHERE expires_at < now()');
  await db().query('INSERT INTO sessions (token_hash, user_id, remember, expires_at, user_agent) VALUES ($1, $2, $3, $4, $5)', [
    hashToken(token),
    userId,
    remember,
    expires,
    userAgent.slice(0, 300),
  ]);
  return token;
}

export interface SessionInfo {
  user: User;
  tokenHash: string;
  remember: boolean;
}

export async function findSession(token: string): Promise<SessionInfo | null> {
  const tokenHash = hashToken(token);
  const { rows } = await db().query<User & { remember: boolean; lastSeenAt: string }>(
    `SELECT ${userCols('u')}, s.remember, s.last_seen_at AS "lastSeenAt"
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.active`,
    [tokenHash],
  );
  const row = rows[0];
  if (!row) return null;
  if (Date.now() - new Date(row.lastSeenAt).getTime() > TOUCH_INTERVAL_MS) {
    const expires = new Date(Date.now() + (row.remember ? REMEMBER_MS : IDLE_MS));
    await db().query('UPDATE sessions SET last_seen_at = now(), expires_at = $2 WHERE token_hash = $1', [tokenHash, expires]);
  }
  const { remember, lastSeenAt: _lastSeen, ...user } = row;
  void _lastSeen;
  return { user, tokenHash, remember };
}

export async function deleteSessionByHash(tokenHash: string): Promise<void> {
  await db().query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

export async function deleteUserSessions(userId: string, exceptHash?: string): Promise<void> {
  await db().query('DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2', [userId, exceptHash ?? '']);
}

export function setSessionCookie(reply: FastifyReply, token: string, remember: boolean, secure: boolean): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: remember ? REMEMBER_MS / 1000 : undefined,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
