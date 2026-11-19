import { X } from 'lucide-react';
import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { Button } from './Button';
import { useEscape } from './Modal';

/** Seitenansicht von rechts; die Liste dahinter bleibt sichtbar. */
export function Drawer({
  title,
  subtitle,
  leading,
  actions,
  onClose,
  children,
  wide,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const titleId = useId();
  useEscape(onClose);
  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-zinc-950/20 animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('flex h-full w-full flex-col border-l border-zinc-200 bg-white shadow-2xl animate-drawer-in', wide ? 'max-w-[760px]' : 'max-w-[640px]')}
      >
        <header className="border-b border-zinc-100 px-6 pt-5 pb-4">
          <div className="flex items-start gap-4">
            {leading}
            <div className="min-w-0 flex-1">
              <h2 id={titleId} className="truncate text-lg font-semibold tracking-tight text-zinc-900">
                {title}
              </h2>
              {subtitle && <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">{subtitle}</div>}
            </div>
            <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Schließen" />
          </div>
          {actions && <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
        <div className="flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
