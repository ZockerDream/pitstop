import { Check, FileText, Send } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { addMonths, monthKey, today as getToday } from '../../../shared/dates';
import { formatDate, formatEuro } from '../../../shared/format';
import { invoiceStatusLabel, invoiceStatusTone } from '../../../shared/labels';
import { byId, daysOverdue, invoiceDisplayStatus, invoiceTotals, normalize } from '../../../shared/selectors';
import type { InvoiceDisplayStatus } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { navigate } from '../../lib/router';
import { useData } from '../../store/AppStore';
import { useActions, useRun } from '../../store/mutations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, Stat } from '../ui/Card';
import { SearchInput, Select } from '../ui/Field';
import { EmptyState, Plate, SegmentedControl, table } from '../ui/misc';

type StatusFilter = InvoiceDisplayStatus | 'all';
type Period = 'month' | '3months' | 'all';

export function InvoiceTable({ selectedId, initialStatus }: { selectedId?: string; initialStatus: string | null }) {
  const data = useData();
  const actions = useActions();
  const run = useRun();
  const today = getToday();
  const [status, setStatus] = useState<StatusFilter>(() => (['open', 'overdue', 'paid'].includes(initialStatus ?? '') ? (initialStatus as StatusFilter) : 'all'));
  const [period, setPeriod] = useState<Period>('all');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const selectedRow = useRef<HTMLTableRowElement>(null);
  const customers = useMemo(() => byId(data.customers), [data.customers]);
  const vehicles = useMemo(() => byId(data.vehicles), [data.vehicles]);

  const rows = useMemo(
    () =>
      data.invoices.map((inv) => ({
        inv,
        status: invoiceDisplayStatus(inv, today),
        totals: invoiceTotals(inv),
        customer: customers.get(inv.customerId)?.name ?? 'Unbekannt',
        plate: inv.vehicleId ? (vehicles.get(inv.vehicleId)?.plate ?? '') : '',
      })),
    [data.invoices, customers, vehicles, today],
  );

  const inPeriod = (date: string) => (period === 'all' ? true : period === 'month' ? monthKey(date) === monthKey(today) : date >= addMonths(today, -3));
  const base = rows.filter((r) => inPeriod(r.inv.issueDate));
  const counts = {
    all: base.length,
    open: base.filter((r) => r.status !== 'paid').length,
    overdue: base.filter((r) => r.status === 'overdue').length,
    paid: base.filter((r) => r.status === 'paid').length,
  };
  const q = normalize(query.trim());
  const visible = base
    // „Offen“ = noch nicht bezahlt (inklusive überfälliger), passend zur KPI „Offene Rechnungen“.
    .filter((r) => (status === 'all' ? true : status === 'open' ? r.status !== 'paid' : r.status === status))
    .filter((r) => !q || normalize(`#${r.inv.number} ${r.inv.number} ${r.customer} ${r.plate} ${r.plate.replace(/[\s-]/g, '')}`).includes(q))
    .sort((a, b) => b.inv.number - a.inv.number);

  const openSum = rows.filter((r) => r.status !== 'paid').reduce((s, r) => s + r.totals.gross, 0);
  const overdueRows = rows.filter((r) => r.status === 'overdue');
  const paidThisMonth = rows.filter((r) => r.inv.paidAt && monthKey(r.inv.paidAt) === monthKey(today)).reduce((s, r) => s + r.totals.gross, 0);

  useEffect(() => {
    selectedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await run(fn);
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Offen (brutto)" value={formatEuro(openSum)} hint={`${rows.filter((r) => r.status !== 'paid').length} Rechnungen`} />
        <Stat
          label="Überfällig"
          value={formatEuro(overdueRows.reduce((s, r) => s + r.totals.gross, 0))}
          hint={`${overdueRows.length} Rechnungen`}
          tone={overdueRows.length ? 'red' : 'default'}
        />
        <Stat label="Bezahlt in diesem Monat" value={formatEuro(paidThisMonth)} tone="green" />
      </div>
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Nummer, Kunde oder Kennzeichen …" className="w-full sm:w-72" />
          <SegmentedControl
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Alle', count: counts.all },
              { value: 'open', label: 'Offen', count: counts.open },
              { value: 'overdue', label: 'Überfällig', count: counts.overdue },
              { value: 'paid', label: 'Bezahlt', count: counts.paid },
            ]}
          />
          <Select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-auto" aria-label="Zeitraum">
            <option value="all">Alle Zeiträume</option>
            <option value="3months">Letzte 3 Monate</option>
            <option value="month">Dieser Monat</option>
          </Select>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={FileText} title="Keine Rechnungen" text={data.invoices.length ? 'Filter anpassen.' : 'Die erste Rechnung über „Neue Rechnung erstellen“ anlegen.'} />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>Nr.</th>
                  <th className={table.th}>Kunde</th>
                  <th className={table.th}>Datum</th>
                  <th className={table.th}>Fällig</th>
                  <th className={table.thRight}>Netto</th>
                  <th className={table.thRight}>Brutto</th>
                  <th className={table.th}>Status</th>
                  <th className={table.thRight}>
                    <span className="sr-only">Aktionen</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ inv, status: s, totals, customer, plate }) => (
                  <tr
                    key={inv.id}
                    ref={inv.id === selectedId ? selectedRow : undefined}
                    onClick={() => navigate(`/finanzen/rechnungen/${inv.id}`)}
                    className={cx(table.trClick, inv.id === selectedId && 'bg-brand-50/60')}
                  >
                    <td className={cx(table.td, 'font-medium tabular-nums')}>#{inv.number}</td>
                    <td className={cx(table.td, 'max-w-[280px]')}>
                      <div className="truncate">{customer}</div>
                      {plate && (
                        <div className="mt-1">
                          <Plate plate={plate} size="sm" />
                        </div>
                      )}
                    </td>
                    <td className={cx(table.td, 'whitespace-nowrap text-zinc-600')}>{formatDate(inv.issueDate)}</td>
                    <td className={cx(table.td, 'whitespace-nowrap', s === 'overdue' ? 'font-medium text-rose-700' : 'text-zinc-600')}>{formatDate(inv.dueDate)}</td>
                    <td className={cx(table.tdRight, 'text-zinc-600')}>{formatEuro(totals.net)}</td>
                    <td className={cx(table.tdRight, 'font-medium')}>{formatEuro(totals.gross)}</td>
                    <td className={table.td}>
                      <div className="flex items-center gap-1.5">
                        <Badge tone={invoiceStatusTone[s]} dot>
                          {invoiceStatusLabel[s]}
                          {s === 'overdue' && <span className="font-normal">· {daysOverdue(inv, today)} T.</span>}
                        </Badge>
                        {inv.dunningLevel > 0 && inv.status === 'open' && <Badge tone="orange">M{inv.dunningLevel}</Badge>}
                      </div>
                    </td>
                    <td className={table.tdRight} onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-1">
                        {s === 'overdue' && inv.dunningLevel < 3 && (
                          <Button size="xs" icon={Send} loading={busy === `r${inv.id}`} onClick={() => void act(`r${inv.id}`, () => actions.remindInvoice(inv.id))}>
                            Mahnen
                          </Button>
                        )}
                        {s !== 'paid' && (
                          <Button size="xs" icon={Check} loading={busy === `p${inv.id}`} onClick={() => void act(`p${inv.id}`, () => actions.payInvoice(inv.id))} title="Als bezahlt markieren">
                            Bezahlt
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
