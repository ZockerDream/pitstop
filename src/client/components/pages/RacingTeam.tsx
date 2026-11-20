// Racing ab 0.4: Team & Rennwagen (Verschleiß, Budget, Saisonergebnisse), Setups & Telemetrie (Sektoren, Rundenvergleich), Kunden-Trackdays.
import { useState } from 'react';
import { formatDate, formatUsd } from '../../../shared/format';
import type { Lap, RaceCar, TrackdayBooking } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Empty, FormModal, Kpi, PageHead, Pill, Table } from '../ui';
import { customerName, customerOptions, memberName, memberOptions, plateOf, sum, vehicleOptions } from './helpers';
import { formatLap, parseLap } from './Racing';

type Data = NonNullable<AppCtx['data']>;
const WEAR = ['Motor', 'Bremsen', 'Reifen', 'Getriebe'];
const CAR_STATUS: Record<RaceCar['status'], [string, string]> = { bereit: ['Einsatzbereit', 'ok'], wartung: ['Wartung fällig', 'warn'], defekt: ['Defekt', 'bad'] };
export const carLabel = (d: Data, id: string | null) => { const c = d.raceCars.find((x) => x.id === id); return c ? `#${c.number} ${c.car}` : '–'; };
const balance = (d: Data, acc: string) => sum(d.transactions.filter((t) => t.account === acc).map((t) => t.amountCents));

function carForm(app: AppCtx, c?: RaceCar) {
  app.overlay(
    <FormModal
      title={c ? `#${c.number} ${c.car}` : 'Neuer Rennwagen'}
      fields={[
        { name: 'number', label: 'Startnummer' }, { name: 'car', label: 'Fahrzeug', required: true },
        { name: 'driverId', label: 'Stammfahrer', type: 'select', options: memberOptions(app.data) },
        { name: 'status', label: 'Zustand', type: 'select', options: Object.entries(CAR_STATUS).map(([k, [l]]) => [k, l]) },
        { name: 'km', label: 'km seit Revision', type: 'number' }, { name: 'budgetCents', label: 'Saisonbudget', type: 'usd' },
        ...WEAR.map((w) => ({ name: `w_${w}`, label: `Verschleiß ${w} in %`, type: 'number' as const })),
        { name: 'note', label: 'Notiz', type: 'textarea' },
      ]}
      initial={c ? { ...c, ...Object.fromEntries(WEAR.map((w) => [`w_${w}`, c.wear[w] ?? 0])) } : { status: 'bereit' }}
      submit={(v) => {
        const wear = Object.fromEntries(WEAR.map((w) => [w, Math.max(0, Math.min(100, Math.round(Number(v[`w_${w}`] ?? 0))))]));
        const body = { number: v.number, car: v.car, driverId: v.driverId, status: v.status, km: v.km ?? 0, budgetCents: v.budgetCents, note: v.note, wear };
        return c ? api.patch(app.c(`/race-cars/${c.id}`), body) : api.post(app.c('/race-cars'), body);
      }}
      onDone={() => app.toast('Gespeichert')}
    />,
  );
}

