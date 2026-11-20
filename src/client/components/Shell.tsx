// Rahmen: Seitenleiste (nach Rechten gefiltert), Kopfzeile mit Stempeluhr, Inhalt, Leiste unten auf dem Handy.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { formatMinutes } from '../../shared/format';
import { api } from '../lib/api';
import { useApp, type AppCtx } from '../lib/app';
import { Icon } from '../lib/icons';
import { boardList, pageById, PAGES, type PageDef } from '../lib/nav';
import { readLocal, writeLocal } from '../lib/storage';
import { KalenderPage } from './pages/Calendar';
import { LagerPage } from './pages/Lager';
import { DienstplanPage, LohnPage } from './pages/Plan';
import { BestenlistePage, RennkalenderPage } from './pages/Racing';
import { KursePage, LernenPage, NachweisePage, PruefungenPage } from './pages/Training';
import { BuildsPage, KonfiguratorPage, PaketePage, PruefstandPage } from './pages/Tuning';
import { addBoard, BoardPage, Cockpit, todo } from './pages/Cockpit';
import { EinsaetzePage, FuhrparkPage } from './pages/Abschlepp';
import { FeedPage, PinnwandPage, PreislistePage, RegelwerkPage } from './pages/Firma';
import { NachrichtenPage, VertraegePage } from './pages/Kunden';
import { AuswertungPage, FinanzenPage, KassePage } from './pages/Money';
import { BewerbungenPage, RaengePage } from './pages/People';
import { TeamPage, TelemetriePage, TrackdaysPage } from './pages/RacingTeam';
import { AnnahmePage, HallenplanPage, WerkzeugPage } from './pages/Werkstatt';
import { openNewBill } from './pages/Finance';
import { openNewCustomer, VehicleDrawer, CustomerDrawer } from './pages/Customers';
import { openNewOrder } from './pages/Orders';
import { calloutLabel, orderLabel, billLabel } from '../../shared/format';
import { CompanyPage, GroupsPage, MembersPage, ModulesPage, AuditPage } from './pages/Company';
import { CustomersPage, VehiclesPage } from './pages/Customers';
import { BillsPage, TransactionsPage } from './pages/Finance';
import { Leitstelle } from './pages/Leitstelle';
import { OrdersPage } from './pages/Orders';
import { AccountPage, AppearancePage, NewsPage } from './pages/Personal';
import { ServerAccounts, ServerBackups, ServerCompanies, ServerExport, ServerIntegrations, ServerLog, ServerOverview, ServerSettingsPage } from './pages/Server';
import { DutyPage, StaffPage } from './pages/Staff';
import { Avatar, Empty, Modal, Pill } from './ui';

const VIEWS: Record<string, () => ReactNode> = {
  cockpit: Cockpit, auftraege: OrdersPage, leitstelle: Leitstelle, kunden: CustomersPage, fahrzeuge: VehiclesPage,
  mitarbeiter: StaffPage, dienstzeiten: DutyPage, rechnungen: BillsPage, buchungen: TransactionsPage,
  kalender: KalenderPage, lager: LagerPage, dienstplan: DienstplanPage, lohn: LohnPage, lernen: LernenPage, kurse: KursePage, nachweise: NachweisePage,
  konfigurator: KonfiguratorPage, builds: BuildsPage, pruefstand: PruefstandPage, pakete: PaketePage, rennkalender: RennkalenderPage, bestenliste: BestenlistePage,
  firma: CompanyPage, zugaenge: MembersPage, gruppen: GroupsPage, module: ModulesPage, protokoll: AuditPage,
  konto: AccountPage, darstellung: AppearancePage, neuigkeiten: NewsPage,
  srv: ServerOverview, 'srv-firmen': ServerCompanies, 'srv-konten': ServerAccounts, 'srv-backup': ServerBackups, 'srv-export': ServerExport, 'srv-log': ServerLog,
  feed: FeedPage, annahme: AnnahmePage, hallenplan: HallenplanPage, werkzeug: WerkzeugPage, einsaetze: EinsaetzePage, fuhrpark: FuhrparkPage,
  team: TeamPage, telemetrie: TelemetriePage, trackdays: TrackdaysPage, vertraege: VertraegePage, nachrichten: NachrichtenPage,
  raenge: RaengePage, bewerbungen: BewerbungenPage, pruefungen: PruefungenPage, finanzen: FinanzenPage, kasse: KassePage, auswertung: AuswertungPage,
  preisliste: PreislistePage, regelwerk: RegelwerkPage, pinnwand: PinnwandPage, 'srv-anbind': ServerIntegrations, 'srv-einst': ServerSettingsPage,
};


