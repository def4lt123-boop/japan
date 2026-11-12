'use client';

import { useEffect, useRef, useState } from 'react';
import { istKartenText, istKurzLink, punktAusKartenLink, punktAusLink, type Kartenpunkt } from '../lib/kartenlink';
import { punktAusText } from '../lib/orte';
import { gradText } from '../lib/format';
import { kartenLink } from '../lib/karten';
import { Chip, TextFeld } from './ui';

/**
 * Der punkt von hand, für den fall, dass die suche nichts findet: der link aus
 * Google Maps wird hereinkopiert und der punkt kommt daraus – der platz im pfad,
 * das @ in der kartenmitte, die zahlen in den klammern, die suche. Auch der kurze
 * link aus dem teilen-knopf wird gelesen; er trägt den punkt nicht selbst, der
 * wird nachgezogen. Zwei zahlen comma-getrennt gehen wie immer, und was sich nicht
 * lesen lässt, schreibt nichts.
 */

export function PunktFeld({
  lat,
  lng,
  beimSetzen,
  beimUebernehmen,
}: {
  lat: number | null;
  lng: number | null;
  beimSetzen: (werte: { lat: number | null; lng: number | null }) => void;
  beimUebernehmen: (punkt: Kartenpunkt) => void;
}) {
  const [text, setText] = useState('');
  const [vorschlag, setVorschlag] = useState<Kartenpunkt | null>(null);
  const [grund, setGrund] = useState<string | null>(null);
  const [lesen, setLesen] = useState(false);
  const fortlauft = useRef(0);

  /** ein verweis wird gelesen, zahlen schreibt das feld selbst */
  const link = istKartenText(text);

  useEffect(() => {
    const roh = text.trim();
    const zaehler = ++fortlauft.current;
    setVorschlag(null);
    setGrund(null);
    setLesen(false);
    if (!roh || !link) return;
    const direkt = punktAusKartenLink(roh);
    if (direkt) {
      setVorschlag(direkt);
      return;
    }
    if (!istKurzLink(roh)) {
      if (link) setGrund('In diesem Link steht kein Punkt – in Google Maps den Ort antippen und dann den Link aus der Adresszeile einfügen.');
      return;
    }
    setLesen(true);
    void punktAusLink(roh).then(({ punkt, grund: warum }) => {
      if (zaehler !== fortlauft.current) return;
      setLesen(false);
      if (punkt) {
        setVorschlag(punkt);
        return;
      }
      setGrund(
        warum === 'zu kurz'
          ? 'Der kurze Link ließ sich nicht auflösen – in Google Maps den Ort antippen und den Link aus der Adresszeile einfügen.'
          : 'Hinter dem kurzen Link steckt kein Punkt.'
      );
    });
  }, [text, link]);
  // ein verweis, der noch läuft, wird verworfen, sobald neue buchstaben kommen

  function eingeben(wert: string) {
    setText(wert);
    const roh = wert.trim();
    // ein link wird gelesen, nicht geschrieben –zahlen gehen sofort ins feld wie bisher
    if (/:\/\//u.test(roh) || /^geo:/iu.test(roh)) return;
    beimSetzen(punktAusText(roh));
  }

  function uebernehmen() {
    if (!vorschlag) return;
    beimUebernehmen(vorschlag);
    setText('');
    setVorschlag(null);
    setGrund(null);
  }

  const punkte = lat !== null && lng !== null;

  return (
    <div className="min-w-0">
      <TextFeld
        label="Punkt"
        wert={text}
        beimAendern={eingeben}
        platzhalter={punkte ? 'neuer Link oder neue Zahlen' : 'Link aus Google Maps – oder 35.0116, 135.7681'}
        autoVeroellstaendigen="off"
        eingabeModus="url"
        onTaste={(e) => {
          if (e.key === 'Enter' && vorschlag) {
            e.preventDefault();
            uebernehmen();
          }
        }}
        hinweis="Wenn die Suche den Ort nicht findet: den Link aus Google Maps hier einfügen, auch den kurzen aus dem Teilen-Knopf."
      />

      {lesen ? (
        <p className="mikro mt-1" role="status">
          kurzer Link – ich löse ihn auf …
        </p>
      ) : null}

      {vorschlag && !lesen ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Chip ton="gut">{[vorschlag.name, `${gradText(vorschlag.lat)}, ${gradText(vorschlag.lng)}`].filter(Boolean).join(' · ')}</Chip>
          <button type="button" className="knopf knopf-klein" onClick={uebernehmen}>
            Punkt übernehmen
          </button>
          <span className="mikro">{vorschlag.quelle}</span>
        </div>
      ) : null}

      {grund && !lesen && !vorschlag ? <p className="mikro mt-1">{grund}</p> : null}

      {punkte && !vorschlag && !lesen ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Chip>📍 {gradText(lat)}, {gradText(lng)}</Chip>
          <a href={kartenLink({ lat, lng })} target="_blank" rel="noreferrer" className="text-[13.5px]">
            auf Google Maps ansehen
          </a>
          <button
            type="button"
            className="knopf knopf-ghost knopf-klein"
            onClick={() => {
              beimSetzen({ lat: null, lng: null });
              setText('');
              setVorschlag(null);
              setGrund(null);
            }}
          >
            entfernen
          </button>
        </div>
      ) : null}
    </div>
  );
}
