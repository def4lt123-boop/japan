import { entfernungKm, kartenLink, punktVorhanden, schaetzungKm, schaetzungMinuten, type Punkt } from './karten';
import { FUSS, minutenAus, type Fussweg } from './weg';
import { naechsteSortierung } from './plan';
import type { Eintrag } from './types';

/**
 * Was noch keinen Tag hat, gehört meistens zusammen: punkte, die man zu fuß in
 * einer halben stunde erreicht, sind ein tag. Zusammengehöriges wird über eine
 * schwelle verknüpft (wer A–B und B–C berührt, kommt mit), innerhalb der gruppe
 * wird die kürzeste route gegangen – die reihenfolge ist zugleich die sortierung,
 * die der tag später bekommt.
 */

export interface Nahpunkt {
  id: string;
  titel: string;
  lat: number;
  lng: number;
  ort: string | null;
}

export interface Haufung {
  id: string;
  punkte: Nahpunkt[];
  /** der weg durch die gruppe zu fuß, geschätzt */
  wegKm: number;
  minuten: number;
  lat: number;
  lng: number;
  stadt: string | null;
  /** der weiteste schritt in der gruppe – sagt, ob sie wirklich eine ist */
  schrittKm: number;
}

/** die wartenden: einerseits punkte mit ort, anderseits die ohne */
export function sortieren(eintraege: Eintrag[]): { mit: Nahpunkt[]; ohne: Eintrag[] } {
  const mit: Nahpunkt[] = [];
  const ohne: Eintrag[] = [];
  for (const e of eintraege) {
    if (e.art === 'unterkunft') continue;
    if (!punktVorhanden(e)) {
      ohne.push(e);
      continue;
    }
    mit.push({ id: e.id, titel: e.titel, lat: e.lat, lng: e.lng, ort: e.ort?.trim() ? e.ort.trim() : null });
  }
  return { mit, ohne };
}

// gruppiert wird nach dem weg, nicht nach der luftlinie: „höchstens 1 km“ soll
// heißen, dass der schritt zu fuß unter einem kilometer liegt
const paarKm = (a: Nahpunkt, b: Nahpunkt) => schaetzungKm(a, b) ?? Number.POSITIVE_INFINITY;

/** einer der punkte, der am weitesten von der mitte absteht – der anfang des gangs */
function weitesterPunkt(punkte: { lat: number; lng: number }[]): number {
  if (punkte.length < 3) return 0;
  const mitte = punkte.reduce((m, p) => ({ lat: m.lat + p.lat / punkte.length, lng: m.lng + p.lng / punkte.length }), { lat: 0, lng: 0 });
  let fund = 0;
  let weitester = -1;
  punkte.forEach((p, i) => {
    const km = entfernungKm(p, mitte) ?? 0;
    if (km > weitester) {
      weitester = km;
      fund = i;
    }
  });
  return fund;
}

/**
 * Immer zum nächsten, das übrig ist – über beliebiges gewicht. Mit der tabelle des
 * wegdienstes ist das gewicht die echte gehzeit, ohne sie die überschlagene strecke.
 */
export function naechsteFolge(anzahl: number, gewicht: (a: number, b: number) => number, anfang = 0): number[] {
  if (anzahl <= 1) return anzahl === 1 ? [0] : [];
  const ubrig: number[] = [];
  for (let i = 0; i < anzahl; i += 1) if (i !== anfang) ubrig.push(i);
  const reihe = [anfang];
  let letzter = anfang;
  while (ubrig.length) {
    let index = 0;
    let nachster = Number.POSITIVE_INFINITY;
    ubrig.forEach((i, position) => {
      const wert = gewicht(letzter, i);
      if (wert < nachster) {
        nachster = wert;
        index = position;
      }
    });
    letzter = ubrig.splice(index, 1)[0]!;
    reihe.push(letzter);
  }
  return reihe;
}

/** die folie einer reihenfolge: was die schritte zusammen kosten */
function kosten(reihe: number[], gewicht: (a: number, b: number) => number): number {
  let summe = 0;
  for (let i = 0; i + 1 < reihe.length; i += 1) summe += gewicht(reihe[i]!, reihe[i + 1]!);
  return summe;
}

