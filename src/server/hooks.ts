// Webhooks je Firma: Protokolleinträge an Discord oder als JSON an eine Adresse schicken (fire and forget).
import { db } from './db/pool';

interface HookRow {
  id: string;
  url: string;
  kind: 'discord' | 'json';
  events: string[];
}

/** Nur https und keine Adressen im eigenen Netz (Schutz davor, interne Dienste anzusprechen). */
export function webhookUrlProblem(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return 'Ungültige Adresse.';
  }
  if (u.protocol !== 'https:') return 'Nur https-Adressen.';
  const h = u.hostname.toLowerCase();
  if (h === 'localhost' || !h.includes('.') || h.endsWith('.local') || h.endsWith('.internal')) return 'Interne Adressen sind nicht erlaubt.';
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.startsWith('[')) return 'IP-Adressen im eigenen Netz sind nicht erlaubt.';
  return null;
}

export async function sendHook(h: Pick<HookRow, 'url' | 'kind'>, payload: { company: string; area: string; action: string; user: string; at: string }): Promise<string> {
  const body = h.kind === 'discord' ? { content: `**${payload.area}** · ${payload.user || 'System'}: ${payload.action}`.slice(0, 1900) } : payload;
  try {
    const r = await fetch(h.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Pitstop-Webhook' }, body: JSON.stringify(body), signal: AbortSignal.timeout(5000), redirect: 'error' });
    return r.ok ? `ok ${r.status}` : `Fehler ${r.status}`;
  } catch (err) {
    return `Fehler: ${(err as Error).message}`.slice(0, 120);
  }
}

/** Wird von audit() aufgerufen; Fehler landen nur am Webhook (last_status, fails). */
export function dispatchWebhooks(companyId: string, userId: string | null, area: string, action: string): void {
  setImmediate(() => {
    void (async () => {
      const { rows } = await db().query<HookRow & { company: string; user: string }>(
        `SELECT w.id, w.url, w.kind, w.events, c.name AS company, coalesce((SELECT display_name FROM users WHERE id = $2), '') AS user
           FROM webhooks w JOIN companies c ON c.id = w.company_id
          WHERE w.company_id = $1 AND w.active AND (jsonb_array_length(w.events) = 0 OR w.events ? $3)`,
        [companyId, userId, area],
      );
      for (const h of rows) {
        const status = await sendHook(h, { company: h.company, area, action, user: h.user, at: new Date().toISOString() });
        await db().query('UPDATE webhooks SET last_status = $2, last_at = now(), fails = CASE WHEN $3 THEN 0 ELSE fails + 1 END WHERE id = $1', [h.id, status, status.startsWith('ok')]);
      }
    })().catch(() => undefined);
  });
}
