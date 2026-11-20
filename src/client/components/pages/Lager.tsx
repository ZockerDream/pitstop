// Lager: Teile mit Bestand, Mindestbestand und Lagerort; Zugang (optional als Ausgabe gebucht) und Entnahme.
import { useState } from 'react';
import { formatDate, formatUsd } from '../../../shared/format';
import type { Part } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Empty, FormModal, Kpi, PageHead, Pill, Table } from '../ui';
import { sum } from './helpers';

export const lowParts = (parts: Part[]) => parts.filter((p) => p.qty <= p.minQty);

const partFields = [
  { name: 'name', label: 'Teil', required: true },
  { name: 'sku', label: 'Artikelnummer' },
  { name: 'unit', label: 'Einheit', placeholder: 'Stk, l, Satz …' },
  { name: 'qty', label: 'Bestand', type: 'number' as const },
  { name: 'minQty', label: 'Mindestbestand', type: 'number' as const },
  { name: 'priceCents', label: 'Einkaufspreis je Einheit', type: 'usd' as const },
  { name: 'location', label: 'Lagerort' },
  { name: 'note', label: 'Notiz', type: 'textarea' as const },
];

export function openMove(app: AppCtx, p: Part, inbound: boolean) {
  const canBook = inbound && app.can('buchungen', 2) && app.special('auszahlung') && p.priceCents > 0;
  app.overlay(
    <FormModal
      title={`${p.name}: ${inbound ? 'Zugang' : 'Entnahme'}`}
      fields={[
        { name: 'n', label: `Menge (${p.unit})`, type: 'number', required: true },
        { name: 'note', label: inbound ? 'Lieferant / Notiz' : 'Wofür (z. B. W-1042)' },
        ...(canBook ? [{ name: 'book', label: `Als Ausgabe buchen (${formatUsd(p.priceCents)} je ${p.unit}, Firmenkonto)`, type: 'checkbox' as const }] : []),
      ]}
      initial={{ n: 1, book: canBook }}
      submit={(v) => api.post(app.c(`/parts/${p.id}/move`), { delta: (inbound ? 1 : -1) * Math.abs(Number(v.n ?? 0)), note: v.note, book: !!v.book })}
      onDone={() => app.toast(inbound ? 'Zugang gebucht' : 'Entnahme gebucht')}
      submitLabel={inbound ? 'Einbuchen' : 'Entnehmen'}
    />,
  );
}

function orderPart(app: AppCtx, p: Part) {
  app.overlay(
    <FormModal title={`${p.name} bestellen`} fields={[{ name: 'qty', label: `Menge (${p.unit})`, type: 'number', required: true }, { name: 'supplier', label: 'Lieferant' }, { name: 'costCents', label: 'Kosten gesamt (leer = Menge × Preis)', type: 'usd' }, { name: 'expected', label: 'Lieferung erwartet', type: 'date' }]}
      initial={{ qty: Math.max(1, p.minQty * 2 - p.qty) }} submit={(v) => api.post(app.c(`/parts/${p.id}/orders`), { ...v, qty: Math.abs(Math.round(Number(v.qty))), costCents: Number(v.costCents) || undefined })} onDone={() => app.toast('Bestellt')} submitLabel="Bestellen" />,
  );
}

function deliver(app: AppCtx, id: string, name: string, cost: number) {
  const canBook = app.can('buchungen', 2) && app.special('auszahlung') && cost > 0;
  app.overlay(
    <FormModal title={`Wareneingang: ${name}`} fields={canBook ? [{ name: 'book', label: `Als Ausgabe buchen (${formatUsd(cost)}, Firmenkonto)`, type: 'checkbox' }] : []} initial={{ book: canBook }}
      submit={(v) => api.post(app.c(`/part-orders/${id}/deliver`), { book: !!v.book })} onDone={() => app.toast('Wareneingang gebucht')} submitLabel="Eingang buchen" />,
  );
}

