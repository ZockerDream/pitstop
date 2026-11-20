// Firma: Firmendaten (inkl. Kartenbild, Support-Freigabe), Mitglieder & Zugänge, Gruppen & Rechte, Module, Protokoll.
import { useEffect, useRef, useState } from 'react';
import { formatAgo, formatDateTime } from '../../../shared/format';
import { AREAS, computeRights, LEVEL_LABEL, LEVELS, MODULES, SPECIALS, type Area, type Level } from '../../../shared/permissions';
import type { AuditEntry, Group, MapBounds, Member } from '../../../shared/types';
import { CompanyExtraCard, GameKeysCard, WebhooksCard } from './Firma';
import { Promote } from './People';
import { MapView } from './MapView';
import { api, errorMessage } from '../../lib/api';
import { useApp } from '../../lib/app';
import { Icon } from '../../lib/icons';
import { Avatar, Card, Confirm, Drawer, Empty, FormModal, LevelPill, PageHead, Pill, Seg, Switch, Table } from '../ui';

/** Bekannte Punkte für die Kalibrierung (Spielkoordinaten, ungefähr – mit /coords im Spiel genauer). */
const REF_POINTS: [string, number, number][] = [['Gipfel Mount Chiliad', 501, 5604], ['Ende Del Perro Pier', -1850, -1230], ['Tower Flughafen LSIA', -985, -2640], ['Leuchtturm Paleto Cove', -1490, 5420]];

/**
 * Zwei-Punkt-Kalibrierung: Man klickt zwei Stellen im Bild an und nennt ihre Spielkoordinaten.
 * Aus Bildanteil und Koordinate beider Punkte ergeben sich die vier Ränder.
 */
export function calibrate(b: MapBounds, picks: { gx: number; gy: number; x: number; y: number }[]): MapBounds | null {
  if (picks.length !== 2) return null;
  const f = picks.map((p) => ({ fx: (p.gx - b.x0) / (b.x1 - b.x0), fy: (b.y1 - p.gy) / (b.y1 - b.y0), x: p.x, y: p.y }));
  const dfx = f[1].fx - f[0].fx, dfy = f[1].fy - f[0].fy;
  if (Math.abs(dfx) < 0.05 || Math.abs(dfy) < 0.05) return null;
  const w = (f[1].x - f[0].x) / dfx, h = (f[0].y - f[1].y) / dfy;
  if (w <= 0 || h <= 0) return null;
  const x0 = f[0].x - f[0].fx * w, y1 = f[0].y + f[0].fy * h;
  return { x0: Math.round(x0), x1: Math.round(x0 + w), y0: Math.round(y1 - h), y1: Math.round(y1) };
}

function Calibration({ bounds, onDone }: { bounds: MapBounds; onDone: (b: MapBounds | null) => void }) {
  const app = useApp();
  const [picks, setPicks] = useState<{ gx: number; gy: number; x: number; y: number }[]>([]);
  const [ref, setRef] = useState(0);
  const [xy, setXy] = useState<[string, string]>([String(REF_POINTS[0][1]), String(REF_POINTS[0][2])]);
  const step = picks.length + 1;
  const result = calibrate(bounds, picks);
  return (
    <div className="calib stack" style={{ gap: 10 }}>
      {step <= 2 ? (
        <>
          <b>Punkt {step} von 2</b>
          <div className="row wrap" style={{ gap: 8 }}>
            <select value={ref} onChange={(e) => { const i = Number(e.target.value); setRef(i); if (i >= 0) setXy([String(REF_POINTS[i][1]), String(REF_POINTS[i][2])]); }} aria-label="Bekannter Ort">
              {REF_POINTS.map(([n], i) => <option key={n} value={i}>{n}</option>)}
              <option value={-1}>Eigene Koordinaten</option>
            </select>
            <input style={{ width: 90 }} value={xy[0]} onChange={(e) => setXy([e.target.value, xy[1]])} aria-label="Spiel-X" placeholder="X" />
            <input style={{ width: 90 }} value={xy[1]} onChange={(e) => setXy([xy[0], e.target.value])} aria-label="Spiel-Y" placeholder="Y" />
          </div>
          <span className="small muted">Jetzt diese Stelle im Bild unten anklicken (vorher mit dem Mausrad heranzoomen). Zwei Punkte möglichst weit auseinander.</span>
        </>
      ) : result ? (
        <span className="small">Neue Ränder: West {result.x0}, Ost {result.x1}, Süd {result.y0}, Nord {result.y1}. Die Pins liegen jetzt auf dem Bild.</span>
      ) : <span className="small" style={{ color: 'var(--bad)' }}>Die Punkte liegen zu nah beieinander. Bitte neu beginnen.</span>}
      <MapView
        pins={picks.map((p, i) => ({ id: String(i), x: p.gx, y: p.gy, label: `P${i + 1}`, color: 'var(--accent)' }))}
        base="full"
        imageUrl={`/api${app.c('/map')}`}
        bounds={bounds}
        onPick={step <= 2 ? (gx, gy) => {
          const x = Number(xy[0].replace(',', '.')), y = Number(xy[1].replace(',', '.'));
          if (!Number.isFinite(x) || !Number.isFinite(y)) return app.toast('Koordinaten als Zahl eintragen', 'bad');
          setPicks([...picks, { gx, gy, x, y }]);
          const next = (ref + 1) % REF_POINTS.length;
          if (ref >= 0) { setRef(next); setXy([String(REF_POINTS[next][1]), String(REF_POINTS[next][2])]); }
        } : undefined}
      />
      <div className="row" style={{ gap: 8 }}>
        <button className="btn sm ghost" onClick={() => onDone(null)}>Abbrechen</button>
        {picks.length > 0 && <button className="btn sm ghost" onClick={() => setPicks([])}>Neu beginnen</button>}
        {result && <button className="btn sm pri" onClick={() => onDone(result)}>Übernehmen und speichern</button>}
      </div>
    </div>
  );
}

