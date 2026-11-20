// Leitstelle: Karte mit offenen Einsätzen, Liste, Einsatz anlegen (Ort per Klick), zuteilen, Status, abrechnen.
import { useEffect, useState } from 'react';
import { calloutLabel, formatAgo, formatUsd } from '../../../shared/format';
import type { Callout, CalloutStatus } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Drawer, Empty, FormModal, PageHead, Pill, Seg, type FieldDef } from '../ui';
import { MapView } from './MapView';
import { firstName, memberName, memberOptions } from './helpers';

const ST: [CalloutStatus, string, string, string][] = [
  ['offen', 'Offen', 'bad', 'var(--bad)'], ['unterwegs', 'Unterwegs', 'warn', 'var(--warn)'], ['vorort', 'Vor Ort', 'info', 'var(--info)'], ['erledigt', 'Erledigt', 'ok', 'var(--ok)'],
];
const st = (s: string) => ST.find((x) => x[0] === s)!;

function fields(app: ReturnType<typeof useApp>): FieldDef[] {
  const f: FieldDef[] = [
    { name: 'location', label: 'Ort', required: true, placeholder: 'z. B. Legion Square, Parkhaus' },
    { name: 'requester', label: 'Auftraggeber', placeholder: 'LSPD, EMS, Name …' },
    { name: 'vehicle', label: 'Fahrzeug', placeholder: 'roter Sportwagen, LSPD 31 …' },
    { name: 'feeCents', label: 'Gebühr', type: 'usd' },
    { name: 'truck', label: 'Abschleppwagen' },
    { name: 'x', label: 'X (Spielkoordinate)', type: 'number' },
    { name: 'y', label: 'Y (Spielkoordinate)', type: 'number' },
  ];
  if (app.special('zuteilen')) f.splice(4, 0, { name: 'driverId', label: 'Fahrer', type: 'select', options: memberOptions(app.data) });
  return f;
}

function CalloutDrawer({ e }: { e: Callout }) {
  const app = useApp();
  const me = app.me.user.id;
  const mine = e.driverId === me || e.createdBy === me;
  const canEdit = app.can('leitstelle', 2) && (!app.data!.rights.areas.leitstelle.own || mine || !e.driverId);
  const patch = (p: Partial<Callout>, msg: string) => app.act(() => api.patch<Callout>(app.c(`/callouts/${e.id}`), p), msg).then((r) => r && app.overlay(<CalloutDrawer e={r} />));
  const bill = app.data!.bills.find((b) => b.calloutId === e.id);
  return (
    <Drawer
      title={e.location}
      sub={`${calloutLabel(e.number)} · ${e.requester || 'ohne Auftraggeber'} · ${formatAgo(e.createdAt)}`}
      onClose={() => app.overlay(null)}
      foot={
        <>
          {canEdit && !e.driverId && <button className="btn pri" onClick={() => patch({ driverId: me, status: 'unterwegs' }, 'Einsatz übernommen')}>Ich fahre</button>}
          {canEdit && <button className="btn" onClick={() => app.overlay(<FormModal title={`${calloutLabel(e.number)} bearbeiten`} fields={fields(app)} initial={e} submit={(v) => api.patch(app.c(`/callouts/${e.id}`), v)} onDone={() => app.toast('Gespeichert')} />)}>Bearbeiten</button>}
          {app.can('rechnungen', 2) && e.status === 'erledigt' && !bill && e.feeCents > 0 && (
            <button className="btn" onClick={() => app.act(() => api.post(app.c('/bills'), { calloutId: e.id, title: `${calloutLabel(e.number)} Abschleppen ${e.location}`, amountCents: e.feeCents }), 'Rechnung gestellt')}>Abrechnen</button>
          )}
        </>
      }
    >
      {canEdit && (
        <div className="seg" role="group" aria-label="Status">
          {ST.map(([s, l]) => <button key={s} className={e.status === s ? 'on' : ''} onClick={() => patch({ status: s }, `Status: ${l}`)}>{l}</button>)}
        </div>
      )}
      <dl className="kv">
        <dt>Status</dt><dd><Pill tone={st(e.status)[2]}>{st(e.status)[1]}</Pill></dd>
        <dt>Fahrer</dt><dd>{e.driverId ? memberName(app.data, e.driverId) : <Pill tone="bad">noch niemand</Pill>}</dd>
        <dt>Fahrzeug</dt><dd>{e.vehicle || '–'}</dd>
        <dt>Abschleppwagen</dt><dd>{e.truck || '–'}</dd>
        <dt>Gebühr</dt><dd className="money">{formatUsd(e.feeCents)}</dd>
        <dt>Koordinaten</dt><dd className="mono">{e.x !== null ? `${e.x} / ${e.y}` : '–'}</dd>
        {bill && (<><dt>Rechnung</dt><dd>R-{bill.number} · {bill.status}</dd></>)}
      </dl>
    </Drawer>
  );
}

