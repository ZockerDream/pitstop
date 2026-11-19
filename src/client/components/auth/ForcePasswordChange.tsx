import type { User } from '../../../shared/types';
import { Button } from '../ui/Button';
import { AuthLayout, useLegal } from './LoginPage';
import { PasswordForm } from './PasswordForm';

/** Erste Anmeldung bzw. nach Zurücksetzen: Vor allem anderen ein eigenes Passwort festlegen. */
export function ForcePasswordChange({ user, onDone, onLogout }: { user: User; onDone: (user: User) => void; onLogout: () => Promise<void> }) {
  const legal = useLegal();
  return (
    <AuthLayout legal={legal}>
      <h1 className="text-lg font-semibold text-zinc-900">Neues Passwort festlegen</h1>
      <p className="mt-1 mb-5 text-sm text-zinc-500">
        Hallo {user.displayName}, bitte lege vor dem ersten Arbeiten ein eigenes Passwort fest. Das Startpasswort gilt dann nicht mehr.
      </p>
      <PasswordForm
        onDone={onDone}
        renderActions={(busy) => (
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" onClick={() => void onLogout()}>
              Abmelden
            </Button>
            <Button type="submit" variant="primary" loading={busy}>
              Passwort speichern
            </Button>
          </div>
        )}
      />
    </AuthLayout>
  );
}
