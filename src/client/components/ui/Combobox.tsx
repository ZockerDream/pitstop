import { Check, ChevronDown } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { normalize } from '../../../shared/selectors';
import { cx } from '../../lib/cx';

export interface ComboOption {
  value: string;
  label: string;
  description?: string;
}

/** Durchsuchbare Auswahl (z. B. Kunde in der neuen Rechnung). */
export function Combobox({
  id,
  options,
  value,
  onChange,
  placeholder,
  invalid,
  autoFocus,
}: {
  id?: string;
  options: ComboOption[];
  value: string | null;
  onChange: (value: string) => void;
  placeholder: string;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  const selected = options.find((o) => o.value === value) ?? null;
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return options.slice(0, 50);
    return options.filter((o) => normalize(`${o.label} ${o.description ?? ''}`).includes(q)).slice(0, 50);
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapper.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (o: ComboOption) => {
    onChange(o.value);
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapper} className="relative">
      <input
        id={id}
        autoFocus={autoFocus}
        role="combobox"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        value={open ? query : (selected?.label ?? '')}
        placeholder={selected?.label ?? placeholder}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, filtered.length - 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === 'Enter' && open && filtered[active]) {
            e.preventDefault();
            choose(filtered[active]);
          } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        className={cx(
          'block h-9 w-full rounded-lg border bg-white pr-9 pl-3 text-sm shadow-xs placeholder:text-zinc-400 focus:outline-none focus:ring-2',
          selected && !open ? 'placeholder:text-zinc-900' : '',
          invalid ? 'border-rose-300 focus:ring-rose-500/20' : 'border-zinc-200 focus:border-brand-500 focus:ring-brand-500/20',
        )}
      />
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-400" aria-hidden />
      {open && (
        <ul ref={listRef} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white py-1 shadow-lg">
          {filtered.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">Keine Treffer</li>}
          {filtered.map((o, i) => (
            <li
              key={o.value}
              data-index={i}
              role="option"
              aria-selected={o.value === value}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={cx('flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm', i === active ? 'bg-zinc-100' : '')}
            >
              <span className="min-w-0">
                <span className="block truncate text-zinc-900">{o.label}</span>
                {o.description && <span className="block truncate text-xs text-zinc-500">{o.description}</span>}
              </span>
              {o.value === value && <Check className="size-4 shrink-0 text-brand-600" aria-hidden />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
