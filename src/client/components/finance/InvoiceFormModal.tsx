import { useMemo, useState, type FormEvent } from 'react';
import { addDays, isValidISODate, today as getToday } from '../../../shared/dates';
import { customerNumberLabel, formatDate, formatEuro, formatNumber } from '../../../shared/format';
import { customerStatusLabel } from '../../../shared/labels';
import { totalsFor } from '../../../shared/money';
import { vehicleLabel } from '../../../shared/selectors';
import { errorMessage, fieldErrors } from '../../lib/api';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Combobox } from '../ui/Combobox';
import { Field, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { itemErrors, LineItemsEditor, newItem, parseItem, type ItemDraft } from './LineItemsEditor';

const VAT_RATE = 19;

export function InvoiceFormModal({ customerId, vehicleId, onClose }: { customerId?: string; vehicleId?: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const today = getToday();
  const preselected = customerId ? data.customers.find((c) => c.id === customerId && c.status !== 'inactive') : undefined;
  const [customer, setCustomer] = useState<string | null>(preselected?.id ?? null);
  const [issueDate, setIssueDate] = useState(today);
  const [term, setTerm] = useState(String(preselected?.paymentTermDays ?? (data.company.paymentTermDays || 14)));
  const initialVehicle = vehicleId ? data.vehicles.find((v) => v.id === vehicleId && v.customerId === preselected?.id) : undefined;
  const [vehicle, setVehicle] = useState<string>(initialVehicle?.id ?? '');
  const [mileage, setMileage] = useState(initialVehicle?.mileage != null ? String(initialVehicle.mileage) : '');
  const [items, setItems] = useState<ItemDraft[]>([newItem()]);
  const [showErrors, setShowErrors] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const options = useMemo(
    () =>
      data.customers
        .filter((c) => c.status !== 'inactive')
        .sort((a, b) => a.name.localeCompare(b.name, 'de'))
        .map((c) => ({ value: c.id, label: c.name, description: `${customerNumberLabel(c.number)} · ${c.zip} ${c.city} · ${customerStatusLabel[c.status]}` })),
    [data.customers],
  );

  const parsed = items.map(parseItem);
  const valid = parsed.every((p) => Object.values(itemErrors(p)).every((e) => !e));
  const totals = totalsFor(
    parsed.map((p) => ({ quantity: p.quantity ?? 0, unitPriceCents: p.unitPriceCents ?? 0 })),
    VAT_RATE,
  );
  const termDays = Number(term);
  const termValid = Number.isInteger(termDays) && termDays >= 0 && termDays <= 120;
  const dateValid = isValidISODate(issueDate);
  const dueDate = dateValid && termValid ? addDays(issueDate, termDays) : null;
  const customerVehicles = customer ? data.vehicles.filter((v) => v.customerId === customer).sort((a, b) => a.plate.localeCompare(b.plate)) : [];
  const selectedVehicle = customerVehicles.find((v) => v.id === vehicle);
  const mileageValue = mileage.trim() ? Number(mileage.replace(/\./g, '')) : null;
  const mileageValid = mileageValue === null || (Number.isInteger(mileageValue) && mileageValue >= 0);
  const mileageLower = selectedVehicle?.mileage != null && mileageValue !== null && mileageValue < selectedVehicle.mileage;
  const canSave = Boolean(customer) && valid && termValid && dateValid && mileageValid && totals.gross > 0;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setShowErrors(true);
    if (!canSave || !customer) return;
    setBusy(true);
    setError(null);
    try {
      await actions.createInvoice({
        customerId: customer,
        vehicleId: vehicle || null,
        mileage: vehicle ? mileageValue : null,
        issueDate,
        paymentTermDays: termDays,
        items: parsed.map((p) => ({ description: p.description, quantity: p.quantity!, unit: p.unit, unitPriceCents: p.unitPriceCents! })),
      });
      onClose();
    } catch (err) {
      setServerErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Neue Rechnung"
      description="Kunde wählen, Positionen erfassen – Netto, 19 % MwSt. und Brutto werden automatisch berechnet."
      size="xl"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <>
          {showErrors && !canSave && <span className="mr-auto text-xs text-rose-600">Bitte Kunde und alle Positionen vollständig ausfüllen.</span>}
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="invoice-form" loading={busy} disabled={showErrors && !canSave}>
            Rechnung erstellen
          </Button>
        </>
      }
    >
      <form id="invoice-form" onSubmit={submit} noValidate className="space-y-6">
        <div className="grid gap-4 md:grid-cols-12">
          <Field label="Kunde" required error={(showErrors && !customer ? 'Bitte einen Kunden wählen' : undefined) ?? serverErrors.customerId} className="md:col-span-6">
            {(id, invalid) => (
              <Combobox
                id={id}
                autoFocus={!preselected}
                options={options}
                value={customer}
                invalid={invalid}
                placeholder="Kunde suchen …"
                onChange={(value) => {
                  setCustomer(value);
                  const c = data.customers.find((x) => x.id === value);
                  if (c) setTerm(String(c.paymentTermDays));
                  const own = data.vehicles.filter((v) => v.customerId === value);
                  const only = own.length === 1 ? own[0] : undefined;
                  setVehicle(only?.id ?? '');
                  setMileage(only?.mileage != null ? String(only.mileage) : '');
                }}
              />
            )}
          </Field>
          <Field label="Rechnungsdatum" required error={!dateValid ? 'Ungültiges Datum' : serverErrors.issueDate} className="md:col-span-3">
            {(id, invalid) => <Input id={id} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} invalid={invalid} />}
          </Field>
          <Field
            label="Zahlungsziel (Tage)"
            error={!termValid ? '0 bis 120 Tage' : serverErrors.paymentTermDays}
            hint={dueDate ? `fällig am ${formatDate(dueDate)}` : undefined}
            className="md:col-span-3"
          >
            {(id, invalid) => <Input id={id} type="number" min={0} max={120} value={term} onChange={(e) => setTerm(e.target.value)} invalid={invalid} />}
          </Field>
        </div>

        {customer && (
          <div className="grid gap-4 md:grid-cols-12">
            <Field label="Fahrzeug" error={serverErrors.vehicleId} hint={customerVehicles.length ? undefined : 'Für diesen Kunden ist kein Fahrzeug erfasst.'} className="md:col-span-6">
              {(id, invalid) => (
                <Select
                  id={id}
                  value={vehicle}
                  invalid={invalid}
                  disabled={!customerVehicles.length}
                  onChange={(e) => {
                    setVehicle(e.target.value);
                    const v = customerVehicles.find((x) => x.id === e.target.value);
                    setMileage(v?.mileage != null ? String(v.mileage) : '');
                  }}
                >
                  <option value="">– ohne Fahrzeug –</option>
                  {customerVehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.plate} · {vehicleLabel(v)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            {vehicle && (
              <Field
                label="km-Stand bei Auftrag"
                error={!mileageValid ? 'Ganze Kilometer' : serverErrors.mileage}
                hint={mileageLower ? `Niedriger als zuletzt erfasst (${formatNumber(selectedVehicle!.mileage!)} km)` : 'Wird am Fahrzeug fortgeschrieben.'}
                className="md:col-span-3"
              >
                {(id, invalid) => <Input id={id} inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value)} invalid={invalid} className="text-right tabular-nums" />}
              </Field>
            )}
          </div>
        )}

        <div>
          <h3 className="mb-2 text-[13px] font-medium text-zinc-700">Positionen</h3>
          <LineItemsEditor items={items} onChange={setItems} showErrors={showErrors} serverErrors={serverErrors} />
        </div>

        <div className="flex justify-end">
          <dl className="w-72 space-y-1.5 rounded-lg bg-zinc-50 px-4 py-3 text-sm tabular-nums">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Netto</dt>
              <dd>{formatEuro(totals.net)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">zzgl. {VAT_RATE} % MwSt.</dt>
              <dd>{formatEuro(totals.vat)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-200 pt-1.5 text-base font-semibold text-zinc-900">
              <dt>Brutto</dt>
              <dd>{formatEuro(totals.gross)}</dd>
            </div>
          </dl>
        </div>
        {error && Object.keys(serverErrors).length === 0 && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Modal>
  );
}
