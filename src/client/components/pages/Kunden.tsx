// Kunden ab 0.4: Rahmenverträge (Rabatt Werkstatt/Tuning, Regeln, Abrechnung) und Nachrichten an Kunden mit Textvorlagen.
import { useEffect, useRef, useState } from 'react';
import { formatDate, formatTime, formatUsd } from '../../../shared/format';
import type { Contract } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Avatar, Card, Confirm, Empty, FormModal, PageHead, Pill } from '../ui';
import { customerName, memberName, sum } from './helpers';

const C_STATUS: Record<Contract['status'], [string, string]> = { aktiv: ['aktiv', 'ok'], pruefen: ['prüfen', 'warn'], beendet: ['beendet', ''] };

function contractForm(app: AppCtx, k?: Contract) {
  const d = app.data!;
  app.overlay(
    <FormModal
      title={k ? `Vertrag ${customerName(d, k.customerId)}` : 'Neuer Rahmenvertrag'}
      fields={[
        { name: 'customerId', label: 'Kunde', type: 'select', options: d.customers.map((c) => [c.id, c.name]) },
        { name: 'title', label: 'Bezeichnung (z. B. „Wartung Streifenwagen“)' },
        { name: 'workshopPct', label: 'Rabatt Werkstatt in %', type: 'number' },
        { name: 'tuningPct', label: 'Rabatt Tuning in % (gilt automatisch im Konfigurator)', type: 'number' },
        { name: 'rules', label: 'Regeln (z. B. „keine Optik-Änderungen, Vorrang bei Einsätzen“)', type: 'textarea' },
        { name: 'billing', label: 'Abrechnung (z. B. „Sammelrechnung monatlich“)' },
        { name: 'validUntil', label: 'Gültig bis (leer = unbefristet)', type: 'date' },
        { name: 'status', label: 'Status', type: 'select', options: Object.entries(C_STATUS).map(([v, [l]]) => [v, l]) },
      ]}
      initial={k ?? { customerId: d.customers.find((c) => c.kind !== 'privat')?.id ?? d.customers[0]?.id, status: 'aktiv', workshopPct: 10, tuningPct: 0 }}
      submit={(v) => {
        const body = { ...v, workshopPct: v.workshopPct ?? 0, tuningPct: v.tuningPct ?? 0 };
        return k ? api.patch(app.c(`/contracts/${k.id}`), body) : api.post(app.c('/contracts'), body);
      }}
      onDone={() => app.toast('Vertrag gespeichert')}
    />,
  );
}

