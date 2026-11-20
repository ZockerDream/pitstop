// Serververwaltung (nur Server-Admins): Übersicht, Firmen, Konten, Sicherungen, Export, Protokoll.
import { useCallback, useEffect, useState } from 'react';
import { formatAgo, formatDateTime } from '../../../shared/format';
import type { AuditEntry, BackupFile, ServerAccount, ServerCompany } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { MODULES as MODULES_LIST } from '../../../shared/permissions';
import { Avatar, Card, Empty, FormModal, Kpi, Modal, PageHead, Pill, Switch, Table } from '../ui';

const Note = () => (
  <div className="alert warn" style={{ marginBottom: 16 }}>
    <Icon name="server" />
    <div><b>Serververwaltung.</b> Hier geht es um Konten und Firmen auf diesem Pitstop-Server. Firmendaten siehst du nur, wenn eine Firma Support-Zugriff erlaubt.</div>
  </div>
);

function useLoad<T>(path: string): [T | null, () => Promise<void>] {
  const app = useApp();
  const [v, setV] = useState<T | null>(null);
  const toast = app.toast;
  const load = useCallback(() => api.get<T>(path).then(setV).catch((e) => toast(errorMessage(e), 'bad')), [path, toast]);
  useEffect(() => { void load(); }, [load]);
  return [v, load];
}

