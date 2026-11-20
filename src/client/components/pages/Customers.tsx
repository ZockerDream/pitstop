// Kundenakten und Fahrzeuge.
import { useEffect, useState } from 'react';
import { billLabel, customerLabel, formatDate, formatUsd, orderLabel } from '../../../shared/format';
import type { Customer, Vehicle } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Drawer, Empty, FormModal, PageHead, Pill, Table, type FieldDef } from '../ui';
import { customerName, customerOptions, sum } from './helpers';

const KINDS: [string, string][] = [['privat', 'Privat'], ['firma', 'Firma'], ['fraktion', 'Fraktion'], ['racing', 'Racing']];
const kindLabel = (k: string) => KINDS.find((x) => x[0] === k)?.[1] ?? k;
const customerFields: FieldDef[] = [
  { name: 'name', label: 'Name', required: true },
  { name: 'kind', label: 'Art', type: 'select', options: KINDS },
  { name: 'phone', label: 'Telefon' },
  { name: 'discount', label: 'Rabatt in %', type: 'number' },
  { name: 'note', label: 'Notiz', type: 'textarea' },
];
const vehicleFields = (d: Parameters<typeof customerOptions>[0]): FieldDef[] => [
  { name: 'plate', label: 'Kennzeichen', required: true },
  { name: 'model', label: 'Modell' },
  { name: 'customerId', label: 'Halter', type: 'select', options: customerOptions(d) },
  { name: 'note', label: 'Notiz (Umbauten, Besonderheiten)', type: 'textarea' },
];

export function openNewCustomer(app: ReturnType<typeof useApp>) {
  app.overlay(<FormModal title="Kunde anlegen" fields={customerFields} initial={{ kind: 'privat', discount: 0 }} submit={(v) => api.post(app.c('/customers'), v)} onDone={() => app.toast('Kunde angelegt')} submitLabel="Anlegen" />);
}

