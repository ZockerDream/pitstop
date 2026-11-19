import { Plus } from 'lucide-react';
import { useModals } from '../../lib/modals';
import { navigate } from '../../lib/router';
import { useData } from '../../store/AppStore';
import { Button } from '../ui/Button';
import { PageHeader } from '../ui/Card';
import { Tabs } from '../ui/Tabs';
import { ExpenseTable } from './ExpenseTable';
import { InvoiceDrawer } from './InvoiceDrawer';
import { InvoiceTable } from './InvoiceTable';

export function FinanceView({ tab, invoiceId, query }: { tab: 'invoices' | 'expenses'; invoiceId?: string; query: URLSearchParams }) {
  const data = useData();
  const { open } = useModals();
  return (
    <>
      <PageHeader
        title="Finanzen"
        description="Rechnungen und Ausgaben des Betriebs"
        actions={
          tab === 'invoices' ? (
            <Button variant="primary" icon={Plus} onClick={() => open({ type: 'invoice' })}>
              Neue Rechnung erstellen
            </Button>
          ) : (
            <Button variant="primary" icon={Plus} onClick={() => open({ type: 'expense' })}>
              Neue Ausgabe
            </Button>
          )
        }
      />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => navigate(t === 'invoices' ? '/finanzen/rechnungen' : '/finanzen/ausgaben')}
        items={[
          { value: 'invoices', label: 'Rechnungen', count: data.invoices.length },
          { value: 'expenses', label: 'Ausgaben', count: data.expenses.length },
        ]}
      />
      {tab === 'invoices' ? <InvoiceTable selectedId={invoiceId} initialStatus={query.get('status')} /> : <ExpenseTable />}
      {tab === 'invoices' && invoiceId && <InvoiceDrawer invoiceId={invoiceId} onClose={() => navigate('/finanzen/rechnungen')} />}
    </>
  );
}
