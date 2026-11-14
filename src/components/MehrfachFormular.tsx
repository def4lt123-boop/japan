'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { kategorieVorschlag } from '../lib/kategorien';
import { bremsMelden, gebremst, takt } from '../lib/suchtakt';
import { punktFuer } from '../lib/punktfindung';
import { bildFuer } from '../lib/ortsbild';
import { HOECHSTEN, ohneDubletten, zeilenAusText } from '../lib/sammel';
import { useStore } from '../lib/daten';
import type { Eintrag, Ortsvorschlag, Reise } from '../lib/types';
import { Ablage, Chip, IconKnopf, TextFeld, cx } from './ui';

/**
 * Mehrere aktivitäten auf einmal: der text wird reingesetzt (aus einer notiz,
 * einer nachricht, einer kopierten liste), eine zeile wird ein punkt ohne tag.
 * Gelesen wird der text, nie ein bild.
 *
 * Angelegt wird zuerst der name, damit die reihe da ist – punkt und bild holt sich
 * jeder punkt danach selbst, über dieselben offenen dienste wie im einfachen
 * formular, einer nach dem anderen und mit pause dazwischen, damit eine liste mit
 * zwanzig zeilen nicht zwanzig suchanfragen gleichzeitig lostritt.
 */

/** so viele punkte werden im zweiten durchgang noch einmal gefragt */
const NACHHOLEN = 24;
const warten = (zeit = takt()) => new Promise((loser) => window.setTimeout(loser, zeit));

