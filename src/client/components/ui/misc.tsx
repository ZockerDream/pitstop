import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { initials } from '../../../shared/format';
import { cx } from '../../lib/cx';

// ---- Avatar (Foto-Platzhalter mit Initialen, Farbe fest aus dem Namen) ---------

const AVATAR_COLORS = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-800',
  'bg-sky-100 text-sky-700',
  'bg-rose-100 text-rose-700',
  'bg-violet-100 text-violet-700',
  'bg-teal-100 text-teal-700',
  'bg-orange-100 text-orange-700',
];
const AVATAR_SIZES = { xs: 'size-6 text-[10px]', sm: 'size-8 text-xs', md: 'size-10 text-sm', lg: 'size-12 text-base', xl: 'size-16 text-xl' };

export function Avatar({ name, size = 'sm', square }: { name: string; size?: keyof typeof AVATAR_SIZES; square?: boolean }) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return (
    <span
      className={cx('inline-grid shrink-0 place-items-center font-semibold', square ? 'rounded-lg' : 'rounded-full', AVATAR_COLORS[hash % AVATAR_COLORS.length], AVATAR_SIZES[size])}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

// ---- Leerer Zustand -----------------------------------------------------------

export function EmptyState({ icon: Icon, title, text, action, compact }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode; compact?: boolean }) {
  return (
    <div className={cx('flex flex-col items-center justify-center text-center', compact ? 'px-4 py-8' : 'px-6 py-14')}>
      <span className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-500">
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ---- Segment-Schalter -----------------------------------------------------------

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="inline-flex rounded-lg bg-zinc-100 p-0.5" role="group">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-md font-medium whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
              size === 'sm' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3 text-[13px]',
              active ? 'bg-white text-zinc-900 shadow-xs' : 'text-zinc-600 hover:text-zinc-900',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cx('tabular-nums', active ? 'text-zinc-500' : 'text-zinc-400')}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// ---- Dropdown-Menü -------------------------------------------------------------

export interface MenuItem {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  danger?: boolean;
  hint?: string;
}

export function Menu({
  trigger,
  items,
  header,
  align = 'right',
  width = 'w-56',
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  items: (MenuItem | 'divider')[];
  header?: ReactNode;
  align?: 'left' | 'right';
  width?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div role="menu" className={cx('absolute z-30 mt-1.5 rounded-xl border border-zinc-200 bg-white p-1 shadow-lg animate-pop-in', width, align === 'right' ? 'right-0' : 'left-0')}>
          {header && <div className="border-b border-zinc-100 px-2.5 pt-1.5 pb-2.5 mb-1">{header}</div>}
          {items.map((item, i) =>
            item === 'divider' ? (
              <div key={`d${i}`} className="my-1 h-px bg-zinc-100" />
            ) : (
              <button
                key={item.label}
                role="menuitem"
                type="button"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
                className={cx(
                  'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-sm focus-visible:outline-none focus-visible:bg-zinc-100',
                  item.danger ? 'text-rose-700 hover:bg-rose-50' : 'text-zinc-700 hover:bg-zinc-100',
                )}
              >
                {item.icon && <item.icon className="size-4 text-current opacity-70" aria-hidden />}
                <span className="flex-1">{item.label}</span>
                {item.hint && <span className="text-xs text-zinc-400">{item.hint}</span>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ---- Beschreibungsliste (Stammdaten) ----------------------------------------------

export function DetailList({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs font-medium text-zinc-500">{item.label}</dt>
          <dd className="mt-0.5 text-sm break-words text-zinc-900">{item.value || <span className="text-zinc-400">–</span>}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Spinner({ label = 'Lädt …' }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-zinc-500" role="status">
      <span className="size-4 animate-spin rounded-full border-2 border-zinc-300 border-t-brand-600" aria-hidden />
      {label}
    </div>
  );
}

/** Tabellen-Klassen, damit alle Listen gleich aussehen. */
export const table = {
  wrap: 'overflow-x-auto',
  table: 'w-full min-w-[720px] text-sm',
  th: 'px-4 py-2.5 text-left text-xs font-medium tracking-wide text-zinc-500 uppercase whitespace-nowrap',
  thRight: 'px-4 py-2.5 text-right text-xs font-medium tracking-wide text-zinc-500 uppercase whitespace-nowrap',
  tr: 'border-t border-zinc-100 transition-colors hover:bg-zinc-50/80',
  trClick: 'cursor-pointer border-t border-zinc-100 transition-colors hover:bg-zinc-50/80',
  td: 'px-4 py-3 align-middle',
  tdRight: 'px-4 py-3 text-right align-middle tabular-nums whitespace-nowrap',
};

/** Kennzeichen im Stil eines deutschen Nummernschilds (EU-Feld + Schrift). */
export function Plate({ plate, size = 'md' }: { plate: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'inline-flex items-stretch overflow-hidden rounded-[4px] border border-zinc-900 bg-white font-semibold tracking-wide whitespace-nowrap text-zinc-900 tabular-nums',
        size === 'sm' ? 'h-5 text-[11px]' : 'h-6 text-xs',
      )}
    >
      <span className="flex items-end bg-blue-700 px-[3px] pb-[1px] text-[7px] font-bold text-white" aria-hidden>
        D
      </span>
      <span className="flex items-center px-1.5" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
        {plate}
      </span>
    </span>
  );
}
