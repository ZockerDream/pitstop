import { FileText, Pencil, StickyNote, UserX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { today as getToday } from '../../../shared/dates';
import { customerNumberLabel, formatDate, formatEuro } from '../../../shared/format';
import { customerKindLabel, customerStatusLabel, customerStatusTone, invoiceStatusLabel, invoiceStatusTone } from '../../../shared/labels';
import { customerOpenAmount, customerRevenue, employeeName, invoiceDisplayStatus, invoiceTotals } from '../../../shared/selectors';
import { CUSTOMER_STATUSES, type CustomerStatus } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { useModals } from '../../lib/modals';
import { navigate } from '../../lib/router';
import { pushRecent } from '../../lib/storage';
import { useCan, useData } from '../../store/AppStore';
import { useActions, useRun } from '../../store/mutations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { useConfirm } from '../ui/feedback';
import { Avatar, DetailList, EmptyState, table } from '../ui/misc';
import { Tabs } from '../ui/Tabs';
import { ContactCards } from './ContactCards';
import { VehicleCards } from './VehicleCards';
import { NoteComposer } from './NoteComposer';
import { NoteTimeline } from './NoteTimeline';

type Tab = 'overview' | 'vehicles' | 'contacts' | 'history' | 'invoices';

export function CustomerDrawer({ customerId, onClose }: { customerId: string; onClose: () => void }) {
  const data = useData();
  const can = useCan();
  const { open } = useModals();
  const actions = useActions();
  const run = useRun();
  const confirm = useConfirm();
  const today = getToday();
  const [tab, setTab] = useState<Tab>('overview');
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const customer = data.customers.find((c) => c.id === customerId);

  useEffect(() => {
    if (customer) pushRecent({ type: 'customer', id: customer.id });
  }, [customer]);

  const contacts = useMemo(() => data.contacts.filter((c) => c.customerId === customerId), [data.contacts, customerId]);
  const vehicles = useMemo(() => data.vehicles.filter((v) => v.customerId === customerId), [data.vehicles, customerId]);
  const notes = useMemo(() => data.notes.filter((n) => n.customerId === customerId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [data.notes, customerId]);
  const invoices = useMemo(() => data.invoices.filter((i) => i.customerId === customerId).sort((a, b) => b.number - a.number), [data.invoices, customerId]);

  if (!customer) {
    return (
      <Drawer title="Kunde nicht gefunden" onClose={onClose}>
        <EmptyState icon={UserX} title="Dieser Kunde existiert nicht (mehr)." />
      </Drawer>
    );
  }

  const owner = customer.ownerEmployeeId ? data.employees.find((e) => e.id === customer.ownerEmployeeId) : undefined;
  const canEdit = can('customer:edit');
  const canSeeInvoices = can('customer:viewInvoices');

  const changeStatus = async (status: CustomerStatus) => {
    if (status === customer.status) return;
    if (status === 'inactive') {
      const r = await confirm({
        title: 'Kunde auf „Inaktiv“ setzen?',
        message: 'Inaktive Kunden erhalten keine neuen Rechnungen. Der Status lässt sich jederzeit zurücksetzen.',
        confirmLabel: 'Inaktiv setzen',
        tone: 'danger',
      });
      if (!r.ok) return;
    }
    await run(() => actions.updateCustomer(customer.id, { status }, `Status: ${customerStatusLabel[status]}`));
  };

  const startNote = () => {
    setTab('history');
    window.setTimeout(() => composerRef.current?.focus(), 50);
  };

  const tabs = [
    { value: 'overview' as const, label: 'Übersicht' },
    { value: 'vehicles' as const, label: 'Fahrzeuge', count: vehicles.length },
    { value: 'contacts' as const, label: 'Ansprechpartner', count: contacts.length },
    { value: 'history' as const, label: 'Historie', count: notes.length },
    ...(canSeeInvoices ? [{ value: 'invoices' as const, label: 'Rechnungen', count: invoices.length }] : []),
  ];

  return (
    <Drawer
      onClose={onClose}
      leading={<Avatar name={customer.name} size="lg" square />}
      title={customer.name}
      subtitle={
        <>
          <span className="tabular-nums">{customerNumberLabel(customer.number)}</span>
          <span>·</span>
          <span>{customerKindLabel[customer.kind]}</span>
          {canEdit ? (
            <select
              value={customer.status}
              onChange={(e) => void changeStatus(e.target.value as CustomerStatus)}
              aria-label="Status ändern"
              className="rounded-full border border-zinc-200 bg-white py-0.5 pr-7 pl-2.5 text-xs font-medium text-zinc-700 focus:ring-2 focus:ring-brand-500/20 focus:outline-none"
            >
              {CUSTOMER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {customerStatusLabel[s]}
                </option>
              ))}
            </select>
          ) : (
            <Badge tone={customerStatusTone[customer.status]} dot>
              {customerStatusLabel[customer.status]}
            </Badge>
          )}
        </>
      }
      actions={
        <>
          {canSeeInvoices && customer.status !== 'inactive' && (
            <Button size="sm" variant="primary" icon={FileText} onClick={() => open({ type: 'invoice', customerId: customer.id })}>
              Rechnung erstellen
            </Button>
          )}
          <Button size="sm" icon={StickyNote} onClick={startNote}>
            Notiz
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" icon={Pencil} onClick={() => open({ type: 'customer', customerId: customer.id })}>
              Bearbeiten
            </Button>
          )}
        </>
      }
    >
      <div className="px-6 pt-3">
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </div>
      <div className="px-6 py-5">
        {tab === 'overview' && (
          <div className="space-y-6">
            {canSeeInvoices && (
              <div className="grid grid-cols-3 gap-3">
                <MiniStat label="Umsatz gesamt (netto)" value={formatEuro(customerRevenue(data.invoices, customer.id))} />
                <MiniStat label="Offen (brutto)" value={formatEuro(customerOpenAmount(data.invoices, customer.id))} />
                <MiniStat label="Rechnungen" value={String(invoices.length)} />
              </div>
            )}
            <DetailList
              items={[
                { label: 'Anschrift', value: [customer.street, `${customer.zip} ${customer.city}`.trim()].filter(Boolean).join(', ') },
                { label: 'Telefon', value: customer.phone && <a className="hover:underline" href={`tel:${customer.phone.replace(/\s/g, '')}`}>{customer.phone}</a> },
                { label: 'E-Mail', value: customer.email && <a className="text-brand-600 hover:underline" href={`mailto:${customer.email}`}>{customer.email}</a> },
                { label: 'Kundenart', value: customerKindLabel[customer.kind] },
                ...(customer.kind !== 'private' ? [{ label: 'USt-IdNr.', value: customer.vatId }] : []),
                { label: 'Zahlungsziel', value: `${customer.paymentTermDays} Tage` },
                { label: 'Kunde seit', value: formatDate(customer.createdAt) },
                { label: 'Zuständig', value: owner ? employeeName(owner) : '' },
                {
                  label: 'Tags',
                  value: customer.tags.length ? (
                    <span className="flex flex-wrap gap-1">
                      {customer.tags.map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </span>
                  ) : (
                    ''
                  ),
                },
              ]}
            />
          </div>
        )}
        {tab === 'vehicles' && (
          <VehicleCards customerId={customer.id} vehicles={vehicles} invoices={invoices} canEdit={canEdit} canInvoice={canSeeInvoices && customer.status !== 'inactive'} />
        )}
        {tab === 'contacts' && <ContactCards customerId={customer.id} contacts={contacts} canEdit={canEdit} />}
        {tab === 'history' && (
          <div className="space-y-6">
            <NoteComposer customerId={customer.id} textareaRef={composerRef} />
            <NoteTimeline notes={notes} today={today} />
          </div>
        )}
        {tab === 'invoices' && canSeeInvoices && (
          <div className="overflow-hidden rounded-lg border border-zinc-200">
            {invoices.length === 0 ? (
              <EmptyState icon={FileText} title="Noch keine Rechnungen" compact />
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-zinc-50">
                  <tr>
                    <th className={table.th}>Nr.</th>
                    <th className={table.th}>Datum</th>
                    <th className={table.thRight}>Brutto</th>
                    <th className={table.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const status = invoiceDisplayStatus(inv, today);
                    return (
                      <tr key={inv.id} className={table.trClick} onClick={() => navigate(`/finanzen/rechnungen/${inv.id}`)}>
                        <td className={cx(table.td, 'font-medium tabular-nums')}>#{inv.number}</td>
                        <td className={table.td}>{formatDate(inv.issueDate)}</td>
                        <td className={table.tdRight}>{formatEuro(invoiceTotals(inv).gross)}</td>
                        <td className={table.td}>
                          <Badge tone={invoiceStatusTone[status]} dot>
                            {invoiceStatusLabel[status]}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-zinc-200 bg-zinc-50 font-medium">
                    <td className={table.td} colSpan={2}>
                      Summe
                    </td>
                    <td className={table.tdRight}>{formatEuro(invoices.reduce((s, i) => s + invoiceTotals(i).gross, 0))}</td>
                    <td className={table.td} />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        )}
      </div>
    </Drawer>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2.5">
      <div className="text-[11px] font-medium text-zinc-500">{label}</div>
      <div className="mt-0.5 text-sm font-semibold text-zinc-900 tabular-nums">{value}</div>
    </div>
  );
}
