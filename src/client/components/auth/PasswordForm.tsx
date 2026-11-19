import { useState, type FormEvent, type ReactNode } from 'react';
import type { User } from '../../../shared/types';
import { api, errorMessage, fieldErrors } from '../../lib/api';
import { Field, Input } from '../ui/Field';

const MIN = 12;

/** Formular „altes Passwort / neues Passwort / wiederholen“; wird im Modal und beim Pflichtwechsel genutzt. */
export function PasswordForm({ onDone, renderActions }: { onDone: (user: User) => void; renderActions: (busy: boolean) => ReactNode }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (!current) local.currentPassword = 'Bitte das bisherige Passwort eingeben';
    if (next.length < MIN) local.newPassword = `Mindestens ${MIN} Zeichen`;
    if (repeat !== next) local.repeat = 'Die Passwörter stimmen nicht überein';
    setFields(local);
    setError(null);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const r = await api.post<{ user: User }>('/auth/password', { currentPassword: current, newPassword: next });
      onDone(r.user);
    } catch (err) {
      setFields(fieldErrors(err));
      if (!Object.keys(fieldErrors(err)).length) setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Bisheriges Passwort" error={fields.currentPassword}>
        {(id, invalid) => <Input id={id} type="password" autoComplete="current-password" autoFocus value={current} onChange={(e) => setCurrent(e.target.value)} invalid={invalid} />}
      </Field>
      <Field label="Neues Passwort" error={fields.newPassword} hint={`Mindestens ${MIN} Zeichen. Ein Satz oder mehrere Wörter sind gut zu merken.`}>
        {(id, invalid) => <Input id={id} type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} invalid={invalid} />}
      </Field>
      <Field label="Neues Passwort wiederholen" error={fields.repeat}>
        {(id, invalid) => <Input id={id} type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} invalid={invalid} />}
      </Field>
      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {renderActions(busy)}
    </form>
  );
}
