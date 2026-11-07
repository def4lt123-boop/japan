import { gilt, abstandTage, addTage, tageListe, tagKurz } from './dates';
import { kategorie } from './kategorien';
import { geld } from './format';
import type { Eintrag, Reise } from './types';

/**
 * Das Rechenblatt hinter Kalender, Karte und Dashboard. Alles hier ist eine
 * saubere Funktion über den Einträgen einer Reise – kein Zugriff auf den
 * Store, damit sich jede Regel allein prüfen lässt.
 */

/**
 * Was auf der Karte steht: die Punkte mit Datum in der Reihenfolge ihrer Tage
 * – und die Betten dahinter, eines für jede Nacht, in der es bezogen ist. Ein
 * Bett bekommt keine Zahl: es ist nicht Halt der Route, es ist der Grund,
 * warum die Route an diesem Ort endet.
 */
export function kartenEintraege(eintraege: Eintrag[], datum: string | null): Eintrag[] {
  const punkte = eintraege
    .filter((e) => e.art !== 'unterkunft' && e.date && (datum === null || e.date === datum))
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || chronologisch(a, b));
  const betten = eintraege.filter((e) => e.art === 'unterkunft' && (datum === null || giltAm(e, datum)));
  return [...punkte, ...betten];
}

/** Zeit zuerst, dann die von Hand gezogene Reihenfolge, dann der Titel */
export function chronologisch(a: Eintrag, b: Eintrag): number {
  const za = a.zeit ?? '99:99';
  const zb = b.zeit ?? '99:99';
  if (za !== zb) return za < zb ? -1 : 1;
  if (a.sortierung !== b.sortierung) return a.sortierung - b.sortierung;
  return a.titel.localeCompare(b.titel, 'de');
}

export function eintraegeDerReise(eintraege: Eintrag[], reiseId: string): Eintrag[] {
  return eintraege.filter((e) => e.reise_id === reiseId);
}

/** Alles, was an einem Tag im Kalender steht – mehrtägige Unterkünfte aparte */
export function tagEintraege(eintraege: Eintrag[], datum: string): Eintrag[] {
  return eintraege.filter((e) => e.art !== 'unterkunft' && e.date === datum).sort(chronologisch);
}

export function unterkuenfte(eintraege: Eintrag[]): Eintrag[] {
  return eintraege
    .filter((e) => e.art === 'unterkunft')
    .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || a.sortierung - b.sortierung);
}

/** Eine Unterkunft gilt von Check-in bis Tag vor Check-out – die Nacht danach gehört ihr */
export function giltAm(e: Eintrag, datum: string): boolean {
  if (e.art !== 'unterkunft' || !gilt(e.date)) return false;
  if (!gilt(e.bis_date)) return e.date === datum;
  return datum >= e.date && datum < e.bis_date;
}

export function uebernachtungAm(eintraege: Eintrag[], datum: string): Eintrag | null {
  const treffer = unterkuenfte(eintraege).filter((e) => giltAm(e, datum));
  return treffer[treffer.length - 1] ?? null;
}

/** Lücken im Bett: Tage der Reise ohne Unterkunft */
export function offeneNachte(reise: Reise, eintraege: Eintrag[]): string[] {
  return tageListe(reise.start_date, reise.end_date)
    .slice(0, -1)
    .filter((d) => !uebernachtungAm(eintraege, d));
}

export function stadtDesTages(eintraege: Eintrag[], reise: Reise, datum: string): string | null {
  const bett = uebernachtungAm(eintraege, datum);
  const ausEintrag = eintraege.find((e) => e.date === datum && e.ort)?.ort;
  const stadt = bett?.ort ?? ausEintrag ?? null;
  if (stadt) return stadt;
  const stationen = (reise.stationen ?? '').split('·').map((s) => s.trim()).filter(Boolean);
  const tage = tageListe(reise.start_date, reise.end_date);
  if (!stationen.length || !tage.length) return null;
  const index = Math.min(stationen.length - 1, Math.floor((tage.indexOf(datum) / tage.length) * stationen.length));
  return stationen[index] ?? null;
}

export interface TagesPlan {
  datum: string;
  nummer: number;
  stadt: string | null;
  eintraege: Eintrag[];
  bett: Eintrag | null;
  /** Minuten, die an diesem Tag verplant sind */
  minuten: number;
  fuellung: 'leer' | 'kurz' | 'gut' | 'voll';
}

