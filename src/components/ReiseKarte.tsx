'use client';

import Link from 'next/link';
import { gilt, heuteIso, tagLang, zeitraum } from '../lib/dates';
import { laufend, planFortschritt, reiseTage, tagEintraege, inTagen } from '../lib/plan';
import { geld, plural, zaehlen } from '../lib/format';
import type { Eintrag, Reise } from '../lib/types';
import { Chip, Fortschritt, Menue, cx, type MenuePunkt } from './ui';

/** Die Reise als Karte – groß als Titel, klein in der Liste. */
export function ReiseKarte({
  reise,
  eintraege,
  grosz = false,
  verwalten,
}: {
  reise: Reise;
  eintraege: Eintrag[];
  grosz?: boolean;
  verwalten?: MenuePunkt[];
}) {
  const heute = heuteIso();
  const aktiv = laufend(reise, heute);
  const bald = inTagen(reise, heute);
  const fort = planFortschritt(reise, eintraege);
  const tage = reiseTage(reise);
  const geplant = eintraege.filter((e) => e.date).length;
  const betten = eintraege.filter((e) => e.art === 'unterkunft').length;
  const beplant = tage.filter((d) => tagEintraege(eintraege, d).length > 0).length;
  const kosten = eintraege.reduce((s, e) => s + (e.preis ?? 0), 0);

  return (
    <article
      className={cx('karte relative overflow-hidden transition hover:-translate-y-0.5', grosz && 'sm:flex')}
      style={{ boxShadow: 'var(--schatten)' }}
    >
      <Link href={`/t/${reise.id}`} className={cx('min-w-0 flex-1 no-underline', grosz && 'sm:flex')} aria-label={reise.name}>
      <div className={cx('relative shrink-0 bg-[#dfe5ee]', grosz ? 'h-40 w-full sm:h-auto sm:w-[46%]' : 'h-24 w-full')}>
        {reise.cover_url ? (
          <img src={reise.cover_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span aria-hidden className="grid h-full w-full place-items-center text-[30px]">
            🏙️
          </span>
        )}
        {aktiv ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[var(--akzent)] px-2.5 py-1 text-[13px] font-semibold text-white">läuft gerade</span>
        ) : bald !== null && bald >= 0 && bald <= 30 ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-white/92 px-2.5 py-1 text-[13px] font-semibold" style={{ color: 'var(--akzent-text)' }}>
            in {plural(bald, 'Tag', 'Tagen')}
          </span>
        ) : null}
        {reise.cover_credit ? (
          <span className="mikro absolute bottom-1 right-2 max-w-[70%] truncate text-white [text-shadow:0_1px_2px_rgba(0,0,0,.6)]">{reise.cover_credit}</span>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 p-3">
        <div className="flex items-start gap-2">
          <h3 className={cx('min-w-0 flex-1 truncate font-semibold leading-snug', grosz ? 'text-[19px]' : 'text-[16px]')}>{reise.name}</h3>
          {reise.archived ? <Chip>Archiv</Chip> : null}
        </div>
        <p className="mikro mt-0.5 truncate">{[reise.stationen, reise.land].filter(Boolean).join(' · ') || 'kein Ziel gesetzt'}</p>
        <p className="mikro mt-1 flex flex-wrap items-center gap-x-1.5">
          <span>{gilt(reise.start_date) ? zeitraum(reise.start_date, reise.end_date) : 'ohne Zeitraum'}</span>
          {tage.length ? (
            <>
              <span aria-hidden>·</span>
              <span>{plural(tage.length, 'Tag', 'Tage')}</span>
            </>
          ) : null}
          {kosten > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span>{geld(kosten, reise.waehrung)}</span>
            </>
          ) : null}
        </p>

        <p className="mikro mt-1.5">{zaehlen([[geplant, 'Aktivität', 'Aktivitäten'], [betten, 'Unterkunft', 'Unterkünfte'], [beplant, 'Tag geplant', 'Tage geplant']]) || 'noch nichts geplant'}</p>

        <div className="mt-2 flex items-center gap-2">
          <Fortschritt prozent={fort.prozent} className="flex-1" />
          <span className="mikro tabular-nums">{fort.prozent}%</span>
        </div>
        {grosz && aktiv && tage.length ? <HeuteZeile reise={reise} eintraege={eintraege} datum={heute} /> : null}
      </div>
      </Link>
      {verwalten?.length ? (
        <div className="absolute right-1.5 top-1.5">
          <Menue titel={reise.name} knopfTitel={`Mehr zu ${reise.name}`} punkte={verwalten} />
        </div>
      ) : null}
    </article>
  );
}

function HeuteZeile({ reise, eintraege, datum }: { reise: Reise; eintraege: Eintrag[]; datum: string }) {
  const tage = reiseTage(reise);
  const heute = gilt(reise.start_date) && datum >= reise.start_date && (!gilt(reise.end_date) || datum <= reise.end_date) ? datum : tage[0] ?? datum;
  const liste = tagEintraege(eintraege, heute).slice(0, 3);
  return (
    <div className="mt-2.5 border-t pt-2" style={{ borderColor: 'var(--rand)' }}>
      <p className="mikro font-semibold" style={{ color: 'var(--akzent-text)' }}>
        {tagLang(heute)}
      </p>
      {liste.length ? (
        <ul className="mt-1 space-y-0.5 text-[13.5px] leading-snug">
          {liste.map((e) => (
            <li key={e.id} className="flex min-w-0 gap-1.5">
              <span className="tabular-nums text-[var(--text3)]">{e.zeit ?? '—'}</span>
              <span className="min-w-0 flex-1 truncate">{e.titel}</span>
            </li>
          ))}
          {tagEintraege(eintraege, heute).length > 3 ? <li className="mikro">und {tagEintraege(eintraege, heute).length - 3} weitere</li> : null}
        </ul>
      ) : (
        <p className="mikro mt-1">noch nichts an diesem Tag</p>
      )}
    </div>
  );
}
