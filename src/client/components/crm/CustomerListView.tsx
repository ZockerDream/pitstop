import { ArrowDown, ArrowUp, Plus, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { today as getToday } from '../../../shared/dates';
import { customerNumberLabel, formatEuro, formatRelative } from '../../../shared/format';
import { customerKindLabel, customerStatusLabel, customerStatusTone } from '../../../shared/labels';
import { customerOpenAmount, lastContactDate, normalize, normalizePlate } from '../../../shared/selectors';
import { CUSTOMER_KINDS, type CustomerKind, type CustomerStatus } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { useModals } from '../../lib/modals';
import { navigate } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, PageHeader } from '../ui/Card';
import { SearchInput, Select } from '../ui/Field';
import { Avatar, EmptyState, Plate, SegmentedControl, table } from '../ui/misc';
import { CustomerDrawer } from './CustomerDrawer';

type SortKey = 'name' | 'city' | 'lastContact';

export function CustomerListView({ customerId }: { customerId?: string }) {
  const data = useData();
  const can = useCan();
  const { open } = useModals();
  const today = getToday();
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<CustomerStatus | 'all'>('all');
  const [kind, setKind] = useState<CustomerKind | 'all'>('all');
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'name', dir: 1 });
  const showAmounts = can('customer:viewInvoices');

  const rows = useMemo(() => {
    const primary = new Map<string, string>();
    for (const c of data.contacts) if (c.isPrimary || !primary.has(c.customerId)) primary.set(c.customerId, c.name);
    const plates = new Map<string, string[]>();
    for (const v of data.vehicles) plates.set(v.customerId, [...(plates.get(v.customerId) ?? []), v.plate]);
    return data.customers.map((c) => ({
      customer: c,
      contact: primary.get(c.id) ?? '',
      plates: (plates.get(c.id) ?? []).sort(),
      lastContact: lastContactDate(data.notes, c.id),
      open: showAmounts ? customerOpenAmount(data.invoices, c.id) : 0,
    }));
  }, [data, showAmounts]);

  const counts = useMemo(() => {
    const base = rows.filter((r) => kind === 'all' || r.customer.kind === kind);
    return {
      all: base.length,
      active: base.filter((r) => r.customer.status === 'active').length,
      lead: base.filter((r) => r.customer.status === 'lead').length,
      inactive: base.filter((r) => r.customer.status === 'inactive').length,
    };
  }, [rows, kind]);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const list = rows.filter((r) => {
      if (status !== 'all' && r.customer.status !== status) return false;
      if (kind !== 'all' && r.customer.kind !== kind) return false;
      if (!q) return true;
      const c = r.customer;
      const qPlate = q.replace(/[\s-]/g, '');
      if (qPlate.length >= 2 && r.plates.some((p) => normalizePlate(p).includes(qPlate))) return true;
      return normalize(`${c.name} ${customerNumberLabel(c.number)} ${c.zip} ${c.city} ${r.contact}`).includes(q);
    });
    const value = (r: (typeof rows)[number]) => (sort.key === 'name' ? r.customer.name : sort.key === 'city' ? r.customer.city : (r.lastContact ?? ''));
    return list.sort((a, b) => value(a).localeCompare(value(b), 'de') * sort.dir);
  }, [rows, query, status, kind, sort]);

  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === 'lastContact' ? -1 : 1 }));
  const sortHeader = (label: string, k: SortKey) => (
    <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 uppercase hover:text-zinc-800">
      {label}
      {sort.key === k && (sort.dir === 1 ? <ArrowUp className="size-3" aria-hidden /> : <ArrowDown className="size-3" aria-hidden />)}
    </button>
  );

  return (
    <>
      <PageHeader
        title="Kunden"
        description={`${data.customers.length} Kundenakten mit Fahrzeugen, Ansprechpartnern, Historie und Rechnungen`}
        actions={
          can('customer:edit') && (
            <Button variant="primary" icon={Plus} onClick={() => open({ type: 'customer' })}>
              Neuer Kunde
            </Button>
          )
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 px-4 py-3">
          <SearchInput value={query} onChange={setQuery} placeholder="Name, Kennzeichen, Kundennummer, Ort …" className="w-full sm:w-80" />
          <SegmentedControl
            value={status}
            onChange={setStatus}
            options={[
              { value: 'all', label: 'Alle', count: counts.all },
              { value: 'active', label: 'Aktiv', count: counts.active },
              { value: 'lead', label: 'Lead', count: counts.lead },
              { value: 'inactive', label: 'Inaktiv', count: counts.inactive },
            ]}
          />
          <Select value={kind} onChange={(e) => setKind(e.target.value as CustomerKind | 'all')} className="w-auto" aria-label="Kundenart">
            <option value="all">Alle Kundenarten</option>
            {CUSTOMER_KINDS.map((k) => (
              <option key={k} value={k}>
                {customerKindLabel[k]}
              </option>
            ))}
          </Select>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={Users} title="Keine Kunden gefunden" text={data.customers.length ? 'Suche oder Filter anpassen.' : 'Lege den ersten Kunden an.'} />
        ) : (
          <div className={table.wrap}>
            <table className={table.table}>
              <thead>
                <tr>
                  <th className={table.th}>
                    {sortHeader('Kunde', 'name')}
                  </th>
                  <th className={table.th}>Nummer</th>
                  <th className={table.th}>
                    {sortHeader('Ort', 'city')}
                  </th>
                  <th className={table.th}>Fahrzeuge</th>
                  <th className={table.th}>Ansprechpartner</th>
                  <th className={table.th}>Status</th>
                  {showAmounts && <th className={table.thRight}>Offen</th>}
                  <th className={table.th}>
                    {sortHeader('Letzter Kontakt', 'lastContact')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visible.map(({ customer: c, contact, plates, lastContact, open: openAmount }) => (
                  <tr key={c.id} onClick={() => navigate(`/kunden/${c.id}`)} className={cx(table.trClick, c.id === customerId && 'bg-brand-50/50')}>
                    <td className={table.td}>
                      <div className="flex items-center gap-3">
                        <Avatar name={c.name} size="sm" square />
                        <div className="min-w-0">
                          <a href={`#/kunden/${c.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-medium text-zinc-900 hover:underline">
                            {c.name}
                          </a>
                          <div className="text-xs text-zinc-500">{customerKindLabel[c.kind]}</div>
                        </div>
                      </div>
                    </td>
                    <td className={cx(table.td, 'whitespace-nowrap text-zinc-500 tabular-nums')}>{customerNumberLabel(c.number)}</td>
                    <td className={table.td}>{c.city}</td>
                    <td className={table.td}>
                      {plates.length ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {plates.slice(0, 2).map((p) => (
                            <Plate key={p} plate={p} size="sm" />
                          ))}
                          {plates.length > 2 && <span className="text-xs text-zinc-500">+{plates.length - 2}</span>}
                        </div>
                      ) : (
                        <span className="text-zinc-400">–</span>
                      )}
                    </td>
                    <td className={cx(table.td, 'text-zinc-600')}>{contact || '–'}</td>
                    <td className={table.td}>
                      <Badge tone={customerStatusTone[c.status]} dot>
                        {customerStatusLabel[c.status]}
                      </Badge>
                    </td>
                    {showAmounts && <td className={cx(table.tdRight, openAmount ? 'text-zinc-900' : 'text-zinc-400')}>{openAmount ? formatEuro(openAmount) : '–'}</td>}
                    <td className={cx(table.td, 'whitespace-nowrap text-zinc-500')}>{lastContact ? formatRelative(lastContact, today) : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {customerId && <CustomerDrawer customerId={customerId} onClose={() => navigate('/kunden')} />}
    </>
  );
}
