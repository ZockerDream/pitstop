import { useState, type FormEvent } from 'react';
import { isValidISODate, today as getToday } from '../../../shared/dates';
import { employeeName } from '../../../shared/selectors';
import { errorMessage, fieldErrors } from '../../lib/api';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Field, Input, Textarea } from '../ui/Field';
import { Modal } from '../ui/Modal';

export function SickNoteModal({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const employee = data.employees.find((e) => e.id === employeeId);
  const today = getToday();
  const [form, setForm] = useState({ fromDate: today, toDate: today, comment: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!isValidISODate(form.fromDate)) local.fromDate = 'Ungültiges Datum';
    if (!isValidISODate(form.toDate)) local.toDate = 'Ungültiges Datum';
    else if (form.toDate < form.fromDate) local.toDate = 'Darf nicht vor dem Beginn liegen';
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      await actions.createAbsence({ employeeId, kind: 'sick', fromDate: form.fromDate, toDate: form.toDate, comment: form.comment.trim() });
      onClose();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Krank melden"
      description={employee ? `${employeeName(employee)} – gilt sofort, ohne Freigabe.` : undefined}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="sick-form" loading={busy}>
            Krankmeldung erfassen
          </Button>
        </>
      }
    >
      <form id="sick-form" onSubmit={submit} noValidate className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Von" required error={errors.fromDate}>
            {(id, invalid) => <Input id={id} type="date" value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} invalid={invalid} />}
          </Field>
          <Field label="Bis (voraussichtlich)" required error={errors.toDate}>
            {(id, invalid) => <Input id={id} type="date" value={form.toDate} min={form.fromDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} invalid={invalid} />}
          </Field>
        </div>
        <Field label="Notiz" hint="Keine Diagnosen eintragen – nur organisatorische Hinweise.">
          {(id) => <Textarea id={id} rows={2} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} maxLength={300} />}
        </Field>
        {error && Object.keys(errors).length === 0 && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Modal>
  );
}
