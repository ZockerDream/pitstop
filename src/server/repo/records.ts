// SQL für die Fachdaten einer Firma (Kunden, Fahrzeuge, Aufträge, Einsätze, Rechnungen, Buchungen, Dienstzeiten).
// Jede Abfrage ist an company_id gebunden, damit keine Firma Daten einer anderen sieht.
import type {
  Absence, Application, Bay, BayBooking, Bill, Callout, CashClosing, ChampRow, Contract, CourseSession, Customer, DutyCorrection, DutySession, DynoRun, FleetCar, FleetLog,
  Goal, Lap, License, Message, Order, Part, PartOrder, Payslip, RaceCar, RaceEntry, RaceEvent, Rank, Service, Setup, Shift, StandingOrder, Tool, TrackdayBooking, Transaction, Vehicle, Webhook,
} from '../../shared/types';
import type { Queryable } from '../db/pool';

interface TableDef {
  table: string;
  /** camelCase-Feld → Spalte */
  cols: Record<string, string>;
  /** Felder, die über die API geschrieben werden dürfen */
  writable: string[];
  order: string;
}

export const TABLES = {
  customers: {
    table: 'customers',
    cols: { id: 'id', number: 'number', name: 'name', kind: 'kind', phone: 'phone', note: 'note', discount: 'discount', blocked: 'blocked', createdAt: 'created_at' },
    writable: ['name', 'kind', 'phone', 'note', 'discount', 'blocked'],
    order: 'name',
  },
  vehicles: {
    table: 'vehicles',
    cols: { id: 'id', customerId: 'customer_id', plate: 'plate', model: 'model', note: 'note', stolen: 'stolen', createdAt: 'created_at' },
    writable: ['customerId', 'plate', 'model', 'note'],
    order: 'plate',
  },
  orders: {
    table: 'orders',
    cols: {
      id: 'id', number: 'number', title: 'title', kind: 'kind', status: 'status', priority: 'priority', customerId: 'customer_id', vehicleId: 'vehicle_id',
      assigneeId: 'assignee_id', amountCents: 'amount_cents', progress: 'progress', note: 'note', intake: 'intake', serviceId: 'service_id', createdBy: 'created_by', createdAt: 'created_at', updatedAt: 'updated_at',
    },
    writable: ['title', 'kind', 'status', 'priority', 'customerId', 'vehicleId', 'assigneeId', 'amountCents', 'progress', 'note', 'serviceId'],
    order: 'number DESC',
  },
  callouts: {
    table: 'callouts',
    cols: {
      id: 'id', number: 'number', location: 'location', x: 'x', y: 'y', requester: 'requester', vehicle: 'vehicle', status: 'status', driverId: 'driver_id',
      truck: 'truck', feeCents: 'fee_cents', createdBy: 'created_by', createdAt: 'created_at', doneAt: 'done_at',
    },
    writable: ['location', 'x', 'y', 'requester', 'vehicle', 'status', 'driverId', 'truck', 'feeCents'],
    order: 'number DESC',
  },
  bills: {
    table: 'bills',
    cols: {
      id: 'id', number: 'number', customerId: 'customer_id', orderId: 'order_id', calloutId: 'callout_id', title: 'title', amountCents: 'amount_cents',
      status: 'status', kind: 'kind', reminders: 'reminders', remindedAt: 'reminded_at', dueDate: 'due_date', paidAt: 'paid_at', createdBy: 'created_by', createdAt: 'created_at',
    },
    writable: ['customerId', 'orderId', 'calloutId', 'title', 'amountCents', 'dueDate'],
    order: 'number DESC',
  },
  transactions: {
    table: 'transactions',
    cols: { id: 'id', account: 'account', amountCents: 'amount_cents', text: 'text', category: 'category', billId: 'bill_id', bookedAt: 'booked_at', createdBy: 'created_by', createdAt: 'created_at' },
    writable: ['account', 'amountCents', 'text', 'category', 'bookedAt'],
    order: 'booked_at DESC, created_at DESC',
  },
  duty: {
    table: 'duty_sessions',
    cols: { id: 'id', userId: 'user_id', startedAt: 'started_at', endedAt: 'ended_at', note: 'note' },
    writable: ['startedAt', 'endedAt', 'note'],
    order: 'started_at DESC',
  },
  parts: {
    table: 'parts',
    cols: { id: 'id', sku: 'sku', name: 'name', unit: 'unit', qty: 'qty', minQty: 'min_qty', priceCents: 'price_cents', location: 'location', note: 'note', createdAt: 'created_at' },
    writable: ['sku', 'name', 'unit', 'qty', 'minQty', 'priceCents', 'location', 'note'],
    order: 'name',
  },
  shifts: {
    table: 'shifts',
    cols: { id: 'id', userId: 'user_id', startsAt: 'starts_at', endsAt: 'ends_at', role: 'role', note: 'note', createdBy: 'created_by' },
    writable: ['userId', 'startsAt', 'endsAt', 'role', 'note'],
    order: 'starts_at',
  },
  payslips: {
    table: 'payslips',
    cols: {
      id: 'id', userId: 'user_id', periodFrom: 'period_from', periodTo: 'period_to', minutes: 'minutes', wageCents: 'wage_cents', commissionCents: 'commission_cents', fixedCents: 'fixed_cents',
      bonusCents: 'bonus_cents', totalCents: 'total_cents', status: 'status', paidAt: 'paid_at', createdAt: 'created_at',
    },
    writable: ['bonusCents'],
    order: 'period_to DESC, created_at DESC',
  },
  dyno: {
    table: 'dyno_runs',
    cols: { id: 'id', vehicleId: 'vehicle_id', label: 'label', hp: 'hp', torque: 'torque', note: 'note', createdAt: 'created_at' },
    writable: ['vehicleId', 'label', 'hp', 'torque', 'note'],
    order: 'created_at DESC',
  },
  events: {
    table: 'race_events',
    cols: {
      id: 'id', name: 'name', kind: 'kind', startsAt: 'starts_at', track: 'track', laps: 'laps', feeCents: 'fee_cents', prizeCents: 'prize_cents',
      maxEntries: 'max_entries', status: 'status', note: 'note',
    },
    writable: ['name', 'kind', 'startsAt', 'track', 'laps', 'feeCents', 'prizeCents', 'maxEntries', 'status', 'note'],
    order: 'starts_at',
  },
  entries: {
    table: 'race_entries',
    cols: { id: 'id', eventId: 'event_id', driver: 'driver', car: 'car', startNo: 'start_no', customerId: 'customer_id', team: 'team', paid: 'paid', lapMs: 'lap_ms', position: 'position', carId: 'car_id' },
    writable: ['driver', 'car', 'startNo', 'customerId', 'team', 'lapMs', 'position', 'carId'],
    order: 'position NULLS LAST, lap_ms NULLS LAST, created_at',
  },
  partOrders: {
    table: 'part_orders',
    cols: { id: 'id', partId: 'part_id', qty: 'qty', supplier: 'supplier', costCents: 'cost_cents', expected: 'expected', status: 'status', createdAt: 'created_at', deliveredAt: 'delivered_at' },
    writable: ['qty', 'supplier', 'costCents', 'expected'],
    order: 'created_at DESC',
  },
  bays: { table: 'bays', cols: { id: 'id', name: 'name', kind: 'kind', position: 'position' }, writable: ['name', 'kind', 'position'], order: 'position, name' },
  bookings: {
    table: 'bay_bookings',
    cols: { id: 'id', bayId: 'bay_id', orderId: 'order_id', title: 'title', startsAt: 'starts_at', endsAt: 'ends_at', createdBy: 'created_by' },
    writable: ['bayId', 'orderId', 'title', 'startsAt', 'endsAt'],
    order: 'starts_at',
  },
  tools: {
    table: 'tools',
    cols: { id: 'id', name: 'name', info: 'info', location: 'location', status: 'status', holderId: 'holder_id', since: 'since', checkDue: 'check_due', note: 'note' },
    writable: ['name', 'info', 'location', 'checkDue', 'note'],
    order: 'name',
  },
  fleet: {
    table: 'fleet',
    cols: { id: 'id', name: 'name', model: 'model', plate: 'plate', km: 'km', fuel: 'fuel', status: 'status', driverId: 'driver_id', serviceDue: 'service_due', note: 'note' },
    writable: ['name', 'model', 'plate', 'km', 'fuel', 'serviceDue', 'note'],
    order: 'name',
  },
  fleetLog: {
    table: 'fleet_log',
    cols: { id: 'id', fleetId: 'fleet_id', userId: 'user_id', action: 'action', km: 'km', fuel: 'fuel', costCents: 'cost_cents', note: 'note', createdAt: 'created_at' },
    writable: [],
    order: 'created_at DESC',
  },
  raceCars: {
    table: 'race_cars',
    cols: { id: 'id', number: 'number', car: 'car', driverId: 'driver_id', status: 'status', km: 'km', wear: 'wear', budgetCents: 'budget_cents', note: 'note' },
    writable: ['number', 'car', 'driverId', 'status', 'km', 'wear', 'budgetCents', 'note'],
    order: 'number, car',
  },
  championship: { table: 'championship', cols: { id: 'id', season: 'season', team: 'team', points: 'points', own: 'own' }, writable: ['season', 'team', 'points', 'own'], order: 'season DESC, points DESC' },
  setups: {
    table: 'setups',
    cols: { id: 'id', carId: 'car_id', track: 'track', vals: 'vals', note: 'note', updatedAt: 'updated_at' },
    writable: ['vals', 'note'],
    order: 'track',
  },
  laps: {
    table: 'laps',
    cols: { id: 'id', carId: 'car_id', driver: 'driver', track: 'track', s1: 's1', s2: 's2', s3: 's3', session: 'session', createdAt: 'created_at' },
    writable: ['carId', 'driver', 'track', 's1', 's2', 's3', 'session'],
    order: 'created_at DESC',
  },
  trackdays: {
    table: 'trackday_bookings',
    cols: { id: 'id', eventId: 'event_id', customerId: 'customer_id', vehicleId: 'vehicle_id', package: 'package', priceCents: 'price_cents', transport: 'transport', status: 'status', billId: 'bill_id' },
    writable: ['eventId', 'customerId', 'vehicleId', 'package', 'priceCents', 'transport', 'status'],
    order: 'created_at DESC',
  },
  contracts: {
    table: 'contracts',
    cols: { id: 'id', customerId: 'customer_id', title: 'title', workshopPct: 'workshop_pct', tuningPct: 'tuning_pct', rules: 'rules', billing: 'billing', validUntil: 'valid_until', status: 'status' },
    writable: ['customerId', 'title', 'workshopPct', 'tuningPct', 'rules', 'billing', 'validUntil', 'status'],
    order: 'created_at',
  },
  messages: {
    table: 'messages',
    cols: { id: 'id', customerId: 'customer_id', dir: 'dir', text: 'text', userId: 'user_id', read: 'read', createdAt: 'created_at' },
    writable: [],
    order: 'created_at',
  },
  ranks: {
    table: 'ranks',
    cols: { id: 'id', name: 'name', position: 'position', wageCents: 'wage_cents', commissionPct: 'commission_pct', fixedCents: 'fixed_cents', groups: 'groups' },
    writable: ['name', 'position', 'wageCents', 'commissionPct', 'fixedCents', 'groups'],
    order: 'position, name',
  },
  applications: {
    table: 'applications',
    cols: { id: 'id', name: 'name', role: 'role', contact: 'contact', text: 'text', rating: 'rating', status: 'status', interviewAt: 'interview_at', note: 'note', createdAt: 'created_at' },
    writable: ['name', 'role', 'contact', 'text', 'rating', 'status', 'interviewAt', 'note'],
    order: 'created_at DESC',
  },
  absences: {
    table: 'absences',
    cols: { id: 'id', userId: 'user_id', dateFrom: 'date_from', dateTo: 'date_to', kind: 'kind', status: 'status', note: 'note', decidedBy: 'decided_by' },
    writable: ['dateFrom', 'dateTo', 'kind', 'note'],
    order: 'date_from DESC',
  },
  corrections: {
    table: 'duty_corrections',
    cols: { id: 'id', userId: 'user_id', dutyId: 'duty_id', startedAt: 'started_at', endedAt: 'ended_at', reason: 'reason', status: 'status', decidedBy: 'decided_by' },
    writable: [],
    order: 'created_at DESC',
  },
  sessions: {
    table: 'course_sessions',
    cols: { id: 'id', courseId: 'course_id', startsAt: 'starts_at', kind: 'kind', trainerId: 'trainer_id', participants: 'participants', note: 'note' },
    writable: ['courseId', 'startsAt', 'kind', 'trainerId', 'note'],
    order: 'starts_at',
  },
  licenses: { table: 'licenses', cols: { id: 'id', name: 'name', holderId: 'holder_id', validUntil: 'valid_until', note: 'note' }, writable: ['name', 'holderId', 'validUntil', 'note'], order: 'valid_until NULLS LAST, name' },
  closings: {
    table: 'cash_closings',
    cols: { id: 'id', expectedCents: 'expected_cents', countedCents: 'counted_cents', note: 'note', createdBy: 'created_by', createdAt: 'created_at' },
    writable: [],
    order: 'created_at DESC',
  },
  standing: {
    table: 'standing_orders',
    cols: { id: 'id', text: 'text', amountCents: 'amount_cents', account: 'account', category: 'category', every: 'every', nextDate: 'next_date', active: 'active' },
    writable: ['text', 'amountCents', 'account', 'category', 'every', 'nextDate', 'active'],
    order: 'next_date',
  },
  goals: { table: 'goals', cols: { id: 'id', name: 'name', targetCents: 'target_cents', account: 'account', deadline: 'deadline' }, writable: ['name', 'targetCents', 'account', 'deadline'], order: 'created_at' },
  services: {
    table: 'services',
    cols: { id: 'id', name: 'name', area: 'area', priceCents: 'price_cents', courseId: 'course_id', note: 'note' },
    writable: ['name', 'area', 'priceCents', 'courseId', 'note'],
    order: 'area, name',
  },
  webhooks: {
    table: 'webhooks',
    cols: { id: 'id', name: 'name', url: 'url', kind: 'kind', events: 'events', active: 'active', lastStatus: 'last_status', lastAt: 'last_at', fails: 'fails' },
    writable: ['name', 'url', 'kind', 'events', 'active'],
    order: 'created_at',
  },
} satisfies Record<string, TableDef>;

