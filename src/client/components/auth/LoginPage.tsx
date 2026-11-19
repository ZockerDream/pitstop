import { ShieldCheck, UserRound } from 'lucide-react';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { initials } from '../../../shared/format';
import type { LegalInfo, User } from '../../../shared/types';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { href } from '../../lib/router';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input } from '../ui/Field';

export function AuthLayout({ legal, children }: { legal: LegalInfo | null; children: ReactNode }) {
  const name = legal?.companyName ?? 'Pitstop';
  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 px-4 py-12">
      <div className="mb-8 flex items-center gap-3">
        {legal?.hasLogo ? (
          <img src="/api/public/logo" alt="" className="size-10 rounded-lg bg-white object-contain p-1" />
        ) : (
          <span className="grid size-10 place-items-center rounded-lg bg-brand-600 font-bold text-white">{initials(name)}</span>
        )}
        <div>
          <div className="font-semibold text-white">{name}</div>
          <div className="text-xs text-zinc-500">Pitstop · Business OS</div>
        </div>
      </div>
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">{children}</div>
      <div className="mt-6 flex gap-4 text-xs text-zinc-500">
        <a href={href('/impressum')} className="hover:text-zinc-300">
          Impressum
        </a>
        <a href={href('/datenschutz')} className="hover:text-zinc-300">
          Datenschutz
        </a>
      </div>
    </div>
  );
}

export function useLegal(): LegalInfo | null {
  const [legal, setLegal] = useState<LegalInfo | null>(null);
  useEffect(() => {
    api
      .get<LegalInfo>('/public/legal')
      .then(setLegal)
      .catch(() => setLegal(null));
  }, []);
  return legal;
}

export function LoginPage({ onLoggedIn }: { onLoggedIn: (user: User) => void }) {
  const legal = useLegal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy('login');
    setError(null);
    setFields({});
    try {
      const r = await api.post<{ user: User }>('/auth/login', { email, password, remember });
      onLoggedIn(r.user);
    } catch (err) {
      setError(errorMessage(err));
      setFields(fieldErrors(err));
    } finally {
      setBusy(null);
    }
  };

  const demoLogin = async (persona: 'admin' | 'employee') => {
    setBusy(persona);
    setError(null);
    try {
      const r = await api.post<{ user: User }>('/demo/login', { persona });
      onLoggedIn(r.user);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <AuthLayout legal={legal}>
      <h1 className="text-lg font-semibold text-zinc-900">Anmelden</h1>
      <p className="mt-1 text-sm text-zinc-500">Mit E-Mail-Adresse und Passwort.</p>
      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        <Field label="E-Mail" error={fields.email}>
          {(id, invalid) => <Input id={id} type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} invalid={invalid} />}
        </Field>
        <Field label="Passwort" error={fields.password}>
          {(id, invalid) => (
            <Input id={id} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} invalid={invalid} />
          )}
        </Field>
        <Checkbox label="Angemeldet bleiben" description="30 Tage statt 8 Stunden" checked={remember} onChange={setRemember} />
        {error && Object.keys(fields).length === 0 && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" loading={busy === 'login'}>
          Anmelden
        </Button>
      </form>
      {legal?.demoMode && (
        <div className="mt-6 border-t border-zinc-100 pt-5">
          <p className="mb-3 text-xs font-medium tracking-wide text-zinc-500 uppercase">Demo – alle Daten sind erfunden</p>
          <div className="grid gap-2">
            <Button icon={ShieldCheck} onClick={() => void demoLogin('admin')} loading={busy === 'admin'} className="justify-start">
              Als Admin ansehen <span className="ml-auto text-xs font-normal text-zinc-500">Katrin Lindner</span>
            </Button>
            <Button icon={UserRound} onClick={() => void demoLogin('employee')} loading={busy === 'employee'} className="justify-start">
              Als Mitarbeiter ansehen <span className="ml-auto text-xs font-normal text-zinc-500">Jonas Weber</span>
            </Button>
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