export function MehrfachFormular({ reise, offen, schliessen }: { reise: Reise; offen: boolean; schliessen: () => void }) {
  const store = useStore();
  const [text, setText] = useState('');
  const [titel, setTitel] = useState<Record<string, string>>({});
  const [weg, setWeg] = useState<string[]>([]);
  const [am, setAm] = useState(0);
  const [legen, setLegen] = useState(false);
  const [ergebnis, setErgebnis] = useState<MehrfachErgebnis | null>(null);
  const abbruch = useRef(false);
  /** wie viele nachträge der zweite durchgang noch holt – für den zähler oben */
  const zusaetzlich = useRef(0);

  useEffect(() => {
    if (!offen) return;
    setLegen(false);
    setAm(0);
    setErgebnis(null);
    abbruch.current = false;
    zusaetzlich.current = 0;
  }, [offen]);

  const eintraege = store.eintraegeVon(reise.id);

  /** der ort, von dem aus gesucht wird – dieselbe regel wie im formular */
  const nahe = useMemo(() => {
    const quelle = eintraege.find((e) => typeof e.lat === 'number' && typeof e.lng === 'number') ?? eintraege.find((e) => e.ort?.trim());
    if (quelle && typeof quelle.lat === 'number' && typeof quelle.lng === 'number') return `&nahe=${quelle.lat},${quelle.lng}`;
    if (quelle?.ort?.trim()) return `&nahe=${encodeURIComponent(quelle.ort.trim())}`;
    const station = reise.stationen?.split(',')[0]?.trim();
    return station ? `&nahe=${encodeURIComponent(station)}` : '';
  }, [eintraege, reise.stationen]);

  const { zeilen, dubletten, uebrig } = useMemo(() => {
    const { neu, dubletten: doppelt } = ohneDubletten(zeilenAusText(text), eintraege.map((e) => e.titel));
    return { zeilen: neu.slice(0, HOECHSTEN), dubletten: doppelt, uebrig: Math.max(0, neu.length - HOECHSTEN) };
  }, [text, eintraege]);

  const gehalten = useMemo(
    () =>
      zeilen
        .filter((z) => !weg.includes(z.titel))
        .map((z) => ({ zeile: z, name: (titel[z.titel] ?? z.titel).trim() }))
        .filter((v) => v.name.length >= 3),
    [zeilen, weg, titel]
  );

  const holen = useMemo(() => {
    return async (frage: string, frisch = false): Promise<Ortsvorschlag[]> => {
      const antwort = await fetch(`/api/orte?q=${encodeURIComponent(frage)}${nahe}${frisch ? '&neu=1' : ''}`).catch(() => null);
      if (!antwort || !antwort.ok) return [];
      const daten = (await antwort.json().catch(() => null)) as { orte?: Ortsvorschlag[]; brems?: boolean } | null;
      bremsMelden(daten?.brems ?? false);
      return daten?.orte ?? [];
    };
  }, [nahe]);

  async function anlegen() {
    setLegen(true);
    setAm(0);
    abbruch.current = false;
    let punkt = 0;
    let bild = 0;
    const angelegt: Eintrag[] = [];
    const ohnePunkt: { eintrag: Eintrag; name: string }[] = [];
    for (const [index, vorlage] of gehalten.entries()) {
      if (abbruch.current) break;
      setAm(index + 1);
      const neu = await store.eintragAnlegen({
        reise_id: reise.id,
        titel: vorlage.name,
        art: 'aktivitaet',
        date: null,
        kategorie: kategorieVorschlag(vorlage.name),
      });
      angelegt.push(neu);
      await warten(90);
      const patch: Partial<Eintrag> = {};
      // in einer bremse reicht die eine frage – die andern kandidatinnen gehen an
      // dieselbe tür, die gerade zu ist, und kosten nur zeit
      const treffer = await punktFuer({ titel: vorlage.name, ort: null, adresse: null, karten_stichwort: null }, reise.land, holen, { höchstens: gebremst() ? 1 : 3 });
      if (treffer) {
        Object.assign(patch, treffer.patch);
        punkt += 1;
      } else {
        ohnePunkt.push({ eintrag: neu, name: vorlage.name });
      }
      // Google bringt das Foto des gefundenen Ortes mit – sonst fragt die Bilderstaffel
      const fund = treffer?.bild ?? (await bildFuer({ titel: vorlage.name, ort: patch.ort ?? null, adresse: patch.adresse ?? null }, { stationen: reise.stationen, land: reise.land }));
      if (fund?.url) {
        patch.foto_url = fund.url;
        patch.foto_nachweis = fund.nachweis;
        bild += 1;
      }
      if (Object.keys(patch).length) await store.eintragAendern(neu.id, patch);
      if (index + 1 < gehalten.length && !abbruch.current) await warten();
    }
    // was in der bremse leer zurückkam, wird ein zweites mal gefragt – die suche hat
    // in der zeit luft geholt, und die frage geht am zwischenspeicher vorbei
    const nachlesen = ohnePunkt.length && !abbruch.current ? await nachholen(ohnePunkt) : 0;
    punkt += nachlesen;
    zusaetzlich.current = 0;
    setErgebnis({ angelegt: angelegt.length, punkt, bild, dubletten, uebrig, ohne: ohnePunkt.length - nachlesen, gebremst: gebremst() });
    setLegen(false);
    store.sagen(angelegt.length ? `${angelegt.length} ${angelegt.length === 1 ? 'Punkt' : 'Punkte'} angelegt – ohne Tag.` : 'Nichts angelegt.');
  }

  /** der zweite durchgang über die punkte ohne fund */
  async function nachholen(liste: { eintrag: Eintrag; name: string }[]) {
    zusaetzlich.current = Math.min(liste.length, NACHHOLEN);
    await warten(takt() * 2);
    let gefunden = 0;
    const anzahl = Math.min(liste.length, NACHHOLEN);
    for (const [index, posten] of liste.slice(0, anzahl).entries()) {
      if (abbruch.current) break;
      setAm(gehalten.length + index + 1);
      const treffer = await punktFuer({ titel: posten.name, ort: null, adresse: null, karten_stichwort: null }, reise.land, (frage) => holen(frage, true), { höchstens: 1 });
      if (treffer) {
        await store.eintragAendern(posten.eintrag.id, treffer.patch);
        gefunden += 1;
      }
      if (index + 1 < anzahl && !abbruch.current) await warten();
    }
    return gefunden;
  }

  const zeilenText = gehalten.length === 1 ? '1 Punkt' : `${gehalten.length} Punkte`;

  return (
    <Ablage
      offen={offen}
      titel={legen ? 'Ich lege an …' : 'Mehrere Aktivitäten hinzufügen'}
      fokus
      schliessen={legen ? () => void (abbruch.current = true) : schliessen}
      fuss={
        <>
          {ergebnis ? null : (
            <button type="button" className="knopf-dezent knopf" onClick={() => (legen ? (abbruch.current = true) : schliessen())}>
              abbrechen
            </button>
          )}
          {ergebnis || !gehalten.length ? null : (
            <button type="button" className="knopf" onClick={() => void anlegen()}>
              {zeilenText} anlegen
            </button>
          )}
        </>
      }
    >
      <div className="space-y-3 pt-3">
        {ergebnis ? (
          <Ergebnis
            ergebnis={ergebnis}
            fertig={schliessen}
            weiter={() => {
              setErgebnis(null);
              setText('');
              setTitel({});
              setWeg([]);
            }}
          />
        ) : (
          <>
            <p className="mikro">Eine Zeile wird ein Punkt – ohne Tag, mit Bild und Google Maps. Der Text aus einer Notiz, einer Nachricht oder einer Liste passt hier hin.</p>
            <TextFeld
              label="Eingefügter Text"
              wert={text}
              beimAendern={(t) => {
                setText(t);
                setTitel({});
                setWeg([]);
              }}
              platzhalter={'Big Ben\nTower Bridge\n1. Sky Garden\n✓ Borough market'}
              mehrzeilig
              zeilen={8}
              autoVeroellstaendigen="off"
              hinweis="Aufzählungszeichen, nummern und emoji-ränder werden abgenommen, ein umbruch wieder angeschlossen. Was die reise schon hat, wird nicht zweimal angelegt."
            />
            {legen ? (
              <p className="mikro" role="status">
                {am} von {gehalten.length + zusaetzlich.current} – {fortschritt(am, gehalten.length + zusaetzlich.current)}
              </p>
            ) : null}
            {zeilen.length ? (
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-1.5">
                  <span className="label">{gehalten.length ? `${zeilenText} vorgeschlagen` : 'alle verworfen – mit ↺ zurück'}</span>
                  {dubletten ? <Chip titel="Diese Namen stehen schon in der Reise">{dubletten} schon in der Reise</Chip> : null}
                  {uebrig ? <Chip ton="warnt">{uebrig} mehr als {HOECHSTEN} – bitte in zwei Runden</Chip> : null}
                </div>
                <ul className="liste m-0 max-h-[42vh] list-none overflow-y-auto rounded-xl border p-1" style={{ borderColor: 'var(--rand)' }}>
                  {zeilen.map((z) => {
                    const raus = weg.includes(z.titel);
                    return (
                      <li key={z.zeile} className={cx('flex items-center gap-1', raus && 'opacity-45')}>
                        <span className="w-5 shrink-0 text-center mikro tabular-nums">{z.zeile}</span>
                        <input
                          className={cx('eingabe min-h-11 flex-1 border-0 bg-transparent py-0 text-[14.5px] focus:bg-transparent focus:px-1.5 focus:ring-0')}
                          value={titel[z.titel] ?? z.titel}
                          onChange={(e) => setTitel((vorher) => ({ ...vorher, [z.titel]: e.target.value }))}
                          placeholder="Titel"
                          aria-label={`Titel für Zeile ${z.zeile}`}
                        />
                        <IconKnopf
                          titel={raus ? 'diesen Punkt doch anlegen' : 'diesen Punkt nicht anlegen'}
                          onClick={() => setWeg((vorher) => (raus ? vorher.filter((t) => t !== z.titel) : [...vorher, z.titel]))}
                        >
                          {raus ? '↺' : '✕'}
                        </IconKnopf>
                      </li>
                    );
                  })}
                </ul>
                <p className="mikro mt-1">
                  Ein Name, der nicht passt, lässt sich hier korrigieren – angelegt wird, was im Feld steht. Mit ✕ fällt eine Zeile heraus, mit ↺ kommt sie zurück.
                </p>
              </div>
            ) : null}
            {text.trim() && !zeilen.length ? <p className="mikro">Aus diesem Text wird noch nichts – eine Zeile braucht mindestens drei Zeichen Inhalt.</p> : null}
          </>
        )}
      </div>
    </Ablage>
  );
}

