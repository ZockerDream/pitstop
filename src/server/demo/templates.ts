// Stammdaten des erfundenen Demo-Betriebs „Lindner Motorsport GmbH“ – Kfz-Werkstatt, Tuning & Performance
// (CONCEPT.md Abschnitt 2 und 11). Alle Firmen, Personen, Fahrzeuge und Kontaktdaten sind erfunden; Domains enden auf .example.
import type { CompanySettings, ContractType, CustomerKind, CustomerStatus, Department, FuelType, Unit } from '../../shared/types';

export const DEMO_DOMAIN = 'lindner-motorsport.example';

export const DEMO_COMPANY: CompanySettings = {
  name: 'Lindner Motorsport GmbH',
  street: 'Gewerbering 14',
  zip: '93055',
  city: 'Regensburg',
  phone: '0941 123456-0',
  email: `service@${DEMO_DOMAIN}`,
  website: `www.${DEMO_DOMAIN}`,
  vatId: 'DE123456789',
  taxNumber: '244/123/45678',
  bankName: 'Volksbank Beispielregion eG',
  iban: 'DE89 3704 0044 0532 0130 00',
  bic: 'GENODEF1EXA',
  paymentTermDays: 14,
  invoiceFooter: 'Kfz-Meisterbetrieb · Geschäftsführerin: Katrin Lindner · Amtsgericht Regensburg HRB 12345',
};

export interface DemoEmployee {
  key: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: Department;
  hourlyRateCents: number;
  contractType: ContractType;
  weeklyHours: number;
  /** Festes Eintrittsdatum oder relativ: Tage vor dem Seed-Tag. */
  entryDate?: string;
  entryDaysAgo?: number;
  probationMonths?: number;
  fixedTermYears?: number;
  vacationDaysPerYear: number;
  carryOverDays: number;
  manager?: string;
  phoneExt: string;
}

export const DEMO_EMPLOYEES: DemoEmployee[] = [
  { key: 'lindner', firstName: 'Katrin', lastName: 'Lindner', jobTitle: 'Geschäftsführerin, Kfz-Meisterin', department: 'management', hourlyRateCents: 4800, contractType: 'full_time', weeklyHours: 40, entryDate: '2009-04-01', vacationDaysPerYear: 30, carryOverDays: 4, phoneExt: '10' },
  { key: 'huber', firstName: 'Sabine', lastName: 'Huber', jobTitle: 'Buchhaltung', department: 'office', hourlyRateCents: 2600, contractType: 'part_time', weeklyHours: 30, entryDate: '2012-09-01', vacationDaysPerYear: 30, carryOverDays: 2, manager: 'lindner', phoneExt: '12' },
  { key: 'wolf', firstName: 'Petra', lastName: 'Wolf', jobTitle: 'Büro & Terminplanung', department: 'office', hourlyRateCents: 1900, contractType: 'part_time', weeklyHours: 20, entryDate: '2021-06-15', vacationDaysPerYear: 30, carryOverDays: 1, manager: 'lindner', phoneExt: '13' },
  { key: 'gruber', firstName: 'Tobias', lastName: 'Gruber', jobTitle: 'Serviceleiter', department: 'service', hourlyRateCents: 3200, contractType: 'full_time', weeklyHours: 40, entryDate: '2011-05-01', vacationDaysPerYear: 30, carryOverDays: 3, manager: 'lindner', phoneExt: '20' },
  { key: 'schmid', firstName: 'Laura', lastName: 'Schmid', jobTitle: 'Serviceberaterin', department: 'service', hourlyRateCents: 2300, contractType: 'full_time', weeklyHours: 40, entryDate: '2018-03-01', vacationDaysPerYear: 30, carryOverDays: 0, manager: 'gruber', phoneExt: '21' },
  { key: 'kaya', firstName: 'Mehmet', lastName: 'Kaya', jobTitle: 'Serviceberater', department: 'service', hourlyRateCents: 2300, contractType: 'full_time', weeklyHours: 40, entryDaysAgo: 130, probationMonths: 6, vacationDaysPerYear: 30, carryOverDays: 0, manager: 'gruber', phoneExt: '22' },
  { key: 'bauer', firstName: 'Stefan', lastName: 'Bauer', jobTitle: 'Werkstattmeister', department: 'workshop', hourlyRateCents: 3400, contractType: 'full_time', weeklyHours: 40, entryDate: '2010-01-15', vacationDaysPerYear: 30, carryOverDays: 5, manager: 'lindner', phoneExt: '30' },
  { key: 'mustermann', firstName: 'Max', lastName: 'Mustermann', jobTitle: 'Kfz-Mechatroniker', department: 'workshop', hourlyRateCents: 2700, contractType: 'full_time', weeklyHours: 40, entryDate: '2016-02-01', vacationDaysPerYear: 30, carryOverDays: 3, manager: 'bauer', phoneExt: '31' },
  { key: 'weber', firstName: 'Jonas', lastName: 'Weber', jobTitle: 'Kfz-Mechatroniker', department: 'workshop', hourlyRateCents: 2600, contractType: 'full_time', weeklyHours: 40, entryDate: '2019-08-01', vacationDaysPerYear: 30, carryOverDays: 1, manager: 'bauer', phoneExt: '32' },
  { key: 'yilmaz', firstName: 'Ali', lastName: 'Yılmaz', jobTitle: 'Kfz-Mechatroniker, Diagnose & Elektrik', department: 'workshop', hourlyRateCents: 2800, contractType: 'full_time', weeklyHours: 40, entryDate: '2015-04-01', vacationDaysPerYear: 30, carryOverDays: 2, manager: 'bauer', phoneExt: '33' },
  { key: 'nowak', firstName: 'Piotr', lastName: 'Nowak', jobTitle: 'Kfz-Mechatroniker', department: 'workshop', hourlyRateCents: 2500, contractType: 'full_time', weeklyHours: 40, entryDate: '2017-10-01', vacationDaysPerYear: 30, carryOverDays: 0, manager: 'bauer', phoneExt: '34' },
  { key: 'wagner', firstName: 'Markus', lastName: 'Wagner', jobTitle: 'Karosseriebauer & Lack', department: 'workshop', hourlyRateCents: 2500, contractType: 'full_time', weeklyHours: 40, entryDate: '2013-07-01', vacationDaysPerYear: 30, carryOverDays: 2, manager: 'bauer', phoneExt: '35' },
  { key: 'hofer', firstName: 'Florian', lastName: 'Hofer', jobTitle: 'Reifen- & Schnellservice', department: 'workshop', hourlyRateCents: 2100, contractType: 'full_time', weeklyHours: 40, entryDate: '2020-09-01', vacationDaysPerYear: 30, carryOverDays: 0, manager: 'bauer', phoneExt: '36' },
  { key: 'brandl', firstName: 'Daniel', lastName: 'Brandl', jobTitle: 'Werkstatthelfer', department: 'workshop', hourlyRateCents: 1800, contractType: 'full_time', weeklyHours: 40, entryDaysAgo: 300, fixedTermYears: 2, vacationDaysPerYear: 28, carryOverDays: 0, manager: 'bauer', phoneExt: '37' },
  { key: 'fischer', firstName: 'Leon', lastName: 'Fischer', jobTitle: 'Auszubildender Kfz-Mechatroniker (2. Lehrjahr)', department: 'workshop', hourlyRateCents: 900, contractType: 'apprentice', weeklyHours: 39, vacationDaysPerYear: 30, carryOverDays: 0, manager: 'bauer', phoneExt: '38' },
  { key: 'klein', firstName: 'Andreas', lastName: 'Klein', jobTitle: 'Leiter Tuning & Performance, Kfz-Meister', department: 'tuning', hourlyRateCents: 3600, contractType: 'full_time', weeklyHours: 40, entryDate: '2012-02-01', vacationDaysPerYear: 30, carryOverDays: 2, manager: 'lindner', phoneExt: '40' },
  { key: 'becker', firstName: 'Julia', lastName: 'Becker', jobTitle: 'Fahrzeugtechnikerin Software & Prüfstand', department: 'tuning', hourlyRateCents: 3100, contractType: 'full_time', weeklyHours: 40, entryDate: '2014-11-01', vacationDaysPerYear: 30, carryOverDays: 1, manager: 'klein', phoneExt: '41' },
  { key: 'koch', firstName: 'Dieter', lastName: 'Koch', jobTitle: 'Teiledienst & Lager', department: 'parts', hourlyRateCents: 2100, contractType: 'full_time', weeklyHours: 40, entryDate: '2008-06-01', vacationDaysPerYear: 30, carryOverDays: 0, manager: 'bauer', phoneExt: '50' },
];

