// Werkstatt ab 0.4: Fahrzeugannahme (Kennzeichen-Abgleich, Schadensskizze, Checkliste → Auftrag), Hallenplan (Plätze, Buchungen), Werkzeug (Ausgabe, Wartung).
import { useMemo, useState } from 'react';
import { formatDate, formatTime, formatUsd, orderLabel } from '../../../shared/format';
import type { Bay, BayBooking, Tool } from '../../../shared/types';
import { api, ApiError, errorMessage } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Empty, FormModal, Kpi, localInput, PageHead, Pill, Seg } from '../ui';
import { firstName, memberOptions } from './helpers';
import { uploadPhotos } from './Orders';

const ZONES: [string, number, number, number, number][] = [
  ['Front links', 26, 20, 30, 26], ['Front rechts', 64, 20, 30, 26], ['Motorhaube', 34, 48, 52, 30], ['Dach', 36, 84, 48, 48],
  ['Tür links', 20, 84, 14, 50], ['Tür rechts', 86, 84, 14, 50], ['Kofferraum', 34, 138, 52, 26], ['Heck', 30, 166, 60, 18],
];
const CHECKS = ['Fahrzeugschein geprüft', 'Wertsachen dokumentiert', 'Schlüssel ans Brett', 'Kunde hat unterschrieben'];
const JOBS = ['Inspektion', 'Bremsen', 'Reifen', 'Unfall', 'Tuning', 'Folie', 'Diagnose'];
const FUEL = ['voll', '¾', '½', '¼', 'Reserve'];

/** Hat die Person den Nachweis für eine Leistung aus der Preisliste? null = kein Nachweis nötig. */
export function qualification(d: NonNullable<AppCtx['data']>, serviceId: string, userId: string): string | null {
  const s = d.services.find((x) => x.id === serviceId);
  if (!s?.courseId) return null;
  const c = d.courses.find((x) => x.id === s.courseId);
  const p = d.progress.find((x) => x.courseId === s.courseId && x.userId === userId);
  const today = new Date().toISOString().slice(0, 10);
  if (p?.passedAt && (!p.expiresAt || p.expiresAt >= today)) return null;
  return c?.name ?? 'Nachweis';
}

