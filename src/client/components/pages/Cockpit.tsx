// Cockpit als eigene Arbeitsfläche: Widgets pro Konto (prefs.widgets), nur aus Bereichen, die man sehen darf.
// „Anpassen“: Größe wechseln, verschieben, entfernen, aus der Bibliothek hinzufügen.
import { useState, type ReactNode } from 'react';
import { calloutLabel, formatDate, formatTime, formatUsd, orderLabel } from '../../../shared/format';
import type { Board } from '../../../shared/types';
import { ACCOUNTS } from '../../../shared/types';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Empty, Kpi, Modal, PageHead, Pill } from '../ui';
import { calendarItems } from './Calendar';
import { openNewCustomer } from './Customers';
import { openNewBill } from './Finance';
import { lowParts, openMove } from './Lager';
import { openNewOrder } from './Orders';
import { bestLaps, formatLap } from './Racing';
import { isRequired, pendingOf, percent, progressOf, statusOf } from './Training';
import { FeedLine, useFeed } from './Firma';
import { openBooking } from './Werkstatt';
import { sum } from './helpers';

type Data = NonNullable<AppCtx['data']>;
interface WidgetDef {
  label: string;
  size: number;
  ok: (app: AppCtx, d: Data) => boolean;
  render: (app: AppCtx, d: Data) => ReactNode;
}
const SIZES = [3, 4, 6, 8, 12];
const today = () => new Date().toISOString().slice(0, 10);
const mod = (d: Data, m: string) => d.company.modules.includes(m);

