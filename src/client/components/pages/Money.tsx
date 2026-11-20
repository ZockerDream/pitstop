// Finanzen ab 0.4: Übersicht (Konten, Wochenverlauf, Herkunft, Ziele), Kasse (Tagesabschluss, Daueraufträge, Trinkgeld, Umbuchung), Auswertung.
import { useEffect, useState } from 'react';
import { billLabel, formatDate, formatTime, formatUsd } from '../../../shared/format';
import { ACCOUNTS, type Account, type Goal, type StandingOrder, type Transaction } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Empty, FormModal, Kpi, Modal, PageHead, Seg, Table } from '../ui';
import { customerName, memberName, sum } from './helpers';

type Data = NonNullable<AppCtx['data']>;
const DAY = 86_400_000;
export const accountLabel = (a: string) => ACCOUNTS.find((x) => x[0] === a)?.[1] ?? a;
const balance = (d: Data, a: Account) => sum(d.transactions.filter((t) => t.account === a).map((t) => t.amountCents));
/** Umbuchungen zählen weder als Einnahme noch als Ausgabe. */
const real = (t: Transaction) => t.category !== 'Umbuchung';
const isoDay = (t: number) => new Date(t - new Date(t).getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const mondayOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

/** Woher eine Einnahme kommt: bezahlte Rechnung → Art des Auftrags / Einsatz, sonst Kategorie. */
function sourceOf(d: Data, t: Transaction): string {
  const b = t.billId ? d.bills.find((x) => x.id === t.billId) : undefined;
  if (b?.calloutId) return 'Abschleppdienst';
  const o = b?.orderId ? d.orders.find((x) => x.id === b.orderId) : undefined;
  if (o) return { werkstatt: 'Werkstatt', karosserie: 'Werkstatt', tuning: 'Tuning', racing: 'Racing' }[o.kind];
  if (b && /trackday/i.test(b.title)) return 'Racing';
  if (t.category === 'Racing') return 'Racing';
  return b ? 'Sonstige Rechnungen' : t.category;
}

function Bars({ rows, labels }: { rows: [string, number, number | null][]; labels: [string, string] }) {
  const W = 640, H = 200, L = 48, B = 24;
  const max = Math.max(1, ...rows.flatMap(([, a, b]) => [Math.abs(a), Math.abs(b ?? 0)]));
  const neg = rows.some(([, a]) => a < 0);
  const zero = neg ? (H - B) / 2 + 6 : H - B;
  const scale = (v: number) => (v / max) * (neg ? (H - B) / 2 - 10 : H - B - 14);
  const bw = (W - L - 10) / rows.length;
  const two = rows.some(([, , b]) => b !== null);
  return (
    <div style={{ overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: 420, height: 'auto', display: 'block' }} role="img" aria-label={`${labels.join(' und ')} je Woche`}>
        <line x1={L} x2={W - 10} y1={zero} y2={zero} stroke="var(--line-2)" />
        <text x={L - 6} y={zero - scale(max) + 4} textAnchor="end" fontSize="10.5" fill="var(--dim)" fontFamily="JetBrains Mono Variable, monospace">{formatUsd(max * 100).replace(',00', '')}</text>
        {rows.map(([l, a, b], i) => {
          const x = L + i * bw + 6;
          const w = two ? (bw - 14) / 2 : bw - 12;
          return (
            <g key={l}>
              <rect x={x} y={a >= 0 ? zero - scale(a) : zero} width={w} height={Math.abs(scale(a))} rx="3" fill={a >= 0 ? 'var(--accent)' : 'var(--bad)'}><title>{`${l}: ${formatUsd(a * 100)}`}</title></rect>
              {b !== null && <rect x={x + w + 2} y={zero - scale(b)} width={w} height={scale(b)} rx="3" fill="var(--dim)"><title>{`${l}: ${formatUsd(b * 100)}`}</title></rect>}
              <text x={x + (two ? w + 1 : w / 2)} y={H - 6} textAnchor="middle" fontSize="10.5" fill="var(--muted)" fontFamily="JetBrains Mono Variable, monospace">{l}</text>
            </g>
          );
        })}
      </svg>
      <div className="row small muted" style={{ gap: 14 }}><span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 8, background: 'var(--accent)', borderRadius: 2 }} />{labels[0]}</span>{two && <span className="row" style={{ gap: 6 }}><i style={{ width: 12, height: 8, background: 'var(--dim)', borderRadius: 2 }} />{labels[1]}</span>}</div>
    </div>
  );
}

