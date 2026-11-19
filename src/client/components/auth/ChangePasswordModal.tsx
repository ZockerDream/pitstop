import { useStore } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { useToast } from '../ui/feedback';
import { Modal } from '../ui/Modal';
import { PasswordForm } from './PasswordForm';

export function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const { reload } = useStore();
  return (
    <Modal title="Passwort ändern" description="Andere angemeldete Geräte werden danach abgemeldet." size="sm" onClose={onClose} dismissOnOverlay={false}>
      <PasswordForm
        onDone={() => {
          toast.show({ title: 'Passwort geändert' });
          void reload();
          onClose();
        }}
        renderActions={(busy) => (
          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={onClose}>Abbrechen</Button>
            <Button type="submit" variant="primary" loading={busy}>
              Speichern
            </Button>
          </div>
        )}
      />
    </Modal>
  );
}