/** Alles, was die angemeldete Person gerade erledigen sollte (Cockpit „Braucht dich“ und Glocke oben). */
export function todo(app: AppCtx, d: Data) {
  const me = app.me.user.id;
  const list: [string, string, string, string, string][] = [];
  if (app.can('leitstelle')) d.callouts.filter((c) => c.status === 'offen' && !c.driverId).forEach((c) => list.push(['truck', 'bad', `${calloutLabel(c.number)} ohne Fahrer`, c.location, 'leitstelle']));
  if (app.can('auftraege')) {
    d.orders.filter((o) => o.assigneeId === me && (o.status === 'neu' || o.status === 'arbeit')).forEach((o) => list.push(['wrench', 'acc', `${orderLabel(o.number)} ${o.title}`, o.status === 'neu' ? 'dir zugeteilt, noch nicht begonnen' : `in Arbeit · ${o.progress} %`, 'auftraege']));
    d.orders.filter((o) => !o.assigneeId && o.status !== 'abgeholt').forEach((o) => list.push(['alert', 'warn', `${orderLabel(o.number)} nicht zugeteilt`, o.title, 'auftraege']));
  }
  if (app.can('rechnungen')) d.bills.filter((b) => b.status === 'offen' && b.dueDate && b.dueDate < today()).forEach((b) => list.push(['file', 'bad', `R-${b.number} überfällig`, `${b.title} · ${formatUsd(b.amountCents)}`, 'rechnungen']));
  if (app.can('lager')) lowParts(d.parts).forEach((p) => list.push(['box', p.qty ? 'warn' : 'bad', `${p.name} nachbestellen`, `noch ${p.qty} ${p.unit}`, 'lager']));
  if (mod(d, 'schulungen') && !d.rights.support && !d.rights.areas.schulungen.locked) d.courses.filter((c) => isRequired(c, d.myGroups)).forEach((c) => {
    const [st, tone] = statusOf(c, progressOf(d, c.id, me));
    if (tone !== 'ok') list.push(['book', tone === 'bad' ? 'bad' : 'info', `Pflichtkurs ${c.name}`, st, 'lernen']);
  });
  if (app.can('lohn', 3)) { const n = d.payslips.filter((p) => p.status === 'offen').length; if (n) list.push(['cash', 'warn', `${n} Löhne offen`, 'auszahlen unter Lohn & Provision', 'lohn']); }
  if (app.can('nachrichten')) { const n = d.messages.filter((m) => !m.read).length; if (n) list.push(['chat', 'acc', `${n} neue Kundennachrichten`, 'unter Nachrichten', 'nachrichten']); }
  if (app.can('pinnwand')) d.posts.filter((p) => !p.readByMe).slice(0, 3).forEach((p) => list.push(['pin', 'info', p.poll ? `Umfrage: ${p.title}` : p.title, 'neu auf der Pinnwand', 'pinnwand']));
  if (app.can('regelwerk') && !d.rights.support) d.rules.filter((r) => !r.ackedBy.includes(me)).forEach((r) => list.push(['book', 'warn', `${r.title} bestätigen`, `Version ${r.version}`, 'regelwerk']));
  if (app.can('dienstplan', 3)) { const n = d.absences.filter((a) => a.status === 'beantragt' && a.userId !== me).length; if (n) list.push(['cal', 'warn', `${n} Abwesenheiten zu entscheiden`, 'im Dienstplan', 'dienstplan']); }
  if (app.can('dienstzeiten', 3)) { const n = d.corrections.filter((k) => k.status === 'beantragt' && k.userId !== me).length; if (n) list.push(['clock', 'warn', `${n} Stempel-Nachträge`, 'im Dienstplan genehmigen', 'dienstplan']); }
  const coach = d.courses.filter((c) => app.can('schulungen', 2) || c.trainerId === me);
  const texts = d.progress.filter((p) => p.userId !== me && coach.some((c) => c.id === p.courseId) && pendingOf(p) > 0).length;
  if (texts) list.push(['doc', 'warn', `${texts} Tests mit Freitext bewerten`, 'unter Prüfungen & Termine', 'pruefungen']);
  const prac = d.progress.filter((p) => { const c = coach.find((x) => x.id === p.courseId); return c && c.practical && p.userId !== me && !p.practicalOk && p.score !== null && p.score >= c.passPct && !pendingOf(p); }).length;
  if (prac) list.push(['user', 'info', `${prac} Praxisprüfungen abnehmen`, 'unter Prüfungen & Termine', 'pruefungen']);
  if (app.can('bewerbungen')) { const n = d.applications.filter((a) => a.status === 'neu').length; if (n) list.push(['inbox', 'info', `${n} neue Bewerbungen`, 'unter Bewerbungen', 'bewerbungen']); }
  const soon = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
  if (app.can('werkzeug')) d.tools.filter((t) => t.checkDue && t.checkDue <= soon).forEach((t) => list.push(['wrench', 'warn', `${t.name} prüfen`, `fällig ${formatDate(t.checkDue)}`, 'werkzeug']));
  if (app.can('fuhrpark')) d.fleet.filter((f) => f.serviceDue && f.serviceDue <= soon && f.status !== 'werkstatt').forEach((f) => list.push(['truck', 'warn', `${f.name} zum Service`, `fällig ${formatDate(f.serviceDue)}`, 'fuhrpark']));
  if (app.can('buchungen', 2)) { const n = d.standing.filter((x) => x.active && x.nextDate <= today()).length; if (n) list.push(['clock', 'info', `${n} Daueraufträge fällig`, 'werden automatisch gebucht – oder unter Kasse', 'kasse']); }
  return list;
}

