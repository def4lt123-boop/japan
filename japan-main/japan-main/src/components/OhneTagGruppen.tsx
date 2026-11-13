'use client';

import { useMemo, useState } from 'react';
import { kartenLink, kmText, punktVorhanden, type Punkt } from '../lib/karten';
import { minutenText } from '../lib/format';
import { haufungen, nachbar, routenvorschlag, sortieren, tagAbstand, tagAenderung, wegLink, type Haufung, type Nahpunkt } from '../lib/naehe';
import { minutenAus, wegLaenge, wegText, wegTitel, type Fussweg } from '../lib/weg';
import { useFussWege, useGruppenRouten } from './Fussweg';
import { ohneTagEintraege, reiseTage } from '../lib/plan';
import { tagKurz } from '../lib/dates';
import { useStore } from '../lib/daten';
import type { Reise } from '../lib/types';
import { Karten, KartenKopf, cx } from './ui';

/**
 * Die analyse über das, was noch keinen tag hat: punkte, die weniger als einen
 * spaziergang auseinander liegen, gehören an einen tag. gruppiert ist nur ein
 * vorschlag – welcher tag es wird, steht an jedem satz und wird angefasst.
 *
 * Die reihenfolge innerhalb einer gruppe ist der zweite vorschlag: sie folgt den
 * wegen, nicht der reihenfolge des eintippens. Wo der wegdienst die tabelle
 * beantwortet, sind es die echten minuten; die tage bleiben trotzdem leer, bis ein
 * tag gewählt wird.
 */

const SCHWELLEN = [1, 1.5, 2.5, 4] as const;

/** der schlüssel eines schrittes – dieselbe paarung wie in der rechnung */
const schrittId = (von: Nahpunkt, nach: Nahpunkt) => `${von.id}>${nach.id}`;

interface Gang {
  km: number;
  minuten: number;
  schrittKm: number;
  /** die tabelle des wegdienstes hat geantwortet – dann stehen die zeilen ohne ≈ da */
  gerechnet: boolean;
}

