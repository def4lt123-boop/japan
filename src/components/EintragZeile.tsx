'use client';

import { useState } from 'react';
import { tagKurz, gilt, abstandTage } from '../lib/dates';
import { reiseTage } from '../lib/plan';
import { artMeta, kategorie } from '../lib/kategorien';
import { kartenLink } from '../lib/karten';
import { geld, minutenText, uhrzeitText } from '../lib/format';
import { useStore } from '../lib/daten';
import type { RoutenInfo } from '../lib/routen';
import type { Eintrag, Reise } from '../lib/types';
import { Ablage, Chip, Foto, IconKnopf, Menue, cx } from './ui';

/**
 * Eine Zeile im Kalender: Zeit links, Bild, Name, darunter was dazugehört.
 * Die Knöpfe stehen auf dem Handy unter dem Text, damit der Name atmen kann.
 */

export function EintragZeile({
  eintrag,
  reise,
  oben,
  unten,
  verbinden,
  bearbeiten,
  kompakt = false,
}: {
  eintrag: Eintrag;
  reise: Reise;
  oben?: () => void;
  unten?: () => void;
  /** Weg zum nächsten Punkt des Tages */
  verbinden?: RoutenInfo | null;
  bearbeiten: () => void;
  kompakt?: boolean;
}) {
  const store = useStore();
  const [tagWaehlen, setTagWaehlen] = useState(false);
  const katz = kategorie(eintrag.kategorie);
  const metadaten = artMeta(eintrag.art);
  const istBett = eintrag.art === 'unterkunft';
  const zeiten = [eintrag.zeit ? uhrzeitText(eintrag.zeit) : null, eintrag.bis_zeit ? `bis ${uhrzeitText(eintrag.bis_zeit)}` : null].filter(Boolean).join(' · ');
  const nacht = istBett && gilt(eintrag.date) && gilt(eintrag.bis_date) ? abstandTage(eintrag.date, eintrag.bis_date) : 0;

  const verschieben = async (id: string, datum: string) => {
    const liste = store.eintraege.filter((e) => e.reise_id === reise.id && e.art !== 'unterkunft' && e.date === datum);
    await store.eintragAendern(id, { date: datum, sortierung: liste.reduce((m, e) => Math.max(m, e.sortierung), 0) + 1 });
    store.sagen(`${metadaten.wort} nach ${tagKurz(datum)} verschoben.`);
  };

  const duplizieren = async () => {
    const { id, erstellt_am, ...ohne } = eintrag;
    await store.eintragAnlegen({ ...ohne, titel: `${eintrag.titel} (Kopie)`, sortierung: eintrag.sortierung + 0.5 });
    store.sagen('Dupliziert.');
  };

  return (
    <li className="group">
      <div className={cx('zeile !gap-x-2.5', kompakt ? '!py-1.5' : '!py-2.5')}>
        <span className="zeitangabe" style={{ color: eintrag.zeit ? 'var(--text)' : undefined }}>
          {istBett ? '🛏️' : eintrag.zeit ? eintrag.zeit : <span style={{ color: 'var(--text3)' }}>—</span>}
        </span>
        {eintrag.foto_url ? <Foto url={eintrag.foto_url} nachweis={eintrag.foto_nachweis} alt={eintrag.titel} zeichen={katz.icon} hoehe={kompakt ? 44 : 56} /> : null}
        <div className="text min-w-0">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button type="button" onClick={bearbeiten} className="min-w-0 max-w-full truncate rounded text-left text-[16px] font-semibold leading-snug hover:underline">
              {eintrag.titel}
            </button>
            <span aria-hidden className="shrink-0 text-[13px]" style={{ color: katz.farbe }} title={katz.label}>
              {istBett ? metadaten.Icon : katz.icon}
            </span>
          </p>
          <p className="mikro mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-1">
            {zeiten ? <span>{zeiten}</span> : null}
            {eintrag.dauer_min ? <span>{eintrag.dauer_min} Min</span> : null}
            {eintrag.ort ? (
              <span>
                {zeiten || eintrag.dauer_min ? <span aria-hidden> · </span> : null}
                {eintrag.ort}
              </span>
            ) : null}
            {istBett ? <span>🌙 {nacht > 0 ? `${nacht} ${nacht === 1 ? 'Nacht' : 'Nächte'}` : 'eine Nacht'}</span> : null}
            {eintrag.preis ? <Chip titel={istBett ? 'pro Aufenthalt' : 'Preis'}>{geld(eintrag.preis, reise.waehrung)}</Chip> : null}
            {eintrag.buchung_nr ? <Chip titel="Buchungsnummer">🎫 {eintrag.buchung_nr}</Chip> : null}
            {!eintrag.date ? <Chip ton="warnt">ohne Tag</Chip> : null}
          </p>
          {eintrag.notiz ? <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-[var(--text2)]">{eintrag.notiz}</p> : null}
          {eintrag.adresse && !kompakt ? <p className="mikro mt-0.5 truncate">{eintrag.adresse}</p> : null}
        </div>
        <div className="taten">
          {oben || unten ? (
            <span className="flex gap-0.5">
              <IconKnopf titel="eine Stelle höher" onClick={oben} deaktiviert={!oben}>
                ▲
              </IconKnopf>
              <IconKnopf titel="eine Stelle tiefer" onClick={unten} deaktiviert={!unten}>
                ▼
              </IconKnopf>
            </span>
          ) : null}
          <a
            href={kartenLink(eintrag)}
            target="_blank"
            rel="noreferrer"
            title="auf Google Maps öffnen"
            aria-label="auf Google Maps öffnen"
            className="icon-knopf no-underline"
            style={{ color: 'var(--text2)' }}
          >
            🗺️
          </a>
          <Menue
            titel={eintrag.titel}
            punkte={[
              { label: 'bearbeiten', zeichen: '✏️', onClick: bearbeiten },
              { label: 'auf anderen Tag', zeichen: '🗓️', onClick: () => setTagWaehlen(true) },
              { label: 'duplizieren', zeichen: '⧉', onClick: duplizieren },
              eintrag.buchung_url ? { label: 'Buchung öffnen', zeichen: '🔗', href: eintrag.buchung_url } : null,
              { label: 'löschen', zeichen: '🗑', gefahr: true, onClick: () => void store.eintragLoeschen(eintrag.id) },
            ].filter(Boolean) as never}
          />
        </div>
      </div>

      {verbinden ? (
        <p className="mikro flex flex-wrap items-center gap-x-1.5 pb-1 pl-[calc(12px+52px)] text-[13px]">
          <span aria-hidden>{verbinden.quelle === 'gerechnet' ? '' : '≈ '}</span>
          <span>
            {verbinden.km < 1 ? `${Math.round(verbinden.km * 1000)} m` : `${String(verbinden.km).replace('.', ',')} km`}
          </span>
          <span aria-hidden>·</span>
          <span>{minutenText(verbinden.minuten)}</span>
          <span style={{ color: 'var(--text3)' }}>({verbinden.quelle === 'gerechnet' ? 'gerechnet' : 'geschätzt'})</span>
        </p>
      ) : null}

      <Ablage offen={tagWaehlen} titel="Wann soll das stattinden?" schliessen={() => setTagWaehlen(false)}>
        <div className="flex flex-wrap gap-2 pt-3">
          {reiseTage(reise).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => {
                setTagWaehlen(false);
                void verschieben(eintrag.id, d);
              }}
              className={cx('chip !px-3 !py-2 !text-[13.5px]', eintrag.date === d && 'chip-aktiv')}
              style={{ borderColor: 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
            >
              {tagKurz(d)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setTagWaehlen(false);
              void store.eintragAendern(eintrag.id, { date: null });
            }}
            className="chip !px-3 !py-2 !text-[13.5px]"
            style={{ borderColor: 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
          >
            aus dem Kalender nehmen
          </button>
        </div>
      </Ablage>
    </li>
  );
}
