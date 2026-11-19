import type { ApiErrorBody } from '../../shared/types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

type Handler = (err: ApiError) => void;
let onAuthProblem: Handler | null = null;

/** Wird bei 401 bzw. erzwungenem Passwortwechsel aufgerufen (App wechselt zur Anmeldung). */
export function setAuthProblemHandler(handler: Handler | null): void {
  onAuthProblem = handler;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const hasBody = method !== 'GET' && method !== 'DELETE';
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(body ?? {}) : undefined,
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Keine Verbindung zum Server. Bitte später erneut versuchen.');
  }
  if (res.status === 204) return undefined as T;
  const data = (await res.json().catch(() => null)) as (T & Partial<ApiErrorBody>) | null;
  if (!res.ok) {
    const e = data?.error;
    const err = new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? `Fehler ${res.status}`, e?.fields ?? {});
    if (res.status === 401 || err.code === 'PASSWORD_CHANGE_REQUIRED') onAuthProblem?.(err);
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Unerwarteter Fehler.';
}

export function fieldErrors(err: unknown): Record<string, string> {
  return err instanceof ApiError ? err.fields : {};
}