export function visible(app: AppCtx, p: PageDef): boolean {
  if (p.server) return app.me.user.isServerAdmin;
  if (p.personal) return true;
  if (!app.data) return p.id === 'cockpit';
  if (p.group === 'Arbeitsflächen') return true;
  if (p.module && !app.data.company.modules.includes(p.module)) return false;
  // Mein Lernen und Prüfungstermine brauchen kein Recht, sind aber zu, wenn eine Gruppe Schulungen sperrt.
  if (p.id === 'lernen' || p.id === 'pruefungen') return !app.data.rights.areas.schulungen.locked && !app.data.rights.support;
  return !p.area || app.can(p.area, p.write ? 2 : 1);
}

function Switcher() {
  const app = useApp();
  return (
    <Modal title="Wechseln" onClose={() => app.overlay(null)}>
      <div className="pal-res" style={{ padding: 0 }}>
        <div className="gl">Meine Firmen</div>
        {app.me.companies.length === 0 && <p className="muted small">Du bist noch in keiner Firma. Ein Server-Admin oder ein Inhaber nimmt dich auf.</p>}
        {app.me.companies.map((c) => (
          <button key={c.id} onClick={() => { app.overlay(null); app.switchCompany(c.id); if (pageById(app.page)?.server) app.go('cockpit'); }}>
            <Icon name="building" />
            <span className="grow">{c.name}</span>
            {c.id === app.companyId && !pageById(app.page)?.server && <Pill tone="ok" dot={false}>aktuell</Pill>}
            {c.status === 'paused' && <Pill tone="warn" dot={false}>pausiert</Pill>}
          </button>
        ))}
        {app.me.user.isServerAdmin && (
          <>
            <div className="gl">Server</div>
            <button onClick={() => { app.overlay(null); app.go('srv'); }}>
              <Icon name="server" />
              <span className="grow">Serververwaltung</span>
              <Pill tone="warn" dot={false}>Server-Admin</Pill>
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}

function Clock() {
  const app = useApp();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!app.data || app.data.rights.support) return null;
  const open = app.data.duty.find((d) => d.userId === app.me.user.id && !d.endedAt);
  const min = open ? Math.max(0, now - new Date(open.startedAt).getTime()) / 60000 : 0;
  return (
    <div className={`clock ${open ? 'on' : ''}`}>
      <span className="dot" />
      <span className="t">{open ? `Im Dienst · ${formatMinutes(min)}` : 'Nicht im Dienst'}</span>
      <button onClick={() => app.act(() => api.post(app.c(open ? '/duty/stop' : '/duty/start')), open ? 'Dienst beendet' : 'Dienst begonnen')}>
        {open ? 'Dienst beenden' : 'Dienst beginnen'}
      </button>
    </div>
  );
}

/** Suche (Strg+K): Seiten, Kunden, Fahrzeuge mit Kennzeichen-Abgleich, Aufträge, Einsätze, Rechnungen, Leute. */
function Search() {
  const app = useApp();
  const d = app.data;
  const [q, setQ] = useState('');
  const s = q.trim().toLowerCase();
  const flat = s.replace(/\s/g, '');
  const pages = [...PAGES, ...boardList()].filter((p) => visible(app, p) && (!s || `${p.label} ${p.group}`.toLowerCase().includes(s))).slice(0, s ? 6 : 8);
  const hit = (t: string) => t.toLowerCase().includes(s);
  const vehicles = d && s && app.can('fahrzeuge') ? d.vehicles.filter((v) => v.plate.toLowerCase().replace(/\s/g, '').includes(flat) || hit(v.model)).slice(0, 6) : [];
  const customers = d && s && app.can('kunden') ? d.customers.filter((c) => hit(c.name) || c.phone.includes(s)).slice(0, 5) : [];
  const orders = d && s && app.can('auftraege') ? d.orders.filter((o) => hit(`${orderLabel(o.number)} ${o.title}`)).slice(0, 5) : [];
  const callouts = d && s && app.can('leitstelle') ? d.callouts.filter((c) => hit(`${calloutLabel(c.number)} ${c.location} ${c.requester}`)).slice(0, 4) : [];
  const bills = d && s && app.can('rechnungen') ? d.bills.filter((b) => hit(`${billLabel(b.number)} ${b.title}`)).slice(0, 4) : [];
  const people = d && s ? d.members.filter((m) => hit(m.displayName)).slice(0, 4) : [];
  const plateLike = /^[a-z0-9 -]{2,10}$/i.test(q.trim()) && app.can('fahrzeuge');
  const exact = d?.vehicles.find((v) => v.plate.toLowerCase().replace(/\s/g, '') === flat);
  const go = (fn: () => void) => { app.overlay(null); fn(); };
  return (
    <>
      <div className="scrim" onClick={() => app.overlay(null)} />
      <div className="modal" role="dialog" aria-label="Suche" onKeyDown={(e) => e.key === 'Escape' && app.overlay(null)}>
        <div className="pal-in"><Icon name="search" /><input autoFocus placeholder="Suchen oder Kennzeichen prüfen …" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Suchbegriff" /><kbd className="mono small">Esc</kbd></div>
        <div className="pal-res">
          {plateLike && s.length >= 2 && (
            exact?.stolen ? <div className="alert" style={{ margin: 6 }}><Icon name="alert" /><div><b>{exact.plate} ist als gestohlen gemeldet.</b> Nicht herausgeben, Leitung informieren.</div></div>
              : exact ? <div className="alert ok" style={{ margin: 6 }}><Icon name="check" /><div><b>{exact.plate}</b>: {exact.model || 'bekannt'} · nicht gestohlen gemeldet.</div></div>
                : vehicles.length === 0 ? <div className="alert info" style={{ margin: 6 }}><Icon name="car" /><div>Kennzeichen „{q.trim().toUpperCase()}“ ist bei uns unbekannt und nicht als gestohlen gemeldet.</div></div> : null
          )}
          {vehicles.length > 0 && <div className="gl">Fahrzeuge</div>}
          {vehicles.map((v) => <button key={v.id} onClick={() => go(() => app.overlay(<VehicleDrawer v={v} />))}><span className="plate">{v.plate}</span><span className="grow">{v.model}</span>{v.stolen && <Pill tone="bad">gestohlen</Pill>}</button>)}
          {customers.length > 0 && <div className="gl">Kunden</div>}
          {customers.map((c) => <button key={c.id} onClick={() => go(() => app.overlay(<CustomerDrawer c={c} />))}><Icon name="folder" /><span className="grow">{c.name}</span>{c.blocked && <Pill tone="bad">gesperrt</Pill>}</button>)}
          {orders.length > 0 && <div className="gl">Aufträge</div>}
          {orders.map((o) => <button key={o.id} onClick={() => go(() => app.go('auftraege'))}><Icon name="kanban" /><span className="grow">{orderLabel(o.number)} {o.title}</span><span className="small muted">{o.status}</span></button>)}
          {callouts.length > 0 && <div className="gl">Einsätze</div>}
          {callouts.map((c) => <button key={c.id} onClick={() => go(() => app.go('leitstelle', c.id))}><Icon name="truck" /><span className="grow">{calloutLabel(c.number)} {c.location}</span><span className="small muted">{c.status}</span></button>)}
          {bills.length > 0 && <div className="gl">Rechnungen</div>}
          {bills.map((b) => <button key={b.id} onClick={() => go(() => app.go('rechnungen'))}><Icon name="file" /><span className="grow">{billLabel(b.number)} {b.title}</span><span className="small muted">{b.status}</span></button>)}
          {people.length > 0 && <div className="gl">Leute</div>}
          {people.map((m) => <button key={m.userId} onClick={() => go(() => app.go(app.can('mitarbeiter') ? 'mitarbeiter' : 'cockpit'))}><Avatar name={m.displayName} size={22} /><span className="grow">{m.displayName}</span><span className="small muted">{m.rank}</span></button>)}
          {pages.length > 0 && <div className="gl">Seiten</div>}
          {pages.map((p) => <button key={p.id} onClick={() => go(() => app.go(p.id))}><Icon name={p.icon} /><span className="grow">{p.label}</span><span className="small muted">{p.group}</span></button>)}
          {s && !pages.length && !vehicles.length && !customers.length && !orders.length && !callouts.length && !bills.length && !people.length && !plateLike && <p className="muted small" style={{ padding: 10 }}>Nichts gefunden.</p>}
        </div>
      </div>
    </>
  );
}

function Bell() {
  const app = useApp();
  if (!app.data) return null;
  const list = todo(app, app.data);
  return (
    <button className="ibtn" aria-label={`Meldungen (${list.length})`} title="Meldungen" onClick={() => app.overlay(
      <Modal title={`Meldungen (${list.length})`} onClose={() => app.overlay(null)}>
        <div className="pal-res" style={{ padding: 0, maxHeight: '60vh' }}>
          {list.map(([icon, tone, t, sub, page], i) => <button key={i} onClick={() => { app.overlay(null); app.go(page); }}><span className={`ib ${tone}`}><Icon name={icon} /></span><span className="grow"><b style={{ display: 'block' }}>{t}</b><span className="small muted">{sub}</span></span><Icon name="right" size={14} /></button>)}
          {!list.length && <p className="muted small" style={{ margin: 0 }}>Nichts offen. Alles erledigt.</p>}
        </div>
      </Modal>,
    )}>
      <Icon name="bell" />{list.length > 0 && <span className="pip" />}
    </button>
  );
}

function NewMenu() {
  const app = useApp();
  const tiles: [string, string, string, () => void][] = [];
  if (app.can('auftraege', 2)) tiles.push(['clip', 'Fahrzeug annehmen', 'Annahme mit Zustand und Auftrag', () => app.go('annahme')]);
  if (app.can('auftraege', 2)) tiles.push(['kanban', 'Auftrag', 'direkt auf die Tafel', () => openNewOrder(app)]);
  if (app.can('leitstelle', 2)) tiles.push(['truck', 'Einsatz', 'in der Leitstelle', () => app.go('leitstelle')]);
  if (app.can('kunden', 2)) tiles.push(['folder', 'Kunde', 'neue Kundenakte', () => openNewCustomer(app)]);
  if (app.can('rechnungen', 2)) tiles.push(['file', 'Rechnung', 'oder Angebot', () => openNewBill(app)]);
  if (app.can('tuning', 2)) tiles.push(['sliders', 'Tuning-Angebot', 'im Konfigurator', () => app.go('konfigurator')]);
  if (app.can('racing', 2)) tiles.push(['flag', 'Event', 'im Rennkalender', () => app.go('rennkalender')]);
  if (app.can('pinnwand', 2)) tiles.push(['pin', 'Beitrag', 'auf der Pinnwand', () => app.go('pinnwand')]);
  return (
    <Modal title="Neu" onClose={() => app.overlay(null)}>
      <div className="tiles" style={{ padding: 0 }}>
        {tiles.map(([icon, t, sub, fn]) => <button key={t} onClick={() => { app.overlay(null); fn(); }}><span className="ib acc"><Icon name={icon} /></span><span><b>{t}</b><span>{sub}</span></span></button>)}
        {!tiles.length && <p className="muted small">Du darfst hier nichts anlegen.</p>}
      </div>
    </Modal>
  );
}

/**
 * Tabs wie im Mockup: Klick in der Seitenleiste ersetzt den aktiven Tab, Doppelklick öffnet die Seite in einem neuen Tab.
 * Ein Tab lässt sich „daneben“ öffnen (zwei Seiten nebeneinander). Gespeichert pro Gerät.
 */
function useTabs(cur: string) {
  const [tabs, setTabs] = useState<string[]>(() => readLocal<string[]>('pitstop.tabs', [cur]).filter((t) => pageById(t)));
  const [split, setSplit] = useState<string | null>(null);
  const last = useRef<{ at: number; prev: string; page: string; time: number } | null>(null);
  const atRef = useRef(Math.max(0, tabs.indexOf(cur)));
  /** Doppelklick kam vor dem Seitenwechsel des ersten Klicks an: beim Wechsel neuen Tab anlegen statt ersetzen. */
  const pending = useRef<{ page: string; time: number } | null>(null);
  useEffect(() => {
    const p = pending.current;
    pending.current = null;
    setTabs((t) => {
      let next = t.length ? t.slice() : [cur];
      if (next.includes(cur)) atRef.current = next.indexOf(cur);
      else if (p && p.page === cur && Date.now() - p.time < 1500) {
        next.push(cur);
        atRef.current = next.length - 1;
      } else {
        const at = Math.min(atRef.current, next.length - 1);
        last.current = { at, prev: next[at], page: cur, time: Date.now() };
        next[at] = cur;
      }
      next = next.slice(0, 12);
      writeLocal('pitstop.tabs', next);
      return next;
    });
    setSplit((s) => (s === cur ? null : s));
  }, [cur]);
  /** Doppelklick: den eben ersetzten Tab zurückholen und die Seite als neuen Tab anhängen. */
  const openNew = (page: string) => {
    const l = last.current;
    if (!(l && l.page === page && Date.now() - l.time < 1500)) {
      if (page !== cur) pending.current = { page, time: Date.now() };
      return;
    }
    setTabs((t) => {
      const next = t.slice();
      if (l && l.page === page && Date.now() - l.time < 1500 && next[l.at] === page && !next.includes(l.prev)) {
        next[l.at] = l.prev;
        next.push(page);
        atRef.current = next.length - 1;
      }
      writeLocal('pitstop.tabs', next);
      return next;
    });
    last.current = null;
  };
  const close = (id: string, go: (p: string) => void) => {
    setTabs((t) => {
      const i = t.indexOf(id);
      const next = t.filter((x) => x !== id);
      if (!next.length) next.push('cockpit');
      writeLocal('pitstop.tabs', next);
      if (id === cur) go(next[Math.max(0, i - 1)]);
      return next;
    });
    if (split === id) setSplit(null);
  };
  return { tabs, split, setSplit, openNew, close };
}

export function Shell() {
  const app = useApp();
  const cur = pageById(app.page) ?? PAGES[0];
  const serverArea = !!cur.server;
  const allowed = visible(app, cur);
  const allPages = [...PAGES, ...boardList()];
  const groups = [...new Set(['Übersicht', 'Arbeitsflächen', ...PAGES.map((p) => p.group)])].filter((g) => (serverArea ? g === 'Server' || g === 'Persönlich' : g !== 'Server'));
  const company = app.me.companies.find((c) => c.id === app.companyId);
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const View = VIEWS[cur.id] ?? BoardPage;
  const tabs = useTabs(cur.id);
  const splitPage = tabs.split ? pageById(tabs.split) : undefined;
  const SplitView = splitPage && visible(app, splitPage) ? (VIEWS[splitPage.id] ?? BoardPage) : null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        app.overlay(<Search />);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [app]);

  useEffect(() => {
    document.documentElement.dataset.area = serverArea ? 'server' : 'firma';
    document.title = `${cur.label} · Pitstop`;
  }, [serverArea, cur]);

  const logout = async () => {
    await api.post('/auth/logout').catch(() => undefined);
    window.location.hash = '';
    window.location.reload();
  };

  const tabbar = PAGES.filter((p) => ['cockpit', 'auftraege', 'leitstelle', 'kunden'].includes(p.id) && visible(app, p));

  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <div className="mark" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17h4l3-9 4 12 3-7h4" /></svg>
          </div>
          <div>
            <b>Pitstop</b>
            <span>Werkstatt-OS</span>
          </div>
        </div>
        <button className="ws" onClick={() => app.overlay(<Switcher />)} aria-label="Firma oder Serververwaltung wechseln">
          <i />
          <b>{serverArea ? 'Serververwaltung' : (company?.name ?? 'Keine Firma')}</b>
          <em><Icon name="swap" size={13} /></em>
        </button>
        <nav className="nav" aria-label="Bereiche">
          {groups.map((g) => {
            const items = allPages.filter((p) => p.group === g && visible(app, p));
            if (g === 'Arbeitsflächen' && app.data && !app.data.rights.support) {
              return (
                <div key={g} className="grp">
                  <div className="grp-h"><span>{g}</span></div>
                  <div className="grp-b">
                    {items.map((p) => <a key={p.id} href={`#${p.id}`} className={p.id === cur.id ? 'on' : ''} onDoubleClick={() => tabs.openNew(p.id)} title={`${p.label} (Doppelklick: neuer Tab)`}><Icon name="grid" size={18} /><span>{p.label}</span></a>)}
                    <button className="add" onClick={() => void addBoard(app)} title="Neue Arbeitsfläche"><Icon name="plus" size={16} /><span>Arbeitsfläche</span></button>
                  </div>
                </div>
              );
            }
            if (!items.length) return null;
            const isClosed = closed.has(g) && !items.some((p) => p.id === cur.id);
            return (
              <div key={g} className={`grp ${isClosed ? 'closed' : ''}`}>
                <button className="grp-h" aria-expanded={!isClosed} onClick={() => setClosed((s) => { const n = new Set(s); if (n.has(g)) n.delete(g); else n.add(g); return n; })}>
                  <span>{g}</span>
                  <span className="chev"><Icon name="chev" size={14} /></span>
                </button>
                <div className="grp-b">
                  {items.map((p) => (
                    <a key={p.id} href={`#${p.id}`} className={p.id === cur.id ? 'on' : ''} aria-current={p.id === cur.id ? 'page' : undefined} title={`${p.label} (Doppelklick: neuer Tab)`} onDoubleClick={() => tabs.openNew(p.id)}>
                      <Icon name={p.icon} size={18} />
                      <span>{p.label}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className="who grow">
            <Avatar name={app.me.user.displayName} size={32} />
            <div>
              <b>{app.me.user.displayName}</b>
              <span>{app.me.user.isServerAdmin ? 'Server-Admin' : app.data?.rights.owner ? 'Inhaber' : 'Mitglied'}</span>
            </div>
          </div>
          <button className="ibtn" onClick={logout} aria-label="Abmelden" title="Abmelden">
            <Icon name="right" />
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="top">
          <div className="crumb">
            <span>{cur.group}</span>
            <Icon name="right" size={12} />
            <b>{cur.label}</b>
          </div>
          {app.me.demoMode && <span className="pill warn" style={{ marginLeft: 8 }}>Demo</span>}
          <div className="wtabs" aria-label="Geöffnete Seiten">
            {tabs.tabs.length > 1 && tabs.tabs.map((id) => {
              const p = pageById(id)!;
              return (
                <div key={id} className={`wt ${id === cur.id ? 'on' : ''} ${id === tabs.split ? 'sp' : ''}`}>
                  <a href={`#${id}`}><Icon name={p.icon} size={14} /><span>{p.label}</span></a>
                  {id !== cur.id && id !== tabs.split && <button onClick={() => tabs.setSplit(id)} title="Daneben öffnen" aria-label={`${p.label} daneben öffnen`}><Icon name="columns" size={13} /></button>}
                  <button onClick={() => tabs.close(id, app.go)} title="Tab schließen" aria-label={`Tab ${p.label} schließen`}><Icon name="x" size={13} /></button>
                </div>
              );
            })}
            {tabs.tabs.length === 1 && <span className="wt-hint">Doppelklick in der Seitenleiste öffnet einen neuen Tab</span>}
          </div>
          <div className="r" style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="ibtn" onClick={() => app.overlay(<Search />)} aria-label="Suchen (Strg+K)" title="Suchen (Strg+K)"><Icon name="search" /></button>
            {!serverArea && <Clock />}
            {!serverArea && <Bell />}
            {!serverArea && app.data && !app.data.rights.support && <button className="btn pri" onClick={() => app.overlay(<NewMenu />)} aria-label="Neu anlegen"><Icon name="plus" size={15} /><span className="hide-sm">Neu</span></button>}
            <button className="ibtn hide-sm" onClick={() => app.go('darstellung')} aria-label="Darstellung" title="Darstellung">
              <Icon name="palette" />
            </button>
          </div>
        </header>
        <main className="content" id="view">
          {app.viewAs && !serverArea && (
            <div className="vabar">
              <Icon name="eye" />
              <span className="grow">Vorschau als <b>{app.viewAs.name}</b>: Navigation und Knöpfe wie bei dieser Person, ändern ist gesperrt. Die Inhalte siehst du weiter mit deinen eigenen Rechten.</span>
              <button className="btn sm" onClick={() => void app.setViewAs(null)}>Vorschau beenden</button>
            </div>
          )}
          {app.data?.rights.support && !serverArea && !cur.personal && (
            <div className="alert info" style={{ marginBottom: 16 }}>
              <Icon name="eye" />
              <div><b>Support-Zugriff:</b> Du siehst diese Firma als Server-Admin nur lesend. Jeder Zugriff steht im Protokoll der Firma.</div>
            </div>
          )}
          {allowed && SplitView ? (
            <div className="panes">
              <div className="pane"><View key={`${cur.id}-${app.companyId}`} /></div>
              <div className="pane">
                <div className="pane-h">
                  <Icon name="columns" size={14} /> Daneben: {splitPage!.label}
                  <span className="r">
                    <button className="btn sm ghost" onClick={() => { const s2 = tabs.split!; tabs.setSplit(cur.id); app.go(s2); }}>Tauschen</button>
                    <button className="btn sm ghost" onClick={() => tabs.setSplit(null)} aria-label="Ansicht daneben schließen"><Icon name="x" size={13} /></button>
                  </span>
                </div>
                <SplitView key={`split-${splitPage!.id}-${app.companyId}`} />
              </div>
            </div>
          ) : allowed ? (
            <View key={`${cur.id}-${app.companyId}`} />
          ) : !app.data && !cur.server && !cur.personal && app.companyId ? (
            <Empty title="Lädt …" />
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '56px 20px' }}>
              <div className="ib bad" style={{ margin: '0 auto 14px', width: 48, height: 48 }}><Icon name="lock" size={22} /></div>
              <h2 style={{ fontFamily: 'var(--font-display)', margin: '0 0 6px' }}>Kein Zugriff auf „{cur.label}“</h2>
              <p className="muted" style={{ margin: 0 }}>
                {cur.area && app.data?.rights.areas[cur.area].locked ? `Gesperrt durch: ${app.data.rights.areas[cur.area].source}` : cur.server ? 'Nur für Server-Admins.' : 'Keine deiner Gruppen erlaubt diesen Bereich.'}
              </p>
            </div>
          )}
        </main>
      </div>

      <nav className="tabbar" style={{ gridTemplateColumns: `repeat(${tabbar.length + 1}, minmax(0, 1fr))` }}>
        {tabbar.map((p) => (
          <a key={p.id} href={`#${p.id}`} className={cur.id === p.id ? 'on' : ''}>
            <Icon name={p.icon} size={21} />
            {p.label.split(' ')[0]}
          </a>
        ))}
        <button onClick={() => app.overlay(<AllPages />)} className={tabbar.some((t) => t.id === cur.id) ? '' : 'on'}>
          <Icon name="menu" size={21} />
          Alle
        </button>
      </nav>
    </div>
  );
}

function AllPages() {
  const app = useApp();
  const all = [...PAGES, ...boardList()];
  const groups = [...new Set(all.map((p) => p.group))];
  return (
    <Modal title="Alle Bereiche" onClose={() => app.overlay(null)}>
      <div className="pal-res" style={{ padding: 0 }}>
        <button onClick={() => app.overlay(<Switcher />)}>
          <Icon name="swap" />
          <span>Firma wechseln oder Serververwaltung</span>
        </button>
        {groups.map((g) => {
          const items = all.filter((p) => p.group === g && visible(app, p));
          return items.length ? (
            <div key={g}>
              <div className="gl">{g}</div>
              {items.map((p) => (
                <button key={p.id} onClick={() => { app.overlay(null); app.go(p.id); }}>
                  <Icon name={p.icon} />
                  <span>{p.label}</span>
                </button>
              ))}
            </div>
          ) : null;
        })}
      </div>
    </Modal>
  );
}
