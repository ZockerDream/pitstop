// Rechnungen ($, ohne Steuern) und Buchungen mit Firmenkonto und Kasse.
import { useState } from 'react';
import { billLabel, formatDate, formatUsd } from '../../../shared/format';
import { ACCOUNTS, type Bill } from '../../../shared/types';
import { api } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Card, Confirm, Empty, FormModal, Kpi, Modal, PageHead, Pill, Table } from '../ui';
import { customerName, customerOptions, memberName, sum } from './helpers';

const tone = (s: string) => (s === 'bezahlt' ? 'ok' : s === 'offen' ? 'warn' : '');

export function openNewBill(app: ReturnType<typeof useApp>, kind: 'rechnung' | 'angebot' = 'rechnung', preset: Record<string, unknown> = {}) {
  const d = app.data!;
  app.overlay(
    <FormModal
      title={kind === 'angebot' ? 'Angebot erstellen' : 'Rechnung stellen'}
      fields={[
        { name: 'customerId', label: 'Kunde', type: 'select', options: customerOptions(d) },
        ...(d.services.length ? [{ name: 'serviceId', label: 'Leistung aus der Preisliste (füllt Text und Preis)', type: 'select' as const, options: [['', '– frei –'], ...d.services.map((x) => [x.id, `${x.name} · ${formatUsd(x.priceCents)}`] as [string, string])] as [string, string][] }] : []),
        { name: 'title', label: 'Leistung (leer = aus der Preisliste)' },
        { name: 'amountCents', label: 'Betrag (leer = aus der Preisliste)', type: 'usd' },
        ...(kind === 'rechnung' ? [{ name: 'dueDate', label: `Zahlbar bis (leer = in ${d.company.extra.payDays ?? 3} Tagen)`, type: 'date' as const }] : []),
      ]}
      initial={preset}
      submit={(v) => {
        const svc = d.services.find((x) => x.id === v.serviceId);
        const title = String(v.title || svc?.name || '');
        if (!title) throw new Error('Leistung fehlt');
        const k = d.contracts.find((c) => c.customerId === v.customerId && c.status === 'aktiv');
        const base = Number(v.amountCents) || svc?.priceCents || 0;
        // Rahmenvertrag: Werkstatt-Rabatt nur auf Preise aus der Preisliste (freie Beträge sind schon verhandelt)
        const amountCents = !Number(v.amountCents) && svc && k?.workshopPct ? Math.round(base * (100 - k.workshopPct) / 100) : base;
        return api.post(app.c('/bills'), { customerId: v.customerId, title: k && svc && !Number(v.amountCents) && k.workshopPct ? `${title} (−${k.workshopPct} % Rahmenvertrag)` : title, amountCents, dueDate: v.dueDate ?? null, kind });
      }}
      onDone={() => app.toast(kind === 'angebot' ? 'Angebot erstellt' : 'Rechnung gestellt')}
      submitLabel={kind === 'angebot' ? 'Erstellen' : 'Stellen'}
    />,
  );
}

function PayModal({ b }: { b: Bill }) {
  const app = useApp();
  const pay = (account: string) => { app.overlay(null); void app.act(() => api.post(app.c(`/bills/${b.id}/pay`), { account }), `${billLabel(b.number)} bezahlt`); };
  return (
    <Modal title={`${billLabel(b.number)} bezahlt`} onClose={() => app.overlay(null)}>
      <p style={{ marginTop: 0 }}>{formatUsd(b.amountCents)} von {customerName(app.data, b.customerId)}. Wohin ist das Geld gegangen?</p>
      <div className="row" style={{ gap: 8 }}>
        <button className="btn pri" onClick={() => pay('kasse')}><Icon name="register" size={15} /> Bar in die Kasse</button>
        <button className="btn" onClick={() => pay('firma')}><Icon name="building" size={15} /> Aufs Firmenkonto</button>
        <button className="btn ghost" onClick={() => pay('rennteam')}>Rennteam</button>
      </div>
    </Modal>
  );
}

