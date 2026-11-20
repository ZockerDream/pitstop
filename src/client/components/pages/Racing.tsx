// Racing: Rennkalender mit Startern, Startgeld und Ergebnissen; Bestenliste je Strecke aus den Rundenzeiten.
import { useState } from 'react';
import { formatDateTime, formatUsd } from '../../../shared/format';
import type { RaceEntry, RaceEvent } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Empty, FormModal, PageHead, Pill, Seg, Table } from '../ui';
import { customerOptions } from './helpers';

export const KIND_LABEL: Record<RaceEvent['kind'], string> = { rennen: 'Eigenes Rennen', teamstart: 'Teamstart', trackday: 'Kunden-Trackday', meet: 'Meet' };
const STATUS_TONE: Record<RaceEvent['status'], string> = { planung: '', offen: 'acc', fertig: 'ok', abgesagt: 'bad' };
const STATUS_LABEL: Record<RaceEvent['status'], string> = { planung: 'Planung', offen: 'Anmeldung offen', fertig: 'Gefahren', abgesagt: 'Abgesagt' };

/** 2:11.470 → Millisekunden; leer → null */
export function parseLap(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^(?:(\d+)[:.])?(\d{1,2})[.,](\d{1,3})$/.exec(t);
  if (!m) throw new Error('Rundenzeit wie 2:11.470');
  return (Number(m[1] ?? 0) * 60 + Number(m[2])) * 1000 + Number(m[3].padEnd(3, '0'));
}
export const formatLap = (ms: number | null) => (ms === null ? '–' : `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, '0')}.${String(ms % 1000).padStart(3, '0')}`);
const localInput = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

function openEvent(app: AppCtx, e?: RaceEvent) {
  app.overlay(
    <FormModal
      title={e ? e.name : 'Event planen'}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'kind', label: 'Art', type: 'select', options: Object.entries(KIND_LABEL) as [string, string][] },
        { name: 'when', label: 'Start (JJJJ-MM-TTTHH:MM)', required: true, placeholder: '2026-11-23T20:00' },
        { name: 'track', label: 'Strecke' },
        { name: 'laps', label: 'Runden', type: 'number' },
        { name: 'feeCents', label: 'Startgeld', type: 'usd' },
        { name: 'prizeCents', label: 'Preisgeld', type: 'usd' },
        { name: 'maxEntries', label: 'Startplätze (0 = offen)', type: 'number' },
        { name: 'status', label: 'Status', type: 'select', options: Object.entries(STATUS_LABEL) as [string, string][] },
        { name: 'note', label: 'Notiz', type: 'textarea' },
      ]}
      initial={e ? { ...e, when: localInput(e.startsAt) } : { kind: 'rennen', status: 'planung', when: localInput(new Date(Date.now() + 7 * 86_400_000).toISOString()).slice(0, 11) + '20:00' }}
      submit={(v) => {
        const d = new Date(String(v.when));
        if (Number.isNaN(d.getTime())) throw new Error('Start wie 2026-11-23T20:00');
        const body = { ...v, when: undefined, startsAt: d.toISOString(), laps: v.laps ?? 0, maxEntries: v.maxEntries ?? 0 };
        return e ? api.patch(app.c(`/events/${e.id}`), body) : api.post(app.c('/events'), body);
      }}
      onDone={() => app.toast('Event gespeichert')}
    />,
  );
}

