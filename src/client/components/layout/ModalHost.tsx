import { useModals } from '../../lib/modals';
import { ChangePasswordModal } from '../auth/ChangePasswordModal';
import { CustomerFormModal } from '../crm/CustomerFormModal';
import { VehicleFormModal } from '../crm/VehicleFormModal';
import { ExpenseFormModal } from '../finance/ExpenseFormModal';
import { InvoiceFormModal } from '../finance/InvoiceFormModal';
import { EmployeeFormModal } from '../hr/EmployeeFormModal';
import { LeaveRequestModal } from '../hr/LeaveRequestModal';
import { SickNoteModal } from '../hr/SickNoteModal';
import { TimesheetModal } from '../hr/TimesheetModal';
import { PasswordRevealModal } from '../settings/PasswordRevealModal';
import { UserFormModal } from '../settings/UserFormModal';

/** Rendert das gerade angeforderte Formular (siehe lib/modals.tsx). */
export function ModalHost() {
  const { current, close } = useModals();
  if (!current) return null;
  switch (current.type) {
    case 'customer':
      return <CustomerFormModal customerId={current.customerId} onClose={close} />;
    case 'invoice':
      return <InvoiceFormModal customerId={current.customerId} vehicleId={current.vehicleId} onClose={close} />;
    case 'vehicle':
      return <VehicleFormModal customerId={current.customerId} vehicleId={current.vehicleId} onClose={close} />;
    case 'expense':
      return <ExpenseFormModal onClose={close} />;
    case 'absence':
      return <LeaveRequestModal employeeId={current.employeeId} approveDirectly={current.approveDirectly} onClose={close} />;
    case 'sick':
      return <SickNoteModal employeeId={current.employeeId} onClose={close} />;
    case 'employee':
      return <EmployeeFormModal employeeId={current.employeeId} onClose={close} />;
    case 'timesheet':
      return <TimesheetModal employeeId={current.employeeId} month={current.month} onClose={close} />;
    case 'user':
      return <UserFormModal userId={current.userId} onClose={close} />;
    case 'password':
      return <ChangePasswordModal onClose={close} />;
    case 'revealPassword':
      return <PasswordRevealModal title={current.title} email={current.email} password={current.password} onClose={close} />;
  }
}