export function BillsPage() {
  const app = useApp();
  const d = app.data!;
  const [f, setF] = useState('offen');
  const list = d.bills.filter((b) => f === 'alle' || (f === 'angebot' ? b.kind === 'angebot' && b.status === 'offen' : f === 'offen' ? b.status === 'offen' && b.kind === 'rechnung' : b.status === f));
  const open = d.bills.filter((b) => b.status === 'offen' && b.kind === 'rechnung');
  const offers = d.bills.filter((b) => b.status === 'offen' && b.kind === 'angebot');
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHead eyebrow="Finanzen" title="Rechnungen & Angebote" sub={`${open.filter((b) => b.dueDate && b.dueDate < today).length} überfällig · ${formatUsd(sum(open.map((b) => b.amountCents)))} offen · ${offers.length} Angebote · ohne Steuern`}>
        {app.can('rechnungen', 2) && <button className="btn" onClick={() => openNewBill(app, 'angebot')}><Icon name="plus" size={15} /> Angebot</button>}
        {app.can('rechnungen', 2) && <button className="btn pri" onClick={() => openNewBill(app)}><Icon name="plus" size={15} /> Rechnung</button>}
      </PageHead>
      <div className="chips" style={{ marginBottom: 12 }}>
        {[['offen', 'Offene Rechnungen'], ['angebot', 'Angebote'], ['bezahlt', 'Bezahlt'], ['storniert', 'Storniert'], ['alle', 'Alle']].map(([k, l]) => <button key={k} className={`chip ${f === k ? 'on' : ''}`} onClick={() => setF(k)}>{l}</button>)}
      </div>
      <Card>
        {list.length ? (
          <Table head={['Nr.', 'Leistung', 'Kunde', 'Gestellt', ['Betrag', 'r'], 'Status', '']}>
            {list.map((b) => (
              <tr key={b.id}>
                <td className="mono">{billLabel(b.number)}{b.kind === 'angebot' && <div><Pill tone="info" dot={false}>Angebot</Pill></div>}</td>
                <td>{b.title}<div className="small muted">von {memberName(d, b.createdBy) || '–'}</div></td>
                <td>{customerName(d, b.customerId)}</td>
                <td className="mono small">{formatDate(b.createdAt)}{b.dueDate && b.status === 'offen' && <div className={b.dueDate < today ? 'err' : 'muted'}>bis {formatDate(b.dueDate)}</div>}{b.reminders > 0 && <div className="small warn">{b.reminders}. Mahnung {b.remindedAt ? formatDate(b.remindedAt) : ''}</div>}</td>
                <td className="r money">{formatUsd(b.amountCents)}</td>
                <td><Pill tone={tone(b.status)}>{b.status}</Pill></td>
                <td className="r">
                  <span className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                    {b.status === 'offen' && b.kind === 'angebot' && app.can('rechnungen', 2) && <button className="btn sm pri" onClick={() => app.act(() => api.post(app.c(`/bills/${b.id}/accept`)), 'Angebot angenommen – jetzt Rechnung')}>Annehmen</button>}
                    {b.status === 'offen' && b.kind === 'rechnung' && app.can('rechnungen', 2) && <button className="btn sm pri" onClick={() => app.overlay(<PayModal b={b} />)}>Bezahlt</button>}
                    {b.status === 'offen' && b.kind === 'rechnung' && b.dueDate && b.dueDate < today && app.can('rechnungen', 2) && <button className="btn sm" onClick={() => app.act(() => api.post<{ sent: boolean }>(app.c(`/bills/${b.id}/remind`)), 'Mahnung vermerkt')}>Mahnen</button>}
                    {b.status !== 'storniert' && app.special('storno') && (
                      <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`${billLabel(b.number)} stornieren?`} text={b.status === 'bezahlt' ? 'Die Rechnung ist bezahlt. Pitstop bucht den Betrag als Storno vom Firmenkonto zurück.' : 'Die Rechnung wird ungültig.'} okLabel="Stornieren" onOk={() => app.act(() => api.post(app.c(`/bills/${b.id}/cancel`)), 'Storniert')} />)}>Storno</button>
                    )}
                  </span>
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Keine Rechnungen in dieser Ansicht" />
        )}
      </Card>
    </>
  );
}

