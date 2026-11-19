import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatHours, formatMonthLong, formatMonthShort, formatSignedHours } from '../../../shared/format';
import { Legend, SERIES_COLORS } from '../dashboard/RevenueExpenseChart';

interface Point {
  month: string;
  target: number;
  worked: number;
  recorded: boolean;
}

function HoursTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: Point }[] }) {
  const p = active ? payload?.[0]?.payload : undefined;
  if (!p) return null;
  return (
    <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-medium text-zinc-900">{formatMonthLong(p.month)}</div>
      {p.recorded ? (
        <>
          <div className="flex justify-between gap-6">
            <span className="text-zinc-600">Ist</span>
            <span className="font-medium tabular-nums">{formatHours(p.worked)}</span>
          </div>
          <div className="flex justify-between gap-6">
            <span className="text-zinc-600">Soll</span>
            <span className="font-medium tabular-nums">{formatHours(p.target)}</span>
          </div>
          <div className="mt-1 flex justify-between gap-6 border-t border-zinc-100 pt-1">
            <span className="text-zinc-600">Differenz</span>
            <span className="font-medium tabular-nums">{formatSignedHours(Math.round((p.worked - p.target) * 10) / 10)}</span>
          </div>
        </>
      ) : (
        <span className="text-zinc-500">Nicht erfasst</span>
      )}
    </div>
  );
}

/** Soll/Ist der letzten 6 Monate (gleiche, geprüfte Farben wie das Umsatzdiagramm). */
export function HoursChart({ points }: { points: Point[] }) {
  const chartData = points.map((p) => ({ ...p, label: formatMonthShort(p.month) }));
  return (
    <div className="rounded-lg border border-zinc-200 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-900">Soll und Ist, letzte 6 Monate</h3>
        <Legend
          items={[
            { color: SERIES_COLORS.primary, label: 'Ist' },
            { color: SERIES_COLORS.secondary, label: 'Soll' },
          ]}
        />
      </div>
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} barGap={2} barCategoryGap="30%" margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke="#f4f4f5" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: '#71717a', fontSize: 12 }} width={48} />
            <Tooltip cursor={{ fill: '#f4f4f5' }} content={(props) => <HoursTooltip active={props.active} payload={props.payload as readonly { payload?: Point }[]} />} />
            <Bar dataKey="worked" name="Ist" fill={SERIES_COLORS.primary} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="target" name="Soll" fill={SERIES_COLORS.secondary} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