export function TeamPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('racing', 2);
  const teamEntries = d.entries.filter((x) => x.carId || x.team);
  const results = d.events.filter((e) => teamEntries.some((x) => x.eventId === e.id) && e.status === 'fertig').sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  const season = new Date().getFullYear();
  const spent = -sum(d.transactions.filter((t) => t.account === 'rennteam' && t.amountCents < 0 && t.bookedAt.startsWith(String(season))).map((t) => t.amountCents));
  const budget = sum(d.raceCars.map((c) => c.budgetCents));
  return (
    <>
      <PageHead eyebrow="Racing" title="Team & Rennwagen" sub="Fahrer, Rennwagen und deren Zustand">
        {edit && <button className="btn pri" onClick={() => carForm(app)}><Icon name="plus" size={15} /> Rennwagen</button>}
      </PageHead>
      <div className="g g3" style={{ marginBottom: 14 }}>
        <Kpi label="Rennteam-Konto" value={app.can('buchungen') ? formatUsd(balance(d, 'rennteam')) : '–'} detail={app.can('buchungen') ? `${formatUsd(spent)} ausgegeben ${season}` : 'nur mit Recht auf Buchungen'} />
        <Kpi label="Saisonbudget" value={formatUsd(budget)} detail={budget ? `${Math.round((spent / budget) * 100)} % verbraucht` : 'je Wagen festlegen'} />
        <Kpi label="Siege" value={teamEntries.filter((x) => x.position === 1).length} detail={`${teamEntries.filter((x) => x.position).length} Zieleinläufe`} />
      </div>
      {d.raceCars.length ? (
        <div className="g g2">
          {d.raceCars.map((c) => {
            const mine = d.entries.filter((x) => x.carId === c.id);
            const [label, tone] = CAR_STATUS[c.status];
            return (
              <Card key={c.id}>
                <div className="hero-car">
                  <div className="num">{c.number || '–'}</div>
                  <div className="grow"><b style={{ fontSize: 18 }}>{c.car}</b><div className="small muted" style={{ marginTop: 4 }}>{memberName(d, c.driverId) || 'kein Stammfahrer'}</div></div>
                  <Pill tone={tone}>{label}</Pill>
                </div>
                <div className="stats" style={{ marginTop: 14 }}>
                  <div><span>Starts</span><b>{mine.length}</b></div>
                  <div><span>Siege</span><b>{mine.filter((x) => x.position === 1).length}</b></div>
                  <div><span>km seit Revision</span><b>{c.km.toLocaleString('de-DE')}</b></div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="st">Verschleiß</div>
                  {WEAR.map((w) => { const p = c.wear[w] ?? 0; return <div key={w} className="row small" style={{ marginBottom: 6 }}><span style={{ width: 76, flex: 'none' }}>{w}</span><div className={`bar grow ${p < 60 ? 'ok' : ''}`}><i style={{ width: `${p}%` }} /></div><span className="mono" style={{ width: 40, textAlign: 'right', flex: 'none' }}>{p}%</span></div>; })}
                </div>
                <div className="row small" style={{ marginTop: 10 }}><span className="muted">Budget</span><span className="money" style={{ marginLeft: 'auto' }}>{formatUsd(c.budgetCents)}</span></div>
                {c.note && <p className="small muted" style={{ margin: '8px 0 0' }}>{c.note}</p>}
                {edit && <div className="row" style={{ marginTop: 12, gap: 6 }}><button className="btn sm" onClick={() => carForm(app, c)}>Bearbeiten</button>{app.can('racing', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`#${c.number} löschen?`} text="Setups und Runden des Wagens bleiben ohne Zuordnung." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/race-cars/${c.id}`)), 'Gelöscht')} />)}>Löschen</button>}</div>}
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title="Noch keine Rennwagen">{edit ? 'Mit „+ Rennwagen“ anlegen; beim Starter im Rennkalender den Wagen wählen.' : null}</Empty></Card>}
      <div style={{ marginTop: 14 }}>
        <Card title={`Ergebnisse Saison ${season}`}>
          {results.length ? (
            <Table head={['Datum', 'Event', ...d.raceCars.map((c) => `#${c.number}`), ['Preisgeld', 'r']]}>
              {results.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{formatDate(e.startsAt.slice(0, 10))}</td>
                  <td>{e.name}</td>
                  {d.raceCars.map((c) => { const x = d.entries.find((y) => y.eventId === e.id && y.carId === c.id); return <td key={c.id}>{x ? <span className={`lvl ${x.position === 1 ? 'a' : ''}`}>{x.position ? `P${x.position}` : 'DNF'}</span> : '–'}</td>; })}
                  <td className="r money pos">{teamEntries.some((x) => x.eventId === e.id && x.position === 1) ? `+${formatUsd(e.prizeCents)}` : '–'}</td>
                </tr>
              ))}
            </Table>
          ) : <Empty title="Noch keine gefahrenen Rennen mit Teamwagen" />}
        </Card>
      </div>
    </>
  );
}

// --- Setups & Telemetrie ----------------------------------------------------
const lapMs = (l: Lap) => l.s1 + l.s2 + l.s3;
const sec = (ms: number) => `${ms < 0 ? '−' : '+'}${(Math.abs(ms) / 1000).toFixed(2).replace('.', ',')}`;

function DeltaChart({ lap, best }: { lap: Lap; best: Lap }) {
  // Abstand nach jedem Sektor (kumuliert); unter 0 = schneller als die Referenz
  const pts = [0, lap.s1 - best.s1, lap.s1 + lap.s2 - best.s1 - best.s2, lapMs(lap) - lapMs(best)];
  const W = 620, H = 180, L = 46, max = Math.max(500, ...pts.map(Math.abs));
  const x = (i: number) => L + (i * (W - L - 12)) / 3;
  const y = (v: number) => H / 2 - (v / max) * (H / 2 - 18);
  const path = pts.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 420, height: 'auto', display: 'block' }} role="img" aria-label="Zeitabstand zur Referenzrunde nach Sektoren">
        <line x1={L} x2={W - 12} y1={y(0)} y2={y(0)} stroke="var(--line-2)" />
        {[-max, max].map((t) => <text key={t} x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="var(--dim)" fontFamily="JetBrains Mono Variable, monospace">{sec(t)}</text>)}
        {['Start', 'S1', 'S2', 'S3'].map((s, i) => <g key={s}><line x1={x(i)} x2={x(i)} y1="10" y2={H - 10} stroke="var(--line)" /><text x={x(i) + 4} y="20" fontSize="10.5" fill="var(--muted)">{s}</text></g>)}
        <path d={`${path} L${x(3)} ${y(0)} L${x(0)} ${y(0)}Z`} fill={pts[3] <= 0 ? 'var(--ok)' : 'var(--bad)'} opacity=".1" />
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.4" />
        {pts.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--accent)" />)}
      </svg>
      <div className="small muted">Abstand zur Bestzeit nach jedem Sektor · unter 0 = schneller · Endstand {sec(pts[3])} s</div>
    </div>
  );
}

