// Domänen- und API-Typen. Code-Bezeichner englisch, Oberfläche deutsch (siehe labels.ts).
// Geld immer in Cent (Ganzzahl), Kalenderdaten als 'YYYY-MM-DD', Zeitpunkte als ISO-String.
// Optionale Textfelder sind leere Strings statt null.

export type Role = 'admin' | 'employee';

export type CustomerStatus = 'active' | 'lead' | 'inactive';
export type CustomerKind = 'private' | 'business' | 'fleet' | 'public';
export type NoteKind = 'note' | 'call' | 'email' | 'meeting' | 'system';
export type Unit = 'hours' | 'piece' | 'liter' | 'meter' | 'flat';
export type InvoiceStatus = 'open' | 'paid';
export type InvoiceDisplayStatus = 'open' | 'overdue' | 'paid';
export type ExpenseCategory = 'material' | 'vehicles' | 'rent' | 'payroll' | 'tools' | 'insurance' | 'office' | 'other';
export type VatRate = 0 | 7 | 19;
export type Department = 'management' | 'office' | 'service' | 'workshop' | 'tuning' | 'parts';
export type FuelType = 'petrol' | 'diesel' | 'electric' | 'hybrid' | 'lpg';
export type ContractType = 'full_time' | 'part_time' | 'apprentice' | 'minijob';
export type AbsenceKind = 'vacation' | 'sick';
export type AbsenceStatus = 'requested' | 'approved' | 'rejected';
export type EmployeeStatus = 'on_duty' | 'vacation' | 'sick';

export const CUSTOMER_STATUSES: CustomerStatus[] = ['active', 'lead', 'inactive'];
export const CUSTOMER_KINDS: CustomerKind[] = ['private', 'business', 'fleet', 'public'];
export const NOTE_KINDS: NoteKind[] = ['note', 'call', 'email', 'meeting', 'system'];
export const UNITS: Unit[] = ['hours', 'piece', 'liter', 'meter', 'flat'];
export const EXPENSE_CATEGORIES: ExpenseCategory[] = ['material', 'vehicles', 'rent', 'payroll', 'tools', 'insurance', 'office', 'other'];
export const VAT_RATES: VatRate[] = [19, 7, 0];
export const DEPARTMENTS: Department[] = ['management', 'office', 'service', 'workshop', 'tuning', 'parts'];
export const FUEL_TYPES: FuelType[] = ['petrol', 'diesel', 'electric', 'hybrid', 'lpg'];
export const CONTRACT_TYPES: ContractType[] = ['full_time', 'part_time', 'apprentice', 'minijob'];

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  employeeId: string | null;
  active: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  vatId: string;
  taxNumber: string;
  bankName: string;
  iban: string;
  bic: string;
  paymentTermDays: number;
  invoiceFooter: string;
}

export interface Customer {
  id: string;
  number: number;
  name: string;
  kind: CustomerKind;
  status: CustomerStatus;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  vatId: string;
  paymentTermDays: number;
  ownerEmployeeId: string | null;
  tags: string[];
  createdAt: string;
}

