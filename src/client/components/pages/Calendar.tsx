// Kalender: Monatsansicht aus Schichten, Events, fälligen Rechnungen und ablaufenden Nachweisen (nur was man sehen darf).
import { useState } from 'react';
import { billLabel, formatDate, formatTime, formatUsd } from '../../../shared/format';
import { useApp, type AppCtx } from '../../lib/app';
import { Card, Empty, PageHead, Seg } from '../ui';
import { memberName } from './helpers';

interface CalItem {
  day: string;
  time?: string;
  text: string;
  kind: 'shift' | 'race' | 'bill' | 'course';
  page: string;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function calendarItems(app: AppCtx, all: boolean): CalItem[] {
  const d = app.data;
  if (!d) return [];
  const me = app.me.user.id;
  const out: CalItem[] = [];
  for (const s of d.shifts) {
    if (!all && s.userId !== me) continue;
    out.push({ day: iso(new Date(s.startsAt)), time: formatTime(s.startsAt), text: s.userId === me ? `Meine Schicht ${formatTime(s.startsAt)}–${formatTime(s.endsAt)}` : `${memberName(d, s.userId).split(' ')[0]} ${formatTime(s.startsAt)}`, kind: 'shift', page: 'dienstplan' });
  }
  for (const e of d.events) if (e.status !== 'abgesagt') out.push({ day: iso(new Date(e.startsAt)), time: formatTime(e.startsAt), text: e.name, kind: 'race', page: 'rennkalender' });
  for (const b of d.bills) if (b.status === 'offen' && b.dueDate) out.push({ day: b.dueDate, text: `${billLabel(b.number)} fällig · ${formatUsd(b.amountCents)}`, kind: 'bill', page: 'rechnungen' });
  for (const p of d.progress) {
    if (!p.expiresAt || (!all && p.userId !== me)) continue;
    const c = d.courses.find((x) => x.id === p.courseId);
    if (c) out.push({ day: p.expiresAt, text: `${p.userId === me ? '' : `${memberName(d, p.userId).split(' ')[0]}: `}${c.name} läuft ab`, kind: 'course', page: p.userId === me ? 'lernen' : 'nachweise' });
  }
  return out.sort((a, b) => (a.day + (a.time ?? '')).localeCompare(b.day + (b.time ?? '')));
}

export function KalenderPage() {
  const app = useApp();
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [all, setAll] = useState<'mein' | 'alle'>('mein');
  const items = calendarItems(app, all === 'alle');
  const first = new Date(month);
  first.setDate(1 - ((first.getDay() + 6) % 7));
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const today = iso(new Date());
  const upcoming = items.filter((x) => x.day >= today).slice(0, 12);
  return (
    <>
      <PageHead eyebrow="Übersicht" title="Kalender" sub={month.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}>
        <Seg value={all} options={[['mein', 'Nur meins'], ['alle', 'Alles']]} onChange={setAll} />
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Voriger Monat">‹</button>
        <button className="btn" onClick={() => { const d = new Date(); setMonth(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Heute</button>
        <button className="btn" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Nächster Monat">›</button>
      </PageHead>
      <div className="g c12">
        <div className="s9">
          <Card>
            <div className="cal">
              {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((x) => <div key={x} className="dh2">{x}</div>)}
              {days.map((d) => {
                const k = iso(d);
                const list = items.filter((x) => x.day === k);
                return (
                  <div key={k} className={`day ${d.getMonth() !== month.getMonth() ? 'out' : ''} ${k === today ? 'today' : ''}`}>
                    <b>{d.getDate()}</b>
                    {list.slice(0, 4).map((x, i) => <a key={i} href={`#${x.page}`} className={`ev ev-${x.kind}`} title={x.text}>{x.text}</a>)}
                    {list.length > 4 && <span className="small muted">+{list.length - 4}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
        <div className="s3">
          <Card title="Als Nächstes">
            {upcoming.length ? upcoming.map((x, i) => (
              <a key={i} className="li" href={`#${x.page}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                <span className={`ev ev-${x.kind}`} style={{ width: 8, height: 8, padding: 0, borderRadius: 99 }} />
                <div className="tx"><b>{x.text}</b><span>{formatDate(x.day)}{x.time ? ` · ${x.time}` : ''}</span></div>
              </a>
            )) : <Empty title="Nichts geplant" />}
          </Card>
        </div>
      </div>
    </>
  );
}
