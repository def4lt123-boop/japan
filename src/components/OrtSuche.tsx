'use client';

import { useEffect, useRef, useState } from 'react';
import { entfernungKm, schaetzungKm } from '../lib/karten';
import { minutenAus } from '../lib/weg';
import { gradText } from '../lib/format';
import { istKartenText, punktAusKartenLink } from '../lib/kartenlink';
import { quellenName, vergleichText } from '../lib/orte';
import type { Ortsvorschlag } from '../lib/types';
import { TextFeld, cx } from './ui';

/**
 * Tippen statt Klicken: ein Suchfeld, das Vorschläge zeigt, und ein Treffer nimmt
 * Punkt und Name zusammen mit – das Formular braucht danach kaum mehr. Kurz und
 * umgangssprachlich ist erwünscht („big ben“), deshalb antwortet zuerst, was der
 * Rechner schon weiß, und die Suche läuft ruhig daneben mit.
 *
 * Wer einen Google-Maps-link hier hineinklebt, sucht keinen namen: der link wird
 * nicht befragt, sondern als punkt angeboten – über das feld „Punkt“, wenn die
 * suche sonst nichts findet.
 */

export interface Gewaehlt {
  titel: string;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  stichwort: string | null;
  quelle: string;
}

const ZULETZT_SCHLUESSEL = 'reiseplan.orte.zuletzt.v1';
const ZULETZT_MAX = 10;
const AB_KUERZE = 2;

/**
 * Treffer aus diesem Seitenbesuch, gemerkt nach der reinen frage. Wer weitertippt
 * oder dieselbe stadt ein zweites mal öffnet, bekommt sie sofort – ohne warten.
 */
const sitzung = new Map<string, Ortsvorschlag[]>();

const QUELLEN = ['google', 'openstreetmap', 'photon'];

/** ein ort, wie er auf dem gerät liegt – nur das brauchbarematerial kommt hinein */
function istOrt(d: unknown): d is Ortsvorschlag {
  const t = d as Partial<Ortsvorschlag> | null;
  return !!t && typeof t.name === 'string' && QUELLEN.includes(t.quelle ?? '') && Number.isFinite(t.lat) && Number.isFinite(t.lng);
}

function liesZuletzt(): Ortsvorschlag[] {
  if (typeof window === 'undefined') return [];
  try {
    const roh = JSON.parse(window.localStorage.getItem(ZULETZT_SCHLUESSEL) ?? '[]') as unknown;
    return Array.isArray(roh) ? roh.filter(istOrt) : [];
  } catch {
    return [];
  }
}

function merkeZuletzt(ort: Ortsvorschlag) {
  if (typeof window === 'undefined') return;
  const alte = liesZuletzt().filter((d) => d.name !== ort.name || d.lat !== ort.lat);
  try {
    window.localStorage.setItem(ZULETZT_SCHLUESSEL, JSON.stringify([ort, ...alte].slice(0, ZULETZT_MAX)));
  } catch {
    /* voller speicher: die liste ist nur ein luxus, kein benötigter dienst */
  }
}

/** jedes wort der frage muss irgendwo in der zeile stehen – kleinbuchstaben inklusive */
function passtZu(t: Ortsvorschlag, anfrage: string): boolean {
  const zeile = vergleichText(`${t.name} ${t.adresse ?? ''} ${t.stichwort ?? ''}`);
  return anfrage.split(' ').every((wort) => wort.length === 0 || zeile.includes(wort));
}

/**
 * Ein hereingklebter karten-link: keine frage an die suche, sondern ein punkt, der
 * geholt werden kann. was im link schon steht, wird gezeigt – der kurze link aus
 * dem teilen-knopf trägt nichts, der wird beim holen aufgelöst.
 */
