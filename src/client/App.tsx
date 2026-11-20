// Anmeldefluss: ohne Sitzung → Anmeldung, Startpasswort → neues Passwort, sonst App.
import { useCallback, useEffect, useState } from 'react';
import type { LegalInfo, MeData, User } from '../shared/types';
import { api, ApiError, errorMessage, fieldErrors, setAuthProblemHandler } from './lib/api';
import { AppProvider, applyPrefs } from './lib/app';
import { Shell } from './components/Shell';
import { Avatar } from './components/ui';

const DISCORD_MSG: Record<string, string> = {
  abgebrochen: 'Anmeldung mit Discord abgebrochen.',
  ungueltig: 'Die Anmeldung mit Discord ist abgelaufen. Bitte noch einmal versuchen.',
  fehler: 'Discord hat nicht geantwortet. Bitte später noch einmal versuchen.',
  unbekannt: 'Dieses Discord-Konto ist mit keinem Pitstop-Konto verknüpft. Erst mit E-Mail anmelden und unter „Mein Konto“ Discord verknüpfen.',
  zweifaktor: 'Dein Konto nutzt Zwei-Faktor-Anmeldung. Bitte mit E-Mail, Passwort und Code anmelden.',
  wartung: 'Pitstop wird gerade gewartet. Bitte später noch einmal versuchen.',
};

type Stage = { k: 'loading' } | { k: 'login'; demoMode: boolean } | { k: 'password'; user: User } | { k: 'app'; me: MeData };

export function App() {
  const [stage, setStage] = useState<Stage>({ k: 'loading' });

  const start = useCallback(async () => {
    try {
      const r = await api.get<{ user: User | null; demoMode: boolean }>('/auth/me');
      if (!r.user) return setStage({ k: 'login', demoMode: r.demoMode });
      applyPrefs(r.user.prefs);
      if (r.user.mustChangePassword) return setStage({ k: 'password', user: r.user });
      setStage({ k: 'app', me: await api.get<MeData>('/me') });
    } catch {
      setStage({ k: 'login', demoMode: false });
    }
  }, []);

  useEffect(() => {
    void start();
    setAuthProblemHandler(() => void start());
    return () => setAuthProblemHandler(null);
  }, [start]);

  if (stage.k === 'loading') return null;
  if (stage.k === 'login') return <Login demoMode={stage.demoMode} onDone={start} />;
  if (stage.k === 'password') return <ForcePassword user={stage.user} onDone={start} />;
  return (
    <AppProvider initialMe={stage.me}>
      <Shell />
    </AppProvider>
  );
}

function Brand() {
  return (
    <div className="brand" style={{ padding: 0 }}>
      <div className="mark" aria-hidden="true">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h4l3-9 4 12 3-7h4" /></svg>
      </div>
      <div>
        <b>Pitstop</b>
        <span>Werkstatt-OS</span>
      </div>
    </div>
  );
}

