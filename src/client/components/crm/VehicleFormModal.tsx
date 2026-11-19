import { useState, type FormEvent } from 'react';
import { isValidISODate } from '../../../shared/dates';
import { fuelLabel } from '../../../shared/labels';
import { FUEL_TYPES, type FuelType } from '../../../shared/types';
import { errorMessage, fieldErrors } from '../../lib/api';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Field, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

const VIN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function VehicleFormModal({ customerId, vehicleId, onClose }: { customerId: string; vehicleId?: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const customer = data.customers.find((c) => c.id === customerId);
  const existing = vehicleId ? data.vehicles.find((v) => v.id === vehicleId) : undefined;
  const [form, setForm] = useState({
    plate: existing?.plate ?? '',
    make: existing?.make ?? '',
    model: existing?.model ?? '',
    variant: existing?.variant ?? '',
    vin: existing?.vin ?? '',
    firstRegistration: existing?.firstRegistration ?? '',
    mileage: existing?.mileage != null ? String(existing.mileage) : '',
    nextInspection: existing?.nextInspection ?? '',
    fuel: (existing?.fuel ?? 'petrol') as FuelType,
    powerKw: existing?.powerKw != null ? String(existing.powerKw) : '',
    notes: existing?.notes ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    const vin = form.vin.toUpperCase().replace(/\s/g, '');
    const mileage = form.mileage.trim() ? Number(form.mileage.replace(/\./g, '')) : null;
    const powerKw = form.powerKw.trim() ? Number(form.powerKw) : null;
    if (!form.plate.trim()) local.plate = 'Pflichtfeld';
    if (!form.make.trim()) local.make = 'Pflichtfeld';
    if (!form.model.trim()) local.model = 'Pflichtfeld';
    if (vin && !VIN.test(vin)) local.vin = '17 Zeichen, ohne I, O, Q';
    if (form.firstRegistration && !isValidISODate(form.firstRegistration)) local.firstRegistration = 'Ungültiges Datum';
    if (form.nextInspection && !isValidISODate(form.nextInspection)) local.nextInspection = 'Ungültiges Datum';
    if (mileage !== null && (!Number.isInteger(mileage) || mileage < 0)) local.mileage = 'Ganze Kilometer, z. B. 84200';
    if (powerKw !== null && (!Number.isInteger(powerKw) || powerKw <= 0)) local.powerKw = 'Ganze Zahl in kW';
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    const input = {
      plate: form.plate.trim().toUpperCase(),
      make: form.make.trim(),
      model: form.model.trim(),
      variant: form.variant.trim(),
      vin,
      firstRegistration: form.firstRegistration || null,
      mileage,
      nextInspection: form.nextInspection || null,
      fuel: form.fuel,
      powerKw,
      notes: form.notes.trim(),
    };
    setBusy(true);
    try {
      if (existing) await actions.updateVehicle(existing.id, input);
      else await actions.addVehicle(customerId, input);
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={existing ? 'Fahrzeug bearbeiten' : 'Fahrzeug hinzufügen'}
      description={customer?.name}
      size="lg"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="vehicle-form" loading={busy}>
            {existing ? 'Speichern' : 'Fahrzeug anlegen'}
          </Button>
        </>
      }
    >
      <form id="vehicle-form" onSubmit={submit} noValidate className="grid gap-4 sm:grid-cols-6">
        <Field label="Kennzeichen" required error={errors.plate} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} autoFocus value={form.plate} onChange={set('plate')} invalid={invalid} placeholder="R-AB 123" className="uppercase" />}
        </Field>
        <Field label="Marke" required error={errors.make} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} value={form.make} onChange={set('make')} invalid={invalid} placeholder="z. B. VW" />}
        </Field>
        <Field label="Modell" required error={errors.model} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} value={form.model} onChange={set('model')} invalid={invalid} placeholder="z. B. Golf" />}
        </Field>
        <Field label="Variante / Motor" error={errors.variant} className="sm:col-span-3">
          {(id) => <Input id={id} value={form.variant} onChange={set('variant')} placeholder="z. B. GTI 2.0 TSI" />}
        </Field>
        <Field label="FIN" error={errors.vin} className="sm:col-span-3">
          {(id, invalid) => <Input id={id} value={form.vin} onChange={set('vin')} invalid={invalid} maxLength={17} className="font-mono uppercase" />}
        </Field>
        <Field label="Kraftstoff" error={errors.fuel} className="sm:col-span-2">
          {(id) => (
            <Select id={id} value={form.fuel} onChange={set('fuel')}>
              {FUEL_TYPES.map((f) => (
                <option key={f} value={f}>
                  {fuelLabel[f]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Leistung (kW)" error={errors.powerKw} hint={form.powerKw && Number(form.powerKw) > 0 ? `≈ ${Math.round(Number(form.powerKw) * 1.36)} PS` : undefined} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} inputMode="numeric" value={form.powerKw} onChange={set('powerKw')} invalid={invalid} />}
        </Field>
        <Field label="km-Stand" error={errors.mileage} className="sm:col-span-2">
          {(id, invalid) => <Input id={id} inputMode="numeric" value={form.mileage} onChange={set('mileage')} invalid={invalid} />}
        </Field>
        <Field label="Erstzulassung" error={errors.firstRegistration} className="sm:col-span-3">
          {(id, invalid) => <Input id={id} type="date" value={form.firstRegistration} onChange={set('firstRegistration')} invalid={invalid} />}
        </Field>
        <Field label="Nächste HU/AU" error={errors.nextInspection} className="sm:col-span-3">
          {(id, invalid) => <Input id={id} type="date" value={form.nextInspection} onChange={set('nextInspection')} invalid={invalid} />}
        </Field>
        <Field label="Notizen (Umbauten, Eintragungen, Besonderheiten)" error={errors.notes} className="sm:col-span-6">
          {(id) => <Textarea id={id} rows={2} value={form.notes} onChange={set('notes')} maxLength={1000} />}
        </Field>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:col-span-6">{error}</p>}
      </form>
    </Modal>
  );
}