type MehrfachErgebnis = { angelegt: number; punkt: number; bild: number; dubletten: number; uebrig: number; ohne: number; gebremst: boolean };

function Ergebnis({ ergebnis, fertig, weiter }: { ergebnis: MehrfachErgebnis; fertig: () => void; weiter: () => void }) {
  const { angelegt, punkt, bild, dubletten, uebrig, ohne, gebremst: zugemacht } = ergebnis;
  return (
    <div className="space-y-2">
      <p className="text-[15px] font-medium">
        {angelegt} {angelegt === 1 ? 'Punkt' : 'Punkte'} angelegt – ohne Tag
      </p>
      <div className="flex flex-wrap gap-1.5">
        <Chip ton={punkt ? 'gut' : undefined}>{punkt} mit Google Maps</Chip>
        <Chip ton={bild ? 'gut' : undefined}>{bild} mit Bild</Chip>
        {dubletten ? <Chip>{dubletten} schon in der Reise</Chip> : null}
        {uebrig ? <Chip ton="warnt">{uebrig} nicht angelegt</Chip> : null}
        {ohne ? <Chip ton="warnt" titel="Für diese punkte hat die suche nichts gefunden – ein Google-Maps-link im feld „punkt“ reicht.">{ohne} ohne Google Maps</Chip> : null}
        {zugemacht ? <Chip titel="Die Kartensuche war kurz zugemacht – was nichts brachte, wurde ein zweites Mal gefragt.">Suche zweimal gefragt</Chip> : null}
      </div>
      <p className="mikro">
        {uebrig
          ? `Die ${uebrig} ${uebrig === 1 ? 'Zeile' : 'Zeilen'} über ${HOECHSTEN} hinaus bleiben liegen – für die zweite Runde den text einfach neu einfügen.`
          : angelegt > punkt
            ? `${angelegt - punkt} ${angelegt - punkt === 1 ? 'Punkt bleibt' : 'Punkte bleiben'} ohne Google Maps${zugemacht ? ' – die Kartensuche war gerade zugemacht, auch nach dem zweiten Durchgang' : ''}. In der Liste öffnen und den Google-Maps-Link einfügen.`
            : 'Alle Punkte liegen auf der Karte. In der Liste unter „Ohne Tag“ lassen sie sich auf die Tage setzen.'}
      </p>
      <div className="flex gap-1.5 pt-1">
        <button type="button" className="knopf knopf-klein flex-1" onClick={fertig}>
          fertig
        </button>
        <button type="button" className="knopf knopf-klein knopf-ghost" onClick={weiter}>
          weitere einfügen
        </button>
      </div>
    </div>
  );
}

function fortschritt(am: number, halte: number) {
  const offen = Math.max(0, halte - am);
  if (!offen) return 'Bild und Punkt sind nachgesehn';
  return `noch ${offen} ${offen === 1 ? 'Punkt' : 'Punkte'} – punkt und bild werden einzeln geholt`;
}