export function LagerPage() {
  const app = useApp();
  const d = app.data!;
  const [q, setQ] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const edit = app.can('lager', 2);
  const low = lowParts(d.parts);
  const list = d.parts.filter((p) => (!onlyLow || p.qty <= p.minQty) && `${p.name} ${p.sku} ${p.location}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <PageHead eyebrow="Werkstatt" title="Lager & Bestellungen" sub={`${d.parts.length} Teile · ${low.length} unter Mindestbestand · ${d.partOrders.filter((o) => o.status === 'bestellt').length} Bestellungen offen`}>
        {edit && (
          <button className="btn pri" onClick={() => app.overlay(<FormModal title="Neues Teil" fields={partFields} initial={{ unit: 'Stk' }} submit={(v) => api.post(app.c('/parts'), v)} onDone={() => app.toast('Teil angelegt')} />)}>
            <Icon name="plus" size={15} /> Teil
          </button>
        )}
      </PageHead>
      <div className="g c12" style={{ marginBottom: 14 }}>
        <div className="s4"><Kpi label="Lagerwert" value={formatUsd(sum(d.parts.map((p) => p.qty * p.priceCents)))} detail="Bestand × Einkaufspreis" /></div>
        <div className="s4"><Kpi label="Nachbestellen" value={low.length} detail={low.slice(0, 3).map((p) => p.name).join(', ') || 'alles da'} /></div>
        <div className="s4"><Kpi label="Leer" value={d.parts.filter((p) => p.qty === 0).length} detail="Teile ohne Bestand" /></div>
      </div>
      <Card>
        <div className="row wrap" style={{ marginBottom: 10, gap: 8 }}>
          <input className="grow" placeholder="Suchen: Teil, Nummer, Lagerort" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Lager durchsuchen" style={{ minWidth: 200 }} />
          <button className={`chip ${onlyLow ? 'on' : ''}`} onClick={() => setOnlyLow(!onlyLow)}>Nur nachbestellen</button>
        </div>
        {list.length ? (
          <Table head={['Teil', 'Lagerort', ['Bestand', 'r'], ['Preis', 'r'], '']}>
            {list.map((p) => (
              <tr key={p.id}>
                <td><b>{p.name}</b><div className="small muted mono">{p.sku}</div></td>
                <td className="small">{p.location || '–'}</td>
                <td className="r">
                  <span className="mono">{p.qty} {p.unit}</span>{' '}
                  {p.qty === 0 ? <Pill tone="bad">leer</Pill> : p.qty <= p.minQty ? <Pill tone="warn">min. {p.minQty}</Pill> : null}
                </td>
                <td className="r money">{formatUsd(p.priceCents)}</td>
                <td className="r" style={{ whiteSpace: 'nowrap' }}>
                  {edit && (
                    <>
                      <button className="btn sm" onClick={() => openMove(app, p, true)}>+ Zugang</button>{' '}
                      <button className="btn sm" disabled={p.qty === 0} onClick={() => openMove(app, p, false)}>− Entnahme</button>{' '}
                      <button className="btn sm ghost" onClick={() => orderPart(app, p)}>Bestellen</button>{' '}
                      <button className="btn sm ghost" onClick={() => app.overlay(<FormModal title={`Inventur: ${p.name}`} fields={[{ name: 'qty', label: `Gezählt (${p.unit})`, type: 'number', required: true }]} initial={{ qty: p.qty }} submit={(v) => api.post(app.c(`/parts/${p.id}/count`), { qty: Math.max(0, Math.round(Number(v.qty))) })} onDone={() => app.toast('Bestand gezählt')} submitLabel="Übernehmen" />)}>Zählen</button>{' '}
                      <button className="btn sm ghost" onClick={() => app.overlay(<FormModal title={p.name} fields={partFields} initial={p} submit={(v) => api.patch(app.c(`/parts/${p.id}`), v)} onDone={() => app.toast('Gespeichert')} />)}>Bearbeiten</button>
                    </>
                  )}
                  {app.can('lager', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`${p.name} löschen?`} text="Das Teil verschwindet aus dem Lager." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/parts/${p.id}`)), 'Teil gelöscht')} />)}>Löschen</button>}
                </td>
              </tr>
            ))}
          </Table>
        ) : <Empty title={d.parts.length ? 'Nichts gefunden' : 'Lager ist leer'}>{edit && !d.parts.length ? 'Mit „+ Teil“ das erste Teil anlegen.' : null}</Empty>}
      </Card>
      <div className="g c12" style={{ marginTop: 14 }}>
        <div className="s7">
          <Card title="Bestellungen">
            {d.partOrders.map((o) => {
              const part = d.parts.find((x) => x.id === o.partId);
              return (
                <div key={o.id} className="li">
                  <div className={`ib ${o.status === 'bestellt' ? 'warn' : o.status === 'geliefert' ? 'ok' : ''}`}><Icon name="box" /></div>
                  <div className="tx"><b>{part?.name} ×{o.qty}</b><span>{o.supplier || 'ohne Lieferant'} · {formatUsd(o.costCents)}{o.status === 'bestellt' && o.expected ? ` · erwartet ${formatDate(o.expected)}` : ''}{o.deliveredAt ? ` · geliefert ${formatDate(o.deliveredAt)}` : ''}</span></div>
                  {o.status === 'bestellt' && edit ? <span className="row" style={{ gap: 4 }}><button className="btn sm" onClick={() => deliver(app, o.id, part?.name ?? '', o.costCents)}>Eingang</button><button className="btn sm ghost" onClick={() => app.act(() => api.post(app.c(`/part-orders/${o.id}/cancel`)), 'Storniert')}>Storno</button></span> : <Pill tone={o.status === 'geliefert' ? 'ok' : ''}>{o.status}</Pill>}
                </div>
              );
            })}
            {!d.partOrders.length && <p className="muted small" style={{ margin: 0 }}>Keine Bestellungen. „Bestellen“ steht bei jedem Teil.</p>}
          </Card>
        </div>
        <div className="s5">
          <Card title="Verbrauch 30 Tage">
            {(() => {
              const use = d.partUse.filter((u) => u.used > 0).sort((a, b) => b.used - a.used).slice(0, 6);
              const max = Math.max(1, ...use.map((u) => u.used));
              return use.length ? use.map((u) => { const p = d.parts.find((x) => x.id === u.partId); return <div key={u.partId} style={{ marginBottom: 10 }}><div className="row small" style={{ justifyContent: 'space-between' }}><span>{p?.name}</span><span className="mono">{u.used} {p?.unit}</span></div><div className="bar"><i style={{ width: `${(u.used / max) * 100}%` }} /></div></div>; }) : <p className="muted small" style={{ margin: 0 }}>Noch keine Entnahmen.</p>;
            })()}
          </Card>
        </div>
      </div>
    </>
  );
}
