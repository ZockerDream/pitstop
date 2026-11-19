import { Check, FileX, Send, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { today as getToday } from '../../../shared/dates';
import { customerNumberLabel, formatDate, formatDateTime, formatEuro, formatNumber } from '../../../shared/format';
import { invoiceStatusLabel, invoiceStatusTone, unitLabel } from '../../../shared/labels';
import { lineTotal } from '../../../shared/money';
import { daysOverdue, invoiceDisplayStatus, invoiceTotals, vehicleLabel } from '../../../shared/selectors';
import { navigate } from '../../lib/router';
import { pushRecent } from '../../lib/storage';
import { useData } from '../../store/AppStore';
import { useActions, useRun } from '../../store/mutations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';
import { EmptyState } from '../ui/misc';

/** Rechnungsvorschau (rein lesend) mit Briefkopf aus den Firmendaten. */
export function InvoiceDrawer({ invoiceId, onClose }: { invoiceId: string; onClose: () => void }) {
  const data = useData();
  const actions = useActions();
  const run = useRun();
  const today = getToday();
  const [busy, setBusy] = useState<string | null>(null);
  const inv = data.invoices.find((i) => i.id === invoiceId);

  useEffect(() => {
    if (inv) pushRecent({ type: 'invoice', id: inv.id });
  }, [inv]);

  if (!inv) {
    return (
      <Drawer title="Rechnung nicht gefunden" onClose={onClose}>
        <EmptyState icon={FileX} title="Diese Rechnung existiert nicht." />
      </Drawer>
    );
  }
  const customer = data.customers.find((c) => c.id === inv.customerId);
  const contact = data.contacts.find((c) => c.customerId === inv.customerId && c.isPrimary);
  const vehicle = inv.vehicleId ? data.vehicles.find((v) => v.id === inv.vehicleId) : undefined;
  const status = invoiceDisplayStatus(inv, today);
  const totals = invoiceTotals(inv);
  const company = data.company;
  const act = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    await run(fn);
    setBusy(null);
  };

  const history = [
    { label: 'Erstellt', date: formatDateTime(inv.createdAt) },
    ...(inv.dunningLevel > 0 && inv.lastRemindedAt ? [{ label: `Zuletzt gemahnt (Stufe ${inv.dunningLevel})`, date: formatDate(inv.lastRemindedAt) }] : []),
    ...(inv.paidAt ? [{ label: 'Bezahlt', date: formatDate(inv.paidAt) }] : []),
  ];

  return (
    <Drawer
      wide
      onClose={onClose}
      title={`Rechnung #${inv.number}`}
      subtitle={
        <>
          <span>{customer?.name}</span>
          <Badge tone={invoiceStatusTone[status]} dot>
            {invoiceStatusLabel[status]}
            {status === 'overdue' && <span className="font-normal">· seit {daysOverdue(inv, today)} Tagen</span>}
          </Badge>
          {inv.dunningLevel > 0 && inv.status === 'open' && <Badge tone="orange">Mahnstufe {inv.dunningLevel}</Badge>}
        </>
      }
      actions={
        <>
          {inv.status === 'open' && (
            <Button size="sm" variant="success" icon={Check} loading={busy === 'pay'} onClick={() => void act('pay', () => actions.payInvoice(inv.id))}>
              Als bezahlt markieren
            </Button>
          )}
          {status === 'overdue' && inv.dunningLevel < 3 && (
            <Button size="sm" icon={Send} loading={busy === 'remind'} onClick={() => void act('remind', () => actions.remindInvoice(inv.id))}>
              Mahnen
            </Button>
          )}
          {customer && (
            <Button size="sm" variant="ghost" icon={Users} onClick={() => navigate(`/kunden/${customer.id}`)}>
              Kunde öffnen
            </Button>
          )}
        </>
      }
    >
      <div className="bg-zinc-100/70 p-6">
        <article className="mx-auto rounded-lg border border-zinc-200 bg-white px-8 py-9 text-[13px] text-zinc-800 shadow-sm">
          <header className="flex items-start justify-between gap-6">
            <div>
              <div className="text-base font-semibold text-zinc-900">{company.name || 'Firmenname fehlt (Einstellungen)'}</div>
              <div className="mt-1 text-xs leading-relaxed text-zinc-500">
                {[company.street, `${company.zip} ${company.city}`.trim()].filter(Boolean).join(' · ')}
                {company.phone && <div>Tel. {company.phone}</div>}
                {company.email && <div>{company.email}</div>}
              </div>
            </div>
            {data.hasLogo && <img src="/api/public/logo" alt="" className="h-10 object-contain" />}
          </header>

          <div className="mt-8 grid grid-cols-2 gap-6">
            <div>
              <div className="text-[10px] text-zinc-400 underline">
                {company.name} · {company.street} · {company.zip} {company.city}
              </div>
              <div className="mt-2 leading-relaxed">
                <div className="font-medium">{customer?.name}</div>
                {contact && customer?.kind !== 'private' && <div>z. Hd. {contact.name}</div>}
                <div>{customer?.street}</div>
                <div>
                  {customer?.zip} {customer?.city}
                </div>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 self-start text-right text-xs">
              <dt className="text-zinc-500">Rechnungsnummer</dt>
              <dd className="font-medium tabular-nums">{inv.number}</dd>
              <dt className="text-zinc-500">Rechnungsdatum</dt>
              <dd>{formatDate(inv.issueDate)}</dd>
              <dt className="text-zinc-500">Kundennummer</dt>
              <dd className="tabular-nums">{customer ? customerNumberLabel(customer.number) : '–'}</dd>
              <dt className="text-zinc-500">Fällig am</dt>
              <dd>{formatDate(inv.dueDate)}</dd>
            </dl>
          </div>

          {vehicle && (
            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-1 rounded-md bg-zinc-50 px-4 py-3 text-xs sm:grid-cols-4">
              <div>
                <div className="text-zinc-500">Fahrzeug</div>
                <div className="font-medium text-zinc-900">{vehicleLabel(vehicle)}</div>
              </div>
              <div>
                <div className="text-zinc-500">Kennzeichen</div>
                <div className="font-medium text-zinc-900">{vehicle.plate}</div>
              </div>
              <div>
                <div className="text-zinc-500">FIN</div>
                <div className="font-mono text-zinc-900">{vehicle.vin || '–'}</div>
              </div>
              <div>
                <div className="text-zinc-500">km-Stand</div>
                <div className="font-medium text-zinc-900 tabular-nums">{inv.mileage != null ? `${formatNumber(inv.mileage)} km` : '–'}</div>
              </div>
            </div>
          )}

          <h3 className="mt-8 text-base font-semibold text-zinc-900">Rechnung</h3>
          <table className="mt-3 w-full">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-[11px] text-zinc-500 uppercase">
                <th className="py-2 pr-2 font-medium">Pos.</th>
                <th className="py-2 pr-2 font-medium">Beschreibung</th>
                <th className="py-2 pr-2 text-right font-medium">Menge</th>
                <th className="py-2 pr-2 text-right font-medium">Einzelpreis</th>
                <th className="py-2 text-right font-medium">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={item.id} className="border-b border-zinc-100 align-top">
                  <td className="py-2 pr-2 text-zinc-500 tabular-nums">{i + 1}</td>
                  <td className="py-2 pr-2">{item.description}</td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">
                    {formatNumber(item.quantity)} {unitLabel[item.unit]}
                  </td>
                  <td className="py-2 pr-2 text-right whitespace-nowrap tabular-nums">{formatEuro(item.unitPriceCents)}</td>
                  <td className="py-2 text-right whitespace-nowrap tabular-nums">{formatEuro(lineTotal(item))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="mt-4 ml-auto w-64 space-y-1 text-right tabular-nums">
            <div className="flex justify-between">
              <dt className="text-zinc-500">Summe netto</dt>
              <dd>{formatEuro(totals.net)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">zzgl. {inv.vatRate} % MwSt.</dt>
              <dd>{formatEuro(totals.vat)}</dd>
            </div>
            <div className="flex justify-between border-t border-zinc-300 pt-1.5 text-sm font-semibold text-zinc-900">
              <dt>Rechnungsbetrag</dt>
              <dd>{formatEuro(totals.gross)}</dd>
            </div>
          </dl>
          <p className="mt-8 text-xs leading-relaxed text-zinc-600">
            Zahlbar bis zum {formatDate(inv.dueDate)} ohne Abzug
            {company.iban && (
              <>
                {' '}
                auf das Konto {company.bankName && `bei der ${company.bankName}, `}IBAN {company.iban}
                {company.bic && `, BIC ${company.bic}`}
              </>
            )}
            . Bitte die Rechnungsnummer als Verwendungszweck angeben.
          </p>
          <footer className="mt-8 border-t border-zinc-200 pt-3 text-[10px] leading-relaxed text-zinc-400">
            {[company.name, company.vatId && `USt-IdNr. ${company.vatId}`, company.taxNumber && `St.-Nr. ${company.taxNumber}`, company.website].filter(Boolean).join(' · ')}
            {company.invoiceFooter && <div>{company.invoiceFooter}</div>}
          </footer>
        </article>
      </div>
      <section className="px-6 py-5">
        <h3 className="text-sm font-semibold text-zinc-900">Verlauf</h3>
        <ol className="mt-3 space-y-2 text-sm">
          {history.map((h) => (
            <li key={h.label} className="flex justify-between gap-4">
              <span className="text-zinc-600">{h.label}</span>
              <span className="text-zinc-900 tabular-nums">{h.date}</span>
            </li>
          ))}
        </ol>
      </section>
    </Drawer>
  );
}