export const WIDGETS: Record<string, WidgetDef> = {
  'kpi-auftraege': { label: 'Aufträge offen', size: 3, ok: (a) => a.can('auftraege'), render: (_, d) => <Kpi label="Aufträge offen" value={d.orders.filter((o) => o.status !== 'abgeholt').length} detail={`${d.orders.filter((o) => o.status === 'fertig').length} fertig zur Abholung`} /> },
  'kpi-einsaetze': { label: 'Einsätze aktiv', size: 3, ok: (a) => a.can('leitstelle'), render: (_, d) => <Kpi label="Einsätze aktiv" value={d.callouts.filter((c) => c.status !== 'erledigt').length} detail={`${d.callouts.filter((c) => c.status === 'offen' && !c.driverId).length} ohne Fahrer`} /> },
  'kpi-kasse': { label: 'Kasse + Konto', size: 3, ok: (a) => a.can('buchungen'), render: (_, d) => <Kpi label="Kasse + Konto" value={formatUsd(sum(d.transactions.map((t) => t.amountCents)))} detail={`heute ${formatUsd(sum(d.transactions.filter((t) => t.bookedAt === today()).map((t) => t.amountCents)))}`} /> },
  'kpi-rechnungen': { label: 'Offene Rechnungen', size: 3, ok: (a) => a.can('rechnungen'), render: (_, d) => <Kpi label="Offene Rechnungen" value={formatUsd(sum(d.bills.filter((b) => b.status === 'offen').map((b) => b.amountCents)))} detail={`${d.bills.filter((b) => b.status === 'offen').length} Rechnungen`} /> },
  todo: {
    label: 'Braucht dich', size: 8, ok: () => true,
    render: (app, d) => {
      const list = todo(app, d);
      return <Card title="Braucht dich">{list.length ? list.slice(0, 10).map(([icon, tone, t, s, page], i) => <div key={i} className="li" data-o onClick={() => app.go(page)}><div className={`ib ${tone}`}><Icon name={icon} /></div><div className="tx"><b>{t}</b><span>{s}</span></div><Icon name="right" size={14} /></div>) : <Empty title="Nichts offen">Alles erledigt.</Empty>}</Card>;
    },
  },
  schnell: {
    label: 'Schnell anlegen', size: 4, ok: () => true,
    render: (app) => {
      const q: [string, string, () => void][] = [];
      if (app.can('auftraege', 2)) q.push(['kanban', 'Auftrag', () => openNewOrder(app)]);
      if (app.can('leitstelle', 2)) q.push(['truck', 'Einsatz', () => app.go('leitstelle')]);
      if (app.can('tuning', 2)) q.push(['sliders', 'Tuning-Angebot', () => app.go('konfigurator')]);
      if (app.can('kunden', 2)) q.push(['folder', 'Kunde', () => openNewCustomer(app)]);
      if (app.can('rechnungen', 2)) q.push(['file', 'Rechnung', () => openNewBill(app)]);
      if (app.can('racing', 2)) q.push(['flag', 'Event', () => app.go('rennkalender')]);
      return <Card title="Schnell anlegen">{q.length ? <div className="g g2" style={{ gap: 8 }}>{q.map(([icon, l, fn]) => <button key={l} className="btn" onClick={fn}><Icon name={icon} size={15} /> {l}</button>)}</div> : <p className="muted small" style={{ margin: 0 }}>Keine Bereiche zum Anlegen.</p>}</Card>;
    },
  },
  dienst: {
    label: 'Im Dienst', size: 4, ok: () => true,
    render: (_, d) => <Card title="Im Dienst">{d.members.filter((m) => m.onDutySince).map((m) => <div key={m.userId} className="li"><div className="tx"><b>{m.displayName}</b><span>{m.rank}</span></div><Pill tone="ok">seit {formatTime(m.onDutySince!)}</Pill></div>)}{!d.members.some((m) => m.onDutySince) && <p className="muted small" style={{ margin: 0 }}>Gerade niemand.</p>}</Card>,
  },
  termine: {
    label: 'Als Nächstes', size: 4, ok: () => true,
    render: (app) => {
      const list = calendarItems(app, false).filter((x) => x.day >= today()).slice(0, 6);
      return <Card title="Als Nächstes" right={<a className="link" href="#kalender">Kalender</a>}>{list.length ? list.map((x, i) => <a key={i} className="li" href={`#${x.page}`} style={{ textDecoration: 'none', color: 'inherit' }}><div className="tx"><b>{x.text}</b><span>{formatDate(x.day)}{x.time ? ` · ${x.time}` : ''}</span></div></a>) : <p className="muted small" style={{ margin: 0 }}>Nichts geplant.</p>}</Card>;
    },
  },
  lager: {
    label: 'Lager-Warnungen', size: 4, ok: (a) => a.can('lager'),
    render: (app, d) => {
      const low = lowParts(d.parts);
      return <Card title="Lager" right={<a className="link" href="#lager">Lager</a>}>{low.length ? low.slice(0, 6).map((p) => <div key={p.id} className="li"><div className={`ib ${p.qty ? 'warn' : 'bad'}`}><Icon name="box" /></div><div className="tx"><b>{p.name}</b><span>noch {p.qty} {p.unit} · min. {p.minQty}</span></div>{app.can('lager', 2) && <button className="btn sm" onClick={() => openMove(app, p, true)}>Zugang</button>}</div>) : <p className="muted small" style={{ margin: 0 }}>Alles auf Lager.</p>}</Card>;
    },
  },
  rennen: {
    label: 'Nächstes Rennen', size: 4, ok: (a) => a.can('racing'),
    render: (_, d) => {
      const e = d.events.find((x) => x.startsAt >= new Date().toISOString() && x.status !== 'abgesagt');
      const n = e ? d.entries.filter((x) => x.eventId === e.id).length : 0;
      return <Card title="Nächstes Rennen" right={<a className="link" href="#rennkalender">Kalender</a>}>{e ? <div><b style={{ fontSize: 17 }}>{e.name}</b><div className="muted small">{formatDate(e.startsAt.slice(0, 10))} · {formatTime(e.startsAt)}{e.track ? ` · ${e.track}` : ''}</div>{e.maxEntries > 0 && <><div className="bar" style={{ marginTop: 9 }}><i style={{ width: `${Math.min(100, (n / e.maxEntries) * 100)}%` }} /></div><div className="small muted" style={{ marginTop: 5 }}>{n} von {e.maxEntries} Startplätzen{e.prizeCents ? ` · Preisgeld ${formatUsd(e.prizeCents)}` : ''}</div></>}</div> : <p className="muted small" style={{ margin: 0 }}>Kein Event geplant.</p>}</Card>;
    },
  },
  bestenliste: {
    label: 'Bestenliste', size: 4, ok: (a) => a.can('racing'),
    render: (_, d) => {
      const list = bestLaps(d, '').slice(0, 5);
      return <Card title="Bestenliste" right={<a className="link" href="#bestenliste">Alle</a>}>{list.length ? list.map((x, i) => <div key={x.id} className="li"><span className={`pos-n ${i === 0 ? 'p1' : ''}`}>{i + 1}</span><div className="tx"><b>{x.driver}</b><span>{x.car}</span></div><span className="mono small">{formatLap(x.lapMs)}</span></div>) : <p className="muted small" style={{ margin: 0 }}>Noch keine Zeiten.</p>}</Card>;
    },
  },
  lernen: {
    label: 'Meine Schulungen', size: 4, ok: (_, d) => mod(d, 'schulungen') && !d.rights.support && !d.rights.areas.schulungen.locked,
    render: (app, d) => {
      const list = d.courses.filter((c) => isRequired(c, d.myGroups) || progressOf(d, c.id, app.me.user.id));
      return <Card title="Meine Schulungen" right={<a className="link" href="#lernen">Lernen</a>}>{list.length ? list.slice(0, 5).map((c) => { const p = progressOf(d, c.id, app.me.user.id); const [st, tone] = statusOf(c, p); return <div key={c.id} className="li"><div className="tx"><b>{c.name}</b><div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${percent(c, p)}%` }} /></div></div><Pill tone={tone}>{st}</Pill></div>; }) : <p className="muted small" style={{ margin: 0 }}>Keine Kurse für dich.</p>}</Card>;
    },
  },
  builds: {
    label: 'Builds', size: 4, ok: (a) => a.can('tuning') && a.can('auftraege'),
    render: (_, d) => {
      const list = d.orders.filter((o) => o.kind === 'tuning' && o.status !== 'abgeholt').slice(0, 4);
      return <Card title="Builds" right={<a className="link" href="#builds">Alle</a>}>{list.length ? list.map((o) => <div key={o.id} className="li"><div className="tx"><b>{o.title}</b><div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${o.progress}%` }} /></div></div><span className="mono small">{o.progress} %</span></div>) : <p className="muted small" style={{ margin: 0 }}>Keine Builds offen.</p>}</Card>;
    },
  },
};

