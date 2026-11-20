// Firma ab 0.4: Preisliste (mit Nachweis-Pflicht), Regelwerk (lesen und bestätigen), Pinnwand (Beiträge, Umfragen), Live-Feed,
// dazu Einstellungen und Webhooks (Discord-Meldungen) als Karten unter Firmendaten.
import { useEffect, useState } from 'react';
import { FEED_AREAS, FEED_GROUPS, WEBHOOK_EVENTS, type FeedGroup } from '../../../shared/feed';
import { formatAgo, formatDate, formatTime, formatUsd } from '../../../shared/format';
import type { FeedItem, Post, RuleDoc, Service, Webhook } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Avatar, Card, Confirm, Drawer, Empty, FormModal, PageHead, Pill, Seg, Switch, Table } from '../ui';
import { memberName } from './helpers';

// --- Preisliste ---------------------------------------------------------------
const AREAS_P = ['Werkstatt', 'Karosserie', 'Abschlepp', 'Tuning', 'Racing', 'Sonstiges'];

function serviceForm(app: AppCtx, s?: Service) {
  const d = app.data!;
  app.overlay(
    <FormModal
      title={s ? s.name : 'Neue Leistung'}
      fields={[
        { name: 'name', label: 'Leistung', required: true }, { name: 'area', label: 'Bereich', type: 'select', options: AREAS_P.map((a) => [a, a]) },
        { name: 'priceCents', label: 'Grundpreis', type: 'usd' },
        { name: 'courseId', label: 'Nachweis nötig (Kurs)', type: 'select', options: [['', '– keiner –'], ...d.courses.map((c) => [c.id, c.name] as [string, string])] },
        { name: 'note', label: 'Notiz' },
      ]}
      initial={s ?? { area: 'Werkstatt' }}
      submit={(v) => (s ? api.patch(app.c(`/services/${s.id}`), v) : api.post(app.c('/services'), v))}
      onDone={() => app.toast('Gespeichert')}
    />,
  );
}

