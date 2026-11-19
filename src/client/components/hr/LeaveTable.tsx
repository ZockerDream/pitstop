import { CalendarX2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { today as getToday } from '../../../shared/dates';
import { formatDate, formatRange } from '../../../shared/format';
import { absenceKindLabel, absenceStatusLabel, absenceStatusTone } from '../../../shared/labels';
import { absenceWorkdays, byId, employeeName } from '../../../shared/selectors';
import type { Absence, AbsenceKind, AbsenceStatus } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { navigate } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';
import { useActions, useRun } from '../../store/mutations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useConfirm } from '../ui/feedback';
import { Select } from '../ui/Field';
import { Avatar, EmptyState, SegmentedControl, table } from '../ui/misc';

type StatusFilter = AbsenceStatus | 'all';

export function LeaveTable() {
  const data = useData();
  const can = useCan();
  const actions = useActions();
  const run = useRun();
  const confirm = useConfirm();
  const today = getToday();
  const canDecide = can('absence:decide');
  const employees = useMemo(() => byId(data.employees), [data.employees]);
  const hasRequested = data.absences.some((a) => a.status === 'requested' && (canDecide || a.employeeId === data.me.employeeId));
  const [status, setStatus] = useState<StatusFilter>(hasRequested ? 'requested' : 'all');
  const [kind, setKind] = useState<AbsenceKind | 'all'>('all');
  const [scope, setScope] = useState<'all' | 'mine'>(canDecide ? 'all' : 'mine');
  const [busy, setBusy] = useState<string | null>(null);

  const base = data.absences.filter((a) => (scope === 'mine' ? a.employeeId === data.me.employeeId : true) && (kind === 'all' || a.kind === kind));
  const counts = {
    all: base.length,
    requested: base.filter((a) => a.status === 'requested').length,
    approved: base.filter((a) => a.status === 'approved').length,
    rejected: base.filter((a) => a.status === 'rejected').length,
  };
  const visible = base
    .filter((a) => status === 'all' || a.status === status)
    .sort((a, b) => (a.status === 'requested' && b.status !== 'requested' ? -1 : b.status === 'requested' && a.status !== 'requested' ? 1 : b.fromDate.localeCompare(a.fromDate)));

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await run(fn);
    setBusy(null);
  };

  const reject = async (a: Absence) => {
    const e = employees.get(a.employeeId);
    const r = await confirm({
      title: 'Urlaubsantrag ablehnen?',
      message: `${e ? employeeName(e) : ''}, ${formatRange(a.fromDate, a.toDate)}`,
      confirmLabel: 'Ablehnen',
      tone: 'danger',
      noteLabel: 'Begründung (optional, sieht der Antragsteller)',
    });
    if (r.ok) await act(a.id, () => actions.decideAbsence(a.id, 'rejected', r.note));
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
        {data.me.employeeId && (
          <SegmentedControl
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: 'Meine' },
              { value: 'all', label: canDecide ? 'Alle' : 'Team' },
            ]}
          />
        )}
        <SegmentedControl
          value={status}
          onChange={setStatus}
          options={[
            { value: 'requested', label: 'Beantragt', count: counts.requested },
            { value: 'approved', label: 'Genehmigt', count: counts.approved },
            { value: 'rejected', label: 'Abgelehnt', count: counts.rejected },
            { value: 'all', label: 'Alle', count: counts.all },
          ]}
        />
        <Select value={kind} onChange={(e) => setKind(e.target.value as AbsenceKind | 'all')} className="w-auto" aria-label="Art">
          <option value="all">Urlaub und Krank</option>
          <option value="vacation">Nur Urlaub</option>
          <option value="sick">Nur Krank</option>
        </Select>
        {!canDecide && scope === 'all' && <span className="text-xs text-zinc-500">Im Team siehst du nur genehmigte Abwesenheiten, ohne Kommentare.</span>}
      </div>
      {visible.length === 0 ? (
        <EmptyState icon={CalendarX2} title={status === 'requested' ? 'Keine offenen Anträge' : 'Keine Einträge'} />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.th}>Mitarbeiter</th>
                <th className={table.th}>Art</th>
                <th className={table.th}>Zeitraum</th>
                <th className={table.thRight}>Arbeitstage</th>
                <th className={table.th}>Kommentar</th>
                <th className={table.th}>Beantragt</th>
                <th className={table.th}>Status</th>
                <th className={table.thRight}>
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const e = employees.get(a.employeeId);
                const own = a.employeeId === data.me.employeeId;
                const running = a.status === 'approved' && a.fromDate <= today && a.toDate >= today;
                return (
                  <tr key={a.id} className={table.tr}>
                    <td className={table.td}>
                      {e && (
                        <button type="button" onClick={() => navigate(`/personal/${e.id}`)} className="flex items-center gap-2.5 text-left hover:underline">
                          <Avatar name={employeeName(e)} size="xs" />
                          <span className="font-medium text-zinc-900">{employeeName(e)}</span>
                        </button>
                      )}
                    </td>
                    <td className={table.td}>
                      <Badge tone={a.kind === 'sick' ? 'red' : 'blue'}>{absenceKindLabel[a.kind]}</Badge>
                    </td>
                    <td className={cx(table.td, 'whitespace-nowrap')}>
                      {formatRange(a.fromDate, a.toDate)}
                      {running && <span className="ml-1.5 text-xs font-medium text-sky-700">läuft</span>}
                    </td>
                    <td className={table.tdRight}>{absenceWorkdays(a)}</td>
                    <td className={cx(table.td, 'max-w-[220px] text-zinc-600')}>
                      <span className="line-clamp-2">{a.comment || '–'}</span>
                      {a.decisionNote && <span className="mt-0.5 block text-xs text-zinc-500 italic">„{a.decisionNote}“</span>}
                    </td>
                    <td className={cx(table.td, 'whitespace-nowrap text-zinc-500')}>{formatDate(a.requestedAt.slice(0, 10))}</td>
                    <td className={table.td}>
                      <Badge tone={absenceStatusTone[a.status]} dot className={a.status === 'rejected' ? 'line-through' : undefined}>
                        {absenceStatusLabel[a.status]}
                      </Badge>
                    </td>
                    <td className={table.tdRight}>
                      <div className="flex justify-end gap-1.5">
                        {a.status === 'requested' && canDecide && (
                          <>
                            <Button size="xs" variant="success" loading={busy === a.id} onClick={() => void act(a.id, () => actions.decideAbsence(a.id, 'approved'))}>
                              Genehmigen
                            </Button>
                            <Button size="xs" disabled={busy === a.id} onClick={() => void reject(a)}>
                              Ablehnen
                            </Button>
                          </>
                        )}
                        {a.status === 'requested' && own && !canDecide && (
                          <Button size="xs" variant="ghost" loading={busy === a.id} onClick={() => void act(a.id, () => actions.withdrawAbsence(a.id))}>
                            Zurückziehen
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