export type Kind = keyof typeof TABLES;
export interface RowOf {
  customers: Customer;
  vehicles: Vehicle;
  orders: Order;
  callouts: Callout;
  bills: Bill;
  transactions: Transaction;
  duty: DutySession;
  parts: Part;
  shifts: Shift;
  payslips: Payslip;
  dyno: DynoRun;
  events: RaceEvent;
  entries: RaceEntry;
  partOrders: PartOrder;
  bays: Bay;
  bookings: BayBooking;
  tools: Tool;
  fleet: FleetCar;
  fleetLog: FleetLog;
  raceCars: RaceCar;
  championship: ChampRow;
  setups: Setup;
  laps: Lap;
  trackdays: TrackdayBooking;
  contracts: Contract;
  messages: Message;
  ranks: Rank;
  applications: Application;
  absences: Absence;
  corrections: DutyCorrection;
  sessions: CourseSession;
  licenses: License;
  closings: CashClosing;
  standing: StandingOrder;
  goals: Goal;
  services: Service;
  webhooks: Webhook;
}

/** Objekte und Listen landen in jsonb-Spalten; pg würde Listen sonst als Postgres-Array senden. */
const toDb = (v: unknown) => (v !== null && typeof v === 'object' && !(v instanceof Date) ? JSON.stringify(v) : v);

