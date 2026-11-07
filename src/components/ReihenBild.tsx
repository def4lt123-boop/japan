'use client';

import { useEffect, useState } from 'react';
import { ortsBild, ortsfrage, type Ortsbild } from '../lib/ortsbild';
import type { Eintrag, Reise } from '../lib/types';

/**
 * Das Bild des Ortes für eine Reihe. Steht eines am Eintrag, gilt das – sonst
 * wird eins gesucht und bleibt für die Reihe unter sich: geschrieben wird nur,
 * wenn jemand „Bild übernehmen" sagt.
 */
export function useOrtsbild(
  eintrag: Pick<Eintrag, 'titel' | 'ort' | 'adresse' | 'foto_url' | 'foto_nachweis'>,
  reise: Pick<Reise, 'stationen' | 'land'>,
  suchen: boolean
): Ortsbild | null {
  const [fund, setFund] = useState<Ortsbild | null>(null);
  const amEintrag = eintrag.foto_url ? { url: eintrag.foto_url, nachweis: eintrag.foto_nachweis ?? null, gefunden: false } : null;
  const frage = amEintrag ? '' : ortsfrage(eintrag.ort, eintrag.titel, eintrag.adresse, reise.stationen, reise.land);

  useEffect(() => {
    if (!suchen || eintrag.foto_url || frage.length < 3) return;
    let abbruch = false;
    void ortsBild(frage).then((bild) => {
      if (!abbruch) setFund(bild ? { ...bild, gefunden: true } : null);
    });
    return () => {
      abbruch = true;
    };
  }, [suchen, eintrag.foto_url, frage]);

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

/** Der Nachweis, den der Bilddienst verlangt – klein, aber sichtbar am Text. */
export function ReihenNachweis({ nachweis }: { nachweis: string | null }) {
  if (!nachweis) return null;
  return (
    <p className="mikro mt-0.5 flex flex-wrap items-center gap-x-1">
      <span aria-hidden>📷</span>
      <span>{nachweis}</span>
    </p>
  );
}
