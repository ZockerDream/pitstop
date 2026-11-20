// Domänentypen für Client und Server (TECHNICAL.md Abschnitt 11). Geld in Cent, Spielwährung $.
import type { Level, Rights } from './permissions';
import type { TuningConfig } from './tuning';

export interface Prefs {
  skin?: string;
  density?: 'bequem' | 'kompakt';
  nav?: 'breit' | 'schmal';
  text?: 'normal' | 'groß' | 'sehr groß';
  motion?: 'normal' | 'reduziert';
  start?: string;
  /** Kacheln der eigenen Arbeitsfläche im Cockpit (Reihenfolge = Anzeige); fehlt = Standard */
  widgets?: string[];
  /** Weitere, benannte Arbeitsflächen mit eigenen Widgets */
  boards?: Board[];
}

export interface Board {
  id: string;
  name: string;
  widgets: string[];
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  discord: string;
  isServerAdmin: boolean;
  active: boolean;
  mustChangePassword: boolean;
  /** Zwei-Faktor-Anmeldung aktiv */
  totpEnabled: boolean;
  /** Discord-Konto verknüpft (Anmeldung mit Discord möglich) */
  discordLinked: boolean;
  prefs: Prefs;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface CompanyRef {
  id: string;
  name: string;
  short: string;
  status: 'active' | 'paused';
}

export interface CompanyInfo {
  address?: string;
  phone?: string;
  hours?: string;
  discord?: string;
}

export interface MapBounds {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** Weitere Firmeneinstellungen (companies.extra). */
export interface CompanyExtra {
  /** Zahlungsziel in Tagen für neue Rechnungen */
  payDays?: number;
  footer?: string;
  locations?: { name: string; note: string }[];
  templates?: string[];
  trackdayPackages?: { name: string; priceCents: number; items: string[] }[];
  /** Preisliste, Rennen und Bestenliste über die öffentliche API zeigen */
  publicData?: boolean;
}

export interface Company extends CompanyRef {
  modules: string[];
  extra: CompanyExtra;
  lockWins: boolean;
  supportAccess: boolean;
  info: CompanyInfo;
  mapBounds: MapBounds;
  hasMap: boolean;
  createdAt: string;
}

export interface Member {
  userId: string;
  displayName: string;
  email: string;
  discord: string;
  rank: string;
  phone: string;
  locked: boolean;
  joinedAt: string;
  lastLoginAt: string | null;
  onDutySince: string | null;
  /** Spiel-ID für die Spielserver-Anbindung (z. B. license:… aus FiveM) */
  gameId: string;
}

export interface OrderPhoto {
  id: string;
  orderId: string;
  size: number;
  note: string;
  createdBy: string | null;
  createdAt: string;
}

export interface GameKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  description: string;
  isOwner: boolean;
  levels: Partial<Record<string, Level>>;
  own: Partial<Record<string, boolean>>;
  specials: Partial<Record<string, boolean | number>>;
  members: string[];
  position: number;
}

export interface PermissionException {
  id: string;
  userId: string;
  area: string;
  level: Level;
  until: string | null;
  reason: string;
}

export type CustomerKind = 'privat' | 'firma' | 'fraktion' | 'racing';
export interface Customer {
  id: string;
  number: number;
  name: string;
  kind: CustomerKind;
  phone: string;
  note: string;
  discount: number;
  blocked: boolean;
  createdAt: string;
}

export interface Vehicle {
  id: string;
  customerId: string | null;
  plate: string;
  model: string;
  note: string;
  /** Kennzeichen-Abgleich: als gestohlen gemeldet */
  stolen: boolean;
  createdAt: string;
}

export type OrderKind = 'werkstatt' | 'tuning' | 'karosserie' | 'racing';
export type OrderStatus = 'neu' | 'arbeit' | 'wartet' | 'fertig' | 'abgeholt';
export interface Order {
  id: string;
  number: number;
  title: string;
  kind: OrderKind;
  status: OrderStatus;
  priority: boolean;
  customerId: string | null;
  vehicleId: string | null;
  assigneeId: string | null;
  amountCents: number;
  progress: number;
  note: string;
  /** Fahrzeugannahme: km, Tank, Schäden, Checkliste */
  intake: Intake;
  serviceId: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Intake {
  km?: number;
  fuel?: string;
  damage?: string[];
  checks?: string[];
  wishes?: string;
}

export type CalloutStatus = 'offen' | 'unterwegs' | 'vorort' | 'erledigt';
export interface Callout {
  id: string;
  number: number;
  location: string;
  x: number | null;
  y: number | null;
  requester: string;
  vehicle: string;
  status: CalloutStatus;
  driverId: string | null;
  truck: string;
  feeCents: number;
  createdBy: string | null;
  createdAt: string;
  doneAt: string | null;
}

export type BillStatus = 'offen' | 'bezahlt' | 'storniert';
export interface Bill {
  id: string;
  number: number;
  customerId: string | null;
  orderId: string | null;
  calloutId: string | null;
  title: string;
  amountCents: number;
  status: BillStatus;
  kind: 'rechnung' | 'angebot';
  reminders: number;
  remindedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export type Account = 'firma' | 'kasse' | 'trinkgeld' | 'rennteam';
export const ACCOUNTS: [Account, string][] = [['firma', 'Firmenkonto'], ['kasse', 'Kasse'], ['trinkgeld', 'Trinkgeldkasse'], ['rennteam', 'Rennteam']];
export interface Transaction {
  id: string;
  account: Account;
  amountCents: number;
  text: string;
  category: string;
  billId: string | null;
  bookedAt: string;
  createdBy: string | null;
  createdAt: string;
}

export interface DutySession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  note: string;
}

export interface Part {
  id: string;
  sku: string;
  name: string;
  unit: string;
  qty: number;
  minQty: number;
  priceCents: number;
  location: string;
  note: string;
  createdAt: string;
}

export interface Shift {
  id: string;
  userId: string;
  startsAt: string;
  endsAt: string;
  role: string;
  note: string;
  createdBy: string | null;
}

/** Lohnangaben eines Mitglieds (nur mit Recht „Lohn & Provision“). */
export interface Wage {
  userId: string;
  wageCents: number;
  commissionPct: number;
  fixedCents: number;
}

export interface Payslip {
  id: string;
  userId: string;
  periodFrom: string;
  periodTo: string;
  minutes: number;
  wageCents: number;
  commissionCents: number;
  fixedCents: number;
  bonusCents: number;
  totalCents: number;
  status: 'offen' | 'bezahlt';
  paidAt: string | null;
  createdAt: string;
}

export interface Lesson {
  title: string;
  text: string;
}
export interface Question {
  q: string;
  /** choice = Auswahl (Standard), text = Freitext, den ein Trainer bewertet */
  kind?: 'choice' | 'text';
  options: string[];
  /** Nur für Leute, die Kurse bearbeiten dürfen; sonst -1. */
  correct: number;
}
export interface Course {
  id: string;
  name: string;
  category: string;
  lessons: Lesson[];
  questions: Question[];
  passPct: number;
  validMonths: number;
  practical: boolean;
  requiredGroups: string[];
  trainerId: string | null;
}
export interface CourseProgress {
  courseId: string;
  userId: string;
  lessonsDone: number;
  score: number | null;
  practicalOk: boolean;
  passedAt: string | null;
  /** Ablaufdatum des Nachweises (passedAt + Gültigkeit) oder null = unbegrenzt */
  expiresAt: string | null;
  /** Freitext-Antworten (Index → Text); für Bearbeiter und die Person selbst */
  answers: Record<string, string>;
  /** Bewertung der Freitext-Antworten (Index → richtig) */
  review: Record<string, boolean>;
}

export interface DynoRun {
  id: string;
  vehicleId: string | null;
  label: string;
  hp: number;
  torque: number;
  note: string;
  createdAt: string;
}

export type RaceKind = 'rennen' | 'teamstart' | 'trackday' | 'meet';
export interface RaceEvent {
  id: string;
  name: string;
  kind: RaceKind;
  startsAt: string;
  track: string;
  laps: number;
  feeCents: number;
  prizeCents: number;
  maxEntries: number;
  status: 'planung' | 'offen' | 'fertig' | 'abgesagt';
  note: string;
}
export interface RaceEntry {
  id: string;
  eventId: string;
  driver: string;
  car: string;
  startNo: string;
  customerId: string | null;
  team: boolean;
  paid: boolean;
  lapMs: number | null;
  position: number | null;
  carId: string | null;
}

export interface PartOrder {
  id: string;
  partId: string;
  qty: number;
  supplier: string;
  costCents: number;
  expected: string | null;
  status: 'bestellt' | 'geliefert' | 'storniert';
  createdAt: string;
  deliveredAt: string | null;
}
/** Verbrauch je Teil in den letzten 30 Tagen (Summe der Entnahmen). */
export interface PartUse {
  partId: string;
  used: number;
}

export interface Bay {
  id: string;
  name: string;
  kind: 'hebebuehne' | 'lack' | 'pruefstand' | 'wasch' | 'sonstig';
  position: number;
}
export interface BayBooking {
  id: string;
  bayId: string;
  orderId: string | null;
  title: string;
  startsAt: string;
  endsAt: string;
  createdBy: string | null;
}

export interface Tool {
  id: string;
  name: string;
  info: string;
  location: string;
  status: 'frei' | 'ausgegeben' | 'wartung';
  holderId: string | null;
  since: string | null;
  checkDue: string | null;
  note: string;
}

export interface FleetCar {
  id: string;
  name: string;
  model: string;
  plate: string;
  km: number;
  fuel: number;
  status: 'frei' | 'einsatz' | 'werkstatt';
  driverId: string | null;
  serviceDue: string | null;
  note: string;
}
export interface FleetLog {
  id: string;
  fleetId: string;
  userId: string | null;
  action: 'ausgabe' | 'rueckgabe' | 'tanken' | 'schaden' | 'service';
  km: number | null;
  fuel: number | null;
  costCents: number;
  note: string;
  createdAt: string;
}

export interface RaceCar {
  id: string;
  number: string;
  car: string;
  driverId: string | null;
  status: 'bereit' | 'wartung' | 'defekt';
  km: number;
  wear: Record<string, number>;
  budgetCents: number;
  note: string;
}
export interface ChampRow {
  id: string;
  season: number;
  team: string;
  points: number;
  own: boolean;
}
export interface Setup {
  id: string;
  carId: string;
  track: string;
  vals: Record<string, string>;
  note: string;
  updatedAt: string;
}
export interface Lap {
  id: string;
  carId: string | null;
  driver: string;
  track: string;
  s1: number;
  s2: number;
  s3: number;
  session: string;
  createdAt: string;
}
export interface TrackdayBooking {
  id: string;
  eventId: string | null;
  customerId: string | null;
  vehicleId: string | null;
  package: string;
  priceCents: number;
  transport: boolean;
  status: 'angefragt' | 'bestaetigt' | 'abgesagt';
  billId: string | null;
}

export interface Contract {
  id: string;
  customerId: string;
  title: string;
  workshopPct: number;
  tuningPct: number;
  rules: string;
  billing: string;
  validUntil: string | null;
  status: 'aktiv' | 'pruefen' | 'beendet';
}
export interface Message {
  id: string;
  customerId: string;
  dir: 'in' | 'out';
  text: string;
  userId: string | null;
  read: boolean;
  createdAt: string;
}

export interface Rank {
  id: string;
  name: string;
  position: number;
  wageCents: number;
  commissionPct: number;
  fixedCents: number;
  groups: string[];
}
export interface Application {
  id: string;
  name: string;
  role: string;
  contact: string;
  text: string;
  rating: number;
  status: 'neu' | 'gespraech' | 'eingestellt' | 'abgesagt';
  interviewAt: string | null;
  note: string;
  createdAt: string;
}
export interface Absence {
  id: string;
  userId: string;
  dateFrom: string;
  dateTo: string;
  kind: 'urlaub' | 'krank' | 'schule' | 'pruefung' | 'sonstiges';
  status: 'beantragt' | 'genehmigt' | 'abgelehnt';
  note: string;
  decidedBy: string | null;
}
export interface DutyCorrection {
  id: string;
  userId: string;
  dutyId: string | null;
  startedAt: string;
  endedAt: string;
  reason: string;
  status: 'beantragt' | 'genehmigt' | 'abgelehnt';
  decidedBy: string | null;
}

export interface CourseSession {
  id: string;
  courseId: string;
  startsAt: string;
  kind: 'praxis' | 'einfuehrung' | 'test';
  trainerId: string | null;
  participants: string[];
  note: string;
}
export interface License {
  id: string;
  name: string;
  holderId: string | null;
  validUntil: string | null;
  note: string;
}

export interface CashClosing {
  id: string;
  expectedCents: number;
  countedCents: number;
  note: string;
  createdBy: string | null;
  createdAt: string;
}
export interface StandingOrder {
  id: string;
  text: string;
  amountCents: number;
  account: Account;
  category: string;
  every: 'woche' | 'monat' | 'jahr';
  nextDate: string;
  active: boolean;
}
export interface Goal {
  id: string;
  name: string;
  targetCents: number;
  account: Account;
  deadline: string | null;
}

export interface Service {
  id: string;
  name: string;
  area: string;
  priceCents: number;
  courseId: string | null;
  note: string;
}
export interface RuleDoc {
  id: string;
  title: string;
  body: string;
  version: number;
  updatedAt: string;
  /** Wer die aktuelle Version bestätigt hat */
  ackedBy: string[];
}
export interface Poll {
  question: string;
  options: string[];
  endsAt: string | null;
}
export interface Post {
  id: string;
  authorId: string | null;
  title: string;
  body: string;
  pinned: boolean;
  poll: Poll | null;
  createdAt: string;
  reads: number;
  readByMe: boolean;
  votes: number[];
  myVote: number | null;
}
export interface Webhook {
  id: string;
  name: string;
  url: string;
  kind: 'discord' | 'json';
  events: string[];
  active: boolean;
  lastStatus: string;
  lastAt: string | null;
  fails: number;
}
/** Eintrag im Live-Feed (aus dem Protokoll, nach Rechten gefiltert). */
export interface FeedItem {
  id: number;
  userName: string;
  area: string;
  action: string;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  userId: string | null;
  userName: string;
  area: string;
  action: string;
  createdAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  tone: 'info' | 'warn';
  authorName: string;
  createdAt: string;
}

/** Antwort von GET /api/me – wer bin ich, in welchen Firmen. */
export interface MeData {
  user: User;
  companies: CompanyRef[];
  demoMode: boolean;
  version: string;
}

/** Antwort von GET /api/c/:companyId/bootstrap – alles, was die Person in dieser Firma sehen darf. */
export interface CompanyData {
  company: Company;
  rights: Rights;
  members: Member[];
  groups: Group[];
  exceptions: PermissionException[];
  customers: Customer[];
  vehicles: Vehicle[];
  orders: Order[];
  callouts: Callout[];
  bills: Bill[];
  transactions: Transaction[];
  duty: DutySession[];
  parts: Part[];
  shifts: Shift[];
  wages: Wage[];
  payslips: Payslip[];
  courses: Course[];
  progress: CourseProgress[];
  dyno: DynoRun[];
  events: RaceEvent[];
  entries: RaceEntry[];
  tuning: TuningConfig;
  /** Gruppen-IDs der angemeldeten Person (für Pflichtkurse) */
  myGroups: string[];
  partOrders: PartOrder[];
  partUse: PartUse[];
  bays: Bay[];
  bookings: BayBooking[];
  tools: Tool[];
  fleet: FleetCar[];
  fleetLog: FleetLog[];
  raceCars: RaceCar[];
  championship: ChampRow[];
  setups: Setup[];
  laps: Lap[];
  trackdays: TrackdayBooking[];
  contracts: Contract[];
  messages: Message[];
  ranks: Rank[];
  applications: Application[];
  absences: Absence[];
  corrections: DutyCorrection[];
  sessions: CourseSession[];
  licenses: License[];
  closings: CashClosing[];
  standing: StandingOrder[];
  goals: Goal[];
  services: Service[];
  rules: RuleDoc[];
  posts: Post[];
  webhooks: Webhook[];
  photos: OrderPhoto[];
  gameKeys: GameKey[];
}

export interface ServerSettings {
  /** Nur Server-Admins können sich anmelden */
  maintenance: boolean;
  maintenanceText: string;
  /** Module, die neue Firmen eingeschaltet bekommen */
  defaultModules: string[];
  /** Automatische Sicherung: Stunde (0–23) oder null = aus */
  backupHour: number | null;
  /** Wie viele automatische Sicherungen behalten werden */
  backupKeep: number;
}

export interface ApiKey {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  revoked: boolean;
  createdAt: string;
}

export interface ServerAccount {
  id: string;
  email: string;
  displayName: string;
  discord: string;
  isServerAdmin: boolean;
  active: boolean;
  totpEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  companies: string[];
}

export interface ServerCompany extends CompanyRef {
  ownerName: string;
  members: number;
  modules: string[];
  supportAccess: boolean;
  createdAt: string;
}

export interface BackupFile {
  name: string;
  size: number;
  createdAt: string;
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
  /** Anmeldung mit Discord ist eingerichtet */
  discordLogin: boolean;
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
