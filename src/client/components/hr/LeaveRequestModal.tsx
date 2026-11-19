import { TriangleAlert } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { addDays, isValidISODate, rangesOverlap, today as getToday, weekStart, workdaysBetween, yearOf } from '../../../shared/dates';
import { formatDays, formatRange } from '../../../shared/format';
import { employeeName, vacationBalance } from '../../../shared/selectors';
import { errorMessage, fieldErrors } from '../../lib/api';
import { useCan, useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input, Select, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function LeaveRequestModal({ employeeId, approveDirectly, onClose }: { employeeId?: string; approveDirectly?: boolean; onClose: () => void }) {
  const data = useData();
  const can = useCan();
  const actions = useActions();
  const today = getToday();
  const forOthers = can('absence:createForOthers');
  const nextMonday = weekStart(addDays(today, 7));
  const [form, setForm] = useState({
    employeeId: employeeId ?? data.me.employeeId ?? '',
    fromDate: nextMonday,
    toDate: addDays(nextMonday, 4),
    comment: '',
  });
  const [direct, setDirect] = useState(Boolean(approveDirectly));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const employee = data.employees.find((e) => e.id === form.employeeId);
  const datesValid = isValidISODate(form.fromDate) && isValidISODate(form.toDate) && form.toDate >= form.fromDate;
  const days = datesValid ? workdaysBetween(form.fromDate, form.toDate) : 0;
  const balance = employee && employee.vacationDaysPerYear !== null ? vacationBalance(employee, data.absences, yearOf(form.fromDate || today), today) : null;
  const after = balance ? balance.remaining - balance.requested - days : null;
  const overlap = employee
    ? data.absences.find((a) => a.employeeId === employee.id && a.kind === 'vacation' && a.status !== 'rejected' && datesValid && rangesOverlap(a.fromDate, a.toDate, form.fromDate, form.toDate))
    : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!form.employeeId) local.employeeId = 'Bitte wählen';
    if (!isValidISODate(form.fromDate)) local.fromDate = 'Ungültiges Datum';
    if (!isValidISODate(form.toDate)) local.toDate = 'Ungültiges Datum';
    else if (form.toDate < form.fromDate) local.toDate = 'Darf nicht vor dem Beginn liegen';
    else if (days < 1) local.toDate = 'Der Zeitraum enthält keinen Arbeitstag';
    if (overlap) local.fromDate = `Überschneidet sich mit ${formatRange(overlap.fromDate, overlap.toDate)}`;
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await actions.createAbsence({ employeeId: form.employeeId, kind: 'vacation', fromDate: form.fromDate, toDate: form.toDate, comment: form.comment.trim(), approveDirectly: direct });
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const ownOnly = !forOthers;
  return (
    <Modal
      title={direct ? 'Urlaub eintragen' : 'Urlaub beantragen'}
      description={ownOnly ? 'Der Antrag geht zur Freigabe an die Geschäftsführung.' : undefined}
      size="md"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="leave-form" loading={busy}>
            {direct ? 'Eintragen' : 'Antrag stellen'}
          </Button>
        </>
      }
    >
      <form id="leave-form" onSubmit={submit} noValidate className="space-y-4">
        {forOthers ? (
          <Field label="Mitarbeiter" required error={errors.employeeId}>
            {(id, invalid) => (
              <Select id={id} value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} invalid={invalid}>
                <option value="">– bitte wählen –</option>
                {data.employees
                  .filter((x) => x.active)
                  .sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'))
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {employeeName(x)}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        ) : !data.me.employeeId ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Dein Benutzer ist keinem Mitarbeiter zugeordnet.</p>
        ) : null}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Von" required error={errors.fromDate}>
            {(id, invalid) => (
              <Input
                id={id}
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value, toDate: form.toDate < e.target.value ? e.target.value : form.toDate })}
                invalid={invalid}
              />
            )}
          </Field>
          <Field label="Bis" required error={errors.toDate}>
            {(id, invalid) => <Input id={id} type="date" value={form.toDate} min={form.fromDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} invalid={invalid} />}
          </Field>
        </div>
        <div className="rounded-lg bg-zinc-50 px-4 py-3 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-500">Arbeitstage (Mo–Fr)</span>
            <span className="font-medium tabular-nums">{days}</span>
          </div>
          {after !== null && (
            <div className="mt-1 flex justify-between">
              <span className="text-zinc-500">Resturlaub danach</span>
              <span className={after < 0 ? 'font-medium text-rose-700 tabular-nums' : 'font-medium tabular-nums'}>{formatDays(after)}</span>
            </div>
          )}
          {after !== null && after < 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-800">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              Der Resturlaub reicht nicht aus. Der Antrag ist trotzdem möglich, die Entscheidung liegt bei der Geschäftsführung.
            </p>
          )}
        </div>
        <Field label="Kommentar" error={errors.comment}>
          {(id) => <Textarea id={id} rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} maxLength={300} placeholder="optional, z. B. Familienurlaub" />}
        </Field>
        {can('absence:decide') && <Checkbox label="Direkt genehmigen" description="Ohne Umweg über die Freigabe eintragen" checked={direct} onChange={setDirect} />}
        {error && Object.keys(errors).length === 0 && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Modal>
  );
}