export interface ContactPerson {
  id: string;
  customerId: string;
  name: string;
  position: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface Note {
  id: string;
  customerId: string;
  kind: NoteKind;
  text: string;
  authorUserId: string | null;
  authorName: string;
  createdAt: string;
}

/** Fahrzeug eines Kunden (Kfz-Werkstatt). */
export interface Vehicle {
  id: string;
  customerId: string;
  plate: string;
  make: string;
  model: string;
  variant: string;
  vin: string;
  firstRegistration: string | null;
  mileage: number | null;
  nextInspection: string | null; // nächste HU/AU
  fuel: FuelType;
  powerKw: number | null;
  notes: string;
  createdAt: string;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit: Unit;
  unitPriceCents: number;
}

export interface Invoice {
  id: string;
  number: number;
  customerId: string;
  issueDate: string;
  dueDate: string;
  vehicleId: string | null;
  mileage: number | null;
  vatRate: VatRate;
  status: InvoiceStatus;
  paidAt: string | null;
  dunningLevel: number;
  lastRemindedAt: string | null;
  createdAt: string;
  items: InvoiceItem[];
}

export interface Expense {
  id: string;
  date: string;
  supplier: string;
  category: ExpenseCategory;
  description: string;
  netCents: number;
  vatRate: VatRate;
  paid: boolean;
  createdAt: string;
}

export interface Employee {
  id: string;
  personnelNumber: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: Department;
  email: string;
  phone: string;
  active: boolean;
  /** Ab hier nur für Admin und die eigene Akte, sonst null. */
  hourlyRateCents: number | null;
  contractType: ContractType | null;
  weeklyHours: number | null;
  entryDate: string | null;
  probationEndDate: string | null;
  fixedTermEndDate: string | null;
  managerId: string | null;
  vacationDaysPerYear: number | null;
  carryOverDays: number | null;
}

export interface Absence {
  id: string;
  employeeId: string;
  kind: AbsenceKind;
  fromDate: string;
  toDate: string;
  status: AbsenceStatus;
  comment: string;
  decisionNote: string;
  requestedAt: string;
  decidedAt: string | null;
  decidedByName: string;
  seenByRequester: boolean;
}

export interface TimesheetMonth {
  id: string; // `${employeeId}:${month}`
  employeeId: string;
  month: string; // 'YYYY-MM'
  targetHours: number;
  workedHours: number;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  dueDate: string | null;
  createdAt: string;
}

export interface AppData {
  me: User;
  demoMode: boolean;
  hasLogo: boolean;
  company: CompanySettings;
  customers: Customer[];
  contacts: ContactPerson[];
  vehicles: Vehicle[];
  notes: Note[];
  invoices: Invoice[];
  expenses: Expense[];
  employees: Employee[];
  absences: Absence[];
  timesheets: TimesheetMonth[];
  tasks: Task[];
  users: User[];
}

export type CollectionKey =
  | 'customers'
  | 'contacts'
  | 'vehicles'
  | 'notes'
  | 'invoices'
  | 'expenses'
  | 'employees'
  | 'absences'
  | 'timesheets'
  | 'tasks'
  | 'users';

// ---- Eingaben an die API ----------------------------------------------------

export interface CustomerInput {
  name: string;
  kind: CustomerKind;
  status: CustomerStatus;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  vatId: string;
  paymentTermDays: number;
  ownerEmployeeId: string | null;
  tags: string[];
}

export interface ContactInput {
  name: string;
  position: string;
  phone: string;
  email: string;
  isPrimary: boolean;
}

export interface VehicleInput {
  plate: string;
  make: string;
  model: string;
  variant: string;
  vin: string;
  firstRegistration: string | null;
  mileage: number | null;
  nextInspection: string | null;
  fuel: FuelType;
  powerKw: number | null;
  notes: string;
}

export interface InvoiceItemInput {
  description: string;
  quantity: number;
  unit: Unit;
  unitPriceCents: number;
}

export interface InvoiceInput {
  customerId: string;
  vehicleId: string | null;
  mileage: number | null;
  issueDate: string;
  paymentTermDays: number;
  items: InvoiceItemInput[];
}

export interface ExpenseInput {
  date: string;
  supplier: string;
  category: ExpenseCategory;
  description: string;
  netCents: number;
  vatRate: VatRate;
  paid: boolean;
}

export interface EmployeeInput {
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: Department;
  email: string;
  phone: string;
  hourlyRateCents: number;
  contractType: ContractType;
  weeklyHours: number;
  entryDate: string;
  probationEndDate: string | null;
  fixedTermEndDate: string | null;
  managerId: string | null;
  vacationDaysPerYear: number;
  carryOverDays: number;
  active: boolean;
}

export interface AbsenceInput {
  employeeId: string;
  kind: AbsenceKind;
  fromDate: string;
  toDate: string;
  comment: string;
  approveDirectly?: boolean;
}

export interface UserInput {
  email: string;
  displayName: string;
  role: Role;
  employeeId: string | null;
}

export interface ImpressumData {
  name: string;
  representedBy: string;
  street: string;
  zipCity: string;
  phone: string;
  email: string;
  register: string;
  vatId: string;
  responsible: string;
  extra: string;
}

export interface LegalInfo {
  companyName: string;
  hasLogo: boolean;
  demoMode: boolean;
  /** null, wenn keine .impressum-Datei bzw. alle Felder leer sind. */
  impressum: ImpressumData | null;
  /** Markdown aus conf/datenschutz.md oder null. */
  datenschutz: string | null;
}

export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> };
}
