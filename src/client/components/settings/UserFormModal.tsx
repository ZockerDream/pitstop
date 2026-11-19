import { useState, type FormEvent } from 'react';
import { roleLabel } from '../../../shared/labels';
import { employeeName } from '../../../shared/selectors';
import type { Role } from '../../../shared/types';
import { errorMessage, fieldErrors } from '../../lib/api';
import { useModals } from '../../lib/modals';
import { useData } from '../../store/AppStore';
import { useActions } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Field, Input, Select } from '../ui/Field';
import { Modal } from '../ui/Modal';

/** Zugang anlegen (mit einmalig angezeigtem Startpasswort) oder bearbeiten. */
export function UserFormModal({ userId, onClose }: { userId?: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const { open } = useModals();
  const existing = userId ? data.users.find((u) => u.id === userId) : undefined;
  const linked = new Set(data.users.filter((u) => u.id !== existing?.id && u.employeeId).map((u) => u.employeeId));
  const available = data.employees.filter((e) => e.active && !linked.has(e.id)).sort((a, b) => a.lastName.localeCompare(b.lastName, 'de'));
  const [form, setForm] = useState({
    employeeId: existing?.employeeId ?? '',
    email: existing?.email ?? '',
    displayName: existing?.displayName ?? '',
    role: (existing?.role ?? 'employee') as Role,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pickEmployee = (id: string) => {
    const e = data.employees.find((x) => x.id === id);
    setForm({
      ...form,
      employeeId: id,
      email: !existing && e?.email && !form.email ? e.email : form.email,
      displayName: e && (!form.displayName || !existing) ? employeeName(e) : form.displayName,
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!existing && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) local.email = 'Gültige E-Mail-Adresse angeben';
    if (!form.displayName.trim()) local.displayName = 'Pflichtfeld';
    if (form.role === 'employee' && !form.employeeId) local.employeeId = 'Für die Rolle Mitarbeiter einen Mitarbeiter wählen';
    setErrors(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      if (existing) {
        await actions.updateUser(existing.id, { displayName: form.displayName.trim(), role: form.role, employeeId: form.employeeId || null }, 'Zugang gespeichert');
        onClose();
      } else {
        const r = await actions.createUser({ email: form.email.trim(), displayName: form.displayName.trim(), role: form.role, employeeId: form.employeeId || null });
        open({ type: 'revealPassword', title: 'Zugang angelegt', email: r.user.email, password: r.password });
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
      title={existing ? 'Zugang bearbeiten' : 'Zugang anlegen'}
      description={existing ? existing.email : 'Pitstop erzeugt ein Startpasswort, das einmal angezeigt wird.'}
      size="md"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <>
          <Button onClick={onClose}>Abbrechen</Button>
          <Button variant="primary" type="submit" form="user-form" loading={busy}>
            {existing ? 'Speichern' : 'Zugang anlegen'}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="space-y-4">
        <Field label="Mitarbeiter" error={errors.employeeId} hint="Pflicht für die Rolle Mitarbeiter; E-Mail und Name werden übernommen.">
          {(id, invalid) => (
            <Select id={id} value={form.employeeId} onChange={(e) => pickEmployee(e.target.value)} invalid={invalid} autoFocus>
              <option value="">– ohne Personalakte –</option>
              {available.map((e) => (
                <option key={e.id} value={e.id}>
                  {employeeName(e)}
                  {e.jobTitle ? ` · ${e.jobTitle}` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="E-Mail (Anmeldename)" required error={errors.email}>
          {(id, invalid) => <Input id={id} type="email" value={form.email} disabled={Boolean(existing)} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={invalid} />}
        </Field>
        <Field label="Anzeigename" required error={errors.displayName}>
          {(id, invalid) => <Input id={id} value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} invalid={invalid} />}
        </Field>
        <Field label="Rolle" required error={errors.role} hint={form.role === 'admin' ? 'Sieht und darf alles, inklusive Finanzen und Einstellungen.' : 'Keine Finanzen, keine Stundensätze, nur die eigene Personalakte.'}>
          {(id) => (
            <Select id={id} value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
              {(['employee', 'admin'] as Role[]).map((r) => (
                <option key={r} value={r}>
                  {roleLabel[r]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      </form>
    </Modal>
  );
}