const COLORS = ['#ffb547', '#ff7a1a', '#4fc3ff', '#34d69a', '#c792ea', '#38bdf8', '#f472b6', '#9aa7bd'];

const EXPORTS: [string, Area, string][] = [
  ['kunden', 'kunden', 'Kunden'], ['fahrzeuge', 'fahrzeuge', 'Fahrzeuge'], ['auftraege', 'auftraege', 'Aufträge'], ['einsaetze', 'leitstelle', 'Einsätze'],
  ['rechnungen', 'rechnungen', 'Rechnungen'], ['buchungen', 'buchungen', 'Buchungen'], ['dienstzeiten', 'dienstzeiten', 'Dienstzeiten'], ['mitglieder', 'mitarbeiter', 'Mitglieder'],
  ['protokoll', 'protokoll', 'Protokoll'], ['lager', 'lager', 'Lager'], ['dienstplan', 'dienstplan', 'Dienstplan'], ['lohn', 'lohn', 'Lohn'], ['nachweise', 'schulungen', 'Schulungsnachweise'], ['rennen', 'racing', 'Rennergebnisse'],
];

export function CompanyPage() {
  const app = useApp();
  const d = app.data!;
  const c = d.company;
  const edit = app.can('firma', 2);
  const file = useRef<HTMLInputElement>(null);
  const [b, setB] = useState(c.mapBounds);
  const [calib, setCalib] = useState(false);
  useEffect(() => setB(c.mapBounds), [c.mapBounds]);
  const upload = async (f: File) => {
    try {
      const res = await fetch(`/api${app.c('/map')}`, { method: 'PUT', headers: { 'Content-Type': f.type }, body: f, credentials: 'same-origin' });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? `Fehler ${res.status}`);
      await app.reload();
      app.toast('Kartenbild hochgeladen');
    } catch (err) {
      app.toast(err instanceof Error ? err.message : errorMessage(err), 'bad');
    }
  };
  return (
    <>
      <PageHead eyebrow="Firma" title="Firmendaten" sub={`${c.name}${c.info.address ? ` · ${c.info.address}` : ''}`}>
        {edit && (
          <button className="btn pri" onClick={() => app.overlay(
            <FormModal title="Firmendaten bearbeiten" fields={[{ name: 'name', label: 'Name', required: true }, { name: 'short', label: 'Kürzel' }, { name: 'address', label: 'Adresse' }, { name: 'phone', label: 'Telefon' }, { name: 'hours', label: 'Öffnungszeiten' }, { name: 'discord', label: 'Discord' }]}
              initial={{ name: c.name, short: c.short, ...c.info }}
              submit={(v) => api.patch(app.c('/settings'), { name: v.name, short: v.short, info: { address: v.address, phone: v.phone, hours: v.hours, discord: v.discord } })}
              onDone={() => app.toast('Gespeichert')} />,
          )}>Bearbeiten</button>
        )}
      </PageHead>
      <div className="g g2">
        <Card title="Firma">
          <dl className="kv">
            <dt>Name</dt><dd>{c.name}</dd><dt>Kürzel</dt><dd>{c.short || '–'}</dd><dt>Adresse</dt><dd>{c.info.address || '–'}</dd>
            <dt>Telefon</dt><dd>{c.info.phone || '–'}</dd><dt>Öffnungszeiten</dt><dd>{c.info.hours || '–'}</dd><dt>Discord</dt><dd>{c.info.discord || '–'}</dd>
            <dt>Inhaber</dt><dd>{d.groups.find((g) => g.isOwner)?.members.map((m) => d.members.find((x) => x.userId === m)?.displayName).join(', ') || '–'}</dd>
          </dl>
        </Card>
        <Card title="Server-Support">
          <div className="li">
            <div className="tx"><b>Server-Admins dürfen für Support hineinschauen</b><span style={{ whiteSpace: 'normal' }}>Aus: Server-Admins sehen nur Name, Inhaber und Größe. An: Lesezugriff, jeder Blick landet im Protokoll.</span></div>
            <Switch on={c.supportAccess} disabled={!d.rights.owner} label="Support-Zugriff erlauben" onChange={(v) => app.act(() => api.patch(app.c('/settings'), { supportAccess: v }), v ? 'Support-Zugriff erlaubt' : 'Support-Zugriff entzogen')} />
          </div>
          {!d.rights.owner && <p className="small muted">Nur der Inhaber kann das ändern.</p>}
          <div className="li">
            <div className="tx"><b>Wenn jemand in mehreren Gruppen ist</b><span>{c.lockWins ? '„Gesperrt“ gewinnt immer' : 'Das höchste Recht gewinnt'}</span></div>
          </div>
        </Card>
        <Card title="Kartenbild für die Leitstelle">
          <p className="small muted" style={{ marginTop: 0 }}>Lade ein Bild der ganzen Insel hoch (JPG, PNG oder WebP, bis 60 MB). Es bleibt auf eurem Server. Danach „Mit 2 Punkten kalibrieren“: zwei bekannte Orte im Bild anklicken, Pitstop rechnet die Ränder aus. Die Ränder lassen sich auch von Hand eintragen.</p>
          {calib && <div style={{ marginBottom: 12 }}><Calibration bounds={b} onDone={(nb) => { setCalib(false); if (nb) { setB(nb); void app.act(() => api.patch(app.c('/settings'), { mapBounds: nb }), 'Karte kalibriert'); } }} /></div>}
          <div className="g g2" style={{ gap: 8 }}>
            {([['x0', 'Westrand X'], ['x1', 'Ostrand X'], ['y0', 'Südrand Y'], ['y1', 'Nordrand Y']] as const).map(([k, l]) => (
              <div className="field" key={k}><label htmlFor={`mb-${k}`}>{l}</label><input id={`mb-${k}`} inputMode="numeric" disabled={!edit} value={b[k]} onChange={(e) => setB({ ...b, [k]: Number(e.target.value.replace(/[^0-9-]/g, '')) || 0 })} /></div>
            ))}
          </div>
          {edit && (
            <div className="row wrap" style={{ gap: 8, marginTop: 12 }}>
              {c.hasMap && !calib && <button className="btn sm pri" onClick={() => setCalib(true)}><Icon name="pin" size={14} /> Mit 2 Punkten kalibrieren</button>}
              <button className="btn sm" onClick={() => app.act(() => api.patch(app.c('/settings'), { mapBounds: b }), 'Ränder gespeichert')}>Ränder speichern</button>
              <button className={`btn sm ${c.hasMap ? '' : 'pri'}`} onClick={() => file.current?.click()}>{c.hasMap ? 'Anderes Bild' : 'Bild hochladen'}</button>
              {c.hasMap && <button className="btn sm ghost" onClick={() => app.act(() => api.del(app.c('/map')), 'Kartenbild entfernt')}>Bild entfernen</button>}
              <input ref={file} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
            </div>
          )}
        </Card>
        {app.special('export') && (
          <Card title="Daten exportieren">
            <p className="small muted" style={{ marginTop: 0 }}>CSV-Dateien (Semikolon, öffnet in Excel). Jeder Export steht im Protokoll.</p>
            <div className="chips">
              {EXPORTS.filter(([, area]) => app.can(area) && !d.rights.areas[area].own).map(([s, area, l]) => <a key={s} className="chip" href={`/api${app.c(`/export/${s}`)}`} download data-area={area}>{l}</a>)}
            </div>
          </Card>
        )}
        <CompanyExtraCard />
        <WebhooksCard />
        <GameKeysCard />
      </div>
    </>
  );
}