export function VertraegePage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('vertraege', 2);
  const today = new Date().toISOString().slice(0, 10);
  const year = String(new Date().getFullYear());
  const revenue = (cid: string) => sum(d.bills.filter((b) => b.customerId === cid && b.status === 'bezahlt' && (b.paidAt ?? '').startsWith(year)).map((b) => b.amountCents));
  const list = [...d.contracts].sort((a, b) => (a.status === 'beendet' ? 1 : 0) - (b.status === 'beendet' ? 1 : 0));
  return (
    <>
      <PageHead eyebrow="Kunden" title="Rahmenverträge" sub="Feste Konditionen für Fraktionen und Firmenkunden">
        {edit && d.customers.length > 0 && <button className="btn pri" onClick={() => contractForm(app)}><Icon name="plus" size={15} /> Vertrag</button>}
      </PageHead>
      {list.length ? (
        <div className="g g2">
          {list.map((k) => {
            const expired = k.validUntil && k.validUntil < today;
            const [label, tone] = expired && k.status === 'aktiv' ? ['abgelaufen', 'bad'] : C_STATUS[k.status];
            return (
              <Card key={k.id}>
                <div className="row"><div className="ib info"><Icon name="doc" /></div><div className="grow"><b style={{ fontSize: 16 }}>{customerName(d, k.customerId)}</b><div className="small muted">{k.title || 'Rahmenvertrag'} · {k.validUntil ? `läuft bis ${formatDate(k.validUntil)}` : 'unbefristet'}</div></div><Pill tone={tone}>{label}</Pill></div>
                <dl className="kv" style={{ marginTop: 12 }}>
                  <dt>Rabatt</dt><dd>{[k.workshopPct && `${k.workshopPct} % Werkstatt`, k.tuningPct && `${k.tuningPct} % Tuning`].filter(Boolean).join(' · ') || 'keiner'}</dd>
                  <dt>Regeln</dt><dd>{k.rules || '–'}</dd>
                  <dt>Abrechnung</dt><dd>{k.billing || '–'}</dd>
                  {app.can('rechnungen') && <><dt>Umsatz {year}</dt><dd className="money">{formatUsd(revenue(k.customerId))}</dd></>}
                </dl>
                {edit && <div className="row" style={{ marginTop: 12, gap: 6 }}><button className="btn sm" onClick={() => contractForm(app, k)}>Bearbeiten</button>{app.can('vertraege', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title="Vertrag löschen?" text="Die Konditionen gelten danach nicht mehr." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/contracts/${k.id}`)), 'Gelöscht')} />)}>Löschen</button>}</div>}
              </Card>
            );
          })}
        </div>
      ) : <Card><Empty title="Noch keine Rahmenverträge">{edit ? 'Zum Beispiel für LSPD, EMS oder ein Taxiunternehmen.' : null}</Empty></Card>}
    </>
  );
}

// --- Nachrichten -----------------------------------------------------------
const DEFAULT_TEMPLATES = ['Dein Fahrzeug ist fertig und kann abgeholt werden.', 'Die Teile sind bestellt, wir melden uns.', 'Der Abschlepper ist unterwegs.', 'Deine Rechnung ist noch offen.'];

function templatesForm(app: AppCtx) {
  const t = app.data!.company.extra.templates ?? DEFAULT_TEMPLATES;
  app.overlay(<FormModal title="Textvorlagen" fields={[{ name: 't', label: 'Eine Vorlage je Zeile', type: 'textarea', required: true }]} initial={{ t: t.join('\n') }} submit={(v) => api.patch(app.c('/extra'), { templates: String(v.t).split('\n').map((x) => x.trim()).filter(Boolean) })} onDone={() => app.toast('Vorlagen gespeichert')} />);
}

export function NachrichtenPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('nachrichten', 2);
  const threads = d.customers
    .map((c) => ({ c, msgs: d.messages.filter((m) => m.customerId === c.id) }))
    .filter((t) => t.msgs.length)
    .sort((a, b) => b.msgs[b.msgs.length - 1].createdAt.localeCompare(a.msgs[a.msgs.length - 1].createdAt));
  const [cur, setCur] = useState<string>(() => app.param || threads[0]?.c.id || '');
  const [text, setText] = useState('');
  const [dir, setDir] = useState<'out' | 'in'>('out');
  const end = useRef<HTMLDivElement>(null);
  const convo = d.messages.filter((m) => m.customerId === cur);
  const unread = (cid: string) => d.messages.filter((m) => m.customerId === cid && !m.read).length;
  const templates = d.company.extra.templates ?? DEFAULT_TEMPLATES;
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
    if (cur && edit && d.messages.some((m) => m.customerId === cur && !m.read)) void api.post(app.c('/messages/read'), { customerId: cur }).then(() => app.reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, convo.length]);
  const send = async () => {
    if (!text.trim() || !cur) return;
    const r = await app.act(() => api.post(app.c('/messages'), { customerId: cur, dir, text: text.trim() }));
    if (r) setText('');
  };
  const others = d.customers.filter((c) => !threads.some((t) => t.c.id === c.id));
  return (
    <>
      <PageHead eyebrow="Kunden" title="Nachrichten" sub="Kunden direkt informieren, wie per Handy im Spiel">
        {app.can('nachrichten', 3) && <button className="btn" onClick={() => templatesForm(app)}>Vorlagen</button>}
      </PageHead>
      <div className="g c12">
        <div className="s4">
          <Card>
            {threads.map(({ c, msgs }) => {
              const last = msgs[msgs.length - 1];
              const n = unread(c.id);
              return (
                <div key={c.id} className="li" data-o onClick={() => setCur(c.id)} style={c.id === cur ? { background: 'var(--panel-2)', margin: '0 -8px', padding: '0 8px', borderRadius: 10 } : undefined}>
                  <Avatar name={c.name} size={32} color="var(--panel-3)" />
                  <div className="tx"><b>{c.name}</b><span>{last.dir === 'out' ? 'Du: ' : ''}{last.text}</span></div>
                  <div style={{ textAlign: 'right' }}><span className="small dim">{formatTime(last.createdAt)}</span>{n > 0 && <div><span className="pill acc" style={{ padding: '0 7px', marginTop: 3 }}>{n}</span></div>}</div>
                </div>
              );
            })}
            {!threads.length && <p className="muted small" style={{ margin: 0 }}>Noch keine Unterhaltungen.</p>}
            {edit && others.length > 0 && (
              <select style={{ marginTop: 10, width: '100%' }} value="" onChange={(e) => setCur(e.target.value)} aria-label="Neue Unterhaltung">
                <option value="">+ Neue Unterhaltung …</option>
                {others.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
          </Card>
        </div>
        <div className="s8">
          {cur ? (
            <Card title={customerName(d, cur)} right={<a className="link" href={`#kunden/${cur}`}>Akte</a>}>
              <div className="chat" style={{ maxHeight: '52vh', overflowY: 'auto' }}>
                {convo.map((m) => <div key={m.id} className={`msg ${m.dir === 'out' ? 'me' : 'them'}`} title={`${formatDate(m.createdAt)} ${formatTime(m.createdAt)} · ${m.dir === 'out' ? memberName(d, m.userId) : `eingetragen von ${memberName(d, m.userId)}`}`}>{m.text}</div>)}
                {!convo.length && <p className="muted small">Noch nichts geschrieben.</p>}
                <div ref={end} />
              </div>
              {edit && (
                <>
                  <div className="row" style={{ marginTop: 14, gap: 8, alignItems: 'flex-end' }}>
                    <div className="field grow"><label htmlFor="chat-in">{dir === 'out' ? 'Nachricht' : 'Antwort des Kunden eintragen'}</label><input id="chat-in" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void send()} placeholder={dir === 'out' ? `Nachricht an ${customerName(d, cur)} …` : 'Was hat der Kunde geschrieben?'} /></div>
                    <button className="btn pri" onClick={() => void send()} aria-label="Senden"><Icon name="send" size={15} /></button>
                  </div>
                  <div className="row wrap" style={{ marginTop: 10, gap: 6 }}>
                    <button className={`chip ${dir === 'in' ? 'on' : ''}`} onClick={() => setDir(dir === 'out' ? 'in' : 'out')} title="Nachrichten des Kunden im Spiel hier mitschreiben">{dir === 'out' ? 'Antwort eintragen' : 'Zurück zu: selbst schreiben'}</button>
                    {dir === 'out' && templates.map((t) => <button key={t} className="chip" onClick={() => setText(t)}>{t.length > 32 ? `${t.slice(0, 30)}…` : t}</button>)}
                  </div>
                </>
              )}
            </Card>
          ) : <Card><Empty title="Unterhaltung wählen" /></Card>}
        </div>
      </div>
    </>
  );
}
