import { CalendarPlus, Clock, Mail, Pencil, Phone, Thermometer, UserCheck, UserMinus, UserX } from 'lucide-react';
import { useEffect, useState } from 'react';
import { diffDays, lastMonths, monthKey, today as getToday, yearOf } from '../../../shared/dates';
import { formatDate, formatDays, formatEuro, formatHours, formatMonthLong, formatRange, formatSignedHours } from '../../../shared/format';
import { absenceKindLabel, absenceStatusLabel, absenceStatusTone, contractTypeLabel, departmentLabel, employeeStatusLabel, employeeStatusTone } from '../../../shared/labels';
import { absenceWorkdays, employeeName, employeeStatusToday, overtimeBalance, timesheetFor, vacationBalance } from '../../../shared/selectors';
import type { Employee } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { useModals } from '../../lib/modals';
import { pushRecent } from '../../lib/storage';
import { useCan, useData } from '../../store/AppStore';
import { useActions, useRun } from '../../store/mutations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { useConfirm } from '../ui/feedback';
import { Avatar, DetailList, EmptyState, table } from '../ui/misc';
import { Tabs } from '../ui/Tabs';
import { HoursChart } from './HoursChart';

type Tab = 'file' | 'vacation' | 'hours';

export function EmployeeDrawer({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const data = useData();
  const can = useCan();
  const { open } = useModals();
  const actions = useActions();
  const run = useRun();
  const confirm = useConfirm();
  const today = getToday();
  const [tab, setTab] = useState<Tab>('file');
  const employee = data.employees.find((e) => e.id === employeeId);

  useEffect(() => {
    if (employee) pushRecent({ type: 'employee', id: employee.id });
  }, [employee]);

  if (!employee) {
    return (
      <Drawer title="Mitarbeiter nicht gefunden" onClose={onClose}>
        <EmptyState icon={UserX} title="Diesen Datensatz gibt es nicht (mehr)." />
      </Drawer>
    );
  }

  const name = employeeName(employee);
  const isSelf = data.me.employeeId === employee.id;
  const fullFile = can('employee:viewFile:any') || isSelf;
  const isAdmin = can('employee:edit');
  const status = employeeStatusToday(data.absences, employee.id, today);
  const login = data.users.find((u) => u.employeeId === employee.id);

  const header = (
    <>
      <span>{employee.jobTitle}</span>
      <span>·</span>
      <span>{departmentLabel[employee.department]}</span>
      {employee.active ? (
        <Badge tone={employeeStatusTone[status]} dot>
          {employeeStatusLabel[status]}
        </Badge>
      ) : (
        <Badge>Ausgeschieden</Badge>
      )}
    </>
  );

  if (!fullFile) {
    return (
      <Drawer onClose={onClose} leading={<Avatar name={name} size="lg" />} title={name} subtitle={header}>
        <div className="space-y-5 px-6 py-6">
          <p className="text-sm text-zinc-500">Kontaktdaten. Die vollständige Personalakte sehen nur die Geschäftsführung und die Person selbst.</p>
          <ContactLinks employee={employee} />
        </div>
      </Drawer>
    );
  }

  const toggleActive = async () => {
    if (employee.active) {
      const r = await confirm({
        title: `${name} als ausgeschieden markieren?`,
        message: 'Die Personalakte bleibt erhalten, erscheint aber nicht mehr im Verzeichnis und nicht in der Anwesenheit.',
        confirmLabel: 'Ausgeschieden markieren',
        tone: 'danger',
      });
      if (!r.ok) return;
    }
    await run(() => actions.updateEmployee(employee.id, { active: !employee.active }, employee.active ? `${name} als ausgeschieden markiert` : `${name} wieder aktiv`));
  };

  return (
    <Drawer
      onClose={onClose}
      leading={<Avatar name={name} size="lg" />}
      title={name}
      subtitle={header}
      actions={
        <>
          {isAdmin && (
            <Button size="sm" icon={Pencil} onClick={() => open({ type: 'employee', employeeId: employee.id })}>
              Bearbeiten
            </Button>
          )}
          {employee.active && (isAdmin || isSelf) && (
            <Button size="sm" icon={CalendarPlus} onClick={() => open({ type: 'absence', employeeId: employee.id, approveDirectly: isAdmin && !isSelf })}>
              {isAdmin && !isSelf ? 'Urlaub eintragen' : 'Urlaub beantragen'}
            </Button>
          )}
          {isAdmin && employee.active && (
            <Button size="sm" icon={Thermometer} onClick={() => open({ type: 'sick', employeeId: employee.id })}>
              Krank melden
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" icon={Clock} onClick={() => open({ type: 'timesheet', employeeId: employee.id })}>
              Stunden erfassen
            </Button>
          )}
          {isAdmin && (
            <Button size="sm" variant="ghost" icon={employee.active ? UserMinus : UserCheck} onClick={() => void toggleActive()}>
              {employee.active ? 'Ausgeschieden' : 'Reaktivieren'}
            </Button>
          )}
        </>
      }
    >
      <div className="px-6 pt-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'file', label: 'Stammdaten & Vertrag' },
            { value: 'vacation', label: 'Urlaub' },
            { value: 'hours', label: 'Stunden' },
          ]}
        />
      </div>
      <div className="px-6 py-5">
        {tab === 'file' && <FileTab employee={employee} loginLabel={isAdmin ? (login ? `${login.active ? 'aktiv' : 'gesperrt'} (${login.email})` : 'kein Zugang') : undefined} />}
        {tab === 'vacation' && <VacationTab employee={employee} today={today} isSelf={isSelf} />}
        {tab === 'hours' && <HoursTab employee={employee} today={today} />}
      </div>
    </Drawer>
  );
}