export function AnnahmePage() {
  const app = useApp();
  const d = app.data!;
  const me = app.me.user.id;
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [km, setKm] = useState('');
  const [fuel, setFuel] = useState('½');
  const [damage, setDamage] = useState<string[]>([]);
  const [checks, setChecks] = useState<string[]>([]);
  const [jobs, setJobs] = useState<string[]>([]);
  const [wishes, setWishes] = useState('');
  const [kind, setKind] = useState('werkstatt');
  const [serviceId, setServiceId] = useState('');
  const [assigneeId, setAssigneeId] = useState(me);
  const [price, setPrice] = useState('');
  const [priority, setPriority] = useState(false);
  const [bayId, setBayId] = useState('');
  const [from, setFrom] = useState(() => localInput(new Date(Math.ceil(Date.now() / 900_000) * 900_000).toISOString()));
  const [hours, setHours] = useState('2');
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const p = plate.trim().toUpperCase();
  const known = p ? d.vehicles.find((v) => v.plate.toUpperCase() === p) : undefined;
  const owner = known?.customerId ? d.customers.find((c) => c.id === known.customerId) : undefined;
  const chosen = customerId ? d.customers.find((c) => c.id === customerId) : owner;
  const contract = chosen ? d.contracts.find((k) => k.customerId === chosen.id && k.status === 'aktiv') : undefined;
  const service = d.services.find((s) => s.id === serviceId);
  const missing = serviceId && assigneeId ? qualification(d, serviceId, assigneeId) : null;
  const title = [service?.name, ...jobs.filter((j) => j !== service?.name)].filter(Boolean).join(', ');
  const toggle = (list: string[], set: (v: string[]) => void, x: string) => set(list.includes(x) ? list.filter((y) => y !== x) : [...list, x]);

  async function submit(confirmStolen = false) {
    if (!p) return app.toast('Kennzeichen fehlt', 'bad');
    if (!title && !wishes.trim()) return app.toast('Was ist zu tun? Leistung, Stichwort oder Kundenwunsch angeben.', 'bad');
    const cents = price.trim() ? Math.round(Number(price.replace(/\./g, '').replace(',', '.')) * 100) : undefined;
    if (cents !== undefined && !Number.isFinite(cents)) return app.toast('Preis wie 1.250 oder 99,50', 'bad');
    const start = bayId ? new Date(from) : null;
    setBusy(true);
    try {
      const o = await api.post<{ id: string; number: number }>(app.c('/intake'), {
        plate: p, model, customerId: customerId || null, newCustomer: customerId ? '' : newCustomer, km: km ? Number(km.replace(/\D/g, '')) : undefined, fuel,
        damage, checks, wishes, title: (title || wishes.trim().split('\n')[0]).slice(0, 120), kind, assigneeId: assigneeId || null, serviceId: serviceId || null,
        amountCents: cents, priority, bayId: bayId || null, confirmStolen,
        startsAt: start?.toISOString(), endsAt: start ? new Date(start.getTime() + Number(hours.replace(',', '.')) * 3_600_000).toISOString() : undefined,
      });
      const n = files.length ? await uploadPhotos(app, o.id, files) : 0;
      await app.reload();
      app.toast(`${orderLabel(o.number)} angelegt${n ? ` mit ${n} Foto${n > 1 ? 's' : ''}` : ''}`);
      app.go('auftraege');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && /gestohlen/.test(err.message) && !confirmStolen) {
        app.overlay(<Confirm title="Kennzeichen gestohlen gemeldet" text={<><p style={{ marginTop: 0 }}>{err.message}</p><p className="muted small">Trotzdem annehmen? Der Hinweis landet im Protokoll.</p></>} okLabel="Trotzdem annehmen" onOk={() => submit(true)} />);
      } else app.toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHead eyebrow="Werkstatt" title="Fahrzeugannahme" sub="Fahrzeug, Zustand, Auftrag – in einem Durchgang" />
      <div className="g c12">
        <div className="s7 stack">
          <Card title="1 · Fahrzeug">
            <div className="g g2">
              <div className="field"><label htmlFor="an-plate">Kennzeichen *</label><input id="an-plate" list="an-plates" value={plate} onChange={(e) => setPlate(e.target.value)} autoFocus /><datalist id="an-plates">{d.vehicles.map((v) => <option key={v.id} value={v.plate}>{v.model}</option>)}</datalist></div>
              <div className="field"><label htmlFor="an-model">Modell</label><input id="an-model" value={known ? known.model : model} disabled={!!known} onChange={(e) => setModel(e.target.value)} /></div>
              <div className="field"><label htmlFor="an-cust">Halter</label>
                <select id="an-cust" value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
                  <option value="">{owner ? `${owner.name} (aus der Fahrzeugakte)` : '– neuer oder ohne Kunde –'}</option>
                  {d.customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              {!customerId && !owner && app.can('kunden', 2) ? <div className="field"><label htmlFor="an-new">Neuer Kunde (Name)</label><input id="an-new" value={newCustomer} onChange={(e) => setNewCustomer(e.target.value)} /></div> : <div />}
              <div className="field"><label htmlFor="an-km">km-Stand</label><input id="an-km" inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value)} /></div>
              <div className="field"><label htmlFor="an-fuel">Tank</label><select id="an-fuel" value={fuel} onChange={(e) => setFuel(e.target.value)}>{FUEL.map((f) => <option key={f}>{f}</option>)}</select></div>
            </div>
            {p && (known?.stolen ? (
              <div className="alert" style={{ marginTop: 12 }}><Icon name="alert" /><div><b>Kennzeichen als gestohlen gemeldet.</b> Fahrzeug nicht herausgeben, Leitung informieren.</div></div>
            ) : chosen?.blocked ? (
              <div className="alert warn" style={{ marginTop: 12 }}><Icon name="lock" /><div><b>{chosen.name} ist gesperrt.</b> Annahme nur nach Rücksprache mit der Leitung.</div></div>
            ) : known ? (
              <div className="alert ok" style={{ marginTop: 12 }}><Icon name="check" /><div><b>Kennzeichen-Abgleich unauffällig.</b> Bekannt: {known.model}{owner ? `, Halter ${owner.name}` : ''}.</div></div>
            ) : (
              <div className="alert info" style={{ marginTop: 12 }}><Icon name="car" /><div>Neues Fahrzeug – wird mit der Annahme in den Fahrzeugakten angelegt.</div></div>
            ))}
            {contract && <div className="alert info" style={{ marginTop: 8 }}><Icon name="doc" /><div><b>Rahmenvertrag {contract.title}:</b> {contract.workshopPct} % Werkstatt · {contract.tuningPct} % Tuning{contract.rules ? ` · ${contract.rules}` : ''}</div></div>}
          </Card>
          <Card title="3 · Was ist zu tun?">
            <div className="chips" style={{ marginBottom: 10 }}>{JOBS.map((j) => <button key={j} type="button" className={`chip ${jobs.includes(j) ? 'on' : ''}`} aria-pressed={jobs.includes(j)} onClick={() => toggle(jobs, setJobs, j)}>{j}</button>)}</div>
            <div className="g g2">
              {d.services.length > 0 && (
                <div className="field"><label htmlFor="an-svc">Leistung aus der Preisliste</label>
                  <select id="an-svc" value={serviceId} onChange={(e) => { setServiceId(e.target.value); const s = d.services.find((x) => x.id === e.target.value); if (s) setPrice(String(s.priceCents / 100)); }}>
                    <option value="">– keine –</option>
                    {d.services.map((s) => <option key={s.id} value={s.id}>{s.name} · {formatUsd(s.priceCents)}</option>)}
                  </select>
                </div>
              )}
              <div className="field"><label htmlFor="an-kind">Art</label><select id="an-kind" value={kind} onChange={(e) => setKind(e.target.value)}>{[['werkstatt', 'Werkstatt'], ['karosserie', 'Karosserie'], ['tuning', 'Tuning'], ['racing', 'Racing']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <div className="field" style={{ marginTop: 10 }}><label htmlFor="an-note">Kundenwunsch</label><textarea id="an-note" rows={3} value={wishes} onChange={(e) => setWishes(e.target.value)} /></div>
            <div className="g g2" style={{ marginTop: 10 }}>
              <div className="field"><label htmlFor="an-mech">Zuständig</label><select id="an-mech" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>{memberOptions(d).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>{missing && <span className="err">Nachweis „{missing}“ fehlt</span>}</div>
              <div className="field"><label htmlFor="an-price">Preis ($)</label><input id="an-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder={service ? formatUsd(service.priceCents) : ''} /></div>
              {app.can('hallenplan', 2) && d.bays.length > 0 && (
                <>
                  <div className="field"><label htmlFor="an-bay">Platz</label><select id="an-bay" value={bayId} onChange={(e) => setBayId(e.target.value)}><option value="">– später –</option>{d.bays.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
                  {bayId ? <div className="row" style={{ gap: 8 }}><div className="field grow"><label htmlFor="an-from">ab</label><input id="an-from" type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div className="field" style={{ width: 80 }}><label htmlFor="an-h">Std.</label><input id="an-h" inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} /></div></div> : <div />}
                </>
              )}
            </div>
            <label className="row small" style={{ gap: 8, marginTop: 10 }}><input type="checkbox" checked={priority} onChange={(e) => setPriority(e.target.checked)} /> Eilig</label>
            <div className="row wrap" style={{ marginTop: 14, justifyContent: 'flex-end', gap: 8 }}>
              <span className="muted small grow">{title ? `Auftrag: ${title}` : ''}</span>
              <button className="btn pri" disabled={busy || !!missing} onClick={() => void submit()}>Auftrag anlegen</button>
            </div>
          </Card>
        </div>
        <div className="s5 stack">
          <Card title="2 · Zustand">
            <p className="muted small" style={{ margin: '0 0 10px' }}>Tippe auf eine Stelle, um einen Schaden zu markieren.</p>
            <svg viewBox="0 0 120 200" style={{ width: '100%', maxWidth: 230, display: 'block', margin: '0 auto' }} role="img" aria-label="Fahrzeug von oben mit Schadensstellen">
              <rect x="16" y="12" width="88" height="176" rx="28" fill="var(--panel-2)" stroke="var(--line-2)" />
              {ZONES.map(([n, x, y, w, h]) => (
                <rect key={n} className="carzone" role="button" tabIndex={0} aria-label={n} aria-pressed={damage.includes(n)} x={x} y={y} width={w} height={h} rx="6"
                  fill={damage.includes(n) ? 'var(--bad)' : 'var(--panel-3)'} opacity={damage.includes(n) ? 0.8 : 0.95} stroke="var(--line-2)" strokeWidth=".6"
                  onClick={() => toggle(damage, setDamage, n)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && toggle(damage, setDamage, n)}>
                  <title>{n}</title>
                </rect>
              ))}
            </svg>
            <div className="chips" style={{ marginTop: 10 }}>{damage.length ? damage.map((x) => <Pill key={x} tone="bad" dot={false}>{x}</Pill>) : <span className="muted small">Keine Schäden markiert</span>}</div>
            <div className="row" style={{ marginTop: 12, gap: 8 }}>
              <label className="btn" style={{ cursor: 'pointer' }}><Icon name="camera" size={15} /> Fotos hinzufügen<input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => setFiles([...files, ...(e.target.files ?? [])].slice(0, 20))} /></label>
              <span className="muted small">{files.length ? `${files.length} Foto${files.length > 1 ? 's' : ''} · ${(files.reduce((a, f) => a + f.size, 0) / 1048576).toFixed(1).replace('.', ',')} MB` : 'noch keine'}</span>
              {files.length > 0 && <button className="btn sm ghost" onClick={() => setFiles([])}>Leeren</button>}
            </div>
          </Card>
          <Card title="Checkliste Annahme">
            {CHECKS.map((c) => (
              <label key={c} className={`chk ${checks.includes(c) ? 'y' : ''}`} style={{ cursor: 'pointer' }}>
                <input type="checkbox" className="sr" checked={checks.includes(c)} onChange={() => toggle(checks, setChecks, c)} />
                <i>{checks.includes(c) && <Icon name="check" size={12} />}</i><span>{c}</span>
              </label>
            ))}
          </Card>
        </div>
      </div>
    </>
  );
}

// --- Hallenplan ---------------------------------------------------------------
const BAY_KIND: [Bay['kind'], string][] = [['hebebuehne', 'Hebebühne'], ['lack', 'Lackierkabine'], ['pruefstand', 'Prüfstand'], ['wasch', 'Waschplatz'], ['sonstig', 'Sonstiges']];
const dayIso = (offset: number) => { const t = new Date(); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() + offset); return t; };