export function PreislistePage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('preisliste', 2);
  const classes = Object.entries(d.tuning.classes).filter(([, f]) => f !== 1).slice(0, 3);
  const course = (id: string | null) => d.courses.find((c) => c.id === id)?.name;
  return (
    <>
      <PageHead eyebrow="Firma" title="Preisliste" sub={`${d.services.length} Leistungen · Grundpreis, andere Fahrzeugklassen per Faktor aus „Pakete & Preise“`}>
        {edit && <button className="btn pri" onClick={() => serviceForm(app)}><Icon name="plus" size={15} /> Leistung</button>}
      </PageHead>
      <Card>
        {d.services.length ? (
          <Table head={['Leistung', 'Bereich', ['Grundpreis', 'r'], ...classes.map(([k, f]) => [`${k} ×${String(f).replace('.', ',')}`, 'r'] as [string, 'r']), 'Nachweis nötig', '']}>
            {d.services.map((s) => (
              <tr key={s.id}>
                <td><b>{s.name}</b>{s.note && <div className="small muted">{s.note}</div>}</td>
                <td><Pill dot={false}>{s.area}</Pill></td>
                <td className="r money">{formatUsd(s.priceCents)}</td>
                {classes.map(([k, f]) => <td key={k} className="r money dim">{formatUsd(Math.round(s.priceCents * f))}</td>)}
                <td>{s.courseId ? <Pill tone="info" dot={false}>{course(s.courseId)}</Pill> : <span className="dim">–</span>}</td>
                <td className="r" style={{ whiteSpace: 'nowrap' }}>{edit && <><button className="btn sm ghost" onClick={() => serviceForm(app, s)}>Ändern</button>{app.can('preisliste', 3) && <button className="ibtn" aria-label={`${s.name} löschen`} onClick={() => app.overlay(<Confirm title={`${s.name} löschen?`} text="Aufträge mit dieser Leistung behalten ihren Preis." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/services/${s.id}`)), 'Gelöscht')} />)}><Icon name="x" size={13} /></button>}</>}</td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="Noch keine Leistungen">{edit ? 'Leistungen mit Preis anlegen. Mit „Nachweis nötig“ dürfen nur Leute mit bestandenem Kurs den Auftrag übernehmen.' : null}</Empty>}
      </Card>
      <p className="small dim" style={{ marginTop: 10 }}>Leistungen lassen sich bei Annahme, Auftrag und Rechnung auswählen. Fehlt der zuständigen Person der Nachweis, lehnt Pitstop die Zuteilung ab.</p>
    </>
  );
}

// --- Regelwerk ----------------------------------------------------------------
function ruleForm(app: AppCtx, r?: RuleDoc) {
  app.overlay(
    <FormModal
      title={r ? r.title : 'Neues Dokument'}
      fields={[{ name: 'title', label: 'Titel', required: true }, { name: 'body', label: 'Text', type: 'textarea' }, ...(r ? [{ name: 'newVersion', label: 'Neue Fassung: alle müssen neu bestätigen', type: 'checkbox' as const }] : [])]}
      initial={r ? { ...r, newVersion: true } : {}}
      submit={(v) => (r ? api.patch(app.c(`/rules/${r.id}`), v) : api.post(app.c('/rules'), v))}
      onDone={() => app.toast('Gespeichert')}
    />,
  );
}

function RuleDrawer({ r }: { r: RuleDoc }) {
  const app = useApp();
  const d = app.data!;
  const me = app.me.user.id;
  const acked = r.ackedBy.includes(me);
  const active = d.members.filter((m) => !m.locked);
  const missing = active.filter((m) => !r.ackedBy.includes(m.userId));
  return (
    <Drawer title={r.title} sub={`Version ${r.version} · ${formatDate(r.updatedAt)}`} onClose={() => app.overlay(null)}
      foot={<>
        {!acked && !d.rights.support && <button className="btn pri" onClick={() => app.act(() => api.post(app.c(`/rules/${r.id}/ack`)), 'Bestätigt').then(() => app.overlay(null))}>Gelesen und bestätigt</button>}
        {app.can('regelwerk', 2) && <button className="btn" onClick={() => ruleForm(app, r)}>Bearbeiten</button>}
        {app.can('regelwerk', 3) && <button className="btn ghost" onClick={() => app.overlay(<Confirm title={`${r.title} löschen?`} text="Mit allen Bestätigungen." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/rules/${r.id}`)), 'Gelöscht')} />)}>Löschen</button>}
      </>}>
      <div style={{ whiteSpace: 'pre-wrap' }}>{r.body || <span className="muted">Kein Text.</span>}</div>
      {acked && <div className="alert ok"><Icon name="check" /><div>Du hast Version {r.version} bestätigt.</div></div>}
      {app.can('regelwerk', 2) && (
        <div><div className="st">Noch nicht bestätigt ({missing.length})</div><div className="row wrap" style={{ gap: 6 }}>{missing.map((m) => <Pill key={m.userId} tone="warn" dot={false}>{m.displayName}</Pill>)}{!missing.length && <span className="small muted">Alle haben bestätigt.</span>}</div></div>
      )}
    </Drawer>
  );
}