/** Der Tag, wie ihn die Kalenderseite zeigt */
export function tagesPlan(reise: Reise, eintraege: Eintrag[], datum: string): TagesPlan {
  const liste = tagEintraege(eintraege, datum);
  const minuten = liste.reduce((sum, e) => sum + (e.dauer_min ?? 0), 0);
  return {
    datum,
    nummer: reisetagNummer(reise, datum),
    stadt: stadtDesTages(eintraege, reise, datum),
    eintraege: liste,
    bett: uebernachtungAm(eintraege, datum),
    minuten,
    fuellung: liste.length === 0 ? 'leer' : liste.length === 1 ? 'kurz' : liste.length <= 3 ? 'gut' : 'voll',
  };
}

export function reisetagNummer(reise: Reise, datum: string): number {
  if (!gilt(reise.start_date) || !gilt(datum)) return 0;
  const d = abstandTage(reise.start_date, datum) + 1;
  return d > 0 ? d : 0;
}

export function reiseTage(reise: Reise): string[] {
  return tageListe(reise.start_date, reise.end_date);
}

/** Der laufende Tag, sonst der erste Tag der Reise */
export function heutigerTag(reise: Reise, heute: string): string | null {
  const tage = reiseTage(reise);
  if (!tage.length) return null;
  if (heute < tage[0]) return tage[0];
  if (heute > tage[tage.length - 1]) return tage[tage.length - 1];
  return heute;
}

export function laufend(reise: Reise, heute: string): boolean {
  if (!gilt(reise.start_date)) return false;
  const end = gilt(reise.end_date) ? reise.end_date : addTage(reise.start_date, 1);
  return heute >= reise.start_date && heute <= end;
}

export function vergangen(reise: Reise, heute: string): boolean {
  const end = gilt(reise.end_date) ? reise.end_date : reise.start_date;
  return !!end && heute > end;
}

export function inTagen(reise: Reise, heute: string): number | null {
  const start = reise.start_date;
  if (!gilt(start) || vergangen(reise, heute)) return null;
  return abstandTage(heute, start);
}

export interface Fortschritt {
  prozent: number;
  punkte: { label: string; ok: boolean }[];
}

/** Fünf Dinge machen eine Reise planbar – der Balken zählt sie eins zu eins */
export function planFortschritt(reise: Reise, eintraege: Eintrag[]): Fortschritt {
  const termine = gilt(reise.start_date) && gilt(reise.end_date) && reise.end_date >= reise.start_date;
  const tage = termine ? reiseTage(reise) : [];
  const beplant = tage.filter((d) => tagEintraege(eintraege, d).length > 0).length;
  const bettLücken = termine ? offeneNachte(reise, eintraege).length : tage.length;
  const aktivitaeten = eintraege.filter((e) => e.art === 'aktivitaet' && e.date).length;
  const punkte = [
    { label: 'Zeitraum', ok: termine },
    { label: 'Unterkunft für jede Nacht', ok: tage.length > 0 && bettLücken === 0 },
    { label: 'mindestens eine Aktivität pro Tag', ok: tage.length > 0 && beplant === tage.length },
    { label: 'mindestens drei Orte gesetzt', ok: aktivitaeten >= 3 },
    { label: 'Titelbild und Budget', ok: !!reise.cover_url && reise.budget !== null && reise.budget > 0 },
  ];
  return { prozent: Math.round((punkte.filter((p) => p.ok).length / punkte.length) * 100), punkte };
}

export interface Kosten {
  gesamt: number;
  gesamtProPerson: number;
  budget: number | null;
  offen: number | null;
  jeKategorie: { kategorie: string; label: string; icon: string; farbe: string; betrag: number }[];
  mitPreis: number;
  /** Beträge in einer anderen Währung als der Reise – sie bleiben aus der Summe draußen */
  fremde: { id: string; titel: string; text: string }[];
}

/** Die Währung über dem Preis, sonst die der Reise */
export function waehrungVon(e: Eintrag, reise: Reise): string {
  return (e.waehrung || reise.waehrung || 'EUR').toUpperCase();
}

export function preisText(e: Eintrag, reise: Reise): string {
  if (!e.preis) return '';
  return geld(e.preis, waehrungVon(e, reise));
}

