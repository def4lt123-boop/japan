'use client';

import { useState } from 'react';
import { addTage, gilt, heuteIso, abstandTage } from '../lib/dates';
import { sauber, WAEHRUNGEN } from '../lib/format';
import type { Reise } from '../lib/types';
import { Foto, TextFeld, ZahlFeld, cx } from './ui';

/**
 * Eine Reise in acht Feldern. Name und Datum reichen – der Rest ist Vorschlag,
 * den man stehen lassen kann.
 */

export interface ReiseEntwurf {
  name: string;
  land: string;
  stationen: string;
  start_date: string;
  end_date: string;
  budget: number | null;
  waehrung: string;
  personen: number;
  cover_url: string | null;
  cover_credit: string | null;
  beschreibung: string;
}

export function entwurfAus(reise: Reise | null, waehrung: string, personen: number): ReiseEntwurf {
  return {
    name: reise?.name ?? '',
    land: reise?.land ?? '',
    stationen: reise?.stationen ?? '',
    start_date: reise?.start_date ?? heuteIso(),
    end_date: reise?.end_date ?? addTage(reise?.start_date ?? heuteIso(), 6),
    budget: reise?.budget ?? null,
    waehrung: reise?.waehrung ?? waehrung,
    personen: reise?.personen ?? personen,
    cover_url: reise?.cover_url ?? null,
    cover_credit: reise?.cover_credit ?? null,
    beschreibung: reise?.beschreibung ?? '',
  };
}

