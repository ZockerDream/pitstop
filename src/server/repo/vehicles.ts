import type { Vehicle, VehicleInput } from '../../shared/types';
import type { Queryable } from '../db/pool';
import { updateColumns } from './sql';

const VEHICLE_COLS = `id, customer_id AS "customerId", plate, make, model, variant, vin, first_registration AS "firstRegistration",
  mileage, next_inspection AS "nextInspection", fuel, power_kw AS "powerKw", notes, created_at AS "createdAt"`;
const VEHICLE_FIELDS: Record<keyof VehicleInput, string> = {
  plate: 'plate',
  make: 'make',
  model: 'model',
  variant: 'variant',
  vin: 'vin',
  firstRegistration: 'first_registration',
  mileage: 'mileage',
  nextInspection: 'next_inspection',
  fuel: 'fuel',
  powerKw: 'power_kw',
  notes: 'notes',
};

export async function listVehicles(q: Queryable): Promise<Vehicle[]> {
  const { rows } = await q.query<Vehicle>(`SELECT ${VEHICLE_COLS} FROM vehicles ORDER BY plate`);
  return rows;
}

export async function getVehicle(q: Queryable, id: string): Promise<Vehicle | null> {
  const { rows } = await q.query<Vehicle>(`SELECT ${VEHICLE_COLS} FROM vehicles WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function insertVehicle(q: Queryable, customerId: string, v: VehicleInput): Promise<Vehicle> {
  const fields = Object.keys(VEHICLE_FIELDS) as (keyof VehicleInput)[];
  const cols = ['customer_id', ...fields.map((f) => VEHICLE_FIELDS[f])];
  const values = [customerId, ...fields.map((f) => v[f])];
  const { rows } = await q.query<Vehicle>(
    `INSERT INTO vehicles (${cols.join(', ')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}) RETURNING ${VEHICLE_COLS}`,
    values,
  );
  return rows[0];
}

export function updateVehicle(q: Queryable, id: string, patch: Partial<VehicleInput>): Promise<Vehicle | null> {
  return updateColumns<Vehicle>(q, 'vehicles', id, patch, VEHICLE_FIELDS, VEHICLE_COLS);
}

/** Kilometerstand nur erhöhen (aus einer neuen Rechnung). Gibt das Fahrzeug zurück, wenn es sich geändert hat. */
export async function raiseMileage(q: Queryable, id: string, mileage: number): Promise<Vehicle | null> {
  const { rows } = await q.query<Vehicle>(
    `UPDATE vehicles SET mileage = $2 WHERE id = $1 AND (mileage IS NULL OR mileage < $2) RETURNING ${VEHICLE_COLS}`,
    [id, mileage],
  );
  return rows[0] ?? null;
}
