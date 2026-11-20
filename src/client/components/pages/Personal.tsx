// Persönlich: Mein Konto, Darstellung (pro Konto gespeichert), Neuigkeiten (Changelog + Ankündigungen).
import { useEffect, useState } from 'react';
import { CHANGELOG } from '../../../shared/changelog';
import { formatAgo, formatDate } from '../../../shared/format';
import { AREAS, LEVEL_LABEL, type Level } from '../../../shared/permissions';
import type { Announcement, LegalInfo, Prefs } from '../../../shared/types';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { PAGES, SKINS } from '../../lib/nav';
import { Avatar, Card, Confirm, Empty, FormModal, LevelPill, PageHead, Pill, Seg } from '../ui';
import { visible } from '../Shell';

interface Device { id: string; agent: string; createdAt: string; lastSeenAt: string; current: boolean }
/** „Chrome · Windows“ aus dem User-Agent; Spiel-Browser (FiveM/CEF) als Ingame-Tablet. */
const deviceName = (ua: string) => {
  if (!ua) return 'Unbekanntes Gerät';
  if (/CitizenFX|FiveM|CEF/i.test(ua)) return 'Ingame-Tablet';
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const o = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return o ? `${b} · ${o}` : b;
};

function TwoFactor() {
  const app = useApp();
  const u = app.me.user;
  const [setup, setSetup] = useState<{ secret: string; url: string } | null>(null);
  const [code, setCode] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setErr('');
    try { await fn(); await app.reloadMe(); app.toast(ok); setSetup(null); setCode(''); setPw(''); } catch (e) { setErr(errorMessage(e)); }
  };
  return (
    <Card title="Zwei-Faktor-Anmeldung" right={<Pill tone={u.totpEnabled ? 'ok' : ''}>{u.totpEnabled ? 'aktiv' : 'aus'}</Pill>}>
      {u.totpEnabled ? (
        <div className="stack" style={{ gap: 10 }}>
          <p className="small muted" style={{ margin: 0 }}>Beim Anmelden fragt Pitstop zusätzlich nach dem Code aus deiner Authenticator-App. Zum Ausschalten Passwort und aktuellen Code eingeben.</p>
          <div className="g g2" style={{ gap: 8 }}>
            <div className="field"><label htmlFor="tf-pw">Passwort</label><input id="tf-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} /></div>
            <div className="field"><label htmlFor="tf-c">Code</label><input id="tf-c" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></div>
          </div>
          {err && <div className="err">{err}</div>}
          <button className="btn" style={{ alignSelf: 'flex-start' }} disabled={!pw || code.length !== 6} onClick={() => run(() => api.post('/me/totp/disable', { password: pw, code }), 'Zwei-Faktor ausgeschaltet')}>Ausschalten</button>
        </div>
      ) : setup ? (
        <div className="stack" style={{ gap: 10 }}>
          <p className="small" style={{ margin: 0 }}>1. In der Authenticator-App (z. B. Google Authenticator, Aegis, 1Password) ein Konto hinzufügen und diesen Schlüssel eintippen – oder auf dem Handy den Link öffnen:</p>
          <div className="reveal mono" style={{ wordBreak: 'break-all' }}>{setup.secret.replace(/(.{4})/g, '$1 ').trim()}</div>
          <a className="link small" href={setup.url}>Link für die Authenticator-App</a>
          <p className="small" style={{ margin: 0 }}>2. Den sechsstelligen Code aus der App eingeben:</p>
          <div className="row" style={{ gap: 8 }}>
            <div className="field" style={{ width: 130 }}><input aria-label="Code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /></div>
            <button className="btn pri" disabled={code.length !== 6} onClick={() => run(() => api.post('/me/totp/enable', { code }), 'Zwei-Faktor ist aktiv')}>Einschalten</button>
            <button className="btn ghost" onClick={() => setSetup(null)}>Abbrechen</button>
          </div>
          {err && <div className="err">{err}</div>}
        </div>
      ) : (
        <div className="stack" style={{ gap: 10 }}>
          <p className="small muted" style={{ margin: 0 }}>Schützt dein Konto zusätzlich mit einem Code vom Handy. Empfohlen für Server-Admins und Inhaber.</p>
          <button className="btn" style={{ alignSelf: 'flex-start' }} onClick={async () => { try { setSetup(await api.post<{ secret: string; url: string }>('/me/totp/setup')); } catch (e) { app.toast(errorMessage(e), 'bad'); } }}>Einrichten</button>
        </div>
      )}
    </Card>
  );
}

