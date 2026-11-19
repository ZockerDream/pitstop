import { z } from 'zod';

// Deutsche Standardmeldungen; wichtige Felder haben eigene Meldungen in den Schemas.
z.config(z.locales.de());

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Abbruch beim Start mit klarer Meldung (kein Stacktrace für den Betreiber). */
export class FatalError extends Error {}

export const badRequest = (message: string, fields?: Record<string, string>) => new HttpError(400, 'VALIDATION', message, fields);
export const unauthorized = () => new HttpError(401, 'UNAUTHENTICATED', 'Bitte anmelden.');
export const forbidden = (message = 'Dafür fehlt die Berechtigung.') => new HttpError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Nicht gefunden.') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (message: string) => new HttpError(409, 'CONFLICT', message);

export function parseBody<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data ?? {});
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_';
    if (!fields[key]) fields[key] = issue.message;
  }
  throw badRequest('Bitte die markierten Angaben prüfen.', fields);
}

// Wiederverwendbare Schema-Bausteine mit deutschen Meldungen
export const zText = (max = 500) => z.string({ message: 'Text erwartet' }).trim().max(max, `Höchstens ${max} Zeichen`);
export const zRequired = (max = 200) => zText(max).min(1, 'Pflichtfeld');
export const zDate = z.string({ message: 'Datum fehlt' }).regex(/^\d{4}-\d{2}-\d{2}$/, 'Ungültiges Datum');
export const zOptionalDate = zDate.nullable();
export const zId = z.uuid({ message: 'Ungültige ID' });
export const zOptionalEmail = z.union([z.literal(''), z.email({ message: 'Ungültige E-Mail-Adresse' })]);
export const zCents = z.number({ message: 'Betrag fehlt' }).int().min(0, 'Darf nicht negativ sein').max(2_000_000_000, 'Betrag zu groß');