export function OhneTagGruppen({ reise }: { reise: Reise }) {
  const store = useStore();
  const eintraege = store.eintraegeVon(reise.id);
  const [schwelle, setSchwelle] = useState<number>(2.5);
  const [am, setAm] = useState<string | null>(null);

  const wartend = useMemo(() => ohneTagEintraege(eintraege), [eintraege]);
  const { mit: punkte, ohne: ohnePunkt } = useMemo(() => sortieren(wartend), [wartend]);
  const gruppen = useMemo(() => haufungen(wartend, schwelle), [wartend, schwelle]);

  // eine gruppe, eine anfrage: die tabelle bringt alle wege dazwischen auf einmal
  const tabellen = useGruppenRouten(gruppen.map((g) => ({ id: g.id, punkte: g.punkte as unknown as Punkt[] })));

  /** was die gruppe zu gehen hat, und in welcher reihenfolge – die tabelle zuerst */
  const saetze = useMemo(
    () =>
      gruppen.map((gruppe) => {
        const matrix = tabellen[gruppe.id];
        if (!matrix) return { gruppe, gang: null as Gang | null, wege: {} as Record<string, Fussweg> };
        const reihe = routenvorschlag(gruppe.punkte, (a, b) => matrix.minuten[a]![b]!);
        const geordnete = reihe.map((i) => gruppe.punkte[i]!);
        const wege: Record<string, Fussweg> = {};
        let km = 0;
        let minuten = 0;
        let schritt = 0;
        for (let i = 0; i + 1 < geordnete.length; i += 1) {
          const zeit = matrix.minuten[reihe[i]!]![reihe[i + 1]!]!;
          const strecke = matrix.km[reihe[i]!]![reihe[i + 1]!]!;
          if (!Number.isFinite(zeit)) return { gruppe, gang: null, wege: {} };
          wege[schrittId(geordnete[i]!, geordnete[i + 1]!)] = { km: strecke, minuten: zeit, quelle: 'gerechnet' };
          km += strecke;
          minuten += zeit;
          schritt = Math.max(schritt, strecke);
        }
        return {
          gruppe: { ...gruppe, punkte: geordnete, schrittKm: Math.round(schritt * 10) / 10 },
          gang: { km: Math.round(km * 10) / 10, minuten: Math.round(minuten), schrittKm: Math.round(schritt * 10) / 10, gerechnet: true } as Gang,
          wege,
        };
      }),
    [gruppen, tabellen]
  );

  // die schritte, für die keine tabelle geantwortet hat: einer nach dem andern
  // gerechnet, weil der wegdienst eine staffel nicht mag – bis dahin steht die
  // überschlagene zahl da
  const schritte = useMemo(
    () =>
      saetze.flatMap(({ gruppe, wege }) =>
        gruppe.punkte
          .slice(1)
          .map((p, i) => ({ id: schrittId(gruppe.punkte[i]!, p), von: gruppe.punkte[i] as Nahpunkt, nach: p as Nahpunkt }))
          .filter((paar) => !wege[paar.id])
      ),
    [saetze]
  );
  const gerechnete = useFussWege(schritte);

  /** was eine gruppe zu gehen hat – die zeilen und die kopfzeile rechnen gleich */
  const geschaetzt = useMemo(() => {
    const fond: Record<string, Gang> = {};
    for (const satz of saetze) {
      if (satz.gang) {
        fond[satz.gruppe.id] = satz.gang;
        continue;
      }
      let km = 0;
      let minuten = 0;
      let schritt = 0;
      satz.gruppe.punkte.slice(1).forEach((p, i) => {
        const vorher = satz.gruppe.punkte[i]!;
        const fund: Fussweg | null | undefined = satz.wege[schrittId(vorher, p)] ?? gerechnete[schrittId(vorher, p)];
        const zahl = fund ?? null;
        km += zahl?.km ?? 0;
        minuten += zahl?.minuten ?? 0;
        schritt = Math.max(schritt, zahl?.km ?? 0);
      });
      fond[satz.gruppe.id] = {
        km: km ? Math.round(km * 10) / 10 : satz.gruppe.wegKm,
        minuten: minuten ? Math.round(minuten) : satz.gruppe.minuten,
        schrittKm: schritt ? Math.round(schritt * 10) / 10 : satz.gruppe.schrittKm,
        gerechnet: false,
      };
    }
    return fond;
  }, [saetze, gerechnete]);

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
          <button
            key={km}
            type="button"
            className={cx('chip', schwelle === km && 'chip-aktiv')}
            title={`${minutenAus(km)} min zu Fuß – gruppiert wird über die wege, nicht über die linie`}
            onClick={() => setSchwelle(km)}
          >
            höchstens {kmText(km)}
          </button>
        ))}
      </div>

      <div className="mt-2 space-y-2.5">
        {saetze.map((satz) => (
          <Satz
            key={satz.gruppe.id}
            gruppe={satz.gruppe}
            alle={punkte}
            abstand={tagAbstand(satz.gruppe, tage)}
            gang={geschaetzt[satz.gruppe.id] ?? { km: satz.gruppe.wegKm, minuten: satz.gruppe.minuten, schrittKm: satz.gruppe.schrittKm, gerechnet: false }}
            wege={{ ...gerechnete, ...satz.wege }}
            beschaftigt={am === satz.gruppe.id}
            aufTag={(datum) => void setzen(satz.gruppe, datum)}
          />
        ))}

        {ohnePunkt.length ? (
          <p className="mikro">
            {ohnePunkt.length} {ohnePunkt.length === 1 ? 'Punkt hat' : 'Punkte haben'} noch kein Google Maps – in der zeile den punkt suchen oder den
            Google-Maps-link einfügen, dann rechnet die analyse mit.
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
  gang,
  wege,
  beschaftigt,
  aufTag,
}: {
  gruppe: Haufung;
  alle: Nahpunkt[];
  abstand: { datum: string; km: number | null }[];
  gang: Gang;
  wege: Record<string, Fussweg | null>;
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
              ? gang.km < 0.05
                ? 'zwei punkte, derselbe ort auf der karte'
                : `${gang.gerechnet ? 'vorgeschlagene route · ' : ''}${minutenText(gang.minuten)} zusammen · ${kmText(gang.km)}${
                    gang.schrittKm ? ` · weitester schritt ${kmText(gang.schrittKm)}` : ''
                  }`
              : 'allein – der tag hier gilt nur diesem punkt'}
          </p>
        </div>
        {viele ? (
          <a
            className="chip shrink-0"
            href={wegLink(gruppe)}
            target="_blank"
            rel="noreferrer"
            title={gang.gerechnet ? 'die stationen in der vorgeschlagenen reihenfolge' : 'die stationen in der überschlagenen reihenfolge'}
          >
            Weg
          </a>
        ) : null}
      </div>

      <ol className="m-0 mt-2 list-none space-y-1 p-0">
        {gruppe.punkte.map((p, index) => {
          const vorher = index ? gruppe.punkte[index - 1] : null;
          // die erste halte hat keinen weg hinter sich – ihr schritt ist der weg
          // vorwärts, und es ist derselbe, den die zweite halte darunter liest
          const vorwaerts = index ? null : wege[schrittId(p, gruppe.punkte[1] ?? p)] ?? null;
          const schritt = (vorher ? wege[schrittId(vorher, p)] : vorwaerts) ?? null;
          const near = nachbar(p, alle);
          return (
            <li key={p.id} className="flex items-baseline gap-2">
              <span className="w-4 shrink-0 text-center mikro tabular-nums">{index + 1}</span>
              <a className="min-w-0 flex-1 truncate text-[14px]" href={kartenLink(p)} target="_blank" rel="noreferrer">
                {p.titel}
              </a>
              <span className="mikro shrink-0 tabular-nums" title={schritt && schritt.km >= 0.05 ? wegTitel(schritt) : undefined}>
                {schritt && schritt.km >= 0.05
                  ? `🚶 ${wegText(schritt)} ${wegLaenge(schritt)}${index ? '' : ' zum nächsten'}`
                  : near && near.km >= 0.05
                    ? `🚶 ${wegText({ km: near.km, minuten: minutenAus(near.km), quelle: 'geschätzt' })} zum nächsten`
                    : 'gleicher punkt'}
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
            title={tag.km !== null ? `${kmText(tag.km)} zu Fuß von dieser gruppe – überschlagen, weil der weg nicht gefragt wird` : 'dieser tag hat noch keinen punkt'}
            onClick={() => aufTag(tag.datum)}
            style={tag.datum === naechster?.datum ? { borderColor: 'var(--akzent)', color: 'var(--akzent)' } : undefined}
          >
            {tagKurz(tag.datum)}
            {tag.km !== null ? ` · ${minutenAus(tag.km)} Min.` : ''}
          </button>
        ))}
      </div>
    </article>
  );
}
