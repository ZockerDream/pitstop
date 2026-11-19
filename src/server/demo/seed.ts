// Demo-Seed: schreibt den Demo-Betrieb relativ zu „heute“ in die Datenbank (deterministisch je Seed-Tag).
import type { PoolClient } from 'pg';
import {
  addDays,
  addMonths,
  diffDays,
  isWeekend,
  lastMonths,
  monthEnd,
  monthKey,
  monthStart,
  parseDate,
  rangesOverlap,
  weekStart,
  workdaysBetween,
} from '../../shared/dates';
import { formatDate } from '../../shared/format';
import { totalsFor } from '../../shared/money';
import type { AbsenceKind, FuelType, InvoiceItemInput } from '../../shared/types';
import { generatePassword, hashPassword } from '../auth/password';
import { insertAbsence } from '../repo/absences';
import { insertContact, insertCustomer, insertNote } from '../repo/customers';
import { insertEmployee, updateEmployee, upsertTimesheet } from '../repo/employees';
import { insertExpense } from '../repo/expenses';
import { insertInvoice } from '../repo/invoices';
import { setCompany } from '../repo/settings';
import { insertTask } from '../repo/tasks';
import { insertUser } from '../repo/users';
import { insertVehicle } from '../repo/vehicles';
import { Random } from './random';
import {
  DEMO_COMPANY,
  DEMO_CUSTOMERS,
  DEMO_DOMAIN,
  DEMO_EMPLOYEES,
  DEMO_TASKS,
  EVERYDAY_CARS,
  FIRST_NAMES,
  JOBS,
  LAST_NAMES,
  PLACES,
  STREETS,
  WALKIN_COUNT,
  MATERIAL_DESCRIPTIONS,
  MATERIAL_SUPPLIERS,
  NOTE_AUTHORS,
  NOTE_TEXTS,
  type DemoCustomer,
  type ItemSpec,
  type JobSpec,
} from './templates';

export const DEMO_ADMIN_EMAIL = `katrin.lindner@${DEMO_DOMAIN}`;
export const DEMO_EMPLOYEE_EMAIL = `jonas.weber@${DEMO_DOMAIN}`;
const DECIDER = 'Katrin Lindner';

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/[^a-z]/g, '');
}

