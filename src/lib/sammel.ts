import { vergleichText } from './orte';

/**
 * Aus einem Text, der reinkopiert wurde, werden Aktivitäten: eine Zeile ein Punkt.
 * Aufzählungszeichen, nummern und kasten vorne weg, umgebrochene zeilen wieder
 * zusammen, doppelter text nur einmal. eine zahl mit punkt leitet eine liste ein,
 * „12 oxford street" bleibt eine adresse – deshalb ist die klammer eng gehalten.
 */

export interface Sammelzeile {
  titel: string;
  /** die zeile im eingefügten text, für die rückmeldung */
  zeile: number;
}

/** anfangszeichen, die eine liste markieren – kein buchstabe, sonst frisst es „of” */
const AUFZAEHLUNG = /^\s*(?:[-–—*+•·‣▪◦○◙◘□☐☑✓✔]|\([0-9a-z]{1,2}\)|\[[ xX✓✔]?\]|\d{1,3}[.)])\s+/iu;
const SCHMUCK = /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]+/u;
const SCHMUCK_ENDE = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\s]+$/u;
const SATZENDE = /[.!?:;…\]\)]$/u;
const KLEIN_ANFANG = /^[a-zà-öø-ÿ]/u;
/** ein bindestrich am zeilenende ist ein umbruch, kein gedanke – auch großgeschrieben */
const BINDESTRICH = /[-–—|,:]$/u;
const UEBERSCHRIFT = /:\s*$/u;

const glatt = (text: string) => text.replace(/\s+/g, ' ').trim();

/**
 * Eine zeile, so wie sie als punkt taugt. zurückgegeben wird null, wenn die zeile
 * nichts hergibt: ein emoji für sich, ein strich, ein wort mit zwei buchstaben.
 */
export function zeileAusText(zeile: string): string | null {
  const ohne = glatt(zeile.replace(AUFZAEHLUNG, '').replace(SCHMUCK, '').replace(SCHMUCK_ENDE, '').replace(/[:;]+$/, ''));
  if (!ohne) return null;
  const kern = vergleichText(ohne);
  if (kern.length < 3) return null;
  return ohne;
}

/**
 * Der text in zeilen, umbrüche wieder angeschlossen: eine zeile, die klein anfängt
 * oder an der ein strich hängt, gehört zur zeile darüber – zwei satzanfänge sind
 * zwei punkte. Eine zeile, die mit einem doppek punkt endet, ist eine überschrift
 * über der liste und wird überlesen; wer sie als punkt will, nimmt den strich weg.
 */
export function zeilenAusText(text: string): Sammelzeile[] {
  const stücke = (text ?? '').replace(/\r/g, '\n').split('\n');
  const gefunde: { text: string; zeile: number }[] = [];
  stücke.forEach((roh, index) => {
    const sauber = glatt(roh);
    if (!sauber) return;
    const titel = zeileAusText(sauber);
    const vorher = gefunde[gefunde.length - 1];
    const danach = stücke.slice(index + 1).some((z) => z.trim());
    if (UEBERSCHRIFT.test(sauber) && danach && !AUFZAEHLUNG.test(sauber)) return;
    // ein klein angefangener rest oder ein strich am ende gehört zur zeile darüber
    const fortsatz =
      titel !== null && vorher !== undefined && !AUFZAEHLUNG.test(sauber) && (!SATZENDE.test(vorher.text) && (KLEIN_ANFANG.test(titel) || BINDESTRICH.test(vorher.text)));
    if (fortsatz) {
      vorher.text = glatt(`${vorher.text} ${titel}`);
      return;
    }
    if (titel === null) return;
    gefunde.push({ text: titel, zeile: index + 1 });
  });
  const gesehen = new Set<string>();
  const zeilen: Sammelzeile[] = [];
  for (const stuck of gefunde) {
    const kern = vergleichText(stuck.text);
    if (gesehen.has(kern)) continue;
    gesehen.add(kern);
    zeilen.push({ titel: stuck.text, zeile: stuck.zeile });
  }
  return zeilen;
}

/**
 * Was der reise schon bekannt ist, wird nicht noch einmal angelegt: derselbe name in
 * anderer schreibweise gilt als derselbe punkt.
 */
export function ohneDubletten(zeilen: Sammelzeile[], vorhanden: string[]): { neu: Sammelzeile[]; dubletten: number } {
  const bekannt = new Set(vorhanden.map(vergleichText));
  const neu: Sammelzeile[] = [];
  let dubletten = 0;
  for (const z of zeilen) {
    if (bekannt.has(vergleichText(z.titel))) {
      dubletten += 1;
      continue;
    }
    neu.push(z);
  }
  return { neu, dubletten };
}

/** höchstens so viele punkte auf einmal – die suche danach soll nicht tagelang laufen */
export const HOECHSTEN = 40;
