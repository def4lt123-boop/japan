'use client';

import { useMemo, useState } from 'react';
import { kartenLink, kmText, punktVorhanden, schaetzungKm } from '../lib/karten';
import { haufungen, nachbar, sortieren, tagAbstand, tagAenderung, wegLink, type Haufung, type Nahpunkt } from '../lib/naehe';
import { ohneTagEintraege, reiseTage } from '../lib/plan';
import { tagKurz } from '../lib/dates';
import { useStore } from '../lib/daten';
import type { Reise } from '../lib/types';
import { Karten, KartenKopf, cx } from './ui';

/**
 * Die analyse über das, was noch keinen tag hat: punkte, die weniger als einen
 * spaziergang auseinander liegen, gehören an einen tag. gruppiert ist nur ein
 * vorschlag – welcher tag es wird, steht an jedem satz und wird angefasst.
 */

const SCHWELLEN = [1.5, 2.5, 4] as const;

export function OhneTagGruppen({ reise }: { reise: Reise }) {
  const store = useStore();
  const eintraege = store.eintraegeVon(reise.id);
  const [schwelle, setSchwelle] = useState<number>(2.5);
  const [am, setAm] = useState<string | null>(null);

  const wartend = useMemo(() => ohneTagEintraege(eintraege), [eintraege]);
  const { mit: punkte, ohne: ohnePunkt } = useMemo(() => sortieren(wartend), [wartend]);
  const gruppen = useMemo(() => haufungen(wartend, schwelle), [wartend, schwelle]);

  const tage = useMemo(() => {
    const fix = eintraege.filter((e) => e.date && punktVorhanden(e));
    return reiseTage(reise).map((datum) => ({
      datum,
      punkte: fix.filter((e) => e.date === datum).map((e) => ({ lat: e.lat as number, lng: e.lng as number })),
    }));
  }, [eintraege, reise]);

  async function setzen(gruppe: Haufung, datum: string) {
    setAm(gruppe.id);
    await store.eintraegeRueckwaerts(tagAenderung(eintraege, gruppe, datum));
    setAm(null);
    store.sagen(
      `${gruppe.punkte.length === 1 ? 'Punkt' : `${gruppe.punkte.length} Punkte`} auf ${tagKurz(datum)} gesetzt${
        gruppe.punkte.length > 1 ? ' – in der Reihenfolge der Wege' : ''
      }.`
    );
  }

  if (!wartend.length) return null;

  return (
    <Karten className="mt-3">
      <KartenKopf
        titel="Was an einem Tag geht"
        untertitel={`${wartend.length} ohne Tag · gruppen nach abstand, der tag bleibt deine wahl`}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="mikro">ein schritt in der gruppe</span>
        {SCHWELLEN.map((km) => (
          <button key={km} type="button" className={cx('chip', schwelle === km && 'chip-aktiv')} onClick={() => setSchwelle(km)}>
            höchstens {kmText(km)}
          </button>
        ))}
      </div>

      <div className="mt-2 space-y-2.5">
        {gruppen.map((gruppe) => (
          <Satz
            key={gruppe.id}
            gruppe={gruppe}
            alle={punkte}
            abstand={tagAbstand(gruppe, tage)}
            beschaftigt={am === gruppe.id}
            aufTag={(datum) => void setzen(gruppe, datum)}
          />
        ))}

        {ohnePunkt.length ? (
          <p className="mikro">
            {ohnePunkt.length} {ohnePunkt.length === 1 ? 'Punkt hat' : 'Punkte haben'} noch kein Google Maps – in der zeile den punkt suchen oder den Google-Maps-link einfügen, dann rechnet die analyse mit.
          </p>
        ) : null}
        {!tage.length ? <p className="mikro">Diese reise hat keine tage – im reiseblatt datum einsetzen, dann gibt es tage zum auswählen.</p> : null}
      </div>
    </Karten>
  );
}

function Satz({
  gruppe,
  alle,
  abstand,
  beschaftigt,
  aufTag,
}: {
  gruppe: Haufung;
  alle: Nahpunkt[];
  abstand: { datum: string; km: number | null }[];
  beschaftigt: boolean;
  aufTag: (datum: string) => void;
}) {
  const viele = gruppe.punkte.length > 1;
  const naechster = abstand.find((t) => t.km !== null);
  return (
    <article className="rounded-xl border p-3" style={{ borderColor: 'var(--rand)' }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14.5px] font-medium leading-snug">
            {gruppe.punkte.length} {viele ? 'Punkte' : 'Punkt'}{gruppe.stadt ? ` · ${gruppe.stadt}` : ''}
          </p>
          <p className="mikro mt-0.5">
            {viele
              ? `${kmText(gruppe.wegKm)} zusammen · ${gruppe.minuten} min zu Fuß · weitester schritt ${kmText(gruppe.schrittKm)}`
              : 'allein – der tag hier gilt nur diesem punkt'}
          </p>
        </div>
        {viele ? (
          <a className="chip shrink-0" href={wegLink(gruppe)} target="_blank" rel="noreferrer">
            Weg
          </a>
        ) : null}
      </div>

      <ol className="m-0 mt-2 list-none space-y-1 p-0">
        {gruppe.punkte.map((p, index) => {
          const vorher = index ? gruppe.punkte[index - 1] : null;
          const schritt = vorher ? schaetzungKm(vorher, p) : null;
          const near = nachbar(p, alle);
          return (
            <li key={p.id} className="flex items-baseline gap-2">
              <span className="w-4 shrink-0 text-center mikro tabular-nums">{index + 1}</span>
              <a className="min-w-0 flex-1 truncate text-[14px]" href={kartenLink(p)} target="_blank" rel="noreferrer">
                {p.titel}
              </a>
              <span className="mikro shrink-0">
                {schritt !== null ? `+ ${kmText(schritt)}` : near ? `${kmText(near.km)} zum nächsten` : 'kein zweiter punkt'}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="label mb-1 mt-2.5">Tag wählen</p>
      <div className="flex flex-wrap gap-1.5">
        {abstand.map((tag) => (
          <button
            key={tag.datum}
            type="button"
            className={cx('chip shrink-0', beschaftigt && 'opacity-60')}
            disabled={beschaftigt}
            title={tag.km !== null ? `${kmText(tag.km)} von dieser gruppe` : 'dieser tag hat noch keinen punkt'}
            onClick={() => aufTag(tag.datum)}
            style={tag.datum === naechster?.datum ? { borderColor: 'var(--akzent)', color: 'var(--akzent)' } : undefined}
          >
            {tagKurz(tag.datum)}
            {tag.km !== null ? ` · ${kmText(tag.km)}` : ''}
          </button>
        ))}
      </div>
    </article>
  );
}