/** Samstag/Sonntag auf den Freitag davor schieben. */
function weekdayOnOrBefore(iso: string): string {
  let d = iso;
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

function randomWeekday(rng: Random, from: string, to: string): string | null {
  const span = diffDays(from, to);
  if (span < 0) return null;
  for (let i = 0; i < 10; i++) {
    const d = addDays(from, rng.int(0, span));
    if (!isWeekend(d)) return d;
  }
  return null;
}

function isoWeek(iso: string): number {
  const d = parseDate(iso);
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dayNr = (target.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = new Date(target.getFullYear(), 0, 4);
  return 1 + Math.round(((target.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
}

function buildItems(rng: Random, specs: ItemSpec[]): InvoiceItemInput[] {
  const items: InvoiceItemInput[] = [];
  for (const s of specs) {
    if (s.optional !== undefined && !rng.chance(s.optional)) continue;
    const quantity = s.half ? rng.int(s.qty[0] * 2, s.qty[1] * 2) / 2 : rng.int(s.qty[0], s.qty[1]);
    const unitPriceCents = s.price[0] === s.price[1] ? s.price[0] : rng.amount(s.price[0], s.price[1], 500);
    items.push({ description: s.description, unit: s.unit, quantity, unitPriceCents });
  }
  return items;
}

interface SeedVehicle {
  id: string;
  plate: string;
  fuel: FuelType;
  kw: number;
  mileage: number;
  kmPerDay: number;
}

const VIN_PREFIX: Record<string, string> = {
  VW: 'WVW', Audi: 'WAU', BMW: 'WBA', Porsche: 'WP0', 'Mercedes-Benz': 'WDD', 'Mercedes-AMG': 'WDD', Skoda: 'TMB', Opel: 'W0L',
  Ford: 'WF0', Renault: 'VF1', Toyota: 'SB1', Mini: 'WMW', Tesla: 'LRW', Fiat: 'ZFA', MAN: 'WMA', Cupra: 'VSS', 'Citroën': 'VF7',
};
const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
const PLATE_LETTERS = 'ABCDEFGHJKLMNPRSTUVWXYZ';

/** Passt eine Leistung zum Fahrzeug? (Tuning nur an sportlichen Verbrennern, Öl nicht am E-Auto …) */
function fits(v: SeedVehicle, filter: JobSpec['vehicles']): boolean {
  if (!filter) return true;
  if (filter === 'electric') return v.fuel === 'electric';
  if (filter === 'combustion') return v.fuel !== 'electric';
  return v.kw >= 180 && (v.fuel === 'petrol' || v.fuel === 'diesel');
}

interface GenInvoice {
  customer: DemoCustomer;
  vehicle?: SeedVehicle;
  issueDate: string;
  items: InvoiceItemInput[];
  special?: boolean;
  number?: number;
  status?: 'open' | 'paid';
  paidAt?: string | null;
  dunningLevel?: number;
  lastRemindedAt?: string | null;
}

/** Löscht alle Fachdaten und Benutzer (nur Demo-Modus). */
export async function wipeAll(client: PoolClient): Promise<void> {
  await client.query(
    `TRUNCATE sessions, users, settings, invoice_items, invoices, notes, contacts, vehicles, customers, expenses, absences, timesheets, tasks, employees RESTART IDENTITY CASCADE`,
  );
  await client.query('ALTER SEQUENCE personnel_number_seq RESTART WITH 1');
  await client.query('ALTER SEQUENCE customer_number_seq RESTART WITH 10001');
  await client.query('ALTER SEQUENCE invoice_number_seq RESTART WITH 1001');
}

/** Laufkundschaft: Privatkunden mit einem (selten zwei) Alltagsfahrzeugen. */
function walkInCustomers(rng: Random): DemoCustomer[] {
  const used = new Set<string>();
  const list: DemoCustomer[] = [];
  const pickCar = () => rng.weighted(EVERYDAY_CARS.map((c) => [c, c[5]] as const));
  for (let i = 0; i < WALKIN_COUNT; i++) {
    let name: string;
    do name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    while (used.has(name));
    used.add(name);
    const [zip, city] = rng.pick(PLACES);
    const [first, last] = name.split(' ');
    const mail = rng.chance(0.55) ? `${first.toLowerCase()}.${last.toLowerCase().replace(/ü/g, 'ue').replace(/ö/g, 'oe').replace(/ß/g, 'ss')}@mail.example` : '';
    const phone = rng.chance(0.6) ? `01${rng.pick(['51', '60', '70', '76'])} 555${String(rng.int(1000, 9999))}` : `0941 ${rng.int(20000, 99999)}`;
    const cars = [pickCar(), ...(rng.chance(0.15) ? [pickCar()] : [])];
    list.push({
      key: `walkin-${i}`,
      name,
      kind: 'private',
      status: rng.chance(0.9) ? 'active' : 'inactive',
      street: `${rng.pick(STREETS)} ${rng.int(1, 60)}`,
      zip,
      city,
      phone,
      email: mail,
      paymentTermDays: 14,
      createdDaysAgo: rng.int(60, 3200),
      contacts: [{ name, position: '', phone, email: mail, primary: true }],
      vehicles: cars.map(([make, model, variant, fuel, kw]) => [make, model, variant, fuel, kw, rng.int(2010, 2024)]),
    });
  }
  return list;
}

export async function seedDemo(client: PoolClient, today: string): Promise<void> {
  const rng = Random.fromString(`pitstop-demo-${today}`);
  const CUSTOMERS = [...DEMO_CUSTOMERS, ...walkInCustomers(rng)];
  const thisYear = Number(today.slice(0, 4));

  await setCompany(client, DEMO_COMPANY);

  // ---- Mitarbeitende
  const empId = new Map<string, string>();
  const empName = new Map<string, string>();
  for (const e of DEMO_EMPLOYEES) {
    let entryDate = e.entryDate ?? addDays(today, -(e.entryDaysAgo ?? 0));
    if (e.contractType === 'apprentice') {
      const septThisYear = `${thisYear}-09-01`;
      entryDate = today >= septThisYear ? `${thisYear - 1}-09-01` : `${thisYear - 2}-09-01`;
    }
    const created = await insertEmployee(client, {
      firstName: e.firstName,
      lastName: e.lastName,
      jobTitle: e.jobTitle,
      department: e.department,
      email: `${slug(e.firstName)}.${slug(e.lastName)}@${DEMO_DOMAIN}`,
      phone: `0941 123456-${e.phoneExt}`,
      hourlyRateCents: e.hourlyRateCents,
      contractType: e.contractType,
      weeklyHours: e.weeklyHours,
      entryDate,
      probationEndDate: e.probationMonths ? addMonths(entryDate, e.probationMonths) : null,
      fixedTermEndDate: e.fixedTermYears ? addDays(addMonths(entryDate, e.fixedTermYears * 12), -1) : null,
      managerId: null,
      vacationDaysPerYear: e.vacationDaysPerYear,
      carryOverDays: e.carryOverDays,
      active: true,
    });
    empId.set(e.key, created.id);
    empName.set(e.key, `${e.firstName} ${e.lastName}`);
  }
  for (const e of DEMO_EMPLOYEES) {
    if (e.manager) await updateEmployee(client, empId.get(e.key)!, { managerId: empId.get(e.manager)! });
  }

  // ---- Demo-Benutzer (Anmeldung per Ein-Klick-Login, Passwort zufällig)
  const adminUser = await insertUser(client, {
    email: DEMO_ADMIN_EMAIL,
    displayName: 'Katrin Lindner',
    role: 'admin',
    employeeId: empId.get('lindner')!,
    passwordHash: await hashPassword(generatePassword(24)),
    mustChangePassword: false,
    isDemo: true,
  });
  await insertUser(client, {
    email: DEMO_EMPLOYEE_EMAIL,
    displayName: 'Jonas Weber',
    role: 'employee',
    employeeId: empId.get('weber')!,
    passwordHash: await hashPassword(generatePassword(24)),
    mustChangePassword: false,
    isDemo: true,
  });

  // ---- Kunden und Ansprechpartner
  const custId = new Map<string, string>();
  const custCreated = new Map<string, string>();
  for (const c of CUSTOMERS) {
    const createdAt = addDays(today, -c.createdDaysAgo);
    const created = await insertCustomer(
      client,
      {
        name: c.name,
        kind: c.kind,
        status: c.status,
        street: c.street,
        zip: c.zip,
        city: c.city,
        phone: c.phone,
        email: c.email,
        vatId: '',
        paymentTermDays: c.paymentTermDays,
        ownerEmployeeId: c.owner ? empId.get(c.owner)! : null,
        tags: c.tags ?? [],
      },
      createdAt,
    );
    custId.set(c.key, created.id);
    custCreated.set(c.key, createdAt);
    for (const contact of c.contacts) {
      await insertContact(client, created.id, {
        name: contact.name,
        position: contact.position,
        phone: contact.phone,
        email: contact.email,
        isPrimary: contact.primary ?? false,
      });
    }
  }

  // ---- Fahrzeuge (Kennzeichen, FIN, km-Stand, nächste HU)
  const vehiclesOf = new Map<string, SeedVehicle[]>();
  const usedPlates = new Set<string>();
  const kmPerYear = { fleet: 35000, public: 25000, business: 22000, private: 13000 } as const;
  for (const c of CUSTOMERS) {
    const list: SeedVehicle[] = [];
    for (const [make, model, variant, fuel, kw, year, notes] of c.vehicles) {
      let plate: string;
      do {
        const letters = PLATE_LETTERS[rng.int(0, PLATE_LETTERS.length - 1)] + PLATE_LETTERS[rng.int(0, PLATE_LETTERS.length - 1)];
        plate = `${c.district ?? 'R'}-${letters} ${rng.int(1, 9999)}${year < 1990 ? 'H' : fuel === 'electric' ? 'E' : ''}`;
      } while (usedPlates.has(plate));
      usedPlates.add(plate);
      let vin = (VIN_PREFIX[make] ?? 'WDD') + 'ZZZ';
      while (vin.length < 17) vin += VIN_CHARS[rng.int(0, VIN_CHARS.length - 1)];
      const firstRegistration = `${year}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
      const ageDays = Math.max(30, diffDays(firstRegistration, today));
      const motorsport = c.tags?.includes('Motorsport') ?? false;
      const perYear = (motorsport ? 6000 : kmPerYear[c.kind]) * (0.6 + rng.next() * 0.7);
      const mileage = Math.max(300, Math.round((perYear * ageDays) / 365 / 10) * 10);
      const created = await insertVehicle(client, custId.get(c.key)!, {
        plate,
        make,
        model,
        variant,
        vin: rng.chance(0.85) ? vin : '',
        firstRegistration: firstRegistration > today ? today : firstRegistration,
        mileage,
        nextInspection: addDays(today, rng.int(-25, 700)),
        fuel,
        powerKw: kw,
        notes: notes ?? '',
      });
      list.push({ id: created.id, plate, fuel, kw, mileage, kmPerDay: perYear / 365 });
    }
    vehiclesOf.set(c.key, list);
  }

  // ---- Rechnungen
  const months = lastMonths(today, 6);
  const currentMonth = monthKey(today);
  const invoices: GenInvoice[] = [];
  // #1042: Mietwagen Sommer, Transporter, seit über 20 Tagen überfällig, 2.000 € netto / 2.380 € brutto
  const special: GenInvoice = {
    customer: CUSTOMERS.find((c) => c.key === 'sommer')!,
    vehicle: vehiclesOf.get('sommer')![2],
    issueDate: weekdayOnOrBefore(addDays(today, -53)),
    special: true,
    items: [
      { description: 'Fuhrpark-Check je Fahrzeug (UVV-Prüfung)', unit: 'piece', quantity: 5, unitPriceCents: 10900 },
      { description: 'Bremsscheiben und Bremsbeläge Vorderachse (Transporter)', unit: 'piece', quantity: 1, unitPriceCents: 67100 },
      { description: 'Arbeitszeit Kfz-Mechatroniker', unit: 'hours', quantity: 7, unitPriceCents: 11200 },
    ],
  };
  invoices.push(special);
  const sizeCounts = { small: [50, 60], medium: [30, 36], large: [14, 17] } as const;
  // Inspektion, HU, Zahnriemen, Umbauten … braucht ein Auto im Halbjahr höchstens einmal.
  const ONCE_PER_VEHICLE = new Set(['inspection', 'ev-service', 'hu', 'ac', 'timing', 'clutch', 'engine', 'stage1', 'stage2', 'suspension']);
  const doneOnce = new Set<string>();
  const usable = (v: SeedVehicle, job: JobSpec) => fits(v, job.vehicles) && !(ONCE_PER_VEHICLE.has(job.key) && doneOnce.has(`${v.id}:${job.key}`));
  months.forEach((month, monthIndex) => {
    const start = monthStart(month);
    const fullEnd = monthEnd(month);
    const end = month === currentMonth ? today : fullEnd;
    const fraction = month === currentMonth ? workdaysBetween(start, end) / Math.max(1, workdaysBetween(start, fullEnd)) : 1;
    for (const size of ['small', 'medium', 'large'] as const) {
      const [lo, hi] = sizeCounts[size];
      const count = Math.round(rng.int(lo, hi) * fraction);
      const jobs = JOBS.filter((j) => j.size === size);
      for (let i = 0; i < count; i++) {
        const issueDate = randomWeekday(rng, start, end);
        if (!issueDate) continue;
        const job = rng.weighted(jobs.map((j) => [j, j.weight ?? 1] as const));
        const candidates = CUSTOMERS.filter(
          (c) =>
            job.kinds.includes(c.kind) &&
            custCreated.get(c.key)! <= issueDate &&
            (vehiclesOf.get(c.key) ?? []).some((v) => usable(v, job)) &&
            (c.status === 'active' || (c.status === 'inactive' && monthIndex < 2 && rng.chance(0.3))),
        );
        if (candidates.length === 0) continue;
        // Gewichtet nach passenden Fahrzeugen: ein Fuhrpark kommt öfter als ein Privatkunde mit einem Auto.
        const customer = rng.weighted(candidates.map((c) => [c, vehiclesOf.get(c.key)!.filter((v) => usable(v, job)).length] as const));
        const vehicle = rng.pick(vehiclesOf.get(customer.key)!.filter((v) => usable(v, job)));
        if (ONCE_PER_VEHICLE.has(job.key)) doneOnce.add(`${vehicle.id}:${job.key}`);
        invoices.push({ customer, vehicle, issueDate, items: buildItems(rng, job.items) });
      }
    }
  });

  invoices.sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  const specialIndex = invoices.indexOf(special);
  const firstNumber = Math.max(1, 1042 - specialIndex);
  invoices.forEach((inv, i) => (inv.number = firstNumber + i));

  for (const inv of invoices) {
    const due = addDays(inv.issueDate, inv.customer.paymentTermDays);
    if (due < today) {
      inv.status = 'paid';
      const paid = addDays(inv.issueDate, rng.int(3, inv.customer.paymentTermDays + 10));
      inv.paidAt = paid >= today ? addDays(today, -1) : paid;
    } else if (diffDays(inv.issueDate, today) >= 7 && rng.chance(0.35)) {
      inv.status = 'paid';
      inv.paidAt = addDays(inv.issueDate, rng.int(2, diffDays(inv.issueDate, today) - 1));
    } else {
      inv.status = 'open';
      inv.paidAt = null;
    }
  }
  special.status = 'open';
  special.paidAt = null;
  special.dunningLevel = 0;

  // Weitere überfällige Rechnungen: eine ungemahnt, eine mit alter Mahnung (Aufgabe erscheint), eine frisch gemahnt.
  const overdueCandidates = invoices.filter((inv) => {
    if (inv.special || inv.customer.kind === 'private') return false;
    const due = addDays(inv.issueDate, inv.customer.paymentTermDays);
    return due < addDays(today, -3) && due > addDays(today, -75);
  });
  const reminded: GenInvoice[] = [];
  const pickOverdue = (minDaysOverdue: number) => {
    const found = overdueCandidates.find(
      (inv) => !inv.dunningLevel && inv.status === 'paid' && diffDays(addDays(inv.issueDate, inv.customer.paymentTermDays), today) >= minDaysOverdue,
    );
    if (found) {
      found.status = 'open';
      found.paidAt = null;
    }
    return found;
  };
  const a = pickOverdue(5);
  if (a) a.dunningLevel = 0;
  const b = pickOverdue(30);
  if (b) {
    b.dunningLevel = 1;
    b.lastRemindedAt = addDays(today, -20);
    reminded.push(b);
  }
  const c = pickOverdue(12);
  if (c) {
    c.dunningLevel = 1;
    c.lastRemindedAt = addDays(today, -5);
    reminded.push(c);
  }

  const katrinUserId = adminUser.id;
  for (const inv of invoices) {
    await insertInvoice(client, {
      customerId: custId.get(inv.customer.key)!,
      vehicleId: inv.vehicle?.id ?? null,
      mileage: inv.vehicle ? Math.max(0, Math.round((inv.vehicle.mileage - inv.vehicle.kmPerDay * diffDays(inv.issueDate, today)) / 10) * 10) : null,
      issueDate: inv.issueDate,
      dueDate: addDays(inv.issueDate, inv.customer.paymentTermDays),
      vatRate: 19,
      items: inv.items,
      createdByUserId: katrinUserId,
      number: inv.number,
      status: inv.status,
      paidAt: inv.paidAt ?? null,
      dunningLevel: inv.dunningLevel ?? 0,
      lastRemindedAt: inv.lastRemindedAt ?? null,
      createdAt: `${inv.issueDate}T09:${String(rng.int(10, 59)).padStart(2, '0')}:00+01:00`,
    });
  }
  await client.query(`SELECT setval('invoice_number_seq', (SELECT max(number) FROM invoices))`);

  // ---- Notizen
  const noteAt = (iso: string) => `${iso}T${String(rng.int(8, 16)).padStart(2, '0')}:${String(rng.int(0, 59)).padStart(2, '0')}:00+01:00`;
  const fillText = (text: string, date: string) => text.replace('{datum}', formatDate(addDays(date, rng.int(3, 14))));
  for (const c of CUSTOMERS) {
    if (c.status === 'lead') continue;
    const count = c.status === 'active' ? rng.int(2, 6) : rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const created = custCreated.get(c.key)!;
      const oldest = c.status === 'active' ? addDays(today, -170) : addDays(today, -500);
      const newest = c.status === 'active' ? addDays(today, -1) : addDays(today, -200);
      const from = created > oldest ? created : oldest;
      const date = randomWeekday(rng, from, newest);
      if (!date) continue;
      const kind = rng.weighted([['call', 4], ['email', 3], ['meeting', 2], ['note', 2]] as const);
      const author = rng.pick(NOTE_AUTHORS);
      await insertNote(client, {
        customerId: custId.get(c.key)!,
        kind,
        text: fillText(rng.pick(NOTE_TEXTS[kind]), date),
        authorUserId: author === 'lindner' ? katrinUserId : null,
        authorName: empName.get(author)!,
        createdAt: noteAt(date),
      });
    }
  }
  const leadNotes: [string, number, 'call' | 'email' | 'meeting' | 'note', string, string][] = [
    ['hartl', 24, 'email', 'Anfrage über das Kontaktformular: Wartungsvertrag für vier Lieferwagen.', 'schmid'],
    ['hartl', 21, 'meeting', 'Erstgespräch vor Ort: vier Lieferwagen (Sprinter/Crafter), Angebot Flottenvertrag erbeten.', 'weber'],
    ['fahrschule', 5, 'call', 'Interesse an Wartung der sechs Fahrschulwagen inkl. Reifenservice, Besichtigung vereinbart.', 'gruber'],
    ['wimmer', 10, 'meeting', 'Beratung Golf R: Softwareoptimierung Stage 1 und Abgasanlage, Prüfstandstermin angefragt.', 'klein'],
    ['wimmer', 3, 'call', `Angebot Stage 1 + Abgasanlage besprochen, Rückruf KW ${isoWeek(addDays(today, 7))}.`, 'klein'],
    ['schreiner', 30, 'call', 'Kostenvoranschlag für Parkschaden hinten links angefragt, Fotos folgen.', 'gruber'],
    ['ott', 9, 'email', 'Angebot für Bestandsaufnahme und Gutachten zum H-Kennzeichen versendet.', 'weber'],
    ['fuchs', 1, 'call', 'Erstkontakt: Frage nach Räderwechsel und Einlagerung für ein Tesla Model 3.', 'schmid'],
    ['carsharing', 17, 'meeting', 'Besichtigung: 12 Fahrzeuge, Interesse an festen Servicefenstern nachts.', 'gruber'],
  ];
  for (const [key, daysAgo, kind, text, author] of leadNotes) {
    await insertNote(client, {
      customerId: custId.get(key)!,
      kind,
      text,
      authorUserId: null,
      authorName: empName.get(author)!,
      createdAt: noteAt(addDays(today, -daysAgo)),
    });
  }
  for (const inv of reminded) {
    const gross = totalsFor(inv.items, 19).gross;
    await insertNote(client, {
      customerId: custId.get(inv.customer.key)!,
      kind: 'system',
      text: `Mahnung Stufe 1 zu Rechnung #${inv.number} versendet (${(gross / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}).`,
      authorUserId: katrinUserId,
      authorName: 'Katrin Lindner',
      createdAt: noteAt(inv.lastRemindedAt!),
    });
  }

  // ---- Ausgaben
  const revenueByMonth = new Map<string, number>();
  for (const inv of invoices) {
    const m = monthKey(inv.issueDate);
    revenueByMonth.set(m, (revenueByMonth.get(m) ?? 0) + totalsFor(inv.items, 19).net);
  }
  const payrollPerMonth = (month: string) =>
    Math.round(
      DEMO_EMPLOYEES.reduce((sum, e) => {
        const days = workdaysBetween(monthStart(month), monthEnd(month));
        return sum + (e.hourlyRateCents * e.weeklyHours * days) / 5;
      }, 0),
    );
  for (const month of months) {
    const start = monthStart(month);
    const end = month === currentMonth ? today : monthEnd(month);
    const add = async (day: number, supplier: string, category: Parameters<typeof insertExpense>[1]['category'], description: string, netCents: number, vatRate: 0 | 7 | 19) => {
      const date = weekdayOnOrBefore(`${month}-${String(day).padStart(2, '0')}`);
      if (date > end || date < start) return;
      const recent = diffDays(date, today) <= 10;
      await insertExpense(client, { date, supplier, category, description, netCents, vatRate, paid: !(recent && rng.chance(0.5)) }, katrinUserId);
    };
    await add(1, 'Autoleasing Süd GmbH', 'vehicles', 'Leasing Ersatzwagen und Werkstattwagen', 295000, 19);
    await add(2, 'Versicherungsbüro Haller', 'insurance', 'Kfz-Versicherung Ersatzwagen und Kundenfahrzeuge (Werkstattrisiko)', 98000, 0);
    if (['01', '04', '07', '10'].includes(month.slice(5))) await add(2, 'Versicherungsbüro Haller', 'insurance', 'Betriebshaftpflicht (Quartal)', 240000, 0);
    await add(3, 'Immobilien Feldmeier GbR', 'rent', 'Miete Werkstatthalle und Showroom Gewerbering 14', 420000, 19);
    await add(5, 'Softwarehaus Krämer', 'office', 'Lizenzen Branchensoftware und Office', 24900, 19);
    await add(12, 'Netzwerk Ostbayern GmbH', 'office', 'Telefon und Internet', 18900, 19);
    await add(15, 'Energie Oberpfalz eG', 'rent', 'Strom und Wasser Betriebsgebäude', rng.amount(68000, 89000, 100), 19);
    await add(26, 'Tankkarte Ostbayern', 'vehicles', 'Kraftstoff Ersatzwagen und Abschleppwagen', rng.amount(90000, 140000, 100), 19);
    await add(28, 'Lohnabrechnung', 'payroll', `Löhne und Gehälter ${month.slice(5)}/${month.slice(0, 4)}`, payrollPerMonth(month), 0);
    if (rng.chance(0.5)) await add(rng.int(6, 25), 'Werkzeughandel Ostbayern', 'tools', rng.pick(['Diagnosesoftware Update', 'Wartung Hebebühnen', 'Drehmomentschlüssel-Satz', 'Kalibrierung Leistungsprüfstand']), rng.amount(30000, 250000, 100), 19);
    if (rng.chance(0.8)) await add(rng.int(6, 25), 'Entsorgung Mayer GmbH', 'other', 'Entsorgung Altöl, Altreifen und Altteile', rng.amount(28000, 65000, 100), 19);
    const materialTarget = (revenueByMonth.get(month) ?? 0) * (0.2 + rng.next() * 0.07);
    const purchases = month === currentMonth ? Math.max(1, Math.round(rng.int(8, 12) * (workdaysBetween(start, end) / Math.max(1, workdaysBetween(start, monthEnd(month)))))) : rng.int(8, 12);
    for (let i = 0; i < purchases; i++) {
      const date = randomWeekday(rng, start, end);
      if (!date) continue;
      const share = materialTarget / purchases;
      const netCents = Math.max(5000, Math.round((share * (0.6 + rng.next() * 0.8)) / 100) * 100);
      const recent = diffDays(date, today) <= 10;
      await insertExpense(
        client,
        { date, supplier: rng.pick(MATERIAL_SUPPLIERS), category: 'material', description: rng.pick(MATERIAL_DESCRIPTIONS), netCents, vatRate: 19, paid: !(recent && rng.chance(0.5)) },
        katrinUserId,
      );
    }
  }

  // ---- Abwesenheiten
  type Block = { key: string; kind: AbsenceKind; from: string; to: string };
  const blocks: Block[] = [];
  const free = (key: string, from: string, to: string) => !blocks.some((x) => x.key === key && rangesOverlap(x.from, x.to, from, to));
  const addAbsence = async (
    key: string,
    kind: AbsenceKind,
    from: string,
    to: string,
    status: 'requested' | 'approved' | 'rejected',
    opts: { comment?: string; decisionNote?: string; decidedDaysAgo?: number; requestedDaysAgo?: number; seen?: boolean } = {},
  ) => {
    blocks.push({ key, kind, from, to });
    const requestedAt = addDays(opts.requestedDaysAgo !== undefined ? today : from, -(opts.requestedDaysAgo ?? 21));
    const decided = status !== 'requested';
    const decidedAt = decided ? (opts.decidedDaysAgo !== undefined ? addDays(today, -opts.decidedDaysAgo) : addDays(requestedAt, 2)) : undefined;
    await insertAbsence(client, {
      employeeId: empId.get(key)!,
      kind,
      fromDate: from,
      toDate: to,
      status,
      comment: opts.comment ?? '',
      decisionNote: opts.decisionNote ?? '',
      decided,
      decidedByUserId: decided ? katrinUserId : null,
      decidedByName: decided ? DECIDER : '',
      seenByRequester: opts.seen ?? true,
      createdByUserId: null,
      requestedAt: `${requestedAt}T10:00:00+01:00`,
      decidedAt: decidedAt ? `${decidedAt}T15:30:00+01:00` : undefined,
    });
  };

  // Heute: einer krank, zwei im Urlaub
  await addAbsence('wagner', 'sick', addDays(today, -1), addDays(today, 2), 'approved', { requestedDaysAgo: 1, decidedDaysAgo: 1 });
  await addAbsence('nowak', 'vacation', addDays(today, -3), addDays(today, 4), 'approved', { comment: 'Familienbesuch' });
  await addAbsence('schmid', 'vacation', addDays(today, -1), addDays(today, 3), 'approved');
  // Offene Anträge
  const in3w = weekStart(addDays(today, 21));
  await addAbsence('mustermann', 'vacation', in3w, addDays(in3w, 4), 'requested', { comment: 'Familienurlaub', requestedDaysAgo: 2 });
  const in6w = weekStart(addDays(today, 42));
  await addAbsence('hofer', 'vacation', in6w, addDays(in6w, 2), 'requested', { comment: 'Umzug', requestedDaysAgo: 4 });
  const in8w = weekStart(addDays(today, 56));
  await addAbsence('huber', 'vacation', in8w, addDays(in8w, 11), 'requested', { requestedDaysAgo: 1 });
  // Abgelehnt
  const in2w = weekStart(addDays(today, 14));
  await addAbsence('yilmaz', 'vacation', in2w, addDays(in2w, 4), 'rejected', {
    comment: 'Kurzurlaub',
    decisionNote: 'Großbaustelle Kreisklinik in dieser Woche – bitte eine Woche später beantragen.',
    requestedDaysAgo: 6,
    decidedDaysAgo: 4,
  });
  // Jonas: genehmigter Urlaub in 4 Wochen, Entscheidung noch nicht gesehen
  const in4w = weekStart(addDays(today, 28));
  await addAbsence('weber', 'vacation', in4w, addDays(in4w, 4), 'approved', { comment: 'Skiurlaub', requestedDaysAgo: 5, decidedDaysAgo: 1, seen: false });

  // Vergangene Urlaube (1–2 Blöcke je Person) und einzelne Krankheitstage
  for (const e of DEMO_EMPLOYEES) {
    const count = rng.int(1, 2);
    for (let i = 0; i < count; i++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const from = weekStart(addDays(today, -rng.int(25, 260)));
        const to = addDays(from, rng.chance(0.5) ? 4 : 11);
        if (to >= addDays(today, -2)) continue;
        if (!free(e.key, from, to)) continue;
        await addAbsence(e.key, 'vacation', from, to, 'approved', { comment: rng.pick(['', '', 'Sommerurlaub', 'Brückentage', 'Familienurlaub']) });
        break;
      }
    }
  }
  for (let i = 0; i < 7; i++) {
    const e = rng.pick(DEMO_EMPLOYEES);
    const from = randomWeekday(rng, addDays(today, -200), addDays(today, -10));
    if (!from) continue;
    const to = addDays(from, rng.int(0, 2));
    if (!free(e.key, from, to)) continue;
    await addAbsence(e.key, 'sick', from, to, 'approved', { requestedDaysAgo: diffDays(from, today) });
  }

  // ---- Monatsstunden (Soll/Ist)
  for (const e of DEMO_EMPLOYEES) {
    for (const month of months) {
      const start = monthStart(month);
      const end = month === currentMonth ? today : monthEnd(month);
      const fullDays = workdaysBetween(start, monthEnd(month));
      const days = workdaysBetween(start, end);
      const fraction = fullDays > 0 ? days / fullDays : 0;
      const target = Math.round(((e.weeklyHours * days) / 5) * 2) / 2;
      const spread = e.contractType === 'apprentice' ? [-4, 4] : e.department === 'management' ? [6, 24] : [-8, 15];
      const delta = Math.round(rng.int(spread[0] * 2, spread[1] * 2) * fraction) / 2;
      await upsertTimesheet(client, {
        employeeId: empId.get(e.key)!,
        month,
        targetHours: target,
        workedHours: Math.max(0, target + delta),
      });
    }
  }

  // ---- Manuelle Aufgaben
  for (const t of DEMO_TASKS) {
    await insertTask(client, { title: t.title, dueDate: t.dueInDays === null ? null : addDays(today, t.dueInDays), done: t.done });
  }
}