export interface DemoContact {
  name: string;
  position: string;
  phone: string;
  email: string;
  primary?: boolean;
}

/** Fahrzeug im Demo-Seed: [Marke, Modell, Variante, Kraftstoff, kW, Baujahr]. Kennzeichen und FIN werden erzeugt. */
export type DemoVehicle = [make: string, model: string, variant: string, fuel: FuelType, kw: number, year: number, notes?: string];

export interface DemoCustomer {
  key: string;
  name: string;
  kind: CustomerKind;
  status: CustomerStatus;
  street: string;
  zip: string;
  city: string;
  phone: string;
  email: string;
  paymentTermDays: number;
  owner?: string;
  tags?: string[];
  createdDaysAgo: number;
  /** Kennzeichen-Kürzel des Zulassungsbezirks */
  district?: string;
  contacts: DemoContact[];
  vehicles: DemoVehicle[];
}

export const DEMO_CUSTOMERS: DemoCustomer[] = [
  // ---- Aktiv: Fuhrparks
  { key: 'sommer', name: 'Mietwagen Sommer & Partner GmbH', kind: 'fleet', status: 'active', street: 'Prüfeninger Straße 41', zip: '93049', city: 'Regensburg', phone: '0941 297310', email: 'info@mietwagen-sommer.example', paymentTermDays: 30, owner: 'gruber', tags: ['Flottenvertrag'], createdDaysAgo: 2100,
    contacts: [
      { name: 'Claudia Sommer', position: 'Geschäftsführerin', phone: '0941 297310', email: 'c.sommer@mietwagen-sommer.example', primary: true },
      { name: 'Matthias Brunner', position: 'Fuhrparkleiter', phone: '0941 297314', email: 'm.brunner@mietwagen-sommer.example' },
    ],
    vehicles: [['VW', 'Golf', '1.5 eTSI Life', 'petrol', 85, 2023], ['Skoda', 'Octavia Combi', '2.0 TDI Style', 'diesel', 110, 2022], ['VW', 'Transporter T6.1', 'Kombi 2.0 TDI', 'diesel', 110, 2021], ['Opel', 'Corsa', '1.2 Edition', 'petrol', 74, 2023], ['Ford', 'Transit Custom', '320 L1 2.0 EcoBlue', 'diesel', 96, 2022]] },
  { key: 'donautal', name: 'Pflegedienst Donautal GmbH', kind: 'fleet', status: 'active', street: 'Am Protzenweiher 7', zip: '93059', city: 'Regensburg', phone: '0941 840220', email: 'verwaltung@pflegedienst-donautal.example', paymentTermDays: 21, owner: 'gruber', tags: ['Flottenvertrag'], createdDaysAgo: 1500,
    contacts: [
      { name: 'Sandra Vogl', position: 'Fuhrparkverantwortliche', phone: '0941 840225', email: 's.vogl@pflegedienst-donautal.example', primary: true },
      { name: 'Herbert Lechner', position: 'Hausmeister', phone: '0171 5550142', email: '' },
    ],
    vehicles: [['VW', 'up!', 'e-up! Edition', 'electric', 61, 2022], ['VW', 'up!', 'e-up! Edition', 'electric', 61, 2022], ['Renault', 'Clio', 'TCe 90 Evolution', 'petrol', 67, 2021], ['Renault', 'Clio', 'TCe 90 Evolution', 'petrol', 67, 2021]] },
  { key: 'kastner', name: 'Taxi Kastner', kind: 'fleet', status: 'active', street: 'Bahnhofstraße 12', zip: '93073', city: 'Neutraubling', phone: '09401 52870', email: 'kastner@taxi-kastner.example', paymentTermDays: 14, owner: 'schmid', createdDaysAgo: 900,
    contacts: [{ name: 'Wolfgang Kastner', position: 'Inhaber', phone: '09401 52870', email: 'kastner@taxi-kastner.example', primary: true }],
    vehicles: [['Mercedes-Benz', 'E-Klasse', 'E 220 d T-Modell', 'diesel', 143, 2021], ['Toyota', 'Corolla Touring Sports', '1.8 Hybrid', 'hybrid', 103, 2022], ['Mercedes-Benz', 'E-Klasse', 'E 300 de', 'hybrid', 225, 2023]] },
  { key: 'kurier', name: 'Kurierdienst Oberpfalz GmbH', kind: 'fleet', status: 'active', street: 'Friedenstraße 23', zip: '93053', city: 'Regensburg', phone: '0941 799100', email: 'fuhrpark@kurier-opf.example', paymentTermDays: 30, owner: 'gruber', tags: ['Flottenvertrag'], createdDaysAgo: 2600,
    contacts: [
      { name: 'Birgit Hammer', position: 'Fuhrparkmanagement', phone: '0941 799120', email: 'b.hammer@kurier-opf.example', primary: true },
      { name: 'Josef Riedl', position: 'Disposition', phone: '0941 799131', email: 'j.riedl@kurier-opf.example' },
      { name: 'Maria Kellner', position: 'Buchhaltung', phone: '0941 799140', email: 'buchhaltung@kurier-opf.example' },
    ],
    vehicles: [['Mercedes-Benz', 'Sprinter', '315 CDI Kasten', 'diesel', 110, 2021], ['Mercedes-Benz', 'Sprinter', '315 CDI Kasten', 'diesel', 110, 2021], ['Fiat', 'Ducato', '35 Maxi 2.2 Multijet', 'diesel', 103, 2020], ['Renault', 'Kangoo', 'E-Tech Electric', 'electric', 90, 2023]] },
  // ---- Aktiv: Gewerbe
  { key: 'post', name: 'Gasthof Zur Post, Inh. Georg Meier', kind: 'business', status: 'active', street: 'Maxstraße 5', zip: '93093', city: 'Donaustauf', phone: '09403 9530', email: 'info@gasthof-post.example', paymentTermDays: 14, owner: 'schmid', createdDaysAgo: 1300,
    contacts: [{ name: 'Georg Meier', position: 'Inhaber', phone: '09403 9530', email: 'info@gasthof-post.example', primary: true }],
    vehicles: [['VW', 'Caddy', 'Cargo 2.0 TDI', 'diesel', 75, 2019], ['Audi', 'A6 Avant', '40 TDI quattro', 'diesel', 150, 2020]] },
  { key: 'pfeiffer', name: 'Bauunternehmen Pfeiffer GmbH', kind: 'business', status: 'active', street: 'Industriestraße 31', zip: '93055', city: 'Regensburg', phone: '0941 46030', email: 'info@bau-pfeiffer.example', paymentTermDays: 14, owner: 'gruber', createdDaysAgo: 1100,
    contacts: [
      { name: 'Nicole Ertl', position: 'Fuhrpark & Einkauf', phone: '0941 460312', email: 'n.ertl@bau-pfeiffer.example', primary: true },
      { name: 'Thomas Pfeiffer', position: 'Geschäftsführer', phone: '0941 46030', email: 't.pfeiffer@bau-pfeiffer.example' },
    ],
    vehicles: [['Ford', 'Ranger', 'Wildtrak 2.0 EcoBlue', 'diesel', 151, 2022], ['Ford', 'Ranger', 'XLT 2.0 EcoBlue', 'diesel', 125, 2021], ['MAN', 'TGE', '3.180 Pritsche', 'diesel', 130, 2020]] },
  { key: 'weidenhof', name: 'Hotel Weidenhof GmbH', kind: 'business', status: 'active', street: 'Kumpfmühler Straße 18', zip: '93051', city: 'Regensburg', phone: '0941 381900', email: 'rezeption@hotel-weidenhof.example', paymentTermDays: 14, owner: 'schmid', createdDaysAgo: 800,
    contacts: [
      { name: 'Ralf Seitz', position: 'Haustechnik & Shuttle', phone: '0941 381977', email: 'technik@hotel-weidenhof.example', primary: true },
      { name: 'Andrea Baumann', position: 'Hoteldirektorin', phone: '0941 381901', email: 'a.baumann@hotel-weidenhof.example' },
    ],
    vehicles: [['Mercedes-Benz', 'V-Klasse', 'V 250 d Avantgarde', 'diesel', 140, 2022]] },
  { key: 'schoenberger', name: 'Zahnarztpraxis Dr. Schönberger', kind: 'business', status: 'active', street: 'Ostengasse 9', zip: '93047', city: 'Regensburg', phone: '0941 563412', email: 'praxis@dr-schoenberger.example', paymentTermDays: 14, owner: 'klein', tags: ['Sportwagen'], createdDaysAgo: 650,
    contacts: [{ name: 'Dr. Eva Schönberger', position: 'Praxisinhaberin', phone: '0941 563412', email: 'praxis@dr-schoenberger.example', primary: true }],
    vehicles: [['Porsche', 'Taycan', '4S', 'electric', 390, 2022], ['Porsche', 'Macan', 'GTS', 'petrol', 324, 2021]] },
  { key: 'dirnberger', name: 'Metzgerei Dirnberger OHG', kind: 'business', status: 'active', street: 'Hauptstraße 22', zip: '93080', city: 'Pentling', phone: '09405 2318', email: 'info@metzgerei-dirnberger.example', paymentTermDays: 14, owner: 'weber', createdDaysAgo: 1700,
    contacts: [{ name: 'Franz Dirnberger', position: 'Inhaber', phone: '09405 2318', email: 'info@metzgerei-dirnberger.example', primary: true }],
    vehicles: [['VW', 'Crafter', '35 Kühlkoffer 2.0 TDI', 'diesel', 103, 2020]] },
  { key: 'reiter', name: 'Reiter Racing GmbH', kind: 'business', status: 'active', street: 'Siemensstraße 8', zip: '93073', city: 'Neutraubling', phone: '09401 91700', email: 'team@reiter-racing.example', paymentTermDays: 30, owner: 'klein', tags: ['Tuning', 'Motorsport'], createdDaysAgo: 400,
    contacts: [
      { name: 'Michael Reiter', position: 'Teamchef', phone: '09401 91700', email: 'm.reiter@reiter-racing.example', primary: true },
      { name: 'Tanja Wild', position: 'Teammanagement', phone: '09401 917023', email: 't.wild@reiter-racing.example' },
    ],
    vehicles: [['BMW', 'M2', 'Competition (Trackday)', 'petrol', 302, 2020, 'Clubsport-Aufbau, Käfig, Sportfahrwerk; kein Straßenbetrieb im Winter'], ['Porsche', '911', 'GT3 (992)', 'petrol', 375, 2022, 'Rennstreckeneinsatz, Bremsen nach jedem Event prüfen']] },
  // ---- Aktiv: Öffentliche Hand
  { key: 'gemeindewerke', name: 'Gemeindewerke Donauauen', kind: 'public', status: 'active', street: 'Schulstraße 4', zip: '93087', city: 'Alteglofsheim', phone: '09453 99400', email: 'verwaltung@gemeindewerke-donauauen.example', paymentTermDays: 30, owner: 'gruber', createdDaysAgo: 1200,
    contacts: [
      { name: 'Karin Moser', position: 'Fuhrparkverwaltung', phone: '09453 99412', email: 'k.moser@gemeindewerke-donauauen.example', primary: true },
      { name: 'Gerhard Spitzer', position: 'Werkleiter', phone: '09453 99400', email: 'g.spitzer@gemeindewerke-donauauen.example' },
    ],
    vehicles: [['VW', 'ID. Buzz', 'Cargo', 'electric', 150, 2023], ['Mercedes-Benz', 'Vito', '116 CDI Kasten', 'diesel', 120, 2019]] },
  { key: 'klinik', name: 'Kreisklinik Oberpfalz-Süd (Fahrdienst)', kind: 'public', status: 'active', street: 'Klinikweg 1', zip: '93309', city: 'Kelheim', phone: '09441 7020', email: 'fahrdienst@kreisklinik-opf-sued.example', paymentTermDays: 30, owner: 'gruber', tags: ['Rahmenvertrag'], createdDaysAgo: 700, district: 'KEH',
    contacts: [
      { name: 'Dr. Peter Albrecht', position: 'Technischer Leiter', phone: '09441 702310', email: 'p.albrecht@kreisklinik-opf-sued.example', primary: true },
      { name: 'Simone Graf', position: 'Einkauf', phone: '09441 702250', email: 's.graf@kreisklinik-opf-sued.example' },
    ],
    vehicles: [['VW', 'Caddy', 'Maxi 2.0 TDI', 'diesel', 90, 2021], ['Skoda', 'Enyaq', 'iV 80', 'electric', 150, 2023]] },
  // ---- Aktiv: Privat
  { key: 'brandstetter', name: 'Martin Brandstetter', kind: 'private', status: 'active', street: 'Lilienweg 14', zip: '93051', city: 'Regensburg', phone: '0160 5550187', email: 'm.brandstetter@mail.example', paymentTermDays: 14, owner: 'klein', tags: ['Tuning'], createdDaysAgo: 240,
    contacts: [{ name: 'Martin Brandstetter', position: '', phone: '0160 5550187', email: 'm.brandstetter@mail.example', primary: true }],
    vehicles: [['BMW', 'M3', 'Competition xDrive', 'petrol', 375, 2022, 'Softwareoptimierung Stage 1, Abgasanlage mit Klappensteuerung, eingetragen']] },
  { key: 'eder', name: 'Johann Eder', kind: 'private', status: 'active', street: 'Am Sonnenhang 8', zip: '93105', city: 'Tegernheim', phone: '09403 4421', email: '', paymentTermDays: 14, owner: 'mustermann', createdDaysAgo: 3000,
    contacts: [{ name: 'Johann Eder', position: '', phone: '09403 4421', email: '', primary: true }],
    vehicles: [['VW', 'Passat Variant', '2.0 TDI Highline', 'diesel', 110, 2016]] },
  { key: 'seidl', name: 'Monika Seidl', kind: 'private', status: 'active', street: 'Rilkestraße 21', zip: '93049', city: 'Regensburg', phone: '0941 32118', email: 'monika.seidl@mail.example', paymentTermDays: 14, owner: 'schmid', createdDaysAgo: 1400,
    contacts: [{ name: 'Monika Seidl', position: '', phone: '0941 32118', email: 'monika.seidl@mail.example', primary: true }],
    vehicles: [['Mini', 'Cooper', 'S 3-Türer', 'petrol', 131, 2019]] },
  { key: 'hofbauer', name: 'Dr. Klaus Hofbauer', kind: 'private', status: 'active', street: 'Ziegetsdorfer Straße 66', zip: '93051', city: 'Regensburg', phone: '0170 5550311', email: 'k.hofbauer@mail.example', paymentTermDays: 14, owner: 'klein', tags: ['Sportwagen'], createdDaysAgo: 210,
    contacts: [{ name: 'Dr. Klaus Hofbauer', position: '', phone: '0170 5550311', email: 'k.hofbauer@mail.example', primary: true }],
    vehicles: [['Porsche', '911', 'Carrera S (991.2)', 'petrol', 309, 2017, 'Saisonfahrzeug, Winterlager bei uns'], ['Tesla', 'Model Y', 'Long Range', 'electric', 378, 2023]] },
  { key: 'maier', name: 'Stefan Maier', kind: 'private', status: 'active', street: 'Amselweg 3', zip: '93055', city: 'Regensburg', phone: '0941 70245', email: 's.maier@mail.example', paymentTermDays: 14, owner: 'klein', tags: ['Tuning'], createdDaysAgo: 560,
    contacts: [{ name: 'Stefan Maier', position: '', phone: '0941 70245', email: 's.maier@mail.example', primary: true }],
    vehicles: [['Audi', 'RS 3 Sportback', '2.5 TFSI quattro', 'petrol', 294, 2022, 'Softwareoptimierung Stage 2, Downpipe mit Gutachten, Prüfstand 478 PS']] },
  { key: 'achatz', name: 'Familie Achatz', kind: 'private', status: 'active', street: 'Donaustraße 17', zip: '93092', city: 'Barbing', phone: '0151 5550926', email: 'achatz.familie@mail.example', paymentTermDays: 14, owner: 'weber', createdDaysAgo: 330,
    contacts: [{ name: 'Christine Achatz', position: '', phone: '0151 5550926', email: 'achatz.familie@mail.example', primary: true }],
    vehicles: [['Skoda', 'Kodiaq', '2.0 TDI 4x4 Style', 'diesel', 147, 2021], ['VW', 'Polo', '1.0 TSI Life', 'petrol', 70, 2020]] },
  { key: 'kerscher', name: 'Rudolf Kerscher', kind: 'private', status: 'active', street: 'Birkenstraße 5', zip: '93138', city: 'Lappersdorf', phone: '0941 82264', email: '', paymentTermDays: 14, owner: 'mustermann', createdDaysAgo: 1000,
    contacts: [{ name: 'Rudolf Kerscher', position: '', phone: '0941 82264', email: '', primary: true }],
    vehicles: [['Mercedes-Benz', 'C-Klasse', 'C 220 d T-Modell', 'diesel', 147, 2018]] },
  { key: 'stadler', name: 'Bernhard Stadler', kind: 'private', status: 'active', street: 'Weinbergweg 9', zip: '93161', city: 'Sinzing', phone: '0941 30987', email: 'b.stadler@mail.example', paymentTermDays: 14, owner: 'klein', tags: ['Tuning'], createdDaysAgo: 180,
    contacts: [{ name: 'Bernhard Stadler', position: '', phone: '0941 30987', email: 'b.stadler@mail.example', primary: true }],
    vehicles: [['VW', 'Golf', 'GTI Clubsport (Mk8)', 'petrol', 221, 2021, 'Gewindefahrwerk, 19-Zoll-Felgen, eingetragen']] },
  { key: 'hartmann', name: 'Kevin Hartmann', kind: 'private', status: 'active', street: 'Lerchenfeldstraße 12', zip: '93051', city: 'Regensburg', phone: '0172 5550833', email: 'k.hartmann@mail.example', paymentTermDays: 14, owner: 'klein', tags: ['Tuning'], createdDaysAgo: 420,
    contacts: [{ name: 'Kevin Hartmann', position: '', phone: '0172 5550833', email: 'k.hartmann@mail.example', primary: true }],
    vehicles: [['Audi', 'S3 Sportback', '2.0 TFSI quattro (8V)', 'petrol', 228, 2019, 'Stage 2 mit Ladeluftkühler, Prüfstand 392 PS']] },
  { key: 'roth', name: 'Sebastian Roth', kind: 'private', status: 'active', street: 'Weiherweg 3', zip: '93152', city: 'Nittendorf', phone: '0157 5550271', email: 's.roth@mail.example', paymentTermDays: 14, owner: 'becker', tags: ['Tuning'], createdDaysAgo: 300,
    contacts: [{ name: 'Sebastian Roth', position: '', phone: '0157 5550271', email: 's.roth@mail.example', primary: true }],
    vehicles: [['BMW', '340i', 'xDrive Touring', 'petrol', 275, 2020]] },
  { key: 'holzer', name: 'Tim Holzer', kind: 'private', status: 'active', street: 'Am Gries 18', zip: '93059', city: 'Regensburg', phone: '0176 5550615', email: 't.holzer@mail.example', paymentTermDays: 14, owner: 'becker', tags: ['Tuning'], createdDaysAgo: 150,
    contacts: [{ name: 'Tim Holzer', position: '', phone: '0176 5550615', email: 't.holzer@mail.example', primary: true }],
    vehicles: [['Cupra', 'Leon', 'VZ 2.0 TSI 300', 'petrol', 221, 2021], ['VW', 'Polo', 'GTI', 'petrol', 152, 2019]] },
  { key: 'engl', name: 'Nadine Engl', kind: 'private', status: 'active', street: 'Sonnenstraße 27', zip: '93138', city: 'Lappersdorf', phone: '0160 5550394', email: 'nadine.engl@mail.example', paymentTermDays: 14, owner: 'klein', tags: ['Tuning'], createdDaysAgo: 260,
    contacts: [{ name: 'Nadine Engl', position: '', phone: '0160 5550394', email: 'nadine.engl@mail.example', primary: true }],
    vehicles: [['Mercedes-AMG', 'A 35', '4MATIC', 'petrol', 225, 2021, 'Sportabgasanlage, Tieferlegungsfedern eingetragen']] },
  // ---- Leads
  { key: 'hartl', name: 'Bäckerei Hartl GmbH', kind: 'fleet', status: 'lead', street: 'Marktplatz 3', zip: '93138', city: 'Lappersdorf', phone: '0941 81553', email: 'info@baeckerei-hartl.example', paymentTermDays: 14, owner: 'weber', createdDaysAgo: 28,
    contacts: [{ name: 'Andreas Hartl', position: 'Geschäftsführer', phone: '0941 81553', email: 'info@baeckerei-hartl.example', primary: true }],
    vehicles: [] },
  { key: 'fahrschule', name: 'Fahrschule Lehner', kind: 'fleet', status: 'lead', street: 'Im Gewerbepark C 25', zip: '93059', city: 'Regensburg', phone: '0941 46612', email: 'kontakt@fahrschule-lehner.example', paymentTermDays: 14, owner: 'gruber', createdDaysAgo: 12,
    contacts: [{ name: 'Jessica Lehner', position: 'Inhaberin', phone: '0941 46612', email: 'j.lehner@fahrschule-lehner.example', primary: true }],
    vehicles: [] },
  { key: 'wimmer', name: 'Florian Wimmer', kind: 'private', status: 'lead', street: 'Fichtenweg 11', zip: '93138', city: 'Lappersdorf', phone: '0176 5550448', email: 'wimmer.f@mail.example', paymentTermDays: 14, owner: 'klein', tags: ['Tuning'], createdDaysAgo: 20,
    contacts: [{ name: 'Florian Wimmer', position: '', phone: '0176 5550448', email: 'wimmer.f@mail.example', primary: true }],
    vehicles: [['VW', 'Golf', 'R (Mk8) 4MOTION', 'petrol', 235, 2022]] },
  { key: 'schreiner', name: 'Ursula Schreiner', kind: 'private', status: 'lead', street: 'Kirchweg 2', zip: '93080', city: 'Pentling', phone: '09405 6612', email: '', paymentTermDays: 14, owner: 'gruber', createdDaysAgo: 45,
    contacts: [{ name: 'Ursula Schreiner', position: '', phone: '09405 6612', email: '', primary: true }],
    vehicles: [['Toyota', 'Yaris', '1.5 Hybrid', 'hybrid', 85, 2020]] },
  { key: 'ott', name: 'Wolfgang Ott', kind: 'private', status: 'lead', street: 'Am Anger 6', zip: '93173', city: 'Wenzenbach', phone: '09407 3301', email: 'w.ott@mail.example', paymentTermDays: 14, owner: 'weber', createdDaysAgo: 16,
    contacts: [{ name: 'Wolfgang Ott', position: '', phone: '09407 3301', email: 'w.ott@mail.example', primary: true }],
    vehicles: [['Mercedes-Benz', 'W123', '280 E', 'petrol', 136, 1982, 'Oldtimer, H-Kennzeichen geplant']] },
  { key: 'fuchs', name: 'Andrea Fuchs', kind: 'private', status: 'lead', street: 'Holzgartenstraße 40', zip: '93053', city: 'Regensburg', phone: '0941 71590', email: 'andrea.fuchs@mail.example', paymentTermDays: 14, owner: 'schmid', createdDaysAgo: 2,
    contacts: [{ name: 'Andrea Fuchs', position: '', phone: '0941 71590', email: 'andrea.fuchs@mail.example', primary: true }],
    vehicles: [] },
  { key: 'carsharing', name: 'Carsharing Regensburg GmbH', kind: 'fleet', status: 'lead', street: 'Parkstraße 7', zip: '93049', city: 'Regensburg', phone: '0941 27788', email: 'flotte@carsharing-rgb.example', paymentTermDays: 30, owner: 'gruber', createdDaysAgo: 30,
    contacts: [{ name: 'Lena Brückl', position: 'Flottenmanagerin', phone: '0941 27788', email: 'l.brueckl@carsharing-rgb.example', primary: true }],
    vehicles: [] },
  // ---- Inaktiv
  { key: 'lang', name: 'Elisabeth Lang', kind: 'private', status: 'inactive', street: 'Bergstraße 4', zip: '93161', city: 'Sinzing', phone: '0941 30412', email: '', paymentTermDays: 14, createdDaysAgo: 2900,
    contacts: [{ name: 'Elisabeth Lang', position: '', phone: '0941 30412', email: '', primary: true }],
    vehicles: [['Opel', 'Astra', '1.4 Turbo', 'petrol', 92, 2013, 'Fahrzeug laut Kundin verkauft']] },
  { key: 'pichler', name: 'Renate Pichler', kind: 'private', status: 'inactive', street: 'Gabelsbergerstraße 15', zip: '93047', city: 'Regensburg', phone: '0941 52291', email: '', paymentTermDays: 14, createdDaysAgo: 2200,
    contacts: [{ name: 'Renate Pichler', position: '', phone: '0941 52291', email: '', primary: true }],
    vehicles: [['Fiat', 'Panda', '1.2 Lounge', 'petrol', 51, 2014]] },
  { key: 'bauer-lechner', name: 'Familie Bauer-Lechner', kind: 'private', status: 'inactive', street: 'Hochweg 31', zip: '93049', city: 'Regensburg', phone: '0941 21876', email: 'bauer-lechner@mail.example', paymentTermDays: 14, createdDaysAgo: 1800,
    contacts: [{ name: 'Sabine Bauer-Lechner', position: '', phone: '0941 21876', email: 'bauer-lechner@mail.example', primary: true }],
    vehicles: [['Renault', 'Scénic', 'TCe 140', 'petrol', 103, 2017]] },
  { key: 'ziegler', name: 'Kfz-Handel Ziegler', kind: 'business', status: 'inactive', street: 'Regensburger Straße 50', zip: '93083', city: 'Obertraubling', phone: '09401 2214', email: 'verkauf@kfz-ziegler.example', paymentTermDays: 14, createdDaysAgo: 2400,
    contacts: [{ name: 'Helmut Ziegler', position: 'Inhaber', phone: '09401 2214', email: 'verkauf@kfz-ziegler.example', primary: true }],
    vehicles: [['Opel', 'Insignia', 'Sports Tourer 2.0 CDTI', 'diesel', 125, 2018]] },
  { key: 'bistro', name: 'Bistro Altstadtgarten', kind: 'business', status: 'inactive', street: 'Glockengasse 4', zip: '93047', city: 'Regensburg', phone: '0941 56120', email: 'hallo@altstadtgarten.example', paymentTermDays: 14, createdDaysAgo: 1600,
    contacts: [{ name: 'Sophie Krämer', position: 'Inhaberin', phone: '0941 56120', email: 'hallo@altstadtgarten.example', primary: true }],
    vehicles: [['Citroën', 'Berlingo', 'Kastenwagen BlueHDi 100', 'diesel', 75, 2016]] },
];

