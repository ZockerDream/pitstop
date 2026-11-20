// Tuning: Konfigurator (Preis live, Auftrag anlegen), Builds (Tuning-Aufträge), Prüfstand (Messungen), Pakete & Preise (Preisliste der Firma).
import { useState } from 'react';
import { formatDate, formatUsd, orderLabel } from '../../../shared/format';
import { DEFAULT_TUNING, quoteTuning, type TuningConfig } from '../../../shared/tuning';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Empty, FormModal, PageHead, Pill, Seg, Table } from '../ui';
import { customerName, customerOptions, plateOf, vehicleOptions } from './helpers';

export function KonfiguratorPage() {
  const app = useApp();
  const d = app.data!;
  const t = d.tuning;
  const classes = Object.keys(t.classes);
  const [cls, setCls] = useState(classes.includes('Sport') ? 'Sport' : classes[0]);
  const [sel, setSel] = useState<Record<string, number>>({});
  const [pkg, setPkg] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [busy, setBusy] = useState(false);
  const p = t.packages.find((x) => x.name === pkg);
  const customer = d.customers.find((c) => c.id === customerId);
  const today = new Date().toISOString().slice(0, 10);
  const contract = customer ? Math.max(0, ...app.data!.contracts.filter((k) => k.customerId === customer.id && k.status === 'aktiv' && (!k.validUntil || k.validUntil >= today)).map((k) => k.tuningPct)) : 0;
  const discount = Math.max(p?.discount ?? 0, customer?.discount ?? 0, contract);
  const quote = quoteTuning(t, cls, p ? p.items : sel, discount);
  const edit = app.can('tuning', 2);
  const create = async () => {
    setBusy(true);
    try {
      const o = await api.post<{ number: number }>(app.c('/tuning/order'), { cls, sel, packageName: pkg || undefined, customerId: customerId || null, vehicleId: vehicleId || null });
      await app.reload();
      app.toast(`${orderLabel(o.number)} angelegt – steht auf der Auftragstafel`);
      setSel({}); setPkg('');
    } catch (err) {
      app.toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHead eyebrow="Tuning" title="Konfigurator" sub="Teile wählen, Preis sehen, als Tuning-Auftrag anlegen" />
      <div className="g c12">
        <div className="s8 stack">
          <Card title="Fahrzeug">
            <div className="g g2">
              <div className="field"><label htmlFor="tk-c">Kunde</label><select id="tk-c" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }}>{customerOptions(d).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
              <div className="field"><label htmlFor="tk-v">Fahrzeug</label><select id="tk-v" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>{vehicleOptions(d, customerId || null).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <div style={{ marginTop: 12 }}><Seg label="Fahrzeugklasse" value={cls} options={classes.map((c) => [c, `${c} ×${t.classes[c]}`] as [string, string])} onChange={setCls} /></div>
          </Card>
          <Card title="Pakete">
            <div className="chips">
              <button className={`chip ${!pkg ? 'on' : ''}`} onClick={() => setPkg('')}>Einzeln wählen</button>
              {t.packages.map((x) => <button key={x.name} className={`chip ${pkg === x.name ? 'on' : ''}`} onClick={() => setPkg(x.name)} title={x.note}>{x.name} −{x.discount} %</button>)}
            </div>
          </Card>
          <Card title="Teile">
            {t.parts.map((part) => {
              const v = p ? (p.items[part.key] ?? 0) : (sel[part.key] ?? 0);
              return (
                <div key={part.key} className="tune-row">
                  <b>{part.name}</b>
                  <div className="chips">{part.levels.map((l, i) => <button key={l} className={`chip ${v === i ? 'on' : ''}`} disabled={!!p} onClick={() => setSel((s) => ({ ...s, [part.key]: i }))}>{l}</button>)}</div>
                  <span className="money">{v ? formatUsd((part.prices[v] ?? 0) * 100) : '–'}</span>
                </div>
              );
            })}
          </Card>
        </div>
        <div className="s4">
          <Card title="Angebot" style={{ position: 'sticky', top: 12 }}>
            {quote.lines.length ? quote.lines.map((l) => <div key={l.part} className="li"><div className="tx"><b>{l.part}</b><span>{l.level}</span></div><span className="money">{formatUsd(l.usd * 100)}</span></div>) : <p className="muted small">Noch nichts gewählt.</p>}
            <div className="li"><div className="tx"><span>Summe Teile</span></div><span className="money">{formatUsd(quote.subtotalUsd * 100)}</span></div>
            <div className="li"><div className="tx"><span>Klasse {cls}</span></div><span className="mono">×{quote.factor}</span></div>
            {discount > 0 && <div className="li"><div className="tx"><span>Rabatt {p && p.discount === discount ? `Paket ${p.name}` : contract === discount ? 'Rahmenvertrag' : 'Kunde'}</span></div><span className="mono">−{discount} %</span></div>}
            <div className="kpi" style={{ marginTop: 12 }}><span className="l">Gesamt</span><span className="v">{formatUsd(quote.totalCents)}</span></div>
            {customer?.blocked && <div className="alert bad" style={{ marginTop: 10 }}><Icon name="alert" /><div>Kunde ist gesperrt.</div></div>}
            {edit && <button className="btn pri" style={{ width: '100%', marginTop: 12 }} disabled={busy || !quote.lines.length} onClick={create}>Als Auftrag anlegen</button>}
          </Card>
        </div>
      </div>
    </>
  );
}

export function BuildsPage() {
  const app = useApp();
  const d = app.data!;
  const builds = d.orders.filter((o) => o.kind === 'tuning');
  return (
    <>
      <PageHead eyebrow="Tuning" title="Builds" sub={app.can('auftraege') ? `${builds.filter((b) => b.status !== 'abgeholt').length} Tuning-Aufträge in Arbeit` : 'Sichtbar mit Recht auf die Auftragstafel'}>
        {app.can('tuning', 2) && <button className="btn pri" onClick={() => app.go('konfigurator')}><Icon name="sliders" size={15} /> Neuer Build</button>}
      </PageHead>
      {builds.length ? (
        <div className="g g3">
          {builds.map((o) => {
            const runs = d.dyno.filter((r) => r.vehicleId && r.vehicleId === o.vehicleId);
            const best = runs.reduce((m, r) => Math.max(m, r.hp), 0);
            return (
              <Card key={o.id}>
                <div className="row"><b className="grow">{o.title}</b><Pill tone={o.status === 'fertig' ? 'ok' : o.status === 'arbeit' ? 'info' : ''}>{o.status}</Pill></div>
                <div className="small muted" style={{ marginTop: 4 }}>{orderLabel(o.number)} · {customerName(d, o.customerId)} {plateOf(d, o.vehicleId) && <span className="plate">{plateOf(d, o.vehicleId)}</span>}</div>
                <div className="bar" style={{ margin: '12px 0 6px' }}><i style={{ width: `${o.progress}%` }} /></div>
                <div className="row small"><span className="grow muted">{o.progress} %</span><span className="money">{formatUsd(o.amountCents)}</span></div>
                {best > 0 && <div className="small" style={{ marginTop: 8 }}>Prüfstand: <b className="mono">{best} PS</b> ({runs.length} Messungen)</div>}
                {o.note && <pre className="small muted" style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: '8px 0 0' }}>{o.note}</pre>}
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title="Keine Builds">Im Konfigurator einen Tuning-Auftrag anlegen.</Empty></Card>}
    </>
  );
}

export function PruefstandPage() {
  const app = useApp();
  const d = app.data!;
  const vehicles = [...new Set(d.dyno.map((r) => r.vehicleId ?? ''))];
  const max = Math.max(1, ...d.dyno.map((r) => r.hp));
  const add = () => app.overlay(
    <FormModal
      title="Messung eintragen"
      fields={[
        { name: 'vehicleId', label: 'Fahrzeug', type: 'select', options: vehicleOptions(d) },
        { name: 'label', label: 'Stand', placeholder: 'Serie, Stufe 2 …' },
        { name: 'hp', label: 'Leistung (PS)', type: 'number', required: true },
        { name: 'torque', label: 'Drehmoment (Nm)', type: 'number' },
        { name: 'note', label: 'Notiz' },
      ]}
      submit={(v) => api.post(app.c('/dyno'), v)}
      onDone={() => app.toast('Messung gespeichert')}
    />,
  );
  return (
    <>
      <PageHead eyebrow="Tuning" title="Prüfstand" sub={`${d.dyno.length} Messungen`}>
        {app.can('tuning', 2) && <button className="btn pri" onClick={add}><Icon name="plus" size={15} /> Messung</button>}
      </PageHead>
      {vehicles.length ? (
        <div className="g g2">
          {vehicles.map((vid) => {
            const runs = d.dyno.filter((r) => (r.vehicleId ?? '') === vid).slice().reverse();
            const v = d.vehicles.find((x) => x.id === vid);
            const gain = runs.length > 1 ? runs[runs.length - 1].hp - runs[0].hp : 0;
            return (
              <Card key={vid || 'ohne'} title={v ? `${v.plate} · ${v.model}` : 'Ohne Fahrzeug'} right={gain > 0 ? <Pill tone="ok">+{gain} PS</Pill> : undefined}>
                {runs.map((r) => (
                  <div key={r.id} className="li">
                    <div className="tx">
                      <b>{r.label || 'Messung'} <span className="mono">{r.hp} PS{r.torque ? ` · ${r.torque} Nm` : ''}</span></b>
                      <div className="dyno-bar" style={{ width: `${(r.hp / max) * 100}%`, marginTop: 6 }} />
                      <span>{formatDate(r.createdAt.slice(0, 10))}{r.note ? ` · ${r.note}` : ''}</span>
                    </div>
                    {app.can('tuning', 3) && <button className="ibtn" aria-label="Messung löschen" onClick={() => app.act(() => api.del(app.c(`/dyno/${r.id}`)), 'Messung gelöscht')}><Icon name="x" size={14} /></button>}
                  </div>
                ))}
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title="Noch keine Messungen" /></Card>}
    </>
  );
}

export function PaketePage() {
  const app = useApp();
  const d = app.data!;
  const manage = app.can('tuning', 3);
  const [cfg, setCfg] = useState<TuningConfig>(() => JSON.parse(JSON.stringify(d.tuning)));
  const [busy, setBusy] = useState(false);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(d.tuning);
  const save = async () => {
    setBusy(true);
    try {
      await api.put(app.c('/tuning'), cfg);
      await app.reload();
      app.toast('Preisliste gespeichert');
    } catch (err) {
      app.toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };
  const setPrice = (pi: number, li: number, usd: number) => setCfg((c) => ({ ...c, parts: c.parts.map((p, i) => (i === pi ? { ...p, prices: p.prices.map((x, k) => (k === li ? usd : x)) } : p)) }));
  return (
    <>
      <PageHead eyebrow="Tuning" title="Pakete & Preise" sub="Preise je Stufe in $, Faktor je Fahrzeugklasse, Pakete mit Rabatt">
        {manage && (
          <>
            <button className="btn ghost" onClick={() => app.overlay(<Confirm title="Auf Vorgabe zurücksetzen?" text="Die Preisliste der Firma wird durch die Pitstop-Vorgabe ersetzt." okLabel="Zurücksetzen" onOk={async () => { await app.act(() => api.del(app.c('/tuning')), 'Vorgabe wiederhergestellt'); setCfg(JSON.parse(JSON.stringify(DEFAULT_TUNING))); }} />)}>Vorgabe</button>
            <button className="btn pri" disabled={!dirty || busy} onClick={save}>Speichern</button>
          </>
        )}
      </PageHead>
      <div className="g c12">
        <div className="s8">
          <Card title="Teile und Stufen">
            <Table head={['Teil', 'Stufen und Preis ($)']}>
              {cfg.parts.map((p, pi) => (
                <tr key={p.key}>
                  <td><b>{p.name}</b></td>
                  <td>
                    <div className="row wrap" style={{ gap: 8 }}>
                      {p.levels.map((l, li) => li === 0 ? null : (
                        <label key={l} className="small" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span className="muted">{l}</span>
                          <input style={{ width: 90 }} inputMode="numeric" disabled={!manage} value={p.prices[li]} onChange={(e) => setPrice(pi, li, Math.max(0, Number(e.target.value.replace(/\D/g, '')) || 0))} aria-label={`${p.name} ${l} Preis`} />
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </div>
        <div className="s4 stack">
          <Card title="Fahrzeugklassen">
            {Object.entries(cfg.classes).map(([k, f]) => (
              <div key={k} className="li"><div className="tx"><b>{k}</b></div><input style={{ width: 70 }} inputMode="decimal" disabled={!manage} value={f} onChange={(e) => setCfg((c) => ({ ...c, classes: { ...c.classes, [k]: Number(e.target.value.replace(',', '.')) || 0 } }))} aria-label={`Faktor ${k}`} /></div>
            ))}
          </Card>
          <Card title="Pakete">
            {cfg.packages.map((x, i) => (
              <div key={x.name} className="li">
                <div className="tx"><b>{x.name}</b><span>{Object.entries(x.items).map(([k, v]) => `${cfg.parts.find((p) => p.key === k)?.name ?? k} ${cfg.parts.find((p) => p.key === k)?.levels[v] ?? v}`).join(' · ')}</span></div>
                <input style={{ width: 54 }} inputMode="numeric" disabled={!manage} value={x.discount} onChange={(e) => setCfg((c) => ({ ...c, packages: c.packages.map((p, k) => (k === i ? { ...p, discount: Math.min(100, Number(e.target.value.replace(/\D/g, '')) || 0) } : p)) }))} aria-label={`Rabatt ${x.name}`} />
                <span className="small muted">%</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}
