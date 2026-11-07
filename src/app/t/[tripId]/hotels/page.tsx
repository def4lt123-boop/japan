'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '../../../../lib/daten';
import { tagKurz } from '../../../../lib/dates';
import { naechte, unterkuenfte } from '../../../../lib/plan';
import { geld, plural } from '../../../../lib/format';
import { kartenLink } from '../../../../lib/karten';
import { EintragZeile } from '../../../../components/EintragZeile';
import { EintragFormular } from '../../../../components/EintragFormular';
import { Chip, IconKnopf, Karten, KartenKopf, cx } from '../../../../components/ui';
import type { Eintrag } from '../../../../lib/types';

/** Unterkünfte: einmal eingetragen, gelten sie für jede Nacht dazwischen. */
export default function Hotels() {
  const params = useParams<{ tripId: string }>();
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === params.tripId);
  const [formular, setFormular] = useState<{ bestehend?: Eintrag | null } | null>(null);

  const eintraege = reise ? store.eintraegeVon(reise.id) : [];
  const betten = useMemo(() => unterkuenfte(eintraege), [eintraege]);
  const naechtlich = useMemo(() => (reise ? naechte(reise, eintraege) : []), [reise, eintraege]);

  if (!store.bereit || !reise) return null;

  const summe = betten.reduce((s, e) => s + (e.preis ?? 0), 0);
  const nächtiges = naechtlich.filter((n) => n.bett).length;

  return (
    <main className="pb-4">
      {naechtlich.length ? (
        <Karten className="mb-2.5 p-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">{plural(naechtlich.length, 'Nacht', 'Nächte')} der Reise</h2>
            <span className="mikro">{nächtiges === naechtlich.length ? 'jede Nacht hat ein Bett' : `${plural(naechtlich.length - nächtiges, 'Nacht', 'Nächte')} noch offen`}</span>
          </div>
          <div className="gelenk mt-2" aria-hidden>
            {naechtlich.map((n) => (
              <span
                key={n.datum}
                title={`${tagKurz(n.datum)} · ${n.bett ? n.bett.titel : 'kein Bett'}`}
                className="flex min-w-[54px] flex-col items-center gap-1 rounded-xl px-2 py-1.5"
                style={{ background: n.bett ? 'var(--akzent-fläche)' : 'var(--warnt-fläche)', border: `1px solid ${n.bett ? '#cfe6e2' : '#eed9b8'}` }}
              >
                <span className="mikro !text-[12px] font-semibold">{tagKurz(n.datum).split(' ')[0]}</span>
                <span className="text-[13.5px] font-semibold tabular-nums">{tagKurz(n.datum).split(' ')[1]}</span>
                <span aria-hidden className="text-[13px] leading-none" style={{ color: n.bett ? 'var(--akzent-text)' : 'var(--warnt)' }}>
                  {n.bett ? '🛏️' : '🌙'}
                </span>
              </span>
            ))}
          </div>
          <p className="mikro mt-2 flex flex-wrap items-center gap-1.5">
            {summe > 0 ? (
              <>
                <span>{geld(summe, reise.waehrung)} Betten gesamt</span>
                <span aria-hidden>·</span>
                <span>
                  {geld(summe / Math.max(1, nächtiges), reise.waehrung)} pro Nacht
                </span>
              </>
            ) : (
              <span>Preise fehlen noch – sie stehen an der Unterkunft.</span>
            )}
            {reise.budget ? (
              <Chip className="ml-auto" titel="Anteil am Budget">
                {Math.round((summe / reise.budget) * 100)} % vom Budget
              </Chip>
            ) : null}
          </p>
        </Karten>
      ) : null}

      {betten.length ? (
        <div className="space-y-2.5">
          {betten.map((e) => (
            <Karten key={e.id} className="overflow-hidden">
              <EintragZeile eintrag={e} reise={reise} bearbeiten={() => setFormular({ bestehend: e })} />
              <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2" style={{ borderColor: 'var(--rand)' }}>
                <span className="mikro">gilt ab {tagKurz(e.date ?? '')}</span>
                {e.bis_date ? <span className="mikro">bis {tagKurz(e.bis_date)}</span> : <Chip ton="warnt" titel="ohne Check-out gilt die Unterkunft nur für eine Nacht">eine Nacht</Chip>}
                <a href={kartenLink(e)} target="_blank" rel="noreferrer" className="chip ml-auto !py-1.5 no-underline">
                  🗺️ Karte
                </a>
                {e.buchung_url ? (
                  <a href={e.buchung_url} target="_blank" rel="noreferrer" className="chip !py-1.5 no-underline">
                    🔗 Buchung
                  </a>
                ) : null}
              </div>
            </Karten>
          ))}
        </div>
      ) : (
        <Karten>
          <div className="flex flex-wrap items-center gap-2 p-3">
            <p className="min-w-0 flex-1 text-[14.5px] leading-snug text-[var(--text2)]">
              Noch keine Unterkunft. Einmal mit Check-in und Check-out eingetragen, erscheint sie an jeder Nacht automatisch im Kalender.
            </p>
            <button type="button" className="knopf knopf-klein" onClick={() => setFormular({})}>
              + Unterkunft
            </button>
          </div>
        </Karten>
      )}

      {reisenLink(reise.id)}

      {formular ? <EintragFormular reise={reise} art="unterkunft" bestehend={formular.bestehend} offen schliessen={() => setFormular(null)} /> : null}
    </main>
  );
}

function reisenLink(tripId: string) {
  return (
    <p className="mikro mt-2.5">
      <Link href={`/t/${tripId}/kalender`} className="hover:underline">
        Nächte im Kalender sehen
      </Link>
    </p>
  );
}