Object.assign(WIDGETS, {
  feed: {
    label: 'Live-Feed', size: 4, ok: () => true,
    render: (app: AppCtx) => <FeedWidget app={app} />,
  },
  hallenplan: {
    label: 'Hallenplan jetzt', size: 4, ok: (a: AppCtx) => a.can('hallenplan'),
    render: (app: AppCtx, d: Data) => {
      const now = new Date().toISOString();
      return <Card title="Hallenplan jetzt" right={<a className="link" href="#hallenplan">Plan</a>}>{d.bays.map((b) => { const bk = d.bookings.find((x) => x.bayId === b.id && x.startsAt <= now && x.endsAt > now); const next = d.bookings.filter((x) => x.bayId === b.id && x.startsAt > now).sort((x, y) => x.startsAt.localeCompare(y.startsAt))[0]; return <div key={b.id} className="li"><div className={`ib ${bk ? 'acc' : 'ok'}`}><Icon name="grid" /></div><div className="tx"><b>{b.name}</b><span>{bk ? `${bk.title} bis ${formatTime(bk.endsAt)}` : next ? `frei bis ${formatTime(next.startsAt)}` : 'frei'}</span></div>{!bk && app.can('hallenplan', 2) && <button className="btn sm" onClick={() => openBooking(app, undefined, { bayId: b.id })}>Buchen</button>}</div>; })}{!d.bays.length && <p className="muted small" style={{ margin: 0 }}>Keine Plätze angelegt.</p>}</Card>;
    },
  },
  pinnwand: {
    label: 'Pinnwand', size: 4, ok: (a: AppCtx) => a.can('pinnwand'),
    render: (_: AppCtx, d: Data) => <Card title="Pinnwand" right={<a className="link" href="#pinnwand">Alle</a>}>{d.posts.slice(0, 4).map((p) => <a key={p.id} className="li" href="#pinnwand" style={{ textDecoration: 'none', color: 'inherit' }}><div className={`ib ${p.readByMe ? '' : 'acc'}`}><Icon name="pin" /></div><div className="tx"><b>{p.title}</b><span>{p.poll ? `Umfrage · ${p.votes.reduce((a, b) => a + b, 0)} Stimmen` : p.body}</span></div></a>)}{!d.posts.length && <p className="muted small" style={{ margin: 0 }}>Nichts angepinnt.</p>}</Card>,
  },
  fuhrpark: {
    label: 'Fuhrpark', size: 4, ok: (a: AppCtx) => a.can('fuhrpark'),
    render: (_: AppCtx, d: Data) => <Card title="Fuhrpark" right={<a className="link" href="#fuhrpark">Alle</a>}>{d.fleet.map((f) => <div key={f.id} className="li"><div className={`ib ${f.status === 'frei' ? 'ok' : f.status === 'werkstatt' ? 'bad' : 'warn'}`}><Icon name="truck" /></div><div className="tx"><b>{f.name}</b><span>{f.status === 'frei' ? 'frei' : f.status === 'werkstatt' ? 'in der Werkstatt' : `im Einsatz`} · Tank {f.fuel} %</span></div></div>)}{!d.fleet.length && <p className="muted small" style={{ margin: 0 }}>Keine Fahrzeuge.</p>}</Card>,
  },
  werkzeug: {
    label: 'Werkzeug ausgegeben', size: 4, ok: (a: AppCtx) => a.can('werkzeug'),
    render: (_: AppCtx, d: Data) => { const out = d.tools.filter((t) => t.status !== 'frei'); return <Card title="Werkzeug" right={<a className="link" href="#werkzeug">Alle</a>}>{out.map((t) => <div key={t.id} className="li"><div className={`ib ${t.status === 'wartung' ? 'bad' : 'warn'}`}><Icon name="wrench" /></div><div className="tx"><b>{t.name}</b><span>{t.status === 'wartung' ? 'in Wartung' : d.members.find((m) => m.userId === t.holderId)?.displayName}</span></div></div>)}{!out.length && <p className="muted small" style={{ margin: 0 }}>Alles an seinem Platz.</p>}</Card>; },
  },
  konten: {
    label: 'Konten', size: 4, ok: (a: AppCtx) => a.can('buchungen'),
    render: (_: AppCtx, d: Data) => <Card title="Konten" right={<a className="link" href="#finanzen">Finanzen</a>}>{ACCOUNTS.map(([k, l]) => <div key={k} className="li"><div className="tx"><b>{l}</b></div><span className="money">{formatUsd(sum(d.transactions.filter((t) => t.account === k).map((t) => t.amountCents)))}</span></div>)}</Card>,
  },
  nachrichten: {
    label: 'Kundennachrichten', size: 4, ok: (a: AppCtx) => a.can('nachrichten'),
    render: (_: AppCtx, d: Data) => { const un = d.messages.filter((m) => !m.read); return <Card title="Kundennachrichten" right={<a className="link" href="#nachrichten">Alle</a>}>{un.slice(-4).reverse().map((m) => <a key={m.id} className="li" href={`#nachrichten/${m.customerId}`} style={{ textDecoration: 'none', color: 'inherit' }}><div className="ib acc"><Icon name="chat" /></div><div className="tx"><b>{d.customers.find((c) => c.id === m.customerId)?.name}</b><span>{m.text}</span></div></a>)}{!un.length && <p className="muted small" style={{ margin: 0 }}>Keine ungelesenen Nachrichten.</p>}</Card>; },
  },
} satisfies Record<string, WidgetDef>);