/** Notiztexte je Art; {datum} wird im Seed ersetzt. */
export const NOTE_TEXTS = {
  call: [
    'Rückruf: Fahrzeug ist fertig, Abholung für {datum} vereinbart.',
    'Kunde meldet Quietschen beim Bremsen, Termin zur Probefahrt eingeplant.',
    'Freigabe für Zusatzarbeiten (Bremsbeläge hinten) telefonisch erteilt.',
    'Nachfrage zum Kostenvoranschlag, Entscheidung bis Monatsende angekündigt.',
    'Terminverschiebung auf Wunsch des Kunden, neuer Termin {datum}.',
    'Rückfrage zur letzten Rechnung, Positionen telefonisch erläutert.',
  ],
  email: [
    'Kostenvoranschlag per E-Mail versendet, Gültigkeit 30 Tage.',
    'Prüfstandsprotokoll (vorher/nachher) als PDF zugeschickt.',
    'Terminbestätigung für den Räderwechsel versendet.',
    'Fotos des Unfallschadens vom Kunden erhalten.',
    'Teilegutachten und Unterlagen für die Eintragung weitergeleitet.',
  ],
  meeting: [
    'Fahrzeugannahme: Sichtprüfung, km-Stand und Vorschäden dokumentiert.',
    'Beratung Softwareoptimierung, Prüfstandstermin vereinbart.',
    'Probefahrt mit dem Kunden nach Fahrwerkseinbau, Kunde zufrieden.',
    'Fahrzeugübergabe mit Erklärung der durchgeführten Arbeiten.',
  ],
  note: [
    'Ersatzschlüssel im Schlüsselkasten, Fach 12.',
    'Kunde wünscht Originalteile (OE), keine Nachbauteile.',
    'Winterräder lagern bei uns, Regal C-14.',
    'Ersatzwagen nur mit Automatik (Kundenwunsch).',
    'Rechnungen bitte nur per E-Mail an die Buchhaltung.',
  ],
} as const;

