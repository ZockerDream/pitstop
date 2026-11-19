import { CalendarClock, Car, FileText, Fuel, Gauge, Pencil, Plus } from 'lucide-react';
import { diffDays, today as getToday } from '../../../shared/dates';
import { formatDate, formatEuro, formatNumber } from '../../../shared/format';
import { fuelLabel } from '../../../shared/labels';
import { inspectionState, invoiceTotals, vehicleLabel } from '../../../shared/selectors';
import type { Invoice, Vehicle } from '../../../shared/types';
import { useModals } from '../../lib/modals';
import { navigate } from '../../lib/router';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState, Plate } from '../ui/misc';

/** Fahrzeuge eines Kunden mit HU-Status, km-Stand und letzter Rechnung. */
export function VehicleCards({
  customerId,
  vehicles,
  invoices,
  canEdit,
  canInvoice,
}: {
  customerId: string;
  vehicles: Vehicle[];
  invoices: Invoice[];
  canEdit: boolean;
  canInvoice: boolean;
}) {
  const { open } = useModals();
  const today = getToday();
  return (
    <div className="space-y-3">
      {vehicles.length === 0 && <EmptyState icon={Car} title="Noch keine Fahrzeuge" text="Fahrzeuge mit Kennzeichen, km-Stand und HU-Termin erfassen." compact />}
      {[...vehicles]
        .sort((a, b) => a.plate.localeCompare(b.plate))
        .map((v) => {
          const hu = inspectionState(v, today);
          const own = invoices.filter((i) => i.vehicleId === v.id).sort((a, b) => b.issueDate.localeCompare(a.issueDate));
          const last = own[0];
          return (
            <div key={v.id} className="rounded-lg border border-zinc-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Plate plate={v.plate} />
                    <span className="font-medium text-zinc-900">{vehicleLabel(v)}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-600">
                    <span className="inline-flex items-center gap-1.5">
                      <Gauge className="size-3.5 text-zinc-400" aria-hidden />
                      {v.mileage !== null ? `${formatNumber(v.mileage)} km` : 'km unbekannt'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Fuel className="size-3.5 text-zinc-400" aria-hidden />
                      {fuelLabel[v.fuel]}
                      {v.powerKw ? ` · ${v.powerKw} kW (${Math.round(v.powerKw * 1.36)} PS)` : ''}
                    </span>
                    {v.firstRegistration && <span>EZ {formatDate(v.firstRegistration).slice(3)}</span>}
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <Badge tone={hu === 'overdue' ? 'red' : hu === 'soon' ? 'amber' : hu === 'ok' ? 'green' : 'gray'} dot>
                    <CalendarClock className="size-3" aria-hidden />
                    {v.nextInspection
                      ? hu === 'overdue'
                        ? `HU überfällig (${formatDate(v.nextInspection).slice(3)})`
                        : `HU ${formatDate(v.nextInspection).slice(3)}${hu === 'soon' ? ` · in ${diffDays(today, v.nextInspection)} T.` : ''}`
                      : 'HU unbekannt'}
                  </Badge>
                </div>
              </div>
              {v.vin && <div className="mt-2 font-mono text-[11px] tracking-wider text-zinc-500">FIN {v.vin}</div>}
              {v.notes && <p className="mt-2 rounded-md bg-zinc-50 px-2.5 py-1.5 text-xs text-zinc-600">{v.notes}</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-3">
                {canInvoice && last && (
                  <button type="button" onClick={() => navigate(`/finanzen/rechnungen/${last.id}`)} className="mr-auto text-xs text-zinc-500 hover:text-zinc-900 hover:underline">
                    Zuletzt: #{last.number} vom {formatDate(last.issueDate)} · {formatEuro(invoiceTotals(last).gross)} · {own.length} {own.length === 1 ? 'Rechnung' : 'Rechnungen'}
                  </button>
                )}
                {!(canInvoice && last) && <span className="mr-auto" />}
                {canInvoice && (
                  <Button size="xs" icon={FileText} onClick={() => open({ type: 'invoice', customerId, vehicleId: v.id })}>
                    Rechnung
                  </Button>
                )}
                {canEdit && (
                  <Button size="xs" variant="ghost" icon={Pencil} onClick={() => open({ type: 'vehicle', customerId, vehicleId: v.id })}>
                    Bearbeiten
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      {canEdit && (
        <Button size="sm" icon={Plus} onClick={() => open({ type: 'vehicle', customerId })}>
          Fahrzeug hinzufügen
        </Button>
      )}
    </div>
  );
}