/** Aufaddiert wird nur, was dieselbe Währung hat – Umrechnen ohne Kurs wäre erfunden */
export function kostenSumme(reise: Reise, eintraege: Eintrag[]): { gesamt: number; fremde: { id: string; titel: string; text: string }[] } {
  const daheim = (reise.waehrung || 'EUR').toUpperCase();
  let gesamt = 0;
  const fremde: { id: string; titel: string; text: string }[] = [];
  for (const e of eintraege) {
    if (!e.preis) continue;
    if (waehrungVon(e, reise) === daheim) gesamt += e.preis;
    else fremde.push({ id: e.id, titel: e.titel, text: `${geld(e.preis, waehrungVon(e, reise))} in ${waehrungVon(e, reise)}` });
  }
  return { gesamt: Math.round(gesamt * 100) / 100, fremde };
}

export function aufschluesselung(reise: Reise, eintraege: Eintrag[]): Kosten {
  const { gesamt, fremde } = kostenSumme(reise, eintraege);
  const daheim = (reise.waehrung || 'EUR').toUpperCase();
  const bepreiste = eintraege.filter((e) => e.preis && waehrungVon(e, reise) === daheim);
  const gruppen = new Map<string, number>();
  for (const e of bepreiste) {
    const schluessel = e.art === 'unterkunft' ? 'unterschlupf' : e.art === 'fahrt' ? 'transport' : e.kategorie ?? 'sonstiges';
    gruppen.set(schluessel, (gruppen.get(schluessel) ?? 0) + (e.preis ?? 0));
  }
  const jeKategorie = Array.from(gruppen.entries())
    .map(([id, betrag]) => {
      const k = kategorie(id);
      return { kategorie: id, label: k.label, icon: k.icon, farbe: k.farbe, betrag };
    })
    .sort((a, b) => b.betrag - a.betrag);
  const budget = reise.budget !== null && reise.budget > 0 ? reise.budget : null;
  const personen = Math.max(1, reise.personen || 1);
  return {
    gesamt,
    gesamtProPerson: gesamt / personen,
    budget,
    offen: budget === null ? null : budget - gesamt,
    jeKategorie,
    mitPreis: bepreiste.length + fremde.length,
    fremde,
  };
}

/** Nächte der Reise, gefärbt nach Unterkunft – die Zeile über dem Bett-Block */
export function naechte(reise: Reise, eintraege: Eintrag[]) {
  const tage = reiseTage(reise).slice(0, -1);
  return tage.map((datum) => {
    const bett = uebernachtungAm(eintraege, datum);
    return { datum, text: tagKurz(datum), bett, farbe: bett ? kategorie('unterschlupf').farbe : '#c9a227' };
  });
}

/** Ein Platz in der Tagesreihenfolge tauschen – gibt die betroffenen Zeilen zurück */
export function sortierungTauschen(liste: Eintrag[], vonId: string, richtung: -1 | 1): { id: string; sortierung: number }[] {
  const index = liste.findIndex((e) => e.id === vonId);
  const ziel = index + richtung;
  if (index < 0 || ziel < 0 || ziel >= liste.length) return [];
  const a = liste[index]!;
  const b = liste[ziel]!;
  return [
    { id: a.id, sortierung: b.sortierung },
    { id: b.id, sortierung: a.sortierung },
  ];
}

/** Neuer Eintrag oder Umzug an ein anderes Ende – die Sortierung hängt am Tag */
export function naechsteSortierung(eintraege: Eintrag[], datum: string): number {
  const amTag = eintraege.filter((e) => e.art !== 'unterkunft' && e.date === datum);
  return amTag.reduce((m, e) => Math.max(m, e.sortierung), 0) + 1;
}

/** Wie weit der Eintrag in der Liste nach oben/unten rutscht, ohne etwas zu überschreiben */
export function eintragVersetzen(liste: Eintrag[], id: string, zielIndex: number): { id: string; sortierung: number }[] {
  const index = liste.findIndex((e) => e.id === id);
  if (index < 0) return [];
  const ziel = Math.max(0, Math.min(liste.length - 1, zielIndex));
  if (ziel === index) return [];
  const neue = [...liste];
  const [bewegt] = neue.splice(index, 1);
  neue.splice(ziel, 0, bewegt!);
  const patches: { id: string; sortierung: number }[] = [];
  neue.forEach((e, i) => {
    if (e.sortierung !== i + 1) patches.push({ id: e.id, sortierung: i + 1 });
  });
  return patches;
}

/** Eintrag auf einen anderen Tag heben – Reihenfolge am neuen Tag ans Ende */
export function tagWechsel(eintraege: Eintrag[], id: string, datum: string): { id: string; date: string; sortierung: number } | null {
  const e = eintraege.find((x) => x.id === id);
  if (!e || e.date === datum) return null;
  return { id, date: datum, sortierung: naechsteSortierung(eintraege, datum) };
}
