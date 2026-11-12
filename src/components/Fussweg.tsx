'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Punkt } from '../lib/karten';
import { routeBekannt, routeZwischen } from '../lib/routen';
import { gebremst, takt } from '../lib/suchtakt';
import { FUSS, wegSchaetzen, type Fussweg } from '../lib/weg';

/**
 * Die schritte zwischen punkten, für blätter, die minuten zeigen wollen, bevor sie
 * einen tag wählen. Ein paar wird einmal gefragt und dann gemerkt; was der
 * wegdienst nicht beantwortet, bleibt die überschlagene luftlinie – mit ≈ davor,
 * damit niemand eine gerechnete zahl darin sieht.
 *
 * Die anfragen laufen einzeln und mit pause nacheinander durch: zwanzig zeilen
 * sind zwanzig fragen, und die mögen die offenen dienste nicht auf einmal.
 */

export interface FusswegPaar {
  /** worunter das ergebnis steht */
  id: string;
  von: Punkt | null;
  nach: Punkt | null;
}

/** was in diesem blatt schon gefragt wurde – ein zweiter besuch fragt nicht noch einmal */
const gefragt = new Set<string>();

export function paarSchluessel(paar: FusswegPaar): string {
  if (!paar.von || !paar.nach) return '';
  return `${String(paar.von.lat)},${String(paar.von.lng)}>${String(paar.nach.lat)},${String(paar.nach.lng)}`;
}

const warten = (zeit: number) => new Promise((loser) => setTimeout(loser, zeit));

export function useFussWege(paare: FusswegPaar[], modus = FUSS): Record<string, Fussweg | null> {
  const liste = useMemo(() => paare.filter((p) => p.von && p.nach), [paare]);
  const [gerechnet, setGerechnet] = useState<Record<string, Fussweg | null>>({});
  const anspruch = useMemo(() => liste.map((p) => `${p.id}:${paarSchluessel(p)}`).join('|'), [liste]);

  useEffect(() => {
    let abbruch = false;
    let kette = Promise.resolve();
    for (const paar of liste) {
      const fertig = routeBekannt(paar.von as Punkt, paar.nach as Punkt, modus);
      if (fertig) {
        setGerechnet((vorher) => (vorher[paar.id] === fertig ? vorher : { ...vorher, [paar.id]: fertig }));
        continue;
      }
      const schlussel = paarSchluessel(paar);
      if (!schlussel || gerechnet[paar.id] !== undefined || gefragt.has(schlussel) || gebremst()) continue;
      if (gefragt.size > 400) gefragt.clear(); // ein blatt, das tagelang off bleibt, sammelt nicht endlos
      gefragt.add(schlussel);
      kette = kette.then(async () => {
        await warten(takt());
        if (abbruch) return;
        const fund = await routeZwischen(paar.von as Punkt, paar.nach as Punkt, modus).catch(() => null);
        // die schätzung ist keine antwort des dienstes – nur ein fund ersetzt sie
        if (abbruch || !fund) return;
        if (fund.quelle !== 'gerechnet') return;
        setGerechnet((vorher) => (vorher[paar.id] ? vorher : { ...vorher, [paar.id]: fund }));
      });
    }
    return () => {
      abbruch = true;
    };
    // der anspruch hält die paaare, nicht ihr objekt – sonst finge die kette von vorn an
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anspruch, modus]);

  return useMemo(() => {
    const ergebnis: Record<string, Fussweg | null> = {};
    for (const paar of liste) ergebnis[paar.id] = gerechnet[paar.id] ?? wegSchaetzen(paar.von, paar.nach, modus);
    for (const paar of paare) if (!(paar.id in ergebnis)) ergebnis[paar.id] = null;
    return ergebnis;
  }, [liste, paare, gerechnet, modus]);
}
