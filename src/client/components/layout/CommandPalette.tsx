import {
  CalendarPlus,
  Car,
  CornerDownLeft,
  FileText,
  IdCard,
  LayoutDashboard,
  Receipt,
  Search,
  Settings,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Permission } from '../../../shared/permissions';
import { byId, employeeName, invoiceTotals, normalize, search } from '../../../shared/selectors';
import { formatEuro } from '../../../shared/format';
import { cx } from '../../lib/cx';
import { useModals, type ModalRequest } from '../../lib/modals';
import { navigate } from '../../lib/router';
import { readRecent } from '../../lib/storage';
import { useCan, useData } from '../../store/AppStore';
import { useEscape } from '../ui/Modal';

interface PaletteItem {
  key: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  run: () => void;
}

interface ActionDef {
  title: string;
  icon: LucideIcon;
  permission?: Permission;
  modal?: ModalRequest;
  path?: string;
}

const ACTIONS: ActionDef[] = [
  { title: 'Neue Rechnung', icon: FileText, permission: 'finance:view', modal: { type: 'invoice' } },
  { title: 'Neuer Kunde', icon: Users, permission: 'customer:edit', modal: { type: 'customer' } },
  { title: 'Neue Ausgabe', icon: Receipt, permission: 'finance:view', modal: { type: 'expense' } },
  { title: 'Neuer Mitarbeiter', icon: UserPlus, permission: 'employee:edit', modal: { type: 'employee' } },
  { title: 'Urlaub beantragen', icon: CalendarPlus, modal: { type: 'absence' } },
  { title: 'Zum Dashboard', icon: LayoutDashboard, path: '/dashboard' },
  { title: 'Zu den Kunden', icon: Users, path: '/kunden' },
  { title: 'Zu den Rechnungen', icon: Wallet, permission: 'finance:view', path: '/finanzen/rechnungen' },
  { title: 'Zu den Ausgaben', icon: Receipt, permission: 'finance:view', path: '/finanzen/ausgaben' },
  { title: 'Zu Personal', icon: IdCard, path: '/personal' },
  { title: 'Zu Urlaub & Abwesenheiten', icon: CalendarPlus, path: '/personal/urlaub' },
  { title: 'Zu den Einstellungen', icon: Settings, permission: 'settings:manage', path: '/einstellungen/firma' },
];

const TYPE_META = {
  customer: { group: 'Kunden', icon: Users, path: (id: string) => `/kunden/${id}` },
  invoice: { group: 'Rechnungen', icon: FileText, path: (id: string) => `/finanzen/rechnungen/${id}` },
  employee: { group: 'Mitarbeitende', icon: UserRound, path: (id: string) => `/personal/${id}` },
  vehicle: { group: 'Fahrzeuge', icon: Car, path: (customerId: string) => `/kunden/${customerId}` },
} as const;

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const data = useData();
  const can = useCan();
  const { open } = useModals();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  useEscape(onClose);

  const items = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = ACTIONS.filter((a) => !a.permission || can(a.permission)).map((a) => ({
      key: `action:${a.title}`,
      group: 'Aktionen',
      title: a.title,
      icon: a.icon,
      run: () => (a.modal ? open(a.modal) : navigate(a.path!)),
    }));
    const q = query.trim();
    if (q) {
      const hits = search(data, q, can('finance:view')).map<PaletteItem>((h) => ({
        key: `${h.type}:${h.id}:${h.title}`,
        group: TYPE_META[h.type].group,
        title: h.title,
        subtitle: h.subtitle,
        icon: TYPE_META[h.type].icon,
        run: () => navigate(TYPE_META[h.type].path(h.id)),
      }));
      const nq = normalize(q);
      return [...hits, ...actions.filter((a) => normalize(a.title).includes(nq))];
    }
    const customers = byId(data.customers);
    const invoices = byId(data.invoices);
    const employees = byId(data.employees);
    const recent: PaletteItem[] = [];
    for (const r of readRecent()) {
      if (r.type === 'customer' && customers.has(r.id)) {
        const c = customers.get(r.id)!;
        recent.push({ key: `recent:${r.id}`, group: 'Zuletzt geöffnet', title: c.name, subtitle: `${c.zip} ${c.city}`, icon: Users, run: () => navigate(`/kunden/${c.id}`) });
      } else if (r.type === 'invoice' && invoices.has(r.id)) {
        const i = invoices.get(r.id)!;
        recent.push({
          key: `recent:${r.id}`,
          group: 'Zuletzt geöffnet',
          title: `Rechnung #${i.number}`,
          subtitle: `${customers.get(i.customerId)?.name ?? ''} · ${formatEuro(invoiceTotals(i).gross)}`,
          icon: FileText,
          run: () => navigate(`/finanzen/rechnungen/${i.id}`),
        });
      } else if (r.type === 'employee' && employees.has(r.id)) {
        const e = employees.get(r.id)!;
        recent.push({ key: `recent:${r.id}`, group: 'Zuletzt geöffnet', title: employeeName(e), subtitle: e.jobTitle, icon: UserRound, run: () => navigate(`/personal/${e.id}`) });
      }
    }
    return [...recent.slice(0, 4), ...actions];
  }, [query, data, can, open]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const execute = (item: PaletteItem | undefined) => {
    if (!item) return;
    onClose();
    item.run();
  };

  let lastGroup = '';
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-950/40 px-4 pt-[12vh] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Suche und Aktionen" className="w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl animate-pop-in">
        <div className="flex items-center gap-3 border-b border-zinc-100 px-4">
          <Search className="size-4 text-zinc-400" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, items.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                execute(items[active]);
              }
            }}
            placeholder="Kennzeichen, Kunden, Rechnungen, Mitarbeitende oder Aktionen …"
            className="h-12 flex-1 bg-transparent text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
            aria-label="Suchbegriff"
          />
          <kbd className="rounded border border-zinc-200 px-1.5 text-[11px] text-zinc-500">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-[50vh] overflow-y-auto p-2" role="listbox">
          {items.length === 0 && <p className="px-3 py-8 text-center text-sm text-zinc-500">Keine Treffer für „{query}“.</p>}
          {items.map((item, i) => {
            const header = item.group !== lastGroup ? item.group : null;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {header && <div className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-zinc-400 uppercase">{header}</div>}
                <button
                  type="button"
                  data-index={i}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => execute(item)}
                  className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left', i === active ? 'bg-zinc-100' : '')}
                >
                  <item.icon className="size-4 shrink-0 text-zinc-500" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-900">{item.title}</span>
                    {item.subtitle && <span className="block truncate text-xs text-zinc-500">{item.subtitle}</span>}
                  </span>
                  {i === active && <CornerDownLeft className="size-3.5 text-zinc-400" aria-hidden />}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
