// Auftragstafel: Spalten nach Status, Karte öffnet den Auftrag.
import { useState } from 'react';
import { formatAgo, formatUsd, orderLabel } from '../../../shared/format';
import type { Order, OrderStatus } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Drawer, FormModal, Pill, PageHead, type FieldDef } from '../ui';
import { customerName, customerOptions, firstName, memberName, memberOptions, plateOf, vehicleOptions } from './helpers';

export const LANES: [OrderStatus, string, string][] = [
  ['neu', 'Angenommen', 'var(--dim)'], ['arbeit', 'In Arbeit', 'var(--accent)'], ['wartet', 'Wartet auf Teile', 'var(--warn)'], ['fertig', 'Fertig zur Abholung', 'var(--ok)'], ['abgeholt', 'Abgeholt', 'var(--info)'],
];
const KINDS: [string, string][] = [['werkstatt', 'Werkstatt'], ['tuning', 'Tuning'], ['karosserie', 'Karosserie'], ['racing', 'Racing']];
export const kindLabel = (k: string) => KINDS.find((x) => x[0] === k)?.[1] ?? k;

export function orderFields(d: Parameters<typeof memberOptions>[0]): FieldDef[] {
  return [
    { name: 'title', label: 'Was ist zu tun?', required: true },
    { name: 'kind', label: 'Art', type: 'select', options: KINDS },
    { name: 'customerId', label: 'Kunde', type: 'select', options: customerOptions(d) },
    { name: 'vehicleId', label: 'Fahrzeug', type: 'select', options: vehicleOptions(d) },
    ...(d?.services.length ? [{ name: 'serviceId', label: 'Leistung aus der Preisliste', type: 'select' as const, options: [['', '– keine –'], ...d.services.map((x) => [x.id, `${x.name} · ${formatUsd(x.priceCents)}${x.courseId ? ' · Nachweis nötig' : ''}`] as [string, string])] as [string, string][] }] : []),
    { name: 'assigneeId', label: 'Zuständig', type: 'select', options: memberOptions(d) },
    { name: 'amountCents', label: 'Preis', type: 'usd' },
    { name: 'note', label: 'Notiz', type: 'textarea' },
    { name: 'priority', label: 'Eilig', type: 'checkbox' },
  ];
}

