import { LayoutGrid, List, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import { today as getToday } from '../../../shared/dates';
import { formatEuro } from '../../../shared/format';
import { contractTypeLabel, departmentLabel, employeeStatusLabel, employeeStatusTone } from '../../../shared/labels';
import { employeeName, employeeStatusToday, normalize } from '../../../shared/selectors';
import { DEPARTMENTS, type Department, type EmployeeStatus } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { navigate } from '../../lib/router';
import { readLocal, writeLocal } from '../../lib/storage';
import { useCan, useData } from '../../store/AppStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Checkbox, SearchInput, Select } from '../ui/Field';
import { Avatar, EmptyState, SegmentedControl, table } from '../ui/misc';

export function EmployeeDirectory() {
  const data = useData();
  const can = useCan();
  const today = getToday();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState<Department | 'all'>('all');
  const [status, setStatus] = useState<EmployeeStatus | 'all'>('all');
  const [showInactive, setShowInactive] = useState(false);
  const [view, setView] = useState<'grid' | 'table'>(() => readLocal('pitstop:hr:view', 'grid'));
  const showRate = can('employee:viewRate');

  const rows = useMemo(
    () => data.employees.map((e) => ({ e, status: employeeStatusToday(data.absences, e.id, today) })),
    [data.employees, data.absences, today],
  );
  const base = rows.filter((r) => (showInactive || r.e.active) && (department === 'all' || r.e.department === department));
  const counts = {
    all: base.length,
    on_duty: base.filter((r) => r.status === 'on_duty').length,
    vacation: base.filter((r) => r.status === 'vacation').length,
    sick: base.filter((r) => r.status === 'sick').length,
  };
  const q = normalize(query.trim());
  const visible = base
    .filter((r) => status === 'all' || r.status === status)
    .filter((r) => !q || normalize(`${employeeName(r.e)} ${r.e.jobTitle} ${r.e.personnelNumber}`).includes(q))
    .sort((a, b) => a.e.lastName.localeCompare(b.e.lastName, 'de') || a.e.firstName.localeCompare(b.e.firstName, 'de'));

  const changeView = (v: 'grid' | 'table') => {
    setView(v);
    writeLocal('pitstop:hr:view', v);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Name oder Rolle …" className="w-full sm:w-64" />
        <SegmentedControl
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Alle', count: counts.all },
            { value: 'on_duty', label: 'Im Dienst', count: counts.on_duty },
            { value: 'vacation', label: 'Urlaub', count: counts.vacation },
            { value: 'sick', label: 'Krank', count: counts.sick },
          ]}
        />
        <Select value={department} onChange={(e) => setDepartment(e.target.value as Department | 'all')} className="w-auto" aria-label="Abteilung">
          <option value="all">Alle Abteilungen</option>
          {DEPARTMENTS.map((d) => (
            <option key={d} value={d}>
              {departmentLabel[d]}
            </option>
          ))}
        </Select>
        {can('employee:edit') && <Checkbox label="Ausgeschiedene anzeigen" checked={showInactive} onChange={setShowInactive} />}
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant={view === 'grid' ? 'secondary' : 'ghost'} icon={LayoutGrid} onClick={() => changeView('grid')} aria-label="Kartenansicht" aria-pressed={view === 'grid'} />
          <Button size="sm" variant={view === 'table' ? 'secondary' : 'ghost'} icon={List} onClick={() => changeView('table')} aria-label="Tabellenansicht" aria-pressed={view === 'table'} />
        </div>
      </div>

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={UsersRound} title="Keine Mitarbeitenden gefunden" text={data.employees.length ? 'Suche oder Filter anpassen.' : 'Lege die ersten Mitarbeitenden an.'} />
        </Card>
      ) : view === 'grid' ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map(({ e, status: s }) => (
            <button
              key={e.id}
              type="button"
              onClick={() => navigate(`/personal/${e.id}`)}
              className={cx(
                'flex flex-col items-center rounded-xl border border-zinc-200 bg-white px-4 pt-6 pb-4 text-center shadow-xs transition-colors hover:border-zinc-300 hover:bg-zinc-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                !e.active && 'opacity-60',
              )}
            >
              <Avatar name={employeeName(e)} size="xl" />
              <div className="mt-3 font-medium text-zinc-900">{employeeName(e)}</div>
              <div className="mt-0.5 line-clamp-2 min-h-[2.5em] text-sm text-zinc-500">{e.jobTitle}</div>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {e.active ? (
                  <Badge tone={employeeStatusTone[s]} dot>
                    {employeeStatusLabel[s]}
                  </Badge>
                ) : (
                  <Badge>Ausgeschieden</Badge>
                )}
                <Badge>{departmentLabel[e.department]}</Badge>
              </div>
              {showRate && e.hourlyRateCents !== null && (
                <div className="mt-3 w-full border-t border-zinc-100 pt-3 text-xs text-zinc-500">
                  Stundensatz <span className="font-medium text-zinc-900 tabular-nums">{formatEuro(e.hourlyRateCents)}</span>
                </div>
              )}
            </button>
          ))}
        </div>
      ) : (
        <Card>
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Name</th>
                  <th className={table.th}>Rolle</th>
                  <th className={table.th}>Abteilung</th>
                  {showRate && <th className={table.th}>Vertrag</th>}
                  {showRate && <th className={table.thRight}>Stundensatz</th>}
                  <th className={table.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ e, status: s }) => (
                  <tr key={e.id} className={cx(table.trClick, !e.active && 'opacity-60')} onClick={() => navigate(`/personal/${e.id}`)}>
                    <td className={table.td}>
                      <div className="flex items-center gap-3">
                        <Avatar name={employeeName(e)} size="sm" />
                        <div>
                          <div className="font-medium text-zinc-900">{employeeName(e)}</div>
                          <div className="text-xs text-zinc-500 tabular-nums">{e.personnelNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td className={cx(table.td, 'text-zinc-600')}>{e.jobTitle}</td>
                    <td className={table.td}>{departmentLabel[e.department]}</td>
                    {showRate && <td className={cx(table.td, 'text-zinc-600')}>{e.contractType ? `${contractTypeLabel[e.contractType]}, ${e.weeklyHours} Std./Woche` : '–'}</td>}
                    {showRate && <td className={table.tdRight}>{e.hourlyRateCents !== null ? formatEuro(e.hourlyRateCents) : '–'}</td>}
                    <td className={table.td}>
                      {e.active ? (
                        <Badge tone={employeeStatusTone[s]} dot>
                          {employeeStatusLabel[s]}
                        </Badge>
                      ) : (
                        <Badge>Ausgeschieden</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