function FeedWidget({ app }: { app: AppCtx }) {
  const items = useFeed(app);
  return <Card title="Live-Feed" right={<a className="link" href="#feed">Alles</a>}><div className="feed">{(items ?? []).slice(0, 6).map((f) => <FeedLine key={f.id} f={f} />)}{items && !items.length && <p className="muted small" style={{ margin: 0 }}>Noch nichts passiert.</p>}</div></Card>;
}

export const DEFAULT_WIDGETS = ['kpi-auftraege:3', 'kpi-einsaetze:3', 'kpi-kasse:3', 'kpi-rechnungen:3', 'todo:8', 'schnell:4', 'termine:4', 'dienst:4', 'lager:4'];
const parse = (list: string[]) => list.map((x) => { const [id, n] = x.split(':'); return [id, Number(n) || WIDGETS[id]?.size || 4] as [string, number]; }).filter(([id]) => WIDGETS[id]);

function Library({ have, onAdd }: { have: string[]; onAdd: (id: string) => void }) {
  const app = useApp();
  const d = app.data!;
  const free = Object.entries(WIDGETS).filter(([id, w]) => !have.includes(id) && w.ok(app, d));
  return (
    <Modal title="Widget hinzufügen" onClose={() => app.overlay(null)}>
      <div className="pal-res" style={{ padding: 0 }}>
        {free.length ? free.map(([id, w]) => <button key={id} onClick={() => { onAdd(id); app.overlay(null); }}><Icon name="plus" /><span className="grow">{w.label}</span></button>) : <p className="muted small">Alle verfügbaren Widgets sind schon da.</p>}
      </div>
    </Modal>
  );
}