function KartenLink({ zeile, beimUebernehmen }: { zeile: string; beimUebernehmen: () => void }) {
  const fund = punktAusKartenLink(zeile);
  return (
    <div className="mb-1 rounded-xl border p-2" style={{ borderColor: 'var(--rand)' }}>
      <p className="mikro">Das ist ein Link aus Google Maps, kein Name, den ich suchen kann.</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <button type="button" className="knopf knopf-klein" onClick={beimUebernehmen}>
          {fund ? 'Punkt aus dem Link holen' : 'Link auflösen und Punkt holen'}
        </button>
        {fund ? (
          <span className="mikro min-w-0 truncate">
            {[fund.name, `${gradText(fund.lat)}, ${gradText(fund.lng)}`].filter(Boolean).join(' · ')}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function ausDemVorrat(anfrage: string, listen: Iterable<Ortsvorschlag[]>): Ortsvorschlag[] {
  const gefunde = new Map<string, Ortsvorschlag>();
  for (const liste of listen) {
    for (const t of liste) {
      if (!passtZu(t, anfrage)) continue;
      const kern = `${t.lat.toFixed(3)},${t.lng.toFixed(3)}`;
      if (!gefunde.has(kern)) gefunde.set(kern, t);
    }
  }
  return [...gefunde.values()].slice(0, 8);
}

export function OrtSuche({
  wert,
  beimAendern,
  beiAuswahl,
  beimKartenLink,
  platzhalter = 'auch kurz: „big ben“ oder „museum in siena“',
  fehler,
  hinweis,
  konzentriert,
}: {
  wert: string;
  beimAendern: (text: string) => void;
  beiAuswahl: (vorschlag: Gewaehlt) => void;
  /** ein link, der hereinkopiert wurde – der punkt kommt daraus, nicht aus der suche */
  beimKartenLink?: (link: string) => void;
  platzhalter?: string;
  fehler?: string;
  hinweis?: React.ReactNode;
  konzentriert?: { lat: number; lng: number } | null;
}) {
  const [vorschlaege, setVorschlaege] = useState<Ortsvorschlag[]>([]);
  const [sucht, setSucht] = useState(false);
  const [leer, setLeer] = useState(false);
  const [offen, setOffen] = useState(false);
  const [zuletzt, setZuletzt] = useState<Ortsvorschlag[]>([]);
  const [beruehrt, setBeruehrt] = useState(false);
  const [verweis, setVerweis] = useState<string | null>(null);
  const abbruch = useRef<AbortController | null>(null);

  useEffect(() => setZuletzt(liesZuletzt()), []);

  // der mittelpunkt als zeile: ein neues objekt pro render soll keine suche neu starten
  const anker = konzentriert ? `${konzentriert.lat},${konzentriert.lng}` : '';

  const kartenlink = istKartenText(wert) ? wert.trim() : null;

  useEffect(() => {
    const text = wert.trim();
    const anfrage = vergleichText(text);
    abbruch.current?.abort();
    abbruch.current = null;
    setVerweis(kartenlink);
    if (kartenlink) {
      // ein verweis ist keine frage – die suche bleibt zu, der link wird angeboten
      setVorschlaege([]);
      setSucht(false);
      setLeer(false);
      setOffen(true);
      return;
    }
    if (anfrage.length < AB_KUERZE) {
      setVorschlaege([]);
      setSucht(false);
      setLeer(false);
      setOffen(zuletzt.length > 0);
      return;
    }
    setOffen(true);
    const gemerkt = sitzung.get(anfrage);
    if (gemerkt) {
      setVorschlaege(gemerkt);
      setLeer(gemerkt.length === 0);
      setSucht(false);
      return;
    }
    const vorrat = ausDemVorrat(anfrage, sitzung.values());
    setVorschlaege(vorrat);
    setLeer(false);
    setSucht(true);
    const lauf = new AbortController();
    abbruch.current = lauf;
    const zeit = window.setTimeout(
      () => {
        const url = new URL('/api/orte', window.location.origin);
        url.searchParams.set('q', text);
        if (anker) url.searchParams.set('nahe', anker);
        void fetch(url.toString(), { signal: lauf.signal })
          .then((antwort) => (antwort.ok ? (antwort.json() as Promise<{ orte?: Ortsvorschlag[] }>) : { orte: [] }))
          .then((daten) => {
            const liste = daten.orte ?? [];
            // ein „nichts“ wird nicht gemerkt: die nächste frage darf es noch einmal versuchen
            if (liste.length) sitzung.set(anfrage, liste);
            setVorschlaege(liste.length ? liste : vorrat);
            setLeer(liste.length === 0 && vorrat.length === 0);
            setSucht(false);
          })
          .catch(() => {
            if (abbruch.current !== lauf) return;
            setSucht(false);
            if (!vorrat.length) setLeer(true);
          });
      },
      // wer schon treffer auf dem schirm hat, wird nicht bei jedem buchstaben gestört
      vorrat.length ? 420 : 170,
    );
    return () => window.clearTimeout(zeit);
  }, [wert, anker, zuletzt.length, kartenlink]);

  const annehmen = (v: Ortsvorschlag) => {
    setBeruehrt(false);
    beimAendern(v.name);
    setOffen(false);
    setVorschlaege([]);
    setLeer(false);
    beiAuswahl({ titel: v.name, adresse: v.adresse, lat: v.lat, lng: v.lng, stichwort: v.stichwort, quelle: quellenName(v.quelle) });
    merkeZuletzt(v);
    setZuletzt(liesZuletzt());
  };

  // die Vorschläge zeigen sich beim Tippen – wer das Feld nur öffnet, sieht sie noch nicht
  const tippen = (text: string) => {
    setBeruehrt(true);
    beimAendern(text);
  };

  const aufTaste = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return;
    if (verweis) {
      e.preventDefault();
      beimKartenLink?.(verweis);
      return;
    }
    if (!vorschlaege.length) return;
    e.preventDefault();
    annehmen(vorschlaege[0]!);
  };

  const zeilen = vorschlaege;

  return (
    <div className="feld min-w-0">
      <TextFeld
        label="Was?"
        wert={wert}
        beimAendern={tippen}
        platzhalter={platzhalter}
        fehler={fehler}
        autoVeroellstaendigen="off"
        hinweis={hinweis}
        onTaste={aufTaste}
      />
      {offen && (beruehrt || !wert.trim()) ? (
        <div className="mt-1.5">
          {verweis ? <KartenLink zeile={verweis} beimUebernehmen={() => beimKartenLink?.(verweis)} /> : null}
          {sucht && !verweis ? <p className="mikro">{zeilen.length ? 'ich sehe noch genauer nach …' : 'suche Orte …'}</p> : null}
          {!sucht && !verweis && leer ? (
            <p className="mikro">
              Kein Ort gefunden –{' '}
              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(wert.trim())}`} target="_blank" rel="noreferrer" className="font-medium">
                in Google Maps ansehen
              </a>{' '}
              und den Link daraus beim Punkt einfügen. Der Name bleibt hier trotzdem stehen.
            </p>
          ) : null}
          {!sucht && !verweis && !zeilen.length && zuletzt.length ? (
            <>
              <p className="mikro mb-0.5">zuletzt verwendet</p>
              <ul className="liste list-none m-0 flex flex-wrap gap-1.5 p-0">
                {zuletzt.slice(0, 6).map((v, i) => (
                  <li key={`${v.lat}-${v.lng}-${i}`}>
                    <button
                      type="button"
                      onClick={() => annehmen(v)}
                      className="chip min-h-11 px-3 py-2 text-[13.5px]"
                      style={{ borderColor: 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
                    >
                      {v.name}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {zeilen.length ? (
            <ul className="liste list-none m-0 max-h-[13rem] overflow-y-auto rounded-xl border p-1" style={{ borderColor: 'var(--rand)' }}>
              {zeilen.map((v, i) => {
                const anfrage = { lat: v.lat, lng: v.lng };
                const km = konzentriert ? entfernungKm(anfrage, konzentriert) : null;
                const fuß = konzentriert ? schaetzungKm(anfrage, konzentriert) : null;
                const genau = vergleichText(v.name) === vergleichText(wert);
                // was zu fuß zu erreichen ist, wird in minuten gesagt – kilometer
                // sagen einem auf dem handy nichts, wenn drei gleiche namen stehen
                const nahe =
                  km === null || km > 500
                    ? ''
                    : km < 0.05
                      ? 'gleich hier'
                      : km < 5
                        ? `${minutenAus(fuß ?? km)} Min. zu Fuß`
                        : `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
                const rechts = [genau ? 'gemeint' : '', nahe].filter(Boolean).join(' · ');
                return (
                  <li key={`${v.lat}-${v.lng}-${i}`}>
                    <button
                      type="button"
                      onClick={() => annehmen(v)}
                      className={cx('flex min-h-11 w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-[var(--akzent-fläche)]', genau && 'bg-[var(--akzent-fläche)]')}
                    >
                      <span aria-hidden className="mt-0.5 shrink-0 text-[15px]">
                        📍
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium">{v.name}</span>
                        <span className="mikro block truncate">
                          {v.adresse ?? ''}
                          {v.adresse ? ' · ' : ''}
                          {quellenName(v.quelle)}
                        </span>
                      </span>
                      {rechts ? <span className="mikro mt-0.5 shrink-0 whitespace-nowrap text-right">{rechts}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
