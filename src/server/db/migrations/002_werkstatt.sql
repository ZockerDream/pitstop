-- Pitstop als Kfz-Werkstatt & Tuning (CONCEPT.md E1):
-- Kundenart „Fuhrpark“, Werkstatt-Abteilungen, Einheit Liter, Fahrzeuge der Kunden, Fahrzeug und km-Stand an der Rechnung.

ALTER TABLE customers DROP CONSTRAINT customers_kind_check;
UPDATE customers SET kind = 'fleet' WHERE kind = 'property_mgmt';
ALTER TABLE customers ADD CONSTRAINT customers_kind_check CHECK (kind IN ('private', 'business', 'fleet', 'public'));

ALTER TABLE employees DROP CONSTRAINT employees_department_check;
UPDATE employees SET department = CASE department
  WHEN 'installation' THEN 'workshop'
  WHEN 'planning' THEN 'tuning'
  WHEN 'warehouse' THEN 'parts'
  ELSE department END;
ALTER TABLE employees ADD CONSTRAINT employees_department_check
  CHECK (department IN ('management', 'office', 'service', 'workshop', 'tuning', 'parts'));

ALTER TABLE invoice_items DROP CONSTRAINT invoice_items_unit_check;
ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_unit_check CHECK (unit IN ('hours', 'piece', 'liter', 'meter', 'flat'));

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  plate text NOT NULL,
  make text NOT NULL,
  model text NOT NULL,
  variant text NOT NULL DEFAULT '',
  vin text NOT NULL DEFAULT '',
  first_registration date,
  mileage integer CHECK (mileage >= 0),
  next_inspection date,
  fuel text NOT NULL DEFAULT 'petrol' CHECK (fuel IN ('petrol', 'diesel', 'electric', 'hybrid', 'lpg')),
  power_kw integer CHECK (power_kw > 0),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vehicles_customer_idx ON vehicles(customer_id);
CREATE INDEX vehicles_plate_idx ON vehicles(lower(plate));

ALTER TABLE invoices
  ADD COLUMN vehicle_id uuid REFERENCES vehicles(id) ON DELETE SET NULL,
  ADD COLUMN mileage integer CHECK (mileage >= 0);
CREATE INDEX invoices_vehicle_idx ON invoices(vehicle_id);
