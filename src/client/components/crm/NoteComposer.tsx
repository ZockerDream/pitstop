import { useState, type RefObject } from 'react';
import { noteKindLabel } from '../../../shared/labels';
import type { NoteKind } from '../../../shared/types';
import { useActions, useRun } from '../../store/mutations';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Field';
import { SegmentedControl } from '../ui/misc';

const KINDS: NoteKind[] = ['note', 'call', 'email', 'meeting'];
const PLACEHOLDER: Record<NoteKind, string> = {
  note: 'Notiz zum Kunden …',
  call: 'Worum ging es im Telefonat?',
  email: 'Was wurde per E-Mail besprochen oder versendet?',
  meeting: 'Ergebnis des Termins …',
  system: '',
};

export function NoteComposer({ customerId, textareaRef }: { customerId: string; textareaRef?: RefObject<HTMLTextAreaElement | null> }) {
  const actions = useActions();
  const run = useRun();
  const [kind, setKind] = useState<NoteKind>('note');
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!text.trim()) return;
    setBusy(true);
    await run(async () => {
      await actions.addNote(customerId, kind, text.trim());
      setText('');
    });
    setBusy(false);
  };

  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <SegmentedControl size="sm" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: noteKindLabel[k] }))} />
      <Textarea
        ref={textareaRef}
        rows={3}
        className="mt-3 resize-y"
        value={text}
        placeholder={PLACEHOLDER[kind]}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void save();
          }
        }}
        aria-label="Neuer Eintrag"
        maxLength={4000}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-zinc-400">Strg + Enter speichert</span>
        <Button size="sm" variant="primary" onClick={() => void save()} loading={busy} disabled={!text.trim()}>
          Speichern
        </Button>
      </div>
    </div>
  );
}
