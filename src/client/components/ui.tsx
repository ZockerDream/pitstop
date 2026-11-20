// Bausteine der Oberfläche (Klassen aus index.css / Mockup).
import { useState, type ReactNode } from 'react';
import { LEVEL_LABEL, type Level } from '../../shared/permissions';
import { centsToInput, initials, parseUsd } from '../../shared/format';
import { errorMessage, fieldErrors } from '../lib/api';
import { useApp } from '../lib/app';
import { Icon } from '../lib/icons';

export function PageHead({ eyebrow, title, sub, children }: { eyebrow: string; title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ph">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      {children && <div className="act">{children}</div>}
    </div>
  );
}

export function Card({ title, right, children, className = '', style }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <section className={`card ${className}`} style={style}>
      {(title || right) && (
        <div className="ch">
          {title && <h2>{title}</h2>}
          {right && <div className="r">{right}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export const Pill = ({ children, tone = '', dot = true }: { children: ReactNode; tone?: string; dot?: boolean }) => <span className={`pill ${tone} ${dot ? 'dot' : ''}`}>{children}</span>;

export function Avatar({ name, color, size = 28 }: { name: string; color?: string; size?: number }) {
  const hue = [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360;
  return (
    <div className="av" style={{ width: size, height: size, fontSize: Math.round(size * 0.4), background: color ?? `hsl(${hue} 70% 68%)` }}>
      {initials(name)}
    </div>
  );
}

export function Kpi({ label, value, detail }: { label: string; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="card kpi">
      <span className="l">{label}</span>
      <span className="v">{value}</span>
      {detail && <span className="d">{detail}</span>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <b>{title}</b>
      {children}
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[] | [T, string][]; onChange: (v: T) => void; label?: string }) {
  const opts = options.map((o) => (Array.isArray(o) ? o : [o, o])) as [T, string][];
  return (
    <div className="seg" role="group" aria-label={label}>
      {opts.map(([v, l]) => (
        <button key={v} type="button" className={v === value ? 'on' : ''} aria-pressed={v === value} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" className={`sw ${on ? 'on' : ''}`} role="switch" aria-checked={on} aria-label={label} disabled={disabled} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export const LevelPill = ({ level, own }: { level: Level; own?: boolean }) => (
  <span className={`lvl ${{ x: 'bad', 0: '', 1: 'i', 2: 'o', 3: 'a' }[level]}`}>
    {LEVEL_LABEL[level]}
    {own ? ' · eigene' : ''}
  </span>
);

export function Table({ head, children }: { head: (string | [string, 'r' | 'c'])[]; children: ReactNode }) {
  return (
    <div className="tw">
      <table className="t">
        <thead>
          <tr>
            {head.map((h, i) => (Array.isArray(h) ? <th key={i} className={h[1]}>{h[0]}</th> : <th key={i}>{h}</th>))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

/** Seitenpanel rechts; schließt über Hintergrund, × oder Esc. */
export function Drawer({ title, sub, children, foot, onClose }: { title: ReactNode; sub?: ReactNode; children: ReactNode; foot?: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={typeof title === 'string' ? title : undefined} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="dh">
          <div className="grow">
            {sub && <div className="small muted">{sub}</div>}
            <h3>{title}</h3>
          </div>
          <button className="ibtn" onClick={onClose} aria-label="Schließen">
            <Icon name="x" />
          </button>
        </div>
        <div className="db">{children}</div>
        {foot && <div className="df">{foot}</div>}
      </aside>
    </>
  );
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-label={title} onKeyDown={(e) => e.key === 'Escape' && onClose()}>
        <div className="dh" style={{ padding: '14px 16px' }}>
          <h3 className="grow" style={{ fontSize: 20, margin: 0 }}>
            {title}
          </h3>
          <button className="ibtn" onClick={onClose} aria-label="Schließen">
            <Icon name="x" />
          </button>
        </div>
        <div style={{ padding: 16, maxHeight: '72vh', overflowY: 'auto' }}>{children}</div>
      </div>
    </>
  );
}

export type FieldDef =
  | { name: string; label: string; type?: 'text' | 'textarea' | 'date' | 'email' | 'datetime'; required?: boolean; placeholder?: string }
  | { name: string; label: string; type: 'multi'; options: [string, string][] }
  | { name: string; label: string; type: 'usd' | 'number'; required?: boolean }
  | { name: string; label: string; type: 'select'; options: [string, string][]; required?: boolean }
  | { name: string; label: string; type: 'checkbox' };

type Values = Record<string, unknown>;

/** ISO-Zeitpunkt → Wert für <input type="datetime-local"> in Ortszeit. */
export const localInput = (iso: string) => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

/** Formular im Modal: zeigt Feldfehler der API an. usd-Felder werden als Cent übergeben. */
export function FormModal({ title, fields, initial = {}, submit, onDone, submitLabel = 'Speichern', children }: {
  title: string;
  fields: FieldDef[];
  initial?: object;
  submit: (v: Values) => Promise<unknown>;
  onDone?: (result: unknown) => void;
  submitLabel?: string;
  children?: ReactNode;
}) {
  const app = useApp();
  const [vals, setVals] = useState<Record<string, string | boolean | string[]>>(() =>
    Object.fromEntries(
      fields.map((f) => {
        const v = (initial as Values)[f.name];
        if (f.type === 'checkbox') return [f.name, !!v];
        if (f.type === 'multi') return [f.name, Array.isArray(v) ? (v as string[]) : []];
        if (f.type === 'datetime') return [f.name, typeof v === 'string' && v ? (v.length > 16 ? localInput(v) : v) : ''];
        if (f.type === 'usd') return [f.name, typeof v === 'number' ? centsToInput(v) : ''];
        return [f.name, v === null || v === undefined ? '' : String(v)];
      }),
    ),
  );
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const close = () => app.overlay(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const out: Values = {};
    const local: Record<string, string> = {};
    for (const f of fields) {
      const v = vals[f.name];
      if (f.type === 'checkbox' || f.type === 'multi') out[f.name] = v;
      else if (f.type === 'datetime') {
        const t = String(v).trim() ? new Date(String(v)) : null;
        if (t && Number.isNaN(t.getTime())) local[f.name] = 'Datum und Uhrzeit wählen';
        out[f.name] = t ? t.toISOString() : null;
      } else if (f.type === 'usd') {
        const cents = String(v).trim() === '' ? 0 : parseUsd(String(v));
        if (cents === null) local[f.name] = 'Betrag wie 1.250 oder 99,50';
        else out[f.name] = cents;
      } else if (f.type === 'number') {
        const n = Number(String(v).replace(',', '.'));
        if (String(v).trim() !== '' && !Number.isFinite(n)) local[f.name] = 'Zahl erwartet';
        out[f.name] = String(v).trim() === '' ? undefined : n;
      }
      else if (f.type === 'select' || f.type === 'date') out[f.name] = v === '' ? null : v;
      else out[f.name] = String(v);
      if ('required' in f && f.required && String(v).trim() === '') local[f.name] = 'Pflichtfeld';
    }
    setErrs(local);
    if (Object.keys(local).length) return;
    setBusy(true);
    try {
      const r = await submit(out);
      await app.reload();
      close();
      onDone?.(r);
    } catch (err) {
      setErrs(fieldErrors(err));
      app.toast(errorMessage(err), 'bad');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={title} onClose={close}>
      <form className="stack" onSubmit={onSubmit} noValidate>
        {children}
        {fields.map((f, i) => {
          const id = `ff-${f.name}`;
          const set = (v: string | boolean | string[]) => setVals((s) => ({ ...s, [f.name]: v }));
          const err = errs[f.name];
          if (f.type === 'multi') {
            const cur = vals[f.name] as string[];
            return (
              <div className="field" key={f.name}>
                <label>{f.label}</label>
                <div className="chips">
                  {f.options.map(([v, l]) => (
                    <button type="button" key={v} className={`chip ${cur.includes(v) ? 'on' : ''}`} aria-pressed={cur.includes(v)} onClick={() => set(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v])}>{l}</button>
                  ))}
                </div>
                {err && <span className="err">{err}</span>}
              </div>
            );
          }
          if (f.type === 'checkbox')
            return (
              <label key={f.name} className="row small" style={{ gap: 8 }}>
                <input type="checkbox" checked={!!vals[f.name]} onChange={(e) => set(e.target.checked)} /> {f.label}
              </label>
            );
          return (
            <div className="field" key={f.name}>
              <label htmlFor={id}>
                {f.label}
                {'required' in f && f.required ? ' *' : ''}
              </label>
              {f.type === 'select' ? (
                <select id={id} value={String(vals[f.name])} onChange={(e) => set(e.target.value)}>
                  {f.options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea id={id} rows={3} value={String(vals[f.name])} onChange={(e) => set(e.target.value)} />
              ) : (
                <input
                  id={id}
                  autoFocus={i === 0}
                  type={f.type === 'date' ? 'date' : f.type === 'email' ? 'email' : f.type === 'datetime' ? 'datetime-local' : 'text'}
                  inputMode={f.type === 'usd' || f.type === 'number' ? 'decimal' : undefined}
                  placeholder={f.type === 'usd' ? '$' : 'placeholder' in f ? f.placeholder : undefined}
                  value={String(vals[f.name])}
                  onChange={(e) => set(e.target.value)}
                />
              )}
              {err && <span className="err">{err}</span>}
            </div>
          );
        })}
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn ghost" onClick={close}>
            Abbrechen
          </button>
          <button className="btn pri" type="submit" disabled={busy}>
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}

/** Bestätigung vor gefährlichen Aktionen. */
export function Confirm({ title, text, okLabel, onOk }: { title: string; text: ReactNode; okLabel: string; onOk: () => Promise<unknown> }) {
  const app = useApp();
  return (
    <Modal title={title} onClose={() => app.overlay(null)}>
      <div className="stack">
        <div>{text}</div>
        <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn ghost" onClick={() => app.overlay(null)}>
            Abbrechen
          </button>
          <button
            className="btn pri"
            onClick={async () => {
              app.overlay(null);
              await onOk();
            }}
          >
            {okLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