/**
 * Der vorschlag für eine route durch eine handvoll halte: erst der gang zum
 * nächsten, dann so lange ein stück umgedreht, bis kein tausch mehr einen schritt
 * spart. Das gewicht ist das, was die seite für teuer hält – mit der tabelle des
 * wegdienstes die echten minuten, ohne sie die überschlagene strecke.
 */
export function routenvorschlag(punkte: { lat: number; lng: number }[], gewicht: (a: number, b: number) => number): number[] {
  let reihe = naechsteFolge(punkte.length, gewicht, weitesterPunkt(punkte));
  if (punkte.length < 4) return reihe;
  let summe = kosten(reihe, gewicht);
  for (let versuch = 0; versuch < 12; versuch += 1) {
    let besser = false;
    // ein stück der folie umdrehen – das ist der schritt, der ein hin und her auflöst
    for (let a = 0; a + 2 < reihe.length && !besser; a += 1) {
      for (let b = a + 2; b < reihe.length && !besser; b += 1) {
        const kandidat = [...reihe.slice(0, a + 1), ...reihe.slice(a + 1, b + 1).reverse(), ...reihe.slice(b + 1)];
        const neu = kosten(kandidat, gewicht);
        if (neu + 0.01 < summe) {
          reihe = kandidat;
          summe = neu;
          besser = true;
        }
      }
    }
    // und einen einzigen halte woanders hinsetzen – eine offene route darf auch
    // ihren anfang wechseln, sonst steht der erste punkt oft in der mitte
    for (let a = 0; a < reihe.length && !besser; a += 1) {
      const rest = [...reihe.slice(0, a), ...reihe.slice(a + 1)];
      for (let b = 0; b < rest.length && !besser; b += 1) {
        const kandidat = [...rest.slice(0, b), reihe[a]!, ...rest.slice(b)];
        const neu = kosten(kandidat, gewicht);
        if (neu + 0.01 < summe) {
          reihe = kandidat;
          summe = neu;
          besser = true;
        }
      }
    }
    if (!besser) break;
  }
  return reihe;
}

/** von einem startpunkt aus immer zum nächsten – die reihenfolge für den tag */
function rundgang(punkte: Nahpunkt[]): Nahpunkt[] {
  if (punkte.length < 3) return [...punkte];
  return naechsteFolge(punkte.length, (a, b) => paarKm(punkte[a]!, punkte[b]!), weitesterPunkt(punkte)).map((i) => punkte[i]!);
}

function stadtVon(punkte: Nahpunkt[]): string | null {
  const zahlen = new Map<string, number>();
  for (const p of punkte) {
    if (!p.ort) continue;
    zahlen.set(p.ort, (zahlen.get(p.ort) ?? 0) + 1);
  }
  const meiste = [...zahlen.entries()].sort((a, b) => b[1] - a[1])[0];
  return meiste ? meiste[0] : null;
}

/**
 * Die gruppen, große zuerst. `schwelleKm` sagt, wie weit ein schritt höchstens
 * sein darf, damit zwei punkte noch zusammengehören.
 */
export function haufungen(eintraege: Eintrag[], schwelleKm = 2.5): Haufung[] {
  const { mit } = sortieren(eintraege);
  const vater = mit.map((_, i) => i);
  const wurzel = (i: number): number => {
    let zeiger = i;
    while (vater[zeiger] !== zeiger) {
      vater[zeiger] = vater[vater[zeiger]!]!;
      zeiger = vater[zeiger]!;
    }
    return zeiger;
  };
  for (let a = 0; a < mit.length; a += 1) {
    for (let b = a + 1; b < mit.length; b += 1) {
      if (paarKm(mit[a]!, mit[b]!) <= schwelleKm) vater[wurzel(b)] = wurzel(a);
    }
  }
  const gruppen = new Map<number, Nahpunkt[]>();
  mit.forEach((p, i) => {
    const kern = wurzel(i);
    gruppen.set(kern, [...(gruppen.get(kern) ?? []), p]);
  });
  const haufungenListe: Haufung[] = [];
  for (const punkte of gruppen.values()) {
    const gang = rundgang(punkte);
    let weg = 0;
    let schritt = 0;
    for (let i = 0; i + 1 < gang.length; i += 1) {
      const km = schaetzungKm(gang[i]!, gang[i + 1]!) ?? 0;
      weg += km;
      schritt = Math.max(schritt, paarKm(gang[i]!, gang[i + 1]!));
    }
    haufungenListe.push({
      id: gang[0]!.id,
      punkte: gang,
      wegKm: Math.round(weg * 10) / 10,
      minuten: weg ? schaetzungMinuten(Math.round(weg * 10) / 10, 'zu fuss') : 0,
      lat: gang.reduce((m, p) => m + p.lat, 0) / gang.length,
      lng: gang.reduce((m, p) => m + p.lng, 0) / gang.length,
      stadt: stadtVon(gang),
      schrittKm: Math.round(schritt * 10) / 10,
    });
  }
  return haufungenListe.sort(
    (a, b) =>
      b.punkte.length - a.punkte.length ||
      a.wegKm - b.wegKm ||
      (a.punkte[0]?.titel ?? '').localeCompare(b.punkte[0]?.titel ?? '', 'de')
  );
}