function lapForm(app: AppCtx, track: string) {
  const d = app.data!;
  app.overlay(
    <FormModal
      title="Runde eintragen"
      fields={[
        { name: 'carId', label: 'Rennwagen', type: 'select', options: [['', '– ohne –'], ...d.raceCars.map((c) => [c.id, `#${c.number} ${c.car}`] as [string, string])] },
        { name: 'driver', label: 'Fahrer' }, { name: 'track', label: 'Strecke', required: true }, { name: 'session', label: 'Sitzung (Training, Quali …)' },
        { name: 's1', label: 'Sektor 1 (z. B. 41.120)', required: true }, { name: 's2', label: 'Sektor 2', required: true }, { name: 's3', label: 'Sektor 3', required: true },
      ]}
      initial={{ track, session: 'Training', carId: d.raceCars[0]?.id ?? '', driver: d.raceCars[0] ? memberName(d, d.raceCars[0].driverId) : '' }}
      submit={(v) => api.post(app.c('/laps'), { carId: v.carId || null, driver: v.driver, track: v.track, session: v.session || 'Training', s1: parseLap(String(v.s1)), s2: parseLap(String(v.s2)), s3: parseLap(String(v.s3)) })}
      onDone={() => app.toast('Runde gespeichert')}
    />,
  );
}

function setupForm(app: AppCtx, carId: string, track: string) {
  const d = app.data!;
  const s = d.setups.find((x) => x.carId === carId && x.track === track);
  const lines = s ? Object.entries(s.vals).map(([k, v]) => `${k}: ${v}`).join('\n') : 'Höhe v/h: \nFedern v/h: \nStabi v/h: \nBremsbalance: \nReifendruck: \nÜbersetzung: \nAbtrieb: \nSperre: ';
  app.overlay(
    <FormModal
      title={`Setup ${carLabel(d, carId)} · ${track}`}
      fields={[{ name: 'vals', label: 'Werte, eine Zeile je Einstellung („Name: Wert“)', type: 'textarea', required: true }, { name: 'note', label: 'Notiz (Fahrgefühl, was getestet wurde)', type: 'textarea' }]}
      initial={{ vals: lines, note: s?.note ?? '' }}
      submit={(v) => {
        const vals = Object.fromEntries(String(v.vals).split('\n').map((l) => l.split(':')).filter((p) => p.length >= 2 && p[0].trim() && p.slice(1).join(':').trim()).map((p) => [p[0].trim().slice(0, 30), p.slice(1).join(':').trim().slice(0, 40)]));
        return api.put(app.c('/setups'), { carId, track, vals, note: v.note });
      }}
      onDone={() => app.toast('Setup gespeichert')}
    />,
  );
}

