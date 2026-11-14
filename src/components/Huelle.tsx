'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '../lib/daten';
import { StatusAnzeige } from './StatusAnzeige';
import { MadeByFlo } from './ui';

/**
 * Die eine Hülle für Handy und Rechner: auf dem Smartphone die Leiste unten,
 * auf dem Rechner die Spalte links. Beide zeigen auf dieselben vier Bereiche –
 * das Profil ist kein Bereich mehr, sondern ein Blatt (⚙️), das dashboard und
 * seitenleiste aufmachen.
 */

const BEREICHE = [
  { id: 'dashboard', href: '/', label: 'Dashboard', kurz: 'Dashboard', zeichen: '🧭' },
  { id: 'reisen', href: '/reisen', label: 'Meine Reisen', kurz: 'Reisen', zeichen: '🧳' },
  { id: 'kalender', href: '/kalender', label: 'Kalender', kurz: 'Kalender', zeichen: '🗓️' },
  { id: 'karte', href: '/karte', label: 'Karte', kurz: 'Karte', zeichen: '🗺️' },
];

function aktiv(beim: string, pfad: string): boolean {
  if (beim === '/') return pfad === '/' || pfad === '';
  if (beim === '/reisen') return pfad === '/reisen' || pfad.startsWith('/reisen/');
  if (beim === '/kalender') return pfad === '/kalender' || pfad.endsWith('/kalender') || /\/t\/[^/]+\/(tag\/.*)?$/.test(pfad);
  return pfad === '/karte' || pfad.endsWith('/karte');
}

export function Huelle({ children }: { children: React.ReactNode }) {
  const pfad = usePathname() ?? '/';
  const { meldung, bereit, aktiveReise } = useStore();
  const ziel = (href: string) => {
    if ((href === '/kalender' || href === '/karte') && aktiveReise) return `/t/${aktiveReise.id}${href}`;
    return href;
  };

  return (
    <div className="md:flex md:items-start">
      {/* Rechner: Spalte links */}
      <nav className="hidden shrink-0 md:sticky md:top-0 md:flex md:h-screen md:w-[236px] md:flex-col md:gap-1 md:border-r md:p-4" style={{ borderColor: 'var(--rand)' }} aria-label="Bereiche">
        <Link href="/" className="mb-3 flex items-center gap-2 px-1 text-[17px] font-bold tracking-tight no-underline" style={{ color: 'var(--text)' }}>
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg text-[17px]" style={{ background: 'var(--akzent)', color: 'var(--auf-akzent)' }}>
            ✈
          </span>
          Reiseplan
        </Link>
        <MadeByFlo className="-mt-2 mb-2 px-1" />
        {BEREICHE.map((b) => (
          <Link
            key={b.id}
            href={ziel(b.href)}
            aria-current={aktiv(b.href, pfad) ? 'page' : undefined}
            className="flex min-h-11 items-center gap-2.5 rounded-xl px-3 text-[15px] font-medium no-underline transition-colors hover:bg-[var(--akzent-fläche)]"
            style={{ color: aktiv(b.href, pfad) ? 'var(--akzent-text)' : 'var(--text2)', background: aktiv(b.href, pfad) ? 'var(--akzent-fläche)' : undefined }}
          >
            <span aria-hidden>{b.zeichen}</span>
            {b.label}
          </Link>
        ))}
        {aktiveReise ? (
          <div className="mt-4 border-t pt-3" style={{ borderColor: 'var(--rand)' }}>
            <p className="label px-1">Unterwegs in</p>
            <Link href={`/t/${aktiveReise.id}`} className="block truncate rounded-lg px-1 text-[14px] font-semibold no-underline" style={{ color: 'var(--text)' }}>
              {aktiveReise.name}
            </Link>
            <div className="mt-1 flex flex-col gap-0.5">
              <Link href={`/t/${aktiveReise.id}/liste`} className="rounded-lg px-1 py-1 text-[13.5px] no-underline hover:underline" style={{ color: 'var(--text2)' }}>
                Aktivitäten
              </Link>
              <Link href={`/t/${aktiveReise.id}/hotels`} className="rounded-lg px-1 py-1 text-[13.5px] no-underline hover:underline" style={{ color: 'var(--text2)' }}>
                Unterkünfte
              </Link>
              <Link href={`/t/${aktiveReise.id}/daten`} className="rounded-lg px-1 py-1 text-[13.5px] no-underline hover:underline" style={{ color: 'var(--text2)' }}>
                Reisedaten
              </Link>
            </div>
          </div>
        ) : null}
        <div className="mt-auto space-y-1 pt-3">
          <StatusAnzeige variant="zeile" pruefen />
          <Link href="/reisen/neu" className="knopf w-full no-underline">
          + Neue Reise
        </Link>
        </div>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>

      {/* Smartphone: Leiste unten */}
      <nav className="dock md:hidden" aria-label="Bereiche">
        {BEREICHE.map((b) => (
          <Link key={b.id} href={ziel(b.href)} aria-current={aktiv(b.href, pfad) ? 'page' : undefined}>
            <span className="ikone" aria-hidden>
              {b.zeichen}
            </span>
            <span className="w-full truncate px-0.5 text-center">{b.kurz}</span>
          </Link>
        ))}
      </nav>

      {meldung ? (
        <p role="status" className="meldung">
          {meldung}
        </p>
      ) : null}
      {!bereit ? <span className="sr-only">Reisedaten werden geladen …</span> : null}
    </div>
  );
}
