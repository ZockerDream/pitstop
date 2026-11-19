import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generatePassword, hashPassword } from '../auth/password';
import { deleteUserSessions } from '../auth/sessions';
import { requirePermission } from '../auth/guards';
import { db } from '../db/pool';
import { badRequest, conflict, notFound, parseBody, zId, zOptionalEmail, zRequired, zText } from '../errors';
import { getEmployee } from '../repo/employees';
import { getCompany, setCompany } from '../repo/settings';
import { countActiveAdmins, getUser, insertUser, listUsers, setPassword, updateUser } from '../repo/users';
import { idParam, type RouteOptions } from './util';

const companySchema = z.object({
  name: zText(200).default(''),
  street: zText(200).default(''),
  zip: zText(10).default(''),
  city: zText(100).default(''),
  phone: zText(50).default(''),
  email: zOptionalEmail.default(''),
  website: zText(200).default(''),
  vatId: zText(30).default(''),
  taxNumber: zText(30).default(''),
  bankName: zText(100).default(''),
  iban: zText(40).default(''),
  bic: zText(15).default(''),
  paymentTermDays: z.number({ message: 'Zahl erwartet' }).int().min(0).max(120, 'Höchstens 120 Tage'),
  invoiceFooter: zText(500).default(''),
});

const userCreateSchema = z.object({
  email: z.email({ message: 'Ungültige E-Mail-Adresse' }).max(200),
  displayName: zRequired(100),
  role: z.enum(['admin', 'employee'], { message: 'Bitte Rolle wählen' }),
  employeeId: zId.nullable().default(null),
});
const userPatchSchema = z.object({
  displayName: zRequired(100).optional(),
  role: z.enum(['admin', 'employee']).optional(),
  active: z.boolean().optional(),
  employeeId: zId.nullable().optional(),
});

export async function adminRoutes(app: FastifyInstance, _opts: RouteOptions): Promise<void> {
  app.get('/settings/company', async (req) => {
    requirePermission(req, 'settings:manage');
    return { company: await getCompany(db()) };
  });

  app.put('/settings/company', async (req) => {
    requirePermission(req, 'settings:manage');
    const input = parseBody(companySchema, req.body);
    return { company: await setCompany(db(), input) };
  });

  app.get('/users', async (req) => {
    requirePermission(req, 'users:manage');
    return { users: await listUsers(db()) };
  });

  app.post('/users', async (req) => {
    requirePermission(req, 'users:manage');
    const input = parseBody(userCreateSchema, req.body);
    if (input.role === 'employee' && !input.employeeId) {
      throw badRequest('Bitte die markierten Angaben prüfen.', { employeeId: 'Für die Rolle Mitarbeiter einen Mitarbeiter wählen' });
    }
    if (input.employeeId) {
      if (!(await getEmployee(db(), input.employeeId))) throw badRequest('Bitte die markierten Angaben prüfen.', { employeeId: 'Mitarbeiter nicht gefunden' });
      const linked = await db().query('SELECT 1 FROM users WHERE employee_id = $1', [input.employeeId]);
      if (linked.rowCount) throw badRequest('Bitte die markierten Angaben prüfen.', { employeeId: 'Für diesen Mitarbeiter gibt es schon einen Zugang' });
    }
    const exists = await db().query('SELECT 1 FROM users WHERE email = lower($1)', [input.email]);
    if (exists.rowCount) throw badRequest('Bitte die markierten Angaben prüfen.', { email: 'Diese E-Mail-Adresse wird schon verwendet' });
    const password = generatePassword();
    const user = await insertUser(db(), { ...input, passwordHash: await hashPassword(password), mustChangePassword: true });
    return { user, password };
  });

  app.patch('/users/:id', async (req) => {
    const me = requirePermission(req, 'users:manage');
    const id = idParam(req);
    const patch = parseBody(userPatchSchema, req.body);
    const target = await getUser(db(), id);
    if (!target) throw notFound('Benutzer nicht gefunden.');
    if (id === me.id && patch.active === false) throw conflict('Du kannst dich nicht selbst sperren.');
    const losesAdmin = target.role === 'admin' && target.active && (patch.role === 'employee' || patch.active === false);
    if (losesAdmin && (await countActiveAdmins(db(), id)) === 0) {
      throw conflict('Der letzte aktive Admin kann weder gesperrt noch zum Mitarbeiter gemacht werden.');
    }
    const role = patch.role ?? target.role;
    const employeeId = patch.employeeId !== undefined ? patch.employeeId : target.employeeId;
    if (role === 'employee' && !employeeId) {
      throw badRequest('Bitte die markierten Angaben prüfen.', { employeeId: 'Für die Rolle Mitarbeiter einen Mitarbeiter wählen' });
    }
    if (patch.employeeId) {
      const linked = await db().query('SELECT 1 FROM users WHERE employee_id = $1 AND id <> $2', [patch.employeeId, id]);
      if (linked.rowCount) throw badRequest('Bitte die markierten Angaben prüfen.', { employeeId: 'Für diesen Mitarbeiter gibt es schon einen Zugang' });
    }
    const user = await updateUser(db(), id, patch);
    if (patch.active === false) await deleteUserSessions(id);
    return { user };
  });

  app.post('/users/:id/reset-password', async (req) => {
    requirePermission(req, 'users:manage');
    const id = idParam(req);
    if (!(await getUser(db(), id))) throw notFound('Benutzer nicht gefunden.');
    const password = generatePassword();
    const user = await setPassword(db(), id, await hashPassword(password), true);
    await deleteUserSessions(id);
    return { user, password };
  });
}
