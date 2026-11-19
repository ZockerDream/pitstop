import { navigate } from '../../lib/router';
import { useCan, useData } from '../../store/AppStore';
import { PageHeader } from '../ui/Card';
import { Tabs } from '../ui/Tabs';
import { CompanySettings } from './CompanySettings';
import { UserAccounts } from './UserAccounts';

export function SettingsView({ tab }: { tab: 'company' | 'users' }) {
  const data = useData();
  const can = useCan();
  return (
    <>
      <PageHeader title="Einstellungen" description="Firmendaten für den Rechnungskopf und Zugänge zu Pitstop" />
      <Tabs
        className="mb-5"
        value={tab}
        onChange={(t) => navigate(t === 'company' ? '/einstellungen/firma' : '/einstellungen/benutzer')}
        items={[
          { value: 'company', label: 'Firmendaten' },
          ...(can('users:manage') ? [{ value: 'users' as const, label: 'Benutzer', count: data.users.length }] : []),
        ]}
      />
      {tab === 'company' ? <CompanySettings /> : <UserAccounts />}
    </>
  );
}
