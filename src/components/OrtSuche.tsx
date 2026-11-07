'use client';

import { useEffect, useRef, useState } from 'react';
import type { Ortsvorschlag } from '../lib/types';
import { TextFeld, cx } from './ui';

/**
 * Tippen statt Klicken: ein Suchfeld, das Vorschläge zeigt, und ein Treffer
 * nimmt Punkt und Name together mit – das Formular braucht danach kaum mehr.
 */

export interface Gewaehlt {
  titel: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  stichwort: string | null;
  quelle: string;
}

export function OrtSuche({
  wert,
  beimAendern,
  beiAuswahl,
  platzhalter = 'Name, Adresse oder „Museum in …“',
  fehler,
  hinweis,
  konzentriert,
}: {
  wert: string;
  beimAendern: (text: string) => void;
  beiAuswahl: (vorschlag: Gewaehlt) => void;
  platzhalter?: string;
  fehler?: string;
  hinweis?: React.ReactNode;
  konzentriert?: { lat: number; lng: number } | null;
}) {
  const [vorschlaege, setVorschlaege] = useState<Ortsvorschlag[]>([]);
  const [sucht, setSucht] = useState(false);
  const [leer, setLeer] = useState(false);
  const [offen, setOffen] = useState(false);
  const zaehler = useRef(0);

  useEffect(() => {
    const text = wert.trim();
    setOffen(text.trim().length >= 3);
    if (text.length < 3) {
      setVorschlaege([]);
      setLeer(false);
      setSucht(false);
      return;
    }
    setSucht(true);
    const lauf = ++zaehler.current;
    const zeit = window.setTimeout(async () => {
      try {
        const url = new URL('/api/orte', window.location.origin);
        url.searchParams.set('q', text);
        if (konzentriert) {
          url.searchParams.set('nahe', `${konzentriert.lat},${konzentriert.lng}`);
        }
        const antwort = await fetch(url.toString());
        const daten = (await antwort.json()) as { orte?: Ortsvorschlag[] };
        if (lauf !== zaehler.current) return;
        const liste = daten.orte ?? [];
        setVorschlaege(liste);
        setLeer(liste.length === 0);
      } catch {
        if (lauf === zaehler.current) setLeer(true);
      } finally {
        if (lauf === zaehler.current) setSucht(false);
      }
    }, 420);
    return () => window.clearTimeout(zeit);
  }, [wert, konzentriert]);

  const annehmen = (v: Ortsvorschlag) => {
    beimAendern(v.name);
    setOffen(false);
    setVorschlaege([]);
    beiAuswahl({ titel: v.name, adresse: v.adresse, lat: v.lat, lng: v.lng, stichwort: v.stichwort, quelle: v.quelle === 'google' ? 'Google' : 'OpenStreetMap' });
  };

  return (
    <div className="feld min-w-0">
      <TextFeld label="Was?" wert={wert} beimAendern={beimAendern} platzhalter={platzhalter} fehler={fehler} autoVeroellstaendigen="off" />
      {offen ? (
        <div className="mt-1.5">
          {sucht ? <p className="mikro">suche Orte …</p> : null}
          {!sucht && leer ? (
            <p className="mikro">
              Kein Ort gefunden – der Name bleibt trotzdem stehen. {hinweis ?? 'Auch ohne Punkt lässt sich planen, die Karte sucht beim Öffnen.'}
            </p>
          ) : null}
          {!sucht && vorschlaege.length ? (
            <ul className="liste list-none m-0 max-h-[13rem] overflow-y-auto rounded-xl border p-1" style={{ borderColor: 'var(--rand)' }}>
              {vorschlaege.map((v, i) => (
                <li key={`${v.lat}-${v.lng}-${i}`}>
                  <button
                    type="button"
                    onClick={() => annehmen(v)}
                    className={cx('flex min-h-11 w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--akzent-fläche)]')}
                  >
                    <span aria-hidden className="mt-0.5 shrink-0 text-[15px]">
                      📍
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-medium">{v.name}</span>
                      <span className="mikro block truncate">{v.adresse ?? ''}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
