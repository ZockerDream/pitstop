import { Table2, ChartColumn } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthKey, today as getToday } from '../../../shared/dates';
import { formatEuro, formatMonthLong, formatMonthShort } from '../../../shared/format';
import { revenueVsExpenses } from '../../../shared/selectors';
import { cx } from '../../lib/cx';
import { useData } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { Card, CardHeader } from '../ui/Card';
import { table } from '../ui/misc';

// Farben geprüft mit dem Dataviz-Validator (Kontrast, Farbsehschwächen): Indigo + Orange.
export const SERIES_COLORS = { primary: '#4f46e5', secondary: '#ea580c' };

interface Point {
  month: string;
  label: string;
  revenue: number;
  expenses: number;
}

function ChartTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: Point }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  const result = p.revenue - p.expenses;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1.5 font-medium text-zinc-900">{formatMonthLong(p.month)}</div>
      <Row color={SERIES_COLORS.primary} label="Umsatz" value={formatEuro(p.revenue)} />
      <Row color={SERIES_COLORS.secondary} label="Ausgaben" value={formatEuro(p.expenses)} />
      <div className="mt-1.5 flex justify-between gap-6 border-t border-zinc-100 pt-1.5">
        <span className="text-zinc-500">Ergebnis</span>
        <span className={cx('font-medium tabular-nums', result >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{formatEuro(result)}</span>
      </div>
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-0.5">
      <span className="flex items-center gap-1.5 text-zinc-600">
        <span className="size-2 rounded-sm" style={{ background: color }} aria-hidden />
        {label}
      </span>
      <span className="font-medium text-zinc-900 tabular-nums">{value}</span>
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex items-center gap-4 text-xs text-zinc-600">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} aria-hidden />
          {i.label}
        </span>
      ))}
    </div>
  );
}

const thousand = (cents: number) => `${Math.round(cents / 100_000).toLocaleString('de-DE')} T€`;

export function RevenueExpenseChart() {
  const data = useData();
  const today = getToday();
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const points = useMemo<Point[]>(
    () =>
      revenueVsExpenses(data.invoices, data.expenses, today).map((p) => ({
        ...p,
        label: `${formatMonthShort(p.month)}${p.month === monthKey(today) ? ' (lfd.)' : ''}`,
      })),
    [data.invoices, data.expenses, today],
  );

  return (
    <Card className="h-full">
      <CardHeader
        title="Umsatz vs. Ausgaben"
        description="Netto, letzte 6 Monate"
        actions={
          <>
            <Legend
              items={[
                { color: SERIES_COLORS.primary, label: 'Umsatz' },
                { color: SERIES_COLORS.secondary, label: 'Ausgaben' },
              ]}
            />
            <Button
              size="xs"
              variant="ghost"
              icon={view === 'chart' ? Table2 : ChartColumn}
              onClick={() => setView(view === 'chart' ? 'table' : 'chart')}
              aria-label={view === 'chart' ? 'Als Tabelle anzeigen' : 'Als Diagramm anzeigen'}
              title={view === 'chart' ? 'Als Tabelle anzeigen' : 'Als Diagramm anzeigen'}
            />
          </>
        }
      />
      {view === 'chart' ? (
        <div className="h-[420px] px-2 pt-4 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={points} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 12, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke="#f4f4f5" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} tickFormatter={thousand} width={64} />
              <Tooltip cursor={{ fill: '#f4f4f5' }} content={(props) => <ChartTooltip active={props.active} payload={props.payload as readonly { payload?: Point }[]} />} />
              <Bar dataKey="revenue" name="Umsatz" fill={SERIES_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={36} />
              <Bar dataKey="expenses" name="Ausgaben" fill={SERIES_COLORS.secondary} radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className={table.wrap}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={table.th}>Monat</th>
                <th className={table.thRight}>Umsatz</th>
                <th className={table.thRight}>Ausgaben</th>
                <th className={table.thRight}>Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.month} className={table.tr}>
                  <td className={table.td}>{formatMonthLong(p.month)}</td>
                  <td className={table.tdRight}>{formatEuro(p.revenue)}</td>
                  <td className={table.tdRight}>{formatEuro(p.expenses)}</td>
                  <td className={cx(table.tdRight, p.revenue - p.expenses >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{formatEuro(p.revenue - p.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