export const NOTE_AUTHORS = ['huber', 'schmid', 'gruber', 'lindner', 'klein', 'kaya', 'bauer'];

// ---- Rechnungsvorlagen für den Seed ----------------------------------------

export interface ItemSpec {
  description: string;
  unit: Unit;
  qty: [number, number];
  /** Einzelpreis netto in Cent [min, max]. */
  price: [number, number];
  optional?: number;
  /** Mengen in halben Einheiten (z. B. 2,5 Std. oder 5,5 l). */
  half?: boolean;
}

export interface JobSpec {
  key: string;
  size: 'small' | 'medium' | 'large';
  kinds: CustomerKind[];
  /** Welche Fahrzeuge passen: Verbrenner (Öl, Zahnriemen …), Elektro, sportliche Verbrenner (Tuning). Ohne Angabe: alle. */
  vehicles?: 'combustion' | 'electric' | 'sporty';
  /** Relative Häufigkeit innerhalb der Größe (Standard 1). */
  weight?: number;
  items: ItemSpec[];
}

const LABOR = (min: number, max: number): ItemSpec => ({ description: 'Arbeitszeit Kfz-Mechatroniker', unit: 'hours', qty: [min, max], price: [11200, 11200], half: true });
const OIL: ItemSpec = { description: 'Motoröl 5W-30 Longlife', unit: 'liter', qty: [4, 7], price: [1690, 1690], half: true };
const DISPOSAL: ItemSpec = { description: 'Altöl- und Altteileentsorgung', unit: 'flat', qty: [1, 1], price: [850, 850] };
const ALL: CustomerKind[] = ['private', 'business', 'fleet', 'public'];