const select = (k: Kind) => Object.entries(TABLES[k].cols).map(([f, c]) => `${c} AS "${f}"`).join(', ');

export async function listRows<K extends Kind>(q: Queryable, k: K, companyId: string, where = '', params: unknown[] = [], limit = 2000): Promise<RowOf[K][]> {
  const d = TABLES[k];
  const { rows } = await q.query<RowOf[K] & object>(
    `SELECT ${select(k)} FROM ${d.table} WHERE company_id = $1 ${where ? `AND (${where})` : ''} ORDER BY ${d.order} LIMIT ${limit}`,
    [companyId, ...params],
  );
  return rows as RowOf[K][];
}

export async function getRow<K extends Kind>(q: Queryable, k: K, companyId: string, id: string): Promise<RowOf[K] | null> {
  const { rows } = await q.query<RowOf[K] & object>(`SELECT ${select(k)} FROM ${TABLES[k].table} WHERE company_id = $1 AND id = $2`, [companyId, id]);
  return (rows[0] as RowOf[K]) ?? null;
}

/** Fügt eine Zeile ein; data darf neben den schreibbaren Feldern auch createdBy/userId enthalten. */
export async function insertRow<K extends Kind>(q: Queryable, k: K, companyId: string, data: Record<string, unknown>): Promise<RowOf[K]> {
  const d = TABLES[k];
  const cols = ['company_id'];
  const values: unknown[] = [companyId];
  for (const [f, v] of Object.entries(data)) {
    const c = (d.cols as Record<string, string>)[f];
    if (!c || v === undefined || f === 'id') continue;
    cols.push(c);
    values.push(toDb(v));
  }
  const { rows } = await q.query<RowOf[K] & object>(
    `INSERT INTO ${d.table} (${cols.join(', ')}) VALUES (${values.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${select(k)}`,
    values,
  );
  return rows[0] as RowOf[K];
}

