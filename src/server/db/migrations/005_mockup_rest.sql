-- Version 0.4: restliche Mockup-Seiten (Annahme, Hallenplan, Werkzeug, Fuhrpark, Racing-Team, Setups, Trackdays,
-- Rahmenverträge, Nachrichten, Ränge, Bewerbungen, Abwesenheiten, Prüfungstermine, Lizenzen, Kasse, Daueraufträge,
-- Ziele, Preisliste, Regelwerk, Pinnwand, Webhooks, API-Schlüssel, Server-Einstellungen).

-- Angemeldete Geräte unter „Mein Konto“
ALTER TABLE sessions ADD COLUMN user_agent text NOT NULL DEFAULT '';

-- Konten: Trinkgeldkasse und Rennteam-Budget
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_account_check CHECK (account IN ('firma', 'kasse', 'trinkgeld', 'rennteam'));

-- Angebote und Mahnungen
ALTER TABLE bills ADD COLUMN kind text NOT NULL DEFAULT 'rechnung' CHECK (kind IN ('rechnung', 'angebot'));
ALTER TABLE bills ADD COLUMN reminders integer NOT NULL DEFAULT 0;
ALTER TABLE bills ADD COLUMN reminded_at timestamptz;

-- Firmen: weitere Einstellungen (Trackday-Pakete, Textvorlagen, Zahlungsziel, Standorte, öffentliche Daten)
ALTER TABLE companies ADD COLUMN extra jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Fahrzeugannahme: Zustand und Checkliste am Auftrag; Kennzeichen-Abgleich
ALTER TABLE orders ADD COLUMN intake jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE vehicles ADD COLUMN stolen boolean NOT NULL DEFAULT false;

-- Fixum (Lohnmodell aus dem Rang)
ALTER TABLE memberships ADD COLUMN fixed_cents integer NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0);
ALTER TABLE payslips ADD COLUMN fixed_cents integer NOT NULL DEFAULT 0;

-- Freitext-Antworten im Kurstest, die ein Trainer bewertet
ALTER TABLE course_progress ADD COLUMN answers jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE course_progress ADD COLUMN review jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE course_progress ADD COLUMN choice_right integer NOT NULL DEFAULT 0;

-- Lager: Bewegungen (für Verbrauch) und Bestellungen
CREATE TABLE part_moves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX part_moves_company_idx ON part_moves(company_id, created_at);

CREATE TABLE part_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  part_id uuid NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  qty integer NOT NULL CHECK (qty > 0),
  supplier text NOT NULL DEFAULT '',
  cost_cents integer NOT NULL DEFAULT 0 CHECK (cost_cents >= 0),
  expected date,
  status text NOT NULL DEFAULT 'bestellt' CHECK (status IN ('bestellt', 'geliefert', 'storniert')),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  delivered_at timestamptz
);

