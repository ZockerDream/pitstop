import type { CompanySettings } from '../../shared/types';
import type { Queryable } from '../db/pool';

export const EMPTY_COMPANY: CompanySettings = {
  name: '',
  street: '',
  zip: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  vatId: '',
  taxNumber: '',
  bankName: '',
  iban: '',
  bic: '',
  paymentTermDays: 14,
  invoiceFooter: '',
};

export async function getCompany(q: Queryable): Promise<CompanySettings> {
  const { rows } = await q.query<{ value: Partial<CompanySettings> }>(`SELECT value FROM settings WHERE key = 'company'`);
  return { ...EMPTY_COMPANY, ...(rows[0]?.value ?? {}) };
}

export async function setCompany(q: Queryable, company: CompanySettings): Promise<CompanySettings> {
  await q.query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('company', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [JSON.stringify(company)],
  );
  return company;
}
