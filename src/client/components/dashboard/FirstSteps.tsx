import { CircleCheck, Circle, X } from 'lucide-react';
import { useState } from 'react';
import { cx } from '../../lib/cx';
import { useModals } from '../../lib/modals';
import { navigate } from '../../lib/router';
import { readLocal, writeLocal } from '../../lib/storage';
import { useData } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const HIDE_KEY = 'pitstop:firstSteps:hidden';

/** Checkliste für den Echtbetrieb, solange Grunddaten fehlen (CONCEPT.md 6.5). */
export function FirstSteps() {
  const data = useData();
  const { open } = useModals();
  const [hidden, setHidden] = useState(() => readLocal(HIDE_KEY, false));
  const steps = [
    { label: 'Firmendaten eintragen', done: Boolean(data.company.name), run: () => navigate('/einstellungen/firma') },
    { label: 'Mitarbeitende anlegen', done: data.employees.length > 0, run: () => open({ type: 'employee' }) },
    { label: 'Zugänge für Mitarbeitende anlegen', done: data.users.some((u) => u.role === 'employee'), run: () => navigate('/einstellungen/benutzer') },
    { label: 'Ersten Kunden anlegen', done: data.customers.length > 0, run: () => open({ type: 'customer' }) },
    { label: 'Erste Rechnung schreiben', done: data.invoices.length > 0, run: () => open({ type: 'invoice' }) },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (hidden || doneCount === steps.length) return null;
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">Erste Schritte</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            {doneCount} von {steps.length} erledigt – danach ist Pitstop startklar.
          </p>
        </div>
        <Button
          size="xs"
          variant="ghost"
          icon={X}
          onClick={() => {
            writeLocal(HIDE_KEY, true);
            setHidden(true);
          }}
        >
          Ausblenden
        </Button>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={s.run}
              className={cx(
                'flex h-full w-full items-start gap-2 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors',
                s.done ? 'border-emerald-200 bg-emerald-50/60 text-emerald-800' : 'border-zinc-200 hover:border-brand-500 hover:bg-brand-50/40',
              )}
            >
              {s.done ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />}
              {s.label}
            </button>
          </li>
        ))}
      </ol>
    </Card>
  );
}
