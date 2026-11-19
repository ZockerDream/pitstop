import { useCallback, useMemo } from 'react';
import type {
  Absence,
  AbsenceInput,
  CollectionKey,
  CompanySettings,
  ContactInput,
  ContactPerson,
  Customer,
  CustomerInput,
  Employee,
  EmployeeInput,
  Expense,
  ExpenseInput,
  Invoice,
  InvoiceInput,
  Note,
  NoteKind,
  Task,
  TimesheetMonth,
  User,
  UserInput,
  Vehicle,
  VehicleInput,
} from '../../shared/types';
import { useToast } from '../components/ui/feedback';
import { api, errorMessage } from '../lib/api';
import { navigate } from '../lib/router';
import { useStore } from './AppStore';

/** Alle schreibenden Aktionen: API aufrufen, Antwort in den Store übernehmen, Rückmeldung zeigen. */
export function useActions() {
  const { dispatch } = useStore();
  const toast = useToast();

  return useMemo(() => {
    const upsert = (collection: CollectionKey, item: { id: string }) => dispatch({ type: 'upsert', collection, item });

    return {
      async createCustomer(input: CustomerInput & { contact?: ContactInput }): Promise<Customer> {
        const r = await api.post<{ customer: Customer; contacts: ContactPerson[] }>('/customers', input);
        upsert('customers', r.customer);
        dispatch({ type: 'contacts/replace', customerId: r.customer.id, contacts: r.contacts });
        toast.show({ title: `Kunde „${r.customer.name}“ angelegt` });
        return r.customer;
      },
      async updateCustomer(id: string, patch: Partial<CustomerInput>, message = 'Kunde gespeichert'): Promise<Customer> {
        const r = await api.patch<{ customer: Customer; note: Note | null }>(`/customers/${id}`, patch);
        upsert('customers', r.customer);
        if (r.note) upsert('notes', r.note);
        toast.show({ title: message });
        return r.customer;
      },
      async addContact(customerId: string, input: ContactInput): Promise<void> {
        const r = await api.post<{ contacts: ContactPerson[] }>(`/customers/${customerId}/contacts`, input);
        dispatch({ type: 'contacts/replace', customerId, contacts: r.contacts });
        toast.show({ title: `Ansprechpartner ${input.name} hinzugefügt` });
      },
      async addVehicle(customerId: string, input: VehicleInput): Promise<Vehicle> {
        const r = await api.post<{ vehicle: Vehicle }>(`/customers/${customerId}/vehicles`, input);
        upsert('vehicles', r.vehicle);
        toast.show({ title: `Fahrzeug ${r.vehicle.plate} angelegt` });
        return r.vehicle;
      },
      async updateVehicle(id: string, patch: Partial<VehicleInput>): Promise<Vehicle> {
        const r = await api.patch<{ vehicle: Vehicle }>(`/vehicles/${id}`, patch);
        upsert('vehicles', r.vehicle);
        toast.show({ title: `Fahrzeug ${r.vehicle.plate} gespeichert` });
        return r.vehicle;
      },
      async addNote(customerId: string, kind: NoteKind, text: string): Promise<void> {
        const r = await api.post<{ note: Note }>(`/customers/${customerId}/notes`, { kind, text });
        upsert('notes', r.note);
        toast.show({ title: 'Eintrag gespeichert' });
      },
      async createInvoice(input: InvoiceInput): Promise<Invoice> {
        const r = await api.post<{ invoice: Invoice; vehicle: Vehicle | null }>('/invoices', input);
        upsert('invoices', r.invoice);
        if (r.vehicle) upsert('vehicles', r.vehicle);
        toast.show({
          title: `Rechnung #${r.invoice.number} erstellt`,
          action: { label: 'Öffnen', onClick: () => navigate(`/finanzen/rechnungen/${r.invoice.id}`) },
        });
        return r.invoice;
      },
      async payInvoice(id: string): Promise<void> {
        const r = await api.post<{ invoice: Invoice }>(`/invoices/${id}/pay`);
        upsert('invoices', r.invoice);
        toast.show({ title: `Rechnung #${r.invoice.number} als bezahlt markiert` });
      },
      async remindInvoice(id: string): Promise<void> {
        const r = await api.post<{ invoice: Invoice; note: Note }>(`/invoices/${id}/remind`);
        upsert('invoices', r.invoice);
        upsert('notes', r.note);
        toast.show({ title: `Mahnung Stufe ${r.invoice.dunningLevel} zu #${r.invoice.number} erfasst` });
      },
      async createExpense(input: ExpenseInput): Promise<Expense> {
        const r = await api.post<{ expense: Expense }>('/expenses', input);
        upsert('expenses', r.expense);
        toast.show({ title: `Ausgabe „${r.expense.supplier}“ erfasst` });
        return r.expense;
      },
      async createEmployee(input: EmployeeInput): Promise<Employee> {
        const r = await api.post<{ employee: Employee }>('/employees', input);
        upsert('employees', r.employee);
        toast.show({
          title: `${r.employee.firstName} ${r.employee.lastName} angelegt`,
          action: { label: 'Öffnen', onClick: () => navigate(`/personal/${r.employee.id}`) },
        });
        return r.employee;
      },
      async updateEmployee(id: string, patch: Partial<EmployeeInput>, message = 'Personalakte gespeichert'): Promise<Employee> {
        const r = await api.patch<{ employee: Employee }>(`/employees/${id}`, patch);
        upsert('employees', r.employee);
        toast.show({ title: message });
        return r.employee;
      },
      async saveTimesheet(employeeId: string, month: string, targetHours: number, workedHours: number): Promise<void> {
        const r = await api.put<{ timesheet: TimesheetMonth }>(`/employees/${employeeId}/timesheets/${month}`, { targetHours, workedHours });
        upsert('timesheets', r.timesheet);
        toast.show({ title: 'Stunden gespeichert' });
      },
      async createAbsence(input: AbsenceInput): Promise<Absence> {
        const r = await api.post<{ absence: Absence }>('/absences', input);
        upsert('absences', r.absence);
        toast.show({
          title:
            r.absence.kind === 'sick'
              ? 'Krankmeldung erfasst'
              : r.absence.status === 'approved'
                ? 'Urlaub eingetragen und genehmigt'
                : 'Urlaubsantrag gestellt',
        });
        return r.absence;
      },
      async decideAbsence(id: string, status: 'approved' | 'rejected', decisionNote = ''): Promise<void> {
        const r = await api.post<{ absence: Absence }>(`/absences/${id}/decide`, { status, decisionNote });
        upsert('absences', r.absence);
        toast.show({ title: status === 'approved' ? 'Urlaubsantrag genehmigt' : 'Urlaubsantrag abgelehnt' });
      },
      async withdrawAbsence(id: string): Promise<void> {
        await api.del(`/absences/${id}`);
        dispatch({ type: 'remove', collection: 'absences', id });
        toast.show({ title: 'Antrag zurückgezogen' });
      },
      async markAbsenceSeen(id: string): Promise<void> {
        const r = await api.post<{ absence: Absence }>(`/absences/${id}/seen`);
        upsert('absences', r.absence);
      },
      async createTask(title: string, dueDate: string | null): Promise<void> {
        const r = await api.post<{ task: Task }>('/tasks', { title, dueDate });
        upsert('tasks', r.task);
      },
      async toggleTask(id: string): Promise<void> {
        const r = await api.post<{ task: Task }>(`/tasks/${id}/toggle`);
        upsert('tasks', r.task);
        if (r.task.done) toast.show({ title: 'Aufgabe erledigt' });
      },
      async saveCompany(company: CompanySettings): Promise<void> {
        const r = await api.put<{ company: CompanySettings }>('/settings/company', company);
        dispatch({ type: 'company', company: r.company });
        toast.show({ title: 'Firmendaten gespeichert' });
      },
      async createUser(input: UserInput): Promise<{ user: User; password: string }> {
        const r = await api.post<{ user: User; password: string }>('/users', input);
        upsert('users', r.user);
        return r;
      },
      async updateUser(id: string, patch: Partial<{ displayName: string; role: User['role']; active: boolean; employeeId: string | null }>, message: string): Promise<void> {
        const r = await api.patch<{ user: User }>(`/users/${id}`, patch);
        upsert('users', r.user);
        toast.show({ title: message });
      },
      async resetUserPassword(id: string): Promise<{ user: User; password: string }> {
        const r = await api.post<{ user: User; password: string }>(`/users/${id}/reset-password`);
        upsert('users', r.user);
        return r;
      },
    };
  }, [dispatch, toast]);
}

export type Actions = ReturnType<typeof useActions>;

/** Für Knöpfe in Listen: Fehler als Toast statt im Formular. */
export function useRun() {
  const toast = useToast();
  return useCallback(
    async (fn: () => Promise<unknown>) => {
      try {
        await fn();
      } catch (err) {
        toast.error(errorMessage(err));
      }
    },
    [toast],
  );
}
