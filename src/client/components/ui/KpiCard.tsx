import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cx } from '../../lib/cx';

export function KpiCard({
  label,
  value,
  sub,
  subTone = 'muted',
  icon: Icon,
  onClick,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  subTone?: 'muted' | 'red' | 'green';
  icon: LucideIcon;
  onClick?: () => void;
}) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cx(
        'group flex flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-xs',
        onClick && 'transition-colors hover:border-zinc-300 hover:bg-zinc-50/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-zinc-500">{label}</span>
        <span className="grid size-7 place-items-center rounded-lg bg-zinc-100 text-zinc-500 group-hover:bg-zinc-200/70">
          <Icon className="size-4" aria-hidden />
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 tabular-nums">{value}</div>
      {sub && (
        <div className={cx('mt-1 text-xs', subTone === 'red' ? 'font-medium text-rose-700' : subTone === 'green' ? 'text-emerald-700' : 'text-zinc-500')}>{sub}</div>
      )}
    </Tag>
  );
}
