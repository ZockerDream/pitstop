// Dienstplan (geplante Schichten je Woche) und Lohn & Provision (Stundenlohn, Lohnlauf aus der Stempeluhr, Auszahlung).
import { useState } from 'react';
import { formatDate, formatMinutes, formatTime, formatUsd } from '../../../shared/format';
import type { Absence, Shift } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Avatar, Card, Confirm, Empty, FormModal, Kpi, PageHead, Pill, Table } from '../ui';
import { memberName, sum } from './helpers';

const DAY = 86_400_000;
const isoDay = (t: number) => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const mondayOf = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };
const local = (iso: string) => { const d = new Date(iso); return `${isoDay(d.getTime())}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function openShift(app: AppCtx, s: Partial<Shift> & { day?: string }) {
  const d = app.data!;
  const own = d.rights.areas.dienstplan.own;
  const day = s.day ?? isoDay(Date.now());
  const people: [string, string][] = own ? [[app.me.user.id, app.me.user.displayName]] : d.members.filter((m) => !m.locked).map((m) => [m.userId, m.displayName]);
  app.overlay(
    <FormModal
      title={s.id ? 'Schicht ändern' : 'Schicht planen'}
      fields={[
        { name: 'userId', label: 'Person', type: 'select', options: people, required: true },
        { name: 'date', label: 'Tag', type: 'date', required: true },
        { name: 'from', label: 'Von (HH:MM)', required: true, placeholder: '18:00' },
        { name: 'to', label: 'Bis (HH:MM, nach Mitternacht = nächster Tag)', required: true, placeholder: '23:00' },
        { name: 'role', label: 'Aufgabe', placeholder: 'Werkstatt, Abschlepp, Rennteam …' },
        { name: 'note', label: 'Notiz' },
      ]}
      initial={{
        userId: s.userId ?? people[0]?.[0], date: s.startsAt ? local(s.startsAt).slice(0, 10) : day,
        from: s.startsAt ? local(s.startsAt).slice(11) : '18:00', to: s.endsAt ? local(s.endsAt).slice(11) : '23:00', role: s.role ?? '', note: s.note ?? '',
      }}
      submit={(v) => {
        const t = (hm: unknown) => { const m = /^(\d{1,2})[:.](\d{2})$/.exec(String(hm).trim()); if (!m) throw new Error('Uhrzeit als HH:MM'); return [Number(m[1]), Number(m[2])]; };
        const [fh, fm] = t(v.from), [th, tm] = t(v.to);
        const start = new Date(`${v.date}T00:00`); start.setHours(fh, fm);
        const end = new Date(`${v.date}T00:00`); end.setHours(th, tm);
        if (end <= start) end.setDate(end.getDate() + 1);
        const body = { userId: v.userId, startsAt: start.toISOString(), endsAt: end.toISOString(), role: v.role, note: v.note };
        return s.id ? api.patch(app.c(`/shifts/${s.id}`), body) : api.post(app.c('/shifts'), body);
      }}
      onDone={() => app.toast('Schicht gespeichert')}
    >
      {s.id && <button type="button" className="btn sm ghost" style={{ alignSelf: 'flex-start' }} onClick={() => app.overlay(<Confirm title="Schicht löschen?" text="Die geplante Schicht wird entfernt." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/shifts/${s.id}`)), 'Schicht gelöscht')} />)}>Schicht löschen</button>}
    </FormModal>,
  );
}

const ABS_LABEL: Record<Absence['kind'], string> = { urlaub: 'Urlaub', krank: 'Krank', schule: 'Schule', pruefung: 'Prüfung', sonstiges: 'Abwesend' };