/** Effektive Rechte einer Person, im Browser aus Gruppen und Ausnahmen gerechnet (gleiche Funktion wie der Server). */
function effective(app: ReturnType<typeof useApp>, userId: string) {
  const d = app.data!;
  return computeRights(d.groups.filter((g) => g.members.includes(userId)), d.exceptions.filter((e) => e.userId === userId), d.company.lockWins, new Date().toISOString().slice(0, 10), d.company.modules);
}

function MemberDrawer({ m }: { m: Member }) {
  const app = useApp();
  const d = app.data!;
  const isOwner = d.groups.some((g) => g.isOwner && g.members.includes(m.userId));
  const mine = d.groups.filter((g) => g.members.includes(m.userId)).map((g) => g.id);
  const ex = d.exceptions.filter((e) => e.userId === m.userId);
  const r = effective(app, m.userId);
  const [exArea, setExArea] = useState<string>(AREAS[0].id);
  const [exLevel, setExLevel] = useState<Level>('x');
  const [exUntil, setExUntil] = useState('');
  const [exWhy, setExWhy] = useState('');
  const reopen = () => { const n = app.data?.members.find((x) => x.userId === m.userId); if (n) app.overlay(<MemberDrawer m={n} />); };
  const patch = (p: object, msg: string) => app.act(() => api.patch(app.c(`/members/${m.userId}`), p), msg);
  return (
    <Drawer
      title={m.displayName}
      sub={`${m.email || 'E-Mail verborgen'} · ${m.rank || 'ohne Rang'}${m.gameId ? ` · Spiel-ID ${m.gameId}` : ''}`}
      onClose={() => app.overlay(null)}
      foot={app.can('zugaenge', 2) && !isOwner ? (
        <>
          {d.ranks.length > 0 && <button className="btn" onClick={() => app.overlay(<Promote preset={m.userId} />)}>Befördern</button>}
          <button className="btn" onClick={() => app.overlay(<FormModal title="Rang, Telefon, Spiel-ID" fields={[{ name: 'rank', label: 'Rang' }, { name: 'phone', label: 'Telefon' }, { name: 'gameId', label: 'Spiel-ID (z. B. license:… aus FiveM; für die Spielserver-Anbindung)' }]} initial={m} submit={(v) => api.patch(app.c(`/members/${m.userId}`), v)} onDone={() => app.toast('Gespeichert')} />)}>Rang, Telefon, Spiel-ID</button>
          <button className="btn" onClick={() => patch({ locked: !m.locked }, m.locked ? 'Zugang entsperrt' : 'Zugang gesperrt').then(reopen)}>{m.locked ? 'Entsperren' : 'Zugang sperren'}</button>
          {app.can('zugaenge', 3) && <button className="btn ghost" onClick={() => app.overlay(<Confirm title="Aus der Firma entfernen?" text={`${m.displayName} verliert alle Gruppen und Ausnahmen in dieser Firma. Das Konto bleibt bestehen.`} okLabel="Entfernen" onOk={() => app.act(() => api.del(app.c(`/members/${m.userId}`)), 'Entfernt')} />)}>Entfernen</button>}
        </>
      ) : undefined}
    >
      {!isOwner && m.userId !== app.me.user.id && !m.locked && (app.can('gruppen') || app.can('zugaenge')) && !d.rights.support && (
        <button className="btn sm" style={{ alignSelf: 'flex-start' }} onClick={() => void app.setViewAs(m.userId)}><Icon name="eye" size={14} /> Vorschau als {m.displayName.split(' ')[0]}</button>
      )}
      <div>
        <div className="st">Gruppen</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {d.groups.map((g) => (
            <button key={g.id} className={`chip ${mine.includes(g.id) ? 'on' : ''}`} disabled={g.isOwner || !app.can('gruppen', 2) || !app.can('zugaenge', 2)} title={g.isOwner ? 'Inhaber überträgt ein Server-Admin' : undefined}
              onClick={() => patch({ groups: mine.includes(g.id) ? mine.filter((x) => x !== g.id) : [...mine, g.id] }, 'Gruppen geändert').then(reopen)}>
              <i style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: g.color, marginRight: 6 }} />{g.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <div className="st">Ausnahmen nur für {m.displayName.split(' ')[0]}</div>
        {isOwner ? <p className="small muted">Inhaber haben immer alle Rechte.</p> : (
          <>
            {ex.map((e) => (
              <div className="li" key={e.id}>
                <div className="tx"><b>{AREAS.find((a) => a.id === e.area)?.label}</b><span>{e.reason || 'ohne Grund'} · {e.until ? `bis ${e.until}` : 'unbefristet'}</span></div>
                <LevelPill level={e.level} />
                {app.can('gruppen', 2) && <button className="ibtn" aria-label="Ausnahme entfernen" onClick={() => app.act(() => api.del(app.c(`/exceptions/${e.id}`)), 'Ausnahme entfernt').then(reopen)}><Icon name="x" size={14} /></button>}
              </div>
            ))}
            {app.can('gruppen', 2) && (
              <div className="g g2" style={{ gap: 8, marginTop: 8 }}>
                <div className="field"><label htmlFor="ex-a">Bereich</label><select id="ex-a" value={exArea} onChange={(e) => setExArea(e.target.value)}>{AREAS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></div>
                <div className="field"><label htmlFor="ex-l">Stufe</label><select id="ex-l" value={exLevel} onChange={(e) => setExLevel(e.target.value as Level)}>{LEVELS.filter((l) => l !== '0').map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}</select></div>
                <div className="field"><label htmlFor="ex-u">Bis (leer = unbefristet)</label><input id="ex-u" type="date" value={exUntil} onChange={(e) => setExUntil(e.target.value)} /></div>
                <div className="field"><label htmlFor="ex-w">Grund</label><input id="ex-w" value={exWhy} onChange={(e) => setExWhy(e.target.value)} placeholder="z. B. Urlaubsvertretung" /></div>
                <button className="btn sm" style={{ justifySelf: 'start' }} onClick={() => app.act(() => api.put(app.c('/exceptions'), { userId: m.userId, area: exArea, level: exLevel, until: exUntil || null, reason: exWhy }), 'Ausnahme gespeichert').then(reopen)}><Icon name="plus" size={14} /> Ausnahme</button>
              </div>
            )}
          </>
        )}
      </div>
      <div>
        <div className="st">Was {m.displayName.split(' ')[0]} am Ende darf</div>
        {AREAS.filter((a) => a.module === 'firma' || d.company.modules.includes(a.module)).map((a) => {
          const x = r.areas[a.id];
          return <div key={a.id} className="row small" style={{ padding: '4px 0', gap: 8 }}><span className="grow">{a.label}</span><span className="dim">{x.source}</span><LevelPill level={x.locked ? 'x' : (String(x.level) as Level)} own={x.own} /></div>;
        })}
      </div>
    </Drawer>
  );
}

export function MembersPage() {
  const app = useApp();
  const d = app.data!;
  const [reveal, setReveal] = useState<{ email: string; pw: string } | null>(null);
  const invite = () =>
    app.overlay(
      <FormModal
        title="Person aufnehmen"
        fields={[{ name: 'email', label: 'E-Mail-Adresse', type: 'email', required: true }, { name: 'displayName', label: 'Name (Charakter)', required: true }, { name: 'rank', label: 'Rang' },
          ...(app.can('gruppen', 2) ? [{ name: 'group', label: 'Gruppe', type: 'select' as const, options: [['', '– keine –'] as [string, string], ...d.groups.filter((g) => !g.isOwner).map((g) => [g.id, g.name] as [string, string])] }] : [])]}
        submit={(v) => api.post<{ startPassword: string | null }>(app.c('/members'), { email: v.email, displayName: v.displayName, rank: v.rank, groups: v.group ? [v.group] : [] }).then((r) => ({ ...r, email: v.email }))}
        onDone={(r) => { const x = r as { startPassword: string | null; email: string }; if (x.startPassword) setReveal({ email: x.email, pw: x.startPassword }); else app.toast('Vorhandenes Konto aufgenommen'); }}
        submitLabel="Aufnehmen"
      >
        <p className="small muted" style={{ margin: 0 }}>Gibt es das Konto auf dem Server schon, wird es nur in die Firma aufgenommen. Sonst legt Pitstop es mit einem Startpasswort an.</p>
      </FormModal>,
    );
  return (
    <>
      <PageHead eyebrow="Firma" title="Mitglieder & Zugänge" sub={`${d.members.length} Mitglieder · ${d.members.filter((m) => m.locked).length} gesperrt`}>
        {app.can('gruppen') && <button className="btn" onClick={() => app.go('gruppen')}><Icon name="shield" size={15} /> Gruppen</button>}
        {app.can('zugaenge', 2) && app.special('einladen') && <button className="btn pri" onClick={invite}><Icon name="plus" size={15} /> Aufnehmen</button>}
      </PageHead>
      {reveal && (
        <div className="alert ok" style={{ marginBottom: 14 }}>
          <Icon name="lock" />
          <div className="grow">Startpasswort für <b>{reveal.email}</b> – jetzt weitergeben, es wird nur einmal angezeigt:<div className="reveal" style={{ marginTop: 8 }}>{reveal.pw}</div></div>
          <button className="ibtn" onClick={() => setReveal(null)} aria-label="Ausblenden"><Icon name="x" /></button>
        </div>
      )}
      <Card>
        <Table head={['Person', 'Gruppen', 'Ausnahmen', 'Status', 'Zuletzt']}>
          {d.members.map((m) => {
            const gs = d.groups.filter((g) => g.members.includes(m.userId));
            const ex = d.exceptions.filter((e) => e.userId === m.userId).length;
            return (
              <tr key={m.userId} data-o onClick={() => app.overlay(<MemberDrawer m={m} />)}>
                <td><div className="who"><Avatar name={m.displayName} size={30} /><div><b>{m.displayName}</b><span>{m.rank || m.email}</span></div></div></td>
                <td><div className="row wrap" style={{ gap: 4 }}>{gs.length ? gs.map((g) => <span key={g.id} className="pill gpill" style={{ '--gc': g.color } as React.CSSProperties}>{g.name}</span>) : <Pill tone="warn">keine Gruppe</Pill>}</div></td>
                <td>{ex ? <Pill tone="warn" dot={false}>{ex}</Pill> : <span className="dim">–</span>}</td>
                <td>{m.locked ? <Pill tone="bad">gesperrt</Pill> : <Pill tone="ok">aktiv</Pill>}</td>
                <td className="small muted">{m.lastLoginAt ? formatAgo(m.lastLoginAt) : 'noch nie'}</td>
              </tr>
            );
          })}
        </Table>
      </Card>
    </>
  );
}

function LevelSeg({ value, onChange, disabled }: { value: Level; onChange: (l: Level) => void; disabled?: boolean }) {
  return (
    <div className="pseg" role="group">
      {LEVELS.map((l) => (
        <button key={l} disabled={disabled} className={l === value ? `on l${l}` : ''} aria-pressed={l === value} onClick={() => onChange(l)} title={LEVEL_LABEL[l]}>
          {l === 'x' ? <Icon name="lock" size={12} /> : LEVEL_LABEL[l]}
        </button>
      ))}
    </div>
  );
}

export function GroupsPage() {
  const app = useApp();
  const d = app.data!;
  const [sel, setSel] = useState(d.groups.find((g) => !g.isOwner)?.id ?? d.groups[0]?.id);
  const [view, setView] = useState<'Bearbeiten' | 'Vergleich'>('Bearbeiten');
  const g = d.groups.find((x) => x.id === sel) ?? d.groups[0];
  const edit = app.can('gruppen', 2) && !g?.isOwner;
  const areas = AREAS.filter((a) => a.module === 'firma' || d.company.modules.includes(a.module));
  const save = (p: Partial<Group>, msg?: string) => app.act(() => api.put(app.c(`/groups/${g.id}`), { name: g.name, color: g.color, description: g.description, levels: g.levels, own: g.own, specials: g.specials, ...p }), msg);
  const setLevel = (ids: string[], l: Level) => { const lv = { ...g.levels }; ids.forEach((id) => { if (l === '0') delete lv[id]; else lv[id] = l; }); return save({ levels: lv }); };

  const head = (
    <PageHead eyebrow="Firma" title="Gruppen & Rechte" sub="Eigene Gruppen mit Rechten pro Bereich · eine Person kann in mehreren Gruppen sein">
      <Seg value={view} options={['Bearbeiten', 'Vergleich'] as const} onChange={setView} />
      {app.can('gruppen', 2) && (
        <button className="btn pri" onClick={() => app.act(() => api.post<{ id: string }>(app.c('/groups'), { name: 'Neue Gruppe', color: '#38bdf8', description: '', levels: {}, own: {}, specials: {} }), 'Gruppe angelegt – startet ohne Rechte').then((r) => r && setSel(r.id))}>
          <Icon name="plus" size={15} /> Gruppe
        </button>
      )}
    </PageHead>
  );
  if (!g) return <>{head}<Empty title="Keine Gruppen" /></>;

  if (view === 'Vergleich') {
    return (
      <>
        {head}
        <Card>
          <div className="tw">
            <table className="t pm">
              <thead><tr><th>Bereich</th>{d.groups.map((x) => <th key={x.id} className="c"><span className="row" style={{ gap: 6, justifyContent: 'center' }}><i style={{ width: 8, height: 8, borderRadius: '50%', background: x.color }} />{x.name}</span></th>)}</tr></thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.id}>
                    <td>{a.label}</td>
                    {d.groups.map((x) => <td key={x.id} className="c">{x.isOwner ? <LevelPill level="3" /> : <LevelPill level={(x.levels[a.id] ?? '0') as Level} own={!!x.own[a.id]} />}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </>
    );
  }

  return (
    <>
      {head}
      <div className="g c12">
        <div className="s4 stack">
          <Card title="Gruppen">
            {d.groups.map((x) => (
              <button key={x.id} className={`gitem ${x.id === g.id ? 'on' : ''}`} onClick={() => setSel(x.id)}>
                <i style={{ background: x.color }} />
                <span className="grow"><b>{x.name}</b><span className="small muted">{x.isOwner ? 'alle Rechte' : `${Object.values(x.levels).filter((l) => l !== 'x').length} Bereiche · ${Object.values(x.levels).filter((l) => l === 'x').length} gesperrt`}</span></span>
                <span className="avs">{x.members.slice(0, 3).map((m) => <Avatar key={m} name={d.members.find((y) => y.userId === m)?.displayName ?? '?'} size={22} />)}</span>
              </button>
            ))}
          </Card>
          <Card title="Stufen">
            {([['x', 'Gesperrt', 'Unsichtbar – je nach Regel auch wenn eine andere Gruppe es erlaubt.'], ['0', 'Nicht gesetzt', 'Diese Gruppe sagt nichts dazu.'], ['1', 'Sehen', 'Lesen, nichts ändern.'], ['2', 'Bearbeiten', 'Anlegen und ändern.'], ['3', 'Verwalten', 'Zusätzlich löschen und Einstellungen.']] as const).map(([l, n, t]) => (
              <div key={l} className="li" style={{ alignItems: 'flex-start' }}><LevelPill level={l} /><div className="tx"><b>{n}</b><span style={{ whiteSpace: 'normal' }}>{t}</span></div></div>
            ))}
            {app.can('firma', 2) && (
              <div style={{ marginTop: 10 }}>
                <div className="small muted" style={{ marginBottom: 6 }}>Bei mehreren Gruppen</div>
                <Seg value={d.company.lockWins ? 'sperre' : 'hoch'} options={[['sperre', 'Gesperrt gewinnt'], ['hoch', 'Höchstes Recht gewinnt']]} onChange={(v) => app.act(() => api.patch(app.c('/settings'), { lockWins: v === 'sperre' }), 'Regel gespeichert')} />
              </div>
            )}
          </Card>
        </div>
        <div className="s8 stack">
          <Card title={<span className="row" style={{ gap: 8 }}><i style={{ width: 10, height: 10, borderRadius: '50%', background: g.color }} />{g.name}</span>}
            right={edit ? <>
              <button className="btn sm ghost" onClick={() => app.act(() => api.post<{ id: string }>(app.c('/groups'), { name: `${g.name} (Kopie)`, color: g.color, description: g.description, levels: g.levels, own: g.own, specials: g.specials }), 'Kopiert').then((r) => r && setSel(r.id))}>Duplizieren</button>
              {app.can('gruppen', 3) && <button className="btn sm ghost" onClick={() => app.overlay(<Confirm title={`„${g.name}“ löschen?`} text={`${g.members.length} Personen verlieren die Rechte dieser Gruppe.`} okLabel="Löschen" onOk={() => app.act(() => api.del(app.c(`/groups/${g.id}`)), 'Gruppe gelöscht').then(() => setSel(d.groups[0].id))} />)}>Löschen</button>}
            </> : undefined}>
            {g.isOwner && <div className="alert warn" style={{ marginBottom: 12 }}><Icon name="shield" /><div>Die Inhaber-Gruppe hat immer alle Rechte und lässt sich nicht einschränken. Inhaber überträgt ein Server-Admin.</div></div>}
            <div className="row wrap" style={{ gap: 12, alignItems: 'flex-end' }}>
              <div className="field grow" style={{ minWidth: 180 }}><label htmlFor="g-name">Name</label><input id="g-name" key={`n-${g.id}`} defaultValue={g.name} disabled={!edit} onBlur={(e) => e.target.value.trim() && e.target.value !== g.name && save({ name: e.target.value.trim() }, 'Gespeichert')} /></div>
              <div className="field" style={{ flex: 2, minWidth: 200 }}><label htmlFor="g-desc">Beschreibung</label><input id="g-desc" key={`d-${g.id}`} defaultValue={g.description} disabled={!edit} onBlur={(e) => e.target.value !== g.description && save({ description: e.target.value }, 'Gespeichert')} /></div>
              <div className="row" style={{ gap: 6, paddingBottom: 6 }}>{COLORS.map((c) => <button key={c} className={`dotc ${g.color === c ? 'on' : ''}`} style={{ background: c }} disabled={!edit} aria-label={`Farbe ${c}`} onClick={() => save({ color: c })} />)}</div>
            </div>
          </Card>
          <Card title="Bereiche">
            {MODULES.filter((m) => m.id === 'firma' || d.company.modules.includes(m.id)).map((mod) => {
              const items = areas.filter((a) => a.module === mod.id);
              const vals = items.map((a) => (g.levels[a.id] ?? '0') as Level);
              const same = vals.every((v) => v === vals[0]) ? vals[0] : null;
              return (
                <div key={mod.id} className="pblock">
                  <div className="pbh"><b>{mod.name}</b><span className="small muted grow">{g.isOwner ? 'Verwalten' : same === null ? 'gemischt' : LEVEL_LABEL[same]}</span>{edit && <><span className="small muted">Alle:</span><LevelSeg value={same ?? ('' as Level)} onChange={(l) => setLevel(items.map((a) => a.id), l)} /></>}</div>
                  {items.map((a) => (
                    <div key={a.id} className="prow">
                      <span className="pl">{a.label}</span>
                      {g.isOwner ? <LevelPill level="3" /> : <LevelSeg value={(g.levels[a.id] ?? '0') as Level} disabled={!edit} onChange={(l) => setLevel([a.id], l)} />}
                      {a.own && !g.isOwner && (
                        <label className={`own ${['1', '2', '3'].includes(g.levels[a.id] ?? '') ? '' : 'off'}`}>
                          <input type="checkbox" disabled={!edit} checked={!!g.own[a.id]} onChange={(e) => { const own = { ...g.own }; if (e.target.checked) own[a.id] = true; else delete own[a.id]; void save({ own }); }} /> {a.own}
                        </label>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </Card>
          <Card title="Sonderrechte und Grenzen">
            {SPECIALS.filter((s) => s.module === 'firma' || d.company.modules.includes(s.module)).map((s) => {
              const v = g.isOwner ? true : g.specials[s.key];
              const on = v !== undefined && v !== false;
              return (
                <div key={s.key} className="prow">
                  <span className="pl">{s.label}</span>
                  {s.kind === 'usd' && on && !g.isOwner && (
                    <span className="row small muted" style={{ gap: 6 }}>bis $<input className="mini" key={`${g.id}-${s.key}`} inputMode="numeric" defaultValue={typeof v === 'number' ? v : ''} disabled={!edit} aria-label={`Grenze für ${s.label}`} onBlur={(e) => save({ specials: { ...g.specials, [s.key]: Number(e.target.value.replace(/\D/g, '')) || 0 } }, 'Grenze gespeichert')} /> (0 = ohne Grenze)</span>
                  )}
                  <Switch on={on} disabled={!edit} label={s.label} onChange={(n) => { const sp = { ...g.specials }; if (n) sp[s.key] = s.kind === 'usd' ? 1000 : true; else delete sp[s.key]; void save({ specials: sp }); }} />
                </div>
              );
            })}
          </Card>
          <Card title={`Mitglieder (${g.members.length})`}>
            {g.members.map((id) => { const m = d.members.find((x) => x.userId === id); return m ? <div key={id} className="li" data-o onClick={() => app.overlay(<MemberDrawer m={m} />)}><Avatar name={m.displayName} /><div className="tx"><b>{m.displayName}</b><span>{m.rank}</span></div></div> : null; })}
            {!g.members.length && <p className="muted small" style={{ margin: 0 }}>Noch niemand. Personen fügst du unter Mitglieder & Zugänge hinzu.</p>}
          </Card>
        </div>
      </div>
    </>
  );
}

export function ModulesPage() {
  const app = useApp();
  const d = app.data!;
  const edit = app.can('module', 2);
  const toggle = (id: string, on: boolean) => app.act(() => api.put(app.c('/modules'), { modules: on ? [...d.company.modules, id] : d.company.modules.filter((m) => m !== id) }), on ? 'Modul eingeschaltet' : 'Modul ausgeschaltet');
  return (
    <>
      <PageHead eyebrow="Firma" title="Module" sub="Ausgeschaltete Module verschwinden für alle aus der Navigation. Die Daten bleiben erhalten." />
      <div className="g g3">
        {MODULES.filter((m) => m.optional).map((m) => {
          const on = d.company.modules.includes(m.id);
          return (
            <div key={m.id} className={`card mod ${on ? '' : 'off'}`}>
              <div className="row"><div className="grow"><b style={{ fontSize: 16 }}>{m.name}</b></div><Switch on={on} disabled={!edit} label={m.name} onChange={(v) => toggle(m.id, v)} /></div>
              <p className="muted small" style={{ margin: '12px 0 0' }}>{m.desc}</p>
            </div>
          );
        })}
      </div>
      <p className="small muted" style={{ marginTop: 14 }}>Tuning, Racing, Schulungen, Lager und Dienstplan kommen in einer späteren Version.</p>
    </>
  );
}

export function AuditPage() {
  const app = useApp();
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  useEffect(() => { void api.get<{ entries: AuditEntry[] }>(app.c('/audit')).then((r) => setEntries(r.entries)).catch((e) => app.toast(errorMessage(e), 'bad')); }, [app]);
  return (
    <>
      <PageHead eyebrow="Firma" title="Protokoll" sub="Wer hat wann was geändert (letzte 200 Einträge)" />
      <Card>
        {entries === null ? <Empty title="Lädt …" /> : entries.length ? (
          <Table head={['Zeit', 'Wer', 'Bereich', 'Aktion']}>
            {entries.map((e) => <tr key={e.id}><td className="mono small">{formatDateTime(e.createdAt)}</td><td>{e.userName}</td><td><Pill dot={false}>{e.area}</Pill></td><td>{e.action}</td></tr>)}
          </Table>
        ) : <Empty title="Noch keine Einträge" />}
      </Card>
    </>
  );
}

