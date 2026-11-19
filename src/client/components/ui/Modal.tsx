import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../../lib/cx';
import { Button } from './Button';

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

// Esc schließt nur das oberste offene Fenster (Modal über Drawer).
const escapeStack: { handler: () => void }[] = [];
let escapeListening = false;

export function useEscape(onEscape: () => void, active = true): void {
  const ref = useRef(onEscape);
  useEffect(() => {
    ref.current = onEscape;
  }, [onEscape]);
  useEffect(() => {
    if (!active) return;
    if (!escapeListening) {
      escapeListening = true;
      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && escapeStack.length > 0) {
          e.preventDefault();
          escapeStack[escapeStack.length - 1].handler();
        }
      });
    }
    const entry = { handler: () => ref.current() };
    escapeStack.push(entry);
    return () => {
      const i = escapeStack.indexOf(entry);
      if (i >= 0) escapeStack.splice(i, 1);
    };
  }, [active]);
}

export function Modal({
  title,
  description,
  onClose,
  children,
  footer,
  size = 'md',
  dismissOnOverlay = true,
}: {
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZES;
  dismissOnOverlay?: boolean;
}) {
  const titleId = useId();
  useEscape(onClose);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/40 px-4 py-10 animate-fade-in sm:py-16" onMouseDown={(e) => dismissOnOverlay && e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cx('w-full rounded-xl border border-zinc-200 bg-white shadow-2xl animate-pop-in', SIZES[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-zinc-900">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-zinc-500">{description}</p>}
          </div>
          <Button variant="ghost" size="sm" icon={X} onClick={onClose} aria-label="Schließen" />
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-zinc-100 bg-zinc-50/70 px-5 py-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
