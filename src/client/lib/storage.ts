// Kleine Bequemlichkeiten pro Browser (zuletzt geöffnet, ausgeblendete Hinweise).
// localStorage kann fehlen oder werfen (privates Fenster) – dann einfach ohne.

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function writeLocal(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ohne Speicher weiter
  }
}

export interface RecentItem {
  type: 'customer' | 'invoice' | 'employee';
  id: string;
}

const RECENT_KEY = 'pitstop:recent';

export function pushRecent(item: RecentItem): void {
  const list = readLocal<RecentItem[]>(RECENT_KEY, []).filter((r) => !(r.type === item.type && r.id === item.id));
  writeLocal(RECENT_KEY, [item, ...list].slice(0, 6));
}

export function readRecent(): RecentItem[] {
  return readLocal<RecentItem[]>(RECENT_KEY, []);
}
