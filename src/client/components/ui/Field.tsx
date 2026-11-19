import { useId, type ComponentProps, type ReactNode } from 'react';
import { cx } from '../../lib/cx';

const CONTROL =
  'block rounded-lg border bg-white px-3 text-sm text-zinc-900 shadow-xs placeholder:text-zinc-400 transition-colors focus:outline-none focus:ring-2 disabled:bg-zinc-50 disabled:text-zinc-500';
const OK = 'border-zinc-200 focus:border-brand-500 focus:ring-brand-500/20';
const BAD = 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20';
/** Volle Breite, außer der Aufrufer gibt selbst eine Breite vor (w-auto, w-52 …). */
const width = (className?: string) => (className && /(^|\s)(\w+:)?w-/.test(className) ? '' : 'w-full');

export function Field({
  label,
  error,
  hint,
  required,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (id: string, invalid: boolean) => ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-zinc-700">
        {label}
        {required && <span className="ml-0.5 text-rose-600">*</span>}
      </label>
      {children(id, Boolean(error))}
      {error ? <p className="mt-1 text-xs text-rose-600">{error}</p> : hint ? <p className="mt-1 text-xs text-zinc-500">{hint}</p> : null}
    </div>
  );
}

export function Input({ invalid, className, ...rest }: ComponentProps<'input'> & { invalid?: boolean }) {
  return <input className={cx(CONTROL, width(className), 'h-9', invalid ? BAD : OK, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Textarea({ invalid, className, ...rest }: ComponentProps<'textarea'> & { invalid?: boolean }) {
  return <textarea className={cx(CONTROL, width(className), 'py-2', invalid ? BAD : OK, className)} aria-invalid={invalid || undefined} {...rest} />;
}

export function Select({ invalid, className, children, ...rest }: ComponentProps<'select'> & { invalid?: boolean }) {
  return (
    <select className={cx(CONTROL, width(className), 'h-9 pr-8', invalid ? BAD : OK, className)} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start gap-2.5">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 rounded border-zinc-300 text-brand-600 accent-brand-600 focus:ring-brand-500"
      />
      <label htmlFor={id} className="text-sm text-zinc-700 select-none">
        {label}
        {description && <span className="block text-xs text-zinc-500">{description}</span>}
      </label>
    </div>
  );
}

/** Suchfeld mit Lupe für Listen-Toolbars. */
export function SearchInput({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={cx('relative', className)}>
      <svg className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="pl-9" type="search" aria-label={placeholder} />
    </div>
  );
}
