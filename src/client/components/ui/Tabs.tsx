import { cx } from '../../lib/cx';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
  highlight?: boolean;
}

export function Tabs<T extends string>({ items, value, onChange, className }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-5 border-b border-zinc-200', className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cx(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 px-0.5 pb-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:text-brand-700',
              active ? 'border-brand-600 text-zinc-900' : 'border-transparent text-zinc-500 hover:text-zinc-800',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={cx('rounded-full px-1.5 text-[11px] tabular-nums', item.highlight ? 'bg-amber-100 text-amber-800' : 'bg-zinc-100 text-zinc-600')}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
