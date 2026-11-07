'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '../../../../lib/daten';
import { heuteIso, tagKurz, tagLang, wochenTage, wochentagKurz } from '../../../../lib/dates';
import { reiseTage, heutigerTag, tagesPlan, tagEintraege } from '../../../../lib/plan';
import { kategorie } from '../../../../lib/kategorien';
import { KalenderRaster } from '../../../../components/Kalender';
import { Ablage, Chip, Karten, KartenKopf, Segment, cx } from '../../../../components/ui';
import { EintragFormular } from '../../../../components/EintragFormular';
import type { EintragArt } from '../../../../lib/types';

/** Kalender der Reise: der Tag als Liste, die Woche, die ganze Reise – und immer das Monatsbild. */
export default function ReiseKalender() {
  const params = useParams<{ tripId: string }>();
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === params.tripId);
  const [ansicht, setAnsicht] = useState('tag');
  const [formular, setFormular] = useState<{ art: EintragArt; datum: string } | null>(null);

  const eintraege = reise ? store.eintraegeVon(reise.id) : [];
  const heute = heuteIso();
  const bezug = reise ? heutigerTag(reise, heute) ?? heute : heute;
  const start = reise?.start_date && reise.start_date <= bezug ? reise.start_date : bezug;
  const [monat, setMonat] = useState(() => ({ jahr: Number(bezug.slice(0, 4)), monat: Number(bezug.slice(5, 7)) }));

  const tageDerWoche = useMemo(() => wochenTage(bezug), [bezug]);

  if (!store.bereit || !reise) return null;

  const blättern = (delta: number) => {
    setMonat((v) => {
      const index = v.jahr * 12 + (v.monat - 1) + delta;
      return { jahr: Math.floor(index / 12), monat: (index % 12) + 1 };
    });
  };

  return (
    <main className="pb-4">
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 space-y-3">
          <Segment
            wert={ansicht}
            beimAendern={setAnsicht}
            optionen={[
              { id: 'tag', label: 'Tag', zeichen: '📍' },
              { id: 'woche', label: 'Woche', zeichen: '🗓️' },
              { id: 'reise', label: 'Ganze Reise', zeichen: '🧭' },
            ]}
          />

          {ansicht === 'tag' ? <TagesBlock reiseId={reise.id} datum={bezug} offen={setFormular} /> : null}

          {ansicht === 'woche' ? (
            <div className="liste">
              {tageDerWoche.map((d) => (
                <WochenZeile key={d} tripId={reise.id} datum={d} markiert={d === bezug} />
              ))}
            </div>
          ) : null}

          {ansicht === 'reise' ? <ReiseZeitleiste tripId={reise.id} /> : null}
        </section>

        <Karten className="p-3">
          <KalenderRaster reise={reise} eintraege={eintraege} jahr={monat.jahr} monat={monat.monat} aktiv={bezug} aufMonatswechsel={blättern} />
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="mikro">dorthin springen:</span>
            {reiseTage(reise).length ? (
              <Link href={`/t/${reise.id}/tag/${start}`} className="chip !py-1.5 no-underline">
                Anfang {tagKurz(start)}
              </Link>
            ) : null}
            {heuteIso() >= (reise.start_date ?? '') && (!reise.end_date || heuteIso() <= reise.end_date) ? (
              <Link href={`/t/${reise.id}/tag/${bezug}`} className="chip !py-1.5 no-underline">
                heute
              </Link>
            ) : null}
          </div>
        </Karten>
      </div>

      {formular ? (
        <EintragFormular reise={reise} art={formular.art} datum={formular.datum} offen schliessen={() => setFormular(null)} />
      ) : null}
    </main>
  );
}

