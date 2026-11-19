import { useState, type FormEvent } from 'react';
import { lastMonths, today as getToday } from '../../../shared/dates';
import { formatMonthLong } from '../../../shared/format';
import { decimalToInput, parseDecimalInput } from '../../../shared/money';
import { defaultTargetHours, employeeName, timesheetFor } from '../../../shared/selectors';
import { errorMessage } from '../../lib/api';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function TimesheetModal({ employeeId, month, onClose }: { employeeId: string; month?: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const employee = data.employees.find((e) => e.id === employeeId);
  const months = lastMonths(getToday(), 12).reverse();
  const initialMonth = month ?? months[0];
  const prefill = (m: string) => {
    const t = timesheetFor(data.timesheets, employeeId, m);
    return {
      target: decimalToInput(t?.targetHours ?? defaultTargetHours(employee?.weeklyHours ?? 40, m)),
      worked: t ? decimalToInput(t.workedHours) : '',
    };
  };
  const [selected, setSelected] = useState(initialMonth);
  const [values, setValues] = useState(() => prefill(initialMonth));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const target = parseDecimalInput(values.target);
    const worked = parseDecimalInput(values.worked);
    const local: Record<string, string> = {};
    if (target === null || target < 0 || target > 400) local.target = '0 bis 400 Stunden';
    if (worked === null || worked < 0 || worked > 400) local.worked = '0 bis 400 Stunden';
    setErrors(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await actions.saveTimesheet(employeeId, selected, target!, worked!);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Stunden erfassen"
      description={employee ? `${employeeName(employee)} · ${employee.weeklyHours ?? '–'} Std./Woche` : undefined}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="timesheet-form" loading={busy}>
            Speichern
          </Button>
        </>
      }
    >
      <form id="timesheet-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Monat">
          {(id) => (
            <Select
              id={id}
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setValues(prefill(e.target.value));
              }}
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonthLong(m)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Soll (Std.)" error={errors.target} hint="Vorschlag: Wochenstunden × Arbeitstage / 5">
            {(id, invalid) => <Input id={id} inputMode="decimal" value={values.target} onChange={(e) => setValues({ ...values, target: e.target.value })} invalid={invalid} className="text-right tabular-nums" />}
          </Field>
          <Field label="Ist (Std.)" error={errors.worked}>
            {(id, invalid) => <Input id={id} autoFocus inputMode="decimal" value={values.worked} onChange={(e) => setValues({ ...values, worked: e.target.value })} invalid={invalid} className="text-right tabular-nums" />}
          </Field>
        </div>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Modal>
  );
}
