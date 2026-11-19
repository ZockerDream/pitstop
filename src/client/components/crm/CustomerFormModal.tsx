import { useState, type FormEvent } from 'react';
import { customerKindLabel, customerStatusLabel } from '../../../shared/labels';
import { employeeName } from '../../../shared/selectors';
import { CUSTOMER_KINDS, CUSTOMER_STATUSES, type CustomerKind, type CustomerStatus } from '../../../shared/types';
import { errorMessage, fieldErrors } from '../../lib/api';
import { navigate } from '../../lib/router';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';

/** Neuer Kunde bzw. Stammdaten bearbeiten. */
export function CustomerFormModal({ customerId, onClose }: { customerId?: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const existing = customerId ? data.customers.find((c) => c.id === customerId) : undefined;
  const [form, setForm] = useState({
    name: existing?.name ?? '',
    kind: (existing?.kind ?? 'private') as CustomerKind,
    status: (existing?.status ?? 'lead') as CustomerStatus,
    street: existing?.street ?? '',
    zip: existing?.zip ?? '',
    city: existing?.city ?? '',
    phone: existing?.phone ?? '',
    email: existing?.email ?? '',
    vatId: existing?.vatId ?? '',
    paymentTermDays: String(existing?.paymentTermDays ?? (data.company.paymentTermDays || 14)),
    ownerEmployeeId: existing?.ownerEmployeeId ?? '',
    tags: existing?.tags.join(', ') ?? '',
  });
  const [contact, setContact] = useState({ name: '', position: '', phone: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.name.trim()) local.name = 'Pflichtfeld';
    if (!form.zip.trim()) local.zip = 'Pflichtfeld';
    if (!form.city.trim()) local.city = 'Pflichtfeld';
    const term = Number(form.paymentTermDays);
    if (!Number.isInteger(term) || term < 0 || term > 120) local.paymentTermDays = '0 bis 120 Tage';
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    const input = {
      name: form.name.trim(),
      kind: form.kind,
      status: form.status,
      street: form.street.trim(),
      zip: form.zip.trim(),
      city: form.city.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      vatId: form.kind === 'private' ? '' : form.vatId.trim(),
      paymentTermDays: term,
      ownerEmployeeId: form.ownerEmployeeId || null,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    };
    setBusy(true);
    try {
      if (existing) {
        await actions.updateCustomer(existing.id, input);
        onClose();
      } else {
        const created = await actions.createCustomer(contact.name.trim() ? { ...input, contact: { ...contact, isPrimary: true } } : input);
        onClose();
        navigate(`/kunden/${created.id}`);
      }
    } catch (err) {
      setErrors(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={existing ? 'Kunde bearbeiten' : 'Neuer Kunde'}
      description={existing ? existing.name : 'Pflichtfelder: Name, Kundenart, Status, PLZ und Ort.'}
      size="lg"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="customer-form" loading={busy}>
            {existing ? 'Speichern' : 'Kunde anlegen'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Name" required error={errors.name} className="sm:col-span-6">
            {(id, invalid) => <Input id={id} autoFocus value={form.name} onChange={set('name')} invalid={invalid} placeholder="z. B. Familie Muster oder Muster GmbH" />}
          </Field>
          <Field label="Kundenart" required error={errors.kind} className="sm:col-span-3">
            {(id) => (
              <Select id={id} value={form.kind} onChange={set('kind')}>
                {CUSTOMER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {customerKindLabel[k]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status" required error={errors.status} className="sm:col-span-3">
            {(id) => (
              <Select id={id} value={form.status} onChange={set('status')}>
                {CUSTOMER_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {customerStatusLabel[s]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Straße und Hausnummer" error={errors.street} className="sm:col-span-6">
            {(id) => <Input id={id} value={form.street} onChange={set('street')} />}
          </Field>
          <Field label="PLZ" required error={errors.zip} className="sm:col-span-2">
            {(id, invalid) => <Input id={id} value={form.zip} onChange={set('zip')} invalid={invalid} inputMode="numeric" maxLength={10} />}
          </Field>
          <Field label="Ort" required error={errors.city} className="sm:col-span-4">
            {(id, invalid) => <Input id={id} value={form.city} onChange={set('city')} invalid={invalid} />}
          </Field>
          <Field label="Telefon" error={errors.phone} className="sm:col-span-3">
            {(id) => <Input id={id} value={form.phone} onChange={set('phone')} />}
          </Field>
          <Field label="E-Mail" error={errors.email} className="sm:col-span-3">
            {(id, invalid) => <Input id={id} type="email" value={form.email} onChange={set('email')} invalid={invalid} />}
          </Field>
          {form.kind !== 'private' && (
            <Field label="USt-IdNr." error={errors.vatId} className="sm:col-span-2">
              {(id) => <Input id={id} value={form.vatId} onChange={set('vatId')} placeholder="DE…" />}
            </Field>
          )}
          <Field label="Zahlungsziel (Tage)" error={errors.paymentTermDays} className="sm:col-span-2">
            {(id, invalid) => <Input id={id} type="number" min={0} max={120} value={form.paymentTermDays} onChange={set('paymentTermDays')} invalid={invalid} />}
          </Field>
          <Field label="Zuständig" error={errors.ownerEmployeeId} className={form.kind !== 'private' ? 'sm:col-span-2' : 'sm:col-span-4'}>
            {(id) => (
              <Select id={id} value={form.ownerEmployeeId} onChange={set('ownerEmployeeId')}>
                <option value="">– niemand –</option>
                {data.employees
                  .filter((e) => e.active)
                  .map((e) => (
                    <option key={e.id} value={e.id}>
                      {employeeName(e)}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Tags" hint="Mit Komma trennen, z. B. Tuning, Flottenvertrag" error={errors.tags} className="sm:col-span-6">
            {(id) => <Input id={id} value={form.tags} onChange={set('tags')} />}
          </Field>
        </div>
        {!existing && (
          <fieldset className="rounded-lg border border-zinc-200 p-4">
            <legend className="px-1 text-[13px] font-medium text-zinc-700">Erster Ansprechpartner (optional)</legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" error={errors['contact.name']}>
                {(id) => <Input id={id} value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} />}
              </Field>
              <Field label="Funktion">{(id) => <Input id={id} value={contact.position} onChange={(e) => setContact({ ...contact, position: e.target.value })} />}</Field>
              <Field label="Telefon">{(id) => <Input id={id} value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} />}</Field>
              <Field label="E-Mail" error={errors['contact.email']}>
                {(id, invalid) => <Input id={id} type="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} invalid={invalid} />}
              </Field>
            </div>
          </fieldset>
        )}
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Modal>
  );
}