export function TransactionsPage() {
  const app = useApp();
  const d = app.data!;
  const [acc, setAcc] = useState('alle');
  const bal = (a: string) => sum(d.transactions.filter((t) => t.account === a).map((t) => t.amountCents));
  const month = new Date().toISOString().slice(0, 7);
  const thisMonth = d.transactions.filter((t) => t.bookedAt.startsWith(month));
  const limit = d.rights.specials.auszahlung;
  const book = (sign: 1 | -1) =>
    app.overlay(
      <FormModal
        title={sign > 0 ? 'Einnahme buchen' : 'Ausgabe buchen'}
        fields={[
          { name: 'text', label: 'Text', required: true },
          { name: 'amountCents', label: 'Betrag', type: 'usd', required: true },
          { name: 'account', label: 'Konto', type: 'select', options: ACCOUNTS },
          { name: 'category', label: 'Kategorie', type: 'select', options: (sign > 0 ? ['Einnahme', 'Einlage', 'Sonstiges'] : ['Material', 'Miete', 'Lohn', 'Werkzeug', 'Fahrzeuge', 'Nebenkosten', 'Sonstiges']).map((x) => [x, x]) },
          { name: 'bookedAt', label: 'Datum', type: 'date' },
        ]}
        initial={{ account: 'firma', category: sign > 0 ? 'Einnahme' : 'Material', bookedAt: new Date().toISOString().slice(0, 10) }}
        submit={(v) => api.post(app.c('/transactions'), { ...v, bookedAt: v.bookedAt ?? undefined, amountCents: sign * Math.abs(Number(v.amountCents)) })}
        onDone={() => app.toast('Gebucht')}
        submitLabel="Buchen"
      >
        {sign < 0 && typeof limit === 'number' && limit < Number.MAX_SAFE_INTEGER && limit > 0 && <div className="alert warn"><Icon name="alert" /><div>Du darfst Ausgaben bis {formatUsd(limit * 100)} buchen.</div></div>}
      </FormModal>,
    );
  const list = d.transactions.filter((t) => acc === 'alle' || t.account === acc);
  return (
    <>
      <PageHead eyebrow="Finanzen" title="Buchungen" sub="Alle Bewegungen auf allen Konten · ohne Steuern">
        {app.special('export') && <a className="btn" href={`/api${app.c('/export/buchungen')}`}><Icon name="file" size={15} /> Export</a>}
        {app.can('buchungen', 2) && <button className="btn" onClick={() => book(1)}><Icon name="plus" size={15} /> Einnahme</button>}
        {app.can('buchungen', 2) && app.special('auszahlung') && <button className="btn pri" onClick={() => book(-1)}><Icon name="minus" size={15} /> Ausgabe</button>}
      </PageHead>
      <div className="g c12" style={{ marginBottom: 14 }}>
        {ACCOUNTS.map(([a, l]) => <div key={a} className="s3"><Kpi label={l} value={formatUsd(bal(a))} /></div>)}
        <div className="s6"><Kpi label="Einnahmen Monat" value={formatUsd(sum(thisMonth.filter((t) => t.amountCents > 0 && t.category !== 'Umbuchung').map((t) => t.amountCents)))} /></div>
        <div className="s6"><Kpi label="Ausgaben Monat" value={formatUsd(-sum(thisMonth.filter((t) => t.amountCents < 0 && t.category !== 'Umbuchung').map((t) => t.amountCents)))} /></div>
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {[['alle', 'Alle Konten'], ...ACCOUNTS].map(([k, l]) => <button key={k} className={`chip ${acc === k ? 'on' : ''}`} onClick={() => setAcc(k)}>{l}</button>)}
      </div>
      <Card>
        {list.length ? (
          <Table head={['Datum', 'Text', 'Kategorie', 'Konto', 'Von', ['Betrag', 'r']]}>
            {list.map((t) => (
              <tr key={t.id}>
                <td className="mono small">{formatDate(t.bookedAt)}</td>
                <td>{t.text}</td>
                <td><Pill dot={false}>{t.category}</Pill></td>
                <td className="muted">{ACCOUNTS.find((x) => x[0] === t.account)?.[1]}</td>
                <td className="small muted">{memberName(d, t.createdBy)}</td>
                <td className={`r money ${t.amountCents < 0 ? 'neg' : 'pos'}`}>{t.amountCents > 0 ? '+' : ''}{formatUsd(t.amountCents)}</td>
              </tr>
            ))}
          </Table>
        ) : (
          <Empty title="Noch keine Buchungen" />
        )}
      </Card>
    </>
  );
}