export const JOBS: JobSpec[] = [
  { key: 'inspection', size: 'small', kinds: ALL, vehicles: 'combustion', weight: 1.4, items: [
    { description: 'Inspektion nach Herstellervorgabe', unit: 'flat', qty: [1, 1], price: [18900, 28900] },
    OIL,
    { description: 'Ölfilter', unit: 'piece', qty: [1, 1], price: [1490, 1490] },
    { description: 'Luftfilter', unit: 'piece', qty: [1, 1], price: [2990, 2990], optional: 0.4 },
    { description: 'Innenraumfilter mit Aktivkohle', unit: 'piece', qty: [1, 1], price: [3490, 3490], optional: 0.4 },
    DISPOSAL,
  ] },
  { key: 'ev-service', size: 'small', kinds: ALL, vehicles: 'electric', weight: 0.6, items: [
    { description: 'Inspektion Elektrofahrzeug inkl. Hochvolt-Sichtprüfung', unit: 'flat', qty: [1, 1], price: [18900, 24900] },
    { description: 'Innenraumfilter mit Aktivkohle', unit: 'piece', qty: [1, 1], price: [3490, 3490] },
    { description: 'Bremsflüssigkeit DOT 4', unit: 'liter', qty: [1, 1], price: [1890, 1890], optional: 0.5 },
  ] },
  { key: 'tires', size: 'small', kinds: ALL, weight: 1.3, items: [
    { description: 'Räderwechsel inkl. Wuchten', unit: 'flat', qty: [1, 1], price: [5900, 5900] },
    { description: 'Reifeneinlagerung (eine Saison)', unit: 'flat', qty: [1, 1], price: [4900, 4900], optional: 0.7 },
    { description: 'Ventile erneuern', unit: 'piece', qty: [4, 4], price: [390, 390], optional: 0.3 },
  ] },
  { key: 'hu', size: 'small', kinds: ALL, items: [
    { description: 'HU/AU-Vorbereitung und Vorführung', unit: 'flat', qty: [1, 1], price: [15900, 15900] },
    { description: 'Scheinwerfer einstellen', unit: 'flat', qty: [1, 1], price: [1990, 1990], optional: 0.5 },
    { description: 'Glühlampen und Kleinteile', unit: 'flat', qty: [1, 1], price: [1200, 3500], optional: 0.4 },
  ] },
  { key: 'ac', size: 'small', kinds: ['private', 'business', 'fleet'], items: [
    { description: 'Klimaservice inkl. Desinfektion', unit: 'flat', qty: [1, 1], price: [12900, 12900] },
    { description: 'Kältemittel R1234yf (je 100 g)', unit: 'piece', qty: [3, 6], price: [1490, 1490] },
  ] },
  { key: 'diagnosis', size: 'small', kinds: ALL, items: [
    { description: 'Fehlerdiagnose mit Systemtester', unit: 'flat', qty: [1, 1], price: [8900, 8900] },
    LABOR(1, 3),
    { description: 'Sensor/Kleinteil lt. Diagnose', unit: 'piece', qty: [1, 1], price: [4900, 18900], optional: 0.6 },
  ] },
  { key: 'brakes', size: 'medium', kinds: ALL, items: [
    { description: 'Bremsscheiben Vorderachse (Satz)', unit: 'piece', qty: [1, 1], price: [18900, 38900] },
    { description: 'Bremsbeläge Vorderachse (Satz)', unit: 'piece', qty: [1, 1], price: [7900, 16900] },
    { description: 'Bremsflüssigkeit DOT 4', unit: 'liter', qty: [1, 1], price: [1890, 1890], optional: 0.5 },
    LABOR(1.5, 3),
  ] },
  { key: 'timing', size: 'medium', kinds: ['private', 'business', 'fleet'], vehicles: 'combustion', items: [
    { description: 'Zahnriemensatz mit Wasserpumpe', unit: 'piece', qty: [1, 1], price: [28900, 48900] },
    { description: 'Kühlmittel G13', unit: 'liter', qty: [4, 6], price: [1290, 1290] },
    LABOR(4, 7),
    DISPOSAL,
  ] },
  { key: 'clutch', size: 'medium', kinds: ['private', 'business', 'fleet'], vehicles: 'combustion', weight: 0.7, items: [
    { description: 'Kupplungssatz mit Zweimassenschwungrad', unit: 'piece', qty: [1, 1], price: [89000, 149000] },
    LABOR(6, 9),
    DISPOSAL,
  ] },
  { key: 'fleet-check', size: 'medium', kinds: ['fleet', 'public', 'business'], items: [
    { description: 'Fuhrpark-Check je Fahrzeug (UVV-Prüfung)', unit: 'piece', qty: [3, 6], price: [8900, 12900] },
    { description: 'Verschleißteile lt. Prüfprotokoll', unit: 'flat', qty: [1, 1], price: [25000, 90000] },
    LABOR(2, 5),
  ] },
  { key: 'suspension', size: 'medium', kinds: ['private', 'business'], vehicles: 'sporty', weight: 0.35, items: [
    { description: 'Gewindefahrwerk Variante 3 inkl. Domlager', unit: 'piece', qty: [1, 1], price: [169000, 249000] },
    LABOR(5, 7),
    { description: 'Achsvermessung und Spureinstellung', unit: 'flat', qty: [1, 1], price: [11900, 11900] },
    { description: 'Teilegutachten prüfen und Eintragung vorbereiten', unit: 'flat', qty: [1, 1], price: [14900, 14900] },
  ] },
  { key: 'stage1', size: 'medium', kinds: ['private', 'business'], vehicles: 'sporty', weight: 0.4, items: [
    { description: 'Softwareoptimierung Stage 1 inkl. Prüfstandslauf', unit: 'flat', qty: [1, 1], price: [89000, 129000] },
    { description: 'Leistungsmessung auf dem Prüfstand (vorher/nachher)', unit: 'flat', qty: [1, 1], price: [19900, 19900] },
    { description: 'Teilegutachten prüfen und Eintragung vorbereiten', unit: 'flat', qty: [1, 1], price: [24900, 24900], optional: 0.6 },
  ] },
  { key: 'stage2', size: 'large', kinds: ['private', 'business'], vehicles: 'sporty', weight: 0.25, items: [
    { description: 'Softwareoptimierung Stage 2', unit: 'flat', qty: [1, 1], price: [129000, 169000] },
    { description: 'Downpipe mit Sportkatalysator (mit Gutachten)', unit: 'piece', qty: [1, 1], price: [129000, 189000] },
    { description: 'Ladeluftkühler Performance', unit: 'piece', qty: [1, 1], price: [89000, 129000], optional: 0.6 },
    { description: 'Abgasanlage ab Kat mit Klappensteuerung', unit: 'piece', qty: [1, 1], price: [189000, 349000] },
    LABOR(10, 16),
    { description: 'Leistungsmessung auf dem Prüfstand (vorher/nachher)', unit: 'flat', qty: [1, 1], price: [19900, 19900] },
    { description: 'Einzelabnahme und Eintragung (Vorbereitung und Vorführung)', unit: 'flat', qty: [1, 1], price: [39000, 39000] },
  ] },
  { key: 'engine', size: 'large', kinds: ['private', 'business', 'fleet'], vehicles: 'combustion', items: [
    { description: 'Zylinderkopf überholen (Fachbetrieb)', unit: 'flat', qty: [1, 1], price: [290000, 490000] },
    { description: 'Dichtungssatz, Schrauben und Kleinteile', unit: 'flat', qty: [1, 1], price: [29000, 49000] },
    LABOR(14, 22),
    OIL,
    DISPOSAL,
  ] },
  { key: 'accident', size: 'large', kinds: ALL, weight: 1.4, items: [
    { description: 'Unfallinstandsetzung Front lt. Gutachten (Teile)', unit: 'flat', qty: [1, 1], price: [250000, 650000] },
    { description: 'Arbeitszeit Karosserie', unit: 'hours', qty: [8, 18], price: [10400, 10400], half: true },
    { description: 'Lackierung (Nachunternehmer)', unit: 'flat', qty: [1, 1], price: [90000, 240000] },
    { description: 'Achsvermessung und Spureinstellung', unit: 'flat', qty: [1, 1], price: [11900, 11900] },
  ] },
  { key: 'track-service', size: 'large', kinds: ['business'], vehicles: 'sporty', weight: 0.2, items: [
    { description: 'Event-Service Rennstrecke (Bremsen, Fahrwerk, Flüssigkeiten)', unit: 'flat', qty: [1, 1], price: [190000, 290000] },
    { description: 'Rennbremsbeläge (Satz)', unit: 'piece', qty: [2, 2], price: [39000, 59000] },
    { description: 'Bremsflüssigkeit Racing', unit: 'liter', qty: [1, 2], price: [4900, 4900] },
    LABOR(8, 14),
  ] },
];

