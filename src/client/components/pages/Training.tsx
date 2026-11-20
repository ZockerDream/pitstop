// Schulungen: Mein Lernen (Lektionen, Test, Ergebnis), Kurse anlegen/bearbeiten, Nachweise aller mit Praxisprüfung.
import { useState } from 'react';
import { formatDate, formatDateTime } from '../../../shared/format';
import type { Course, CourseProgress, CourseSession, License, Lesson, Question } from '../../../shared/types';
import { api, errorMessage } from '../../lib/api';
import { useApp, type AppCtx } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Avatar, Card, Confirm, Drawer, Empty, FormModal, Modal, PageHead, Pill, Table } from '../ui';
import { memberName, memberOptions } from './helpers';

const todayIso = () => new Date().toISOString().slice(0, 10);
const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

export function progressOf(d: AppCtx['data'], courseId: string, userId: string): CourseProgress | undefined {
  return d?.progress.find((p) => p.courseId === courseId && p.userId === userId);
}
export function percent(c: Course, p: CourseProgress | undefined): number {
  if (!p) return 0;
  if (p.passedAt) return 100;
  const steps = c.lessons.length + (c.questions.length ? 1 : 0) + (c.practical ? 1 : 0) || 1;
  const done = Math.min(p.lessonsDone, c.lessons.length) + (p.score !== null && p.score >= c.passPct ? 1 : 0) + (c.practical && p.practicalOk ? 1 : 0);
  return Math.round((done / steps) * 100);
}
/** Status eines Nachweises: bestanden, läuft bald ab, abgelaufen, in Arbeit, offen. */
export function statusOf(c: Course, p: CourseProgress | undefined): [string, string] {
  if (p?.passedAt) {
    if (p.expiresAt && p.expiresAt < todayIso()) return ['abgelaufen', 'bad'];
    if (p.expiresAt && p.expiresAt <= inDays(30)) return [`läuft ab ${formatDate(p.expiresAt)}`, 'warn'];
    return [p.expiresAt ? `gültig bis ${formatDate(p.expiresAt)}` : 'bestanden', 'ok'];
  }
  if (p && pendingOf(p) > 0) return ['wird bewertet', 'info'];
  if (p && p.score !== null && p.score >= c.passPct && c.practical && !p.practicalOk) return ['Praxis fehlt', 'info'];
  if (p && (p.lessonsDone > 0 || p.score !== null)) return [`${percent(c, p)} %`, ''];
  return ['offen', ''];
}
/** Freitext-Antworten, die noch niemand bewertet hat. */
export const pendingOf = (p: CourseProgress) => Object.keys(p.answers ?? {}).filter((k) => p.review?.[k] === undefined).length;
export const isRequired = (c: Course, groups: string[]) => c.requiredGroups.includes('alle') || c.requiredGroups.some((g) => groups.includes(g));

