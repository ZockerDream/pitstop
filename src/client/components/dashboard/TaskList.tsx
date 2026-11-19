import { BellRing, CalendarCheck, CarFront, CircleCheck, FileWarning, Plus, Square, UserRoundSearch, type LucideIcon } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { today as getToday } from '../../../shared/dates';
import { derivedTasks, type DerivedTask, type DerivedTaskKind } from '../../../shared/selectors';
import { cx } from '../../lib/cx';
import { navigate } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';
import { useActions, useRun } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { useConfirm } from '../ui/feedback';
import { Input } from '../ui/Field';
import { EmptyState } from '../ui/misc';

const KIND_ICON: Record<DerivedTaskKind, { icon: LucideIcon; className: string }> = {
  approve: { icon: CalendarCheck, className: 'bg-amber-50 text-amber-700' },
  remind: { icon: FileWarning, className: 'bg-rose-50 text-rose-700' },
  inspection: { icon: CarFront, className: 'bg-indigo-50 text-indigo-700' },
  lead: { icon: UserRoundSearch, className: 'bg-sky-50 text-sky-700' },
  decided: { icon: BellRing, className: 'bg-emerald-50 text-emerald-700' },
  manual: { icon: Square, className: 'bg-zinc-100 text-zinc-600' },
};

export function TaskList() {
  const data = useData();
  const can = useCan();
  const actions = useActions();
  const run = useRun();
  const confirm = useConfirm();
  const today = getToday();
  const tasks = useMemo(() => derivedTasks(data, today), [data, today]);
  const [busy, setBusy] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await run(fn);
    setBusy(null);
  };

  const reject = async (t: DerivedTask) => {
    const r = await confirm({ title: 'Urlaubsantrag ablehnen?', message: t.title.replace(' genehmigen', ''), confirmLabel: 'Ablehnen', tone: 'danger', noteLabel: 'Begründung (optional)' });
    if (r.ok) await act(t.key, () => actions.decideAbsence(t.refId, 'rejected', r.note));
  };

  const addTask = async (e: FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim();
    if (!title) return;
    await act('new', async () => {
      await actions.createTask(title, null);
      setNewTitle('');
    });
  };

  const actionsFor = (t: DerivedTask) => {
    const loading = busy === t.key;
    switch (t.kind) {
      case 'approve':
        return (
          <>
            <Button size="xs" variant="success" loading={loading} onClick={() => void act(t.key, () => actions.decideAbsence(t.refId, 'approved'))}>
              Genehmigen
            </Button>
            <Button size="xs" disabled={loading} onClick={() => void reject(t)}>
              Ablehnen
            </Button>
          </>
        );
      case 'remind':
        return (
          <>
            <Button size="xs" variant="primary" loading={loading} onClick={() => void act(t.key, () => actions.remindInvoice(t.refId))}>
              Mahnen
            </Button>
            <Button size="xs" variant="ghost" onClick={() => navigate(`/finanzen/rechnungen/${t.refId}`)}>
              Öffnen
            </Button>
          </>
        );
      case 'inspection':
      case 'lead':
        return (
          <Button size="xs" onClick={() => navigate(`/kunden/${t.refId}`)}>
            Öffnen
          </Button>
        );
      case 'decided':
        return (
          <Button size="xs" loading={loading} onClick={() => void act(t.key, () => actions.markAbsenceSeen(t.refId))}>
            Erledigt
          </Button>
        );
      case 'manual':
        return null;
    }
  };

  return (
    <Card className="flex h-full flex-col">
      <CardHeader
        title="Aufgaben & Freigaben"
        description={tasks.length ? `${tasks.length} offen` : 'Alles erledigt'}
      />
      <ul className="flex-1 divide-y divide-zinc-100 overflow-y-auto lg:max-h-[436px]">
        {tasks.length === 0 && (
          <li>
            <EmptyState icon={CircleCheck} title="Alles erledigt" text="Neue Freigaben und Erinnerungen erscheinen hier automatisch." compact />
          </li>
        )}
        {tasks.map((t) => {
          const meta = KIND_ICON[t.kind];
          return (
            <li key={t.key} className="flex items-start gap-3 px-5 py-3 animate-fade-in">
              {t.kind === 'manual' ? (
                <button
                  type="button"
                  onClick={() => void act(t.key, () => actions.toggleTask(t.refId))}
                  className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg border border-zinc-300 bg-white text-transparent transition-colors hover:border-emerald-500 hover:text-emerald-600"
                  aria-label={`„${t.title}“ als erledigt markieren`}
                >
                  <CircleCheck className="size-4" aria-hidden />
                </button>
              ) : (
                <span className={cx('mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg', meta.className)}>
                  <meta.icon className="size-4" aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-900">{t.title}</p>
                {t.detail && <p className="mt-0.5 text-xs text-zinc-500">{t.detail}</p>}
                {t.kind !== 'manual' && <div className="mt-2 flex flex-wrap gap-1.5">{actionsFor(t)}</div>}
              </div>
            </li>
          );
        })}
      </ul>
      {can('task:manage') && (
        <form onSubmit={addTask} className="flex gap-2 border-t border-zinc-100 px-5 py-3">
          <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Neue Aufgabe …" aria-label="Neue Aufgabe" maxLength={200} />
          <Button type="submit" icon={Plus} loading={busy === 'new'} disabled={!newTitle.trim()} aria-label="Aufgabe hinzufügen" />
        </form>
      )}
    </Card>
  );
}
