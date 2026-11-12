'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useStore } from '../lib/daten';
import { begriessung, heuteIso, tagLang } from '../lib/dates';
import { inTagen, laufend, reiseTage, vergangen } from '../lib/plan';
import { plural } from '../lib/format';
import { ReiseKarte } from '../components/ReiseKarte';
import { Karten, KartenKopf, Chip, Fortschritt, Hinweis, Leer, MadeByFlo, SeitenKopf } from '../components/ui';
import { Einstellungen } from '../components/Einstellungen';
import { StatusAnzeige } from '../components/StatusAnzeige';
import { planFortschritt } from '../lib/plan';

/** Das Dashboard: was läuft, was kommt, was zu tun ist. */
export default function Dashboard() {
  const store = useStore();
  const heute = heuteIso();
  const { reisen, einstellungen } = store;

  const geordnet = useMemo(() => [...reisen].sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999')), [reisen]);
  const laufende = geordnet.filter((r) => !r.archived && laufend(r, heute));
  const kommende = geordnet.filter((r) => !r.archived && !laufend(r, heute) && !vergangen(r, heute));
  const alte = geordnet.filter((r) => r.archived || (!laufend(r, heute) && vergangen(r, heute)));
  const koenigsReise = laufende[0] ?? kommende[0] ?? null;
  const name = (einstellungen.name ?? '').trim().split(' ')[0];

  const offenePunkte = useMemo(() => {
    const liste: { reiseId: string; reiseName: string; text: string }[] = [];
    for (const reise of [...laufende, ...kommende].slice(0, 4)) {
      const eintraege = store.eintraegeVon(reise.id);
      const luecken = reiseTage(reise).slice(0, -1).filter((d) => !eintraege.some((e) => e.art === 'unterkunft' && e.date! <= d && (e.bis_date ?? e.date!) > d));
      const tage = reiseTage(reise).filter((d) => reiseTage(reise).length > 0 && eintraege.filter((e) => e.art !== 'unterkunft' && e.date === d).length === 0);
      if (luecken.length) liste.push({ reiseId: reise.id, reiseName: reise.name, text: `${plural(luecken.length, 'Nacht', 'Nächte')} ohne Unterkunft` });
      if (tage.length) liste.push({ reiseId: reise.id, reiseName: reise.name, text: `${plural(tage.length, 'Tag ist', 'Tage sind')} noch leer` });
      if (!reise.cover_url) liste.push({ reiseId: reise.id, reiseName: reise.name, text: 'Titelbild fehlt' });
    }
    return liste.slice(0, 4);
  }, [kommende, laufende, store]);

  if (!store.bereit) {
    return (
      <main className="seite">
        <SeitenKopf titel={`${begriessung()}${name ? `, ${name}` : ''}`} untertitel="Reisen werden geladen …" />
      </main>
    );
  }

  if (!reisen.length) {
    return (
      <main className="seite pb-6">
        <SeitenKopf titel={`${begriessung()}${name ? `, ${name}` : ''}`} untertitel={tagLang(heute)} seitlich={<Einstellungen />} />
        <Karten className="p-4">
          <Leer
            zeichen="🧳"
            titel="Noch keine Reise"
            text="Ein Name und zwei Termine reichen – der Rest wächst beim Planen."
            knopf={
              <>
                <Link href="/reisen/neu" className="knopf no-underline">
                  Erste Reise anlegen
                </Link>
              </>
            }
          />
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            {[
              { zeichen: '🗓️', text: 'Jeder Tag als Zeitleiste, mit Uhrzeiten und Bildern.' },
              { zeichen: '🛏️', text: 'EinmalHotel eingetragen, erscheint es an jeder Nacht.' },
              { zeichen: '🗺️', text: 'Orte suchen, Punkte übernehmen, Routen dazu.' },
            ].map((t) => (
              <p key={t.text} className="mikro flex items-start gap-2 rounded-xl bg-[var(--akzent-fläche)] p-2.5 text-[13.5px] text-[var(--text2)]">
                <span aria-hidden className="text-[16px]">
                  {t.zeichen}
                </span>
                <span>{t.text}</span>
              </p>
            ))}
          </div>
          <MadeByFlo className="mt-4 text-center" />
        </Karten>
      </main>
    );
  }

  return (
    <main className="seite pb-6">
      <SeitenKopf
        titel={`${begriessung()}${name ? `, ${name}` : ''}`}
        untertitel={
          <span className="flex flex-wrap items-center gap-x-1.5">
            <span>{tagLang(heute)}</span>
            <span aria-hidden>·</span>
            <span>{plural(reisen.length, 'Reise', 'Reisen')} geplant</span>
            <span className="md:hidden">
              <StatusAnzeige />
            </span>
          </span>
        }
        seitlich={
          <span className="flex items-center gap-2">
            <Einstellungen />
            <Link href="/reisen/neu" className="knopf no-underline">
              + Neue Reise
            </Link>
          </span>
        }
      />

      {koenigsReise ? (
        <div className="mb-3">
          {laufende.length ? (
            <p className="mikro mb-1.5 flex flex-wrap items-center gap-1.5 font-semibold" style={{ color: 'var(--akzent-text)' }}>
              <Chip>unterwegs</Chip> Reisetag {Math.max(1, reiseTage(koenigsReise).indexOf(heute) + 1)} von {reiseTage(koenigsReise).length}
            </p>
          ) : (
            <p className="mikro mb-1.5 flex flex-wrap items-center gap-1.5">
              <Chip>
                {inTagen(koenigsReise, heute) !== null && inTagen(koenigsReise, heute)! >= 0 ? `in ${plural(inTagen(koenigsReise, heute)!, 'Tag', 'Tagen')}` : 'geplant'}
              </Chip>
              {tagLang(koenigsReise.start_date ?? heute)}
            </p>
          )}
          <ReiseKarte reise={koenigsReise} eintraege={store.eintraegeVon(koenigsReise.id)} grosz />
        </div>
      ) : null}

      {offenePunkte.length ? (
        <Hinweis className="mb-3">
          <span className="font-semibold">Was noch fehlt</span>
          <ul className="mt-1 space-y-1">
            {offenePunkte.map((o) => (
              <li key={`${o.reiseId}-${o.text}`} className="flex flex-wrap items-baseline gap-x-1.5">
                <Link href={`/t/${o.reiseId}`} className="min-w-0 flex-1 truncate no-underline hover:underline">
                  {o.reiseName}
                </Link>
                <span>{o.text}</span>
              </li>
            ))}
          </ul>
        </Hinweis>
      ) : null}

      {kommende.length > 1 || (kommende.length && !laufende.length) ? (
        <Karten className="mb-3 mt-3">
          <KartenKopf titel="Als Nächstes" seitlich={<Link href="/reisen" className="chip no-underline">alle Reisen</Link>} />
          <div className="space-y-2 p-2.5">
            {kommende.slice(0, 3).map((r) => (
              <ReiseKarte key={r.id} reise={r} eintraege={store.eintraegeVon(r.id)} />
            ))}
          </div>
        </Karten>
      ) : null}

      {alte.length ? (
        <details className="karte mt-3 overflow-hidden">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 p-3 text-[15px] font-semibold">
            <span className="min-w-0 flex-1 truncate">Frühere Reisen ({alte.length})</span>
            <span aria-hidden className="mikro">⌄</span>
          </summary>
          <div className="space-y-2 border-t p-2.5" style={{ borderColor: 'var(--rand)' }}>
            {alte.map((r) => (
              <ReiseKarte key={r.id} reise={r} eintraege={store.eintraegeVon(r.id)} />
            ))}
          </div>
        </details>
      ) : null}

      <MadeByFlo className="mt-5 text-center" />
    </main>
  );
}