export function openBooking(app: AppCtx, b?: BayBooking, preset?: { bayId?: string; startsAt?: string }) {
  const d = app.data!;
  const start = preset?.startsAt ?? new Date(Math.ceil(Date.now() / 900_000) * 900_000).toISOString();
  app.overlay(
    <FormModal
      title={b ? 'Buchung ändern' : 'Platz buchen'}
      fields={[
        { name: 'bayId', label: 'Platz', type: 'select', options: d.bays.map((x) => [x.id, x.name]) },
        { name: 'orderId', label: 'Auftrag', type: 'select', options: [['', '– ohne Auftrag –'], ...d.orders.filter((o) => o.status !== 'abgeholt').map((o) => [o.id, `${orderLabel(o.number)} ${o.title}`] as [string, string])] },
        { name: 'title', label: 'Text (sonst Auftragsname)' },
        { name: 'startsAt', label: 'Beginn', type: 'datetime', required: true },
        { name: 'endsAt', label: 'Ende', type: 'datetime', required: true },
      ]}
      initial={b ?? { bayId: preset?.bayId ?? d.bays[0]?.id, startsAt: start, endsAt: new Date(Date.parse(start) + 2 * 3_600_000).toISOString() }}
      submit={(v) => {
        const o = d.orders.find((x) => x.id === v.orderId);
        const body = { ...v, title: String(v.title || (o ? `${orderLabel(o.number)} ${o.title}` : '')) };
        return b ? api.patch(app.c(`/bookings/${b.id}`), body) : api.post(app.c('/bookings'), body);
      }}
      onDone={() => app.toast('Gebucht')}
    >
      {b && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => app.act(() => api.del(app.c(`/bookings/${b.id}`)), 'Buchung gelöscht').then(() => app.overlay(null))}>Buchung löschen</button>}
    </FormModal>,
  );
}