export function RegelwerkPage() {
  const app = useApp();
  const d = app.data!;
  const me = app.me.user.id;
  const total = d.members.filter((m) => !m.locked).length;
  const open = d.rules.filter((r) => !r.ackedBy.includes(me));
  return (
    <>
      <PageHead eyebrow="Firma" title="Regelwerk" sub={open.length ? `${open.length} Dokumente warten auf deine Bestätigung` : 'Dokumente, die jeder lesen und bestätigen muss'}>
        {app.can('regelwerk', 2) && <button className="btn pri" onClick={() => ruleForm(app)}><Icon name="plus" size={15} /> Dokument</button>}
      </PageHead>
      {d.rules.length ? (
        <div className="g g2">
          {d.rules.map((r) => {
            const n = r.ackedBy.length;
            return (
              <Card key={r.id}>
                <div className="row"><div className={`ib ${r.ackedBy.includes(me) ? 'ok' : 'warn'}`}><Icon name="book" /></div><div className="grow"><b>{r.title}</b><div className="small muted">Version {r.version} · {formatDate(r.updatedAt)}</div></div><Pill tone={n >= total ? 'ok' : 'warn'}>{n >= total ? 'alle bestätigt' : `${n} von ${total}`}</Pill></div>
                <p className="muted small" style={{ margin: '12px 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.body}</p>
                <div className="row" style={{ gap: 6 }}><button className={`btn sm ${r.ackedBy.includes(me) ? '' : 'pri'}`} onClick={() => app.overlay(<RuleDrawer r={r} />)}>{r.ackedBy.includes(me) ? 'Lesen' : 'Lesen und bestätigen'}</button></div>
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title="Noch kein Regelwerk">{app.can('regelwerk', 2) ? 'Zum Beispiel Dienstverordnung oder Preis- und Rabattrichtlinie.' : null}</Empty></Card>}
    </>
  );
}

// --- Pinnwand -----------------------------------------------------------------
function postForm(app: AppCtx, withPoll: boolean) {
  app.overlay(
    <FormModal
      title={withPoll ? 'Neue Umfrage' : 'Neuer Beitrag'}
      fields={[
        { name: 'title', label: withPoll ? 'Frage' : 'Titel', required: true }, { name: 'body', label: 'Text', type: 'textarea' },
        ...(withPoll ? [{ name: 'options', label: 'Antworten, eine je Zeile', type: 'textarea' as const, required: true }, { name: 'endsAt', label: 'Endet (leer = offen)', type: 'datetime' as const }] : []),
        ...(app.can('pinnwand', 3) ? [{ name: 'pinned', label: 'Oben anheften', type: 'checkbox' as const }] : []),
      ]}
      submit={(v) => {
        const options = withPoll ? String(v.options).split('\n').map((x) => x.trim()).filter(Boolean) : [];
        if (withPoll && options.length < 2) throw new Error('Mindestens zwei Antworten');
        return api.post(app.c('/posts'), { title: v.title, body: v.body, pinned: !!v.pinned, poll: withPoll ? { question: v.title, options, endsAt: v.endsAt ?? null } : null });
      }}
      onDone={() => app.toast('Veröffentlicht')}
      submitLabel="Veröffentlichen"
    />,
  );
}

function PostCard({ p }: { p: Post }) {
  const app = useApp();
  const d = app.data!;
  const me = app.me.user.id;
  const total = d.members.filter((m) => !m.locked).length;
  const votes = p.votes.reduce((a, b) => a + b, 0);
  const [now] = useState(() => Date.now());
  const ended = p.poll?.endsAt ? Date.parse(p.poll.endsAt) < now : false;
  const mine = p.authorId === me && app.can('pinnwand', 2);
  useEffect(() => {
    if (!p.readByMe && !d.rights.support) void api.post(app.c(`/posts/${p.id}/read`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id]);
  return (
    <Card>
      <div className="row">
        <Avatar name={memberName(d, p.authorId) || '?'} size={32} />
        <div className="grow"><b>{p.title}</b><div className="small muted">{memberName(d, p.authorId).split(' ')[0] || 'Gelöscht'} · {formatAgo(p.createdAt)}{p.pinned ? ' · angeheftet' : ''}</div></div>
        <Pill tone={p.reads >= total ? 'ok' : ''} dot={false}>{p.reads} von {total} gelesen</Pill>
      </div>
      {p.body && <p style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap' }}>{p.body}</p>}
      {p.poll && (
        <div className="stack" style={{ gap: 10, marginTop: 12 }}>
          {p.poll.options.map((o, i) => (
            <button key={o} className="card flat" style={{ textAlign: 'left', padding: 10, border: p.myVote === i ? '1px solid var(--accent)' : undefined, cursor: ended ? 'default' : 'pointer' }} disabled={ended || d.rights.support} onClick={() => app.act(() => api.post(app.c(`/posts/${p.id}/vote`), { option: i }), 'Abgestimmt')}>
              <div className="row small" style={{ justifyContent: 'space-between' }}><span>{p.myVote === i ? '✓ ' : ''}{o}</span><span className="mono">{p.votes[i] ?? 0}</span></div>
              <div className="bar" style={{ marginTop: 6 }}><i style={{ width: `${votes ? ((p.votes[i] ?? 0) / votes) * 100 : 0}%` }} /></div>
            </button>
          ))}
          <div className="small muted">{votes} Stimmen · anonym{p.poll.endsAt ? ` · ${ended ? 'beendet' : `endet ${formatDate(p.poll.endsAt)} ${formatTime(p.poll.endsAt)}`}` : ''}</div>
        </div>
      )}
      {(mine || app.can('pinnwand', 3)) && (
        <div className="row" style={{ marginTop: 10, gap: 6 }}>
          {app.can('pinnwand', 3) && <button className="btn sm ghost" onClick={() => app.act(() => api.patch(app.c(`/posts/${p.id}`), { pinned: !p.pinned }), p.pinned ? 'Gelöst' : 'Angeheftet')}>{p.pinned ? 'Lösen' : 'Anheften'}</button>}
          <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title="Beitrag löschen?" text={p.title} okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/posts/${p.id}`)), 'Gelöscht')} />)}>Löschen</button>
        </div>
      )}
    </Card>
  );
}

export function PinnwandPage() {
  const app = useApp();
  const d = app.data!;
  const posts = d.posts.filter((p) => !p.poll);
  const polls = d.posts.filter((p) => p.poll);
  return (
    <>
      <PageHead eyebrow="Firma" title="Pinnwand" sub="Ankündigungen und Umfragen fürs Team">
        {app.can('pinnwand', 2) && <button className="btn" onClick={() => postForm(app, true)}><Icon name="plus" size={15} /> Umfrage</button>}
        {app.can('pinnwand', 2) && <button className="btn pri" onClick={() => postForm(app, false)}><Icon name="plus" size={15} /> Beitrag</button>}
      </PageHead>
      <div className="g c12">
        <div className="s8 stack">{posts.map((p) => <PostCard key={p.id} p={p} />)}{!posts.length && <Card><Empty title="Noch keine Beiträge" /></Card>}</div>
        <div className="s4 stack">{polls.map((p) => <PostCard key={p.id} p={p} />)}{!polls.length && <Card title="Umfragen"><p className="muted small" style={{ margin: 0 }}>Keine Umfrage offen.</p></Card>}</div>
      </div>
    </>
  );
}

// --- Live-Feed ----------------------------------------------------------------
const GROUP_ICON: Record<FeedGroup, [string, string]> = { Werkstatt: ['wrench', 'acc'], Abschlepp: ['truck', 'info'], Racing: ['flag', 'info'], Kunden: ['folder', ''], Finanzen: ['coins', 'ok'], Personal: ['users', 'warn'], Firma: ['building', ''] };

export function useFeed(app: AppCtx, every = 30_000) {
  const [items, setItems] = useState<FeedItem[] | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () => api.get<{ items: FeedItem[] }>(app.c('/feed')).then((r) => alive && setItems(r.items), () => alive && setItems([]));
    void load();
    const t = setInterval(() => document.visibilityState === 'visible' && void load(), every);
    return () => { alive = false; clearInterval(t); };
  }, [app.companyId, app.data?.orders.length, app.data?.transactions.length, app.data?.callouts.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return items;
}

export function FeedLine({ f }: { f: FeedItem }) {
  const g = FEED_AREAS[f.area]?.group ?? 'Firma';
  const [icon, tone] = GROUP_ICON[g];
  return <div className="li"><span className="tm">{formatTime(f.createdAt)}</span><div className={`ib ${tone}`}><Icon name={icon} /></div><div className="tx"><b>{f.action}</b><span>{f.userName} · {f.area}{new Date(f.createdAt).toDateString() !== new Date().toDateString() ? ` · ${formatDate(f.createdAt)}` : ''}</span></div></div>;
}

export function FeedPage() {
  const app = useApp();
  const d = app.data!;
  const items = useFeed(app, 15_000);
  const [g, setG] = useState<'Alles' | FeedGroup>('Alles');
  const groups = FEED_GROUPS.filter((x) => items?.some((f) => FEED_AREAS[f.area]?.group === x));
  const list = (items ?? []).filter((f) => g === 'Alles' || FEED_AREAS[f.area]?.group === g);
  const today = new Date().toDateString();
  const isToday = (iso: string) => new Date(iso).toDateString() === today;
  const hooks = d.webhooks.filter((w) => w.active);
  return (
    <>
      <PageHead eyebrow="Übersicht" title="Live-Feed" sub="Alles, was gerade im Betrieb passiert – nur aus Bereichen, die du sehen darfst" />
      <div className="row wrap" style={{ marginBottom: 14 }}><Seg value={g} options={['Alles', ...groups] as ('Alles' | FeedGroup)[]} onChange={setG} /></div>
      <div className="g c12">
        <div className="s8"><Card><div className="feed">{items === null ? <p className="muted">Lädt …</p> : list.length ? list.map((f) => <FeedLine key={f.id} f={f} />) : <p className="muted">Nichts in diesem Bereich.</p>}</div></Card></div>
        <div className="s4 stack">
          <Card title="Heute in Zahlen">
            <div className="stats" style={{ gridTemplateColumns: 'repeat(2,minmax(0,1fr))' }}>
              <div><span>Aufträge</span><b>{d.orders.filter((o) => isToday(o.createdAt)).length}</b></div>
              <div><span>Einsätze</span><b>{d.callouts.filter((c) => isToday(c.createdAt)).length}</b></div>
              <div><span>Zahlungen</span><b>{d.bills.filter((b) => b.paidAt && isToday(b.paidAt)).length}</b></div>
              <div><span>Im Dienst</span><b>{d.members.filter((m) => m.onDutySince).length}</b></div>
            </div>
          </Card>
          {app.can('firma', 3) && <Card title="Discord"><p className="muted small" style={{ margin: '0 0 10px' }}>{hooks.length ? `${hooks.length} Webhook${hooks.length > 1 ? 's' : ''} senden Ereignisse weiter.` : 'Ereignisse lassen sich unter Firmendaten → Webhooks in einen Discord-Kanal schicken.'}</p><Pill tone={hooks.length ? 'ok' : ''}>{hooks.length ? 'verbunden' : 'nicht eingerichtet'}</Pill></Card>}
        </div>
      </div>
    </>
  );
}

// --- Firmendaten: Einstellungen und Webhooks -----------------------------------
export function CompanyExtraCard() {
  const app = useApp();
  const d = app.data!;
  const x = d.company.extra;
  const edit = app.can('firma', 2);
  return (
    <Card title="Geld, Standorte, Öffentliches" right={edit && (
      <button className="btn sm" onClick={() => app.overlay(
        <FormModal title="Einstellungen" fields={[
          { name: 'payDays', label: 'Zahlungsziel neuer Rechnungen in Tagen', type: 'number' }, { name: 'footer', label: 'Rechnungsfuß' },
          { name: 'locations', label: 'Standorte, je Zeile „Name | Notiz“', type: 'textarea' },
        ]} initial={{ payDays: x.payDays ?? 3, footer: x.footer ?? '', locations: (x.locations ?? []).map((l) => `${l.name} | ${l.note}`).join('\n') }}
          submit={(v) => api.patch(app.c('/extra'), { payDays: v.payDays ?? 3, footer: v.footer, locations: String(v.locations ?? '').split('\n').map((l) => l.split('|').map((s) => s.trim())).filter((p) => p[0]).map(([name, note]) => ({ name, note: note ?? '' })) })}
          onDone={() => app.toast('Gespeichert')} />,
      )}>Bearbeiten</button>
    )}>
      <dl className="kv">
        <dt>Zahlungsziel</dt><dd>{x.payDays ?? 3} Tage</dd>
        <dt>Rechnungsfuß</dt><dd>{x.footer || '–'}</dd>
        <dt>Standorte</dt><dd>{x.locations?.length ? x.locations.map((l) => `${l.name}${l.note ? ` (${l.note})` : ''}`).join(', ') : '–'}</dd>
      </dl>
      <div className="li" style={{ marginTop: 8 }}>
        <div className="tx"><b>Öffentliche Daten</b><span style={{ whiteSpace: 'normal' }}>Preisliste, kommende Rennen und Bestenliste über die öffentliche API (z. B. für eine Website oder einen Discord-Bot). Nichts anderes wird geteilt.</span></div>
        <Switch on={!!x.publicData} disabled={!edit} label="Öffentliche Daten freigeben" onChange={(v) => app.act(() => api.patch(app.c('/extra'), { publicData: v }), v ? 'Freigegeben' : 'Nicht mehr öffentlich')} />
      </div>
    </Card>
  );
}

function hookForm(app: AppCtx, w?: Webhook) {
  app.overlay(
    <FormModal
      title={w ? (w.name || 'Webhook') : 'Neuer Webhook'}
      fields={[
        { name: 'name', label: 'Name (z. B. #werkstatt-funk)' }, { name: 'kind', label: 'Format', type: 'select', options: [['discord', 'Discord-Webhook'], ['json', 'JSON an eigene Adresse']] },
        { name: 'url', label: 'Adresse (https://discord.com/api/webhooks/…)', required: true },
        { name: 'events', label: 'Welche Bereiche? (keiner gewählt = alle)', type: 'multi', options: WEBHOOK_EVENTS.map((e) => [e, e]) },
        { name: 'active', label: 'Aktiv', type: 'checkbox' },
      ]}
      initial={w ?? { kind: 'discord', events: ['Abschleppdienst', 'Dienst'], active: true }}
      submit={(v) => (w ? api.patch(app.c(`/webhooks/${w.id}`), v) : api.post(app.c('/webhooks'), v))}
      onDone={() => app.toast('Webhook gespeichert')}
    />,
  );
}

export function WebhooksCard() {
  const app = useApp();
  const d = app.data!;
  if (!app.can('firma', 3)) return null;
  return (
    <Card title="Webhooks (Discord-Meldungen)" right={<button className="btn sm" onClick={() => hookForm(app)}>+ Webhook</button>}>
      <p className="small muted" style={{ marginTop: 0 }}>Ereignisse aus dem Protokoll gehen sofort in einen Discord-Kanal oder an eine eigene Adresse. Nur https.</p>
      {d.webhooks.map((w) => (
        <div key={w.id} className="li">
          <div className={`ib ${!w.active ? '' : w.fails ? 'bad' : 'ok'}`}><Icon name="send" /></div>
          <div className="tx"><b>{w.name || w.url.replace(/^https:\/\/([^/]+).*/, '$1')}</b><span>{w.kind === 'discord' ? 'Discord' : 'JSON'} · {w.events.length ? w.events.join(', ') : 'alle Bereiche'}{w.lastAt ? ` · zuletzt ${formatAgo(w.lastAt)}: ${w.lastStatus}` : ''}{w.fails ? ` · ${w.fails} Fehler` : ''}</span></div>
          <button className="btn sm ghost" onClick={() => app.act(() => api.post<{ status: string }>(app.c(`/webhooks/${w.id}/test`)).then((r) => { app.toast(`Test: ${r.status}`, r.status.startsWith('ok') ? 'ok' : 'bad'); return r; }))}>Test</button>
          <button className="btn sm ghost" onClick={() => hookForm(app, w)}>Ändern</button>
          <button className="ibtn" aria-label="Webhook löschen" onClick={() => app.act(() => api.del(app.c(`/webhooks/${w.id}`)), 'Gelöscht')}><Icon name="x" size={13} /></button>
        </div>
      ))}
      {!d.webhooks.length && <p className="muted small" style={{ margin: 0 }}>Noch keiner eingerichtet.</p>}
    </Card>
  );
}


// --- Spielserver (FiveM) -------------------------------------------------------
export function GameKeysCard() {
  const app = useApp();
  const d = app.data!;
  if (!app.can('firma', 3)) return null;
  const base = `${window.location.origin}/api/game`;
  const create = () => app.overlay(
    <FormModal title="Spielserver-Schlüssel" fields={[{ name: 'name', label: 'Wofür? (z. B. „FiveM Hauptserver“)', required: true }]}
      submit={(v) => api.post<{ key: string }>(app.c('/game-keys'), v)}
      onDone={(r) => app.overlay(
        <Drawer title="Neuer Spielserver-Schlüssel" sub="Nur jetzt sichtbar – sicher aufbewahren" onClose={() => app.overlay(null)}>
          <div className="reveal mono" style={{ wordBreak: 'break-all' }}>{(r as { key: string }).key}</div>
          <p className="small">In der <span className="mono">server.cfg</span> des FiveM-Servers eintragen:</p>
          <pre className="reveal mono small" style={{ whiteSpace: 'pre-wrap' }}>{`set pitstop_url "${base}"\nset pitstop_key "${(r as { key: string }).key}"\nensure pitstop`}</pre>
          <p className="small muted">Die Ressource liegt im Repository unter <span className="mono">fivem/pitstop</span>. Mitglieder werden über ihre Spiel-ID (unter Mitglieder & Zugänge) oder ihr verknüpftes Discord-Konto erkannt.</p>
        </Drawer>,
      )}
      submitLabel="Erstellen" />,
  );
  return (
    <Card title="Spielserver (FiveM)" right={<button className="btn sm" onClick={create}>+ Schlüssel</button>}>
      <p className="small muted" style={{ marginTop: 0 }}>Der Spielserver meldet Dienstbeginn und -ende, Notrufe (→ Einsätze), Zahlungen von Rechnungen, Rundenzeiten und Fahndungen; er fragt Kennzeichen ab. Ein Schlüssel gilt nur für diese Firma.</p>
      {d.gameKeys.map((k) => (
        <div key={k.id} className="li">
          <div className={`ib ${k.revoked ? '' : 'ok'}`}><Icon name="plug" /></div>
          <div className="tx"><b>{k.name}</b><span className="mono">{k.prefix}… · {k.revoked ? 'widerrufen' : k.lastUsedAt ? `zuletzt ${formatAgo(k.lastUsedAt)}` : 'noch nie benutzt'}</span></div>
          {!k.revoked && <button className="btn sm ghost" onClick={() => app.act(() => api.post(app.c(`/game-keys/${k.id}/revoke`)), 'Widerrufen')}>Widerrufen</button>}
        </div>
      ))}
      {!d.gameKeys.length && <p className="muted small" style={{ margin: 0 }}>Noch kein Schlüssel.</p>}
    </Card>
  );
}
