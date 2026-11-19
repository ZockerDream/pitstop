import { CalendarDays, Cog, Mail, MessagesSquare, Phone, StickyNote, type LucideIcon } from 'lucide-react';
import { formatDateTime, formatRelative } from '../../../shared/format';
import { noteKindLabel } from '../../../shared/labels';
import type { Note, NoteKind } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { EmptyState } from '../ui/misc';

const ICONS: Record<NoteKind, { icon: LucideIcon; className: string }> = {
  note: { icon: StickyNote, className: 'bg-amber-50 text-amber-700' },
  call: { icon: Phone, className: 'bg-emerald-50 text-emerald-700' },
  email: { icon: Mail, className: 'bg-sky-50 text-sky-700' },
  meeting: { icon: CalendarDays, className: 'bg-violet-50 text-violet-700' },
  system: { icon: Cog, className: 'bg-zinc-100 text-zinc-600' },
};

export function NoteTimeline({ notes, today }: { notes: Note[]; today: string }) {
  if (notes.length === 0) return <EmptyState icon={MessagesSquare} title="Noch keine Einträge" text="Anrufe, E-Mails, Termine und Notizen erscheinen hier als Zeitleiste." compact />;
  return (
    <ol className="relative space-y-5 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-zinc-200">
      {notes.map((n) => {
        const meta = ICONS[n.kind];
        return (
          <li key={n.id} className="relative flex gap-3">
            <span className={cx('relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-white', meta.className)}>
              <meta.icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">{noteKindLabel[n.kind]}</span>
                <span>·</span>
                <span>{n.authorName || 'System'}</span>
                <span>·</span>
                <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                  {formatRelative(n.createdAt.slice(0, 10), today)}, {formatDateTime(n.createdAt).split(', ')[1]} Uhr
                </time>
              </div>
              <p className={cx('mt-1 text-sm whitespace-pre-line', n.kind === 'system' ? 'text-zinc-600 italic' : 'text-zinc-800')}>{n.text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