export const MATERIAL_SUPPLIERS = ['Teilegroßhandel Ostbayern', 'Reifen-Center Süd GmbH', 'Performance Parts Bayern', 'Schmierstoffe Brandner KG'];
export const MATERIAL_DESCRIPTIONS = [
  'Ersatzteile Bremsen und Fahrwerk',
  'Reifen Saisongeschäft',
  'Motoröl (Fassware) und Filter',
  'Tuning-Teile für Kundenaufträge',
  'Verschleißteile und Kleinmaterial',
  'Lagerauffüllung Schnellservice',
  'Karosserieteile Unfallinstandsetzung',
];

export const DEMO_TASKS: { title: string; dueInDays: number | null; done?: boolean }[] = [
  { title: 'Reifeneinlagerung: Kunden für den Frühjahrswechsel anschreiben', dueInDays: 5 },
  { title: 'Hebebühne 3: UVV-Prüfung terminieren', dueInDays: 12 },
  { title: 'Prüfstand: jährliche Kalibrierung beauftragen', dueInDays: 20 },
  { title: 'Ersatzwagen R-LM 12: Inspektion einplanen', dueInDays: null },
  { title: 'Lizenz Diagnosesoftware verlängern', dueInDays: -3, done: true },
];

// ---- Laufkundschaft: erzeugte Privatkunden mit Alltagsfahrzeugen (deterministisch im Seed) -----------------

