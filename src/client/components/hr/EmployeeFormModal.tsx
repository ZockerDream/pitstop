import { useState, type FormEvent } from 'react';
import { isValidISODate, today as getToday } from '../../../shared/dates';
import { contractTypeLabel, departmentLabel } from '../../../shared/labels';
import { centsToInput, decimalToInput, parseDecimalInput, parseEuroInput } from '../../../shared/money';
import { employeeName } from '../../../shared/selectors';
import { CONTRACT_TYPES, DEPARTMENTS, type ContractType, type Department } from '../../../shared/types';
import { errorMessage, fieldErrors } from '../../lib/api';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function EmployeeFormModal({ employeeId, onClose }: { employeeId?: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const existing = employeeId ? data.employees.find((e) => e.id === employeeId) : undefined;
  const [form, setForm] = useState({
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    jobTitle: existing?.jobTitle ?? '',
    department: (existing?.department ?? 'workshop') as Department,
    email: existing?.email ?? '',
    phone: existing?.phone ?? '',
    hourlyRate: existing?.hourlyRateCents != null ? centsToInput(existing.hourlyRateCents) : '',
    contractType: (existing?.contractType ?? 'full_time') as ContractType,
    weeklyHours: existing?.weeklyHours != null ? decimalToInput(existing.weeklyHours) : '40',
    entryDate: existing?.entryDate ?? getToday(),
    probationEndDate: existing?.probationEndDate ?? '',
    fixedTermEndDate: existing?.fixedTermEndDate ?? '',
    managerId: existing?.managerId ?? '',
    vacationDaysPerYear: existing?.vacationDaysPerYear != null ? decimalToInput(existing.vacationDaysPerYear) : '30',
    carryOverDays: existing?.carryOverDays != null ? decimalToInput(existing.carryOverDays) : '0',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const rate = parseEuroInput(form.hourlyRate);
    const hours = parseDecimalInput(form.weeklyHours);
    const vacation = parseDecimalInput(form.vacationDaysPerYear);
    const carry = parseDecimalInput(form.carryOverDays);
    const local: Record<string, string> = {};
    if (!form.firstName.trim()) local.firstName = 'Pflichtfeld';
    if (!form.lastName.trim()) local.lastName = 'Pflichtfeld';
    if (rate === null || rate < 0) local.hourlyRateCents = 'Betrag angeben, z. B. 26,00';
    if (hours === null || hours < 0 || hours > 60) local.weeklyHours = '0 bis 60';
    if (!isValidISODate(form.entryDate)) local.entryDate = 'Ungültiges Datum';
    if (form.probationEndDate && !isValidISODate(form.probationEndDate)) local.probationEndDate = 'Ungültiges Datum';
    if (form.fixedTermEndDate && !isValidISODate(form.fixedTermEndDate)) local.fixedTermEndDate = 'Ungültiges Datum';
    if (vacation === null || vacation < 0 || vacation > 60) local.vacationDaysPerYear = '0 bis 60';
    if (carry === null || carry < 0 || carry > 60) local.carryOverDays = '0 bis 60';
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    const input = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      jobTitle: form.jobTitle.trim(),
      department: form.department,
      email: form.email.trim(),
      phone: form.phone.trim(),
      hourlyRateCents: rate!,
      contractType: form.contractType,
      weeklyHours: hours!,
      entryDate: form.entryDate,
      probationEndDate: form.probationEndDate || null,
      fixedTermEndDate: form.fixedTermEndDate || null,
      managerId: form.managerId || null,
      vacationDaysPerYear: vacation!,
      carryOverDays: carry!,
      active: existing?.active ?? true,
    };
    setBusy(true);
    try {
      if (existing) await actions.updateEmployee(existing.id, input);
      else await actions.createEmployee(input);
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
      title={existing ? 'Personalakte bearbeiten' : 'Neuer Mitarbeiter'}
      description={existing ? `${employeeName(existing)} · ${existing.personnelNumber}` : 'Die Personalnummer wird automatisch vergeben.'}
      size="lg"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="employee-form" loading={busy}>
            {existing ? 'Speichern' : 'Mitarbeiter anlegen'}
          </Button>
        </>
      }
    >
      <form id="employee-form" onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Vorname" required error={errors.firstName}>
            {(id, invalid) => <Input id={id} autoFocus value={form.firstName} onChange={set('firstName')} invalid={invalid} />}
          </Field>
          <Field label="Nachname" required error={errors.lastName}>
            {(id, invalid) => <Input id={id} value={form.lastName} onChange={set('lastName')} invalid={invalid} />}
          </Field>
          <Field label="Rolle / Position" error={errors.jobTitle}>
            {(id) => <Input id={id} value={form.jobTitle} onChange={set('jobTitle')} placeholder="z. B. Kfz-Mechatroniker" />}
          </Field>
          <Field label="Abteilung" required error={errors.department}>
            {(id) => (
              <Select id={id} value={form.department} onChange={set('department')}>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {departmentLabel[d]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="E-Mail" error={errors.email}>
            {(id, invalid) => <Input id={id} type="email" value={form.email} onChange={set('email')} invalid={invalid} />}
          </Field>
          <Field label="Telefon" error={errors.phone}>
            {(id) => <Input id={id} value={form.phone} onChange={set('phone')} />}
          </Field>
        </div>
        <fieldset className="rounded-lg border border-zinc-200 p-4">
          <legend className="px-1 text-[13px] font-medium text-zinc-700">Vertrag</legend>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Vertragsart" required>
              {(id) => (
                <Select id={id} value={form.contractType} onChange={set('contractType')}>
                  {CONTRACT_TYPES.map((c) => (
                    <option key={c} value={c}>
                      {contractTypeLabel[c]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Wochenstunden" required error={errors.weeklyHours}>
              {(id, invalid) => <Input id={id} inputMode="decimal" value={form.weeklyHours} onChange={set('weeklyHours')} invalid={invalid} />}
            </Field>
            <Field label="Stundensatz (€)" required error={errors.hourlyRateCents}>
              {(id, invalid) => <Input id={id} inputMode="decimal" placeholder="0,00" value={form.hourlyRate} onChange={set('hourlyRate')} invalid={invalid} />}
            </Field>
            <Field label="Eintritt" required error={errors.entryDate}>
              {(id, invalid) => <Input id={id} type="date" value={form.entryDate} onChange={set('entryDate')} invalid={invalid} />}
            </Field>
            <Field label="Probezeit bis" error={errors.probationEndDate}>
              {(id, invalid) => <Input id={id} type="date" value={form.probationEndDate} onChange={set('probationEndDate')} invalid={invalid} />}
            </Field>
            <Field label="Befristet bis" error={errors.fixedTermEndDate} hint="leer = unbefristet">
              {(id, invalid) => <Input id={id} type="date" value={form.fixedTermEndDate} onChange={set('fixedTermEndDate')} invalid={invalid} />}
            </Field>
            <Field label="Urlaubstage pro Jahr" required error={errors.vacationDaysPerYear}>
              {(id, invalid) => <Input id={id} inputMode="decimal" value={form.vacationDaysPerYear} onChange={set('vacationDaysPerYear')} invalid={invalid} />}
            </Field>
            <Field label="Übertrag Vorjahr" error={errors.carryOverDays}>
              {(id, invalid) => <Input id={id} inputMode="decimal" value={form.carryOverDays} onChange={set('carryOverDays')} invalid={invalid} />}
            </Field>
            <Field label="Vorgesetzte(r)" error={errors.managerId}>
              {(id) => (
                <Select id={id} value={form.managerId} onChange={set('managerId')}>
                  <option value="">– keine –</option>
                  {data.employees
                    .filter((x) => x.active && x.id !== existing?.id)
                    .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
                    .map((x) => (
                      <option key={x.id} value={x.id}>
                        {employeeName(x)}
                      </option>
                    ))}
                </Select>
              )}
            </Field>
          </div>
        </fieldset>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Modal>
  );
}
