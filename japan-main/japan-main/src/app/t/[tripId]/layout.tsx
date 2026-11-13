'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '../../../lib/daten';
import { gilt, heuteIso, zeitraum } from '../../../lib/dates';
import { laufend, planFortschritt, reiseTage } from '../../../lib/plan';
import { Chip, Fortschritt, Karten, IconKnopf, Leer, SeitenKopf, cx } from '../../../components/ui';
import { geld } from '../../../lib/format';

/**
 * Der Rahmen einer Reise: oben Name, Zeitraum und Fortschritt, darunter die
 * Blätter. Die Blattleiste ist auf dem Handy querbar, auf dem Rechner eine Zeile.
 */
export default function ReiseLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tripId: string }>();
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === params.tripId);
  const heute = heuteIso();

  useEffect(() => {
    if (reise && store.einstellungen.aktive_reise !== reise.id) store.aktivSetzen(reise.id);
    // nur beim Wechsel der Reise
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reise?.id]);

  if (!store.bereit) {
    return (
      <main className="seite">
        <SeitenKopf titel="Reise wird geladen …" />
      </main>
    );
  }

  if (!reise) {
    return (
      <main className="seite pb-6">
        <SeitenKopf titel="Reise nicht gefunden" />
        <Karten>
          <Leer zeichen="🧳" titel="Diese Reise gibt es hier nicht" text="Vielleicht ist sie gelöscht oder der Link ist älter." knopf={<Link href="/reisen" className="knopf no-underline">zu meinen Reisen</Link>} />
        </Karten>
      </main>
    );
  }

  const eintraege = store.eintraegeVon(reise.id);
  const tage = reiseTage(reise);
  const fort = planFortschritt(reise, eintraege);
  const kosten = eintraege.reduce((s, e) => s + (e.preis ?? 0), 0);
  const grund = `/t/${reise.id}`;
  const blätter = [
    { id: 'kalender', label: 'Kalender', zeichen: '🗓️' },
    { id: 'liste', label: 'Aktivitäten', zeichen: '📍' },
    { id: 'hotels', label: 'Unterkünfte', zeichen: '🛏️' },
    { id: 'karte', label: 'Karte', zeichen: '🗺️' },
    { id: 'daten', label: 'Reisedaten', zeichen: '⚙️' },
  ];

  return (
    <div className="pb-6">
      <header className="seite pt-3">
        <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
          <span className="min-w-0 flex-1">
            <Link href="/reisen" className="mikro no-underline hover:underline">
              ‹ Reisen
            </Link>
            <h1 className="mt-0.5 text-balance">{reise.name}</h1>
            <p className="mikro mt-0.5 flex flex-wrap items-center gap-x-1.5">
              <span>{gilt(reise.start_date) ? zeitraum(reise.start_date, reise.end_date) : 'ohne Zeitraum'}</span>
              <span aria-hidden>·</span>
              <span>{tage.length ? `${tage.length} ${tage.length === 1 ? 'Tag' : 'Tage'}` : 'keine Tage'}</span>
              {kosten > 0 ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {geld(kosten, reise.waehrung)}
                    {reise.budget ? ` / ${geld(reise.budget, reise.waehrung)}` : ''}
                  </span>
                </>
              ) : null}
              {laufend(reise, heute) ? <Chip ton="gut">läuft</Chip> : null}
              {reise.archived ? <Chip>Archiv</Chip> : null}
            </p>
          </span>
          <div className="flex w-full items-center gap-2 sm:w-56">
            <Fortschritt prozent={fort.prozent} className="flex-1" />
            <span className="mikro tabular-nums">{fort.prozent}%</span>
            <Link href={`${grund}/daten`} className="icon-knopf no-underline" title="Reisedaten ändern" aria-label="Reisedaten ändern">
              ✏️
            </Link>
          </div>
        </div>

        <nav className="gelenk mt-2.5" aria-label="Blätter der Reise">
          {blätter.map((b) => {
            const an = `/${params.tripId}/${b.id}`;
            return (
              <Link
                key={b.id}
                href={`${grund}/${b.id}`}
                className={cx('chip !px-3 !py-2 !text-[13.5px] no-underline')}
                style={{ borderColor: 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
              >
                <span aria-hidden>{b.zeichen}</span> {b.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <div className="seite">{children}</div>
    </div>
  );
}