-- Hallenplan
CREATE TABLE bays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'hebebuehne' CHECK (kind IN ('hebebuehne', 'lack', 'pruefstand', 'wasch', 'sonstig')),
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bay_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  bay_id uuid NOT NULL REFERENCES bays(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX bay_bookings_company_idx ON bay_bookings(company_id, starts_at);

-- Werkzeug
CREATE TABLE tools (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  info text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'frei' CHECK (status IN ('frei', 'ausgegeben', 'wartung')),
  holder_id uuid REFERENCES users(id) ON DELETE SET NULL,
  since timestamptz,
  check_due date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Fuhrpark (eigene Fahrzeuge, z. B. Abschlepper) mit Fahrtenbuch
CREATE TABLE fleet (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  model text NOT NULL DEFAULT '',
  plate text NOT NULL DEFAULT '',
  km integer NOT NULL DEFAULT 0 CHECK (km >= 0),
  fuel integer NOT NULL DEFAULT 100 CHECK (fuel BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'frei' CHECK (status IN ('frei', 'einsatz', 'werkstatt')),
  driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  service_due date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE fleet_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  fleet_id uuid NOT NULL REFERENCES fleet(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL CHECK (action IN ('ausgabe', 'rueckgabe', 'tanken', 'schaden', 'service')),
  km integer,
  fuel integer,
  cost_cents integer NOT NULL DEFAULT 0,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX fleet_log_company_idx ON fleet_log(company_id, created_at);

-- Racing: Rennwagen, Meisterschaft, Setups, Runden mit Sektoren, Trackday-Buchungen
CREATE TABLE race_cars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number text NOT NULL DEFAULT '',
  car text NOT NULL,
  driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'bereit' CHECK (status IN ('bereit', 'wartung', 'defekt')),
  km integer NOT NULL DEFAULT 0 CHECK (km >= 0),
  wear jsonb NOT NULL DEFAULT '{}'::jsonb,
  budget_cents integer NOT NULL DEFAULT 0 CHECK (budget_cents >= 0),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE race_entries ADD COLUMN car_id uuid REFERENCES race_cars(id) ON DELETE SET NULL;

CREATE TABLE championship (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  season integer NOT NULL,
  team text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  own boolean NOT NULL DEFAULT false,
  UNIQUE (company_id, season, team)
);

CREATE TABLE setups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  car_id uuid NOT NULL REFERENCES race_cars(id) ON DELETE CASCADE,
  track text NOT NULL,
  vals jsonb NOT NULL DEFAULT '{}'::jsonb,
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (car_id, track)
);

CREATE TABLE laps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  car_id uuid REFERENCES race_cars(id) ON DELETE SET NULL,
  driver text NOT NULL DEFAULT '',
  track text NOT NULL,
  s1 integer NOT NULL CHECK (s1 > 0),
  s2 integer NOT NULL CHECK (s2 > 0),
  s3 integer NOT NULL CHECK (s3 > 0),
  session text NOT NULL DEFAULT 'Training',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX laps_company_idx ON laps(company_id, track);

CREATE TABLE trackday_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id uuid REFERENCES race_events(id) ON DELETE SET NULL,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  package text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  transport boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'angefragt' CHECK (status IN ('angefragt', 'bestaetigt', 'abgesagt')),
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Kunden: Rahmenverträge und Nachrichten
CREATE TABLE contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  workshop_pct integer NOT NULL DEFAULT 0 CHECK (workshop_pct BETWEEN 0 AND 100),
  tuning_pct integer NOT NULL DEFAULT 0 CHECK (tuning_pct BETWEEN 0 AND 100),
  rules text NOT NULL DEFAULT '',
  billing text NOT NULL DEFAULT '',
  valid_until date,
  status text NOT NULL DEFAULT 'aktiv' CHECK (status IN ('aktiv', 'pruefen', 'beendet')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  dir text NOT NULL CHECK (dir IN ('in', 'out')),
  text text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_company_idx ON messages(company_id, customer_id, created_at);

-- Personal: Ränge, Bewerbungen, Abwesenheiten, Stempel-Nachträge
CREATE TABLE ranks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  wage_cents integer NOT NULL DEFAULT 0 CHECK (wage_cents >= 0),
  commission_pct integer NOT NULL DEFAULT 0 CHECK (commission_pct BETWEEN 0 AND 100),
  fixed_cents integer NOT NULL DEFAULT 0 CHECK (fixed_cents >= 0),
  groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (company_id, name)
);

CREATE TABLE applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text NOT NULL DEFAULT '',
  contact text NOT NULL DEFAULT '',
  text text NOT NULL DEFAULT '',
  rating integer NOT NULL DEFAULT 0 CHECK (rating BETWEEN 0 AND 5),
  status text NOT NULL DEFAULT 'neu' CHECK (status IN ('neu', 'gespraech', 'eingestellt', 'abgesagt')),
  interview_at timestamptz,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date_from date NOT NULL,
  date_to date NOT NULL,
  kind text NOT NULL DEFAULT 'urlaub' CHECK (kind IN ('urlaub', 'krank', 'schule', 'pruefung', 'sonstiges')),
  status text NOT NULL DEFAULT 'beantragt' CHECK (status IN ('beantragt', 'genehmigt', 'abgelehnt')),
  note text NOT NULL DEFAULT '',
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (date_to >= date_from)
);

CREATE TABLE duty_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duty_id uuid REFERENCES duty_sessions(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'beantragt' CHECK (status IN ('beantragt', 'genehmigt', 'abgelehnt')),
  decided_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ended_at > started_at)
);

-- Schulungen: Termine und Lizenzen
CREATE TABLE course_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  kind text NOT NULL DEFAULT 'praxis' CHECK (kind IN ('praxis', 'einfuehrung', 'test')),
  trainer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  participants jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  holder_id uuid REFERENCES users(id) ON DELETE SET NULL,
  valid_until date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Finanzen: Kassenabschluss, Daueraufträge, Ziele
CREATE TABLE cash_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  expected_cents integer NOT NULL,
  counted_cents integer NOT NULL,
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE standing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  text text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents <> 0),
  account text NOT NULL DEFAULT 'firma' CHECK (account IN ('firma', 'kasse', 'trinkgeld', 'rennteam')),
  category text NOT NULL DEFAULT 'Dauerauftrag',
  every text NOT NULL DEFAULT 'monat' CHECK (every IN ('woche', 'monat', 'jahr')),
  next_date date NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  target_cents integer NOT NULL CHECK (target_cents > 0),
  account text NOT NULL DEFAULT 'firma' CHECK (account IN ('firma', 'kasse', 'trinkgeld', 'rennteam')),
  deadline date,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Firma: Preisliste, Regelwerk, Pinnwand
CREATE TABLE services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  area text NOT NULL DEFAULT 'Werkstatt',
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  course_id uuid REFERENCES courses(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE orders ADD COLUMN service_id uuid REFERENCES services(id) ON DELETE SET NULL;

CREATE TABLE rule_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE rule_acks (
  doc_id uuid NOT NULL REFERENCES rule_docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version integer NOT NULL,
  acked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (doc_id, user_id)
);

CREATE TABLE posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  pinned boolean NOT NULL DEFAULT false,
  poll jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE post_reads (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);
CREATE TABLE poll_votes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  option integer NOT NULL,
  PRIMARY KEY (post_id, user_id)
);

-- Anbindungen: Webhooks je Firma, API-Schlüssel des Servers, Wünsche
CREATE TABLE webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT '',
  url text NOT NULL,
  kind text NOT NULL DEFAULT 'discord' CHECK (kind IN ('discord', 'json')),
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  last_status text NOT NULL DEFAULT '',
  last_at timestamptz,
  fails integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  prefix text NOT NULL,
  hash text NOT NULL UNIQUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  last_used_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE integration_votes (
  key text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (key, user_id)
);

-- Gruppen aus den Vorlagen bekommen Stufen für die neuen Bereiche (nur wo noch nichts gesetzt ist).
UPDATE groups SET levels = '{"werkzeug":"3","hallenplan":"3","fuhrpark":"3","vertraege":"3","nachrichten":"3","bewerbungen":"2","raenge":"1","preisliste":"2","regelwerk":"2","pinnwand":"3"}'::jsonb || levels WHERE name = 'Leitung' AND NOT is_owner;
UPDATE groups SET levels = '{"werkzeug":"2","hallenplan":"2","fuhrpark":"1","vertraege":"1","nachrichten":"2","preisliste":"1","regelwerk":"1","pinnwand":"2"}'::jsonb || levels WHERE name = 'Mechanik' AND NOT is_owner;
UPDATE groups SET levels = '{"werkzeug":"1","fuhrpark":"2","vertraege":"1","nachrichten":"2","preisliste":"1","regelwerk":"1","pinnwand":"2"}'::jsonb || levels WHERE name = 'Abschleppdienst' AND NOT is_owner;
UPDATE groups SET levels = '{"vertraege":"3","nachrichten":"2","bewerbungen":"1","raenge":"1","preisliste":"3","regelwerk":"1","pinnwand":"2"}'::jsonb || levels WHERE name = 'Büro & Finanzen' AND NOT is_owner;
UPDATE groups SET levels = '{"werkzeug":"x","hallenplan":"x","fuhrpark":"x","vertraege":"x","nachrichten":"x","bewerbungen":"x","raenge":"x","preisliste":"x","regelwerk":"1","pinnwand":"1"}'::jsonb || levels WHERE name = 'Gäste' AND NOT is_owner;
