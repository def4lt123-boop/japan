/**
 * Die zwei Tabellen der App – bewusst klein gehalten, damit sich alles daran
 * hängen lässt. Feldnamen sind identisch zu den Spalten in supabase/schema.sql,
 * dadurch braucht es keine Mapping-Schicht.
 *
 * Ein Eintrag ist alles, was in einem Kalender steht: eine Aktivität, eine
 * Unterkunft (mehrere Tage) oder eine Fahrt. Die Art entscheidet, wie sie
 * angezeigt wird – nicht drei Tabellen, die zusammengehalten werden müssen.
 */

export type EintragArt = 'aktivitaet' | 'unterkunft' | 'fahrt';

export interface Reise {
  id: string;
  /** „Herbst in Andalusien" */
  name: string;
  land: string | null;
  /** Reiseziele der Reihe nach, mit „ · " getrennt – „Sevilla · Granada" */
  stationen: string | null;
  start_date: string | null;
  end_date: string | null;
  /** Titelbild, automatisch gefunden oder eigenen Links */
  cover_url: string | null;
  cover_credit: string | null;
  beschreibung: string | null;
  budget: number | null;
  /** ISO-Code, „EUR" */
  waehrung: string;
  personen: number;
  archived: boolean;
  erstellt_am?: string;
}

export interface Eintrag {
  id: string;
  reise_id: string;
  art: EintragArt;
  /** Schlüssel aus src/lib/kategorien.ts */
  kategorie: string | null;
  /** Name des Ortes bzw. der Unterkunft oder Fahrt */
  titel: string;
  /** Aktivität/Fahrt: der Tag · Unterkunft: der Check-in */
  date: string | null;
  /** Aktivität/Fahrt: Beginn · Unterkunft: Check-in-Zeit */
  zeit: string | null;
  /** Aktivität: Ende · Unterkunft: Check-out-Zeit */
  bis_zeit: string | null;
  dauer_min: number | null;
  /** Nur Unterkunft: der Check-out-Tag – bis dahin gilt sie für jede Nacht */
  bis_date: string | null;
  ort: string | null;
  adresse: string | null;
  lat: number | null;
  lng: number | null;
  /** Suchbegriff für Google Maps, solange kein Punkt gesetzt ist */
  karten_stichwort: string | null;
  notiz: string | null;
  preis: number | null;
  /** eigene Währung über dem Preis – leer heißt: die der Reise */
  waehrung: string | null;
  /** Buchungsnummer oder Referenz */
  buchung_nr: string | null;
  buchung_url: string | null;
  foto_url: string | null;
  /** Lizenzpflichtige Bilder (Wikimedia) brauchen den Nachweis am Bild */
  foto_nachweis: string | null;
  sortierung: number;
  erstellt_am?: string;
}

export interface Schnappschuss {
  reisen: Reise[];
  eintraege: Eintrag[];
}

export interface Einstellungen {
  /** wie die App den Nutzer anspricht */
  name: string | null;
  waehrung: string;
  personen: number;
  /** Bilder beim Anlegen automatisch suchen */
  bilder: boolean;
  /** zuletzt geöffnete Reise – davon handeln „Kalender" und „Karte" in der Leiste */
  aktive_reise: string | null;
}

/** Was ein Ortssucher zurückgibt – Punkt und Name wandern together in den Eintrag */
export interface Ortsvorschlag {
  name: string;
  adresse: string | null;
  lat: number;
  lng: number;
  stichwort: string | null;
  quelle: 'google' | 'openstreetmap' | 'photon' | 'geonames';
  /** Google: die Place-ID des Ortes – der Treffer ist dann genau dieses Ding auf der Karte */
  google_id?: string;
  /** Google: ein Foto des Ortes samt Nachweis, gleich mit dem Treffer geliefert */
  foto?: { url: string; nachweis: string | null } | null;
}

export interface Bildvorschlag {
  url: string;
  nachweis: string | null;
  quelle: string;
}