function openEntry(app: AppCtx, ev: RaceEvent, en?: RaceEntry) {
  app.overlay(
    <FormModal
      title={en ? en.driver : `Starter: ${ev.name}`}
      fields={[
        { name: 'driver', label: 'Fahrer', required: true },
        { name: 'car', label: 'Fahrzeug' },
        { name: 'startNo', label: 'Startnummer' },
        { name: 'customerId', label: 'Kunde', type: 'select', options: customerOptions(app.data) },
        ...(app.data!.raceCars.length ? [{ name: 'carId', label: 'Unser Rennwagen', type: 'select' as const, options: [['', '– keiner –'], ...app.data!.raceCars.map((c) => [c.id, `#${c.number} ${c.car}`] as [string, string])] as [string, string][] }] : []),
        { name: 'team', label: 'Fährt für unser Team', type: 'checkbox' },
        { name: 'lap', label: 'Beste Runde (2:11.470)' },
        { name: 'position', label: 'Platz', type: 'number' },
      ]}
      initial={en ? { ...en, lap: en.lapMs ? formatLap(en.lapMs) : '' } : {}}
      submit={(v) => {
        const car = app.data!.raceCars.find((c) => c.id === v.carId);
        const body = { driver: v.driver, car: v.car || car?.car || '', startNo: v.startNo || car?.number || '', customerId: v.customerId, carId: v.carId || null, team: !!v.team || !!car, lapMs: parseLap(String(v.lap ?? '')), position: v.position ?? null };
        return en ? api.patch(app.c(`/entries/${en.id}`), body) : api.post(app.c(`/events/${ev.id}/entries`), body);
      }}
      onDone={() => app.toast('Starter gespeichert')}
    />,
  );
}

export function RennkalenderPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('racing', 2);
  const [f, setF] = useState<'kommend' | 'vergangen'>('kommend');
  const [now] = useState(() => new Date(Date.now() - 6 * 3_600_000).toISOString());
  const list = d.events.filter((e) => (f === 'kommend' ? e.startsAt >= now : e.startsAt < now));
  if (f === 'vergangen') list.reverse();
  return (
    <>
      <PageHead eyebrow="Racing" title="Rennkalender" sub={`${d.events.filter((e) => e.startsAt >= now && e.status !== 'abgesagt').length} kommende Events`}>
        <Seg value={f} options={[['kommend', 'Kommend'], ['vergangen', 'Vergangen']]} onChange={setF} />
        {edit && <button className="btn pri" onClick={() => openEvent(app)}><Icon name="plus" size={15} /> Event</button>}
      </PageHead>
      <div className="g c12">
      <div className="s8 stack">
        {list.map((e) => {
          const entries = d.entries.filter((x) => x.eventId === e.id);
          const dt = new Date(e.startsAt);
          return (
            <Card key={e.id}>
              <div className="row wrap" style={{ alignItems: 'flex-start' }}>
                <div className="kpi" style={{ width: 64, height: 'auto', textAlign: 'center' }}><span className="v" style={{ fontSize: 28 }}>{dt.getDate()}</span><span className="l">{dt.toLocaleDateString('de-DE', { month: 'short' })}</span></div>
                <div className="grow" style={{ minWidth: 200 }}>
                  <div className="row wrap" style={{ gap: 8 }}><b style={{ fontSize: 17 }}>{e.name}</b><Pill tone={STATUS_TONE[e.status]}>{STATUS_LABEL[e.status]}</Pill><Pill dot={false}>{KIND_LABEL[e.kind]}</Pill></div>
                  <div className="small muted" style={{ marginTop: 3 }}>{formatDateTime(e.startsAt)}{e.track ? ` · ${e.track}` : ''}{e.laps ? ` · ${e.laps} Runden` : ''} · Startgeld {formatUsd(e.feeCents)}{e.prizeCents ? ` · Preisgeld ${formatUsd(e.prizeCents)}` : ''}</div>
                  {e.maxEntries > 0 && <><div className="bar" style={{ margin: '8px 0 4px', maxWidth: 320 }}><i style={{ width: `${Math.min(100, (entries.length / e.maxEntries) * 100)}%` }} /></div><div className="small muted">{entries.length} von {e.maxEntries} Startplätzen</div></>}
                </div>
                {edit && <div className="row" style={{ gap: 6 }}><button className="btn sm" onClick={() => openEntry(app, e)}>+ Starter</button><button className="btn sm ghost" onClick={() => openEvent(app, e)}>Bearbeiten</button>{app.can('racing', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`${e.name} löschen?`} text="Event mit allen Startern und Zeiten löschen." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/events/${e.id}`)), 'Event gelöscht')} />)}>Löschen</button>}</div>}
              </div>
              {entries.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Table head={['Platz', 'Fahrer', 'Fahrzeug', ['Beste Runde', 'r'], 'Startgeld', '']}>
                    {entries.map((x) => (
                      <tr key={x.id}>
                        <td><span className={`pos-n ${x.position === 1 ? 'p1' : ''}`}>{x.position ?? '–'}</span></td>
                        <td><b>{x.startNo ? `#${x.startNo} ` : ''}{x.driver}</b> {x.team && <Pill tone="acc" dot={false}>Team</Pill>}</td>
                        <td className="small">{x.car}</td>
                        <td className="r mono">{formatLap(x.lapMs)}</td>
                        <td>{x.paid ? <Pill tone="ok">bezahlt</Pill> : e.feeCents > 0 && edit ? <button className="btn sm" onClick={() => app.act(() => api.post(app.c(`/entries/${x.id}/pay`)), 'Startgeld in die Kasse gebucht')}>Kassieren</button> : <Pill>offen</Pill>}</td>
                        <td className="r">{edit && <><button className="btn sm ghost" onClick={() => openEntry(app, e, x)}>Ändern</button><button className="ibtn" aria-label="Starter entfernen" onClick={() => app.act(() => api.del(app.c(`/entries/${x.id}`)), 'Starter entfernt')}><Icon name="x" size={13} /></button></>}</td>
                      </tr>
                    ))}
                  </Table>
                </div>
              )}
            </Card>
          );
        })}
        {!list.length && <Card><Empty title={f === 'kommend' ? 'Keine kommenden Events' : 'Noch nichts gefahren'}>{edit && f === 'kommend' ? 'Mit „+ Event“ ein Rennen, einen Teamstart oder einen Trackday planen.' : null}</Empty></Card>}
      </div>
      <div className="s4 stack">
        <Championship />
        {app.can('buchungen') && <Card title="Rennbudget"><div className="kpi"><span className="v">{formatUsd(d.transactions.filter((t) => t.account === 'rennteam').reduce((a, t) => a + t.amountCents, 0))}</span><span className="d">Stand Konto „Rennteam“ · Startgelder und Preisgelder bucht ihr unter Buchungen oder per Umbuchung</span></div></Card>}
      </div>
      </div>
    </>
  );
}

