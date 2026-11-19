import { Lock } from 'lucide-react';
import { navigate } from '../../lib/router';
import { Button } from '../ui/Button';
import { EmptyState } from '../ui/misc';

export function NoAccess() {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-xl border border-zinc-200 bg-white shadow-xs">
      <EmptyState
        icon={Lock}
        title="Kein Zugriff"
        text="Diese Ansicht ist der Geschäftsführung vorbehalten."
        action={
          <Button variant="primary" onClick={() => navigate('/dashboard')}>
            Zum Dashboard
          </Button>
        }
      />
    </div>
  );
}