function Ring({ pct, label, sub }: { pct: number; label: string; sub: string }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <div className="row" style={{ gap: 14 }}>
      <svg width="76" height="76" viewBox="0 0 76 76" aria-hidden="true" style={{ flex: 'none' }}>
        <circle cx="38" cy="38" r={r} fill="none" stroke="var(--panel-3)" strokeWidth="8" />
        <circle cx="38" cy="38" r={r} fill="none" stroke={pct >= 100 ? 'var(--ok)' : 'var(--accent)'} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${((c * Math.min(100, pct)) / 100).toFixed(1)} ${c.toFixed(1)}`} transform="rotate(-90 38 38)" />
        <text x="38" y="42" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--fg)" fontFamily="JetBrains Mono Variable, monospace">{Math.round(pct)}%</text>
      </svg>
      <div><b>{label}</b><div className="small muted">{sub}</div></div>
    </div>
  );
}

function weeks(d: Data, n: number, now: number) {
  const m = mondayOf(now);
  return Array.from({ length: n }, (_, i) => {
    const from = m - (n - 1 - i) * 7 * DAY;
    const list = d.transactions.filter((t) => real(t) && t.bookedAt >= isoDay(from) && t.bookedAt < isoDay(from + 7 * DAY));
    return { label: `KW ${weekNo(from)}`, inc: sum(list.filter((t) => t.amountCents > 0).map((t) => t.amountCents)), out: -sum(list.filter((t) => t.amountCents < 0).map((t) => t.amountCents)) };
  });
}
function weekNo(t: number) {
  const d = new Date(t + 3 * DAY);
  const y = new Date(d.getFullYear(), 0, 4);
  return 1 + Math.round(((d.getTime() - y.getTime()) / DAY - 3 + ((y.getDay() + 6) % 7)) / 7);
}

function goalForm(app: AppCtx, g?: Goal) {
  app.overlay(
    <FormModal title={g ? g.name : 'Neues Ziel'} fields={[{ name: 'name', label: 'Ziel (z. B. „Zweite Hebebühne“)', required: true }, { name: 'targetCents', label: 'Betrag', type: 'usd', required: true }, { name: 'account', label: 'Gemessen am Konto', type: 'select', options: ACCOUNTS }, { name: 'deadline', label: 'Bis', type: 'date' }]}
      initial={g ?? { account: 'firma' }} submit={(v) => (g ? api.patch(app.c(`/goals/${g.id}`), v) : api.post(app.c('/goals'), v))} onDone={() => app.toast('Ziel gespeichert')}>
      {g && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => app.act(() => api.del(app.c(`/goals/${g.id}`)), 'Ziel gelöscht').then(() => app.overlay(null))}>Ziel löschen</button>}
    </FormModal>,
  );
}

export function openTransfer(app: AppCtx) {
  app.overlay(
    <FormModal title="Umbuchung" fields={[{ name: 'from', label: 'Von', type: 'select', options: ACCOUNTS }, { name: 'to', label: 'Nach', type: 'select', options: ACCOUNTS }, { name: 'amountCents', label: 'Betrag', type: 'usd', required: true }, { name: 'text', label: 'Text' }]}
      initial={{ from: 'kasse', to: 'firma' }} submit={(v) => api.post(app.c('/transfers'), v)} onDone={() => app.toast('Umgebucht')} submitLabel="Umbuchen" />,
  );
}

export function FinanzenPage() {
  const app = useApp();
  const d = app.data!;
  const [now] = useState(() => Date.now());
  const wk = weeks(d, 8, now);
  const month = isoDay(now).slice(0, 7);
  const inc = d.transactions.filter((t) => real(t) && t.amountCents > 0 && t.bookedAt.startsWith(month));
  const src = Object.entries(inc.reduce<Record<string, number>>((a, t) => { const k = sourceOf(d, t); a[k] = (a[k] ?? 0) + t.amountCents; return a; }, {})).sort((a, b) => b[1] - a[1]);
  const incTotal = sum(src.map(([, v]) => v));
  const openBills = d.bills.filter((b) => b.status === 'offen' && b.kind === 'rechnung');
  const total = sum(ACCOUNTS.map(([a]) => balance(d, a)));
  return (
    <>
      <PageHead eyebrow="Finanzen" title="Finanzen" sub={`Gesamt ${formatUsd(total)} · keine Steuern`}>
        {app.can('buchungen', 2) && app.special('auszahlung') && <button className="btn" onClick={() => openTransfer(app)}><Icon name="swap" size={15} /> Umbuchung</button>}
      </PageHead>
      <div className="g c12">
        {ACCOUNTS.map(([a, l]) => {
          const week = sum(d.transactions.filter((t) => t.account === a && t.bookedAt >= isoDay(mondayOf(now))).map((t) => t.amountCents));
          return <div key={a} className="s3"><Kpi label={l} value={formatUsd(balance(d, a))} detail={week ? <><b className={week < 0 ? 'n' : ''}>{week > 0 ? '+' : ''}{formatUsd(week)}</b> diese Woche</> : 'diese Woche unverändert'} /></div>;
        })}
        <div className="s8"><Card title="Einnahmen und Ausgaben je Woche"><Bars rows={wk.map((w) => [w.label, w.inc / 100, w.out / 100])} labels={['Einnahmen', 'Ausgaben']} /></Card></div>
        <div className="s4">
          <Card title="Woher das Geld kommt" right={<span className="small muted">{new Date(now).toLocaleDateString('de-DE', { month: 'long' })}</span>}>
            {src.length ? src.map(([k, v]) => (
              <div key={k} style={{ marginBottom: 10 }}>
                <div className="row small" style={{ justifyContent: 'space-between' }}><span>{k}</span><span className="mono">{Math.round((v / incTotal) * 100)} % · {formatUsd(v)}</span></div>
                <div className="bar"><i style={{ width: `${(v / incTotal) * 100}%` }} /></div>
              </div>
            )) : <p className="muted small" style={{ margin: 0 }}>Diesen Monat noch keine Einnahmen.</p>}
          </Card>
        </div>
        <div className="s6">
          <Card title="Offene Posten" right={<a className="link" href="#rechnungen">Alle</a>}>
            {openBills.slice(0, 6).map((b) => <div key={b.id} className="li"><div className={`ib ${b.dueDate && b.dueDate < isoDay(now) ? 'bad' : 'warn'}`}><Icon name="file" /></div><div className="tx"><b>{billLabel(b.number)} · {customerName(d, b.customerId)}</b><span>{b.title}{b.dueDate ? ` · bis ${formatDate(b.dueDate)}` : ''}</span></div><span className="money">{formatUsd(b.amountCents)}</span></div>)}
            {!openBills.length && <p className="muted small" style={{ margin: 0 }}>{app.can('rechnungen') ? 'Alles bezahlt.' : 'Keine Sicht auf Rechnungen.'}</p>}
          </Card>
        </div>
        <div className="s6">
          <Card title="Letzte Buchungen" right={<a className="link" href="#buchungen">Alle</a>}>
            {d.transactions.slice(0, 6).map((t) => <div key={t.id} className="li"><div className={`ib ${t.amountCents < 0 ? '' : 'ok'}`}><Icon name={t.amountCents < 0 ? 'coins' : 'cash'} /></div><div className="tx"><b>{t.text}</b><span>{formatDate(t.bookedAt)} · {accountLabel(t.account)} · {t.category}</span></div><span className={`money ${t.amountCents < 0 ? 'neg' : 'pos'}`}>{t.amountCents > 0 ? '+' : ''}{formatUsd(t.amountCents)}</span></div>)}
            {!d.transactions.length && <p className="muted small" style={{ margin: 0 }}>Noch keine Buchungen.</p>}
          </Card>
        </div>
        <div className="s12">
          <Card title="Ziele" right={app.can('buchungen', 2) && <button className="btn sm" onClick={() => goalForm(app)}>+ Ziel</button>}>
            {d.goals.length ? <div className="g g3">{d.goals.map((g) => { const have = balance(d, g.account); return <div key={g.id} data-o style={{ cursor: app.can('buchungen', 2) ? 'pointer' : undefined }} onClick={() => app.can('buchungen', 2) && goalForm(app, g)}><Ring pct={(Math.max(0, have) / g.targetCents) * 100} label={g.name} sub={`${formatUsd(Math.max(0, have))} von ${formatUsd(g.targetCents)} · ${accountLabel(g.account)}${g.deadline ? ` · bis ${formatDate(g.deadline)}` : ''}`} /></div>; })}</div> : <p className="muted small" style={{ margin: 0 }}>Noch keine Ziele. Zum Beispiel: Rücklage für eine zweite Hebebühne.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

// --- Kasse ------------------------------------------------------------------
function standingForm(app: AppCtx, s?: StandingOrder) {
  app.overlay(
    <FormModal
      title={s ? s.text : 'Dauerauftrag'}
      fields={[
        { name: 'text', label: 'Text (z. B. „Miete Halle“)', required: true }, { name: 'dir', label: 'Richtung', type: 'select', options: [['out', 'Ausgabe'], ['in', 'Einnahme']] },
        { name: 'amount', label: 'Betrag', type: 'usd', required: true }, { name: 'account', label: 'Konto', type: 'select', options: ACCOUNTS },
        { name: 'every', label: 'Wie oft', type: 'select', options: [['woche', 'wöchentlich'], ['monat', 'monatlich'], ['jahr', 'jährlich']] },
        { name: 'nextDate', label: 'Nächste Buchung am', type: 'date', required: true }, { name: 'category', label: 'Kategorie' }, { name: 'active', label: 'Aktiv', type: 'checkbox' },
      ]}
      initial={s ? { ...s, dir: s.amountCents < 0 ? 'out' : 'in', amount: Math.abs(s.amountCents) } : { dir: 'out', account: 'firma', every: 'monat', active: true, category: 'Dauerauftrag', nextDate: isoDay(Date.now()) }}
      submit={(v) => {
        const body = { text: v.text, amountCents: (v.dir === 'out' ? -1 : 1) * Math.abs(Number(v.amount)), account: v.account, every: v.every, nextDate: v.nextDate, category: v.category || 'Dauerauftrag', active: v.active };
        return s ? api.patch(app.c(`/standing/${s.id}`), body) : api.post(app.c('/standing'), body);
      }}
      onDone={() => app.toast('Dauerauftrag gespeichert')}
    >
      {s && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => app.act(() => api.del(app.c(`/standing/${s.id}`)), 'Gelöscht').then(() => app.overlay(null))}>Dauerauftrag löschen</button>}
    </FormModal>,
  );
}

function TipsModal({ from, to }: { from: string; to: string }) {
  const app = useApp();
  const [res, setRes] = useState<{ pot: number; shares: { userId: string; name: string; minutes: number; cents: number }[] } | null>(null);
  const [range, setRange] = useState({ from, to });
  const load = () => void api.post<typeof res>(app.c('/tips'), { ...range, preview: true }).then(setRes, (e: Error) => app.toast(e.message, 'bad'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);
  return (
    <Modal title="Trinkgeld verteilen" onClose={() => app.overlay(null)}>
      <div className="stack">
        <div className="row" style={{ gap: 8 }}>
          <div className="field grow"><label htmlFor="tp-f">Von</label><input id="tp-f" type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
          <div className="field grow"><label htmlFor="tp-t">Bis</label><input id="tp-t" type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
          <button className="btn" style={{ alignSelf: 'flex-end' }} onClick={load}>Rechnen</button>
        </div>
        {res && <p className="small muted" style={{ margin: 0 }}>{formatUsd(res.pot)} in der Trinkgeldkasse, verteilt nach gestempelten Stunden:</p>}
        {res?.shares.map((s) => <div key={s.userId} className="li"><span className="grow">{s.name}</span><span className="mono small muted">{(s.minutes / 60).toFixed(1).replace('.', ',')} h</span><span className="money" style={{ width: 90, textAlign: 'right' }}>{formatUsd(s.cents)}</span></div>)}
        {res && !res.shares.length && <p className="muted small">Im Zeitraum hat niemand gestempelt.</p>}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={() => app.overlay(null)}>Abbrechen</button>
          <button className="btn pri" disabled={!res || res.pot <= 0 || !res.shares.length} onClick={async () => { app.overlay(null); await app.act(() => api.post(app.c('/tips'), range), 'Trinkgeld verteilt'); }}>Verteilen</button>
        </div>
      </div>
    </Modal>
  );
}

export function KassePage() {
  const app = useApp();
  const d = app.data!;
  const [now] = useState(() => Date.now());
  const [counted, setCounted] = useState('');
  const today = isoDay(now);
  const soll = balance(d, 'kasse');
  const last = d.closings[0];
  const edit = app.can('buchungen', 2);
  const cashToday = d.transactions.filter((t) => (t.account === 'kasse' || t.account === 'trinkgeld') && t.bookedAt === today);
  const due = d.standing.filter((s) => s.active && s.nextDate <= today);
  const close = () => {
    const cents = Math.round(Number(counted.replace(/\./g, '').replace(',', '.')) * 100);
    if (!counted.trim() || !Number.isFinite(cents) || cents < 0) return app.toast('Gezählten Betrag eingeben', 'bad');
    app.overlay(<Confirm title="Tagesabschluss buchen?" text={cents === soll ? 'Kasse stimmt.' : `Differenz ${formatUsd(cents - soll)} – wird als Kassendifferenz gebucht.`} okLabel="Abschluss buchen" onOk={() => app.act(() => api.post(app.c('/closings'), { countedCents: cents }), 'Tagesabschluss gebucht').then(() => setCounted(''))} />);
  };
  return (
    <>
      <PageHead eyebrow="Finanzen" title="Kasse" sub="Bargeld, Trinkgeld, Daueraufträge und Tagesabschluss">
        {edit && app.special('auszahlung') && <button className="btn" onClick={() => openTransfer(app)}><Icon name="swap" size={15} /> Umbuchung</button>}
      </PageHead>
      <div className="g c12">
        <div className="s5">
          <Card title="Tagesabschluss Kasse">
            <dl className="kv"><dt>Soll laut Buchungen</dt><dd className="money">{formatUsd(soll)}</dd><dt>Letzter Abschluss</dt><dd>{last ? `${formatDate(last.createdAt)} ${formatTime(last.createdAt)} · ${memberName(d, last.createdBy).split(' ')[0]} · Differenz ${formatUsd(last.countedCents - last.expectedCents)}` : 'noch keiner'}</dd></dl>
            {edit && (
              <>
                <div className="field" style={{ marginTop: 14 }}><label htmlFor="counted">Gezählt ($)</label><input id="counted" inputMode="decimal" value={counted} onChange={(e) => setCounted(e.target.value)} placeholder={formatUsd(soll)} /></div>
                <div className="row wrap" style={{ marginTop: 12, gap: 8 }}><button className="btn pri" onClick={close}>Abschluss buchen</button><button className="btn" onClick={() => setCounted(String(soll / 100))}>Stimmt genau</button></div>
              </>
            )}
          </Card>
        </div>
        <div className="s7">
          <Card title="Heute bar">
            {cashToday.map((t) => <div key={t.id} className="li"><div className={`ib ${t.amountCents > 0 ? 'ok' : ''}`}><Icon name="cash" /></div><div className="tx"><b>{t.text}</b><span>{formatTime(t.createdAt)} · {accountLabel(t.account)}</span></div><span className={`money ${t.amountCents < 0 ? 'neg' : 'pos'}`}>{t.amountCents > 0 ? '+' : ''}{formatUsd(t.amountCents)}</span></div>)}
            {!cashToday.length && <p className="muted small" style={{ margin: 0 }}>Heute noch nichts bar.</p>}
          </Card>
        </div>
        <div className="s6">
          <Card title="Daueraufträge" right={<>{edit && due.length > 0 && <button className="btn sm pri" onClick={() => app.act(() => api.post(app.c('/standing/run')), 'Fällige Daueraufträge gebucht')}>{due.length} fällig buchen</button>}{app.can('buchungen', 3) && <button className="btn sm" onClick={() => standingForm(app)}>+ Dauerauftrag</button>}</>}>
            {d.standing.map((s) => (
              <div key={s.id} className="li" data-o={app.can('buchungen', 3) ? '' : undefined} onClick={() => app.can('buchungen', 3) && standingForm(app, s)}>
                <div className={`ib ${s.amountCents < 0 ? '' : 'ok'}`}><Icon name="clock" /></div>
                <div className="tx"><b>{s.text}</b><span>{{ woche: 'wöchentlich', monat: 'monatlich', jahr: 'jährlich' }[s.every]} · nächste am {formatDate(s.nextDate)} · {accountLabel(s.account)}{!s.active ? ' · pausiert' : ''}</span></div>
                <span className={`money ${s.amountCents < 0 ? 'neg' : 'pos'}`}>{s.amountCents > 0 ? '+' : ''}{formatUsd(s.amountCents)}</span>
              </div>
            ))}
            {!d.standing.length && <p className="muted small" style={{ margin: 0 }}>Keine Daueraufträge. Sie werden automatisch am Fälligkeitstag gebucht.</p>}
          </Card>
        </div>
        <div className="s6">
          <Card title="Trinkgeld verteilen">
            <p className="muted small" style={{ margin: '0 0 10px' }}>{formatUsd(balance(d, 'trinkgeld'))} in der Trinkgeldkasse. Verteilt wird nach gestempelten Stunden im Zeitraum.</p>
            {edit && app.special('auszahlung') ? <button className="btn" onClick={() => app.overlay(<TipsModal from={isoDay(mondayOf(now))} to={today} />)}>Verteilen …</button> : <p className="small dim" style={{ margin: 0 }}>Verteilen braucht das Sonderrecht „Ausgaben buchen“.</p>}
          </Card>
        </div>
        {d.closings.length > 0 && (
          <div className="s12">
            <Card title="Letzte Abschlüsse">
              <Table head={['Wann', 'Wer', ['Soll', 'r'], ['Gezählt', 'r'], ['Differenz', 'r']]}>
                {d.closings.slice(0, 10).map((c) => <tr key={c.id}><td className="mono small">{formatDate(c.createdAt)} {formatTime(c.createdAt)}</td><td>{memberName(d, c.createdBy)}</td><td className="r money">{formatUsd(c.expectedCents)}</td><td className="r money">{formatUsd(c.countedCents)}</td><td className={`r money ${c.countedCents - c.expectedCents < 0 ? 'neg' : c.countedCents > c.expectedCents ? 'pos' : ''}`}>{formatUsd(c.countedCents - c.expectedCents)}</td></tr>)}
              </Table>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

// --- Auswertung ---------------------------------------------------------------
const PERIOD: Record<string, number> = { Woche: 7, Monat: 30, Quartal: 91, Jahr: 365 };

export function AuswertungPage() {
  const app = useApp();
  const d = app.data!;
  const [per, setPer] = useState<'Woche' | 'Monat' | 'Quartal' | 'Jahr'>('Monat');
  const [now] = useState(() => Date.now());
  const from = isoDay(now - PERIOD[per] * DAY);
  const tx = d.transactions.filter((t) => real(t) && t.bookedAt >= from);
  const income = sum(tx.filter((t) => t.amountCents > 0).map((t) => t.amountCents));
  const costs = -sum(tx.filter((t) => t.amountCents < 0).map((t) => t.amountCents));
  const paid = d.bills.filter((b) => b.status === 'bezahlt' && b.kind === 'rechnung' && (b.paidAt ?? '').slice(0, 10) >= from);
  const orderBills = paid.filter((b) => b.orderId);
  const openSum = sum(d.bills.filter((b) => b.status === 'offen' && b.kind === 'rechnung').map((b) => b.amountCents));
  const newCust = d.customers.filter((c) => c.createdAt.slice(0, 10) >= from);
  const byPerson = new Map<string, number>();
  for (const b of paid) {
    const who = b.orderId ? d.orders.find((o) => o.id === b.orderId)?.assigneeId : b.calloutId ? d.callouts.find((c) => c.id === b.calloutId)?.driverId : null;
    if (who) byPerson.set(who, (byPerson.get(who) ?? 0) + b.amountCents);
  }
  const people = [...byPerson.entries()].sort((a, b) => b[1] - a[1]);
  const top = new Map<string, [number, number]>();
  for (const b of paid) {
    const o = b.orderId ? d.orders.find((x) => x.id === b.orderId) : undefined;
    const svc = o?.serviceId ? d.services.find((s) => s.id === o.serviceId)?.name : undefined;
    const k = svc ?? (b.calloutId ? 'Abschleppen' : o ? { werkstatt: 'Werkstatt', karosserie: 'Karosserie', tuning: 'Tuning', racing: 'Racing' }[o.kind] : b.title.replace(/^W-\d+\s*/, '').slice(0, 40));
    const cur = top.get(k) ?? [0, 0];
    top.set(k, [cur[0] + 1, cur[1] + b.amountCents]);
  }
  const wk = weeks(d, per === 'Jahr' ? 12 : 8, now);
  return (
    <>
      <PageHead eyebrow="Finanzen" title="Auswertung" sub={`${formatDate(from)} bis heute`}>
        <Seg value={per} options={['Woche', 'Monat', 'Quartal', 'Jahr'] as const} onChange={setPer} />
      </PageHead>
      <div className="g c12">
        <div className="s3"><Kpi label="Gewinn" value={formatUsd(income - costs)} detail={`Einnahmen ${formatUsd(income)} · Kosten ${formatUsd(costs)}`} /></div>
        <div className="s3"><Kpi label="Ø Auftragswert" value={orderBills.length ? formatUsd(Math.round(sum(orderBills.map((b) => b.amountCents)) / orderBills.length)) : '–'} detail={`${orderBills.length} bezahlte Aufträge`} /></div>
        <div className="s3"><Kpi label="Offene Posten" value={formatUsd(openSum)} detail={`${d.bills.filter((b) => b.status === 'offen' && b.kind === 'rechnung').length} Rechnungen`} /></div>
        <div className="s3"><Kpi label="Neue Kunden" value={newCust.length} detail={`${newCust.filter((c) => c.kind === 'racing').length} davon Racing`} /></div>
        <div className="s6">
          <Card title="Umsatz je Mitarbeiter">
            {people.length ? people.map(([id, v]) => <div key={id} className="li"><div style={{ width: 120, flex: 'none' }}><b>{memberName(d, id).split(' ')[0]}</b></div><div className="grow"><div className="bar"><i style={{ width: `${(v / people[0][1]) * 100}%` }} /></div></div><span className="money">{formatUsd(v)}</span></div>) : <Empty title="Keine bezahlten Rechnungen mit Zuständigem" />}
          </Card>
        </div>
        <div className="s6">
          <Card title="Top-Leistungen">
            {top.size ? [...top.entries()].sort((a, b) => b[1][1] - a[1][1]).slice(0, 6).map(([k, [n, v]]) => <div key={k} className="li"><div className="tx"><b>{k}</b><span>{n}× bezahlt</span></div><span className="money">{formatUsd(v)}</span></div>) : <Empty title="Noch nichts bezahlt" />}
          </Card>
        </div>
        <div className="s12"><Card title="Gewinn je Woche"><Bars rows={wk.map((w) => [w.label, (w.inc - w.out) / 100, null])} labels={['Gewinn', '']} /></Card></div>
      </div>
    </>
  );
}