function Championship() {
  const app = useApp();
  const d = app.data!;
  const years = [...new Set([new Date().getFullYear(), ...d.championship.map((c) => c.season)])].sort((a, b) => b - a);
  const [season, setSeason] = useState(years[0]);
  const rows = d.championship.filter((c) => c.season === season).sort((a, b) => b.points - a.points);
  const edit = app.can('racing', 2);
  const form = (r?: (typeof rows)[number]) => app.overlay(
    <FormModal title={r ? r.team : 'Team in der Meisterschaft'} fields={[{ name: 'team', label: 'Team', required: true }, { name: 'points', label: 'Punkte', type: 'number' }, { name: 'own', label: 'Das sind wir', type: 'checkbox' }]}
      initial={r ?? { points: 0 }} submit={(v) => (r ? api.patch(app.c(`/championship/${r.id}`), v) : api.post(app.c('/championship'), { ...v, season, points: v.points ?? 0 }))} onDone={() => app.toast('Gespeichert')}>
      {r && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => app.act(() => api.del(app.c(`/championship/${r.id}`)), 'Entfernt').then(() => app.overlay(null))}>Aus der Tabelle entfernen</button>}
    </FormModal>,
  );
  return (
    <Card title={`Meisterschaft ${season}`} right={<>{years.length > 1 && <select value={season} onChange={(e) => setSeason(Number(e.target.value))} aria-label="Saison">{years.map((y) => <option key={y}>{y}</option>)}</select>}{edit && <button className="btn sm" onClick={() => form()}>+ Team</button>}</>}>
      {rows.length ? rows.map((r, i) => (
        <div key={r.id} className="li" data-o={edit ? '' : undefined} onClick={edit ? () => form(r) : undefined}>
          <span className={`pos-n ${i === 0 ? 'p1' : ''}`}>{i + 1}</span>
          <div className="tx"><b style={r.own ? { color: 'var(--accent)' } : undefined}>{r.team}</b></div>
          <span className="mono">{r.points}</span>
        </div>
      )) : <p className="muted small" style={{ margin: 0 }}>Noch keine Tabelle für {season}.</p>}
    </Card>
  );
}

