import {
  ChevronDown,
  CalendarPlus,
  FileText,
  KeyRound,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Receipt,
  RotateCcw,
  Search,
  UserPlus,
  UserRound,
  Users,
} from 'lucide-react';
import { roleLabel } from '../../../shared/labels';
import type { SessionControls } from '../../App';
import { useModals } from '../../lib/modals';
import type { Route } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';
import { useRun } from '../../store/mutations';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/feedback';
import { Avatar, Menu, type MenuItem } from '../ui/misc';

const SECTION_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  kunden: 'Kunden',
  finanzen: 'Finanzen',
  personal: 'Personal',
  einstellungen: 'Einstellungen',
};
const SUB_TITLES: Record<string, string> = {
  rechnungen: 'Rechnungen',
  ausgaben: 'Ausgaben',
  urlaub: 'Urlaub & Abwesenheiten',
  firma: 'Firmendaten',
  benutzer: 'Benutzer',
};

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function TopBar({ route, controls, onOpenNav, onOpenSearch }: { route: Route; controls: SessionControls; onOpenNav: () => void; onOpenSearch: () => void }) {
  const [section, sub] = route.segments;
  const title = SECTION_TITLES[section] ?? 'Dashboard';
  const subTitle = sub ? SUB_TITLES[sub] : undefined;

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white/90 px-4 backdrop-blur sm:px-6">
      <Button variant="ghost" size="sm" icon={MenuIcon} className="md:hidden" onClick={onOpenNav} aria-label="Navigation öffnen" />
      <div className="hidden min-w-0 items-center gap-2 text-sm lg:flex lg:w-56">
        <span className="font-medium text-zinc-900">{title}</span>
        {subTitle && (
          <>
            <span className="text-zinc-300">/</span>
            <span className="truncate text-zinc-500">{subTitle}</span>
          </>
        )}
      </div>
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex h-9 w-full max-w-md items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1 text-left">Suchen oder Aktion ausführen …</span>
          <kbd className="hidden rounded border border-zinc-200 bg-white px-1.5 font-sans text-[11px] text-zinc-500 sm:inline">{isMac ? '⌘K' : 'Strg K'}</kbd>
        </button>
      </div>
      <QuickCreateMenu />
      <UserMenu controls={controls} />
    </header>
  );
}

function QuickCreateMenu() {
  const can = useCan();
  const { open } = useModals();
  const items: MenuItem[] = [];
  if (can('customer:edit')) items.push({ label: 'Kunde', icon: Users, onSelect: () => open({ type: 'customer' }) });
  if (can('finance:view')) {
    items.push({ label: 'Rechnung', icon: FileText, onSelect: () => open({ type: 'invoice' }) });
    items.push({ label: 'Ausgabe', icon: Receipt, onSelect: () => open({ type: 'expense' }) });
  }
  if (can('employee:edit')) items.push({ label: 'Mitarbeiter', icon: UserPlus, onSelect: () => open({ type: 'employee' }) });
  items.push({ label: 'Urlaubsantrag', icon: CalendarPlus, onSelect: () => open({ type: 'absence' }) });
  return (
    <Menu
      width="w-48"
      items={items}
      trigger={({ toggle, open: isOpen }) => (
        <Button variant="primary" icon={Plus} onClick={toggle} aria-expanded={isOpen} aria-haspopup="menu">
          <span className="hidden sm:inline">Neu</span>
        </Button>
      )}
    />
  );
}

function UserMenu({ controls }: { controls: SessionControls }) {
  const data = useData();
  const { open } = useModals();
  const confirm = useConfirm();
  const run = useRun();
  const me = data.me;
  const items: (MenuItem | 'divider')[] = [{ label: 'Passwort ändern', icon: KeyRound, onSelect: () => open({ type: 'password' }) }];
  if (data.demoMode) {
    items.push('divider');
    items.push(
      me.role === 'admin'
        ? { label: 'Als Mitarbeiter ansehen', icon: UserRound, onSelect: () => void run(() => controls.switchPersona('employee')) }
        : { label: 'Als Admin ansehen', icon: UserRound, onSelect: () => void run(() => controls.switchPersona('admin')) },
    );
    items.push({
      label: 'Demo-Daten zurücksetzen',
      icon: RotateCcw,
      danger: true,
      onSelect: async () => {
        const r = await confirm({
          title: 'Demo-Daten zurücksetzen?',
          message: 'Alle Änderungen gehen verloren – für alle, die diese Demo gerade benutzen. Danach geht es zurück zur Anmeldung.',
          confirmLabel: 'Zurücksetzen',
          tone: 'danger',
        });
        if (r.ok) await run(controls.resetDemo);
      },
    });
  }
  items.push('divider');
  items.push({ label: 'Abmelden', icon: LogOut, onSelect: () => void controls.logout() });

  return (
    <Menu
      width="w-64"
      header={
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-zinc-900">{me.displayName}</div>
          <div className="truncate text-xs text-zinc-500">{me.email}</div>
        </div>
      }
      items={items}
      trigger={({ toggle, open: isOpen }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-lg py-1 pr-1.5 pl-1 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          <Avatar name={me.displayName} size="sm" />
          <span className="hidden text-left leading-tight lg:block">
            <span className="block text-[13px] font-medium text-zinc-900">{me.displayName}</span>
            <span className="block text-[11px] text-zinc-500">{roleLabel[me.role]}</span>
          </span>
          <ChevronDown className="hidden size-4 text-zinc-400 lg:block" aria-hidden />
        </button>
      )}
    />
  );
}
