import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// Modal-Host: alle Formulare werden zentral geöffnet (aus „+ Neu“, Befehlspalette, Drawern, Dashboard).

export type ModalRequest =
  | { type: 'customer'; customerId?: string }
  | { type: 'invoice'; customerId?: string; vehicleId?: string }
  | { type: 'vehicle'; customerId: string; vehicleId?: string }
  | { type: 'expense' }
  | { type: 'absence'; employeeId?: string; approveDirectly?: boolean }
  | { type: 'sick'; employeeId: string }
  | { type: 'employee'; employeeId?: string }
  | { type: 'timesheet'; employeeId: string; month?: string }
  | { type: 'user'; userId?: string }
  | { type: 'password' }
  | { type: 'revealPassword'; title: string; email: string; password: string };

interface ModalApi {
  current: ModalRequest | null;
  open: (request: ModalRequest) => void;
  close: () => void;
}

const ModalContext = createContext<ModalApi | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<ModalRequest | null>(null);
  const open = useCallback((request: ModalRequest) => setCurrent(request), []);
  const close = useCallback(() => setCurrent(null), []);
  const value = useMemo(() => ({ current, open, close }), [current, open, close]);
  return <ModalContext.Provider value={value}>{children}</ModalContext.Provider>;
}

export function useModals(): ModalApi {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModals außerhalb von ModalProvider');
  return ctx;
}
