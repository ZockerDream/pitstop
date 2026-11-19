import { Mail, Phone, Plus, Star, UserRound } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { ContactPerson } from '../../../shared/types';
import { fieldErrors } from '../../lib/api';
import { useActions, useRun } from '../../store/mutations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Checkbox, Field, Input } from '../ui/Field';
import { Avatar, EmptyState } from '../ui/misc';

const EMPTY = { name: '', position: '', phone: '', email: '', isPrimary: false };

export function ContactCards({ customerId, contacts, canEdit }: { customerId: string; contacts: ContactPerson[]; canEdit: boolean }) {
  const actions = useActions();
  const run = useRun();
  const [form, setForm] = useState<typeof EMPTY | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    if (!form.name.trim()) {
      setErrors({ name: 'Pflichtfeld' });
      return;
    }
    setBusy(true);
    try {
      await actions.addContact(customerId, form);
      setForm(null);
      setErrors({});
    } catch (err) {
      const f = fieldErrors(err);
      if (Object.keys(f).length) setErrors(f);
      else await run(() => Promise.reject(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {contacts.length === 0 && !form && <EmptyState icon={UserRound} title="Noch keine Ansprechpartner" compact />}
      {[...contacts]
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((c) => (
          <div key={c.id} className="flex items-start gap-3 rounded-lg border border-zinc-200 p-4">
            <Avatar name={c.name} size="md" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-zinc-900">{c.name}</span>
                {c.isPrimary && (
                  <Badge tone="indigo">
                    <Star className="size-3" aria-hidden />
                    Hauptkontakt
                  </Badge>
                )}
              </div>
              {c.position && <div className="text-sm text-zinc-500">{c.position}</div>}
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                {c.phone && (
                  <a href={`tel:${c.phone.replace(/\s/g, '')}`} className="inline-flex items-center gap-1.5 text-zinc-700 hover:text-zinc-900">
                    <Phone className="size-3.5 text-zinc-400" aria-hidden />
                    {c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 text-brand-600 hover:underline">
                    <Mail className="size-3.5" aria-hidden />
                    {c.email}
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      {canEdit &&
        (form ? (
          <form onSubmit={submit} className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-4" noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" required error={errors.name}>
                {(id, invalid) => <Input id={id} autoFocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} invalid={invalid} />}
              </Field>
              <Field label="Funktion" error={errors.position}>
                {(id) => <Input id={id} value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} placeholder="z. B. Fuhrparkleiter" />}
              </Field>
              <Field label="Telefon" error={errors.phone}>
                {(id) => <Input id={id} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}
              </Field>
              <Field label="E-Mail" error={errors.email}>
                {(id, invalid) => <Input id={id} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} invalid={invalid} />}
              </Field>
            </div>
            <Checkbox label="Als Hauptkontakt festlegen" checked={form.isPrimary} onChange={(v) => setForm({ ...form, isPrimary: v })} />
            <div className="flex justify-end gap-2">
              <Button size="sm" onClick={() => setForm(null)}>
                Abbrechen
              </Button>
              <Button size="sm" type="submit" variant="primary" loading={busy}>
                Speichern
              </Button>
            </div>
          </form>
        ) : (
          <Button size="sm" icon={Plus} onClick={() => setForm(EMPTY)}>
            Ansprechpartner hinzufügen
          </Button>
        ))}
    </div>
  );
}
