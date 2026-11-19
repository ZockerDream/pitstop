import { CalendarCheck, Clock, Euro, FileWarning, TrendingUp, Users } from 'lucide-react';
import { useMemo } from 'react';
import { today as getToday, yearOf } from '../../../shared/dates';
import { formatDays, formatEuro, formatEuroRounded, formatPercent, formatSignedHours } from '../../../shared/format';
import { dashboardKpis, overtimeBalance, vacationBalance } from '../../../shared/selectors';
import { navigate } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';
import { KpiCard } from '../ui/KpiCard';
import { AbsenceThisWeek } from './AbsenceThisWeek';
import { FirstSteps } from './FirstSteps';
import { RevenueExpenseChart } from './RevenueExpenseChart';
import { TaskList } from './TaskList';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export function DashboardView() {
  const data = useData();
  const can = useCan();
  const today = getToday();
  const kpis = useMemo(() => dashboardKpis(data, today), [data, today]);
  const isAdmin = can('finance:view');
  const firstName = data.me.displayName.split(' ')[0];
  const dateLabel = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${today}T12:00:00`));

  const myEmployee = data.me.employeeId ? data.employees.find((e) => e.id === data.me.employeeId) : undefined;
  const myVacation = myEmployee ? vacationBalance(myEmployee, data.absences, yearOf(today), today) : null;
  const myOvertime = myEmployee ? overtimeBalance(data.timesheets, myEmployee.id) : null;

  const presence = (
    <KpiCard
      label="Anwesend heute"
      icon={CalendarCheck}
      value={`${kpis.presentToday} / ${kpis.totalEmployees}`}
      sub={`${kpis.onVacation} im Urlaub · ${kpis.sick} krank`}
      onClick={() => navigate('/personal')}
    />
  );
  const customers = (
    <KpiCard
      label="Aktive Kunden"
      icon={Users}
      value={kpis.activeCustomers}
      sub={`+${kpis.leads} ${kpis.leads === 1 ? 'Lead' : 'Leads'}`}
      onClick={() => navigate('/kunden')}
    />
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{dateLabel}</p>
      </div>

      {isAdmin && <FirstSteps />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isAdmin ? (
          <>
            <KpiCard
              label="Offene Rechnungen"
              icon={kpis.overdueGross > 0 ? FileWarning : Euro}
              value={formatEuro(kpis.openGross)}
              sub={kpis.overdueGross > 0 ? `davon ${formatEuro(kpis.overdueGross)} überfällig` : 'nichts überfällig'}
              subTone={kpis.overdueGross > 0 ? 'red' : 'green'}
              onClick={() => navigate('/finanzen/rechnungen?status=open')}
            />
            <KpiCard
              label="Monatsumsatz (netto)"
              icon={TrendingUp}
              value={formatEuroRounded(kpis.monthRevenue)}
              sub={kpis.revenueChangePct === null ? 'kein Vormonatswert' : `${formatPercent(Math.round(kpis.revenueChangePct * 10) / 10)} zum Vormonat (bis heute)`}
              subTone={kpis.revenueChangePct === null ? 'muted' : kpis.revenueChangePct >= 0 ? 'green' : 'red'}
              onClick={() => navigate('/finanzen/rechnungen')}
            />
            {customers}
            {presence}
          </>
        ) : (
          <>
            {customers}
            {presence}
            <KpiCard
              label="Mein Resturlaub"
              icon={CalendarCheck}
              value={myVacation ? formatDays(myVacation.remaining) : '–'}
              sub={myVacation ? `von ${formatDays(myVacation.entitlement + myVacation.carryOver)} · ${formatDays(myVacation.planned)} geplant` : 'kein Mitarbeiterdatensatz'}
              onClick={myEmployee ? () => navigate(`/personal/${myEmployee.id}`) : undefined}
            />
            <KpiCard
              label="Meine Überstunden"
              icon={Clock}
              value={myOvertime !== null ? formatSignedHours(myOvertime) : '–'}
              sub="Saldo der erfassten Monate"
              onClick={myEmployee ? () => navigate(`/personal/${myEmployee.id}`) : undefined}
            />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">{isAdmin ? <RevenueExpenseChart /> : <AbsenceThisWeek />}</div>
        <div className="lg:col-span-2">
          <TaskList />
        </div>
      </div>
    </div>
  );
}