function BaysModal() {
  const app = useApp();
  const d = app.data!;
  const edit = (b?: Bay) => app.overlay(
    <FormModal title={b ? b.name : 'Neuer Platz'} fields={[{ name: 'name', label: 'Name', required: true }, { name: 'kind', label: 'Art', type: 'select', options: BAY_KIND }, { name: 'position', label: 'Reihenfolge', type: 'number' }]}
      initial={b ?? { kind: 'hebebuehne', position: d.bays.length + 1 }} submit={(v) => (b ? api.patch(app.c(`/bays/${b.id}`), v) : api.post(app.c('/bays'), v))} onDone={() => app.overlay(<BaysModal />)} />,
  );
  return (
    <FormModal title="Plätze verwalten" fields={[]} submit={async () => undefined} submitLabel="Fertig">
      {d.bays.map((b) => (
        <div key={b.id} className="li">
          <div className="tx"><b>{b.name}</b><span>{BAY_KIND.find((k) => k[0] === b.kind)?.[1]}</span></div>
          <button type="button" className="btn sm ghost" onClick={() => edit(b)}>Ändern</button>
          <button type="button" className="btn sm ghost" onClick={() => app.act(() => api.del(app.c(`/bays/${b.id}`)), 'Platz gelöscht').then(() => app.overlay(<BaysModal />))}>Löschen</button>
        </div>
      ))}
      <button type="button" className="btn" onClick={() => edit()}><Icon name="plus" size={14} /> Platz</button>
    </FormModal>
  );
}

