import { CalendarPlus, UserPlus } from 'lucide-react';
import { useModals } from '../../lib/modals';
import { navigate } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/Card';
import { Tabs } from '../ui/Tabs';
import { EmployeeDirectory } from './EmployeeDirectory';
import { EmployeeDrawer } from './EmployeeDrawer';
import { LeaveTable } from './LeaveTable';

export function HrView({ tab, employeeId }: { tab: 'directory' | 'leave'; employeeId?: string }) {
  const data = useData();
  const can = useCan();
  const { open } = useModals();
  const requested = data.absences.filter((a) => a.status === 'requested' && (can('absence:decide') || a.employeeId === data.me.employeeId)).length;
  return (
    <>
      <PageHeader
        title="Mitarbeiter & Personal"
        description={`${data.employees.filter((e) => e.active).length} aktive Mitarbeitende`}
        actions={
          <>
            {(data.me.employeeId || can('absence:createForOthers')) && (
              <Button icon={CalendarPlus} onClick={() => open({ type: 'absence' })}>
                Urlaub beantragen
              </Button>
            )}
            {can('employee:edit') && (
              <Button variant="primary" icon={UserPlus} onClick={() => open({ type: 'employee' })}>
                Neuer Mitarbeiter
              </Button>
            )}
          </>
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => navigate(t === 'directory' ? '/personal' : '/personal/urlaub')}
        items={[
          { value: 'directory', label: 'Verzeichnis' },
          { value: 'leave', label: 'Urlaub & Abwesenheiten', count: requested || undefined, highlight: requested > 0 },
        ]}
      />
      {tab === 'directory' ? <EmployeeDirectory /> : <LeaveTable />}
      {employeeId && <EmployeeDrawer employeeId={employeeId} onClose={() => navigate('/personal')} />}
    </>
  );
}
