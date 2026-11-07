'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore } from '../../../../../lib/daten';
import { gilt, tagLang, tagNackt } from '../../../../../lib/dates';
import { chronologisch, eintragVersetzen, reiseTage, tagesPlan } from '../../../../../lib/plan';
import { MODI } from '../../../../../lib/karten';
import { routeZwischen, type RoutenInfo } from '../../../../../lib/routen';
import { wieVorher } from '../../../../../lib/format';
import type { Eintrag, EintragArt } from '../../../../../lib/types';
import { TagesLeiste } from '../../../../../components/Kalender';
import { EintragZeile } from '../../../../../components/EintragZeile';
import { EintragFormular } from '../../../../../components/EintragFormular';
import { Ablage, Karten, cx } from '../../../../../components/ui';
import { BettZeile } from '../../../../../components/BettZeile';

/** Der Reisetag: Zeitangaben links, Bild und Name daneben, Weg zum nächsten Punkt darunter. */
export default function Reisetag() {
  const params = useParams<{ tripId: string; datum: string }>();
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === params.tripId);
  const datum = decodeURIComponent(params.datum ?? '');
  const [formular, setFormular] = useState<{ art: EintragArt; bestehend?: Eintrag | null } | null>(null);
  const [neues, setNeues] = useState(false);
  const [modus, setModus] = useState<string>('zu fuss');
  const [routen, setRouten] = useState<Record<string, RoutenInfo | null>>({});

  const eintraege = reise ? store.eintraegeVon(reise.id) : [];
  const plan = useMemo(() => (reise ? tagesPlan(reise, eintraege, datum) : null), [reise, eintraege, datum]);

  const paare = useMemo(() => {
    const liste = plan?.eintraege ?? [];
    const out: { schluessel: string; von: Eintrag; nach: Eintrag }[] = [];
    for (let i = 0; i + 1 < liste.length; i += 1) {
      const von = liste[i]!;
      const nach = liste[i + 1]!;
      if (von.lat === null || nach.lat === null) continue;
      out.push({ schluessel: `${von.id}>${nach.id}`, von, nach });
    }
    return out;
  }, [plan]);

  useEffect(() => {
    let abbruch = false;
    if (!paare.length) {
      setRouten((vorher) => wieVorher(vorher, {}));
      return;
    }
    void (async () => {
      const ergebnis: Record<string, RoutenInfo | null> = {};
      for (const paar of paare) {
        ergebnis[paar.schluessel] = await routeZwischen(paar.von, paar.nach, modus);
      }
      if (!abbruch) setRouten((vorher) => wieVorher(vorher, ergebnis));
    })();
    return () => {
      abbruch = true;
    };
  }, [paare, modus]);

  if (!store.bereit) return null;
  if (!reise) {
    return (
      <main className="seite">
        <Karten className="p-4">
          <p className="text-[15px]">Diese Reise gibt es hier nicht. <Link href="/reisen">Zu meinen Reisen</Link></p>
        </Karten>
      </main>
    );
  }

  const versetzen = async (id: string, richtung: -1 | 1) => {
    const liste = [...(plan?.eintraege ?? [])].sort(chronologisch);
    const index = liste.findIndex((e) => e.id === id);
    const patches = eintragVersetzen(liste, id, index + richtung);
    await store.eintraegeRueckwaerts(patches.map((p) => ({ id: p.id, patch: { sortierung: p.sortierung } })));
  };

  const liste = plan?.eintraege ?? [];
  const nummer = plan?.nummer ?? 0;
  const stadt = plan?.stadt;
  const bett = plan?.bett;

  return (
    <main className="pb-4">
      <TagesLeiste reise={reise} eintraege={eintraege} aktuell={datum} />

      <div className="seite">
        <header className="pt-1">
          <p className="mikro font-semibold uppercase tracking-wide" style={{ color: 'var(--akzent-text)' }}>
            {nummer ? `Reisetag ${nummer}` : 'Tag'}
          </p>
          <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <h1 className="min-w-0 text-balance">{gilt(datum) ? tagLang(datum) : 'Ohne Tag'}</h1>
            {stadt ? (
              <span className="chip !py-1">
                <span aria-hidden>📍</span>
                {stadt}
              </span>
            ) : null}
          </div>
          {liste.length ? (
            <p className="mikro mt-1">
              {liste.length} {liste.length === 1 ? 'Punkt' : 'Punkte'}
              {plan && plan.minuten ? ` · ${Math.round(plan.minuten / 60)} h verplant` : ''}
            </p>
          ) : null}
        </header>

        {paare.length ? (
          <div className="gelenk mt-2.5" role="group" aria-label="Fortbewegung">
            {MODI.map((m) => (
              <button key={m.id} type="button" onClick={() => setModus(m.id)} className={cx('chip !py-1.5 !text-[13px] no-underline', modus === m.id && 'chip-aktiv')} style={{ borderColor: 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}>
                <span aria-hidden>{m.icon}</span> {m.label}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-2">
          {liste.length ? (
            <ul className="liste list-none m-0 p-0">
              {liste.map((e, i) => (
                <li key={e.id} className="karte overflow-hidden">
                  <EintragZeile
                    eintrag={e}
                    reise={reise}
                    oben={i > 0 ? () => void versetzen(e.id, -1) : undefined}
                    unten={i < liste.length - 1 ? () => void versetzen(e.id, 1) : undefined}
                    verbinden={routen[`${e.id}>${liste[i + 1]?.id}`] ?? null}
                    bearbeiten={() => setFormular({ art: e.art, bestehend: e })}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <Karten>
              <div className="flex flex-wrap items-center gap-2 p-3">
                <p className="min-w-0 flex-1 text-[14.5px] leading-snug text-[var(--text2)]">Dieser Tag ist noch leer. Ein Ort genügt – Uhrzeit und Bild kannst du später nachtragen.</p>
                <button type="button" className="knopf knopf-klein" onClick={() => setNeues(true)}>
                  + Punkt hinzufügen
                </button>
              </div>
            </Karten>
          )}

          <div className="mt-2.5">
            {bett ? <BettZeile eintrag={bett} reise={reise} bearbeiten={() => setFormular({ art: 'unterkunft', bestehend: bett })} /> : (
              <button type="button" onClick={() => setFormular({ art: 'unterkunft' })} className="karte flex w-full items-center gap-2 p-3 text-left" style={{ borderStyle: 'dashed', borderColor: '#e5c98a', background: 'var(--warnt-fläche)' }}>
                <span aria-hidden>🌙</span>
                <span className="min-w-0 flex-1 text-[14px]" style={{ color: 'var(--warnt)' }}>
                  Keine Unterkunft für die Nacht nach {gilt(datum) ? tagNackt(datum) : 'diesem Tag'}
                </span>
                <span className="chip !py-1" style={{ background: 'var(--karte)' }}>
                  eintragen
                </span>
              </button>
            )}
          </div>

          {liste.length ? (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <button type="button" className="knopf knopf-ghost knopf-klein" onClick={() => setNeues(true)}>
                + Punkt
              </button>
              <Link href={`/t/${reise.id}/liste`} className="knopf knopf-ghost knopf-klein no-underline">
                alle Aktivitäten
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <button type="button" className="fab md:hidden" onClick={() => setNeues(true)}>
        <span aria-hidden className="text-[19px] leading-none">+</span> Punkt
      </button>

      <Ablage offen={neues} titel="Was an diesen Tag?" schliessen={() => setNeues(false)}>
        <div className="grid grid-cols-1 gap-2 py-3 sm:grid-cols-3">
          {(
            [
              { art: 'aktivitaet', zeichen: '📍', label: 'Aktivität', text: 'Ort, Museum, Essen, Spaziergang' },
              { art: 'unterkunft', zeichen: '🛏️', label: 'Unterkunft', text: 'Hotel für mehrere Nächte' },
              { art: 'fahrt', zeichen: '🧳', label: 'Fahrt', text: 'Zug, Flug, Bus, Mietwagen' },
            ] as { art: EintragArt; zeichen: string; label: string; text: string }[]
          ).map((v) => (
            <button
              key={v.art}
              type="button"
              data-erstes=""
              className="flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left hover:bg-[var(--akzent-fläche)]"
              style={{ borderColor: 'var(--rand)' }}
              onClick={() => {
                setNeues(false);
                setFormular({ art: v.art });
              }}
            >
              <span aria-hidden className="text-[22px]">
                {v.zeichen}
              </span>
              <span className="min-w-0">
                <span className="block text-[15.5px] font-semibold">{v.label}</span>
                <span className="mikro block">{v.text}</span>
              </span>
            </button>
          ))}
        </div>
      </Ablage>

      {formular ? (
        <EintragFormular
          reise={reise}
          art={formular.art}
          bestehend={formular.bestehend}
          datum={gilt(datum) ? datum : reiseTage(reise)[0] ?? null}
          offen
          schliessen={() => setFormular(null)}
        />
      ) : null}
    </main>
  );
}
