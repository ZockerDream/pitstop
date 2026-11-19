import type {
  AbsenceKind,
  AbsenceStatus,
  ContractType,
  CustomerKind,
  CustomerStatus,
  Department,
  EmployeeStatus,
  ExpenseCategory,
  FuelType,
  InvoiceDisplayStatus,
  NoteKind,
  Role,
  Unit,
} from './types';

/** Farbton für Badges; die Klassen dazu stehen zentral in der Badge-Komponente. */
export type Tone = 'green' | 'amber' | 'red' | 'blue' | 'gray' | 'indigo' | 'violet' | 'orange' | 'teal';

export const roleLabel: Record<Role, string> = { admin: 'Admin', employee: 'Mitarbeiter' };

export const customerStatusLabel: Record<CustomerStatus, string> = { active: 'Aktiv', lead: 'Lead', inactive: 'Inaktiv' };
export const customerStatusTone: Record<CustomerStatus, Tone> = { active: 'green', lead: 'amber', inactive: 'gray' };

export const customerKindLabel: Record<CustomerKind, string> = {
  private: 'Privat',
  business: 'Gewerbe',
  fleet: 'Fuhrpark',
  public: 'Öffentliche Hand',
};

export const noteKindLabel: Record<NoteKind, string> = {
  note: 'Notiz',
  call: 'Anruf',
  email: 'E-Mail',
  meeting: 'Termin',
  system: 'System',
};

export const unitLabel: Record<Unit, string> = { hours: 'Std.', piece: 'Stk.', liter: 'l', meter: 'm', flat: 'pauschal' };

export const invoiceStatusLabel: Record<InvoiceDisplayStatus, string> = { open: 'Offen', overdue: 'Überfällig', paid: 'Bezahlt' };
export const invoiceStatusTone: Record<InvoiceDisplayStatus, Tone> = { open: 'amber', overdue: 'red', paid: 'green' };

export const expenseCategoryLabel: Record<ExpenseCategory, string> = {
  material: 'Teile & Material',
  vehicles: 'Fahrzeuge & Ersatzwagen',
  rent: 'Miete & Nebenkosten',
  payroll: 'Löhne & Gehälter',
  tools: 'Werkzeug & Geräte',
  insurance: 'Versicherungen',
  office: 'Büro & IT',
  other: 'Sonstiges',
};
export const expenseCategoryTone: Record<ExpenseCategory, Tone> = {
  material: 'indigo',
  vehicles: 'blue',
  rent: 'violet',
  payroll: 'teal',
  tools: 'orange',
  insurance: 'gray',
  office: 'amber',
  other: 'gray',
};
/** Für Diagramme (Recharts braucht Hex-Werte). */
export const expenseCategoryColor: Record<ExpenseCategory, string> = {
  material: '#4f46e5',
  vehicles: '#0ea5e9',
  rent: '#8b5cf6',
  payroll: '#14b8a6',
  tools: '#f97316',
  insurance: '#71717a',
  office: '#f59e0b',
  other: '#a1a1aa',
};

export const departmentLabel: Record<Department, string> = {
  management: 'Geschäftsführung',
  office: 'Büro & Verwaltung',
  service: 'Serviceannahme',
  workshop: 'Werkstatt',
  tuning: 'Tuning & Performance',
  parts: 'Teile & Lager',
};

export const fuelLabel: Record<FuelType, string> = {
  petrol: 'Benzin',
  diesel: 'Diesel',
  electric: 'Elektro',
  hybrid: 'Hybrid',
  lpg: 'Autogas',
};

export const contractTypeLabel: Record<ContractType, string> = {
  full_time: 'Vollzeit',
  part_time: 'Teilzeit',
  apprentice: 'Ausbildung',
  minijob: 'Minijob',
};

export const absenceKindLabel: Record<AbsenceKind, string> = { vacation: 'Urlaub', sick: 'Krank' };
export const absenceStatusLabel: Record<AbsenceStatus, string> = { requested: 'Beantragt', approved: 'Genehmigt', rejected: 'Abgelehnt' };
export const absenceStatusTone: Record<AbsenceStatus, Tone> = { requested: 'amber', approved: 'green', rejected: 'gray' };

export const employeeStatusLabel: Record<EmployeeStatus, string> = { on_duty: 'Im Dienst', vacation: 'Urlaub', sick: 'Krank' };
export const employeeStatusTone: Record<EmployeeStatus, Tone> = { on_duty: 'green', vacation: 'blue', sick: 'red' };