export const DEFAULT_BOARD = ['todo:8', 'schnell:4', 'feed:4'];
const newBoardId = () => `b-${Date.now().toString(36)}`;

/** Neue Arbeitsfläche anlegen und öffnen. */
export async function addBoard(app: AppCtx) {
  const boards = app.me.user.prefs.boards ?? [];
  if (boards.length >= 12) return app.toast('Höchstens 12 Arbeitsflächen', 'bad');
  const b: Board = { id: newBoardId(), name: `Arbeitsfläche ${boards.length + 1}`, widgets: DEFAULT_BOARD };
  await app.setPrefs({ boards: [...boards, b] });
  app.go(b.id);
}

export function Cockpit() {
  return <Workspace id="cockpit" />;
}

export function BoardPage() {
  const app = useApp();
  return <Workspace id={app.page} key={app.page} />;
}

function Workspace({ id }: { id: string }) {
  const app = useApp();
  const d = app.data;
  const [editing, setEditing] = useState(false);
  const boards = app.me.user.prefs.boards ?? [];
  const board = id === 'cockpit' ? null : boards.find((b) => b.id === id);
  if (!d) {
    return (
      <>
        <PageHead eyebrow="Übersicht" title={`Hallo ${app.me.user.displayName.split(' ')[0]}`} />
        <Card>
          <Empty title={app.me.companies.length ? 'Firma wird geladen …' : 'Du bist noch in keiner Firma'}>
            {!app.me.companies.length && <p className="small">Ein Inhaber nimmt dich unter „Mitglieder & Zugänge“ auf{app.me.user.isServerAdmin ? ', oder du legst unter Serververwaltung → Firmen eine an' : ''}.</p>}
          </Empty>
        </Card>
      </>
    );
  }
  if (id !== 'cockpit' && !board) return <Card><Empty title="Diese Arbeitsfläche gibt es nicht mehr" /></Card>;
  const all = parse(board ? board.widgets : (app.me.user.prefs.widgets ?? DEFAULT_WIDGETS));
  const shown = all.filter(([w]) => WIDGETS[w].ok(app, d));
  const save = (next: [string, number][]) => {
    const list = next.map(([w, n]) => `${w}:${n}`);
    void app.setPrefs(board ? { boards: boards.map((b) => (b.id === board.id ? { ...b, widgets: list } : b)) } : { widgets: list });
  };
  const rename = (name: string) => board && name.trim() && name !== board.name && void app.setPrefs({ boards: boards.map((b) => (b.id === board.id ? { ...b, name: name.trim().slice(0, 40) } : b)) });
  const move = (i: number, dir: -1 | 1) => {
    const a = shown.slice();
    const j = i + dir;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]];
    save([...a, ...all.filter(([w]) => !a.some(([x]) => x === w))]);
  };
  const resize = (i: number) => save(shown.map(([w, n], k) => [w, k === i ? (SIZES.find((x) => x > n) ?? SIZES[0]) : n]));
  const remove = (i: number) => save(all.filter(([w]) => w !== shown[i][0]));
  return (
    <>
      <PageHead eyebrow={board ? 'Arbeitsfläche' : d.company.name} title={board ? board.name : 'Cockpit'} sub={`${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })} · ${d.members.filter((m) => m.onDutySince).length} im Dienst`}>
        {editing && board && <input className="bname" aria-label="Name der Arbeitsfläche" defaultValue={board.name} onBlur={(e) => rename(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />}
        {editing && board && <button className="btn ghost" onClick={() => { void app.setPrefs({ boards: boards.filter((b) => b.id !== board.id) }); app.go('cockpit'); app.toast('Arbeitsfläche gelöscht'); }}>Löschen</button>}
        {editing && <button className="btn ghost" onClick={() => save(parse(board ? DEFAULT_BOARD : DEFAULT_WIDGETS))}>Standard</button>}
        {!editing && !board && <button className="btn" onClick={() => void addBoard(app)}><Icon name="plus" size={15} /> Arbeitsfläche</button>}
        <button className={`btn ${editing ? 'pri' : ''}`} onClick={() => { setEditing(!editing); if (editing) app.toast('Arbeitsfläche gespeichert'); }}>
          <Icon name={editing ? 'check' : 'grid'} size={15} /> {editing ? 'Fertig' : 'Anpassen'}
        </button>
      </PageHead>
      <div className={`wgrid ${editing ? 'editing' : ''}`}>
        {shown.map(([wid, n], i) => (
          <div key={wid} className={`w s${n}`}>
            {editing && (
              <div className="wbar">
                <span className="grip">{WIDGETS[wid].label}</span>
                <span className="sp2" />
                <button onClick={() => move(i, -1)} aria-label="Nach links">←</button>
                <button onClick={() => move(i, 1)} aria-label="Nach rechts">→</button>
                <button onClick={() => resize(i)} aria-label="Größe ändern" title="Größe ändern">{n}/12</button>
                <button onClick={() => remove(i)} aria-label="Entfernen">×</button>
              </div>
            )}
            {WIDGETS[wid].render(app, d)}
          </div>
        ))}
        {editing && (
          <button className="wadd s4" onClick={() => app.overlay(<Library have={all.map(([w]) => w)} onAdd={(w) => save([...all, [w, WIDGETS[w].size]])} />)}>
            <Icon name="plus" size={22} /> Widget hinzufügen
          </button>
        )}
      </div>
    </>
  );
}
