'use client';

import { useEffect, useState } from 'react';
import { bildFragen, ortsBild, type Ortsbild } from '../lib/ortsbild';
import type { Eintrag, Reise } from '../lib/types';

/**
 * Das Bild des Ortes für eine Reihe – automatisch, nicht erst nach einem
 * Knopfdruck. Steht eines am Eintrag, gilt das; sonst werden die Fragen der
 * Staffel nacheinander gestellt (name, name und stadt, die stadt allein), bis
 * eine ein Bild bringt. Behalten wird es erst, wenn jemand „Bild übernehmen"
 * sagt – die Reihe darf suchen, der Eintrag entscheidet.
 */
export function useOrtsbild(
  eintrag: Pick<Eintrag, 'titel' | 'ort' | 'adresse' | 'foto_url' | 'foto_nachweis'>,
  reise: Pick<Reise, 'stationen' | 'land'>,
  suchen: boolean
): Ortsbild | null {
  const [fund, setFund] = useState<Ortsbild | null>(null);
  const amEintrag = eintrag.foto_url ? { url: eintrag.foto_url, nachweis: eintrag.foto_nachweis ?? null, gefunden: false } : null;
  const fragen = amEintrag ? [] : bildFragen(eintrag, reise);
  const schlüssel = fragen.join(' | ');

  useEffect(() => {
    if (!suchen || eintrag.foto_url || !fragen.length) return;
    let abbruch = false;
    void (async () => {
      for (const frage of fragen) {
        const bild = await ortsBild(frage);
        if (abbruch) return;
        if (bild) {
          setFund({ ...bild, gefunden: true });
          return;
        }
      }
      setFund(null);
    })();
    return () => {
      abbruch = true;
    };
  }, [suchen, eintrag.foto_url, schlüssel]);

  return amEintrag ?? fund;
}

/** Die Bildebene hinter dem Text. Rein schmückend, daher ohne alt – der Name steht in der Zeile. */
export function ReihenBild({ url }: { url: string }) {
  const [kaputt, setKaputt] = useState(false);
  if (kaputt) return null;
  return (
    <span className="zeile-bild" aria-hidden="true">
      <img src={url} alt="" loading="lazy" decoding="async" onError={() => setKaputt(true)} />
    </span>
  );
}
