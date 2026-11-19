import type { Employee, EmployeeInput, TimesheetMonth, User } from '../../shared/types';
import { can } from '../../shared/permissions';
import type { Queryable } from '../db/pool';
import { updateColumns } from './sql';

const EMPLOYEE_COLS = `id, personnel_number AS "personnelNumber", first_name AS "firstName", last_name AS "lastName",
  job_title AS "jobTitle", department, email, phone, active, hourly_rate_cents AS "hourlyRateCents",
  contract_type AS "contractType", weekly_hours AS "weeklyHours", entry_date AS "entryDate",
  probation_end_date AS "probationEndDate", fixed_term_end_date AS "fixedTermEndDate", manager_id AS "managerId",
  vacation_days_per_year AS "vacationDaysPerYear", carry_over_days AS "carryOverDays"`;
const EMPLOYEE_FIELDS: Record<keyof EmployeeInput, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  jobTitle: 'job_title',
  department: 'department',
  email: 'email',
  phone: 'phone',
  hourlyRateCents: 'hourly_rate_cents',
  contractType: 'contract_type',
  weeklyHours: 'weekly_hours',
  entryDate: 'entry_date',
  probationEndDate: 'probation_end_date',
  fixedTermEndDate: 'fixed_term_end_date',
  managerId: 'manager_id',
  vacationDaysPerYear: 'vacation_days_per_year',
  carryOverDays: 'carry_over_days',
  active: 'active',
};
const TIMESHEET_COLS = `employee_id || ':' || month AS id, employee_id AS "employeeId", month, target_hours AS "targetHours", worked_hours AS "workedHours"`;

export async function listEmployees(q: Queryable): Promise<Employee[]> {
  const { rows } = await q.query<Employee>(`SELECT ${EMPLOYEE_COLS} FROM employees ORDER BY last_name, first_name`);
  return rows;
}

export async function getEmployee(q: Queryable, id: string): Promise<Employee | null> {
  const { rows } = await q.query<Employee>(`SELECT ${EMPLOYEE_COLS} FROM employees WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function insertEmployee(q: Queryable, e: EmployeeInput): Promise<Employee> {
  const cols = Object.values(EMPLOYEE_FIELDS);
  const values = (Object.keys(EMPLOYEE_FIELDS) as (keyof EmployeeInput)[]).map((k) => e[k]);
  const { rows } = await q.query<Employee>(
    `INSERT INTO employees (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${EMPLOYEE_COLS}`,
    values,
  );
  return rows[0];
}

export function updateEmployee(q: Queryable, id: string, patch: Partial<EmployeeInput>): Promise<Employee | null> {
  return updateColumns<Employee>(q, 'employees', id, patch, EMPLOYEE_FIELDS, EMPLOYEE_COLS);
}

/** Vertragsdaten und Stundensatz nur für Admin und die eigene Akte. */
export function restrictEmployee(e: Employee, viewer: User): Employee {
  if (can(viewer.role, 'employee:viewFile:any') || viewer.employeeId === e.id) return e;
  return {
    ...e,
    hourlyRateCents: null,
    contractType: null,
    weeklyHours: null,
    entryDate: null,
    probationEndDate: null,
    fixedTermEndDate: null,
    managerId: null,
    vacationDaysPerYear: null,
    carryOverDays: null,
  };
}

export async function listTimesheets(q: Queryable, employeeId?: string): Promise<TimesheetMonth[]> {
  const { rows } = await q.query<TimesheetMonth>(
    `SELECT ${TIMESHEET_COLS} FROM timesheets WHERE $1::uuid IS NULL OR employee_id = $1 ORDER BY month`,
    [employeeId ?? null],
  );
  return rows;
}

export async function upsertTimesheet(q: Queryable, t: Omit<TimesheetMonth, 'id'>): Promise<TimesheetMonth> {
  const { rows } = await q.query<TimesheetMonth>(
    `INSERT INTO timesheets (employee_id, month, target_hours, worked_hours) VALUES ($1,$2,$3,$4)
     ON CONFLICT (employee_id, month) DO UPDATE SET target_hours = EXCLUDED.target_hours, worked_hours = EXCLUDED.worked_hours
     RETURNING ${TIMESHEET_COLS}`,
    [t.employeeId, t.month, t.targetHours, t.workedHours],
  );
  return rows[0];
}