export const WALKIN_COUNT = 140;
export const FIRST_NAMES = ['Thomas', 'Michael', 'Andreas', 'Christian', 'Markus', 'Alexander', 'Sebastian', 'Matthias', 'Johannes', 'Lukas', 'Simon', 'Maximilian', 'Felix', 'Julian', 'Patrick', 'Dominik', 'Georg', 'Anton', 'Andrea', 'Claudia', 'Stefanie', 'Katharina', 'Christina', 'Anna', 'Lisa', 'Sarah', 'Melanie', 'Martina', 'Susanne', 'Verena', 'Theresa', 'Franziska', 'Johanna', 'Elena'];
export const LAST_NAMES = ['Obermeier', 'Kronawitter', 'Gschwendtner', 'Zeitler', 'Baumgartner', 'Wittmann', 'Dietl', 'Ebner', 'Forster', 'Gmeiner', 'Haas', 'Kellermann', 'Lindl', 'Moosbauer', 'Niedermeier', 'Pongratz', 'Rieder', 'Sailer', 'Thalhammer', 'Unger', 'Vogt', 'Wiesmeier', 'Zach', 'Aigner', 'Dengler', 'Eichinger', 'Hechtl', 'Islinger', 'Jobst', 'Kiendl', 'Loibl', 'Mühlbauer', 'Nußbaumer', 'Oswald', 'Prem', 'Reindl', 'Schötz', 'Treml', 'Vilsmeier', 'Weigl', 'Zollner', 'Hofmann', 'Schuster', 'Zimmermann', 'Neumann', 'Herrmann', 'Kaiser', 'Lehmann'];
export const STREETS = ['Hauptstraße', 'Bahnhofstraße', 'Gartenstraße', 'Schulstraße', 'Kirchplatz', 'Am Mühlbach', 'Lindenweg', 'Ahornweg', 'Eichendorffstraße', 'Mozartstraße', 'Goethestraße', 'Bergstraße', 'Waldweg', 'Rosenstraße', 'Feldweg', 'Brunnenstraße'];
export const PLACES: [zip: string, city: string][] = [
  ['93047', 'Regensburg'], ['93049', 'Regensburg'], ['93051', 'Regensburg'], ['93053', 'Regensburg'], ['93055', 'Regensburg'], ['93059', 'Regensburg'],
  ['93073', 'Neutraubling'], ['93080', 'Pentling'], ['93083', 'Obertraubling'], ['93092', 'Barbing'], ['93105', 'Tegernheim'], ['93138', 'Lappersdorf'],
  ['93152', 'Nittendorf'], ['93161', 'Sinzing'], ['93173', 'Wenzenbach'], ['93087', 'Alteglofsheim'], ['93093', 'Donaustauf'],
];
/** Alltagsfahrzeuge [Marke, Modell, Variante, Kraftstoff, kW]; die letzten Einträge sind seltene sportliche Modelle. */
export const EVERYDAY_CARS: [make: string, model: string, variant: string, fuel: FuelType, kw: number, weight: number][] = [
  ['VW', 'Golf', '1.5 TSI Life', 'petrol', 96, 6], ['VW', 'Polo', '1.0 TSI', 'petrol', 70, 5], ['VW', 'Passat Variant', '2.0 TDI', 'diesel', 110, 4],
  ['VW', 'Tiguan', '2.0 TDI 4MOTION', 'diesel', 110, 4], ['VW', 'T-Roc', '1.5 TSI', 'petrol', 110, 3], ['VW', 'ID.3', 'Pro', 'electric', 150, 2],
  ['Skoda', 'Octavia Combi', '2.0 TDI', 'diesel', 110, 5], ['Skoda', 'Fabia', '1.0 TSI', 'petrol', 70, 3], ['Opel', 'Astra', '1.2 Turbo', 'petrol', 96, 3],
  ['Opel', 'Corsa', '1.2', 'petrol', 74, 3], ['Ford', 'Focus', '1.0 EcoBoost', 'petrol', 92, 3], ['Ford', 'Fiesta', '1.0 EcoBoost', 'petrol', 74, 2],
  ['BMW', '118i', '', 'petrol', 103, 3], ['BMW', '320d', 'Touring', 'diesel', 140, 4], ['Audi', 'A3 Sportback', '35 TFSI', 'petrol', 110, 3],
  ['Audi', 'A4 Avant', '40 TDI', 'diesel', 150, 3], ['Mercedes-Benz', 'A-Klasse', 'A 180', 'petrol', 100, 3], ['Mercedes-Benz', 'C-Klasse', 'C 200', 'petrol', 150, 2],
  ['Toyota', 'Yaris', '1.5 Hybrid', 'hybrid', 85, 3], ['Toyota', 'RAV4', '2.5 Hybrid', 'hybrid', 163, 2], ['Hyundai', 'i30', '1.5 T-GDI', 'petrol', 117, 2],
  ['Kia', 'Ceed Sportswagon', '1.5 T-GDI', 'petrol', 118, 2], ['Seat', 'Leon', '1.5 TSI', 'petrol', 110, 2], ['Renault', 'Clio', 'TCe 90', 'petrol', 67, 2],
  ['Fiat', '500', '1.0 Hybrid', 'hybrid', 51, 2], ['Dacia', 'Sandero', 'TCe 90', 'petrol', 67, 2], ['Tesla', 'Model 3', 'RWD', 'electric', 208, 2],
  ['Mazda', 'CX-5', '2.5 Skyactiv-G', 'petrol', 143, 1], ['Volvo', 'XC60', 'B4 Diesel', 'diesel', 145, 1],
  ['VW', 'Golf', 'GTI', 'petrol', 180, 1], ['Cupra', 'Formentor', 'VZ 2.0 TSI', 'petrol', 228, 1], ['BMW', 'M340i', 'xDrive', 'petrol', 275, 0.5], ['Ford', 'Focus', 'ST 2.3 EcoBoost', 'petrol', 206, 0.5],
];