function openAbsence(app: AppCtx) {
  const d = app.data!;
  const others = app.can('dienstplan', 2) && !d.rights.areas.dienstplan.own;
  app.overlay(
    <FormModal
      title="Abwesenheit eintragen"
      fields={[
        ...(others ? [{ name: 'userId', label: 'Person', type: 'select' as const, options: d.members.filter((m) => !m.locked).map((m) => [m.userId, m.displayName] as [string, string]) }] : []),
        { name: 'kind', label: 'Art', type: 'select', options: Object.entries(ABS_LABEL) as [string, string][] },
        { name: 'dateFrom', label: 'Von', type: 'date', required: true }, { name: 'dateTo', label: 'Bis', type: 'date', required: true }, { name: 'note', label: 'Notiz' },
      ]}
      initial={{ userId: app.me.user.id, kind: 'urlaub', dateFrom: isoDay(Date.now()), dateTo: isoDay(Date.now()) }}
      submit={(v) => api.post(app.c('/absences'), v)}
      onDone={() => app.toast(app.can('dienstplan', 3) ? 'Eingetragen' : 'Beantragt')}
    />,
  );
}

export function openCorrection(app: AppCtx, dutyId?: string) {
  const dt = dutyId ? app.data!.duty.find((x) => x.id === dutyId) : undefined;
  app.overlay(
    <FormModal
      title={dt ? 'Dienstzeit korrigieren' : 'Dienstzeit nachtragen'}
      fields={[{ name: 'startedAt', label: 'Beginn', type: 'datetime', required: true }, { name: 'endedAt', label: 'Ende', type: 'datetime', required: true }, { name: 'reason', label: 'Grund (z. B. „Einsatz Paleto Bay, Stempeln vergessen“)', required: true }]}
      initial={dt ? { startedAt: dt.startedAt, endedAt: dt.endedAt ?? '' } : {}}
      submit={(v) => api.post(app.c('/corrections'), { ...v, dutyId: dutyId ?? null })}
      onDone={() => app.toast('Nachtrag beantragt')}
      submitLabel="Beantragen"
    />,
  );
}