export function TelemetriePage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('racing', 2);
  const tracks = [...new Set([...d.laps.map((l) => l.track), ...d.setups.map((s) => s.track), ...d.events.map((e) => e.track)].filter(Boolean))];
  const [track, setTrack] = useState(tracks[0] ?? '');
  const laps = d.laps.filter((l) => l.track === track).sort((a, b) => lapMs(a) - lapMs(b));
  const best = laps[0];
  const latest = [...laps].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [sel, setSel] = useState<string>('');
  const lap = laps.find((l) => l.id === sel) ?? latest.find((l) => l.id !== best?.id) ?? latest[0];
  const bestSector = (k: 's1' | 's2' | 's3') => Math.min(...laps.map((l) => l[k]));
  return (
    <>
      <PageHead eyebrow="Racing" title="Setups & Telemetrie" sub="Setup je Strecke und Wagen, Rundenvergleich nach Sektoren">
        {tracks.length > 0 && <select value={track} onChange={(e) => { setTrack(e.target.value); setSel(''); }} aria-label="Strecke">{tracks.map((t) => <option key={t}>{t}</option>)}</select>}
        {edit && <button className="btn pri" onClick={() => lapForm(app, track)}><Icon name="plus" size={15} /> Runde</button>}
      </PageHead>
      {!track ? <Card><Empty title="Noch keine Strecke">Runde eintragen oder im Rennkalender ein Event mit Strecke anlegen.</Empty></Card> : (
        <div className="g c12">
          <div className="s8">
            <Card title={lap ? `Rundenvergleich ${lap.driver || carLabel(d, lap.carId)} · ${lap.session}` : 'Rundenvergleich'} right={lap && best && <Pill tone={lapMs(lap) <= lapMs(best) ? 'ok' : 'warn'}>{lap.id === best.id ? 'Bestzeit' : sec(lapMs(lap) - lapMs(best))}</Pill>}>
              {lap && best ? <DeltaChart lap={lap} best={best} /> : <Empty title="Noch keine Runden auf dieser Strecke" />}
            </Card>
          </div>
          <div className="s4">
            <Card title="Sektoren" right={best && <span className="small muted">Referenz {formatLap(lapMs(best))}</span>}>
              {lap && best ? (
                <>
                  {(['s1', 's2', 's3'] as const).map((k) => { const dlt = lap[k] - best[k]; return <div key={k} className="li"><b className="mono" style={{ width: 30 }}>{k.toUpperCase()}</b><span className="mono grow">{formatLap(lap[k])}</span>{lap[k] === bestSector(k) ? <Pill tone="acc" dot={false}>beste</Pill> : <Pill tone={dlt <= 0 ? 'ok' : 'warn'} dot={false}>{sec(dlt)}</Pill>}</div>; })}
                  <div className="li"><b style={{ width: 30 }}>Σ</b><b className="mono grow">{formatLap(lapMs(lap))}</b>{lap.id === best.id && <Pill tone="acc">Bestzeit</Pill>}</div>
                  <div className="small muted" style={{ marginTop: 8 }}>Ideale Runde (beste Sektoren): <span className="mono">{formatLap(bestSector('s1') + bestSector('s2') + bestSector('s3'))}</span></div>
                </>
              ) : <p className="muted small" style={{ margin: 0 }}>–</p>}
            </Card>
          </div>
          <div className="s12">
            <Card title={`Runden ${track}`}>
              {latest.length ? (
                <Table head={['Wann', 'Fahrer', 'Wagen', 'Sitzung', ['S1', 'r'], ['S2', 'r'], ['S3', 'r'], ['Runde', 'r'], '']}>
                  {latest.map((l) => (
                    <tr key={l.id} style={{ cursor: 'pointer', background: l.id === lap?.id ? 'var(--panel-2)' : undefined }} onClick={() => setSel(l.id)}>
                      <td className="mono small">{formatDate(l.createdAt)}</td><td>{l.driver || '–'}</td><td className="small">{carLabel(d, l.carId)}</td><td className="small">{l.session}</td>
                      <td className="r mono">{formatLap(l.s1)}</td><td className="r mono">{formatLap(l.s2)}</td><td className="r mono">{formatLap(l.s3)}</td>
                      <td className="r mono"><b>{formatLap(lapMs(l))}</b></td>
                      <td className="r">{edit && <button className="ibtn" aria-label="Runde löschen" onClick={(e) => { e.stopPropagation(); void app.act(() => api.del(app.c(`/laps/${l.id}`)), 'Runde gelöscht'); }}><Icon name="x" size={13} /></button>}</td>
                    </tr>
                  ))}
                </Table>
              ) : <Empty title="Noch keine Runden" />}
            </Card>
          </div>
          {d.raceCars.map((c) => {
            const s = d.setups.find((x) => x.carId === c.id && x.track === track);
            return (
              <div key={c.id} className="s6">
                <Card title={`#${c.number} ${c.car} · ${track}`} right={edit && <button className="btn sm" onClick={() => setupForm(app, c.id, track)}>{s ? 'Ändern' : 'Setup anlegen'}</button>}>
                  {s ? (
                    <>
                      <div className="g g4" style={{ gap: 8 }}>{Object.entries(s.vals).map(([k, v]) => <div key={k} className="card flat" style={{ padding: 9 }}><span className="small muted" style={{ display: 'block' }}>{k}</span><b className="mono">{v}</b></div>)}</div>
                      {s.note && <p className="small" style={{ margin: '10px 0 0' }}>{s.note}</p>}
                      <div className="small dim" style={{ marginTop: 6 }}>geändert {formatDate(s.updatedAt)}</div>
                    </>
                  ) : <p className="muted small" style={{ margin: 0 }}>Kein Setup für diese Strecke.</p>}
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// --- Kunden-Trackdays -------------------------------------------------------
const TD_STATUS: Record<TrackdayBooking['status'], [string, string]> = { angefragt: ['angefragt', 'warn'], bestaetigt: ['bestätigt', 'ok'], abgesagt: ['abgesagt', 'bad'] };

function packagesForm(app: AppCtx) {
  const pk = app.data!.company.extra.trackdayPackages ?? [];
  app.overlay(
    <FormModal
      title="Trackday-Pakete"
      fields={[{ name: 'list', label: 'Ein Paket je Zeile: Name | Preis | Leistung; Leistung; …', type: 'textarea', required: true }]}
      initial={{ list: pk.map((p) => `${p.name} | ${p.priceCents / 100} | ${p.items.join('; ')}`).join('\n') || 'Bronze | 1800 | Fahrzeug-Check vor dem Event; Reifendruck und Betankung\nSilber | 3500 | Alles aus Bronze; Transport im Renntransporter; Boxencrew am Renntag\nGold | 6500 | Alles aus Silber; Setup auf dem Prüfstand; Rundenzeit-Analyse; Ersatzreifen-Satz' }}
      submit={(v) => {
        const list = String(v.list).split('\n').map((l) => l.split('|').map((x) => x.trim())).filter((p) => p[0]).map(([name, price, items]) => ({ name, priceCents: Math.round(Number((price ?? '0').replace(/\./g, '').replace(',', '.')) * 100) || 0, items: (items ?? '').split(';').map((x) => x.trim()).filter(Boolean) }));
        return api.patch(app.c('/extra'), { trackdayPackages: list });
      }}
      onDone={() => app.toast('Pakete gespeichert')}
    />,
  );
}

function bookingForm(app: AppCtx, b?: TrackdayBooking) {
  const d = app.data!;
  const pk = d.company.extra.trackdayPackages ?? [];
  app.overlay(
    <FormModal
      title={b ? 'Buchung ändern' : 'Trackday buchen'}
      fields={[
        { name: 'customerId', label: 'Kunde', type: 'select', options: customerOptions(d) },
        { name: 'vehicleId', label: 'Fahrzeug', type: 'select', options: vehicleOptions(d) },
        { name: 'eventId', label: 'Event', type: 'select', options: [['', '– noch offen –'], ...d.events.filter((e) => e.status !== 'abgesagt').map((e) => [e.id, `${e.name} · ${formatDate(e.startsAt.slice(0, 10))}`] as [string, string])] },
        { name: 'package', label: 'Paket', type: 'select', options: pk.map((p) => [p.name, `${p.name} · ${formatUsd(p.priceCents)}`]) },
        { name: 'transport', label: 'Transport im Renntransporter', type: 'checkbox' },
        { name: 'status', label: 'Status', type: 'select', options: Object.entries(TD_STATUS).map(([k, [l]]) => [k, l]) },
      ]}
      initial={b ?? { package: pk[0]?.name, status: 'angefragt', eventId: d.events.find((e) => e.kind === 'trackday' && e.startsAt > new Date().toISOString())?.id ?? '' }}
      submit={(v) => (b ? api.patch(app.c(`/trackdays/${b.id}`), v) : api.post(app.c('/trackdays'), v))}
      onDone={() => app.toast('Gespeichert')}
    />,
  );
}

export function TrackdaysPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('racing', 2);
  const pk = d.company.extra.trackdayPackages ?? [];
  const evName = (id: string | null) => { const e = d.events.find((x) => x.id === id); return e ? `${e.name} · ${formatDate(e.startsAt.slice(0, 10))}` : 'Termin offen'; };
  return (
    <>
      <PageHead eyebrow="Racing" title="Kunden-Trackdays" sub="Rennservice für Kunden: Vorbereitung, Transport, Boxencrew">
        {app.can('racing', 3) && <button className="btn" onClick={() => packagesForm(app)}>Pakete</button>}
        {edit && pk.length > 0 && <button className="btn pri" onClick={() => bookingForm(app)}><Icon name="plus" size={15} /> Buchung</button>}
      </PageHead>
      {pk.length ? (
        <div className="g g3" style={{ marginBottom: 14 }}>
          {pk.map((p) => (
            <Card key={p.name}>
              <div className="row"><b style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Trackday {p.name}</b><span className="money" style={{ marginLeft: 'auto', fontSize: 17 }}>{formatUsd(p.priceCents)}</span></div>
              {p.items.map((i) => <div key={i} className="chk y plain"><i><Icon name="check" size={12} /></i><span>{i}</span></div>)}
            </Card>
          ))}
        </div>
      ) : <Card style={{ marginBottom: 14 }}><Empty title="Noch keine Pakete">{app.can('racing', 3) ? 'Unter „Pakete“ Bronze, Silber, Gold oder eigene Pakete festlegen.' : 'Die Leitung legt die Pakete fest.'}</Empty></Card>}
      <Card title="Buchungen">
        {d.trackdays.length ? (
          <Table head={['Kunde', 'Fahrzeug', 'Paket', 'Event', 'Transport', ['Preis', 'r'], 'Status', '']}>
            {d.trackdays.map((b) => (
              <tr key={b.id}>
                <td>{customerName(d, b.customerId)}</td>
                <td>{b.vehicleId ? <span className="plate">{plateOf(d, b.vehicleId)}</span> : '–'}</td>
                <td><span className={`lvl ${b.package === 'Gold' ? 'a' : ''}`}>{b.package}</span></td>
                <td className="small">{evName(b.eventId)}</td>
                <td>{b.transport ? 'ja' : 'nein'}</td>
                <td className="r money">{formatUsd(b.priceCents)}</td>
                <td><Pill tone={TD_STATUS[b.status][1]}>{TD_STATUS[b.status][0]}</Pill>{b.billId && <Pill tone="info" dot={false}>Rechnung</Pill>}</td>
                <td className="r" style={{ whiteSpace: 'nowrap' }}>
                  {edit && !b.billId && b.status !== 'abgesagt' && app.can('rechnungen', 2) && <button className="btn sm pri" onClick={() => app.act(() => api.post(app.c(`/trackdays/${b.id}/bill`)), 'Rechnung gestellt')}>Rechnung</button>}{' '}
                  {edit && <button className="btn sm ghost" onClick={() => bookingForm(app, b)}>Ändern</button>}
                  {app.can('racing', 3) && <button className="ibtn" aria-label="Buchung löschen" onClick={() => app.overlay(<Confirm title="Buchung löschen?" text="Eine gestellte Rechnung bleibt bestehen." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/trackdays/${b.id}`)), 'Gelöscht')} />)}><Icon name="x" size={13} /></button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="Noch keine Buchungen" />}
      </Card>
    </>
  );
}