function TagesBlock({ reiseId, datum, offen }: { reiseId: string; datum: string; offen: (wert: { art: EintragArt; datum: string }) => void }) {
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === reiseId)!;
  const eintraege = store.eintraegeVon(reiseId);
  const plan = tagesPlan(reise, eintraege, datum);
  return (
    <Karten>
      <KartenKopf
        titel={tagLang(datum)}
        untertitel={[plan.stadt, plan.nummer ? `Reisetag ${plan.nummer}` : null].filter(Boolean).join(' · ')}
        seitlich={
          <Link href={`/t/${reiseId}/tag/${datum}`} className="chip !py-1.5 no-underline">
            Tag öffnen
          </Link>
        }
      />
      <div className="p-3">
        {plan.eintraege.length ? (
          <ul className="space-y-1.5">
            {plan.eintraege.map((e) => (
              <li key={e.id} className="flex min-w-0 items-baseline gap-2">
                <span className="zeitangabe !w-11">{e.zeit ?? '—'}</span>
                <span aria-hidden className="shrink-0" style={{ color: kategorie(e.kategorie).farbe }}>
                  {kategorie(e.kategorie).icon}
                </span>
                <Link href={`/t/${reiseId}/tag/${datum}`} className="min-w-0 flex-1 truncate text-[15px] font-medium no-underline hover:underline">
                  {e.titel}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mikro">Nichts geplant.</p>
        )}
        {plan.bett ? (
          <p className="mikro mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2" style={{ borderColor: 'var(--rand)' }}>
            <span aria-hidden>🛏️</span> {plan.bett.titel}
            {plan.bett.preis ? <span>· {plan.bett.preis} {reise.waehrung}</span> : null}
          </p>
        ) : (
          <p className="mikro mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2" style={{ borderColor: 'var(--rand)' }}>
            <span aria-hidden>🌙</span> keine Unterkunft
          </p>
        )}
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <button type="button" className="knopf knopf-klein" onClick={() => offen({ art: 'aktivitaet', datum })}>
            + Aktivität
          </button>
          <button type="button" className="knopf knopf-ghost knopf-klein" onClick={() => offen({ art: 'unterkunft', datum })}>
            + Unterkunft
          </button>
          <button type="button" className="knopf knopf-ghost knopf-klein" onClick={() => offen({ art: 'fahrt', datum })}>
            + Fahrt
          </button>
        </div>
      </div>
    </Karten>
  );
}

function WochenZeile({ tripId, datum, markiert }: { tripId: string; datum: string; markiert: boolean }) {
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === tripId)!;
  const liste = tagEintraege(store.eintraegeVon(tripId), datum);
  const farben = Array.from(new Set(liste.map((e) => kategorie(e.kategorie).farbe)));
  return (
    <Link
      href={`/t/${tripId}/tag/${datum}`}
      className={cx('karte flex min-w-0 items-start gap-2.5 p-2.5 no-underline transition hover:border-[var(--akzent)]')}
      style={{ borderColor: markiert ? 'var(--akzent)' : undefined }}
    >
      <span className="zeitangabe !w-12 flex-col !leading-tight" style={{ paddingTop: 1 }}>
        <span className="block text-[13px] font-semibold">{wochentagKurz(datum)}</span>
        <span className="mikro block">{tagKurz(datum).split(' ')[1]}</span>
      </span>
      <span className="min-w-0 flex-1">
        {liste.length ? (
          <span className="block space-y-0.5">
            {liste.slice(0, 3).map((e) => (
              <span key={e.id} className="flex min-w-0 gap-1.5 text-[14px]">
                <span className="tabular-nums text-[var(--text3)]">{e.zeit ?? '—'}</span>
                <span className="min-w-0 flex-1 truncate">{e.titel}</span>
              </span>
            ))}
            {liste.length > 3 ? <span className="mikro block">und {liste.length - 3} weitere</span> : null}
          </span>
        ) : (
          <span className="mikro">frei</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="flex gap-0.5" aria-hidden>
          {farben.slice(0, 3).map((f) => (
            <i key={f} className="block h-2 w-2 rounded-full" style={{ background: f }} />
          ))}
        </span>
        {liste.length ? <Chip className="!py-0.5 !text-[13px]">{liste.length}</Chip> : null}
      </span>
    </Link>
  );
}

function ReiseZeitleiste({ tripId }: { tripId: string }) {
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === tripId)!;
  const eintraege = store.eintraegeVon(tripId);
  const tage = reiseTage(reise);
  const [zeigen, setZeigen] = useState<string | null>(null);
  if (!tage.length) {
    return (
      <Karten>
        <div className="p-3 text-[14.5px] text-[var(--text2)]">
          Ohne Zeitraum keine Zeitleiste. <Link href={`/t/${tripId}/daten`} className="hover:underline">Zeitraum setzen</Link>
        </div>
      </Karten>
    );
  }
  return (
    <Karten className="overflow-hidden">
      <KartenKopf titel="Chronologie" untertitel={`${tage.length} Tage`} seitlich={<button type="button" className="chip !py-1.5" onClick={() => setZeigen(zeigen ? null : 'alle')}>{zeigen ? 'alle einklappen' : 'alle öffnen'}</button>} />
      <ul className="liste list-none m-0 p-0">
        {tage.map((d) => {
          const plan = tagesPlan(reise, eintraege, d);
          const offen = zeigen !== null;
          return (
            <li key={d} className="border-b last:border-0" style={{ borderColor: 'var(--rand)' }}>
              <div className="zeile !py-2">
                <Link href={`/t/${tripId}/tag/${d}`} className="zeitangabe !w-14 flex-col !leading-tight no-underline">
                  <span className="block text-[13px] font-semibold">{wochentagKurz(d)}</span>
                  <span className="mikro block">{tagKurz(d).split(' ')[1]}</span>
                </Link>
                <div className="text min-w-0">
                  <p className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                    <Link href={`/t/${tripId}/tag/${d}`} className="min-w-0 max-w-full truncate text-[15.5px] font-semibold no-underline hover:underline">
                      Tag {plan.nummer}
                      {plan.stadt ? ` · ${plan.stadt}` : ''}
                    </Link>
                    <span className="mikro">{plan.eintraege.length ? `${plan.eintraege.length} Punkte` : 'frei'}</span>
                  </p>
                  {offen && plan.eintraege.length ? (
                    <ul className="mt-1 space-y-0.5">
                      {plan.eintraege.map((e) => (
                        <li key={e.id} className="flex min-w-0 gap-1.5 text-[14px]">
                          <span className="tabular-nums text-[var(--text3)]">{e.zeit ?? '—'}</span>
                          <span className="min-w-0 flex-1 truncate">{e.titel}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {plan.bett ? <p className="mikro mt-0.5">🛏️ {plan.bett.titel}</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Karten>
  );
}
