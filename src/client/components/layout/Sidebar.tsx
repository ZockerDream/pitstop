import { IdCard, LayoutDashboard, Settings, Users, Wallet, type LucideIcon } from 'lucide-react';
import type { Permission } from '../../../shared/permissions';
import { initials } from '../../../shared/format';
import { cx } from '../../lib/cx';
import { href } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';

interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
  permission?: Permission;
  badge?: number;
}

export function Sidebar({ open, onClose, section }: { open: boolean; onClose: () => void; section: string }) {
  const data = useData();
  const can = useCan();
  const requested = data.absences.filter((a) => a.status === 'requested').length;
  const items: NavItem[] = [
    { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard' },
    { key: 'kunden', label: 'Kunden', icon: Users, path: '/kunden' },
    { key: 'finanzen', label: 'Finanzen', icon: Wallet, path: '/finanzen/rechnungen', permission: 'finance:view' },
    { key: 'personal', label: 'Personal', icon: IdCard, path: '/personal', badge: can('absence:decide') && requested > 0 ? requested : undefined },
    { key: 'einstellungen', label: 'Einstellungen', icon: Settings, path: '/einstellungen/firma', permission: 'settings:manage' },
  ];
  const companyName = data.company.name || 'Pitstop';
  const active = section || 'dashboard';

  const nav = (
    <div className="flex h-full w-60 flex-col bg-zinc-950 text-zinc-400">
      <div className="flex items-center gap-3 px-4 pt-5 pb-6">
        {data.hasLogo ? (
          <img src="/api/public/logo" alt="" className="size-9 rounded-lg bg-white object-contain p-1" />
        ) : (
          <span className="grid size-9 place-items-center rounded-lg bg-brand-600 text-sm font-bold text-white">{initials(companyName)}</span>
        )}
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-white">{companyName}</div>
          <div className="text-xs text-zinc-500">Pitstop · Business OS</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-3" aria-label="Hauptnavigation">
        {items
          .filter((item) => !item.permission || can(item.permission))
          .map((item) => {
            const isActive = active === item.key;
            return (
              <a
                key={item.key}
                href={href(item.path)}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
                  isActive ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-zinc-200',
                )}
              >
                <item.icon className="size-4" aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="rounded-full bg-amber-400/90 px-1.5 text-[11px] font-semibold text-zinc-950 tabular-nums" aria-label={`${item.badge} offene Anträge`}>
                    {item.badge}
                  </span>
                )}
              </a>
            );
          })}
      </nav>
      <div className="space-y-3 px-4 pb-5">
        {data.demoMode && (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
            <span className="font-semibold">Demo-Modus</span> – alle Daten sind erfunden.
          </div>
        )}
        <div className="flex gap-3 text-xs text-zinc-500">
          <a href={href('/impressum')} className="hover:text-zinc-300">
            Impressum
          </a>
          <a href={href('/datenschutz')} className="hover:text-zinc-300">
            Datenschutz
          </a>
          <span className="ml-auto">v0.1</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden shrink-0 md:block">{nav}</div>
      {open && (
        <div className="fixed inset-0 z-40 flex bg-zinc-950/40 md:hidden" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
          <div className="h-full animate-pop-in">{nav}</div>
        </div>
      )}
    </>
  );
}
