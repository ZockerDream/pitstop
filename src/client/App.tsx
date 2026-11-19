import { useCallback, useEffect, useState } from 'react';
import type { User } from '../shared/types';
import { ForcePasswordChange } from './components/auth/ForcePasswordChange';
import { LoginPage } from './components/auth/LoginPage';
import { CustomerListView } from './components/crm/CustomerListView';
import { DashboardView } from './components/dashboard/DashboardView';
import { FinanceView } from './components/finance/FinanceView';
import { HrView } from './components/hr/HrView';
import { CommandPalette } from './components/layout/CommandPalette';
import { ModalHost } from './components/layout/ModalHost';
import { NoAccess } from './components/layout/NoAccess';
import { Sidebar } from './components/layout/Sidebar';
import { Splash } from './components/layout/Splash';
import { TopBar } from './components/layout/TopBar';
import { LegalPage } from './components/legal/LegalPage';
import { SettingsView } from './components/settings/SettingsView';
import { ConfirmProvider, ToastProvider } from './components/ui/feedback';
import { api, setAuthProblemHandler } from './lib/api';
import { ModalProvider } from './lib/modals';
import { navigate, useRoute, type Route } from './lib/router';
import { AppStoreProvider, useCan } from './store/AppStore';

type AuthState = { status: 'loading' } | { status: 'anon' } | { status: 'authed'; user: User };

export interface SessionControls {
  logout: () => Promise<void>;
  switchPersona: (persona: 'admin' | 'employee') => Promise<void>;
  resetDemo: () => Promise<void>;
}

export function App() {
  const route = useRoute();
  const [auth, setAuth] = useState<AuthState>({ status: 'loading' });

  const checkSession = useCallback(async () => {
    try {
      const r = await api.get<{ user: User | null }>('/auth/me');
      setAuth(r.user ? { status: 'authed', user: r.user } : { status: 'anon' });
    } catch {
      setAuth({ status: 'anon' });
    }
  }, []);

  useEffect(() => {
    void checkSession();
    setAuthProblemHandler((err) => {
      if (err.status === 401) setAuth({ status: 'anon' });
      else void checkSession();
    });
    return () => setAuthProblemHandler(null);
  }, [checkSession]);

  const controls: SessionControls = {
    logout: async () => {
      await api.post('/auth/logout').catch(() => undefined);
      setAuth({ status: 'anon' });
      navigate('/dashboard');
    },
    switchPersona: async (persona) => {
      const r = await api.post<{ user: User }>('/demo/login', { persona });
      setAuth({ status: 'authed', user: r.user });
      navigate('/dashboard');
    },
    resetDemo: async () => {
      await api.post('/demo/reset');
      setAuth({ status: 'anon' });
      navigate('/dashboard');
    },
  };

  const section = route.segments[0];
  if (section === 'impressum' || section === 'datenschutz') return <LegalPage kind={section} loggedIn={auth.status === 'authed'} />;
  if (auth.status === 'loading') return <Splash />;
  if (auth.status === 'anon') {
    return <LoginPage onLoggedIn={(user) => setAuth({ status: 'authed', user })} />;
  }
  if (auth.user.mustChangePassword) {
    return <ForcePasswordChange user={auth.user} onDone={(user) => setAuth({ status: 'authed', user })} onLogout={controls.logout} />;
  }
  return (
    <ToastProvider>
      <ConfirmProvider>
        <ModalProvider>
          <AppStoreProvider key={auth.user.id} fallback={(error, retry) => <Splash error={error} onRetry={retry} />}>
            <Shell route={route} controls={controls} />
          </AppStoreProvider>
        </ModalProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}

function Shell({ route, controls }: { route: Route; controls: SessionControls }) {
  const can = useCan();
  const [navOpen, setNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [section, second, third] = route.segments;

  useEffect(() => {
    if (section === 'login') navigate('/dashboard');
    setNavOpen(false);
  }, [section]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  let content;
  switch (section) {
    case 'kunden':
      content = <CustomerListView customerId={second} />;
      break;
    case 'finanzen':
      content = can('finance:view') ? (
        <FinanceView tab={second === 'ausgaben' ? 'expenses' : 'invoices'} invoiceId={second === 'rechnungen' ? third : undefined} query={route.query} />
      ) : (
        <NoAccess />
      );
      break;
    case 'personal':
      content = <HrView tab={second === 'urlaub' ? 'leave' : 'directory'} employeeId={second && second !== 'urlaub' ? second : undefined} />;
      break;
    case 'einstellungen':
      content = can('settings:manage') ? <SettingsView tab={second === 'benutzer' ? 'users' : 'company'} /> : <NoAccess />;
      break;
    default:
      content = <DashboardView />;
  }

  return (
    <div className="flex h-full">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} section={section} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar route={route} controls={controls} onOpenNav={() => setNavOpen(true)} onOpenSearch={() => setPaletteOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-8">{content}</div>
        </main>
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
      <ModalHost />
    </div>
  );
}