export function Leitstelle() {
  const app = useApp();
  const d = app.data!;
  const [base, setBase] = useState<'ls' | 'full'>('ls');
  const [picking, setPicking] = useState(false);
  const [showDone, setShowDone] = useState(false);
  // Aufruf aus der Einsatzliste: #leitstelle/<id> öffnet den Einsatz
  const target = app.param;
  useEffect(() => {
    const c = target ? app.data?.callouts.find((x) => x.id === target) : undefined;
    if (c) app.overlay(<CalloutDrawer e={c} />);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);
  const active = d.callouts.filter((c) => c.status !== 'erledigt');
  const list = showDone ? d.callouts : active;
  const free = d.members.filter((m) => m.onDutySince && !active.some((c) => c.driverId === m.userId));
  const create = (x?: number, y?: number) =>
    app.overlay(<FormModal title="Einsatz anlegen" fields={fields(app)} initial={{ x: x ?? null, y: y ?? null, feeCents: 35000 }} submit={(v) => api.post(app.c('/callouts'), v)} onDone={() => app.toast('Einsatz angelegt')} submitLabel="Anlegen" />);
  return (
    <>
      <PageHead eyebrow="Abschleppdienst" title="Leitstelle" sub={`${active.length} Einsätze aktiv · ${active.filter((c) => !c.driverId).length} ohne Fahrer · ${free.length} im Dienst frei`}>
        <Seg value={base} options={[['ls', 'Los Santos'], ['full', 'Ganze Insel']]} onChange={setBase} label="Kartenausschnitt" />
        {app.can('leitstelle', 2) && (
          <>
            <button className={`btn ${picking ? 'on' : ''}`} onClick={() => setPicking((p) => !p)}><Icon name="pin" size={15} /> {picking ? 'Auf Karte klicken …' : 'Ort auf Karte'}</button>
            <button className="btn pri" onClick={() => create()}><Icon name="plus" size={15} /> Einsatz</button>
          </>
        )}
      </PageHead>
      <div className="g c12">
        <div className="s8">
          <Card style={{ padding: 10 }}>
            <MapView
              base={base}
              imageUrl={d.company.hasMap ? `/api${app.c('/map')}` : null}
              bounds={d.company.mapBounds}
              pins={active.filter((c) => c.x !== null && c.y !== null).map((c) => ({ id: c.id, x: c.x!, y: c.y!, color: st(c.status)[3], label: `${calloutLabel(c.number)}${c.driverId ? ` · ${firstName(d, c.driverId)}` : ''}` }))}
              onPin={(id) => app.overlay(<CalloutDrawer e={d.callouts.find((c) => c.id === id)!} />)}
              onPick={picking ? (x, y) => { setPicking(false); create(x, y); } : undefined}
            />
            <div className="row wrap small muted" style={{ gap: 8, marginTop: 8 }}>
              {ST.slice(0, 3).map(([s, l, t]) => <Pill key={s} tone={t}>{l}</Pill>)}
              <span style={{ marginLeft: 'auto' }}>{d.company.hasMap ? 'Eigenes Kartenbild' : 'Nachgezeichnet · eigenes Bild unter Firmendaten'}</span>
            </div>
          </Card>
        </div>
        <div className="s4 stack">
          <Card title="Einsätze" right={<button className="link" onClick={() => setShowDone((v) => !v)}>{showDone ? 'nur aktive' : 'alle'}</button>}>
            {list.length ? list.map((c) => (
              <div key={c.id} className="li" data-o onClick={() => app.overlay(<CalloutDrawer e={c} />)} style={{ alignItems: 'flex-start' }}>
                <div className={`ib ${st(c.status)[2]}`}><Icon name={c.status === 'erledigt' ? 'check' : 'truck'} /></div>
                <div className="tx"><b>{c.location}</b><span>{calloutLabel(c.number)} · {c.requester || '–'}</span><span>{c.driverId ? memberName(d, c.driverId) : 'Noch kein Fahrer'}</span></div>
                <div style={{ textAlign: 'right' }}><Pill tone={st(c.status)[2]}>{st(c.status)[1]}</Pill><div className="mono dim small" style={{ marginTop: 4 }}>{formatAgo(c.createdAt)}</div></div>
              </div>
            )) : <Empty title="Keine aktiven Einsätze" />}
          </Card>
          <Card title="Im Dienst">
            {d.members.filter((m) => m.onDutySince).map((m) => {
              const busy = active.find((c) => c.driverId === m.userId);
              return <div key={m.userId} className="li"><div className="tx"><b>{m.displayName}</b><span>{busy ? `${calloutLabel(busy.number)} · ${busy.location}` : 'frei'}</span></div><Pill tone={busy ? 'warn' : 'ok'}>{busy ? 'unterwegs' : 'frei'}</Pill></div>;
            })}
            {!d.members.some((m) => m.onDutySince) && <p className="muted small" style={{ margin: 0 }}>Gerade niemand im Dienst.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