/** Ändert nur schreibbare Felder (plus ausdrücklich erlaubte Extras wie status bei Rechnungen). */
export async function updateRow<K extends Kind>(q: Queryable, k: K, companyId: string, id: string, patch: Record<string, unknown>, extra: string[] = []): Promise<RowOf[K] | null> {
  const d = TABLES[k];
  const allowed = new Set([...d.writable, ...extra]);
  const sets: string[] = [];
  const values: unknown[] = [companyId, id];
  for (const [f, v] of Object.entries(patch)) {
    const c = (d.cols as Record<string, string>)[f];
    if (!c || !allowed.has(f) || v === undefined) continue;
    values.push(toDb(v));
    sets.push(`${c} = $${values.length}`);
  }
  if (k === 'orders' && sets.length) sets.push('updated_at = now()');
  if (!sets.length) return getRow(q, k, companyId, id);
  const { rows } = await q.query<RowOf[K] & object>(
    `UPDATE ${d.table} SET ${sets.join(', ')} WHERE company_id = $1 AND id = $2 RETURNING ${select(k)}`,
    values,
  );
  return (rows[0] as RowOf[K]) ?? null;
}

export async function deleteRow(q: Queryable, k: Kind, companyId: string, id: string): Promise<boolean> {
  const r = await q.query(`DELETE FROM ${TABLES[k].table} WHERE company_id = $1 AND id = $2`, [companyId, id]);
  return (r.rowCount ?? 0) > 0;
}
