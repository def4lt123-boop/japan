'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { kacheln } from '../lib/kacheln';
import { nadelHtml } from '../lib/karten';

/**
 * Die Karte der Reise: Nadeln in Kategoriefarbe mit der Zahl des Halts darin,
 * die Betten ohne Zahl darunter. Antippen öffnet das Blatt mit Bild, Zeit und
 * dem Weg nach Google Maps. Die Kacheln kommen von einem offenen Dienst –
 * fällt einer aus, rückt der nächste nach.
 */

export interface KartenPunkt {
  id: string;
  /** Stelle auf der Route – ein Bett steht außer der Reihe und hat keine */
  nr: number | null;
  lat: number;
  lng: number;
  titel: string;
  farbe: string;
  /** das Zeichen der Kategorie, beim Bett das Bett selbst */
  zeichen: string;
  /** kurzer Namen der Art – die Legende darunter */
  marke: string;
  untertitel?: string | null;
  foto?: string | null;
  nachweis?: string | null;
  href: string;
  karten?: string;
}

function nadel(p: KartenPunkt) {
  return L.divIcon({
    className: 'kartennadel',
    html: nadelHtml(p),
    // die fläche ist eine fingerbreite, der körper darin 30px groß und oben
    // links verankert: die spitze trifft den punkt, das blatt öffnet über ihr
    iconSize: [44, 44],
    iconAnchor: [15, 34],
    popupAnchor: [0, -42],
  });
}

function Einpassen({ punkte }: { punkte: KartenPunkt[] }) {
  const karte = useMap();
  const schluessel = useMemo(() => punkte.map((p) => p.id).join('|'), [punkte]);
  useEffect(() => {
    if (!punkte.length) return;
    if (punkte.length === 1) {
      karte.setView([punkte[0]!.lat, punkte[0]!.lng], 14, { animate: true });
      return;
    }
    const ecken = punkte.map((p) => [p.lat, p.lng] as [number, number]);
    karte.fitBounds(L.latLngBounds(ecken), { paddingTopLeft: [30, 40], paddingBottomRight: [30, 40], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel, karte]);
  return null;
}

export function KartenAnsicht({
  punkte,
  strecke,
  klasse,
}: {
  punkte: KartenPunkt[];
  strecke?: [number, number][] | null;
  klasse?: string;
}) {
  const quellen = useMemo(() => kacheln(), []);
  const [versuch, setVersuch] = useState(0);
  const fehler = useRef(0);
  const quelle = quellen[Math.min(versuch, quellen.length - 1)]!;
  const mittelpunkt = useMemo<[number, number]>(() => {
    if (!punkte.length) {
      const teile = (punkte[0]?.lat ?? 0) === 0 ? [48.2082, 16.3738] : [0, 0];
      return teile as [number, number];
    }
    const lat = punkte.reduce((s, p) => s + p.lat, 0) / punkte.length;
    const lng = punkte.reduce((s, p) => s + p.lng, 0) / punkte.length;
    return [lat, lng];
  }, [punkte]);

  return (
    <div className={klasse}>
      <MapContainer center={mittelpunkt} zoom={12} scrollWheelZoom={false} className="h-full w-full" style={{ background: '#e9eef4' }} attributionControl>
        <TileLayer
          key={quelle.id}
          url={quelle.url}
          attribution={quelle.nachweis}
          maxZoom={quelle.maxZoom}
          eventHandlers={{
            tileerror: () => {
              // eine einzelne fehlende Kachel ist noch kein Ausfall – drei schon
              fehler.current += 1;
              if (fehler.current < 3) return;
              fehler.current = 0;
              setVersuch((v) => (v + 1 < quellen.length ? v + 1 : v));
            },
          }}
        />
        {strecke && strecke.length > 1 ? <Polyline positions={strecke} pathOptions={{ color: '#0f766e', weight: 4, opacity: 0.75 }} /> : null}
        {punkte.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={nadel(p)}>
            <Popup>
              <div className="min-w-[10rem] max-w-[15rem]">
                {p.foto ? <img src={p.foto} alt="" className="mb-1.5 h-20 w-full rounded-lg object-cover" loading="lazy" /> : null}
                <p className="flex items-start gap-1.5 text-[14px] font-semibold leading-snug">
                  <span aria-hidden>{p.zeichen}</span>
                  <span className="min-w-0">{p.titel}</span>
                </p>
                <p className="mikro">{p.nr === null ? `${p.marke} · ohne Nummer` : `Halt ${p.nr} der Route`}</p>
                {p.untertitel ? <p className="mikro">{p.untertitel}</p> : null}
                <p className="mt-1.5 flex flex-wrap gap-2 text-[13.5px]">
                  <a href={p.href}>in der Reise</a>
                  {p.karten ? (
                    <a href={p.karten} target="_blank" rel="noreferrer">
                      Google Maps ↗
                    </a>
                  ) : null}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        <Einpassen punkte={punkte} />
      </MapContainer>
    </div>
  );
}
