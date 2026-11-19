import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx('rounded-xl border border-zinc-200 bg-white shadow-xs', className)}>{children}</section>;
}

export function CardHeader({ title, description, actions, className }: { title: ReactNode; description?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cx('flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-3.5', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Kleine Kennzahl für Kopfbereiche („Offen 12.340 €“). */
export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'red' | 'green' | 'default' }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-xs">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className={cx('mt-1 text-lg font-semibold tabular-nums', tone === 'red' ? 'text-rose-700' : tone === 'green' ? 'text-emerald-700' : 'text-zinc-900')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}
