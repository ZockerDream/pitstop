import { ArrowLeft } from 'lucide-react';
import { marked } from 'marked';
import { useMemo } from 'react';
import { href } from '../../lib/router';
import { useLegal } from '../auth/LoginPage';
import { Spinner } from '../ui/misc';

/** Öffentliche Seiten Impressum (.impressum) und Datenschutz (conf/datenschutz.md). */
export function LegalPage({ kind, loggedIn }: { kind: 'impressum' | 'datenschutz'; loggedIn: boolean }) {
  const legal = useLegal();
  const datenschutzHtml = useMemo(() => (legal?.datenschutz ? (marked.parse(legal.datenschutz, { async: false }) as string) : null), [legal]);

  return (
    <div className="min-h-full bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <a href={href('/dashboard')} className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900">
          <ArrowLeft className="size-4" aria-hidden />
          {loggedIn ? 'Zurück zu Pitstop' : 'Zur Anmeldung'}
        </a>
        <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-xs sm:p-10">
          {!legal ? (
            <Spinner />
          ) : kind === 'impressum' ? (
            <Impressum legal={legal} />
          ) : datenschutzHtml ? (
            <div className="prose-legal" dangerouslySetInnerHTML={{ __html: datenschutzHtml }} />
          ) : (
            <>
              <h1 className="text-2xl font-semibold tracking-tight">Datenschutzerklärung</h1>
              <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Für den Betreiber: Die Datenschutzerklärung fehlt noch. Bitte als Markdown-Datei unter <code>conf/datenschutz.md</code> ablegen und{' '}
                <code>docker compose restart app</code> ausführen (siehe README).
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Impressum({ legal }: { legal: NonNullable<ReturnType<typeof useLegal>> }) {
  const i = legal.impressum;
  if (!i) {
    return (
      <>
        <h1 className="text-2xl font-semibold tracking-tight">Impressum</h1>
        <p className="mt-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Für den Betreiber: Die Impressumsangaben fehlen noch. Bitte <code>.impressum-example</code> nach <code>.impressum</code> kopieren, ausfüllen und{' '}
          <code>docker compose up -d</code> ausführen (siehe README).
        </p>
      </>
    );
  }
  const rows: [string, string][] = [
    ['Vertreten durch', i.representedBy],
    ['Telefon', i.phone],
    ['E-Mail', i.email],
    ['Registereintrag', i.register],
    ['Umsatzsteuer-ID', i.vatId],
    ['Verantwortlich für den Inhalt', i.responsible],
  ];
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Impressum</h1>
      <p className="mt-1 text-sm text-zinc-500">Angaben gemäß § 5 DDG</p>
      <address className="mt-6 text-sm leading-relaxed text-zinc-800 not-italic">
        {i.name && <strong className="block text-base">{i.name}</strong>}
        {i.street && <span className="block">{i.street}</span>}
        {i.zipCity && <span className="block">{i.zipCity}</span>}
      </address>
      <dl className="mt-6 space-y-3 text-sm">
        {rows
          .filter(([, v]) => v)
          .map(([label, value]) => (
            <div key={label} className="grid gap-1 sm:grid-cols-[220px_1fr]">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="text-zinc-900">{label === 'E-Mail' ? <a className="text-brand-600 hover:underline" href={`mailto:${value}`}>{value}</a> : value}</dd>
            </div>
          ))}
      </dl>
      {i.extra && <p className="mt-6 text-sm text-zinc-700">{i.extra}</p>}
    </>
  );
}
