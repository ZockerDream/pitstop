import { Check, Copy, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Zeigt ein Startpasswort genau einmal an. */
export function PasswordRevealModal({ title, email, password, onClose }: { title: string; email: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Modal
      title={title}
      size="sm"
      onClose={onClose}
      dismissOnOverlay={false}
      footer={
        <Button variant="primary" onClick={onClose}>
          Fertig
        </Button>
      }
    >
      <p className="text-sm text-zinc-600">
        Startpasswort für <strong className="text-zinc-900">{email}</strong>:
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-2 pl-3">
        <code className="flex-1 font-mono text-base tracking-wide text-zinc-900 select-all">{password}</code>
        <Button size="sm" icon={copied ? Check : Copy} onClick={() => void copy()}>
          {copied ? 'Kopiert' : 'Kopieren'}
        </Button>
      </div>
      <p className="mt-3 flex items-start gap-2 text-xs text-amber-800">
        <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Das Passwort wird nur jetzt angezeigt. Bitte sicher weitergeben; beim ersten Anmelden muss ein eigenes Passwort festgelegt werden.
      </p>
    </Modal>
  );
}