/**
 * Wie weit eine gruppe von dem entfernt ist, was schon an einem tag steht – die
 * nächstgelegene halte an diesem tag. sortiert, damit der tag oben steht, der am
 * besten paßt; chosen wird trotzdem von hand.
 */
export function tagAbstand(
  haufung: Haufung,
  tage: { datum: string; punkte: Punkt[] }[]
): { datum: string; km: number | null }[] {
  const kern: Punkt = { lat: haufung.lat, lng: haufung.lng };
  return tage
    .map((tag) => ({
      datum: tag.datum,
      km: tag.punkte.length
        ? Math.min(...tag.punkte.map((p) => schaetzungKm(kern, p) ?? Number.POSITIVE_INFINITY))
        : null,
    }))
    .sort((a, b) => (a.km ?? Number.POSITIVE_INFINITY) - (b.km ?? Number.POSITIVE_INFINITY) || (a.datum < b.datum ? -1 : 1));
}

/** der nächste schritt, den ein einzelner punkt unter den wartenden vor sich hat */
export function nachbar(punkt: Nahpunkt, alle: Nahpunkt[]): { nachbar: Nahpunkt; km: number } | null {
  const treffer = alle
    .filter((p) => p.id !== punkt.id)
    .map((p) => ({ p, km: schaetzungKm(punkt, p) ?? Number.POSITIVE_INFINITY }))
    .sort((a, b) => a.km - b.km)[0];
  return treffer && Number.isFinite(treffer.km) ? { nachbar: treffer.p, km: treffer.km } : null;
}

/**
 * Der nächste schritt für jeden punkt einer liste – dieselbe zahl, die in der zeile
 * steht und nach der die liste gefiltert wird. Punkte ohne Google Maps fehlen: für
 * sie gibt es keine entfernung, also auch kein urteil.
 */
export function nachbarn(liste: Eintrag[], modus = FUSS): Map<string, { partner: Nahpunkt; weg: Fussweg }> {
  const { mit } = sortieren(liste);
  const funde = new Map<string, { partner: Nahpunkt; weg: Fussweg }>();
  for (const p of mit) {
    const fund = nachbar(p, mit);
    if (!fund) continue;
    funde.set(p.id, { partner: fund.nachbar, weg: { km: fund.km, minuten: minutenAus(fund.km, modus), quelle: 'geschätzt' } });
  }
  return funde;
}

/** was in google maps zu sehn ist, wenn die gruppe als weg gegangen wird */
export function wegLink(haufung: Haufung): string {
  const stationen = haufung.punkte.map((p) => `${p.lat},${p.lng}`);
  if (stationen.length < 2) return kartenLink({ lat: haufung.lat, lng: haufung.lng });
  return `https://www.google.com/maps/dir/?api=1&travelmode=walking&origin=${stationen[0]}&destination=${stationen[stationen.length - 1]}&waypoints=${stationen.slice(1, -1).join('|')}`;
}

/** was eine gruppe braucht, wenn sie auf einen tag kommt – in gangreihenfolge */
export function tagAenderung(
  eintraege: Eintrag[],
  haufung: Haufung,
  datum: string
): { id: string; patch: { date: string; sortierung: number } }[] {
  const basis = naechsteSortierung(eintraege, datum);
  return haufung.punkte.map((p, index) => ({ id: p.id, patch: { date: datum, sortierung: basis + index } }));
}
