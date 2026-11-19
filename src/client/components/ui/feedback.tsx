import { CircleAlert, CircleCheck, X } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { cx } from '../../lib/cx';
import { Button } from './Button';
import { Field, Textarea } from './Field';
import { Modal } from './Modal';

// ---- Toasts ---------------------------------------------------------------------

interface Toast {
  id: number;
  title: string;
  tone: 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

interface ToastApi {
  show: (t: Omit<Toast, 'id' | 'tone'> & { tone?: Toast['tone'] }) => void;
  error: (title: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const remove = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);
  const show = useCallback<ToastApi['show']>(
    (t) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { ...t, tone: t.tone ?? 'success', id }]);
      window.setTimeout(() => remove(id), t.tone === 'error' ? 6000 : 4000);
    },
    [remove],
  );
  const api = useMemo<ToastApi>(() => ({ show, error: (title) => show({ title, tone: 'error' }) }), [show]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[60] flex w-full max-w-sm flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto flex items-start gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg animate-pop-in">
            {t.tone === 'success' ? (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-rose-600" aria-hidden />
            )}
            <p className={cx('flex-1 text-sm', t.tone === 'error' ? 'text-rose-800' : 'text-zinc-800')}>{t.title}</p>
            {t.action && (
              <button
                type="button"
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
                onClick={() => {
                  t.action!.onClick();
                  remove(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
            <button type="button" className="text-zinc-400 hover:text-zinc-600" onClick={() => remove(t.id)} aria-label="Hinweis schließen">
              <X className="size-4" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast außerhalb von ToastProvider');
  return ctx;
}

// ---- Bestätigungsdialog ---------------------------------------------------------

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** Optionales Begründungsfeld (z. B. beim Ablehnen eines Urlaubsantrags). */
  noteLabel?: string;
}
type ConfirmResult = { ok: boolean; note: string };

const ConfirmContext = createContext<((o: ConfirmOptions) => Promise<ConfirmResult>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (r: ConfirmResult) => void }) | null>(null);
  const [note, setNote] = useState('');
  const confirm = useCallback(
    (o: ConfirmOptions) =>
      new Promise<ConfirmResult>((resolve) => {
        setNote('');
        setState({ ...o, resolve });
      }),
    [],
  );
  const close = (ok: boolean) => {
    state?.resolve({ ok, note: note.trim() });
    setState(null);
  };
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          title={state.title}
          size="sm"
          onClose={() => close(false)}
          footer={
            <>
              <Button onClick={() => close(false)}>Abbrechen</Button>
              <Button variant={state.tone === 'danger' ? 'danger' : 'primary'} onClick={() => close(true)} autoFocus={!state.noteLabel}>
                {state.confirmLabel}
              </Button>
            </>
          }
        >
          {state.message && <p className="text-sm text-zinc-600">{state.message}</p>}
          {state.noteLabel && (
            <Field label={state.noteLabel} className={state.message ? 'mt-4' : ''}>
              {(id) => <Textarea id={id} rows={3} value={note} onChange={(e) => setNote(e.target.value)} autoFocus maxLength={300} />}
            </Field>
          )}
        </Modal>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm außerhalb von ConfirmProvider');
  return ctx;
}
