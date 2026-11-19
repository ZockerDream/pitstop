import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { customerStatusLabel } from '../../shared/labels';
import { CUSTOMER_KINDS, CUSTOMER_STATUSES, FUEL_TYPES } from '../../shared/types';
import { requirePermission, requireUser } from '../auth/guards';
import { db, tx } from '../db/pool';
import { notFound, parseBody, zId, zOptionalDate, zOptionalEmail, zRequired, zText } from '../errors';
import { getCustomer, insertContact, insertCustomer, insertNote, updateCustomer } from '../repo/customers';
import { getEmployee } from '../repo/employees';
import { getVehicle, insertVehicle, updateVehicle } from '../repo/vehicles';
import { idParam, type RouteOptions } from './util';

const contactSchema = z.object({
  name: zRequired(150),
  position: zText(100).default(''),
  phone: zText(50).default(''),
  email: zOptionalEmail.default(''),
  isPrimary: z.boolean().default(false),
});

const customerFields = {
  name: zRequired(200),
  kind: z.enum(CUSTOMER_KINDS, { message: 'Bitte Kundenart wählen' }),
  status: z.enum(CUSTOMER_STATUSES, { message: 'Bitte Status wählen' }),
  street: zText(200).default(''),
  zip: zRequired(10),
  city: zRequired(100),
  phone: zText(50).default(''),
  email: zOptionalEmail.default(''),
  vatId: zText(30).default(''),
  paymentTermDays: z.number({ message: 'Zahl erwartet' }).int().min(0, 'Mindestens 0 Tage').max(120, 'Höchstens 120 Tage'),
  ownerEmployeeId: zId.nullable().default(null),
  tags: z.array(zText(40)).max(10).default([]),
};
const createSchema = z.object({ ...customerFields, contact: contactSchema.optional() });
const patchSchema = z.object(customerFields).partial();
const vehicleFields = {
  plate: zRequired(15).transform((v) => v.toUpperCase().replace(/\s+/g, ' ')),
  make: zRequired(60),
  model: zRequired(80),
  variant: zText(80).default(''),
  vin: zText(17)
    .default('')
    .transform((v) => v.toUpperCase().replace(/\s/g, ''))
    .refine((v) => v === '' || /^[A-HJ-NPR-Z0-9]{17}$/.test(v), 'FIN hat 17 Zeichen (ohne I, O, Q)'),
  firstRegistration: zOptionalDate.default(null),
  mileage: z.number({ message: 'Zahl erwartet' }).int().min(0).max(3_000_000).nullable().default(null),
  nextInspection: zOptionalDate.default(null),
  fuel: z.enum(FUEL_TYPES, { message: 'Bitte Kraftstoff wählen' }).default('petrol'),
  powerKw: z.number({ message: 'Zahl erwartet' }).int().min(1).max(2000).nullable().default(null),
  notes: zText(1000).default(''),
};
const vehicleSchema = z.object(vehicleFields);
const vehiclePatchSchema = z.object(vehicleFields).partial();

const noteSchema = z.object({
  kind: z.enum(['note', 'call', 'email', 'meeting'], { message: 'Bitte Art wählen' }),
  text: zRequired(4000),
});

export async function customerRoutes(app: FastifyInstance, _opts: RouteOptions): Promise<void> {
  app.post('/customers', async (req) => {
    requirePermission(req, 'customer:edit');
    const { contact, ...input } = parseBody(createSchema, req.body);
    if (input.ownerEmployeeId && !(await getEmployee(db(), input.ownerEmployeeId))) throw notFound('Mitarbeiter nicht gefunden.');
    return tx(async (c) => {
      const customer = await insertCustomer(c, input);
      const contacts = contact ? await insertContact(c, customer.id, { ...contact, isPrimary: true }) : [];
      return { customer, contacts };
    });
  });

  app.patch('/customers/:id', async (req) => {
    const user = requirePermission(req, 'customer:edit');
    const id = idParam(req);
    const patch = parseBody(patchSchema, req.body);
    return tx(async (c) => {
      const before = await getCustomer(c, id);
      if (!before) throw notFound('Kunde nicht gefunden.');
      const customer = await updateCustomer(c, id, patch);
      let note = null;
      if (patch.status && patch.status !== before.status) {
        note = await insertNote(c, {
          customerId: id,
          kind: 'system',
          text: `Status geändert: ${customerStatusLabel[before.status]} → ${customerStatusLabel[patch.status]}`,
          authorUserId: user.id,
          authorName: user.displayName,
        });
      }
      return { customer, note };
    });
  });

  app.post('/customers/:id/contacts', async (req) => {
    requirePermission(req, 'customer:edit');
    const id = idParam(req);
    const input = parseBody(contactSchema, req.body);
    if (!(await getCustomer(db(), id))) throw notFound('Kunde nicht gefunden.');
    const contacts = await tx((c) => insertContact(c, id, input));
    return { contacts };
  });

  app.post('/customers/:id/vehicles', async (req) => {
    requirePermission(req, 'customer:edit');
    const id = idParam(req);
    const input = parseBody(vehicleSchema, req.body);
    if (!(await getCustomer(db(), id))) throw notFound('Kunde nicht gefunden.');
    return { vehicle: await insertVehicle(db(), id, input) };
  });

  app.patch('/vehicles/:id', async (req) => {
    requirePermission(req, 'customer:edit');
    const id = idParam(req);
    const patch = parseBody(vehiclePatchSchema, req.body);
    if (!(await getVehicle(db(), id))) throw notFound('Fahrzeug nicht gefunden.');
    return { vehicle: await updateVehicle(db(), id, patch) };
  });

  app.post('/customers/:id/notes', async (req) => {
    const user = requireUser(req);
    const id = idParam(req);
    const input = parseBody(noteSchema, req.body);
    if (!(await getCustomer(db(), id))) throw notFound('Kunde nicht gefunden.');
    const note = await insertNote(db(), { customerId: id, kind: input.kind, text: input.text, authorUserId: user.id, authorName: user.displayName });
    return { note };
  });
}
