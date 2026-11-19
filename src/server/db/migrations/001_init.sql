-- Pitstop – Grundschema. Angewendete Migrationen nie ändern; Korrekturen als neue Datei.
-- Geld in Cent (integer), Kalenderdaten als date, Zeitpunkte als timestamptz.

CREATE SEQUENCE personnel_number_seq START 1;
CREATE SEQUENCE customer_number_seq START 10001;
CREATE SEQUENCE invoice_number_seq START 1001;

CREATE TABLE employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_number text NOT NULL UNIQUE DEFAULT ('P-' || lpad(nextval('personnel_number_seq')::text, 3, '0')),
  first_name text NOT NULL,
  last_name text NOT NULL,
  job_title text NOT NULL DEFAULT '',
  department text NOT NULL CHECK (department IN ('management', 'office', 'service', 'installation', 'planning', 'warehouse')),
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  hourly_rate_cents integer NOT NULL DEFAULT 0 CHECK (hourly_rate_cents >= 0),
  contract_type text NOT NULL DEFAULT 'full_time' CHECK (contract_type IN ('full_time', 'part_time', 'apprentice', 'minijob')),
  weekly_hours numeric(5,2) NOT NULL DEFAULT 40 CHECK (weekly_hours >= 0 AND weekly_hours <= 60),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  probation_end_date date,
  fixed_term_end_date date,
  manager_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  vacation_days_per_year numeric(4,1) NOT NULL DEFAULT 30 CHECK (vacation_days_per_year >= 0),
  carry_over_days numeric(4,1) NOT NULL DEFAULT 0 CHECK (carry_over_days >= 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE CHECK (email = lower(email)),
  display_name text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'employee')),
  employee_id uuid UNIQUE REFERENCES employees(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT true,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE sessions (
  token_hash text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remember boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE DEFAULT nextval('customer_number_seq'),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('private', 'business', 'property_mgmt', 'public')),
  status text NOT NULL CHECK (status IN ('active', 'lead', 'inactive')),
  street text NOT NULL DEFAULT '',
  zip text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  vat_id text NOT NULL DEFAULT '',
  payment_term_days integer NOT NULL DEFAULT 14 CHECK (payment_term_days BETWEEN 0 AND 120),
  owner_employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at date NOT NULL DEFAULT CURRENT_DATE
);
CREATE INDEX customers_owner_idx ON customers(owner_employee_id);

CREATE TABLE contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name text NOT NULL,
  position text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  is_primary boolean NOT NULL DEFAULT false
);
CREATE INDEX contacts_customer_idx ON contacts(customer_id);

CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('note', 'call', 'email', 'meeting', 'system')),
  text text NOT NULL,
  author_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  author_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notes_customer_idx ON notes(customer_id, created_at DESC);

CREATE TABLE invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  number integer NOT NULL UNIQUE DEFAULT nextval('invoice_number_seq'),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  issue_date date NOT NULL,
  due_date date NOT NULL,
  vat_rate smallint NOT NULL DEFAULT 19 CHECK (vat_rate IN (0, 7, 19)),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid')),
  paid_at date,
  dunning_level smallint NOT NULL DEFAULT 0 CHECK (dunning_level BETWEEN 0 AND 3),
  last_reminded_at date,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (due_date >= issue_date)
);
CREATE INDEX invoices_customer_idx ON invoices(customer_id);
CREATE INDEX invoices_status_due_idx ON invoices(status, due_date);

CREATE TABLE invoice_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL CHECK (quantity > 0),
  unit text NOT NULL CHECK (unit IN ('hours', 'piece', 'meter', 'flat')),
  unit_price_cents integer NOT NULL CHECK (unit_price_cents >= 0)
);
CREATE INDEX invoice_items_invoice_idx ON invoice_items(invoice_id, position);

CREATE TABLE expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  supplier text NOT NULL,
  category text NOT NULL CHECK (category IN ('material', 'vehicles', 'rent', 'payroll', 'tools', 'insurance', 'office', 'other')),
  description text NOT NULL DEFAULT '',
  net_cents integer NOT NULL CHECK (net_cents >= 0),
  vat_rate smallint NOT NULL DEFAULT 19 CHECK (vat_rate IN (0, 7, 19)),
  paid boolean NOT NULL DEFAULT true,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_date_idx ON expenses(date);

CREATE TABLE absences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('vacation', 'sick')),
  from_date date NOT NULL,
  to_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('requested', 'approved', 'rejected')),
  comment text NOT NULL DEFAULT '',
  decision_note text NOT NULL DEFAULT '',
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz,
  decided_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  decided_by_name text NOT NULL DEFAULT '',
  seen_by_requester boolean NOT NULL DEFAULT false,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  CHECK (to_date >= from_date)
);
CREATE INDEX absences_employee_idx ON absences(employee_id, from_date);

CREATE TABLE timesheets (
  employee_id uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  month char(7) NOT NULL CHECK (month ~ '^\d{4}-\d{2}$'),
  target_hours numeric(6,2) NOT NULL CHECK (target_hours >= 0),
  worked_hours numeric(6,2) NOT NULL CHECK (worked_hours >= 0),
  PRIMARY KEY (employee_id, month)
);

CREATE TABLE tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  due_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