export function ReiseFormular({
  anfang,
  speichern,
  abbrechen,
  knopfText = 'Reise speichern',
}: {
  anfang: ReiseEntwurf;
  speichern: (werte: Partial<Reise>) => void | Promise<void>;
  abbrechen?: () => void;
  knopfText?: string;
}) {
  const [entwurf, setEntwurf] = useState<ReiseEntwurf>(anfang);
  const [fehler, setFehler] = useState<string | null>(null);
  const [bild, setBild] = useState(false);
  const [bildLaeuft, setBildLaeuft] = useState(false);
  const set = (patch: Partial<ReiseEntwurf>) => setEntwurf((v) => ({ ...v, ...patch }));

  const tage = gilt(entwurf.start_date) && gilt(entwurf.end_date) ? abstandTage(entwurf.start_date, entwurf.end_date) + 1 : 0;

  async function los() {
    const stationen = entwurf.stationen
      .split(/[·,;]/)
      .map((s) => sauber(s))
      .filter(Boolean)
      .join(' · ');
    const name = sauber(entwurf.name) || stationen.split(' · ')[0] || sauber(entwurf.land) || 'Neue Reise';
    if (gilt(entwurf.end_date) && entwurf.end_date < entwurf.start_date) {
      setFehler('Das Ende liegt vor dem Anfang.');
      return;
    }
    await speichern({
      name,
      land: sauber(entwurf.land) || null,
      stationen: stationen || null,
      start_date: entwurf.start_date || null,
      end_date: entwurf.end_date || null,
      budget: entwurf.budget,
      waehrung: entwurf.waehrung,
      personen: Math.max(1, Math.round(entwurf.personen || 1)),
      cover_url: entwurf.cover_url,
      cover_credit: entwurf.cover_credit,
      beschreibung: sauber(entwurf.beschreibung) || null,
    });
  }

  return (
    <div className="space-y-3.5">
      <TextFeld label="Name der Reise" wert={entwurf.name} beimAendern={(t) => set({ name: t })} platzhalter="Frühling in Andalusien" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TextFeld label="Land" wert={entwurf.land} beimAendern={(t) => set({ land: t })} platzhalter="Spanien" />
        <TextFeld label="Reiseziele" wert={entwurf.stationen} beimAendern={(t) => set({ stationen: t })} platzhalter="Sevilla · Granada" hinweis="Der Reihe nach, mit · getrennt – der Kalender nimmt sie als Stationswechsel." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FeldDatum label="Von" wert={entwurf.start_date} beimAendern={(d) => set({ start_date: d, end_date: gilt(entwurf.end_date) && d > entwurf.end_date ? addTage(d, 6) : entwurf.end_date })} />
        <FeldDatum label="Bis" wert={entwurf.end_date} beimAendern={(d) => set({ end_date: d })} frueher={entwurf.start_date} />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mikro">{tage > 0 ? `${tage} ${tage === 1 ? 'Tag' : 'Tage'} · ${Math.max(0, tage - 1)} Nächte` : 'kein Zeitraum gesetzt'}</span>
        {[
          { label: 'Wochenende', n: 2 },
          { label: '4 Tage', n: 3 },
          { label: '1 Woche', n: 6 },
          { label: '10 Tage', n: 9 },
          { label: '2 Wochen', n: 13 },
        ].map((v) => (
          <button key={v.label} type="button" onClick={() => set({ end_date: addTage(entwurf.start_date || heuteIso(), v.n) })} className="chip !py-1.5 no-underline">
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <ZahlFeld label="Budget" wert={entwurf.budget} beimAendern={(n) => set({ budget: n })} vorzeichen={entwurf.waehrung} platzhalter="1800" />
        <div className="grid grid-cols-2 gap-2">
          <div className="feld">
            <label className="label" htmlFor="waehrung">
              Währung
            </label>
            <select id="waehrung" className="eingabe selekt" value={entwurf.waehrung} onChange={(e) => set({ waehrung: e.target.value })}>
              {WAEHRUNGEN.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
          <ZahlFeld label="Personen" wert={entwurf.personen} beimAendern={(n) => set({ personen: n ?? 1 })} />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="label mb-0">Titelbild</p>
          <button type="button" className="chip !py-1.5" onClick={() => setBild((b) => !b)}>
            {bild ? 'zurecht machen' : 'eigenes Bild'}
          </button>
        </div>
        <div className="mt-1.5 flex items-center gap-2.5">
          <Foto url={entwurf.cover_url} nachweis={entwurf.cover_credit} alt={entwurf.name || 'Titelbild'} zeichen="🏙️" hoehe={64} className="!w-24 !rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <button type="button" className="knopf knopf-ghost knopf-klein w-full" onClick={() => void bildVorschlagen()}>
              {bildLaeuft ? 'suche Bild …' : 'Bild zum Ziel finden'}
            </button>
            {bild ? <TextFeld label="" wert={entwurf.cover_url ?? ''} beimAendern={(t) => set({ cover_url: t || null, cover_credit: null })} platzhalter="https://…/bild.jpg" /> : null}
          </div>
        </div>
      </div>

      <TextFeld label="Worum geht es?" wert={entwurf.beschreibung} beimAendern={(t) => set({ beschreibung: t })} platzhalter="Altstadt, Flamenco, ein Tag Strand zum Schluss." mehrzeilig />

      {fehler ? <p className="text-[13.5px] font-medium text-[var(--gefahr)]">{fehler}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-2 pt-0.5">
        {abbrechen ? (
          <button type="button" className="knopf knopf-dezent" onClick={abbrechen}>
            abbrechen
          </button>
        ) : null}
        <button type="button" className="knopf" onClick={los}>
          {knopfText}
        </button>
      </div>
    </div>
  );

  async function bildVorschlagen() {
    const frage = [entwurf.stationen.split(' · ')[0], entwurf.land].filter(Boolean).join(', ') || entwurf.name;
    if (frage.trim().length < 3) {
      setFehler('Erst ein Ziel eintippen, dann suche ich ein Bild.');
      return;
    }
    setBildLaeuft(true);
    setFehler(null);
    try {
      const antwort = await fetch(`/api/bild?q=${encodeURIComponent(frage)}`, { cache: 'no-store' });
      const daten = (await antwort.json()) as { url?: string; nachweis?: string | null };
      if (daten.url) {
        set({ cover_url: daten.url, cover_credit: daten.nachweis ?? null });
        if (!entwurf.name.trim()) set({ name: frage.split(',')[0] });
      } else {
        setFehler('Kein freies Bild gefunden – das Feld bleibt leer.');
      }
    } finally {
      setBildLaeuft(false);
    }
  }
}

function FeldDatum({ label, wert, beimAendern, frueher }: { label: string; wert: string; beimAendern: (d: string) => void; frueher?: string }) {
  return (
    <div className={cx('feld')}>
      <label className="label">{label}</label>
      <input type="date" className="eingabe" value={wert} min={frueher} onChange={(e) => beimAendern(e.target.value)} />
    </div>
  );
}
