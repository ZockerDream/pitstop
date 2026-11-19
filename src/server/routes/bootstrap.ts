import type { FastifyInstance } from 'fastify';
import { can } from '../../shared/permissions';
import type { Absence, AppData } from '../../shared/types';
import { requireUser } from '../auth/guards';
import { db } from '../db/pool';
import { listAbsences } from '../repo/absences';
import { listContacts, listCustomers, listNotes } from '../repo/customers';
import { listEmployees, listTimesheets, restrictEmployee } from '../repo/employees';
import { listExpenses } from '../repo/expenses';
import { listInvoices } from '../repo/invoices';
import { getCompany } from '../repo/settings';
import { listTasks } from '../repo/tasks';
import { listVehicles } from '../repo/vehicles';
import { listUsers } from '../repo/users';
import { findLogo } from './public';
import type { RouteOptions } from './util';

/** Gesamtstand für die Oberfläche, nach Rolle gefiltert (TECHNICAL.md 8.2). */
export async function bootstrapRoutes(app: FastifyInstance, { cfg }: RouteOptions): Promise<void> {
  app.get('/bootstrap', async (req): Promise<AppData> => {
    const me = requireUser(req);
    const q = db();
    const finance = can(me.role, 'finance:view');
    const seeAllAbsences = can(me.role, 'absence:decide');
    const [company, customers, contacts, vehicles, notes, employees, absences, timesheets, invoices, expenses, tasks, users] = await Promise.all([
      getCompany(q),
      listCustomers(q),
      listContacts(q),
      listVehicles(q),
      listNotes(q),
      listEmployees(q),
      listAbsences(q),
      can(me.role, 'employee:viewFile:any') ? listTimesheets(q) : me.employeeId ? listTimesheets(q, me.employeeId) : Promise.resolve([]),
      finance ? listInvoices(q) : Promise.resolve([]),
      finance ? listExpenses(q) : Promise.resolve([]),
      can(me.role, 'task:manage') ? listTasks(q) : Promise.resolve([]),
      can(me.role, 'users:manage') ? listUsers(q) : Promise.resolve([]),
    ]);
    const visibleAbsences: Absence[] = seeAllAbsences
      ? absences
      : absences
          .filter((a) => a.employeeId === me.employeeId || a.status === 'approved')
          .map((a) => (a.employeeId === me.employeeId ? a : { ...a, comment: '', decisionNote: '', decidedByName: '' }));
    return {
      me,
      demoMode: cfg.demoMode,
      hasLogo: findLogo(cfg) !== null,
      company,
      customers,
      contacts,
      vehicles,
      notes,
      invoices,
      expenses,
      employees: employees.map((e) => restrictEmployee(e, me)),
      absences: visibleAbsences,
      timesheets,
      tasks,
      users,
    };
  });
}