const size = (n: number) => (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} kB`);

function Reveal({ email, pw }: { email: string; pw: string }) {
  const app = useApp();
  return (
    <Modal title="Startpasswort" onClose={() => app.overlay(null)}>
      <p style={{ marginTop: 0 }}>Für <b>{email}</b>. Jetzt weitergeben – es wird nur einmal angezeigt. Beim ersten Anmelden muss ein eigenes Passwort festgelegt werden.</p>
      <div className="reveal">{pw}</div>
    </Modal>
  );
}

interface Overview { companies: number; paused: number; accounts: number; locked: number; admins: number; active: number; dbSize: string; lastBackup: BackupFile | null; log: AuditEntry[] }

export function ServerOverview() {
  const app = useApp();
  const [o] = useLoad<Overview>('/server/overview');
  return (
    <>
      <PageHead eyebrow="Server" title="Server-Übersicht" sub={`Pitstop ${app.me.version}${o ? ` · Datenbank ${o.dbSize}` : ''}`} />
      <Note />
      {o && (
        <div className="g c12">
          <div className="s3"><Kpi label="Firmen" value={o.companies} detail={`${o.paused} pausiert`} /></div>
          <div className="s3"><Kpi label="Konten" value={o.accounts} detail={`${o.locked} gesperrt`} /></div>
          <div className="s3"><Kpi label="Server-Admins" value={o.admins} /></div>
          <div className="s3"><Kpi label="Angemeldet" value={o.active} detail="in den letzten 15 min" /></div>
          <div className="s6"><Card title="Letzte Sicherung">{o.lastBackup ? <div className="li"><div className="ib ok"><Icon name="check" /></div><div className="tx"><b>{o.lastBackup.name}</b><span>{formatAgo(o.lastBackup.createdAt)} · {size(o.lastBackup.size)}</span></div><button className="btn sm" onClick={() => app.go('srv-backup')}>Sicherungen</button></div> : <Empty title="Noch keine Sicherung"><button className="btn sm pri" style={{ marginTop: 8 }} onClick={() => app.go('srv-backup')}>Jetzt sichern</button></Empty>}</Card></div>
          <div className="s6"><Card title="Zuletzt" right={<button className="link" onClick={() => app.go('srv-log')}>Alles</button>}>{o.log.map((e) => <div key={e.id} className="li"><div className="tx"><b>{e.action}</b><span>{e.userName} · {formatAgo(e.createdAt)}</span></div></div>)}{!o.log.length && <p className="muted small">Noch nichts.</p>}</Card></div>
        </div>
      )}
    </>
  );
}

export function ServerCompanies() {
  const app = useApp();
  const [r, load] = useLoad<{ companies: ServerCompany[] }>('/server/companies');
  const [accs] = useLoad<{ accounts: ServerAccount[] }>('/server/accounts');
  const accOpts: [string, string][] = (accs?.accounts ?? []).map((a) => [a.id, `${a.displayName} (${a.email})`]);
  const done = async (msg: string) => { await load(); await app.reloadMe(); app.toast(msg); };
  return (
    <>
      <PageHead eyebrow="Server" title="Firmen" sub="Alle Firmen auf dem Server">
        <button className="btn pri" disabled={!accOpts.length} onClick={() => app.overlay(<FormModal title="Firma anlegen" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'short', label: 'Kürzel' }, { name: 'ownerId', label: 'Inhaber', type: 'select', options: accOpts }]} initial={{ ownerId: accOpts[0]?.[0] }} submit={(v) => api.post('/server/companies', v)} onDone={() => void done('Firma angelegt – mit Inhaber-Gruppe und Gruppenvorlagen')} submitLabel="Anlegen" />)}>
          <Icon name="plus" size={15} /> Firma
        </button>
      </PageHead>
      <Note />
      <Card>
        {r?.companies.length ? (
          <Table head={['Firma', 'Inhaber', ['Leute', 'r'], 'Module', 'Support', 'Status', '']}>
            {r.companies.map((c) => (
              <tr key={c.id}>
                <td><b>{c.name}</b><div className="small muted">seit {formatDateTime(c.createdAt)}</div></td>
                <td>{c.ownerName}</td>
                <td className="r mono">{c.members}</td>
                <td className="small muted">{c.modules.length}</td>
                <td>{c.supportAccess ? <Pill tone="info">erlaubt</Pill> : <span className="dim small">nicht erlaubt</span>}</td>
                <td><Pill tone={c.status === 'active' ? 'ok' : 'warn'}>{c.status === 'active' ? 'aktiv' : 'pausiert'}</Pill></td>
                <td className="r">
                  <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    <button className="btn sm ghost" onClick={() => app.overlay(<FormModal title={`Inhaber von ${c.name}`} fields={[{ name: 'userId', label: 'Neuer Inhaber', type: 'select', options: accOpts }]} submit={(v) => api.post(`/server/companies/${c.id}/owner`, v)} onDone={() => void done('Inhaber übertragen')} submitLabel="Übertragen" />)}>Inhaber</button>
                    <button className="btn sm ghost" onClick={() => app.act(() => api.patch(`/server/companies/${c.id}`, { status: c.status === 'active' ? 'paused' : 'active' })).then(() => done(c.status === 'active' ? 'Pausiert' : 'Fortgesetzt'))}>{c.status === 'active' ? 'Pausieren' : 'Fortsetzen'}</button>
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="Noch keine Firma" />}
      </Card>
    </>
  );
}

export function ServerAccounts() {
  const app = useApp();
  const [r, load] = useLoad<{ accounts: ServerAccount[] }>('/server/accounts');
  const patch = (a: ServerAccount, p: object, msg: string) => app.act(() => api.patch(`/server/accounts/${a.id}`, p), msg).then(load);
  return (
    <>
      <PageHead eyebrow="Server" title="Benutzerkonten" sub={`${r?.accounts.length ?? '…'} Konten · Server-Admin ist eine eigene Rolle pro Konto`}>
        <button className="btn pri" onClick={() => app.overlay(<FormModal title="Konto anlegen" fields={[{ name: 'email', label: 'E-Mail-Adresse', type: 'email', required: true }, { name: 'displayName', label: 'Name', required: true }, { name: 'discord', label: 'Discord' }, { name: 'isServerAdmin', label: 'Server-Admin', type: 'checkbox' }]} submit={(v) => api.post<{ startPassword: string }>('/server/accounts', v).then((x) => ({ ...x, email: v.email }))} onDone={(x) => { void load(); const y = x as { startPassword: string; email: string }; app.overlay(<Reveal email={y.email} pw={y.startPassword} />); }} submitLabel="Anlegen" />)}>
          <Icon name="plus" size={15} /> Konto
        </button>
      </PageHead>
      <Note />
      <Card>
        <Table head={['Person', 'Anmeldung', 'Firmen', 'Zuletzt', 'Status', ['Server-Admin', 'c'], '']}>
          {(r?.accounts ?? []).map((a) => (
            <tr key={a.id}>
              <td><div className="who"><Avatar name={a.displayName} /><div><b>{a.displayName}</b><span>{a.discord}</span></div></div></td>
              <td className="small muted">{a.email}{a.totpEnabled ? <div><Pill tone="ok" dot={false}>2FA</Pill></div> : a.isServerAdmin ? <div><Pill tone="warn" dot={false}>ohne 2FA</Pill></div> : null}</td>
              <td>{a.companies.map((c) => <span key={c} className="pill" style={{ marginRight: 4 }}>{c}</span>)}{!a.companies.length && <span className="dim small">keine</span>}</td>
              <td className="small muted">{a.lastLoginAt ? formatAgo(a.lastLoginAt) : 'noch nie'}</td>
              <td><Pill tone={a.active ? 'ok' : 'bad'}>{a.active ? 'aktiv' : 'gesperrt'}</Pill></td>
              <td className="c"><Switch on={a.isServerAdmin} label={`Server-Admin ${a.displayName}`} onChange={(v) => patch(a, { isServerAdmin: v }, v ? `${a.displayName} ist jetzt Server-Admin` : `${a.displayName} ist kein Server-Admin mehr`)} /></td>
              <td className="r">
                <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                  <button className="btn sm ghost" onClick={() => app.act(() => api.post<{ startPassword: string }>(`/server/accounts/${a.id}/reset-password`)).then((x) => x && app.overlay(<Reveal email={a.email} pw={x.startPassword} />))}>Passwort</button>
                  {a.id !== app.me.user.id && <button className="btn sm ghost" onClick={() => patch(a, { active: !a.active }, a.active ? 'Gesperrt' : 'Entsperrt')}>{a.active ? 'Sperren' : 'Entsperren'}</button>}
                </span>
              </td>
            </tr>
          ))}
        </Table>
      </Card>
      <p className="small muted" style={{ marginTop: 12 }}>Der letzte aktive Server-Admin kann die Rolle nicht abgeben. Gesperrte Konten werden sofort abgemeldet.</p>
    </>
  );
}

function RestoreModal({ name, onDone }: { name: string; onDone: () => void }) {
  const app = useApp();
  const [txt, setTxt] = useState('');
  return (
    <Modal title={`${name} wiederherstellen`} onClose={() => app.overlay(null)}>
      <div className="stack">
        <div className="alert warn"><Icon name="alert" /><div>Alle Daten des Servers werden auf den Stand der Sicherung gesetzt. Vorher sichert Pitstop den jetzigen Stand automatisch. Alle werden abgemeldet, auch du.</div></div>
        <div className="field"><label htmlFor="rs">Zum Bestätigen WIEDERHERSTELLEN eintippen</label><input id="rs" value={txt} onChange={(e) => setTxt(e.target.value)} autoComplete="off" /></div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={() => app.overlay(null)}>Abbrechen</button>
          <button className="btn pri" disabled={txt !== 'WIEDERHERSTELLEN'} onClick={async () => {
            try { await api.post(`/server/backups/${name}/restore`, { confirm: txt }); app.overlay(null); onDone(); }
            catch (e) { app.toast(errorMessage(e), 'bad'); }
          }}>Wiederherstellen</button>
        </div>
      </div>
    </Modal>
  );
}

export function ServerBackups() {
  const app = useApp();
  const [r, load] = useLoad<{ backups: BackupFile[] }>('/server/backups');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <PageHead eyebrow="Server" title="Sicherungen" sub="Komplette Sicherung aller Firmen und Konten als Datei unter data/backups">
        <button className="btn pri" disabled={busy} onClick={async () => { setBusy(true); await app.act(() => api.post('/server/backups'), 'Sicherung erstellt'); await load(); setBusy(false); }}><Icon name="server" size={15} /> {busy ? 'Sichert …' : 'Jetzt sichern'}</button>
      </PageHead>
      <Note />
      <div className="g c12">
        <div className="s8">
          <Card title="Vorhandene Sicherungen">
            {r?.backups.length ? (
              <Table head={['Datei', 'Erstellt', ['Größe', 'r'], '']}>
                {r.backups.map((b) => (
                  <tr key={b.name}>
                    <td className="mono small">{b.name}</td>
                    <td className="small">{formatDateTime(b.createdAt)}</td>
                    <td className="r mono">{size(b.size)}</td>
                    <td className="r"><span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}><a className="btn sm ghost" href={`/api/server/backups/${b.name}`} download>Laden</a><button className="btn sm" onClick={() => app.overlay(<RestoreModal name={b.name} onDone={() => window.location.reload()} />)}>Wiederherstellen</button></span></td>
                  </tr>
                ))}
              </Table>
            ) : <Empty title="Noch keine Sicherung" />}
          </Card>
        </div>
        <div className="s4 stack">
          <Card title="Gut zu wissen">
            <p className="small muted" style={{ marginTop: 0 }}>Die Sicherung enthält alle Tabellen außer Sitzungen, aber keine Kartenbilder (die liegen unter data/maps).</p>
            <p className="small muted">Für eine vollständige Sicherung des ganzen Systems (inklusive Datenbank-Dateien) gibt es weiterhin <span className="mono">pg_dump</span> laut README.</p>
            <p className="small muted" style={{ marginBottom: 0 }}>Eine Sicherung lässt sich nur auf derselben Pitstop-Version zurückspielen.</p>
          </Card>
        </div>
      </div>
    </>
  );
}

const SETS: [string, string, boolean][] = [
  ['konten', 'Benutzerkonten', false], ['firmen', 'Firmen', false], ['serverprotokoll', 'Server-Protokoll', false],
  ['kunden', 'Kunden', true], ['fahrzeuge', 'Fahrzeuge', true], ['auftraege', 'Aufträge', true], ['einsaetze', 'Einsätze', true], ['rechnungen', 'Rechnungen', true],
  ['buchungen', 'Buchungen', true], ['dienstzeiten', 'Dienstzeiten', true], ['mitglieder', 'Mitglieder', true], ['protokoll', 'Firmen-Protokoll', true],
];

export function ServerExport() {
  const [r] = useLoad<{ companies: ServerCompany[] }>('/server/companies');
  const [co, setCo] = useState('');
  const company = r?.companies.find((c) => c.id === co);
  return (
    <>
      <PageHead eyebrow="Server" title="Export" sub="CSV-Dateien (Semikolon, öffnet in Excel)" />
      <Note />
      <div className="g g2">
        <Card title="Server">
          <div className="chips">{SETS.filter((s) => !s[2]).map(([id, l]) => <a key={id} className="chip" href={`/api/server/export/${id}`} download>{l}</a>)}</div>
        </Card>
        <Card title="Daten einer Firma">
          <div className="field" style={{ marginBottom: 10 }}><label htmlFor="ex-co">Firma</label><select id="ex-co" value={co} onChange={(e) => setCo(e.target.value)}><option value="">Auswählen …</option>{r?.companies.map((c) => <option key={c.id} value={c.id}>{c.name}{c.supportAccess ? '' : ' (kein Support-Zugriff)'}</option>)}</select></div>
          {company && !company.supportAccess && <div className="alert warn"><Icon name="lock" /><div>{company.name} hat keinen Support-Zugriff erlaubt. Der Inhaber kann ihn unter Firmendaten freigeben oder selbst exportieren.</div></div>}
          {company?.supportAccess && <div className="chips">{SETS.filter((s) => s[2]).map(([id, l]) => <a key={id} className="chip" href={`/api/server/export/${id}?company=${co}`} download>{l}</a>)}</div>}
        </Card>
      </div>
    </>
  );
}

export function ServerLog() {
  const [r] = useLoad<{ entries: AuditEntry[] }>('/server/log');
  return (
    <>
      <PageHead eyebrow="Server" title="Server-Protokoll" sub="Konten, Firmen, Sicherungen und Exporte" />
      <Card>
        {r?.entries.length ? (
          <Table head={['Zeit', 'Wer', 'Bereich', 'Aktion']}>
            {r.entries.map((e) => <tr key={e.id}><td className="mono small">{formatDateTime(e.createdAt)}</td><td>{e.userName}</td><td><Pill dot={false}>{e.area}</Pill></td><td>{e.action}</td></tr>)}
          </Table>
        ) : <Empty title="Noch keine Einträge" />}
      </Card>
    </>
  );
}

// --- Anbindungen (0.4) ----------------------------------------------------------
type IntegrationRow = import('../../../shared/integrations').Integration & { votes: number; voted: boolean };
const ST_TONE: Record<string, string> = { verfügbar: 'ok', geplant: 'info', Idee: '' };

export function ServerIntegrations() {
  const app = useApp();
  const [list, reload] = useLoad<{ integrations: IntegrationRow[] }>('/server/integrations');
  const [keys, reloadKeys] = useLoad<{ keys: import('../../../shared/types').ApiKey[] }>('/server/api-keys');
  const [f, setF] = useState('Alle');
  const groups = [...new Set((list?.integrations ?? []).map((i) => i.group))];
  const shown = (list?.integrations ?? []).filter((i) => f === 'Alle' || i.status === f);
  const newKey = () => app.overlay(
    <FormModal title="API-Schlüssel erstellen" fields={[{ name: 'name', label: 'Wofür? (z. B. Website, Discord-Bot)', required: true }]}
      submit={(v) => api.post<{ key: string }>('/server/api-keys', v)}
      onDone={(r) => { void reloadKeys(); app.overlay(<Modal title="Neuer API-Schlüssel" onClose={() => app.overlay(null)}><p style={{ marginTop: 0 }}>Nur jetzt sichtbar – sicher aufbewahren:</p><div className="reveal">{(r as { key: string }).key}</div><p className="small muted">Abfrage z. B.: <span className="mono">GET /api/v1/companies</span> mit Kopfzeile <span className="mono">Authorization: Bearer …</span>. Firmen erscheinen nur, wenn sie unter Firmendaten „Öffentliche Daten“ eingeschaltet haben.</p></Modal>); }}
      submitLabel="Erstellen" />,
  );
  return (
    <>
      <PageHead eyebrow="Server" title="Anbindungen" sub="Was heute geht und was später kommen könnte" />
      <Note />
      <div className="chips" style={{ marginBottom: 14 }}>{['Alle', 'verfügbar', 'geplant', 'Idee'].map((x) => <button key={x} className={`chip ${f === x ? 'on' : ''}`} onClick={() => setF(x)}>{x === 'Alle' ? 'Alle' : x[0].toUpperCase() + x.slice(1)}</button>)}</div>
      {groups.map((g) => {
        const l = shown.filter((i) => i.group === g);
        return l.length ? (
          <div key={g}>
            <div className="st" style={{ margin: '18px 0 10px' }}>{g}</div>
            <div className="g g3">
              {l.map((i) => (
                <Card key={i.key}>
                  <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}><div className={`ib ${ST_TONE[i.status]}`}><Icon name="plug" /></div><div className="grow"><b>{i.name}</b><p className="small muted" style={{ margin: '4px 0 0' }}>{i.desc}</p></div></div>
                  <div className="row" style={{ marginTop: 12, gap: 8 }}>
                    <Pill tone={ST_TONE[i.status]}>{i.status === 'Idee' ? 'Idee' : i.status[0].toUpperCase() + i.status.slice(1)}</Pill>
                    <span className="grow" />
                    {i.status === 'verfügbar' ? <span className="small muted">{i.where}</span> : <button className={`btn sm ghost ${i.voted ? 'on' : ''}`} onClick={() => app.act(() => api.post(`/server/integrations/${i.key}/vote`)).then(() => reload())}>{i.voted ? <><Icon name="check" size={14} /> Gewünscht</> : 'Will ich haben'}{i.votes ? ` · ${i.votes}` : ''}</button>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        ) : null;
      })}
      <div className="g g2" style={{ marginTop: 18 }}>
        <Card title="API-Schlüssel" right={<button className="btn sm" onClick={newKey}><Icon name="plus" size={14} /> Schlüssel</button>}>
          {(keys?.keys ?? []).map((k) => (
            <div key={k.id} className="li">
              <div className={`ib ${k.revoked ? '' : 'ok'}`}><Icon name="lock" /></div>
              <div className="tx"><b>{k.name}</b><span className="mono">{k.prefix}… · {k.revoked ? 'widerrufen' : k.lastUsedAt ? `zuletzt ${formatAgo(k.lastUsedAt)}` : 'noch nie benutzt'}</span></div>
              {!k.revoked && <button className="btn sm ghost" onClick={() => app.act(() => api.post(`/server/api-keys/${k.id}/revoke`), 'Widerrufen').then(() => reloadKeys())}>Widerrufen</button>}
            </div>
          ))}
          {!keys?.keys.length && <p className="muted small" style={{ margin: 0 }}>Noch keine Schlüssel. Sie öffnen nur die Nur-Lese-API: Preisliste, Rennen, Bestenliste freigegebener Firmen.</p>}
        </Card>
        <Card title="Webhooks">
          <p className="muted small" style={{ margin: 0 }}>Webhooks richtet jede Firma selbst ein (Firmendaten → Webhooks), damit ihre Daten nur dorthin gehen, wo sie es will. Die Serververwaltung sieht sie nicht.</p>
        </Card>
      </div>
    </>
  );
}

// --- Einstellungen (0.4) --------------------------------------------------------
export function ServerSettingsPage() {
  const app = useApp();
  const [res, reload] = useLoad<{ settings: import('../../../shared/types').ServerSettings }>('/server/settings');
  const s = res?.settings;
  const save = (p: object, msg: string) => app.act(() => api.patch('/server/settings', p), msg).then(() => reload());
  const mods = (MODULES_LIST as { id: string; name: string; optional: boolean }[]).filter((m) => m.optional);
  if (!s) return <><PageHead eyebrow="Server" title="Einstellungen" /><Empty title="Lädt …" /></>;
  return (
    <>
      <PageHead eyebrow="Server" title="Einstellungen" sub="Gilt für alle Firmen auf dem Server" />
      <Note />
      <div className="g g2">
        <Card title="Wartungsmodus">
          <div className="li"><div className="tx"><b>Nur Server-Admins können arbeiten</b><span style={{ whiteSpace: 'normal' }}>Alle anderen sehen den Text unten und werden nicht angemeldet.</span></div><Switch on={s.maintenance} label="Wartungsmodus" onChange={(v) => void save({ maintenance: v }, v ? 'Wartungsmodus an' : 'Wartungsmodus aus')} /></div>
          <div className="row" style={{ gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
            <div className="field grow"><label htmlFor="mt">Text für alle anderen</label><input id="mt" defaultValue={s.maintenanceText} onBlur={(e) => e.target.value.trim() && e.target.value !== s.maintenanceText && void save({ maintenanceText: e.target.value.trim() }, 'Text gespeichert')} /></div>
          </div>
        </Card>
        <Card title="Sicherung">
          <div className="li"><div className="tx"><b>Automatisch täglich</b><span>{s.backupHour === null ? 'aus' : `ab ${s.backupHour}:00 Uhr (Serverzeit), einmal am Tag`}</span></div><Switch on={s.backupHour !== null} label="Automatische Sicherung" onChange={(v) => void save({ backupHour: v ? 4 : null }, v ? 'Automatische Sicherung an' : 'Automatische Sicherung aus')} /></div>
          <div className="g g2" style={{ gap: 8, marginTop: 10 }}>
            <div className="field"><label htmlFor="bh">Uhrzeit (0–23)</label><input id="bh" inputMode="numeric" disabled={s.backupHour === null} defaultValue={s.backupHour ?? ''} onBlur={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 0 && n <= 23 && n !== s.backupHour) void save({ backupHour: n }, 'Gespeichert'); }} /></div>
            <div className="field"><label htmlFor="bk">Aufbewahren (Anzahl)</label><input id="bk" inputMode="numeric" defaultValue={s.backupKeep} onBlur={(e) => { const n = Number(e.target.value); if (Number.isInteger(n) && n >= 1 && n <= 365 && n !== s.backupKeep) void save({ backupKeep: n }, 'Gespeichert'); }} /></div>
          </div>
          <p className="small muted" style={{ margin: '8px 0 0' }}>Gelöscht werden nur ältere automatische Sicherungen, nie die von Hand erstellten.</p>
        </Card>
        <Card title="Standard-Module für neue Firmen">
          {mods.map((m) => <div key={m.id} className="li"><div className="tx"><b>{m.name}</b></div><Switch on={s.defaultModules.includes(m.id)} label={m.name} onChange={(v) => void save({ defaultModules: v ? [...s.defaultModules, m.id] : s.defaultModules.filter((x) => x !== m.id) }, 'Gespeichert')} /></div>)}
        </Card>
        <Card title="Anmeldung">
          <div className="li"><div className="tx"><b>Registrierung</b><span>Nur mit Einladung: Konten legen Server-Admins oder Inhaber an.</span></div><Pill tone="ok">fest</Pill></div>
          <div className="li"><div className="tx"><b>Passwort</b><span>mindestens 12 Zeichen</span></div><Pill tone="ok">fest</Pill></div>
          <div className="li"><div className="tx"><b>Zwei-Faktor-Anmeldung</b><span>jede Person unter Mein Konto; Konten-Liste zeigt Server-Admins ohne 2FA. Notfall: <span className="mono">pitstop disable-2fa &lt;email&gt;</span></span></div><Pill tone="ok">verfügbar</Pill></div>
          <div className="li"><div className="tx"><b>Mit Discord anmelden</b><span>aktiv, wenn DISCORD_CLIENT_ID und DISCORD_CLIENT_SECRET in der .env stehen; nur für verknüpfte Konten</span></div><Pill tone="ok">verfügbar</Pill></div>
        </Card>
      </div>
    </>
  );
}