export function CustomerDrawer({ c }: { c: Customer }) {
  const app = useApp();
  const d = app.data!;
  const vehicles = d.vehicles.filter((v) => v.customerId === c.id);
  const orders = d.orders.filter((o) => o.customerId === c.id);
  const bills = d.bills.filter((b) => b.customerId === c.id);
  const open = sum(bills.filter((b) => b.status === 'offen').map((b) => b.amountCents));
  const reopen = (x: Customer | undefined) => x && app.overlay(<CustomerDrawer c={x} />);
  return (
    <Drawer
      title={c.name}
      sub={`${customerLabel(c.number)} · ${kindLabel(c.kind)} · seit ${formatDate(c.createdAt)}`}
      onClose={() => app.overlay(null)}
      foot={
        <>
          {app.can('kunden', 2) && <button className="btn" onClick={() => app.overlay(<FormModal title="Kunde bearbeiten" fields={customerFields} initial={c} submit={(v) => api.patch(app.c(`/customers/${c.id}`), v)} onDone={() => app.toast('Gespeichert')} />)}>Bearbeiten</button>}
          {app.can('fahrzeuge', 2) && <button className="btn" onClick={() => app.overlay(<FormModal title="Fahrzeug anlegen" fields={vehicleFields(d)} initial={{ customerId: c.id }} submit={(v) => api.post(app.c('/vehicles'), v)} onDone={() => app.toast('Fahrzeug angelegt')} submitLabel="Anlegen" />)}>Fahrzeug</button>}
          {app.special('kundensperre') && <button className="btn" onClick={() => app.act(() => api.patch<Customer>(app.c(`/customers/${c.id}`), { blocked: !c.blocked }), c.blocked ? 'Entsperrt' : 'Gesperrt').then(reopen)}>{c.blocked ? 'Entsperren' : 'Sperren'}</button>}
          {app.special('kundenloeschen') && (
            <button className="btn ghost" onClick={() => app.overlay(<Confirm title="Kunde löschen?" text={`${c.name} wird endgültig gelöscht. Fahrzeuge, Aufträge und Rechnungen bleiben ohne Kunde erhalten.`} okLabel="Endgültig löschen" onOk={() => app.act(() => api.del(app.c(`/customers/${c.id}`)), 'Kunde gelöscht')} />)}>Löschen</button>
          )}
        </>
      }
    >
      {c.blocked && <div className="alert"><Icon name="alert" /><div><b>Gesperrt.</b> Keine neuen Aufträge annehmen.</div></div>}
      {d.contracts.filter((k) => k.customerId === c.id && k.status !== 'beendet').map((k) => <div key={k.id} className="alert info"><Icon name="doc" /><div><b>Rahmenvertrag{k.title ? ` ${k.title}` : ''}:</b> {k.workshopPct} % Werkstatt · {k.tuningPct} % Tuning{k.rules ? ` · ${k.rules}` : ''}{k.validUntil ? ` · bis ${formatDate(k.validUntil)}` : ''}</div></div>)}
      {app.can('nachrichten') && <a className="btn sm" style={{ alignSelf: 'flex-start' }} href={`#nachrichten/${c.id}`}><Icon name="chat" size={14} /> Nachrichten ({d.messages.filter((m) => m.customerId === c.id).length})</a>}
      <dl className="kv">
        <dt>Telefon</dt><dd>{c.phone || '–'}</dd>
        <dt>Rabatt</dt><dd>{c.discount ? `${c.discount} %` : '–'}</dd>
        {app.can('rechnungen') && (<><dt>Offen</dt><dd className="money">{formatUsd(open)}</dd></>)}
        <dt>Notiz</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{c.note || '–'}</dd>
      </dl>
      <div>
        <div className="st">Fahrzeuge ({vehicles.length})</div>
        {vehicles.map((v) => <div className="li" key={v.id} data-o onClick={() => app.overlay(<VehicleDrawer v={v} />)}><span className="plate">{v.plate}</span><div className="tx"><b>{v.model || '–'}</b><span>{v.note}</span></div>{v.stolen && <Pill tone="bad">gestohlen</Pill>}</div>)}
        {!vehicles.length && <p className="muted small">Keine Fahrzeuge.</p>}
      </div>
      {app.can('auftraege') && (
        <div>
          <div className="st">Aufträge ({orders.length})</div>
          {orders.slice(0, 8).map((o) => <div className="li" key={o.id}><div className="tx"><b>{orderLabel(o.number)} {o.title}</b><span>{o.status}</span></div><span className="money">{formatUsd(o.amountCents)}</span></div>)}
        </div>
      )}
      {app.can('rechnungen') && (
        <div>
          <div className="st">Rechnungen ({bills.length})</div>
          {bills.slice(0, 8).map((b) => <div className="li" key={b.id}><div className="tx"><b>{billLabel(b.number)} {b.title}</b><span>{formatDate(b.createdAt)}</span></div><Pill tone={b.status === 'bezahlt' ? 'ok' : b.status === 'offen' ? 'warn' : ''}>{b.status}</Pill><span className="money">{formatUsd(b.amountCents)}</span></div>)}
        </div>
      )}
    </Drawer>
  );
}

