// Personal ab 0.4: Ränge (Hierarchie und Lohnmodell, Befördern mit Gruppen-Vorschlag) und Bewerbungen (Gespräch, Einstellen → Konto).
import { useState } from 'react';
import { formatDateTime, formatUsd } from '../../../shared/format';
import type { Application, Rank } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Avatar, Card, Confirm, Empty, FormModal, Modal, PageHead, Pill, Table } from '../ui';

export const wageModel = (r: { wageCents: number; commissionPct: number; fixedCents: number }) =>
  [r.wageCents && `${formatUsd(r.wageCents)}/h`, r.commissionPct && `${r.commissionPct} %`, r.fixedCents && `${formatUsd(r.fixedCents)} fix`].filter(Boolean).join(' · ') || '–';

function rankForm(app: AppCtx, r?: Rank) {
  const d = app.data!;
  app.overlay(
    <FormModal
      title={r ? r.name : 'Neuer Rang'}
      fields={[
        { name: 'name', label: 'Rang', required: true },
        { name: 'position', label: 'Stufe (1 = oben)', type: 'number' },
        { name: 'wageCents', label: 'Stundenlohn', type: 'usd' },
        { name: 'commissionPct', label: 'Provision in %', type: 'number' },
        { name: 'fixedCents', label: 'Fixum je Lohnlauf', type: 'usd' },
        { name: 'groups', label: 'Gruppen beim Befördern vorschlagen', type: 'multi', options: d.groups.filter((g) => !g.isOwner).map((g) => [g.id, g.name]) },
      ]}
      initial={r ?? { position: d.ranks.length + 1, groups: [] }}
      submit={(v) => {
        const body = { ...v, position: v.position ?? 0, commissionPct: v.commissionPct ?? 0 };
        return r ? api.patch(app.c(`/ranks/${r.id}`), body) : api.post(app.c('/ranks'), body);
      }}
      onDone={() => app.toast('Rang gespeichert')}
    />,
  );
}

