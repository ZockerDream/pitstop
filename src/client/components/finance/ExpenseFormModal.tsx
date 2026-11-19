import { useState, type FormEvent } from 'react';
import { isValidISODate, today as getToday } from '../../../shared/dates';
import { formatEuro } from '../../../shared/format';
import { expenseCategoryLabel } from '../../../shared/labels';
import { grossFromNet, parseEuroInput } from '../../../shared/money';
import { EXPENSE_CATEGORIES, VAT_RATES, type ExpenseCategory, type VatRate } from '../../../shared/types';
import { errorMessage, fieldErrors } from '../../lib/api';
import { navigate } from '../../lib/router';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function ExpenseFormModal({ onClose }: { onClose: () => void }) {
  const actions = useActions();
  const [form, setForm] = useState({ date: getToday(), supplier: '', category: 'material' as ExpenseCategory, description: '', net: '', vatRate: 19 as VatRate, paid: true });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const netCents = parseEuroInput(form.net);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!isValidISODate(form.date)) local.date = 'Ungültiges Datum';
    if (!form.supplier.trim()) local.supplier = 'Pflichtfeld';
    if (netCents === null || netCents <= 0) local.netCents = 'Betrag größer 0 angeben, z. B. 1.234,56';
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await actions.createExpense({
        date: form.date,
        supplier: form.supplier.trim(),
        category: form.category,
        description: form.description.trim(),
        netCents: netCents!,
        vatRate: form.vatRate,
        paid: form.paid,
      });
      onClose();
      navigate('/finanzen/ausgaben');
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Neue Ausgabe"
      size="md"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="expense-form" loading={busy}>
            Ausgabe erfassen
          </Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-2">
        <Field label="Belegdatum" required error={errors.date}>
          {(id, invalid) => <Input id={id} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} invalid={invalid} />}
        </Field>
        <Field label="Kategorie" required error={errors.category}>
          {(id) => (
            <Select id={id} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {expenseCategoryLabel[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Lieferant" required error={errors.supplier} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} autoFocus value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} invalid={invalid} />}
        </Field>
        <Field label="Beschreibung" error={errors.description} className="sm:col-span-2">
          {(id) => <Input id={id} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="z. B. Bremsscheiben Auftrag Brandstetter" />}
        </Field>
        <Field label="Betrag netto" required error={errors.netCents}>
          {(id, invalid) => (
            <div className="relative">
              <Input id={id} inputMode="decimal" placeholder="0,00" value={form.net} onChange={(e) => setForm({ ...form, net: e.target.value })} invalid={invalid} className="pr-7 text-right tabular-nums" />
              <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-xs text-zinc-400">€</span>
            </div>
          )}
        </Field>
        <Field label="MwSt.-Satz" error={errors.vatRate} hint={netCents ? `Brutto: ${formatEuro(grossFromNet(netCents, form.vatRate))}` : undefined}>
          {(id) => (
            <Select id={id} value={form.vatRate} onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) as VatRate })}>
              {VAT_RATES.map((r) => (
                <option key={r} value={r}>
                  {r} %
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="sm:col-span-2">
          <Checkbox label="Bereits bezahlt" checked={form.paid} onChange={(paid) => setForm({ ...form, paid })} />
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-2">{error}</p>}
      </form>
    </Modal>
  );
}
