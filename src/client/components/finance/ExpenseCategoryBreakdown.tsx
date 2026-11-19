import { PieChart } from 'lucide-react';
import { formatEuro } from '../../../shared/format';
import { expenseCategoryColor, expenseCategoryLabel } from '../../../shared/labels';
import type { Expense } from '../../../shared/types';
import { Card, CardHeader } from '../ui/Card';
import { EmptyState } from '../ui/misc';

/** Ausgaben nach Kategorie als beschriftete Balken (Werte stehen immer als Text daneben). */
export function ExpenseCategoryBreakdown({ expenses }: { expenses: Expense[] }) {
  const sums = new Map<Expense['category'], number>();
  for (const e of expenses) sums.set(e.category, (sums.get(e.category) ?? 0) + e.netCents);
  const rows = [...sums.entries()].sort((a, b) => b[1] - a[1]);
  const total = rows.reduce((s, [, v]) => s + v, 0);
  const max = rows[0]?.[1] ?? 0;
  return (
    <Card className="h-fit">
      <CardHeader title="Ausgaben nach Kategorie" description="Netto, gewählter Zeitraum" />
      {rows.length === 0 ? (
        <EmptyState icon={PieChart} title="Keine Daten" compact />
      ) : (
        <ul className="space-y-3 px-5 py-4">
          {rows.map(([category, value]) => (
            <li key={category}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-zinc-700">{expenseCategoryLabel[category]}</span>
                <span className="text-zinc-900 tabular-nums">
                  {formatEuro(value)} <span className="text-xs text-zinc-500">({Math.round((value / total) * 100)} %)</span>
                </span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
                <div className="h-full rounded-full" style={{ width: `${Math.max(2, (value / max) * 100)}%`, background: expenseCategoryColor[category] }} />
              </div>
            </li>
          ))}
          <li className="flex justify-between border-t border-zinc-100 pt-3 text-sm font-medium">
            <span>Gesamt</span>
            <span className="tabular-nums">{formatEuro(total)}</span>
          </li>
        </ul>
      )}
    </Card>
  );
}