function Promote({ preset }: { preset?: string }) {
  const app = useApp();
  const d = app.data!;
  const [userId, setUserId] = useState(preset ?? d.members.find((m) => !m.locked)?.userId ?? '');
  const [rankId, setRankId] = useState(d.ranks[0]?.id ?? '');
  const canGroups = app.can('gruppen', 2);
  const canWage = app.can('lohn', 3);
  const [groups, setGroups] = useState(canGroups);
  const [wage, setWage] = useState(canWage);
  const rank = d.ranks.find((r) => r.id === rankId);
  const member = d.members.find((m) => m.userId === userId);
  const add = rank ? d.groups.filter((g) => rank.groups.includes(g.id) && !g.members.includes(userId)) : [];
  return (
    <Modal title="Befördern" onClose={() => app.overlay(null)}>
      <div className="stack">
        <div className="field"><label htmlFor="pr-u">Person</label><select id="pr-u" value={userId} onChange={(e) => setUserId(e.target.value)}>{d.members.filter((m) => !m.locked).map((m) => <option key={m.userId} value={m.userId}>{m.displayName} ({m.rank || 'ohne Rang'})</option>)}</select></div>
        <div className="field"><label htmlFor="pr-r">Neuer Rang</label><select id="pr-r" value={rankId} onChange={(e) => setRankId(e.target.value)}>{d.ranks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></div>
        {rank && (
          <>
            {canGroups ? <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={groups} onChange={(e) => setGroups(e.target.checked)} /> Gruppen dazu: {add.length ? add.map((g) => g.name).join(', ') : 'keine neuen'}</label> : <p className="small muted" style={{ margin: 0 }}>Gruppen ändert jemand mit Recht auf „Gruppen & Rechte“.</p>}
            {canWage ? <label className="row small" style={{ gap: 8 }}><input type="checkbox" checked={wage} onChange={(e) => setWage(e.target.checked)} /> Lohnmodell übernehmen: {wageModel(rank)}</label> : null}
            <div className="alert ok"><Icon name="shield" /><div>{member?.displayName} wird {rank.name}. Bestehende Gruppen bleiben; nur die vorgeschlagenen kommen dazu.</div></div>
          </>
        )}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={() => app.overlay(null)}>Abbrechen</button>
          <button className="btn pri" disabled={!rank || !userId} onClick={async () => { app.overlay(null); await app.act(() => api.post(app.c(`/ranks/${rankId}/assign`), { userId, groups: groups && canGroups, wage: wage && canWage }), 'Befördert'); }}>Bestätigen</button>
        </div>
      </div>
    </Modal>
  );
}

export function RaengePage() {
  const app = useApp();
  const d = app.data!;
  const manage = app.can('raenge', 3);
  const gc = (id: string) => d.groups.find((g) => g.id === id);
  return (
    <>
      <PageHead eyebrow="Personal" title="Ränge" sub="Hierarchie und Lohn. Die Rechte selbst stehen in den Gruppen.">
        {app.can('gruppen') && <a className="btn" href="#gruppen"><Icon name="shield" size={15} /> Gruppen & Rechte</a>}
        {app.can('zugaenge', 2) && d.ranks.length > 0 && <button className="btn" onClick={() => app.overlay(<Promote />)}>Befördern</button>}
        {manage && <button className="btn pri" onClick={() => rankForm(app)}><Icon name="plus" size={15} /> Rang</button>}
      </PageHead>
      <Card title="Ränge von oben nach unten">
        {d.ranks.length ? (
          <Table head={['#', 'Rang', 'Lohnmodell', 'Gruppen beim Befördern', ['Leute', 'r'], '']}>
            {d.ranks.map((r, i) => {
              const people = d.members.filter((m) => m.rank === r.name);
              return (
                <tr key={r.id}>
                  <td className="mono dim">{i + 1}</td>
                  <td><b>{r.name}</b></td>
                  <td className="small">{wageModel(r)}</td>
                  <td><div className="row wrap" style={{ gap: 4 }}>{r.groups.map((g) => { const x = gc(g); return x ? <span key={g} className="pill gpill" style={{ ['--gc' as string]: x.color }}>{x.name}</span> : null; })}</div></td>
                  <td className="r"><span className="mono" title={people.map((p) => p.displayName).join(', ')}>{people.length}</span></td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>{manage && <><button className="btn sm ghost" onClick={() => rankForm(app, r)}>Ändern</button><button className="ibtn" aria-label={`${r.name} löschen`} onClick={() => app.overlay(<Confirm title={`${r.name} löschen?`} text="Mitglieder behalten ihren Rang als Text." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/ranks/${r.id}`)), 'Gelöscht')} />)}><Icon name="x" size={13} /></button></>}</td>
                </tr>
              );
            })}
          </Table>
        ) : <Empty title="Noch keine Ränge">{manage ? 'Mit „+ Rang“ z. B. Werkstattleitung, Mechaniker, Azubi anlegen.' : null}</Empty>}
      </Card>
      <div className="alert ok" style={{ marginTop: 14 }}><Icon name="shield" /><div>Beim Befördern schlägt Pitstop die Gruppen des neuen Rangs vor. Du bestätigst, bevor sich Rechte ändern. Rang und Rechte bleiben getrennt, damit z. B. ein Azubi trotzdem die Kasse machen darf.</div></div>
    </>
  );
}

// --- Bewerbungen ------------------------------------------------------------
const A_STATUS: Record<Application['status'], [string, string]> = { neu: ['Neu', ''], gespraech: ['Gespräch', 'info'], eingestellt: ['Eingestellt', 'ok'], abgesagt: ['Abgesagt', 'bad'] };
const stars = (n: number) => <span className="mono" style={{ color: 'var(--accent-2)' }}>{'★'.repeat(n)}<span className="dim">{'★'.repeat(5 - n)}</span></span>;

function appForm(app: AppCtx, a?: Application) {
  app.overlay(
    <FormModal
      title={a ? a.name : 'Bewerbung erfassen'}
      fields={[
        { name: 'name', label: 'Name', required: true }, { name: 'role', label: 'Als (z. B. Mechaniker)' }, { name: 'contact', label: 'Kontakt (Telefon, Discord, E-Mail)' },
        { name: 'text', label: 'Bewerbung / Notizen', type: 'textarea' }, { name: 'rating', label: 'Ersteindruck (0–5 Sterne)', type: 'number' },
        { name: 'interviewAt', label: 'Gespräch am', type: 'datetime' },
      ]}
      initial={a ?? { rating: 3 }}
      submit={(v) => {
        const body = { ...v, rating: Math.max(0, Math.min(5, Math.round(Number(v.rating ?? 0)))), ...(v.interviewAt && (!a || a.status === 'neu') ? { status: 'gespraech' } : {}) };
        return a ? api.patch(app.c(`/applications/${a.id}`), body) : api.post(app.c('/applications'), body);
      }}
      onDone={() => app.toast('Gespeichert')}
    />,
  );
}

function hire(app: AppCtx, a: Application) {
  const d = app.data!;
  const mail = /\S+@\S+\.\S+/.exec(a.contact)?.[0] ?? '';
  app.overlay(
    <FormModal
      title={`${a.name} einstellen`}
      fields={[{ name: 'email', label: 'E-Mail für das Konto', type: 'email', required: true }, ...(d.ranks.length ? [{ name: 'rankId', label: 'Rang', type: 'select' as const, options: [['', `– ${a.role || 'ohne Rang'} –`], ...d.ranks.map((r) => [r.id, `${r.name} · ${wageModel(r)}`] as [string, string])] as [string, string][] }] : [])]}
      initial={{ email: mail, rankId: d.ranks.find((r) => r.name.toLowerCase() === a.role.toLowerCase())?.id ?? '' }}
      submit={(v) => api.post(app.c(`/applications/${a.id}/hire`), v)}
      onDone={(r) => {
        const res = r as { startPassword: string | null };
        app.overlay(
          <Modal title={`${a.name} ist im Team`} onClose={() => app.overlay(null)}>
            {res.startPassword ? <p style={{ marginTop: 0 }}>Startpasswort (nur jetzt sichtbar): <b className="mono">{res.startPassword}</b><br /><span className="small muted">Beim ersten Anmelden muss ein eigenes Passwort gewählt werden.</span></p> : <p style={{ marginTop: 0 }}>Das Konto gab es schon; die Person ist jetzt Mitglied der Firma.</p>}
          </Modal>,
        );
      }}
      submitLabel="Einstellen"
    />,
  );
}

export function BewerbungenPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('bewerbungen', 2);
  const [f, setF] = useState<'offen' | 'alle'>('offen');
  const list = d.applications.filter((a) => f === 'alle' || a.status === 'neu' || a.status === 'gespraech');
  const open = d.applications.filter((a) => a.status === 'neu' || a.status === 'gespraech');
  const canHire = app.can('zugaenge', 2) && app.special('einladen');
  const status = (a: Application, status: Application['status'], msg: string) => app.act(() => api.patch(app.c(`/applications/${a.id}`), { status }), msg);
  return (
    <>
      <PageHead eyebrow="Personal" title="Bewerbungen" sub={`${open.length} offen · ${d.applications.filter((a) => a.status === 'gespraech').length} Gespräche geplant`}>
        <div className="seg">{(['offen', 'alle'] as const).map((k) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{k === 'offen' ? 'Offen' : 'Alle'}</button>)}</div>
        {edit && <button className="btn pri" onClick={() => appForm(app)}><Icon name="plus" size={15} /> Bewerbung</button>}
      </PageHead>
      {list.length ? (
        <div className="g g3">
          {list.map((a) => {
            const [label, tone] = A_STATUS[a.status];
            return (
              <Card key={a.id}>
                <div className="who"><Avatar name={a.name} size={40} color="var(--panel-3)" /><div className="grow"><b>{a.name}</b><span>{a.role ? `als ${a.role}` : ''}{a.contact ? ` · ${a.contact}` : ''}</span></div><Pill tone={tone}>{a.status === 'gespraech' && a.interviewAt ? `Gespräch ${formatDateTime(a.interviewAt)}` : label}</Pill></div>
                {a.text && <p className="muted small" style={{ margin: '12px 0', whiteSpace: 'pre-wrap' }}>{a.text}</p>}
                <div className="small">{stars(a.rating)} <span className="muted">Ersteindruck</span></div>
                {edit && (
                  <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
                    {a.status !== 'eingestellt' && a.status !== 'abgesagt' && canHire && <button className="btn sm pri" onClick={() => hire(app, a)}>Einstellen</button>}
                    {(a.status === 'neu' || a.status === 'gespraech') && <button className="btn sm" onClick={() => app.overlay(<FormModal title={`Gespräch mit ${a.name}`} fields={[{ name: 'interviewAt', label: 'Wann?', type: 'datetime', required: true }]} initial={{ interviewAt: a.interviewAt ?? '' }} submit={(v) => api.patch(app.c(`/applications/${a.id}`), { ...v, status: 'gespraech' })} onDone={() => app.toast('Gespräch geplant')} />)}>Gespräch</button>}
                    {(a.status === 'neu' || a.status === 'gespraech') && <button className="btn sm ghost" onClick={() => void status(a, 'abgesagt', 'Absage vermerkt')}>Absagen</button>}
                    {a.status === 'abgesagt' && <button className="btn sm ghost" onClick={() => void status(a, 'neu', 'Wieder offen')}>Wieder öffnen</button>}
                    <button className="btn sm ghost" onClick={() => appForm(app, a)}>Bearbeiten</button>
                    {app.can('bewerbungen', 3) && <button className="ibtn" aria-label="Bewerbung löschen" onClick={() => app.overlay(<Confirm title={`Bewerbung ${a.name} löschen?`} text="Endgültig entfernen (z. B. nach Datenschutz-Anfrage)." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/applications/${a.id}`)), 'Gelöscht')} />)}><Icon name="x" size={13} /></button>}
                  </div>
                )}
                {a.status !== 'eingestellt' && a.status !== 'abgesagt' && edit && !canHire && <p className="small dim" style={{ margin: '8px 0 0' }}>Einstellen braucht „Mitglieder & Zugänge“ und das Sonderrecht „Leute aufnehmen“.</p>}
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title={d.applications.length ? 'Keine offenen Bewerbungen' : 'Noch keine Bewerbungen'} /></Card>}
    </>
  );
}

export { Promote };
