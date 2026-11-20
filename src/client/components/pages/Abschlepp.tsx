// Abschleppdienst ab 0.4: Einsätze als Liste mit Kennzahlen, Fuhrpark mit Ausgabe, Rückgabe, Tanken, Schaden und Fahrtenbuch.
import { useState } from 'react';
import { calloutLabel, formatDate, formatDateTime, formatUsd } from '../../../shared/format';
import type { FleetCar, FleetLog } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Drawer, Empty, FormModal, Kpi, PageHead, Pill, Table } from '../ui';
import { memberName, memberOptions, sum } from './helpers';

const CALL_TONE: Record<string, string> = { offen: 'bad', unterwegs: 'warn', vorort: 'info', erledigt: 'ok' };
const CALL_LABEL: Record<string, string> = { offen: 'Offen', unterwegs: 'Unterwegs', vorort: 'Vor Ort', erledigt: 'Erledigt' };

export function EinsaetzePage() {
  const app = useApp();
  const d = app.data!;
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [st, setSt] = useState('alle');
  const months = [...new Set([new Date().toISOString().slice(0, 7), ...d.callouts.map((c) => c.createdAt.slice(0, 7))])].sort().reverse();
  const inMonth = d.callouts.filter((c) => c.createdAt.startsWith(month));
  const list = inMonth.filter((c) => st === 'alle' || c.status === st);
  const done = inMonth.filter((c) => c.doneAt);
  const avgMin = done.length ? Math.round(sum(done.map((c) => (Date.parse(c.doneAt!) - Date.parse(c.createdAt)) / 60000)) / done.length) : 0;
  const revenue = sum(d.bills.filter((b) => b.calloutId && b.status === 'bezahlt' && (b.paidAt ?? '').startsWith(month)).map((b) => b.amountCents));
  const fees = sum(inMonth.map((c) => c.feeCents));
  return (
    <>
      <PageHead eyebrow="Abschleppdienst" title="Einsätze" sub={`${new Date(`${month}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}: ${inMonth.length} Einsätze · ${formatUsd(fees)} Gebühren`}>
        <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Monat">{months.map((m) => <option key={m} value={m}>{new Date(`${m}-01`).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</option>)}</select>
        {app.special('export') && !d.rights.areas.leitstelle.own && <a className="btn" href={`/api${app.c('/export/einsaetze')}`}><Icon name="file" size={15} /> Export</a>}
      </PageHead>
      <div className="g g4 k2" style={{ marginBottom: 14 }}>
        <Kpi label="Einsätze" value={inMonth.length} detail={`${inMonth.filter((c) => c.status !== 'erledigt').length} noch offen`} />
        <Kpi label="Ø Dauer" value={avgMin ? `${avgMin} min` : '–'} detail="angelegt bis erledigt" />
        <Kpi label="Bezahlt" value={formatUsd(revenue)} detail="Rechnungen zu Einsätzen" />
        <Kpi label="Ohne Fahrer" value={inMonth.filter((c) => !c.driverId && c.status !== 'erledigt').length} detail="in der Leitstelle zuteilen" />
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>{['alle', 'offen', 'unterwegs', 'vorort', 'erledigt'].map((k) => <button key={k} className={`chip ${st === k ? 'on' : ''}`} onClick={() => setSt(k)}>{k === 'alle' ? 'Alle' : CALL_LABEL[k]}</button>)}</div>
      <Card>
        {list.length ? (
          <Table head={['Nr.', 'Ort', 'Auftraggeber', 'Fahrer', 'Fahrzeug', ['Gebühr', 'r'], 'Status']}>
            {list.map((c) => (
              <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => app.go('leitstelle', c.id)}>
                <td className="mono">{calloutLabel(c.number)}<div className="small muted">{formatDateTime(c.createdAt)}</div></td>
                <td>{c.location}</td>
                <td>{c.requester || '–'}</td>
                <td>{memberName(d, c.driverId) || '–'}</td>
                <td className="muted">{c.vehicle || '–'}{c.truck ? ` · ${c.truck}` : ''}</td>
                <td className="r money">{formatUsd(c.feeCents)}</td>
                <td><Pill tone={CALL_TONE[c.status]}>{CALL_LABEL[c.status]}</Pill></td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="Keine Einsätze in dieser Ansicht" />}
      </Card>
    </>
  );
}

// --- Fuhrpark ---------------------------------------------------------------
const FLEET_LABEL: Record<FleetCar['status'], [string, string]> = { frei: ['Frei', 'ok'], einsatz: ['Im Einsatz', 'warn'], werkstatt: ['Werkstatt', 'bad'] };
const LOG_LABEL: Record<FleetLog['action'], string> = { ausgabe: 'Ausgegeben', rueckgabe: 'Zurück', tanken: 'Getankt', schaden: 'Schaden', service: 'Wieder bereit' };
const fleetFields = [
  { name: 'name', label: 'Name (z. B. Abschlepper 1)', required: true },
  { name: 'model', label: 'Modell' },
  { name: 'plate', label: 'Kennzeichen' },
  { name: 'km', label: 'km-Stand', type: 'number' as const },
  { name: 'fuel', label: 'Tank in %', type: 'number' as const },
  { name: 'serviceDue', label: 'Nächster Service', type: 'date' as const },
  { name: 'note', label: 'Notiz', type: 'textarea' as const },
];

function FleetLogDrawer({ f }: { f: FleetCar }) {
  const app = useApp();
  const d = app.data!;
  const log = d.fleetLog.filter((x) => x.fleetId === f.id);
  return (
    <Drawer title={f.name} sub={`Fahrtenbuch · ${f.plate || f.model}`} onClose={() => app.overlay(null)}>
      {log.length ? (
        <div className="tl">
          {log.map((x) => (
            <div key={x.id}>
              <b>{LOG_LABEL[x.action]}</b> · {memberName(d, x.userId) || 'System'}
              {x.km !== null && ` · ${x.km.toLocaleString('de-DE')} km`}{x.fuel !== null && ` · Tank ${x.fuel} %`}{x.costCents ? ` · ${formatUsd(x.costCents)}` : ''}
              {x.note && <div className="small">{x.note}</div>}
              <span>{formatDateTime(x.createdAt)}</span>
            </div>
          ))}
        </div>
      ) : <Empty title="Noch keine Einträge" />}
    </Drawer>
  );
}

function fleetAction(app: AppCtx, f: FleetCar, action: 'issue' | 'return' | 'fuel' | 'damage' | 'service') {
  const go = (title: string, fields: Parameters<typeof FormModal>[0]['fields'], initial: object, label: string, msg: string) =>
    app.overlay(<FormModal title={title} fields={fields} initial={initial} submit={(v) => api.post(app.c(`/fleet/${f.id}/${action}`), v)} onDone={() => app.toast(msg)} submitLabel={label} />);
  if (action === 'issue') go(`${f.name} ausgeben`, [{ name: 'userId', label: 'Fahrer', type: 'select', options: memberOptions(app.data).filter(([v]) => v) }], { userId: app.me.user.id }, 'Ausgeben', `${f.name} ausgegeben`);
  if (action === 'return') go(`${f.name} zurück`, [{ name: 'km', label: 'km-Stand', type: 'number' }, { name: 'fuel', label: 'Tank in %', type: 'number' }, { name: 'note', label: 'Bemerkung' }], { km: f.km, fuel: f.fuel }, 'Zurücknehmen', `${f.name} zurück`);
  if (action === 'fuel') {
    const canBook = app.can('buchungen', 2) && app.special('auszahlung');
    go(`${f.name} tanken`, [
      { name: 'costCents', label: 'Kosten', type: 'usd' }, { name: 'fuel', label: 'Tank danach in %', type: 'number' }, { name: 'km', label: 'km-Stand', type: 'number' },
      ...(canBook ? [{ name: 'book', label: 'Als Ausgabe buchen (Firmenkonto)', type: 'checkbox' as const }] : []),
    ], { fuel: 100, km: f.km, book: canBook }, 'Speichern', 'Tankquittung erfasst');
  }
  if (action === 'damage') go(`Schaden an ${f.name}`, [{ name: 'note', label: 'Was ist kaputt?', type: 'textarea', required: true }], {}, 'Melden', 'Schaden gemeldet');
  if (action === 'service') go(`${f.name} wieder bereit`, [{ name: 'serviceDue', label: 'Nächster Service', type: 'date' }], { serviceDue: f.serviceDue }, 'Bereit', `${f.name} ist wieder frei`);
}

export function FuhrparkPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('fuhrpark', 2);
  const today = new Date().toISOString().slice(0, 10);
  const days = (iso: string | null) => (iso ? Math.round((Date.parse(iso) - Date.parse(today)) / 86_400_000) : null);
  return (
    <>
      <PageHead eyebrow="Abschleppdienst" title="Fuhrpark" sub={`${d.fleet.length} Fahrzeuge · ${d.fleet.filter((f) => f.status === 'einsatz').length} im Einsatz · ${d.fleet.filter((f) => f.status === 'werkstatt').length} in der Werkstatt`}>
        {edit && <button className="btn pri" onClick={() => app.overlay(<FormModal title="Neues Fahrzeug" fields={fleetFields} initial={{ fuel: 100 }} submit={(v) => api.post(app.c('/fleet'), v)} onDone={() => app.toast('Fahrzeug angelegt')} />)}><Icon name="plus" size={15} /> Fahrzeug</button>}
      </PageHead>
      {d.fleet.length ? (
        <div className="g g3">
          {d.fleet.map((f) => {
            const [label, tone] = FLEET_LABEL[f.status];
            const due = days(f.serviceDue);
            return (
              <Card key={f.id}>
                <div className="row"><div className={`ib ${tone}`}><Icon name="truck" /></div><div className="grow"><b>{f.name}</b><div className="muted small">{f.model}</div></div><Pill tone={tone}>{label}</Pill></div>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>Kennzeichen</dt><dd>{f.plate ? <span className="plate">{f.plate}</span> : '–'}</dd>
                  <dt>km-Stand</dt><dd className="mono">{f.km.toLocaleString('de-DE')}</dd>
                  <dt>Service</dt><dd>{f.status === 'werkstatt' ? <span className="neg">{f.note || 'in Reparatur'}</span> : due === null ? '–' : due < 0 ? <span className="neg">überfällig seit {formatDate(f.serviceDue)}</span> : `in ${due} Tagen`}</dd>
                  <dt>Fahrer</dt><dd>{memberName(d, f.driverId) || '–'}</dd>
                </dl>
                <div style={{ marginTop: 12 }}>
                  <div className="row small muted" style={{ justifyContent: 'space-between' }}><span className="row" style={{ gap: 6 }}><Icon name="fuel" size={14} />Tank</span><span className="mono">{f.fuel} %</span></div>
                  <div className={`bar ${f.fuel > 50 ? 'ok' : ''}`}><i style={{ width: `${f.fuel}%` }} /></div>
                </div>
                <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
                  {edit && f.status === 'frei' && <button className="btn sm pri" onClick={() => fleetAction(app, f, 'issue')}>Ausgeben</button>}
                  {edit && f.status === 'einsatz' && <button className="btn sm" onClick={() => fleetAction(app, f, 'return')}>Zurücknehmen</button>}
                  {edit && f.status === 'werkstatt' && <button className="btn sm" onClick={() => fleetAction(app, f, 'service')}>Wieder bereit</button>}
                  {edit && <button className="btn sm ghost" onClick={() => fleetAction(app, f, 'fuel')}>Tanken</button>}
                  {edit && f.status !== 'werkstatt' && <button className="btn sm ghost" onClick={() => fleetAction(app, f, 'damage')}>Schaden</button>}
                  <button className="btn sm ghost" onClick={() => app.overlay(<FleetLogDrawer f={f} />)}>Fahrtenbuch</button>
                  {edit && <button className="btn sm ghost" onClick={() => app.overlay(<FormModal title={f.name} fields={fleetFields} initial={f} submit={(v) => api.patch(app.c(`/fleet/${f.id}`), v)} onDone={() => app.toast('Gespeichert')} />)}>Bearbeiten</button>}
                  {app.can('fuhrpark', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`${f.name} löschen?`} text="Mit Fahrtenbuch." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/fleet/${f.id}`)), 'Gelöscht')} />)}>Löschen</button>}
                </div>
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title="Noch keine Fahrzeuge">{edit ? 'Mit „+ Fahrzeug“ Abschlepper und Servicewagen anlegen.' : null}</Empty></Card>}
    </>
  );
}