const LINK_MSG: Record<string, [string, 'ok' | 'bad']> = { verknuepft: ['Discord-Konto verknüpft', 'ok'], vergeben: ['Dieses Discord-Konto ist schon mit einem anderen Pitstop-Konto verknüpft.', 'bad'], fehler: ['Discord hat nicht geantwortet.', 'bad'], abgebrochen: ['Verknüpfen abgebrochen.', 'bad'], ungueltig: ['Abgelaufen, bitte noch einmal versuchen.', 'bad'] };

function DiscordLink() {
  const app = useApp();
  const u = app.me.user;
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => {
    void api.get<LegalInfo>('/public/legal').then((l) => setOn(l.discordLogin), () => setOn(false));
    const k = new URLSearchParams(window.location.search).get('discord');
    if (k && LINK_MSG[k]) {
      window.history.replaceState(null, '', window.location.pathname + window.location.hash);
      app.toast(LINK_MSG[k][0], LINK_MSG[k][1]);
      void app.reloadMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!on && !u.discordLinked) return null;
  return (
    <Card title="Discord" right={<Pill tone={u.discordLinked ? 'ok' : ''}>{u.discordLinked ? 'verknüpft' : 'nicht verknüpft'}</Pill>}>
      <p className="small muted" style={{ marginTop: 0 }}>{u.discordLinked ? 'Du kannst dich mit Discord anmelden. Die Spielserver-Anbindung erkennt dich auch über deine Discord-ID.' : 'Verknüpfe dein Discord-Konto, um dich damit anzumelden.'}</p>
      {u.discordLinked
        ? <button className="btn" onClick={async () => { try { await api.post('/me/discord/unlink', {}); await app.reloadMe(); app.toast('Discord getrennt'); } catch (e) { app.toast(errorMessage(e), 'bad'); } }}>Trennen</button>
        : <a className="btn pri" href="/api/auth/discord/start?mode=link">Discord verknüpfen</a>}
    </Card>
  );
}

function Devices() {
  const app = useApp();
  const [list, setList] = useState<Device[] | null>(null);
  const load = () => api.get<{ sessions: Device[] }>('/me/sessions').then((r) => setList(r.sessions), () => setList([]));
  useEffect(() => { void load(); }, []);
  return (
    <Card title="Angemeldet auf">
      {(list ?? []).map((x) => (
        <div key={x.id} className="li">
          <div className={`ib ${x.current ? 'ok' : ''}`}><Icon name="gauge" /></div>
          <div className="tx"><b>{deviceName(x.agent)}</b><span>{x.current ? 'dieses Gerät · jetzt' : `zuletzt ${formatAgo(x.lastSeenAt)}`} · angemeldet {formatDate(x.createdAt)}</span></div>
          {x.current ? <Pill tone="ok">aktuell</Pill> : <button className="btn sm ghost" onClick={async () => { try { await api.del(`/me/sessions/${x.id}`); app.toast('Abgemeldet'); void load(); } catch (e) { app.toast(errorMessage(e), 'bad'); } }}>Abmelden</button>}
        </div>
      ))}
      {list && !list.length && <p className="muted small" style={{ margin: 0 }}>Keine Sitzungen.</p>}
    </Card>
  );
}

export function AccountPage() {
  const app = useApp();
  const u = app.me.user;
  const [pw, setPw] = useState({ cur: '', next: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const d = app.data;
  return (
    <>
      <PageHead eyebrow="Persönlich" title="Mein Konto" sub="Dein Zugang gilt für den ganzen Server. Rechte bekommst du in jeder Firma einzeln." />
      <div className="g c12">
        <div className="s6 stack">
          <Card title="Profil" right={<button className="btn sm" onClick={() => app.overlay(<FormModal title="Profil bearbeiten" fields={[{ name: 'displayName', label: 'Anzeigename', required: true }, { name: 'discord', label: 'Discord' }]} initial={u} submit={(v) => api.patch('/me', v)} onDone={() => { void app.reloadMe(); app.toast('Gespeichert'); }} />)}>Bearbeiten</button>}>
            <div className="who"><Avatar name={u.displayName} size={52} /><div><b style={{ fontSize: 17 }}>{u.displayName}</b><span>{u.email}{u.discord ? ` · Discord ${u.discord}` : ''}</span></div></div>
          </Card>
          <Card title="Passwort ändern">
            <form className="stack" onSubmit={async (e) => {
              e.preventDefault();
              try { await api.post('/auth/password', { currentPassword: pw.cur, newPassword: pw.next }); setPw({ cur: '', next: '' }); setErrs({}); app.toast('Passwort geändert, andere Geräte sind abgemeldet'); }
              catch (err) { setErrs(fieldErrors(err)); app.toast(errorMessage(err), 'bad'); }
            }}>
              <div className="field"><label htmlFor="pw-c">Bisheriges Passwort</label><input id="pw-c" type="password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />{errs.currentPassword && <span className="err">{errs.currentPassword}</span>}</div>
              <div className="field"><label htmlFor="pw-n">Neues Passwort (mindestens 12 Zeichen)</label><input id="pw-n" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />{errs.newPassword && <span className="err">{errs.newPassword}</span>}</div>
              <button className="btn" type="submit" style={{ alignSelf: 'flex-start' }}>Ändern</button>
            </form>
          </Card>
          <TwoFactor />
          <DiscordLink />
          <Devices />
        </div>
        <div className="s6 stack">
          <Card title="Serverrolle">
            {u.isServerAdmin ? (
              <div className="alert warn"><Icon name="server" /><div><b>Server-Admin.</b> Du verwaltest Konten und Firmen. In Firmendaten schaust du nur, wenn die Firma Support erlaubt.</div></div>
            ) : <p className="muted small" style={{ margin: 0 }}>Normales Konto. Die Rolle Server-Admin vergibt ein bestehender Server-Admin.</p>}
          </Card>
          <Card title="Meine Firmen">
            {app.me.companies.map((c) => (
              <div key={c.id} className="li"><div className="ib"><Icon name="building" /></div><div className="tx"><b>{c.name}</b><span>{c.id === app.companyId ? d?.groups.filter((g) => g.members.includes(u.id)).map((g) => g.name).join(', ') || (d?.rights.support ? 'Support-Zugriff' : '') : ''}</span></div>
                {c.id === app.companyId ? <Pill tone="ok" dot={false}>aktuell</Pill> : <button className="btn sm ghost" onClick={() => app.switchCompany(c.id)}>Wechseln</button>}</div>
            ))}
            {!app.me.companies.length && <p className="muted small" style={{ margin: 0 }}>In keiner Firma.</p>}
          </Card>
          {app.me.demoMode && (
            <Card title="Demo">
              <p className="small muted" style={{ marginTop: 0 }}>Setzt alle Daten auf den Anfangsstand der Demo zurück. Alle werden abgemeldet.</p>
              <button className="btn" onClick={() => app.overlay(<Confirm title="Demo-Daten zurücksetzen?" text="Alle Änderungen gehen verloren." okLabel="Zurücksetzen" onOk={async () => { await api.post('/demo/reset').catch(() => undefined); window.location.hash = ''; window.location.reload(); }} />)}>Demo-Daten zurücksetzen</button>
            </Card>
          )}
          {d && (
            <Card title={`Meine Rechte bei ${d.company.name}`}>
              {AREAS.filter((a) => a.module === 'firma' || d.company.modules.includes(a.module)).map((a) => {
                const r = d.rights.areas[a.id];
                return <div key={a.id} className="row small" style={{ padding: '4px 0', gap: 8 }}><span className="grow">{a.label}</span><span className="dim">{r.source}</span><LevelPill level={r.locked ? 'x' : (String(r.level) as Level)} own={r.own} /></div>;
              })}
              <p className="small muted">{Object.entries(d.rights.specials).length ? `Sonderrechte: ${Object.keys(d.rights.specials).join(', ')}` : 'Keine Sonderrechte.'} · Stufen: {(['1', '2', '3'] as const).map((l) => LEVEL_LABEL[l]).join(', ')}</p>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

export function AppearancePage() {
  const app = useApp();
  const p = app.me.user.prefs;
  const set = (x: Prefs) => void app.setPrefs(x);
  const starts = PAGES.filter((x) => !x.server && visible(app, x));
  return (
    <>
      <PageHead eyebrow="Persönlich" title="Darstellung" sub={`Gilt für das Konto von ${app.me.user.displayName} – auf jedem Gerät gleich`} />
      <Card title="Theme">
        <div className="g g3">
          {SKINS.map(([id, n, desc, [bg, pn, ac]]) => (
            <button key={id} className={`skin ${(p.skin ?? 'boxengasse') === id ? 'on' : ''}`} aria-pressed={(p.skin ?? 'boxengasse') === id} onClick={() => set({ skin: id })}>
              <div className="pv" style={{ background: bg }}><i style={{ background: pn }} /><i style={{ padding: 14 }}><span style={{ display: 'block', height: 10, width: '60%', borderRadius: 4, background: ac }} /><span style={{ display: 'block', height: 8, width: '80%', borderRadius: 4, background: pn, marginTop: 10 }} /></i></div>
              <div className="lb"><b>{n}</b><span>{desc}</span></div>
            </button>
          ))}
        </div>
      </Card>
      <div className="g g3" style={{ marginTop: 14 }}>
        <Card title="Dichte"><Seg value={p.density ?? 'bequem'} options={['bequem', 'kompakt'] as const} onChange={(v) => set({ density: v })} /></Card>
        <Card title="Seitenleiste"><Seg value={p.nav ?? 'breit'} options={['breit', 'schmal'] as const} onChange={(v) => set({ nav: v })} /></Card>
        <Card title="Schriftgröße"><Seg value={p.text ?? 'normal'} options={['normal', 'groß', 'sehr groß'] as const} onChange={(v) => set({ text: v })} /></Card>
        <Card title="Bewegung"><Seg value={p.motion ?? 'normal'} options={['normal', 'reduziert'] as const} onChange={(v) => set({ motion: v })} /></Card>
        <Card title="Startseite">
          <div className="field"><select aria-label="Startseite" value={p.start ?? 'cockpit'} onChange={(e) => set({ start: e.target.value })}>{starts.map((x) => <option key={x.id} value={x.id}>{x.group} · {x.label}</option>)}</select></div>
        </Card>
      </div>
    </>
  );
}

export function NewsPage() {
  const app = useApp();
  const [ann, setAnn] = useState<Announcement[]>([]);
  const load = () => api.get<{ announcements: Announcement[] }>('/announcements').then((r) => setAnn(r.announcements)).catch(() => undefined);
  useEffect(() => { void load(); }, []);
  const K = { neu: ['Neu', 'o'], besser: ['Verbessert', 'i'], fix: ['Behoben', 'a'] } as const;
  return (
    <>
      <PageHead eyebrow="Persönlich" title="Neuigkeiten" sub={`Pitstop ${app.me.version} · was sich geändert hat`}>
        {app.me.user.isServerAdmin && (
          <button className="btn pri" onClick={() => app.overlay(<FormModal title="Ankündigung" fields={[{ name: 'title', label: 'Titel', required: true }, { name: 'body', label: 'Text', type: 'textarea' }, { name: 'tone', label: 'Art', type: 'select', options: [['info', 'Info'], ['warn', 'Wichtig']] }]} initial={{ tone: 'info' }} submit={(v) => api.post('/announcements', v)} onDone={() => { void load(); app.toast('Veröffentlicht'); }} submitLabel="Veröffentlichen" />)}>
            <Icon name="plus" size={15} /> Ankündigung
          </button>
        )}
      </PageHead>
      <div className="g c12">
        <div className="s8 stack">
          {CHANGELOG.map((v, i) => (
            <Card key={v.version} title={<span className="row" style={{ gap: 10 }}><span className="mono">v{v.version}</span><span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--fg)' }}>{v.title}</span>{i === 0 && <Pill tone="acc" dot={false}>aktuell</Pill>}</span>} right={<span className="mono small muted">{formatDate(v.date)}</span>}>
              {v.items.map(([k, t], j) => <div key={j} className="li"><span className={`lvl ${K[k][1]}`} style={{ width: 86, textAlign: 'center' }}>{K[k][0]}</span><div className="tx"><b style={{ whiteSpace: 'normal' }}>{t}</b></div></div>)}
            </Card>
          ))}
        </div>
        <div className="s4">
          <Card title="Ankündigungen vom Server">
            {ann.length ? ann.map((a) => (
              <div key={a.id} className="li" style={{ alignItems: 'flex-start' }}>
                <div className={`ib ${a.tone}`}><Icon name={a.tone === 'warn' ? 'alert' : 'chat'} /></div>
                <div className="tx"><b style={{ whiteSpace: 'normal' }}>{a.title}</b><span style={{ whiteSpace: 'normal' }}>{a.body}</span><span>{a.authorName} · {formatAgo(a.createdAt)}</span></div>
                {app.me.user.isServerAdmin && <button className="ibtn" aria-label="Löschen" onClick={() => app.act(() => api.del(`/announcements/${a.id}`), 'Gelöscht').then(load)}><Icon name="x" size={14} /></button>}
              </div>
            )) : <Empty title="Keine Ankündigungen" />}
          </Card>
        </div>
      </div>
    </>
  );
}
