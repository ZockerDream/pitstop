import { Palmtree } from 'lucide-react';
import { useMemo } from 'react';
import { today as getToday } from '../../../shared/dates';
import { formatRange } from '../../../shared/format';
import { absenceKindLabel } from '../../../shared/labels';
import { absencesInRange, byId, currentWeek, employeeName } from '../../../shared/selectors';
import { navigate } from '../../lib/router';
import { useData } from '../../store/AppStore';
import { Badge } from '../ui/Badge';
import { Card, CardHeader } from '../ui/Card';
import { Avatar, EmptyState } from '../ui/misc';

export function AbsenceThisWeek() {
  const data = useData();
  const today = getToday();
  const week = currentWeek(today);
  const list = useMemo(() => absencesInRange(data.absences, week.from, week.to), [data.absences, week.from, week.to]);
  const employees = byId(data.employees);
  return (
    <Card className="h-full">
      <CardHeader title="Abwesend diese Woche" description={formatRange(week.from, week.to)} />
      {list.length === 0 ? (
        <EmptyState icon={Palmtree} title="Diese Woche sind alle da" compact />
      ) : (
        <ul className="divide-y divide-zinc-100">
          {list.map((a) => {
            const e = employees.get(a.employeeId);
            if (!e) return null;
            return (
              <li key={a.id}>
                <button type="button" onClick={() => navigate(`/personal/${e.id}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-zinc-50">
                  <Avatar name={employeeName(e)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-zinc-900">{employeeName(e)}</p>
                    <p className="text-xs text-zinc-500">{formatRange(a.fromDate, a.toDate)}</p>
                  </div>
                  <Badge tone={a.kind === 'sick' ? 'red' : 'blue'} dot>
                    {absenceKindLabel[a.kind]}
                  </Badge>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
