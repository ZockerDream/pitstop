// App-Zustand: Konto, aktuelle Firma mit Bootstrap-Daten, Navigation, Toasts und Overlays.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Area, Rights, SpecialKey } from '../../shared/permissions';
import type { CompanyData, MeData, Prefs } from '../../shared/types';
import { api, errorMessage } from './api';
import { pageById, setBoards } from './nav';
import { readLocal, writeLocal } from './storage';

export interface Toast {
  id: number;
  text: string;
  tone: 'ok' | 'bad';
}

export interface AppCtx {
  me: MeData;
  data: CompanyData | null;
  companyId: string | null;
  page: string;
  param: string;
  go(page: string, param?: string): void;
  switchCompany(id: string): void;
  reload(): Promise<void>;
  reloadMe(): Promise<void>;
  /** API-Aufruf mit Toast und neuem Stand; gibt false bei Fehler zurück. */
  act<T>(fn: () => Promise<T>, okText?: string): Promise<T | undefined>;
  toast(text: string, tone?: 'ok' | 'bad'): void;
  overlay(node: ReactNode | null): void;
  can(area: Area, min?: 1 | 2 | 3): boolean;
  special(key: SpecialKey): boolean;
  /** API-Pfad der aktuellen Firma, z. B. c('/orders') → /c/<id>/orders */
  c(path: string): string;
  setPrefs(p: Prefs): Promise<void>;
  /** Vorschau als Person: Navigation und Knöpfe mit deren Rechten; Änderungen sind gesperrt. */
  viewAs: { userId: string; name: string } | null;
  setViewAs(userId: string | null): Promise<void>;
}

const Ctx = createContext<AppCtx | null>(null);
export const useApp = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp außerhalb von AppProvider');
  return v;
};

function parseHash(): [string, string] {
  const h = decodeURIComponent(window.location.hash.replace(/^#\/?/, ''));
  const [page, ...rest] = h.split('/');
  return [page || '', rest.join('/')];
}

/** Darstellung des Kontos auf <html> anwenden (Mockup: data-skin, data-density, …). */
export function applyPrefs(p: Prefs): void {
  const h = document.documentElement;
  let skin = p.skin ?? 'boxengasse';
  if (skin === 'auto') skin = window.matchMedia?.('(prefers-color-scheme: dark)').matches === false ? 'hell' : 'boxengasse';
  if (skin === 'boxengasse') h.removeAttribute('data-skin');
  else h.setAttribute('data-skin', skin);
  h.setAttribute('data-density', p.density ?? 'bequem');
  h.setAttribute('data-nav', p.nav ?? 'breit');
  h.setAttribute('data-text', p.text ?? 'normal');
  h.setAttribute('data-motion', p.motion ?? 'normal');
}

export function AppProvider({ initialMe, children }: { initialMe: MeData; children: ReactNode }) {
  const [me, setMe] = useState(initialMe);
  const [companyId, setCompanyId] = useState<string | null>(() => {
    const saved = readLocal<string | null>('pitstop.company', null);
    return initialMe.companies.find((c) => c.id === saved)?.id ?? initialMe.companies[0]?.id ?? null;
  });
  const [data, setData] = useState<CompanyData | null>(null);
  const [[page, param], setRoute] = useState(parseHash);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [layer, setLayer] = useState<ReactNode | null>(null);
  const seq = useRef(0);
  const [preview, setPreview] = useState<{ userId: string; name: string; rights: Rights } | null>(null);
  // Benannte Arbeitsflächen als Seiten registrieren (vor dem Rendern der Navigation)
  useMemo(() => setBoards(me.user.prefs.boards ?? []), [me.user.prefs.boards]);

  useEffect(() => applyPrefs(me.user.prefs), [me.user.prefs]);
  useEffect(() => {
    const on = () => {
      setRoute(parseHash());
      setLayer(null);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const toast = useCallback((text: string, tone: 'ok' | 'bad' = 'ok') => {
    const id = ++seq.current;
    setToasts((t) => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'bad' ? 6000 : 3200);
  }, []);

  const reload = useCallback(async () => {
    if (!companyId) return setData(null);
    try {
      setData(await api.get<CompanyData>(`/c/${companyId}/bootstrap`));
    } catch (err) {
      toast(errorMessage(err), 'bad');
      setData(null);
    }
  }, [companyId, toast]);

  const reloadMe = useCallback(async () => setMe(await api.get<MeData>('/me')), []);

  useEffect(() => {
    void reload();
    const t = setInterval(() => document.visibilityState === 'visible' && void reload(), 60_000);
    const f = () => document.visibilityState === 'visible' && void reload();
    document.addEventListener('visibilitychange', f);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', f);
    };
  }, [reload]);

  // In der Vorschau sieht die Oberfläche die Rechte der gewählten Person.
  const shown = useMemo(() => (data && preview ? { ...data, rights: preview.rights } : data), [data, preview]);
  const value = useMemo<AppCtx>(
    () => ({
      me,
      data: shown,
      companyId,
      page: page || me.user.prefs.start || 'cockpit',
      param,
      go(p, prm) {
        window.location.hash = prm ? `${p}/${encodeURIComponent(prm)}` : p;
      },
      switchCompany(id) {
        writeLocal('pitstop.company', id);
        setPreview(null);
        setData(null);
        setCompanyId(id);
        const cur = pageById(page);
        if (!cur || cur.server) window.location.hash = 'cockpit';
      },
      reload,
      reloadMe,
      async act(fn, okText) {
        if (preview) {
          toast(`Vorschau als ${preview.name}: nur ansehen, nichts ändern.`, 'bad');
          return undefined;
        }
        try {
          const r = await fn();
          await reload();
          if (okText) toast(okText);
          return r;
        } catch (err) {
          toast(errorMessage(err), 'bad');
          return undefined;
        }
      },
      toast,
      overlay: setLayer,
      can(area, min = 1) {
        return !!shown && shown.rights.areas[area].level >= min;
      },
      special(key) {
        const v = shown?.rights.specials[key];
        return v !== undefined && v !== false;
      },
      c: (p) => `/c/${companyId}${p}`,
      viewAs: preview && { userId: preview.userId, name: preview.name },
      async setViewAs(userId) {
        if (!userId) return setPreview(null);
        try {
          const r = await api.get<{ rights: Rights }>(`/c/${companyId}/rights/${userId}`);
          setPreview({ userId, name: data?.members.find((m) => m.userId === userId)?.displayName ?? 'Person', rights: r.rights });
          setLayer(null);
          window.location.hash = 'cockpit';
          toast('Vorschau aktiv');
        } catch (err) {
          toast(errorMessage(err), 'bad');
        }
      },
      async setPrefs(p) {
        const next = { ...me.user.prefs, ...p };
        setMe((m) => ({ ...m, user: { ...m.user, prefs: next } }));
        try {
          await api.patch('/me', { prefs: p });
        } catch (err) {
          toast(errorMessage(err), 'bad');
        }
      },
    }),
    [me, data, shown, preview, companyId, page, param, reload, reloadMe, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {layer}
      {toasts.length > 0 && (
        <div className="toast" role="status" aria-live="polite" style={toasts[toasts.length - 1].tone === 'bad' ? { borderColor: 'var(--bad)' } : undefined}>
          {toasts[toasts.length - 1].text}
        </div>
      )}
    </Ctx.Provider>
  );
}
