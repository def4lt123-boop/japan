'use client';

import Link from 'next/link';
import { abstandTage, gilt, heuteIso, monatsRaster, monatLang, tagKurz, tagNackt, wochentagKurz, WOCHEN_ANFANG } from '../lib/dates';
import { reiseTage } from '../lib/plan';
import { kategorie } from '../lib/kategorien';
import { tagEintraege } from '../lib/plan';
import type { Eintrag, Reise } from '../lib/types';
import { IconKnopf, cx } from './ui';

function Pfeil({ richtung, titel, href }: { richtung: string; titel: string; href: string | null }) {
  if (!href)
    return (
      <span className="icon-knopf opacity-35" aria-hidden>
        {richtung}
      </span>
    );
  return (
    <Link href={href} title={titel} aria-label={titel} className="icon-knopf no-underline">
      {richtung}
    </Link>
  );
}

/** Die Streifen über einem Tag: alle Reisetage, der aktuelle hervorgehoben. */
export function TagesLeiste({ reise, eintraege, aktuell }: { reise: Reise; eintraege: Eintrag[]; aktuell: string }) {
  const tage = reiseTage(reise);
  const liste = tage.length ? tage : [aktuell];
  const index = Math.max(0, liste.indexOf(aktuell));
  const zurueck = index > 0 ? liste[index - 1] : null;
  const weiter = index < liste.length - 1 ? liste[index + 1] : null;
  const basis = `/t/${reise.id}/tag`;

  return (
    <div className="sticky top-0 z-20 -mx-4 mb-1 border-b px-4 py-1.5 backdrop-blur-md md:-mx-6 md:px-6" style={{ background: 'rgb(244 246 249 / 0.92)', borderColor: 'var(--rand)' }}>
      <div className="flex items-center gap-1">
        <Pfeil richtung="◀" titel="vorheriger Tag" href={zurueck ? `${basis}/${zurueck}` : null} />
        <div className="gelenk min-w-0 flex-1">
          {liste.map((d) => {
            const anzahl = tagEintraege(eintraege, d).length;
            const farben = Array.from(new Set(tagEintraege(eintraege, d).map((e) => kategorie(e.kategorie).farbe))).slice(0, 3);
            const an = d === aktuell;
            return (
              <Link
                key={d}
                href={`${basis}/${d}`}
                aria-current={an ? 'page' : undefined}
                className={cx('chip !flex-col !items-center !gap-0.5 !px-2.5 !py-1.5 !text-[13px] no-underline', an && 'chip-aktiv')}
                style={{ borderColor: an ? 'var(--akzent)' : 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
              >
                <span className="font-semibold">{wochentagKurz(d)}</span>
                <span className="tabular-nums">{tagNackt(d).replace('.', '.')}</span>
                <span className="flex h-1.5 items-center gap-0.5" aria-hidden>
                  {farben.length ? farben.map((f) => <i key={f} className="block h-1.5 w-1.5 rounded-full" style={{ background: an ? '#fff' : f }} />) : anzahl ? <i className="block h-1.5 w-1.5 rounded-full bg-white/70" /> : null}
                </span>
              </Link>
            );
          })}
        </div>
        <Pfeil richtung="▶" titel="nächster Tag" href={weiter ? `${basis}/${weiter}` : null} />
      </div>
    </div>
  );
}

/** Monat mit Punkten pro Kategorie – das Kalenderbild der Reise */
export function KalenderRaster({
  reise,
  eintraege,
  jahr,
  monat,
  aktiv,
  aufMonatswechsel,
}: {
  reise: Reise;
  eintraege: Eintrag[];
  jahr: number;
  monat: number;
  aktiv: string | null;
  aufMonatswechsel?: (delta: number) => void;
}) {
  const wochen = monatsRaster(jahr, monat);
  const anfang = reise.start_date;
  const ende = gilt(reise.end_date) ? reise.end_date : (reise.start_date ?? '');

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1">
        {aufMonatswechsel ? (
          <>
            <IconKnopf titel="vorheriger Monat" onClick={() => aufMonatswechsel(-1)}>
              ◀
            </IconKnopf>
            <IconKnopf titel="nächster Monat" onClick={() => aufMonatswechsel(1)}>
              ▶
            </IconKnopf>
          </>
        ) : null}
        <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{monatLang(jahr, monat)}</h2>
        {anfang ? (
          <Link href={`/t/${reise.id}/tag/${anfang}`} className="chip !py-1.5 no-underline">
            {tagKurz(anfang)}–{gilt(ende) ? tagNackt(ende) : '—'} · {abstandTage(anfang, ende) + 1} Tage
          </Link>
        ) : null}
      </div>
      <div className="raster">
        {WOCHEN_ANFANG.map((w) => (
          <span key={w} className="mikro pb-0.5 text-center font-semibold">
            {w}
          </span>
        ))}
        {wochen.flat().map((d, i) => {
          if (!d) return <span key={`l${i}`} className="zelle zelle-leer" aria-hidden />;
          const liste = tagEintraege(eintraege, d);
          const farben = Array.from(new Set(liste.map((e) => kategorie(e.kategorie).farbe)));
          const aufReise = !!anfang && d >= anfang && (!ende || d <= ende);
          const heute = gilt(d) && d === heuteIso();
          const inhalt = (
            <>
              <span className="flex items-baseline justify-between gap-1">
                <span className={cx('tabular-nums', heute && 'grid h-5 w-5 place-items-center rounded-full')} style={heute ? { background: 'var(--akzent)', color: 'var(--auf-akzent)' } : undefined}>
                  {Number(d.slice(8))}
                </span>
                {liste.length ? <span className="mikro !text-[12px] tabular-nums">{liste.length}</span> : null}
              </span>
              <span className="flex flex-wrap gap-0.5" aria-hidden>
                {farben.slice(0, 4).map((f) => (
                  <i key={f} className="block h-1.5 w-1.5 rounded-full" style={{ background: f }} />
                ))}
              </span>
            </>
          );
          return aufMonatswechsel || aktiv !== undefined ? (
            <Link key={d} href={`/t/${reise.id}/tag/${d}`} aria-current={d === aktiv ? 'page' : undefined} className={cx('zelle no-underline', aufReise && 'zelle-reise', d === aktiv && '!border-2')} style={d === aktiv ? { borderColor: 'var(--akzent)' } : undefined}>
              {inhalt}
            </Link>
          ) : (
            <div key={d} className={cx('zelle', aufReise && 'zelle-reise')}>
              {inhalt}
            </div>
          );
        })}
      </div>
    </div>
  );
}