function Login({ demoMode, onDone }: { demoMode: boolean; onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [personas, setPersonas] = useState<{ key: string; name: string; rank: string }[]>([]);
  const [legal, setLegal] = useState<LegalInfo | null>(null);
  const [showLegal, setShowLegal] = useState<'impressum' | 'datenschutz' | null>(null);
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  // Rückmeldung der Discord-Anmeldung (?discord=…)
  const [discordMsg] = useState(() => {
    const k = new URLSearchParams(window.location.search).get('discord');
    if (k) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
    return k ? DISCORD_MSG[k] ?? 'Anmeldung mit Discord fehlgeschlagen.' : '';
  });

  useEffect(() => {
    if (demoMode) void api.get<{ personas: typeof personas }>('/demo/personas').then((r) => setPersonas(r.personas)).catch(() => undefined);
    void api.get<LegalInfo>('/public/legal').then(setLegal).catch(() => undefined);
  }, [demoMode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr('');
    try {
      await api.post('/auth/login', { email, password, remember, code: needCode ? code : undefined });
      onDone();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'TOTP_REQUIRED') {
        setNeedCode(true);
        setErr('');
        return;
      }
      setErr(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <div className="card">
        <Brand />
        <h1>Anmelden</h1>
        <p className="muted small" style={{ marginTop: 0 }}>Werkstatt, Abschleppdienst, Kunden, Personal und Finanzen an einem Ort.</p>
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="l-mail">E-Mail-Adresse</label>
            <input id="l-mail" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </div>
          <div className="field">
            <label htmlFor="l-pw">Passwort</label>
            <input id="l-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          {needCode && (
            <div className="field">
              <label htmlFor="l-code">Code aus der Authenticator-App</label>
              <input id="l-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
            </div>
          )}
          <label className="row small" style={{ gap: 8 }}>
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} /> Angemeldet bleiben (30 Tage)
          </label>
          {(err || discordMsg) && <div className="err" role="alert">{err || discordMsg}</div>}
          <button className="btn pri" disabled={busy || (needCode && code.length !== 6)} type="submit" style={{ justifyContent: 'center' }}>Anmelden</button>
        </form>
        {legal?.discordLogin && (
          <a className="btn" style={{ justifyContent: 'center', marginTop: 10, width: '100%' }} href={`/api/auth/discord/start?mode=login${remember ? '&remember=1' : ''}`}>Mit Discord anmelden</a>
        )}
        {personas.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div className="st">Demo: als … anmelden</div>
            {personas.map((p) => (
              <button key={p.key} className="li" style={{ width: '100%', background: 'none', border: 0, borderBottom: '1px solid var(--line)', textAlign: 'left' }} onClick={async () => { await api.post('/demo/login', { persona: p.key }); onDone(); }}>
                <Avatar name={p.name} />
                <span className="tx"><b>{p.name}</b><span>{p.rank}</span></span>
              </button>
            ))}
          </div>
        )}
        <div className="row small muted" style={{ marginTop: 16, gap: 14 }}>
          <button className="link" onClick={() => setShowLegal('impressum')}>Impressum</button>
          <button className="link" onClick={() => setShowLegal('datenschutz')}>Datenschutz</button>
        </div>
        {showLegal && legal && (
          <div className="card flat" style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: 13 }}>
            {showLegal === 'impressum'
              ? legal.impressum
                ? [legal.impressum.name, legal.impressum.representedBy && `Vertreten durch: ${legal.impressum.representedBy}`, legal.impressum.street, legal.impressum.zipCity, legal.impressum.phone && `Telefon: ${legal.impressum.phone}`, legal.impressum.email && `E-Mail: ${legal.impressum.email}`, legal.impressum.extra].filter(Boolean).join('\n')
                : 'Der Betreiber hat noch kein Impressum hinterlegt.'
              : (legal.datenschutz ?? 'Der Betreiber hat noch keine Datenschutzerklärung hinterlegt.')}
          </div>
        )}
      </div>
    </div>
  );
}

function ForcePassword({ user, onDone }: { user: User; onDone: () => void }) {
  const [cur, setCur] = useState('');
  const [next, setNext] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post('/auth/password', { currentPassword: cur, newPassword: next });
      onDone();
    } catch (err) {
      setErrs(fieldErrors(err));
      setMsg(err instanceof ApiError ? err.message : errorMessage(err));
    }
  }
  return (
    <div className="login">
      <div className="card">
        <Brand />
        <h1>Eigenes Passwort festlegen</h1>
        <p className="muted small" style={{ marginTop: 0 }}>Hallo {user.displayName}, bitte ersetze das Startpasswort durch ein eigenes (mindestens 12 Zeichen).</p>
        <form className="stack" onSubmit={submit}>
          <div className="field">
            <label htmlFor="p-cur">Startpasswort</label>
            <input id="p-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} autoFocus />
            {errs.currentPassword && <span className="err">{errs.currentPassword}</span>}
          </div>
          <div className="field">
            <label htmlFor="p-new">Neues Passwort</label>
            <input id="p-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            {errs.newPassword && <span className="err">{errs.newPassword}</span>}
          </div>
          {msg && !Object.keys(errs).length && <div className="err">{msg}</div>}
          <button className="btn pri" type="submit" style={{ justifyContent: 'center' }}>Speichern und weiter</button>
        </form>
      </div>
    </div>
  );
}
