'use client';

import { useState } from 'react';
import { useStore } from '../lib/daten';
import { abstandTage, gilt } from '../lib/dates';
import { kartenLink } from '../lib/karten';
import { preisText } from '../lib/plan';
import { uhrzeitText } from '../lib/format';
import type { Eintrag, Reise } from '../lib/types';
import { Ablage, Chip, IconKnopf, Karten, Knopf, Menue, cx } from './ui';
import { ReihenBild, useOrtsbild } from './ReihenBild';

/**
 * Die Übernachtung am Reisetag: dasselbe Bild hinter dem Text wie an den
 * anderen Reihen, dazu das violette Band, das ein Bett von einem Punkt
 * unterscheidet. Check-in und -out stehen hier, weil die Nacht sonst leer wirkt.
 * Löschen geht wie bei den Aktivitäten über das Menü – nur mit Rückfrage, weil ein
 * Aufenthalt über mehrere Nächte und damit über mehrere Tage geht.
 */
export function BettZeile({ eintrag, reise, bearbeiten }: { eintrag: Eintrag; reise: Reise; bearbeiten: () => void }) {
  const store = useStore();
  const [frage, setFrage] = useState(false);
  const bild = useOrtsbild(eintrag, reise, true);
  const zeiten = [eintrag.zeit ? `Check-in ${uhrzeitText(eintrag.zeit)}` : null, eintrag.bis_zeit ? `Check-out ${uhrzeitText(eintrag.bis_zeit)}` : null, eintrag.ort].filter(Boolean).join(' · ');
  const nacht = gilt(eintrag.date) && gilt(eintrag.bis_date) ? abstandTage(eintrag.date, eintrag.bis_date) : 0;

  return (
    <Karten className="overflow-hidden">
      <div className={cx('zeile zeile-bett !gap-x-2.5', bild && 'zeile-bild-da')}>
        {bild ? <ReihenBild url={bild.url} /> : null}
        <span className="zeitangabe" aria-hidden>
          🛏️
        </span>
        <div className="text min-w-0">
          <p className="mikro font-semibold uppercase tracking-wide">Übernachtung</p>
          <button type="button" className="mt-0.5 block max-w-full truncate text-left text-[16px] font-semibold hover:underline" onClick={bearbeiten}>
            {eintrag.titel}
          </button>
          <p className="mikro mt-0.5 flex flex-wrap items-center gap-x-1.5">
            <span>{zeiten}</span>
            <span aria-hidden>·</span>
            <span>
              🌙 {nacht > 0 ? `${nacht} ${nacht === 1 ? 'Nacht' : 'Nächte'}` : 'eine Nacht'}
            </span>
          </p>
          {eintrag.preis ? <Chip className="mt-1">{preisText(eintrag, reise)}</Chip> : null}
        </div>
        <div className="taten">
          <a href={kartenLink(eintrag)} target="_blank" rel="noreferrer" className="icon-knopf no-underline" title="Hotel auf der Karte" aria-label="Hotel auf der Karte">
            🗺️
          </a>
          <IconKnopf titel="Unterkunft ändern" onClick={bearbeiten}>
            ✏️
          </IconKnopf>
          <Menue
            titel={eintrag.titel}
            punkte={[
              { label: 'bearbeiten', zeichen: '✏️', onClick: bearbeiten },
              eintrag.buchung_url ? { label: 'Buchung öffnen', zeichen: '🔗', href: eintrag.buchung_url } : null,
              { label: 'löschen', zeichen: '🗑', gefahr: true, onClick: () => setFrage(true) },
            ].filter(Boolean) as never}
          />
        </div>
      </div>

      <Ablage
        offen={frage}
        titel="Unterkunft löschen?"
        schliessen={() => setFrage(false)}
        fuss={
          <>
            <Knopf ton="dezent" onClick={() => setFrage(false)}>
              behalten
            </Knopf>
            <Knopf
              ton="gefahr"
              onClick={() => {
                setFrage(false);
                void store.eintragLoeschen(eintrag.id);
              }}
            >
              löschen
            </Knopf>
          </>
        }
      >
        <p className="py-3 text-[14.5px] leading-relaxed text-[var(--text2)]">
          „{eintrag.titel}“ wird entfernt – {nacht > 1 ? `für alle ${nacht} Nächte des Aufenthalts, nicht nur für diesen Tag` : 'die Nacht hat dann kein Bett mehr'}.
        </p>
      </Ablage>
    </Karten>
  );
}
