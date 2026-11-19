import { Button } from '../ui/Button';
import { Spinner } from '../ui/misc';

export function Splash({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <div className="grid h-full place-items-center bg-zinc-50">
      {error ? (
        <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-center shadow-xs">
          <p className="text-sm font-medium text-zinc-900">Daten konnten nicht geladen werden</p>
          <p className="mt-1 text-sm text-zinc-500">{error}</p>
          {onRetry && (
            <Button className="mt-4" variant="primary" onClick={onRetry}>
              Erneut versuchen
            </Button>
          )}
        </div>
      ) : (
        <Spinner label="Pitstop wird geladen …" />
      )}
    </div>
  );
}