export function bestLaps(d: NonNullable<AppCtx['data']>, track: string) {
  const ev = new Map(d.events.map((e) => [e.id, e]));
  const best = new Map<string, RaceEntry & { event: RaceEvent }>();
  const add = (x: RaceEntry, e: RaceEvent) => {
    const k = x.driver.toLowerCase();
    const cur = best.get(k);
    if (!cur || (x.lapMs ?? Infinity) < (cur.lapMs ?? Infinity)) best.set(k, { ...x, event: e });
  };
  for (const x of d.entries) {
    const e = ev.get(x.eventId);
    if (!e || x.lapMs === null || (track && e.track !== track)) continue;
    add(x, e);
  }
  // Trainingsrunden aus „Setups & Telemetrie“ zählen mit
  for (const l of d.laps) {
    if (!l.driver || (track && l.track !== track)) continue;
    const car = d.raceCars.find((c) => c.id === l.carId);
    add(
      { id: l.id, eventId: '', driver: l.driver, car: car?.car ?? '', startNo: car?.number ?? '', customerId: null, team: true, paid: false, lapMs: l.s1 + l.s2 + l.s3, position: null, carId: l.carId },
      { id: '', name: l.session, kind: 'rennen', startsAt: l.createdAt, track: l.track, laps: 0, feeCents: 0, prizeCents: 0, maxEntries: 0, status: 'fertig', note: '' },
    );
  }
  return [...best.values()].sort((a, b) => (a.lapMs ?? 0) - (b.lapMs ?? 0));
}

export function BestenlistePage() {
  const app = useApp();
  const d = app.data!;
  const tracks = [...new Set([...d.events.filter((e) => d.entries.some((x) => x.eventId === e.id && x.lapMs)).map((e) => e.track), ...d.laps.filter((l) => l.driver).map((l) => l.track)].filter(Boolean))];
  const [track, setTrack] = useState(tracks[0] ?? '');
  const list = bestLaps(d, track);
  const top = list[0]?.lapMs ?? 0;
  return (
    <>
      <PageHead eyebrow="Racing" title="Bestenliste" sub="Beste Runde je Fahrer aus allen Events">
        {tracks.length > 1 && <select value={track} onChange={(e) => setTrack(e.target.value)} aria-label="Strecke">{tracks.map((t) => <option key={t}>{t}</option>)}</select>}
      </PageHead>
      <Card title={track || 'Alle Strecken'}>
        {list.length ? list.map((x, i) => (
          <div key={x.id} className="li">
            <span className={`pos-n ${i === 0 ? 'p1' : ''}`}>{i + 1}</span>
            <div className="tx"><b>{x.driver} {x.team && <Pill tone="acc" dot={false}>Team</Pill>}</b><span>{x.car} · {x.event.name}</span></div>
            <span className="mono">{formatLap(x.lapMs)}</span>
            <span className="mono small muted" style={{ width: 64, textAlign: 'right' }}>{i ? `+${((x.lapMs! - top) / 1000).toFixed(3)}` : ''}</span>
          </div>
        )) : <Empty title="Noch keine Zeiten">Beim Starter im Rennkalender die beste Runde eintragen.</Empty>}
      </Card>
    </>
  );
}