export function CustomersPage() {
  const app = useApp();
  const d = app.data!;
  const [q, setQ] = useState('');
  const [kind, setKind] = useState('alle');
  const s = q.trim().toLowerCase();
  // Aufruf mit #kunden/<id> (z. B. aus Nachrichten) öffnet die Akte
  const target = app.param;
  useEffect(() => {
    const c = target ? app.data?.customers.find((x) => x.id === target) : undefined;
    if (c) app.overlay(<CustomerDrawer c={c} />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const owes = (id: string) => d.bills.some((b) => b.customerId === id && b.status === 'offen' && b.kind === 'rechnung');
  const list = d.customers.filter((c) => (kind === 'alle' || c.kind === kind || (kind === 'offen' && owes(c.id))) && (!s || `${c.name} ${c.phone} ${d.vehicles.filter((v) => v.customerId === c.id).map((v) => v.plate).join(' ')}`.toLowerCase().includes(s)));
  return (
    <>
      <PageHead eyebrow="Kunden" title="Kundenakten" sub={`${d.customers.length} Kunden · ${d.customers.filter((c) => c.blocked).length} gesperrt`}>
        {app.can('kunden', 2) && <button className="btn pri" onClick={() => openNewCustomer(app)}><Icon name="plus" size={15} /> Kunde</button>}
      </PageHead>
      <div className="row wrap" style={{ marginBottom: 12, gap: 8 }}>
        <div className="field" style={{ minWidth: 240 }}><input aria-label="Suchen" placeholder="Name, Telefon oder Kennzeichen …" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="chips">{[['alle', 'Alle'], ...KINDS, ...(app.can('rechnungen') ? [['offen', 'Offene Posten']] : [])].map(([k, l]) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}</div>
      </div>
      <Card>
        {list.length ? (
          <Table head={['Kunde', 'Art', 'Telefon', 'Fahrzeuge', ['Offen', 'r']]}>
            {list.map((c) => {
              const vs = d.vehicles.filter((v) => v.customerId === c.id);
              return (
                <tr key={c.id} data-o onClick={() => app.overlay(<CustomerDrawer c={c} />)}>
                  <td><b>{c.name}</b> {c.blocked && <Pill tone="bad">gesperrt</Pill>}<div className="small muted">{customerLabel(c.number)}</div></td>
                  <td><Pill dot={false}>{kindLabel(c.kind)}</Pill></td>
                  <td className="mono small">{c.phone || '–'}</td>
                  <td>{vs.slice(0, 3).map((v) => <span key={v.id} className="plate" style={{ marginRight: 4 }}>{v.plate}</span>)}{vs.length > 3 && <span className="small muted">+{vs.length - 3}</span>}</td>
                  <td className="r money">{app.can('rechnungen') ? formatUsd(sum(d.bills.filter((b) => b.customerId === c.id && b.status === 'offen').map((b) => b.amountCents))) : ''}</td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty title={d.customers.length ? 'Nichts gefunden' : 'Noch keine Kunden'}>{!d.customers.length && app.can('kunden', 2) && <button className="btn pri" style={{ marginTop: 10 }} onClick={() => openNewCustomer(app)}>Ersten Kunden anlegen</button>}</Empty>
        )}
      </Card>
    </>
  );
}

export function VehicleDrawer({ v }: { v: Vehicle }) {
  const app = useApp();
  const d = app.data!;
  const orders = d.orders.filter((o) => o.vehicleId === v.id);
  const tuning = orders.filter((o) => o.kind === 'tuning');
  const dyno = d.dyno.filter((x) => x.vehicleId === v.id);
  const intake = orders.find((o) => o.intake?.km !== undefined || o.intake?.damage?.length);
  return (
    <Drawer title={v.plate} sub={`${v.model || 'Modell unbekannt'} · Halter ${customerName(d, v.customerId)}`} onClose={() => app.overlay(null)}
      foot={<>
        {app.can('fahrzeuge', 2) && <button className="btn" onClick={() => app.overlay(<FormModal title={`${v.plate} bearbeiten`} fields={vehicleFields(d)} initial={v} submit={(x) => api.patch(app.c(`/vehicles/${v.id}`), x)} onDone={() => app.toast('Gespeichert')} />)}>Bearbeiten</button>}
        {app.can('fahrzeuge', 2) && <button className="btn ghost" onClick={() => app.act(() => api.post(app.c(`/vehicles/${v.id}/stolen`), { stolen: !v.stolen }), v.stolen ? 'Meldung aufgehoben' : 'Als gestohlen gemeldet').then(() => app.overlay(null))}>{v.stolen ? 'Nicht mehr gestohlen' : 'Als gestohlen melden'}</button>}
        {app.can('auftraege', 2) && <a className="btn pri" href="#annahme">Annehmen</a>}
      </>}>
      {v.stolen && <div className="alert"><Icon name="alert" /><div><b>Als gestohlen gemeldet.</b> Bei der Annahme warnt Pitstop.</div></div>}
      <dl className="kv">
        <dt>Halter</dt><dd>{customerName(d, v.customerId)}</dd>
        {intake?.intake.km !== undefined && <><dt>km-Stand</dt><dd className="mono">{intake.intake.km.toLocaleString('de-DE')} <span className="small muted">bei {orderLabel(intake.number)}</span></dd></>}
        {intake?.intake.damage?.length ? <><dt>Vorschäden</dt><dd>{intake.intake.damage.join(', ')}</dd></> : null}
        <dt>Notiz</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{v.note || '–'}</dd>
      </dl>
      {app.can('tuning') && (
        <div>
          <div className="st">Tuningstand ({tuning.length})</div>
          {tuning.map((o) => <div className="li" key={o.id}><div className="tx"><b>{orderLabel(o.number)} {o.title}</b><span style={{ whiteSpace: 'pre-wrap' }}>{o.note.split('\n').slice(1, 4).join(' · ')}</span></div><span className="money">{formatUsd(o.amountCents)}</span></div>)}
          {!tuning.length && <p className="muted small">Kein Tuning bei uns.</p>}
          {dyno.length > 0 && <><div className="st" style={{ marginTop: 10 }}>Prüfstand</div>{dyno.map((x) => <div className="li" key={x.id}><div className="tx"><b>{x.hp} PS · {x.torque} Nm</b><span>{x.label} · {formatDate(x.createdAt)}</span></div></div>)}</>}
        </div>
      )}
      {app.can('auftraege') && (
        <div>
          <div className="st">Werkstatt-Verlauf ({orders.length})</div>
          {orders.slice(0, 10).map((o) => <div className="li" key={o.id}><div className="tx"><b>{orderLabel(o.number)} {o.title}</b><span>{formatDate(o.createdAt)} · {o.status}{o.intake?.damage?.length ? ` · Schäden: ${o.intake.damage.join(', ')}` : ''}</span></div><span className="money">{formatUsd(o.amountCents)}</span></div>)}
          {!orders.length && <p className="muted small">Noch nicht bei uns gewesen.</p>}
        </div>
      )}
    </Drawer>
  );
}

export function VehiclesPage() {
  const app = useApp();
  const d = app.data!;
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase().replace(/\s/g, '');
  const list = d.vehicles.filter((v) => !s || `${v.plate}${v.model}${customerName(d, v.customerId)}`.toLowerCase().replace(/\s/g, '').includes(s));
  const edit = (v?: Vehicle) =>
    app.overlay(<FormModal title={v ? `${v.plate} bearbeiten` : 'Fahrzeug anlegen'} fields={vehicleFields(d)} initial={v ?? {}} submit={(x) => (v ? api.patch(app.c(`/vehicles/${v.id}`), x) : api.post(app.c('/vehicles'), x))} onDone={() => app.toast('Gespeichert')} submitLabel={v ? 'Speichern' : 'Anlegen'} />);
  return (
    <>
      <PageHead eyebrow="Kunden" title="Fahrzeugakten" sub={`${d.vehicles.length} Fahrzeuge in der Kartei · ${d.vehicles.filter((v) => v.stolen).length} gestohlen gemeldet`}>
        {app.can('fahrzeuge', 2) && <button className="btn pri" onClick={() => edit()}><Icon name="plus" size={15} /> Fahrzeug</button>}
      </PageHead>
      <div className="field" style={{ maxWidth: 320, marginBottom: 12 }}><input aria-label="Kennzeichen suchen" placeholder="Kennzeichen, Modell oder Halter …" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <Card>
        {list.length ? (
          <Table head={['Kennzeichen', 'Modell', 'Halter', 'Notiz', '']}>
            {list.map((v) => (
              <tr key={v.id} data-o onClick={() => app.overlay(<VehicleDrawer v={v} />)}>
                <td><span className="plate">{v.plate}</span> {v.stolen && <Pill tone="bad">gestohlen</Pill>}</td>
                <td>{v.model || '–'}</td>
                <td>{customerName(d, v.customerId)}</td>
                <td className="small muted">{v.note}</td>
                <td className="r">{app.can('fahrzeuge', 2) && <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); edit(v); }}>Bearbeiten</button>}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title={d.vehicles.length ? 'Nichts gefunden' : 'Noch keine Fahrzeuge'} />
        )}
      </Card>
    </>
  );
}
