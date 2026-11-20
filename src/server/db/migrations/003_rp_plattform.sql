-- Pitstop 0.2 – RP-Plattform: mehrere Firmen pro Server, Gruppen und Rechte pro Firma,
-- Server-Admin als eigene Rolle pro Konto. Ersetzt die Fachtabellen von Version 0.1 (Werkstatt-ERP mit MwSt.).
-- Geld in Cent (Spielwährung $, keine Steuern).

DROP TABLE IF EXISTS invoice_items, invoices, notes, contacts, vehicles, timesheets, absences, expenses, tasks CASCADE;
ALTER TABLE users ADD COLUMN is_server_admin boolean NOT NULL DEFAULT false;
UPDATE users SET is_server_admin = (role = 'admin');
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users DROP COLUMN employee_id;
ALTER TABLE users ADD COLUMN prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE users ADD COLUMN discord text NOT NULL DEFAULT '';
DROP TABLE IF EXISTS customers, employees CASCADE;
DROP SEQUENCE IF EXISTS personnel_number_seq, customer_number_seq, invoice_number_seq;
DELETE FROM settings WHERE key = 'company';

CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  short text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  modules text[] NOT NULL DEFAULT ARRAY['werkstatt', 'abschlepp', 'kunden', 'personal', 'finanzen'],
  lock_wins boolean NOT NULL DEFAULT true,
  support_access boolean NOT NULL DEFAULT false,
  info jsonb NOT NULL DEFAULT '{}'::jsonb,
  map_bounds jsonb NOT NULL DEFAULT '{"x0": -4000, "x1": 4500, "y0": -4000, "y1": 8000}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE memberships (
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  locked boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX memberships_user_idx ON memberships(user_id);

-- levels: { bereich: 'x' | '1' | '2' | '3' }, own: { bereich: true }, specials: { schlüssel: true | Zahl }
CREATE TABLE groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#9aa7bd',
  description text NOT NULL DEFAULT '',
  is_owner boolean NOT NULL DEFAULT false,
  levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  own jsonb NOT NULL DEFAULT '{}'::jsonb,
  specials jsonb NOT NULL DEFAULT '{}'::jsonb,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX groups_company_idx ON groups(company_id);
CREATE UNIQUE INDEX groups_one_owner ON groups(company_id) WHERE is_owner;

CREATE TABLE group_members (
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE permission_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  area text NOT NULL,
  level text NOT NULL CHECK (level IN ('x', '1', '2', '3')),
  until date,
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, area)
);

CREATE SEQUENCE customer_no_seq START 1001;
CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT nextval('customer_no_seq'),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'privat' CHECK (kind IN ('privat', 'firma', 'fraktion', 'racing')),
  phone text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  discount integer NOT NULL DEFAULT 0 CHECK (discount BETWEEN 0 AND 100),
  blocked boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX customers_company_idx ON customers(company_id);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  plate text NOT NULL,
  model text NOT NULL DEFAULT '',
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_company_idx ON vehicles(company_id);

CREATE SEQUENCE order_no_seq START 1001;
CREATE TABLE orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT nextval('order_no_seq'),
  title text NOT NULL,
  kind text NOT NULL DEFAULT 'werkstatt' CHECK (kind IN ('werkstatt', 'tuning', 'karosserie', 'racing')),
  status text NOT NULL DEFAULT 'neu' CHECK (status IN ('neu', 'arbeit', 'wartet', 'fertig', 'abgeholt')),
  priority boolean NOT NULL DEFAULT false,
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  assignee_id uuid REFERENCES users(id) ON DELETE SET NULL,
  amount_cents integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX orders_company_idx ON orders(company_id);

CREATE SEQUENCE callout_no_seq START 201;
CREATE TABLE callouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT nextval('callout_no_seq'),
  location text NOT NULL,
  x numeric(8,1),
  y numeric(8,1),
  requester text NOT NULL DEFAULT '',
  vehicle text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'unterwegs', 'vorort', 'erledigt')),
  driver_id uuid REFERENCES users(id) ON DELETE SET NULL,
  truck text NOT NULL DEFAULT '',
  fee_cents integer NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  done_at timestamptz
);
CREATE INDEX callouts_company_idx ON callouts(company_id);

CREATE SEQUENCE bill_no_seq START 1001;
CREATE TABLE bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  number integer NOT NULL DEFAULT nextval('bill_no_seq'),
  customer_id uuid REFERENCES customers(id) ON DELETE SET NULL,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  callout_id uuid REFERENCES callouts(id) ON DELETE SET NULL,
  title text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  status text NOT NULL DEFAULT 'offen' CHECK (status IN ('offen', 'bezahlt', 'storniert')),
  due_date date,
  paid_at timestamptz,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bills_company_idx ON bills(company_id);

CREATE TABLE transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  account text NOT NULL DEFAULT 'firma' CHECK (account IN ('firma', 'kasse')),
  amount_cents integer NOT NULL,
  text text NOT NULL,
  category text NOT NULL DEFAULT 'Sonstiges',
  bill_id uuid REFERENCES bills(id) ON DELETE SET NULL,
  booked_at date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX transactions_company_idx ON transactions(company_id, booked_at);

CREATE TABLE duty_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text NOT NULL DEFAULT ''
);
CREATE INDEX duty_company_idx ON duty_sessions(company_id, started_at);
CREATE UNIQUE INDEX duty_one_open ON duty_sessions(company_id, user_id) WHERE ended_at IS NULL;

-- company_id NULL = Server-Protokoll
CREATE TABLE audit_log (
  id bigserial PRIMARY KEY,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  area text NOT NULL,
  action text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_company_idx ON audit_log(company_id, created_at DESC);

CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  tone text NOT NULL DEFAULT 'info' CHECK (tone IN ('info', 'warn')),
  author_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
