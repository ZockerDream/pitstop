// Mitarbeiter (Mitglieder mit Rang, Telefon, Status) und Dienstzeiten aus der Stempeluhr.
import { formatAgo, formatDateTime, formatMinutes } from '../../../shared/format';
import { api } from '../../lib/api';
import { useApp } from '../../lib/app';
import { openCorrection } from './Plan';
import { Avatar, Card, Empty, PageHead, Pill, Table } from '../ui';
import { memberName, sum } from './helpers';

const minutes = (a: string, b: string | null) => ((b ? new Date(b).getTime() : Date.now()) - new Date(a).getTime()) / 60000;
const weekStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

export function StaffPage() {
  const app = useApp();
  const d = app.data!;
  const ws = weekStart();
  const week = (id: string) => sum(d.duty.filter((x) => x.userId === id && new Date(x.startedAt).getTime() >= ws).map((x) => minutes(x.startedAt, x.endedAt)));
  return (
    <>
      <PageHead eyebrow="Personal" title="Mitarbeiter" sub={`${d.members.length} im Team · ${d.members.filter((m) => m.onDutySince).length} im Dienst`}>
        {app.can('zugaenge') && <button className="btn" onClick={() => app.go('zugaenge')}>Zugänge verwalten</button>}
      </PageHead>
      <div className="g g3">
        {d.members.map((m) => (
          <Card key={m.userId}>
            <div className="who">
              <Avatar name={m.displayName} size={46} />
              <div className="grow"><b style={{ fontSize: 16 }}>{m.displayName}</b><span>{m.rank || 'ohne Rang'}</span></div>
              {m.locked ? <Pill tone="bad">gesperrt</Pill> : m.onDutySince ? <Pill tone="ok">Dienst</Pill> : <Pill>frei</Pill>}
            </div>
            <div className="stats" style={{ marginTop: 14 }}>
              <div><span>Woche</span><b>{app.can('dienstzeiten') && !d.rights.areas.dienstzeiten.own ? formatMinutes(week(m.userId)) : '–'}</b></div>
              <div><span>Seit</span><b>{m.onDutySince ? formatMinutes(minutes(m.onDutySince, null)) : '–'}</b></div>
              <div><span>Telefon</span><b style={{ fontSize: 12.5 }}>{m.phone || '–'}</b></div>
            </div>
            {m.discord && <div className="small muted" style={{ marginTop: 10 }}>Discord: {m.discord}</div>}
          </Card>
        ))}
      </div>
    </>
  );
}

export function DutyPage() {
  const app = useApp();
  const d = app.data!;
  const ws = weekStart();
  const people = [...new Set(d.duty.map((x) => x.userId))];
  return (
    <>
      <PageHead eyebrow="Personal" title="Dienstzeiten" sub={d.rights.areas.dienstzeiten.own ? 'Deine Schichten der letzten 5 Wochen' : 'Alle Schichten der letzten 5 Wochen aus der Stempeluhr'}>
        {!d.rights.support && <button className="btn" onClick={() => openCorrection(app)}>Vergessen zu stempeln?</button>}
      </PageHead>
      <div className="g c12">
        <div className="s4">
          <Card title="Diese Woche">
            {people.length ? people.map((id) => (
              <div className="li" key={id}><Avatar name={memberName(d, id)} size={26} /><div className="tx"><b>{memberName(d, id)}</b></div><span className="mono">{formatMinutes(sum(d.duty.filter((x) => x.userId === id && new Date(x.startedAt).getTime() >= ws).map((x) => minutes(x.startedAt, x.endedAt))))}</span></div>
            )) : <p className="muted small">Noch keine Schichten.</p>}
          </Card>
        </div>
        <div className="s8">
          <Card title="Schichten">
            {d.duty.length ? (
              <Table head={['Person', 'Beginn', 'Ende', ['Dauer', 'r'], '']}>
                {d.duty.map((x) => (
                  <tr key={x.id}>
                    <td>{memberName(d, x.userId)}</td>
                    <td className="mono small">{formatDateTime(x.startedAt)}</td>
                    <td className="mono small">{x.endedAt ? formatDateTime(x.endedAt) : <Pill tone="ok">läuft · {formatAgo(x.startedAt)}</Pill>}</td>
                    <td className="r mono">{formatMinutes(minutes(x.startedAt, x.endedAt))}</td>
                    <td className="r" style={{ whiteSpace: 'nowrap' }}>
                      {x.userId === app.me.user.id && x.endedAt && !d.rights.support && <button className="btn sm ghost" onClick={() => openCorrection(app, x.id)}>Korrektur</button>}
                      {app.can('dienstzeiten', 3) && <button className="btn sm ghost" onClick={() => app.act(() => api.del(app.c(`/duty/${x.id}`)), 'Schicht gelöscht')}>Löschen</button>}
                    </td>
                  </tr>
                ))}
              </Table>
            ) : <Empty title="Noch keine Schichten" >Oben rechts mit „Dienst beginnen“ einstempeln.</Empty>}
          </Card>
        </div>
      </div>
    </>
  );
}