/** Fotos hochladen (JPG/PNG/WebP, je bis 10 MB); gibt die Zahl der erfolgreichen zurück. */
export async function uploadPhotos(app: ReturnType<typeof useApp>, orderId: string, files: File[]): Promise<number> {
  let ok = 0;
  for (const f of files) {
    const res = await fetch(`/api${app.c(`/orders/${orderId}/photos`)}`, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f, credentials: 'same-origin' });
    if (res.ok) ok++;
    else app.toast(((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? `${f.name}: Fehler ${res.status}`, 'bad');
  }
  return ok;
}

function Photos({ o, edit }: { o: Order; edit: boolean }) {
  const app = useApp();
  const d = app.data!;
  const list = d.photos.filter((p) => p.orderId === o.id);
  const [big, setBig] = useState<string | null>(null);
  return (
    <div>
      <div className="st">Fotos ({list.length})</div>
      <div className="row wrap" style={{ gap: 8 }}>
        {list.map((p) => (
          <div key={p.id} style={{ position: 'relative' }}>
            <button className="card flat" style={{ padding: 0, overflow: 'hidden', width: 96, height: 72 }} onClick={() => setBig(big === p.id ? null : p.id)} aria-label="Foto vergrößern">
              <img src={`/api${app.c(`/photos/${p.id}`)}`} alt={p.note || 'Foto'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
            </button>
            {edit && (p.createdBy === app.me.user.id || app.can('auftraege', 3)) && <button className="ibtn" style={{ position: 'absolute', top: -8, right: -8, width: 24, height: 24 }} aria-label="Foto löschen" onClick={() => app.act(() => api.del(app.c(`/photos/${p.id}`)), 'Foto gelöscht')}><Icon name="x" size={12} /></button>}
          </div>
        ))}
        {edit && (
          <label className="btn sm" style={{ height: 72, width: 96, justifyContent: 'center', cursor: 'pointer' }}>
            <Icon name="camera" size={15} /> Foto
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={async (e) => { const n = await uploadPhotos(app, o.id, [...(e.target.files ?? [])]); await app.reload(); if (n) app.toast(`${n} Foto${n > 1 ? 's' : ''} hochgeladen`); }} />
          </label>
        )}
      </div>
      {big && <img src={`/api${app.c(`/photos/${big}`)}`} alt="Foto groß" style={{ width: '100%', marginTop: 10, borderRadius: 10 }} />}
      {!list.length && !edit && <p className="muted small" style={{ margin: 0 }}>Keine Fotos.</p>}
    </div>
  );
}

export function openNewOrder(app: ReturnType<typeof useApp>) {
  app.overlay(<FormModal title="Auftrag anlegen" fields={orderFields(app.data)} initial={{ kind: 'werkstatt', assigneeId: app.me.user.id }} submit={(v) => api.post(app.c('/orders'), v)} onDone={() => app.toast('Auftrag angelegt')} submitLabel="Anlegen" />);
}

function OrderDrawer({ o }: { o: Order }) {
  const app = useApp();
  const d = app.data;
  const edit = app.can('auftraege', 2) && (!app.data?.rights.areas.auftraege.own || o.assigneeId === app.me.user.id || o.createdBy === app.me.user.id);
  const patch = (p: Partial<Order>, msg?: string) => app.act(() => api.patch(app.c(`/orders/${o.id}`), p), msg).then((r) => r && app.overlay(<OrderDrawer o={r as Order} />));
  return (
    <Drawer
      title={o.title}
      sub={`${orderLabel(o.number)} · ${kindLabel(o.kind)} · angelegt ${formatAgo(o.createdAt)}`}
      onClose={() => app.overlay(null)}
      foot={
        <>
          {edit && <button className="btn" onClick={() => app.overlay(<FormModal title={`${orderLabel(o.number)} bearbeiten`} fields={orderFields(d)} initial={o} submit={(v) => api.patch(app.c(`/orders/${o.id}`), v)} onDone={() => app.toast('Gespeichert')} />)}>Bearbeiten</button>}
          {app.can('rechnungen', 2) && o.amountCents > 0 && (
            <button className="btn pri" onClick={() => app.act(() => api.post(app.c('/bills'), { customerId: o.customerId, orderId: o.id, title: `${orderLabel(o.number)} ${o.title}`, amountCents: o.amountCents }), 'Rechnung gestellt').then(() => app.go('rechnungen'))}>
              Rechnung stellen
            </button>
          )}
          {app.can('auftraege', 3) && <button className="btn ghost" onClick={() => app.act(() => api.del(app.c(`/orders/${o.id}`)), 'Auftrag gelöscht').then(() => app.overlay(null))}>Löschen</button>}
        </>
      }
    >
      {edit && (
        <div className="seg" role="group" aria-label="Status">
          {LANES.map(([s, l]) => (
            <button key={s} className={o.status === s ? 'on' : ''} onClick={() => patch({ status: s, progress: s === 'fertig' || s === 'abgeholt' ? 100 : o.progress }, `Status: ${l}`)}>{l}</button>
          ))}
        </div>
      )}
      <dl className="kv">
        <dt>Kunde</dt><dd>{customerName(d, o.customerId)}</dd>
        <dt>Fahrzeug</dt><dd>{plateOf(d, o.vehicleId) ? <span className="plate">{plateOf(d, o.vehicleId)}</span> : '–'}</dd>
        <dt>Zuständig</dt><dd>{memberName(d, o.assigneeId) || '–'}</dd>
        <dt>Preis</dt><dd className="money">{formatUsd(o.amountCents)}</dd>
        <dt>Fortschritt</dt><dd><div className="bar" style={{ maxWidth: 220 }}><i style={{ width: `${o.progress}%` }} /></div></dd>
        {o.serviceId && <><dt>Leistung</dt><dd>{d?.services.find((x) => x.id === o.serviceId)?.name ?? '–'}</dd></>}
        <dt>Notiz</dt><dd style={{ whiteSpace: 'pre-wrap' }}>{o.note || '–'}</dd>
      </dl>
      {(o.intake?.km !== undefined || o.intake?.damage?.length || o.intake?.checks?.length) && (
        <div>
          <div className="st">Annahme</div>
          <dl className="kv">
            {o.intake.km !== undefined && <><dt>km-Stand</dt><dd className="mono">{o.intake.km.toLocaleString('de-DE')}</dd></>}
            {o.intake.fuel && <><dt>Tank</dt><dd>{o.intake.fuel}</dd></>}
            <dt>Schäden</dt><dd>{o.intake.damage?.length ? o.intake.damage.map((x) => <Pill key={x} tone="bad" dot={false}>{x}</Pill>) : 'keine markiert'}</dd>
            <dt>Checkliste</dt><dd>{o.intake.checks?.length ? o.intake.checks.join(' · ') : '–'}</dd>
          </dl>
        </div>
      )}
      <Photos o={o} edit={edit} />
      {edit && (
        <div className="row wrap" style={{ gap: 6 }}>
          {[0, 25, 50, 75, 100].map((p) => <button key={p} className={`chip ${o.progress === p ? 'on' : ''}`} onClick={() => patch({ progress: p })}>{p} %</button>)}
          {!o.assigneeId && <button className="btn sm" onClick={() => patch({ assigneeId: app.me.user.id }, 'Übernommen')}>Selbst übernehmen</button>}
        </div>
      )}
    </Drawer>
  );
}

export function OrdersPage() {
  const app = useApp();
  const d = app.data!;
  const [kind, setKind] = useState('alle');
  const list = d.orders.filter((o) => kind === 'alle' || o.kind === kind);
  const open = d.orders.filter((o) => o.status !== 'abgeholt');
  return (
    <>
      <PageHead eyebrow="Werkstatt" title="Auftragstafel" sub={`${open.length} offen · ${formatUsd(open.reduce((a, o) => a + o.amountCents, 0))} in Arbeit${d.rights.areas.auftraege.own ? ' · nur deine Aufträge' : ''}`}>
        <div className="chips">
          {[['alle', 'Alle'], ...KINDS].map(([k, l]) => <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{l}</button>)}
        </div>
        {app.can('auftraege', 2) && <button className="btn" onClick={() => openNewOrder(app)}><Icon name="plus" size={15} /> Auftrag</button>}
        {app.can('auftraege', 2) && <a className="btn pri" href="#annahme"><Icon name="clip" size={15} /> Fahrzeug annehmen</a>}
      </PageHead>
      <div className="board">
        {LANES.map(([s, label, color]) => {
          const lane = list.filter((o) => o.status === s);
          return (
            <div key={s} className="lane">
              <div className="lane-h"><i style={{ background: color }} />{label}<span className="n">{lane.length}</span></div>
              {lane.map((o) => (
                <button key={o.id} className={`job ${o.priority ? 'prio' : ''}`} onClick={() => app.overlay(<OrderDrawer o={o} />)}>
                  <span className="row small wrap" style={{ gap: 6 }}>
                    <span className="mono muted">{orderLabel(o.number)}</span>
                    <Pill dot={false}>{kindLabel(o.kind)}</Pill>
                    {o.priority && <Pill tone="acc" dot={false}>Eilig</Pill>}
                    <span className="money" style={{ marginLeft: 'auto' }}>{formatUsd(o.amountCents)}</span>
                  </span>
                  <span className="t1">{o.title}</span>
                  <span className="row small muted" style={{ gap: 6 }}>
                    {plateOf(d, o.vehicleId) && <span className="plate">{plateOf(d, o.vehicleId)}</span>}
                    {customerName(d, o.customerId) !== '–' && customerName(d, o.customerId)}
                  </span>
                  {o.progress > 0 && o.progress < 100 && <span className="bar" style={{ display: 'block' }}><i style={{ width: `${o.progress}%` }} /></span>}
                  <span className="row small muted">{o.assigneeId ? firstName(d, o.assigneeId) : <Pill tone="warn">nicht zugeteilt</Pill>}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
