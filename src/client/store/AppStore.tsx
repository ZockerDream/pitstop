import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from 'react';
import { can, type Permission } from '../../shared/permissions';
import type { AppData } from '../../shared/types';
import { api, errorMessage } from '../lib/api';
import { reducer, type StoreAction } from './reducer';

interface StoreValue {
  data: AppData;
  dispatch: (action: StoreAction) => void;
  reload: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

const POLL_MS = 60_000;

/** Lädt den Gesamtstand (GET /api/bootstrap) und gleicht ihn bei Tab-Fokus und jede Minute ab. */
export function AppStoreProvider({ children, fallback }: { children: ReactNode; fallback: (error: string | null, retry: () => void) => ReactNode }) {
  const [data, dispatch] = useReducer(reducer, null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const next = await api.get<AppData>('/bootstrap');
      dispatch({ type: 'loaded', data: next });
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const value = useMemo(() => (data ? { data, dispatch, reload } : null), [data, reload]);
  if (!value) return <>{fallback(error, reload)}</>;
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore außerhalb von AppStoreProvider');
  return ctx;
}

export function useData(): AppData {
  return useStore().data;
}

export function useCan(): (permission: Permission) => boolean {
  const role = useStore().data.me.role;
  return useCallback((permission: Permission) => can(role, permission), [role]);
}