export function DienstplanPage() {
  const app = useApp();
  const d = app.data!;
  const [week, setWeek] = useState(() => mondayOf(Date.now()));
  const edit = app.can('dienstplan', 2);
  const days = Array.from({ length: 7 }, (_, i) => week + i * DAY);
  const inWeek = d.shifts.filter((s) => { const t = new Date(s.startsAt).getTime(); return t >= week && t < week + 7 * DAY; });
  const people = [...new Set([...d.members.filter((m) => !m.locked).map((m) => m.userId)])].filter((id) => !d.rights.areas.dienstplan.own || id === app.me.user.id);
  const [now] = useState(() => Date.now());
  const today = isoDay(now);
  const hours = (id: string) => sum(inWeek.filter((s) => s.userId === id).map((s) => (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000));
  const worked = (id: string) => sum(d.duty.filter((x) => x.userId === id && Date.parse(x.startedAt) >= week && Date.parse(x.startedAt) < week + 7 * DAY).map((x) => ((x.endedAt ? Date.parse(x.endedAt) : now) - Date.parse(x.startedAt)) / 60000));
  const absent = (id: string, day: string) => d.absences.find((a) => a.userId === id && a.status !== 'abgelehnt' && a.dateFrom <= day && a.dateTo >= day);
  const decideAbs = app.can('dienstplan', 3);
  const decideCorr = app.can('dienstzeiten', 3);
  const pendingCorr = d.corrections.filter((k) => k.status === 'beantragt');
  const absList = d.absences.filter((a) => a.dateTo >= today && a.status !== 'abgelehnt');
  return (
    <>
      <PageHead eyebrow="Personal" title="Dienstplan" sub={`Woche ab ${formatDate(isoDay(week))} · ${inWeek.length} Schichten geplant`}>
        <button className="btn" onClick={() => setWeek(week - 7 * DAY)} aria-label="Vorige Woche">‹</button>
        <button className="btn" onClick={() => setWeek(mondayOf(Date.now()))}>Heute</button>
        <button className="btn" onClick={() => setWeek(week + 7 * DAY)} aria-label="Nächste Woche">›</button>
        {!d.rights.support && <button className="btn" onClick={() => openAbsence(app)}>Abwesenheit</button>}
        {edit && <button className="btn pri" onClick={() => openShift(app, {})}><Icon name="plus" size={15} /> Schicht</button>}
      </PageHead>
      <Card>
        <div className="tw">
          <table className="t roster">
            <thead>
              <tr>
                <th>Person</th>
                {days.map((t) => <th key={t} className={`c ${isoDay(t) === today ? 'today' : ''}`}>{new Date(t).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric' })}</th>)}
                <th className="r">Soll / Ist</th>
              </tr>
            </thead>
            <tbody>
              {people.map((id) => (
                <tr key={id}>
                  <td><div className="row" style={{ gap: 8 }}><Avatar name={memberName(d, id)} size={24} /><span className="small"><b>{memberName(d, id)}</b></span></div></td>
                  {days.map((t) => {
                    const list = inWeek.filter((s) => s.userId === id && isoDay(new Date(s.startsAt).getTime()) === isoDay(t));
                    const mine = id === app.me.user.id || !d.rights.areas.dienstplan.own;
                    const ab = absent(id, isoDay(t));
                    return (
                      <td key={t} className="c" style={{ minWidth: 92 }}>
                        {ab && <Pill tone="warn" dot={ab.status === 'beantragt'}>{ABS_LABEL[ab.kind]}{ab.status === 'beantragt' ? '?' : ''}</Pill>}
                        {list.map((s) => (
                          <button key={s.id} className="shift" disabled={!edit || !mine} onClick={() => openShift(app, s)} title={s.note || s.role}>
                            <b>{formatTime(s.startsAt)}–{formatTime(s.endsAt)}</b>{s.role && <span>{s.role}</span>}
                          </button>
                        ))}
                        {edit && mine && !list.length && !ab && <button className="shift add" onClick={() => openShift(app, { userId: id, day: isoDay(t) })} aria-label="Schicht planen">+</button>}
                      </td>
                    );
                  })}
                  <td className="r mono">{formatMinutes(hours(id))} / {formatMinutes(worked(id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!people.length && <Empty title="Niemand im Team" />}
      </Card>
      <div className="g g3" style={{ marginTop: 14 }}>
        <Card title="Stempeluhr jetzt">
          {d.members.filter((m) => m.onDutySince).map((m) => <div key={m.userId} className="li"><Avatar name={m.displayName} size={26} /><div className="tx"><b>{m.displayName.split(' ')[0]}</b><span>seit {formatTime(m.onDutySince!)}</span></div><span className="mono small">{formatMinutes((now - Date.parse(m.onDutySince!)) / 60000)}</span></div>)}
          {!d.members.some((m) => m.onDutySince) && <p className="muted small" style={{ margin: 0 }}>Gerade niemand im Dienst.</p>}
        </Card>
        <Card title="Abwesend">
          {absList.map((a) => (
            <div key={a.id} className="li">
              <div className="ib warn"><Icon name="cal" /></div>
              <div className="tx"><b>{memberName(d, a.userId)} · {ABS_LABEL[a.kind]}</b><span>{formatDate(a.dateFrom)}{a.dateTo !== a.dateFrom ? `–${formatDate(a.dateTo)}` : ''} · {a.status}{a.note ? ` · ${a.note}` : ''}</span></div>
              {a.status === 'beantragt' && decideAbs && a.userId !== app.me.user.id && <span className="row" style={{ gap: 4 }}><button className="btn sm" onClick={() => app.act(() => api.post(app.c(`/absences/${a.id}/decide`), { ok: true }), 'Genehmigt')}>Ok</button><button className="btn sm ghost" onClick={() => app.act(() => api.post(app.c(`/absences/${a.id}/decide`), { ok: false }), 'Abgelehnt')}>Nein</button></span>}
              {(decideAbs || (a.userId === app.me.user.id && a.status === 'beantragt')) && <button className="ibtn" aria-label="Abwesenheit löschen" onClick={() => app.act(() => api.del(app.c(`/absences/${a.id}`)), 'Gelöscht')}><Icon name="x" size={13} /></button>}
            </div>
          ))}
          {!absList.length && <p className="muted small" style={{ margin: 0 }}>Niemand eingetragen.</p>}
        </Card>
        <Card title="Nachträge" right={!d.rights.support && <button className="btn sm" onClick={() => openCorrection(app)}>+ Nachtrag</button>}>
          {(decideCorr ? pendingCorr : d.corrections.slice(0, 5)).map((k) => (
            <div key={k.id} className="li">
              <div className="ib info"><Icon name="clock" /></div>
              <div className="tx"><b>{memberName(d, k.userId).split(' ')[0]}: {formatDate(k.startedAt)} {formatTime(k.startedAt)}–{formatTime(k.endedAt)}</b><span>{k.reason}{k.status !== 'beantragt' ? ` · ${k.status}` : ''}</span></div>
              {decideCorr && k.status === 'beantragt' && k.userId !== app.me.user.id && <span className="row" style={{ gap: 4 }}><button className="btn sm" onClick={() => app.act(() => api.post(app.c(`/corrections/${k.id}/decide`), { ok: true }), 'Nachtrag genehmigt')}>Genehmigen</button><button className="btn sm ghost" aria-label="Ablehnen" onClick={() => app.act(() => api.post(app.c(`/corrections/${k.id}/decide`), { ok: false }), 'Abgelehnt')}><Icon name="x" size={13} /></button></span>}
            </div>
          ))}
          {!(decideCorr ? pendingCorr : d.corrections).length && <p className="muted small" style={{ margin: 0 }}>{decideCorr ? 'Nichts zu genehmigen.' : 'Vergessen zu stempeln? Hier nachtragen.'}</p>}
        </Card>
      </div>
    </>
  );
}

function openWage(app: AppCtx, userId: string) {
  const w = app.data!.wages.find((x) => x.userId === userId);
  app.overlay(
    <FormModal
      title={`Lohn: ${memberName(app.data, userId)}`}
      fields={[{ name: 'wageCents', label: 'Stundenlohn', type: 'usd' }, { name: 'commissionPct', label: 'Provision in % auf bezahlte Rechnungen eigener Aufträge und Einsätze', type: 'number' }, { name: 'fixedCents', label: 'Fixum je Lohnlauf (nur wenn im Zeitraum gearbeitet)', type: 'usd' }]}
      initial={{ wageCents: w?.wageCents ?? 0, commissionPct: w?.commissionPct ?? 0, fixedCents: w?.fixedCents ?? 0 }}
      submit={async (v) => {
        await api.patch(app.c(`/wages/${userId}`), { wageCents: v.wageCents, commissionPct: Number(v.commissionPct ?? 0) });
        return api.patch(app.c(`/wages/${userId}/fixed`), { fixedCents: v.fixedCents });
      }}
      onDone={() => app.toast('Lohnangaben gespeichert')}
    />,
  );
}

export function LohnPage() {
  const app = useApp();
  const d = app.data!;
  const manage = app.can('lohn', 3);
  const own = d.rights.areas.lohn.own;
  const open = d.payslips.filter((p) => p.status === 'offen');
  const [now] = useState(() => Date.now());
  const lastMonday = mondayOf(now) - 7 * DAY;
  const run = () => app.overlay(
    <FormModal
      title="Lohnlauf"
      fields={[{ name: 'from', label: 'Von', type: 'date', required: true }, { name: 'to', label: 'Bis', type: 'date', required: true }]}
      initial={{ from: isoDay(lastMonday), to: isoDay(lastMonday + 6 * DAY) }}
      submit={(v) => api.post<{ created: number }>(app.c('/payslips/run'), v)}
      onDone={(r) => app.toast(`${(r as { created: number }).created} Abrechnungen erstellt`)}
      submitLabel="Abrechnen"
    >
      <p className="small muted" style={{ margin: 0 }}>Stunden aus der Stempeluhr × Stundenlohn, dazu Provision auf bezahlte Rechnungen der Aufträge und Einsätze der Person. Wer im Zeitraum schon eine Abrechnung hat, wird übersprungen.</p>
    </FormModal>,
  );
  return (
    <>
      <PageHead eyebrow="Personal" title="Lohn & Provision" sub={own ? 'Deine Abrechnungen' : `${open.length} offene Abrechnungen · ${formatUsd(sum(open.map((p) => p.totalCents)))}`}>
        {manage && <button className="btn pri" onClick={run}><Icon name="cash" size={15} /> Lohnlauf</button>}
      </PageHead>
      <div className="g c12">
        <div className="s5">
          <Card title={own ? 'Mein Lohn' : 'Stundenlohn und Provision'}>
            {d.wages.length ? d.wages.map((w) => (
              <div key={w.userId} className="li">
                <Avatar name={memberName(d, w.userId)} size={28} />
                <div className="tx"><b>{memberName(d, w.userId)}</b><span>{w.wageCents ? `${formatUsd(w.wageCents)} / Std.` : 'kein Stundenlohn'}{w.commissionPct ? ` · ${w.commissionPct} % Provision` : ''}{w.fixedCents ? ` · ${formatUsd(w.fixedCents)} fix` : ''}</span></div>
                {manage && <button className="btn sm ghost" onClick={() => openWage(app, w.userId)}>Ändern</button>}
              </div>
            )) : <Empty title="Keine Angaben" />}
          </Card>
        </div>
        <div className="s7">
          <Card title="Abrechnungen">
            {d.payslips.length ? (
              <Table head={['Person', 'Zeitraum', ['Std.', 'r'], ['Gesamt', 'r'], '']}>
                {d.payslips.map((p) => (
                  <tr key={p.id}>
                    <td>{memberName(d, p.userId)}</td>
                    <td className="small">{formatDate(p.periodFrom)} – {formatDate(p.periodTo)}</td>
                    <td className="r mono">{(p.minutes / 60).toFixed(1).replace('.', ',')}</td>
                    <td className="r">
                      <span className="money">{formatUsd(p.totalCents)}</span>
                      <div className="small muted">Lohn {formatUsd(p.wageCents)} · Prov. {formatUsd(p.commissionCents)}{p.fixedCents ? ` · Fix ${formatUsd(p.fixedCents)}` : ''}{p.bonusCents ? ` · Bonus ${formatUsd(p.bonusCents)}` : ''}</div>
                    </td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {p.status === 'bezahlt' ? <Pill tone="ok">ausgezahlt</Pill> : (
                        <>
                          <Pill tone="warn">offen</Pill>{' '}
                          {manage && (
                            <>
                              <button className="btn sm ghost" onClick={() => app.overlay(<FormModal title="Bonus" fields={[{ name: 'bonusCents', label: 'Bonus', type: 'usd' }]} initial={{ bonusCents: p.bonusCents }} submit={(v) => api.patch(app.c(`/payslips/${p.id}`), v)} />)}>Bonus</button>
                              {app.special('lohnzahlung') && <button className="btn sm" onClick={() => app.overlay(<Confirm title="Lohn auszahlen?" text={`${formatUsd(p.totalCents)} an ${memberName(d, p.userId)} – wird als Ausgabe vom Firmenkonto gebucht.`} okLabel="Auszahlen" onOk={() => app.act(() => api.post(app.c(`/payslips/${p.id}/pay`)), 'Lohn ausgezahlt')} />)}>Auszahlen</button>}
                              <button className="btn sm ghost" onClick={() => app.act(() => api.del(app.c(`/payslips/${p.id}`)), 'Abrechnung gelöscht')} aria-label="Abrechnung löschen"><Icon name="x" size={13} /></button>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : <Empty title="Noch keine Abrechnungen">{manage ? 'Mit „Lohnlauf“ einen Zeitraum abrechnen.' : null}</Empty>}
          </Card>
          {!own && d.payslips.length > 0 && (
            <div className="g c12" style={{ marginTop: 14 }}>
              <div className="s6"><Kpi label="Ausgezahlt gesamt" value={formatUsd(sum(d.payslips.filter((p) => p.status === 'bezahlt').map((p) => p.totalCents)))} /></div>
              <div className="s6"><Kpi label="Offen" value={formatUsd(sum(open.map((p) => p.totalCents)))} detail={`${open.length} Abrechnungen`} /></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

