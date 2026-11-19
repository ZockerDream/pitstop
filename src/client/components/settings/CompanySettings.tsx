import { useState, type FormEvent } from 'react';
import type { CompanySettings as Company } from '../../../shared/types';
import { errorMessage, fieldErrors } from '../../lib/api';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { Field, Input, Textarea } from '../ui/Field';

export function CompanySettings() {
  const data = useData();
  const actions = useActions();
  const [form, setForm] = useState({ ...data.company, paymentTermDays: String(data.company.paymentTermDays) });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const dirty = JSON.stringify({ ...data.company, paymentTermDays: String(data.company.paymentTermDays) }) !== JSON.stringify(form);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const term = Number(form.paymentTermDays);
    if (!Number.isInteger(term) || term < 0 || term > 120) {
      setErrors({ paymentTermDays: '0 bis 120 Tage' });
      return;
    }
    setBusy(true);
    setErrors({});
    setError(null);
    try {
      const trimmed = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])) as Record<string, string>;
      await actions.saveCompany({ ...(trimmed as unknown as Company), paymentTermDays: term });
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const text = (key: keyof typeof form, label: string, opts: { span?: string; placeholder?: string; type?: string } = {}) => (
    <Field label={label} error={errors[key]} className={opts.span}>
      {(id, invalid) => <Input id={id} type={opts.type ?? 'text'} value={form[key]} onChange={set(key)} invalid={invalid} placeholder={opts.placeholder} />}
    </Field>
  );

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader title="Firmendaten" description="Erscheinen in der Seitenleiste und im Rechnungskopf. Das Logo kommt aus conf/logo.svg bzw. conf/logo.png (siehe README)." />
        <div className="grid gap-4 p-5 sm:grid-cols-6">
          {text('name', 'Firmenname', { span: 'sm:col-span-6', placeholder: 'z. B. Muster Kfz-Service GmbH' })}
          {text('street', 'Straße und Hausnummer', { span: 'sm:col-span-6' })}
          {text('zip', 'PLZ', { span: 'sm:col-span-2' })}
          {text('city', 'Ort', { span: 'sm:col-span-4' })}
          {text('phone', 'Telefon', { span: 'sm:col-span-3' })}
          {text('email', 'E-Mail', { span: 'sm:col-span-3', type: 'email' })}
          {text('website', 'Website', { span: 'sm:col-span-3' })}
          {text('vatId', 'USt-IdNr.', { span: 'sm:col-span-3', placeholder: 'DE…' })}
          {text('taxNumber', 'Steuernummer', { span: 'sm:col-span-3' })}
          {text('paymentTermDays', 'Standard-Zahlungsziel (Tage)', { span: 'sm:col-span-3', type: 'number' })}
          {text('bankName', 'Bank', { span: 'sm:col-span-6' })}
          {text('iban', 'IBAN', { span: 'sm:col-span-4' })}
          {text('bic', 'BIC', { span: 'sm:col-span-2' })}
          <Field label="Fußtext für Rechnungen" error={errors.invoiceFooter} className="sm:col-span-6" hint="z. B. Geschäftsführung, Handelsregister">
            {(id) => <Textarea id={id} rows={2} value={form.invoiceFooter} onChange={set('invoiceFooter')} maxLength={500} />}
          </Field>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-zinc-100 px-5 py-3">
          {error && <span className="mr-auto text-sm text-rose-700">{error}</span>}
          {dirty && <span className="text-xs text-zinc-500">Ungespeicherte Änderungen</span>}
          <Button type="submit" variant="primary" loading={busy} disabled={!dirty}>
            Speichern
          </Button>
        </div>
      </Card>
      <Card className="h-fit">
        <CardHeader title="Vorschau Briefkopf" />
        <div className="p-5 text-sm">
          <div className="font-semibold text-zinc-900">{form.name || 'Firmenname'}</div>
          <div className="mt-1 text-xs leading-relaxed text-zinc-500">
            {[form.street, `${form.zip} ${form.city}`.trim()].filter(Boolean).join(' · ') || 'Anschrift'}
            {form.phone && <div>Tel. {form.phone}</div>}
            {form.email && <div>{form.email}</div>}
          </div>
          <div className="mt-4 border-t border-zinc-100 pt-3 text-[11px] leading-relaxed text-zinc-400">
            {[form.name, form.vatId && `USt-IdNr. ${form.vatId}`, form.iban && `IBAN ${form.iban}`].filter(Boolean).join(' · ')}
            {form.invoiceFooter && <div>{form.invoiceFooter}</div>}
          </div>
        </div>
      </Card>
    </form>
  );
}
