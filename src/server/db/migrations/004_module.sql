-- Version 0.3: Lager, Dienstplan, Lohn, Schulungen, Tuning, Racing.

ALTER TABLE companies ALTER COLUMN modules SET DEFAULT ARRAY['werkstatt', 'abschlepp', 'tuning', 'racing', 'kunden', 'personal', 'schulungen', 'finanzen'];
ALTER TABLE companies ADD COLUMN tuning jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Bestehende Firmen bekommen die neuen Module eingeschaltet (abschaltbar unter Firma → Module).
UPDATE companies SET modules = modules || ARRAY(SELECT m FROM unnest(ARRAY['tuning', 'racing', 'schulungen']) m WHERE NOT m = ANY(modules));

-- Gruppen aus den Vorlagen bekommen Stufen für die neuen Bereiche (nur wo noch nichts gesetzt ist).
UPDATE groups SET levels = '{"lager":"3","tuning":"3","racing":"3","dienstplan":"3","lohn":"1","schulungen":"3"}'::jsonb || levels WHERE name = 'Leitung' AND NOT is_owner;
UPDATE groups SET levels = '{"lager":"2","tuning":"2","racing":"1","dienstplan":"1","lohn":"1"}'::jsonb || levels, own = '{"lohn":true}'::jsonb || own WHERE name = 'Mechanik' AND NOT is_owner;
UPDATE groups SET levels = '{"dienstplan":"1","lohn":"1"}'::jsonb || levels, own = '{"lohn":true}'::jsonb || own WHERE name = 'Abschleppdienst' AND NOT is_owner;
UPDATE groups SET levels = '{"lager":"1","dienstplan":"1","lohn":"3"}'::jsonb || levels, specials = '{"lohnzahlung":true}'::jsonb || specials WHERE name = 'Büro & Finanzen' AND NOT is_owner;
UPDATE groups SET levels = '{"lager":"x","tuning":"x","racing":"x","dienstplan":"x","lohn":"x","schulungen":"x"}'::jsonb || levels WHERE name = 'Gäste' AND NOT is_owner;

-- Lohn: Stundenlohn und Provision je Mitglied
ALTER TABLE memberships ADD COLUMN wage_cents integer NOT NULL DEFAULT 0 CHECK (wage_cents >= 0);
ALTER TABLE memberships ADD COLUMN commission_pct integer NOT NULL DEFAULT 0 CHECK (commission_pct BETWEEN 0 AND 100);

CREATE TABLE parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sku text NOT NULL DEFAULT '',
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'Stk',
  qty integer NOT NULL DEFAULT 0 CHECK (qty >= 0),
  min_qty integer NOT NULL DEFAULT 0 CHECK (min_qty >= 0),
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  location text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX parts_company_idx ON parts(company_id);

CREATE TABLE shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  role text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX shifts_company_idx ON shifts(company_id, starts_at);

CREATE TABLE payslips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_from date NOT NULL,
  period_to date NOT NULL,
  minutes integer NOT NULL DEFAULT 0,
  wage_cents integer NOT NULL DEFAULT 0,
  commission_cents integer NOT NULL DEFAULT 0,
  bonus_cents integer NOT NULL DEFAULT 0,
  total_cents integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt')),
  paid_at timestamptz,
  transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, period_from, period_to)
);

CREATE TABLE courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'Allgemein',
  lessons jsonb NOT NULL DEFAULT '[]'::jsonb,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  pass_pct integer NOT NULL DEFAULT 70 CHECK (pass_pct BETWEEN 0 AND 100),
  valid_months integer NOT NULL DEFAULT 0 CHECK (valid_months >= 0),
  practical boolean NOT NULL DEFAULT false,
  required_groups jsonb NOT NULL DEFAULT '[]'::jsonb,
  trainer_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX courses_company_idx ON courses(company_id);

CREATE TABLE course_progress (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lessons_done integer NOT NULL DEFAULT 0,
  score integer,
  practical_ok boolean NOT NULL DEFAULT false,
  practical_by uuid REFERENCES users(id) ON DELETE SET NULL,
  passed_at date,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (course_id, user_id)
);

CREATE TABLE dyno_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  label text NOT NULL DEFAULT '',
  hp integer NOT NULL CHECK (hp >= 0),
  torque integer NOT NULL DEFAULT 0 CHECK (torque >= 0),
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE race_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'rennen' CHECK (kind IN ('rennen', 'teamstart', 'trackday', 'meet')),
  starts_at timestamptz NOT NULL,
  track text NOT NULL DEFAULT '',
  laps integer NOT NULL DEFAULT 0 CHECK (laps >= 0),
  fee_cents integer NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  prize_cents integer NOT NULL DEFAULT 0 CHECK (prize_cents >= 0),
  max_entries integer NOT NULL DEFAULT 0 CHECK (max_entries >= 0),
  status text NOT NULL DEFAULT 'planung' CHECK (status IN ('planung', 'offen', 'fertig', 'abgesagt')),
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX race_events_company_idx ON race_events(company_id, starts_at);

CREATE TABLE race_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES race_events(id) ON DELETE CASCADE,
  driver text NOT NULL,
  car text NOT NULL DEFAULT '',
  start_no text NOT NULL DEFAULT '',
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  team boolean NOT NULL DEFAULT false,
  paid boolean NOT NULL DEFAULT false,
  lap_ms integer CHECK (lap_ms > 0),
  position integer CHECK (position > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX race_entries_event_idx ON race_entries(event_id);