export function HallenplanPage() {
  const app = useApp();
  const d = app.data!;
  const [day, setDay] = useState<'-1' | '0' | '1'>('0');
  const [now] = useState(() => Date.now());
  const d0 = dayIso(Number(day));
  const d1 = new Date(d0.getTime() + 86_400_000);
  const todays = d.bookings.filter((b) => Date.parse(b.endsAt) > d0.getTime() && Date.parse(b.startsAt) < d1.getTime());
  // Zeitfenster: üblich 16–24 Uhr, wird um frühere/spätere Buchungen erweitert
  const hourOf = (iso: string) => Math.max(0, Math.min(24, (Date.parse(iso) - d0.getTime()) / 3_600_000));
  const h0 = Math.floor(Math.min(16, ...todays.map((b) => hourOf(b.startsAt))));
  const h1 = Math.ceil(Math.max(24, ...todays.map((b) => hourOf(b.endsAt))));
  const span = h1 - h0;
  const pct = (h: number) => ((h - h0) / span) * 100;
  const nowH = (now - d0.getTime()) / 3_600_000;
  const busyHours = todays.reduce((a, b) => a + Math.max(0, Math.min(h1, hourOf(b.endsAt)) - Math.max(h0, hourOf(b.startsAt))), 0);
  const util = d.bays.length ? Math.round((busyHours / (d.bays.length * span)) * 100) : 0;
  const freeNow = d.bays.filter((bay) => !d.bookings.some((b) => b.bayId === bay.id && Date.parse(b.startsAt) <= now && Date.parse(b.endsAt) > now));
  const edit = app.can('hallenplan', 2);
  const tone = (b: BayBooking) => {
    const o = d.orders.find((x) => x.id === b.orderId);
    return o?.status === 'wartet' ? 'warn' : o?.status === 'fertig' ? 'ok' : o ? 'acc' : 'info';
  };
  return (
    <>
      <PageHead eyebrow="Werkstatt" title="Hallenplan" sub={`${d0.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · ${h0}–${h1 > 24 ? h1 - 24 : h1} Uhr · ${util} % ausgelastet`}>
        <Seg value={day} options={[['-1', 'Gestern'], ['0', 'Heute'], ['1', 'Morgen']]} onChange={setDay} />
        {app.can('hallenplan', 3) && <button className="btn" onClick={() => app.overlay(<BaysModal />)}>Plätze</button>}
        {edit && d.bays.length > 0 && <button className="btn pri" onClick={() => openBooking(app)}><Icon name="plus" size={15} /> Platz buchen</button>}
      </PageHead>
      {d.bays.length ? (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <div className="gantt">
              <div />
              <div className="hrs">{Array.from({ length: Math.floor(span / 2) + 1 }, (_, i) => <span key={i}>{(h0 + i * 2) % 24}:00</span>)}</div>
              {d.bays.map((bay) => (
                <div key={bay.id} style={{ display: 'contents' }}>
                  <div className="gl2">{bay.name}</div>
                  <div className="tr" onDoubleClick={edit ? (e) => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); const h = h0 + Math.floor(((e.clientX - r.left) / r.width) * span * 2) / 2; openBooking(app, undefined, { bayId: bay.id, startsAt: new Date(d0.getTime() + h * 3_600_000).toISOString() }); } : undefined}>
                    {todays.filter((b) => b.bayId === bay.id).map((b) => {
                      const a = Math.max(h0, hourOf(b.startsAt));
                      const e = Math.min(h1, hourOf(b.endsAt));
                      return (
                        <button key={b.id} className={`blk pill ${tone(b)}`} style={{ left: `${pct(a)}%`, width: `${pct(e) - pct(a)}%`, border: 0 }} title={`${b.title} · ${formatTime(b.startsAt)}–${formatTime(b.endsAt)}`}
                          onClick={() => (edit ? openBooking(app, b) : undefined)}>
                          {b.title || 'Belegt'}
                        </button>
                      );
                    })}
                    {day === '0' && nowH >= h0 && nowH <= h1 && <div className="now" style={{ left: `${pct(nowH)}%` }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
          {edit && <p className="small dim" style={{ margin: '10px 0 0' }}>Doppelklick in eine Zeile bucht ab dieser Uhrzeit, Klick auf einen Block ändert ihn.</p>}
        </Card>
      ) : (
        <Card><Empty title="Noch keine Plätze">{app.can('hallenplan', 3) ? 'Unter „Plätze“ Hebebühnen, Lackierkabine oder Prüfstand anlegen.' : 'Die Leitung legt die Plätze an.'}</Empty></Card>
      )}
      <div className="g g3" style={{ marginTop: 14 }}>
        <Kpi label="Auslastung" value={`${util} %`} detail={`${busyHours.toFixed(1).replace('.', ',')} h gebucht`} />
        <Kpi label="Jetzt frei" value={freeNow.length} detail={freeNow.map((b) => b.name).join(', ') || 'alles belegt'} />
        <Kpi label="Buchungen" value={todays.length} detail={d0.toLocaleDateString('de-DE', { weekday: 'long' })} />
      </div>
    </>
  );
}

// --- Werkzeug ------------------------------------------------------------------
const toolFields = [
  { name: 'name', label: 'Werkzeug', required: true },
  { name: 'info', label: 'Kurzinfo (z. B. „Akku 80 %“, „kalibriert 10/2026“)' },
  { name: 'location', label: 'Platz (wenn frei)' },
  { name: 'checkDue', label: 'Nächste Prüfung', type: 'date' as const },
  { name: 'note', label: 'Notiz', type: 'textarea' as const },
];

function issueTool(app: AppCtx, t: Tool) {
  app.overlay(
    <FormModal title={`${t.name} ausgeben`} fields={[{ name: 'userId', label: 'An', type: 'select', options: memberOptions(app.data).filter(([v]) => v) }]} initial={{ userId: app.me.user.id }}
      submit={(v) => api.post(app.c(`/tools/${t.id}/issue`), v)} onDone={() => app.toast('Ausgegeben')} submitLabel="Ausgeben" />,
  );
}

export function WerkzeugPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('werkzeug', 2);
  const [f, setF] = useState<'alle' | 'frei' | 'ausgegeben' | 'wartung'>('alle');
  const [soon] = useState(() => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
  const list = useMemo(() => d.tools.filter((t) => f === 'alle' || t.status === f), [d.tools, f]);
  return (
    <>
      <PageHead eyebrow="Werkstatt" title="Werkzeug" sub={`${d.tools.length} Werkzeuge · ${d.tools.filter((t) => t.status === 'ausgegeben').length} ausgegeben · ${d.tools.filter((t) => t.status === 'wartung').length} in Wartung`}>
        <Seg value={f} options={[['alle', 'Alle'], ['frei', 'Frei'], ['ausgegeben', 'Ausgegeben'], ['wartung', 'Wartung']]} onChange={setF} />
        {edit && <button className="btn pri" onClick={() => app.overlay(<FormModal title="Neues Werkzeug" fields={toolFields} submit={(v) => api.post(app.c('/tools'), v)} onDone={() => app.toast('Werkzeug angelegt')} />)}><Icon name="plus" size={15} /> Werkzeug</button>}
      </PageHead>
      {list.length ? (
        <div className="g g3">
          {list.map((t) => {
            const due = t.checkDue && t.checkDue <= soon;
            return (
              <Card key={t.id}>
                <div className="row">
                  <div className={`ib ${t.status === 'wartung' ? 'bad' : t.status === 'ausgegeben' ? 'warn' : 'ok'}`}><Icon name="wrench" /></div>
                  <div className="grow"><b>{t.name}</b><div className="muted small">{t.status === 'ausgegeben' && t.since ? `seit ${formatTime(t.since)}${new Date(t.since).toDateString() !== new Date().toDateString() ? ` (${formatDate(t.since)})` : ''}` : t.status === 'wartung' ? (t.note || 'in Wartung') : t.location || 'frei'}</div></div>
                </div>
                <div className="row" style={{ marginTop: 12 }}>
                  {t.status === 'ausgegeben' ? <span className="small"><b>{firstName(d, t.holderId)}</b></span> : <Pill tone={t.status === 'wartung' ? 'bad' : 'ok'}>{t.status === 'wartung' ? 'Wartung' : 'frei'}</Pill>}
                  <span className={`small ${due ? 'err' : 'muted'}`} style={{ marginLeft: 'auto' }}>{due ? `Prüfung ${formatDate(t.checkDue)}` : t.info}</span>
                </div>
                {edit && (
                  <div className="row wrap" style={{ marginTop: 12, gap: 6 }}>
                    {t.status === 'frei' && <button className="btn sm pri" onClick={() => issueTool(app, t)}>Ausgeben</button>}
                    {t.status === 'ausgegeben' && <button className="btn sm" onClick={() => app.act(() => api.post(app.c(`/tools/${t.id}/return`)), 'Zurückgenommen')}>Zurücknehmen</button>}
                    {t.status !== 'ausgegeben' && <button className="btn sm ghost" onClick={() => t.status === 'wartung'
                      ? app.act(() => api.post(app.c(`/tools/${t.id}/maintenance`), {}), 'Wartung abgeschlossen')
                      : app.overlay(<FormModal title={`${t.name}: Wartung`} fields={[{ name: 'note', label: 'Was ist los?', required: true }]} submit={(v) => api.post(app.c(`/tools/${t.id}/maintenance`), v)} onDone={() => app.toast('In Wartung')} submitLabel="In Wartung" />)}>
                      {t.status === 'wartung' ? 'Wartung abschließen' : 'Wartung'}
                    </button>}
                    <button className="btn sm ghost" onClick={() => app.overlay(<FormModal title={t.name} fields={toolFields} initial={t} submit={(v) => api.patch(app.c(`/tools/${t.id}`), v)} onDone={() => app.toast('Gespeichert')} />)}>Bearbeiten</button>
                    {app.can('werkzeug', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`${t.name} löschen?`} text="Das Werkzeug verschwindet aus der Liste." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/tools/${t.id}`)), 'Gelöscht')} />)}>Löschen</button>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title={d.tools.length ? 'Nichts in dieser Ansicht' : 'Noch kein Werkzeug erfasst'} /></Card>}
    </>
  );
}

