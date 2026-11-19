import { Receipt } from 'lucide-react';
import { useMemo, useState } from 'react';
import { addMonths, monthEnd, monthKey, monthStart, today as getToday } from '../../../shared/dates';
import { formatDate, formatEuro } from '../../../shared/format';
import { expenseCategoryLabel, expenseCategoryTone } from '../../../shared/labels';
import { expenseGross, normalize } from '../../../shared/selectors';
import { EXPENSE_CATEGORIES, type ExpenseCategory } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { useData } from '../../store/AppStore';
import { Badge } from '../ui/Badge';
import { Card, Stat } from '../ui/Card';
import { SearchInput, Select } from '../ui/Field';
import { EmptyState, SegmentedControl, table } from '../ui/misc';
import { ExpenseCategoryBreakdown } from './ExpenseCategoryBreakdown';

type Period = 'month' | 'lastMonth' | '3months' | 'all';

export function ExpenseTable() {
  const data = useData();
  const today = getToday();
  const [period, setPeriod] = useState<Period>('month');
  const [category, setCategory] = useState<ExpenseCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  const range = useMemo(() => {
    const current = monthKey(today);
    if (period === 'month') return { from: monthStart(current), to: monthEnd(current) };
    if (period === 'lastMonth') {
      const last = monthKey(addMonths(today, -1));
      return { from: monthStart(last), to: monthEnd(last) };
    }
    if (period === '3months') return { from: addMonths(today, -3), to: monthEnd(current) };
    return { from: '0000-01-01', to: '9999-12-31' };
  }, [period, today]);

  const inRange = data.expenses.filter((e) => e.date >= range.from && e.date <= range.to);
  const q = normalize(query.trim());
  const visible = inRange
    .filter((e) => category === 'all' || e.category === category)
    .filter((e) => !q || normalize(`${e.supplier} ${e.description}`).includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
  const netSum = inRange.reduce((s, e) => s + e.netCents, 0);
  const unpaid = inRange.filter((e) => !e.paid);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Ausgaben im Zeitraum (netto)" value={formatEuro(netSum)} hint={`${inRange.length} Belege`} />
        <Stat label="Davon noch nicht bezahlt (brutto)" value={formatEuro(unpaid.reduce((s, e) => s + expenseGross(e), 0))} hint={`${unpaid.length} Belege`} tone={unpaid.length ? 'red' : 'default'} />
        <Stat label="Größter Posten" value={inRange.length ? expenseCategoryLabel[topCategory(inRange)] : '–'} />
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
            <SegmentedControl
              value={period}
              onChange={setPeriod}
              options={[
                { value: 'month', label: 'Dieser Monat' },
                { value: 'lastMonth', label: 'Vormonat' },
                { value: '3months', label: '3 Monate' },
                { value: 'all', label: 'Alle' },
              ]}
            />
            <Select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory | 'all')} className="w-auto" aria-label="Kategorie">
              <option value="all">Alle Kategorien</option>
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {expenseCategoryLabel[c]}
                </option>
              ))}
            </Select>
            <SearchInput value={query} onChange={setQuery} placeholder="Lieferant …" className="w-full sm:w-52" />
          </div>
          {visible.length === 0 ? (
            <EmptyState icon={Receipt} title="Keine Ausgaben" text="Im gewählten Zeitraum gibt es keine passenden Belege." />
          ) : (
            <div className={table.wrap}>
              <table className={table.table}>
                <thead>
                  <tr>
                    <th className={table.th}>Datum</th>
                    <th className={table.th}>Lieferant</th>
                    <th className={table.th}>Kategorie</th>
                    <th className={table.thRight}>Netto</th>
                    <th className={table.thRight}>MwSt.</th>
                    <th className={table.thRight}>Brutto</th>
                    <th className={table.th}>Bezahlt</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr key={e.id} className={table.tr}>
                      <td className={cx(table.td, 'whitespace-nowrap text-zinc-600')}>{formatDate(e.date)}</td>
                      <td className={table.td}>
                        <div className="font-medium text-zinc-900">{e.supplier}</div>
                        {e.description && <div className="max-w-[280px] truncate text-xs text-zinc-500">{e.description}</div>}
                      </td>
                      <td className={table.td}>
                        <Badge tone={expenseCategoryTone[e.category]}>{expenseCategoryLabel[e.category]}</Badge>
                      </td>
                      <td className={table.tdRight}>{formatEuro(e.netCents)}</td>
                      <td className={cx(table.tdRight, 'text-zinc-500')}>{e.vatRate} %</td>
                      <td className={cx(table.tdRight, 'font-medium')}>{formatEuro(expenseGross(e))}</td>
                      <td className={table.td}>{e.paid ? <Badge tone="green">Ja</Badge> : <Badge tone="amber">Offen</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <ExpenseCategoryBreakdown expenses={inRange} />
      </div>
    </div>
  );
}

function topCategory(list: { category: ExpenseCategory; netCents: number }[]): ExpenseCategory {
  const sums = new Map<ExpenseCategory, number>();
  for (const e of list) sums.set(e.category, (sums.get(e.category) ?? 0) + e.netCents);
  return [...sums.entries()].sort((a, b) => b[1] - a[1])[0][0];
}