function CourseRunner({ course }: { course: Course }) {
  const app = useApp();
  const d = app.data!;
  const p = progressOf(d, course.id, app.me.user.id);
  const done = p?.lessonsDone ?? 0;
  const blank = () => course.questions.map((q) => (q.kind === 'text' ? '' : -1));
  const [answers, setAnswers] = useState<(number | string)[]>(blank);
  const [result, setResult] = useState<{ score: number; right: number; total: number; passed: boolean; needsPractical: boolean; pending: number } | null>(null);
  const incomplete = answers.some((a, i) => (course.questions[i].kind === 'text' ? !String(a).trim() : a === -1));
  const [busy, setBusy] = useState(false);
  const allRead = done >= course.lessons.length;
  const submit = async () => {
    setBusy(true);
    try {
      setResult(await api.post(app.c(`/courses/${course.id}/test`), { answers }));
      await app.reload();
    } catch (err) {
      app.toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Drawer title={course.name} sub={`${course.category} · ${course.lessons.length} Lektionen${course.questions.length ? ` · Test ab ${course.passPct} %` : ''}${course.practical ? ' · mit Praxisprüfung' : ''}`} onClose={() => app.overlay(null)}>
      <div className="stack">
        <div className="bar"><i style={{ width: `${percent(course, p)}%` }} /></div>
        {course.lessons.map((l: Lesson, i: number) => (
          <div key={i} className={`lesson ${i < done ? 'done' : ''}`}>
            <div className="row"><b className="grow">{i + 1}. {l.title}</b>{i < done && <Pill tone="ok">gelesen</Pill>}</div>
            {i <= done && <p className="small" style={{ whiteSpace: 'pre-wrap', margin: '8px 0 0' }}>{l.text || '–'}</p>}
            {i === done && <button className="btn sm pri" style={{ marginTop: 10 }} onClick={() => app.act(() => api.post(app.c(`/courses/${course.id}/lesson`), { done: i + 1 }))}>Gelesen, weiter</button>}
          </div>
        ))}
        {course.questions.length > 0 && (
          <Card title="Test">
            {!allRead ? <p className="muted small" style={{ margin: 0 }}>Erst alle Lektionen lesen.</p> : result ? (
              <div className="stack">
                <div className={`alert ${result.passed ? 'ok' : result.needsPractical || result.pending ? 'info' : 'bad'}`}>
                  <Icon name={result.passed ? 'check' : 'alert'} />
                  <div>{result.pending ? <><b>Abgegeben.</b> {result.right} Antworten sind schon richtig; {result.pending} Freitext-Antworten bewertet ein Trainer unter „Prüfungen & Termine“.</> : <><b>{result.score} %</b> ({result.right} von {result.total} richtig). {result.passed ? 'Bestanden – der Nachweis ist eingetragen.' : result.needsPractical ? 'Test bestanden. Es fehlt noch die Praxisprüfung bei einem Trainer.' : `Nicht bestanden, nötig sind ${course.passPct} %.`}</>}</div>
                </div>
                {!result.passed && !result.needsPractical && !result.pending && <button className="btn" onClick={() => { setResult(null); setAnswers(blank()); }}>Nochmal versuchen</button>}
              </div>
            ) : (
              <div className="stack quiz">
                {course.questions.map((q: Question, qi: number) => (
                  <fieldset key={qi} style={{ border: 0, padding: 0, margin: 0 }}>
                    <legend><b>{qi + 1}. {q.q}</b></legend>
                    {q.kind === 'text' && <textarea rows={3} aria-label={`Antwort ${qi + 1}`} value={String(answers[qi])} onChange={(e) => setAnswers((a) => a.map((x, k) => (k === qi ? e.target.value : x)))} placeholder="Eigene Antwort" />}
                    {q.kind !== 'text' && q.options.map((o, oi) => (
                      <label key={oi}><input type="radio" name={`q${qi}`} checked={answers[qi] === oi} onChange={() => setAnswers((a) => a.map((x, k) => (k === qi ? oi : x)))} /> {o}</label>
                    ))}
                  </fieldset>
                ))}
                <button className="btn pri" disabled={busy || incomplete} onClick={submit}>Test abgeben</button>
              </div>
            )}
          </Card>
        )}
        {p?.score !== null && p?.score !== undefined && !result && <p className="small muted" style={{ margin: 0 }}>Bisher bestes Ergebnis: {p.score} %{course.practical ? ` · Praxis ${p.practicalOk ? 'bestanden' : 'offen'}` : ''}</p>}
      </div>
    </Drawer>
  );
}

export function LernenPage() {
  const app = useApp();
  const d = app.data!;
  const me = app.me.user.id;
  const must = d.courses.filter((c) => isRequired(c, d.myGroups));
  const other = d.courses.filter((c) => !isRequired(c, d.myGroups));
  const card = (c: Course, req: boolean) => {
    const p = progressOf(d, c.id, me);
    const [st, tone] = statusOf(c, p);
    return (
      <button key={c.id} className="card flat" style={{ textAlign: 'left' }} onClick={() => app.overlay(<CourseRunner course={c} />)}>
        <div className="row"><div className="ib acc"><Icon name="book" /></div><div className="tx grow"><b>{c.name}</b><div className="small muted">{c.category}{c.trainerId ? ` · Trainer ${memberName(d, c.trainerId)}` : ''}</div></div></div>
        <div className="bar" style={{ margin: '12px 0 8px' }}><i style={{ width: `${percent(c, p)}%` }} /></div>
        <div className="row wrap" style={{ gap: 6 }}>{req && <Pill tone="warn" dot={false}>Pflicht</Pill>}<Pill tone={tone}>{st}</Pill>{c.validMonths > 0 && <span className="small muted">gilt {c.validMonths} Monate</span>}</div>
      </button>
    );
  };
  return (
    <>
      <PageHead eyebrow="Schulungen" title="Mein Lernen" sub={`${must.filter((c) => progressOf(d, c.id, me)?.passedAt).length} von ${must.length} Pflichtkursen bestanden`} />
      {!d.courses.length && <Card><Empty title="Noch keine Kurse">{app.can('schulungen', 2) ? 'Unter Schulungen → Kurse den ersten Kurs anlegen.' : 'Die Leitung legt Kurse an.'}</Empty></Card>}
      {must.length > 0 && <><h3 className="sec">Pflicht für dich</h3><div className="g g3">{must.map((c) => card(c, true))}</div></>}
      {other.length > 0 && <><h3 className="sec">Weitere Kurse</h3><div className="g g3">{other.map((c) => card(c, false))}</div></>}
    </>
  );
}

function CourseEditor({ course }: { course?: Course }) {
  const app = useApp();
  const d = app.data!;
  const [c, setC] = useState(() => ({
    name: course?.name ?? '', category: course?.category ?? 'Allgemein', passPct: course?.passPct ?? 70, validMonths: course?.validMonths ?? 0,
    practical: course?.practical ?? false, trainerId: course?.trainerId ?? '', requiredGroups: course?.requiredGroups ?? [],
    lessons: course?.lessons ?? [{ title: '', text: '' }], questions: course?.questions.map((q) => ({ ...q, kind: q.kind ?? 'choice', correct: q.kind === 'text' ? -1 : Math.max(0, q.correct) })) ?? [],
  }));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<typeof c>) => setC((x) => ({ ...x, ...p }));
  const groups: [string, string][] = [['alle', 'Alle in der Firma'], ...d.groups.filter((g) => !g.isOwner).map((g) => [g.id, g.name] as [string, string])];
  const save = async () => {
    setBusy(true);
    try {
      const body = { ...c, trainerId: c.trainerId || null, lessons: c.lessons.filter((l) => l.title.trim()), questions: c.questions.filter((q) => q.q.trim()).map((q) => (q.kind === 'text' ? { q: q.q, kind: 'text', options: [], correct: -1 } : { ...q, options: q.options.filter((o) => o.trim()) })) };
      await (course ? api.patch(app.c(`/courses/${course.id}`), body) : api.post(app.c('/courses'), body));
      await app.reload();
      app.overlay(null);
      app.toast('Kurs gespeichert');
    } catch (err) {
      app.toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal title={course ? `Kurs: ${course.name}` : 'Neuer Kurs'} onClose={() => app.overlay(null)}>
      <div className="stack">
        <div className="g g2">
          <div className="field"><label htmlFor="ce-n">Name *</label><input id="ce-n" value={c.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div className="field"><label htmlFor="ce-c">Bereich</label><input id="ce-c" value={c.category} onChange={(e) => set({ category: e.target.value })} /></div>
          <div className="field"><label htmlFor="ce-p">Bestehen ab %</label><input id="ce-p" inputMode="numeric" value={c.passPct} onChange={(e) => set({ passPct: Number(e.target.value) || 0 })} /></div>
          <div className="field"><label htmlFor="ce-v">Gültig (Monate, 0 = immer)</label><input id="ce-v" inputMode="numeric" value={c.validMonths} onChange={(e) => set({ validMonths: Number(e.target.value) || 0 })} /></div>
          <div className="field"><label htmlFor="ce-t">Trainer</label><select id="ce-t" value={c.trainerId} onChange={(e) => set({ trainerId: e.target.value })}>{memberOptions(d).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
          <label className="row small" style={{ gap: 8, alignSelf: 'end' }}><input type="checkbox" checked={c.practical} onChange={(e) => set({ practical: e.target.checked })} /> Praxisprüfung nötig</label>
        </div>
        <div>
          <div className="small muted" style={{ marginBottom: 6 }}>Pflicht für</div>
          <div className="chips">{groups.map(([id, n]) => <button key={id} type="button" className={`chip ${c.requiredGroups.includes(id) ? 'on' : ''}`} onClick={() => set({ requiredGroups: c.requiredGroups.includes(id) ? c.requiredGroups.filter((x) => x !== id) : [...c.requiredGroups, id] })}>{n}</button>)}</div>
        </div>
        <h3 className="sec" style={{ margin: 0 }}>Lektionen</h3>
        {c.lessons.map((l, i) => (
          <div key={i} className="lesson stack" style={{ gap: 6 }}>
            <div className="row"><input className="grow" placeholder={`Lektion ${i + 1}: Titel`} value={l.title} onChange={(e) => set({ lessons: c.lessons.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} aria-label={`Titel Lektion ${i + 1}`} /><button type="button" className="ibtn" aria-label="Lektion entfernen" onClick={() => set({ lessons: c.lessons.filter((_, k) => k !== i) })}><Icon name="x" size={14} /></button></div>
            <textarea rows={3} placeholder="Inhalt" value={l.text} onChange={(e) => set({ lessons: c.lessons.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} aria-label={`Inhalt Lektion ${i + 1}`} />
          </div>
        ))}
        <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ lessons: [...c.lessons, { title: '', text: '' }] })}>+ Lektion</button>
        <h3 className="sec" style={{ margin: 0 }}>Testfragen</h3>
        {c.questions.map((q, i) => (
          <div key={i} className="lesson stack" style={{ gap: 6 }}>
            <div className="row"><input className="grow" placeholder={`Frage ${i + 1}`} value={q.q} onChange={(e) => set({ questions: c.questions.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} aria-label={`Frage ${i + 1}`} />
              <select value={q.kind ?? 'choice'} aria-label="Art der Frage" onChange={(e) => set({ questions: c.questions.map((x, k) => (k === i ? { ...x, kind: e.target.value as 'choice' | 'text', correct: e.target.value === 'text' ? -1 : 0, options: e.target.value === 'text' ? [] : x.options.length ? x.options : ['', '', ''] } : x)) })}><option value="choice">Auswahl</option><option value="text">Freitext</option></select>
              <button type="button" className="ibtn" aria-label="Frage entfernen" onClick={() => set({ questions: c.questions.filter((_, k) => k !== i) })}><Icon name="x" size={14} /></button></div>
            {q.kind === 'text' && <p className="small muted" style={{ margin: 0 }}>Freitext: ein Trainer bewertet die Antwort unter „Prüfungen & Termine“.</p>}
            {q.kind !== 'text' && q.options.map((o, oi) => (
              <label key={oi} className="row small" style={{ gap: 8 }}>
                <input type="radio" name={`ce-q${i}`} checked={q.correct === oi} onChange={() => set({ questions: c.questions.map((x, k) => (k === i ? { ...x, correct: oi } : x)) })} aria-label="richtige Antwort" />
                <input className="grow" placeholder={`Antwort ${oi + 1}`} value={o} onChange={(e) => set({ questions: c.questions.map((x, k) => (k === i ? { ...x, options: x.options.map((y, m) => (m === oi ? e.target.value : y)) } : x)) })} />
              </label>
            ))}
            {q.kind !== 'text' && q.options.length < 6 && <button type="button" className="link" style={{ alignSelf: 'flex-start' }} onClick={() => set({ questions: c.questions.map((x, k) => (k === i ? { ...x, options: [...x.options, ''] } : x)) })}>+ Antwort</button>}
          </div>
        ))}
        <button type="button" className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => set({ questions: [...c.questions, { q: '', kind: 'choice', options: ['', '', ''], correct: 0 }] })}>+ Frage</button>
        <p className="small muted" style={{ margin: 0 }}>Der Punkt links markiert die richtige Antwort. Lernende sehen die Lösung nie, der Server wertet aus.</p>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={() => app.overlay(null)}>Abbrechen</button>
          <button className="btn pri" disabled={busy || !c.name.trim()} onClick={save}>Speichern</button>
        </div>
      </div>
    </Modal>
  );
}

export function KursePage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('schulungen', 2);
  return (
    <>
      <PageHead eyebrow="Schulungen" title="Kurse" sub={`${d.courses.length} Kurse`}>
        {edit && <button className="btn pri" onClick={() => app.overlay(<CourseEditor />)}><Icon name="plus" size={15} /> Kurs</button>}
      </PageHead>
      <Card>
        {d.courses.length ? (
          <Table head={['Kurs', 'Pflicht für', ['Bestanden', 'r'], '']}>
            {d.courses.map((c) => {
              const passed = d.progress.filter((p) => p.courseId === c.id && p.passedAt).length;
              return (
                <tr key={c.id}>
                  <td><b>{c.name}</b><div className="small muted">{c.category} · {c.lessons.length} Lektionen · {c.questions.length} Fragen{c.practical ? ' · Praxis' : ''}{c.validMonths ? ` · gilt ${c.validMonths} Monate` : ''}</div></td>
                  <td className="small">{c.requiredGroups.map((g) => (g === 'alle' ? 'alle' : (d.groups.find((x) => x.id === g)?.name ?? '?'))).join(', ') || '–'}</td>
                  <td className="r mono">{passed}</td>
                  <td className="r" style={{ whiteSpace: 'nowrap' }}>
                    {edit && <button className="btn sm ghost" onClick={() => app.overlay(<CourseEditor course={c} />)}>Bearbeiten</button>}
                    {app.can('schulungen', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`${c.name} löschen?`} text="Kurs und alle Nachweise dazu werden gelöscht." okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/courses/${c.id}`)), 'Kurs gelöscht')} />)}>Löschen</button>}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : <Empty title="Noch keine Kurse">{edit ? 'Mit „+ Kurs“ anlegen: Lektionen, Testfragen, Praxisprüfung, Gültigkeit.' : null}</Empty>}
      </Card>
    </>
  );
}

export function NachweisePage() {
  const app = useApp();
  const d = app.data!;
  const people = d.members.filter((m) => !m.locked);
  const canExam = (c: Course) => app.can('schulungen', 2) || c.trainerId === app.me.user.id;
  const exam = (c: Course, userId: string, ok: boolean) => app.act(() => api.post(app.c(`/courses/${c.id}/practical`), { userId, ok }), ok ? 'Praxisprüfung eingetragen' : 'Praxisprüfung zurückgenommen');
  const soon = d.progress.filter((p) => p.expiresAt && p.expiresAt <= inDays(30));
  return (
    <>
      <PageHead eyebrow="Schulungen" title="Nachweise & Lizenzen" sub={`${d.progress.filter((p) => p.passedAt).length} bestanden · ${soon.length} laufen in 30 Tagen ab oder sind abgelaufen`} />
      <Card>
        {d.courses.length ? (
          <Table head={['Person', ...d.courses.map((c) => c.name)]}>
            {people.map((m) => (
              <tr key={m.userId}>
                <td><div className="row" style={{ gap: 8 }}><Avatar name={m.displayName} size={24} /><b className="small">{m.displayName}</b></div></td>
                {d.courses.map((c) => {
                  const p = progressOf(d, c.id, m.userId);
                  const [st, tone] = statusOf(c, p);
                  const need = c.practical && !p?.practicalOk && p?.score !== null && p?.score !== undefined && p.score >= c.passPct;
                  return (
                    <td key={c.id}>
                      <Pill tone={tone}>{st}</Pill>
                      {c.practical && canExam(c) && m.userId !== app.me.user.id && !d.rights.support && (
                        <div style={{ marginTop: 4 }}>
                          {p?.practicalOk
                            ? <button className="link small" onClick={() => exam(c, m.userId, false)}>Praxis zurücknehmen</button>
                            : <button className={need ? 'btn sm' : 'link small'} onClick={() => exam(c, m.userId, true)}>Praxis bestanden</button>}
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </Table>
        ) : <Empty title="Noch keine Kurse" />}
      </Card>
      <div style={{ marginTop: 14 }}><Licenses /></div>
    </>
  );
}

function licenseForm(app: AppCtx, l?: License) {
  app.overlay(
    <FormModal title={l ? l.name : 'Neue Lizenz'} fields={[{ name: 'name', label: 'Lizenz (z. B. Gewerbelizenz, Rennlizenz)', required: true }, { name: 'holderId', label: 'Inhaber (leer = Firma)', type: 'select', options: [['', '– Firma –'], ...app.data!.members.map((m) => [m.userId, m.displayName] as [string, string])] }, { name: 'validUntil', label: 'Gültig bis', type: 'date' }, { name: 'note', label: 'Notiz' }]}
      initial={l ?? {}} submit={(v) => (l ? api.patch(app.c(`/licenses/${l.id}`), v) : api.post(app.c('/licenses'), v))} onDone={() => app.toast('Lizenz gespeichert')}>
      {l && app.can('schulungen', 3) && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => app.act(() => api.del(app.c(`/licenses/${l.id}`)), 'Gelöscht').then(() => app.overlay(null))}>Lizenz löschen</button>}
    </FormModal>,
  );
}

function Licenses() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('schulungen', 2);
  return (
    <Card title="Lizenzen" right={edit && <button className="btn sm" onClick={() => licenseForm(app)}>+ Lizenz</button>}>
      {d.licenses.map((l) => {
        const tone = !l.validUntil ? 'ok' : l.validUntil < todayIso() ? 'bad' : l.validUntil <= inDays(30) ? 'warn' : 'ok';
        return (
          <div key={l.id} className="li" data-o={edit ? '' : undefined} onClick={() => edit && licenseForm(app, l)}>
            <div className={`ib ${tone}`}><Icon name="shield" /></div>
            <div className="tx"><b>{l.name}{l.holderId ? ` · ${memberName(d, l.holderId)}` : ''}</b><span>{l.validUntil ? (tone === 'bad' ? `abgelaufen am ${formatDate(l.validUntil)}` : `gültig bis ${formatDate(l.validUntil)}`) : 'unbefristet'}{l.note ? ` · ${l.note}` : ''}</span></div>
          </div>
        );
      })}
      {!d.licenses.length && <p className="muted small" style={{ margin: 0 }}>Keine Lizenzen erfasst.</p>}
    </Card>
  );
}

// --- Prüfungen & Termine ------------------------------------------------------
const S_KIND: Record<CourseSession['kind'], string> = { praxis: 'Praxis', einfuehrung: 'Einführung', test: 'Test' };

function sessionForm(app: AppCtx, s?: CourseSession) {
  const d = app.data!;
  app.overlay(
    <FormModal
      title={s ? 'Termin ändern' : 'Neuer Termin'}
      fields={[
        { name: 'courseId', label: 'Kurs', type: 'select', options: d.courses.map((c) => [c.id, c.name]) },
        { name: 'kind', label: 'Art', type: 'select', options: Object.entries(S_KIND) as [string, string][] },
        { name: 'startsAt', label: 'Wann', type: 'datetime', required: true },
        { name: 'trainerId', label: 'Trainer', type: 'select', options: memberOptions(d) },
        { name: 'note', label: 'Notiz (Treffpunkt …)' },
      ]}
      initial={s ?? { courseId: d.courses[0]?.id, kind: 'praxis', trainerId: app.me.user.id }}
      submit={(v) => (s ? api.patch(app.c(`/course-sessions/${s.id}`), v) : api.post(app.c('/course-sessions'), v))}
      onDone={() => app.toast('Termin gespeichert')}
    >
      {s && <button type="button" className="btn ghost sm" style={{ alignSelf: 'flex-start' }} onClick={() => app.act(() => api.del(app.c(`/course-sessions/${s.id}`)), 'Termin gelöscht').then(() => app.overlay(null))}>Termin löschen</button>}
    </FormModal>,
  );
}

export function PruefungenPage() {
  const app = useApp();
  const d = app.data!;
  const me = app.me.user.id;
  const manage = app.can('schulungen', 2);
  const coach = (c: Course) => manage || c.trainerId === me;
  const [now] = useState(() => new Date(Date.now() - 2 * 3_600_000).toISOString());
  const sessions = d.sessions.filter((s) => s.startsAt >= now);
  const course = (id: string) => d.courses.find((c) => c.id === id);
  const practical = d.progress.filter((p) => { const c = course(p.courseId); return c && c.practical && !p.practicalOk && coach(c) && p.userId !== me; })
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const texts = d.progress.flatMap((p) => { const c = course(p.courseId); return c && coach(c) && p.userId !== me ? Object.keys(p.answers ?? {}).filter((k) => p.review?.[k] === undefined).map((k) => ({ p, c, i: Number(k) })) : []; });
  return (
    <>
      <PageHead eyebrow="Schulungen" title="Prüfungen & Termine" sub="Praxisprüfungen abnehmen, Freitext bewerten, Termine planen">
        {manage && d.courses.length > 0 && <button className="btn pri" onClick={() => sessionForm(app)}><Icon name="plus" size={15} /> Termin</button>}
      </PageHead>
      <div className="g c12">
        <div className="s7">
          <Card title="Termine">
            {sessions.length ? (
              <Table head={['Wann', 'Kurs', 'Art', 'Trainer', 'Teilnehmer', '']}>
                {sessions.map((s) => {
                  const inIt = s.participants.includes(me);
                  return (
                    <tr key={s.id}>
                      <td className="mono small">{formatDateTime(s.startsAt)}</td>
                      <td><b>{course(s.courseId)?.name}</b>{s.note && <div className="small muted">{s.note}</div>}</td>
                      <td><Pill tone={s.kind === 'praxis' ? 'info' : ''} dot={false}>{S_KIND[s.kind]}</Pill></td>
                      <td>{memberName(d, s.trainerId).split(' ')[0] || '–'}</td>
                      <td><span className="avs">{s.participants.map((u) => <span key={u} title={memberName(d, u)}><Avatar name={memberName(d, u) || '?'} size={22} /></span>)}</span>{!s.participants.length && <span className="small muted">noch niemand</span>}</td>
                      <td className="r" style={{ whiteSpace: 'nowrap' }}>
                        {!d.rights.support && s.trainerId !== me && <button className={`btn sm ${inIt ? 'ghost' : ''}`} onClick={() => app.act(() => api.post(app.c(`/course-sessions/${s.id}/join`), { join: !inIt }), inIt ? 'Abgemeldet' : 'Angemeldet')}>{inIt ? 'Abmelden' : 'Anmelden'}</button>}
                        {manage && <button className="btn sm ghost" onClick={() => sessionForm(app, s)}>Ändern</button>}
                      </td>
                    </tr>
                  );
                })}
              </Table>
            ) : <Empty title="Keine Termine geplant" />}
          </Card>
        </div>
        <div className="s5 stack">
          <Card title="Praxisprüfung abnehmen">
            {practical.map((p) => {
              const c = course(p.courseId)!;
              const ready = p.score !== null && p.score >= c.passPct && !pendingOf(p);
              return (
                <div key={`${p.courseId}-${p.userId}`} className="li">
                  <Avatar name={memberName(d, p.userId)} size={30} />
                  <div className="tx"><b>{memberName(d, p.userId)} · {c.name}</b><span>{ready ? `Test ${p.score} % bestanden` : p.score !== null ? `Test ${p.score} %${pendingOf(p) ? ', Freitext offen' : ''}` : `Lektionen ${p.lessonsDone} von ${c.lessons.length}`}</span></div>
                  {ready ? <span className="row" style={{ gap: 4 }}><button className="btn sm pri" onClick={() => app.act(() => api.post(app.c(`/courses/${c.id}/practical`), { userId: p.userId, ok: true }), 'Praxis bestanden')}>Bestanden</button></span> : <Pill dot={false}>{p.score !== null ? 'noch nicht bereit' : 'lernt'}</Pill>}
                </div>
              );
            })}
            {!practical.length && <p className="muted small" style={{ margin: 0 }}>{d.courses.some((c) => c.practical && coach(c)) ? 'Niemand wartet auf eine Praxisprüfung.' : 'Du bist für keinen Kurs mit Praxisprüfung Trainer.'}</p>}
          </Card>
          <Card title="Freitext-Antworten prüfen">
            {texts.map(({ p, c, i }) => (
              <div key={`${p.courseId}-${p.userId}-${i}`} className="li" style={{ alignItems: 'flex-start' }}>
                <div className="ib warn"><Icon name="doc" /></div>
                <div className="tx"><b>{memberName(d, p.userId).split(' ')[0]} · {c.name}, Frage {i + 1}</b><span style={{ whiteSpace: 'normal' }}>{c.questions[i]?.q}</span><span style={{ whiteSpace: 'normal', color: 'var(--fg)' }}>„{p.answers[i]}“</span></div>
                <span className="row" style={{ gap: 4 }}>
                  <button className="btn sm" onClick={() => app.act(() => api.post(app.c(`/courses/${c.id}/review`), { userId: p.userId, index: i, ok: true }), 'Als richtig gewertet')}>Richtig</button>
                  <button className="btn sm ghost" onClick={() => app.act(() => api.post(app.c(`/courses/${c.id}/review`), { userId: p.userId, index: i, ok: false }), 'Als falsch gewertet')}>Falsch</button>
                </span>
              </div>
            ))}
            {!texts.length && <p className="muted small" style={{ margin: 0 }}>Nichts zu bewerten.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}
