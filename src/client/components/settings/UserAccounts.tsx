import { Ellipsis, KeyRound, Lock, LockOpen, Pencil, ShieldCheck, UserPlus, UserRound, Users } from 'lucide-react';
import { today as getToday } from '../../../shared/dates';
import { formatRelative } from '../../../shared/format';
import { roleLabel } from '../../../shared/labels';
import { byId, employeeName } from '../../../shared/selectors';
import type { User } from '../../../shared/types';
import { cx } from '../../lib/cx';
import { useModals } from '../../lib/modals';
import { useData } from '../../store/AppStore';
import { useActions, useRun } from '../../store/mutations';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { useConfirm } from '../ui/feedback';
import { Avatar, EmptyState, Menu, table, type MenuItem } from '../ui/misc';

export function UserAccounts() {
  const data = useData();
  const { open } = useModals();
  const actions = useActions();
  const run = useRun();
  const confirm = useConfirm();
  const today = getToday();
  const employees = byId(data.employees);

  const toggleActive = async (u: User) => {
    if (u.active) {
      const r = await confirm({ title: `Zugang von ${u.displayName} sperren?`, message: 'Alle Sitzungen werden sofort beendet. Entsperren ist jederzeit möglich.', confirmLabel: 'Sperren', tone: 'danger' });
      if (!r.ok) return;
    }
    await run(() => actions.updateUser(u.id, { active: !u.active }, u.active ? `${u.displayName} gesperrt` : `${u.displayName} entsperrt`));
  };

  const resetPassword = async (u: User) => {
    const r = await confirm({ title: `Passwort von ${u.displayName} zurücksetzen?`, message: 'Pitstop erzeugt ein neues Startpasswort. Alle Sitzungen dieses Benutzers werden beendet.', confirmLabel: 'Zurücksetzen' });
    if (!r.ok) return;
    await run(async () => {
      const result = await actions.resetUserPassword(u.id);
      open({ type: 'revealPassword', title: 'Neues Startpasswort', email: result.user.email, password: result.password });
    });
  };

  const changeRole = async (u: User) => {
    const role = u.role === 'admin' ? 'employee' : 'admin';
    await run(() => actions.updateUser(u.id, { role }, `${u.displayName} ist jetzt ${roleLabel[role]}`));
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3">
        <p className="text-sm text-zinc-500">Jeder Zugang ist einer Person zugeordnet. Startpasswörter müssen beim ersten Anmelden geändert werden.</p>
        <Button variant="primary" icon={UserPlus} onClick={() => open({ type: 'user' })}>
          Zugang anlegen
        </Button>
      </div>
      {data.users.length === 0 ? (
        <EmptyState icon={Users} title="Noch keine Benutzer" />
      ) : (
        <div className={table.wrap}>
          <table className={table.table}>
            <thead>
              <tr>
                <th className={table.th}>Benutzer</th>
                <th className={table.th}>Rolle</th>
                <th className={table.th}>Mitarbeiter</th>
                <th className={table.th}>Status</th>
                <th className={table.th}>Letzte Anmeldung</th>
                <th className={table.thRight}>
                  <span className="sr-only">Aktionen</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.users.map((u) => {
                const employee = u.employeeId ? employees.get(u.employeeId) : undefined;
                const isMe = u.id === data.me.id;
                const items: MenuItem[] = [
                  { label: 'Bearbeiten', icon: Pencil, onSelect: () => open({ type: 'user', userId: u.id }) },
                  { label: u.role === 'admin' ? 'Zum Mitarbeiter machen' : 'Zum Admin machen', icon: u.role === 'admin' ? UserRound : ShieldCheck, onSelect: () => void changeRole(u) },
                  { label: 'Passwort zurücksetzen', icon: KeyRound, onSelect: () => void resetPassword(u) },
                ];
                if (!isMe) items.push({ label: u.active ? 'Sperren' : 'Entsperren', icon: u.active ? Lock : LockOpen, danger: u.active, onSelect: () => void toggleActive(u) });
                return (
                  <tr key={u.id} className={cx(table.tr, !u.active && 'opacity-60')}>
                    <td className={table.td}>
                      <div className="flex items-center gap-3">
                        <Avatar name={u.displayName} size="sm" />
                        <div className="min-w-0">
                          <div className="font-medium text-zinc-900">
                            {u.displayName}
                            {isMe && <span className="ml-1.5 text-xs font-normal text-zinc-500">(du)</span>}
                          </div>
                          <div className="truncate text-xs text-zinc-500">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className={table.td}>
                      <Badge tone={u.role === 'admin' ? 'indigo' : 'gray'}>{roleLabel[u.role]}</Badge>
                    </td>
                    <td className={cx(table.td, 'text-zinc-600')}>{employee ? employeeName(employee) : '–'}</td>
                    <td className={table.td}>
                      {!u.active ? (
                        <Badge tone="red">Gesperrt</Badge>
                      ) : u.mustChangePassword ? (
                        <Badge tone="amber">Passwortwechsel offen</Badge>
                      ) : (
                        <Badge tone="green" dot>
                          Aktiv
                        </Badge>
                      )}
                    </td>
                    <td className={cx(table.td, 'whitespace-nowrap text-zinc-500')}>{u.lastLoginAt ? formatRelative(u.lastLoginAt.slice(0, 10), today) : 'noch nie'}</td>
                    <td className={table.tdRight}>
                      <Menu
                        width="w-60"
                        items={items}
                        trigger={({ toggle }) => <Button size="sm" variant="ghost" icon={Ellipsis} onClick={toggle} aria-label={`Aktionen für ${u.displayName}`} />}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