function ContactLinks({ employee }: { employee: Employee }) {
  return (
    <div className="space-y-2 text-sm">
      {employee.phone && (
        <a href={`tel:${employee.phone.replace(/\s/g, '')}`} className="flex items-center gap-2 text-zinc-700 hover:text-zinc-900">
          <Phone className="size-4 text-zinc-400" aria-hidden />
          {employee.phone}
        </a>
      )}
      {employee.email && (
        <a href={`mailto:${employee.email}`} className="flex items-center gap-2 text-brand-600 hover:underline">
          <Mail className="size-4" aria-hidden />
          {employee.email}
        </a>
      )}
    </div>
  );
}

function FileTab({ employee, loginLabel }: { employee: Employee; loginLabel?: string }) {
  const data = useData();
  const today = getToday();
  const manager = employee.managerId ? data.employees.find((e) => e.id === employee.managerId) : undefined;
  const years = employee.entryDate ? Math.floor(diffDays(employee.entryDate, today) / 365.25) : null;
  return (
    <div className="space-y-6">
      <DetailList
        items={[
          { label: 'Personalnummer', value: employee.personnelNumber },
          { label: 'Telefon', value: employee.phone },
          { label: 'E-Mail', value: employee.email },
          { label: 'Vorgesetzte(r)', value: manager ? employeeName(manager) : '' },
          ...(loginLabel !== undefined ? [{ label: 'Zugang zu Pitstop', value: loginLabel }] : []),
        ]}
      />
      <div className="border-t border-zinc-100 pt-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">Vertrag</h3>
        <DetailList
          items={[
            { label: 'Eintritt', value: employee.entryDate ? `${formatDate(employee.entryDate)}${years !== null ? ` (${years === 0 ? 'unter 1 Jahr' : `${years} ${years === 1 ? 'Jahr' : 'Jahre'}`})` : ''}` : '' },
            { label: 'Vertragsart', value: employee.contractType ? contractTypeLabel[employee.contractType] : '' },
            { label: 'Wochenstunden', value: employee.weeklyHours !== null ? formatHours(employee.weeklyHours) : '' },
            { label: 'Stundensatz', value: employee.hourlyRateCents !== null ? formatEuro(employee.hourlyRateCents) : '' },
            {
              label: 'Probezeit bis',
              value: employee.probationEndDate ? (
                <span className={cx(employee.probationEndDate >= today && 'font-medium text-amber-700')}>
                  {formatDate(employee.probationEndDate)}
                  {employee.probationEndDate >= today && ' (läuft)'}
                </span>
              ) : (
                ''
              ),
            },
            { label: 'Befristet bis', value: employee.fixedTermEndDate ? formatDate(employee.fixedTermEndDate) : 'unbefristet' },
            { label: 'Urlaubsanspruch', value: employee.vacationDaysPerYear !== null ? `${formatDays(employee.vacationDaysPerYear)} pro Jahr` : '' },
            { label: 'Übertrag Vorjahr', value: employee.carryOverDays !== null ? formatDays(employee.carryOverDays) : '' },
          ]}
        />
      </div>
    </div>
  );
}

function VacationTab({ employee, today, isSelf }: { employee: Employee; today: string; isSelf: boolean }) {
  const data = useData();
  const can = useCan();
  const actions = useActions();
  const run = useRun();
  const year = yearOf(today);
  const balance = vacationBalance(employee, data.absences, year, today);
  const total = balance.entitlement + balance.carryOver;
  const list = data.absences
    .filter((a) => a.employeeId === employee.id && (a.fromDate.startsWith(String(year)) || a.toDate.startsWith(String(year))))
    .sort((a, b) => b.fromDate.localeCompare(a.fromDate));
  const pct = (n: number) => `${total > 0 ? Math.min(100, (n / total) * 100) : 0}%`;
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-200 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-zinc-500">Resturlaub {year}</div>
            <div className={cx('mt-1 text-3xl font-semibold tracking-tight tabular-nums', balance.remaining < 0 ? 'text-rose-700' : 'text-zinc-900')}>{formatDays(balance.remaining)}</div>
          </div>
          <div className="text-right text-xs text-zinc-500">
            von {formatDays(total)}
            <br />({formatDays(balance.entitlement)} Anspruch + {formatDays(balance.carryOver)} Übertrag)
          </div>
        </div>
        <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-zinc-100" role="img" aria-label={`${balance.taken} genommen, ${balance.planned} geplant von ${total} Tagen`}>
          <div className="bg-brand-600" style={{ width: pct(balance.taken) }} />
          <div className="ml-0.5 bg-brand-300" style={{ width: pct(balance.planned) }} />
        </div>
        <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="size-2 rounded-sm bg-brand-600" aria-hidden />
              Genommen
            </dt>
            <dd className="font-medium tabular-nums">{formatDays(balance.taken)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="size-2 rounded-sm bg-brand-300" aria-hidden />
              Geplant
            </dt>
            <dd className="font-medium tabular-nums">{formatDays(balance.planned)}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="size-2 rounded-sm bg-amber-400" aria-hidden />
              Beantragt
            </dt>
            <dd className="font-medium tabular-nums">{formatDays(balance.requested)}</dd>
          </div>
        </dl>
      </div>
      <div>
        <h3 className="mb-3 text-sm font-semibold text-zinc-900">Abwesenheiten {year}</h3>
        {list.length === 0 ? (
          <p className="text-sm text-zinc-500">Keine Einträge in diesem Jahr.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            <table className="w-full text-sm">
              <tbody>
                {list.map((a) => (
                  <tr key={a.id} className="border-t border-zinc-100 first:border-t-0">
                    <td className={table.td}>
                      <div className="font-medium text-zinc-900">{formatRange(a.fromDate, a.toDate)}</div>
                      <div className="text-xs text-zinc-500">
                        {absenceKindLabel[a.kind]} · {absenceWorkdays(a)} Arbeitstage{a.comment ? ` · ${a.comment}` : ''}
                      </div>
                      {a.decisionNote && <div className="mt-0.5 text-xs text-zinc-500 italic">„{a.decisionNote}“</div>}
                    </td>
                    <td className={cx(table.td, 'text-right')}>
                      <div className="flex items-center justify-end gap-2">
                        <Badge tone={absenceStatusTone[a.status]}>{absenceStatusLabel[a.status]}</Badge>
                        {a.status === 'requested' && (isSelf || can('absence:decide')) && (
                          <Button size="xs" variant="ghost" onClick={() => void run(() => actions.withdrawAbsence(a.id))}>
                            Zurückziehen
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function HoursTab({ employee, today }: { employee: Employee; today: string }) {
  const data = useData();
  const can = useCan();
  const { open } = useModals();
  const months = lastMonths(today, 6);
  const current = timesheetFor(data.timesheets, employee.id, monthKey(today));
  const balance = overtimeBalance(data.timesheets, employee.id);
  const points = months.map((m) => {
    const t = timesheetFor(data.timesheets, employee.id, m);
    return { month: m, target: t?.targetHours ?? 0, worked: t?.workedHours ?? 0, recorded: Boolean(t) };
  });
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-zinc-200 px-3 py-2.5">
          <div className="text-[11px] font-medium text-zinc-500">Soll {formatMonthLong(monthKey(today)).split(' ')[0]}</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{current ? formatHours(current.targetHours) : '–'}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 px-3 py-2.5">
          <div className="text-[11px] font-medium text-zinc-500">Ist {formatMonthLong(monthKey(today)).split(' ')[0]}</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums">{current ? formatHours(current.workedHours) : '–'}</div>
        </div>
        <div className="rounded-lg border border-zinc-200 px-3 py-2.5">
          <div className="text-[11px] font-medium text-zinc-500">Überstundensaldo</div>
          <div className={cx('mt-0.5 text-sm font-semibold tabular-nums', balance > 0 ? 'text-emerald-700' : balance < 0 ? 'text-rose-700' : '')}>{formatSignedHours(balance)}</div>
        </div>
      </div>
      <HoursChart points={points} />
      <div className="overflow-hidden rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50">
            <tr>
              <th className={table.th}>Monat</th>
              <th className={table.thRight}>Soll</th>
              <th className={table.thRight}>Ist</th>
              <th className={table.thRight}>Differenz</th>
              {can('employee:edit') && <th className={table.th} />}
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.month} className={table.tr}>
                <td className={table.td}>
                  {formatMonthLong(p.month)}
                  {p.month === monthKey(today) && <span className="ml-1 text-xs text-zinc-400">(bis heute)</span>}
                </td>
                <td className={table.tdRight}>{p.recorded ? formatHours(p.target) : '–'}</td>
                <td className={table.tdRight}>{p.recorded ? formatHours(p.worked) : '–'}</td>
                <td className={cx(table.tdRight, p.worked - p.target > 0 ? 'text-emerald-700' : p.worked - p.target < 0 ? 'text-rose-700' : '')}>
                  {p.recorded ? formatSignedHours(Math.round((p.worked - p.target) * 10) / 10) : '–'}
                </td>
                {can('employee:edit') && (
                  <td className={cx(table.td, 'text-right')}>
                    <Button size="xs" variant="ghost" onClick={() => open({ type: 'timesheet', employeeId: employee.id, month: p.month })}>
                      {p.recorded ? 'Ändern' : 'Erfassen'}
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
