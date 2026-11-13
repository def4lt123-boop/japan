/**
 * Kategorien – eine Liste, ein Icon, eine Farbe. Sie steht für die Auswahl im
 * Formular, den Punkt in der Liste, die Farbe im Kalender und die Legende auf
 * der Karte, damit überall dasselbe Bild entsteht.
 */

export interface Kategorie {
  id: string;
  label: string;
  icon: string;
  farbe: string;
  /** Wörter, die beim Tippen für diese Kategorie sprechen */
  worter: string[];
}

export const KATEGORIEN: Kategorie[] = [
  { id: 'sehenswuerdigkeit', label: 'Sehenswürdigkeit', icon: '🏛️', farbe: '#e2574c', worter: ['temple', 'tempel', 'shrine', 'schrein', 'heiligtum', 'castle', 'schloss', 'burg', 'festung', 'ruine', 'dom', 'kathedrale', 'kirche', 'kapelle', 'moschee', 'palast', 'villa', 'monument', 'denkmal', 'tower', 'turm', 'brücke', 'platz', 'square', 'sehenswürdigkeit', 'aussicht'] },
  { id: 'restaurant', label: 'Essen & Trinken', icon: '🍜', farbe: '#e08a2e', worter: ['restaurant', 'cafe', 'café', 'bistro', 'bar', 'izakaya', 'ramen', 'sushi', 'pizzeria', 'kantine', 'frühstück', 'bäckerei', 'brauerei', 'diner', 'coffee', 'speise'] },
  { id: 'museum', label: 'Museum & Ausstellung', icon: '🖼️', farbe: '#8b5cf6', worter: ['museum', 'galerie', 'gallery', 'ausstellung', 'expo', 'aquarium', 'zoo', 'theater', 'oper', 'kino', 'cinema', 'halle'] },
  { id: 'ausflug', label: 'Ausflug', icon: '🚌', farbe: '#2f8f9d', worter: ['tour', 'ausflug', 'exkursion', 'boot', 'fähre', ' ferry', 'day trip', 'bus', 'heli', 'segway', 'guid'] },
  { id: 'freizeit', label: 'Freizeit', icon: '🎢', farbe: '#d6478f', worter: ['park', 'theme', 'freizeitbad', 'schwimmbad', 'pool', 'bad', 'spa', 'onsen', 'sauna', 'fitness', 'golf', 'kletter', 'bowling', 'karaoke', 'disco', 'club'] },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', farbe: '#c2418b', worter: ['shop', 'store', 'markt', 'market', 'boutique', 'kaufhaus', 'department', 'outlet', 'souvenir', 'laden', 'straße'] },
  { id: 'strand', label: 'Strand & Wasser', icon: '🏖️', farbe: '#0ea5b7', worter: ['beach', 'strand', 'bucht', 'bay', 'see', 'lake', 'wasserfall', 'waterfall', 'meer', 'küste', 'coast', 'schnorchel', 'tauch'] },
  { id: 'wanderung', label: 'Wanderung', icon: '🥾', farbe: '#4c9a3f', worter: ['trail', 'wander', 'hike', 'berg', 'gipfel', 'mountain', 'parkweg', 'aussicht', 'viewpoint', 'lookout', 'pfad'] },
  { id: 'natur', label: 'Natur & Park', icon: '🌿', farbe: '#2f855a', worter: ['garden', 'garten', 'park', 'wald', 'forest', 'natur', 'reservat', 'botanic', 'blume', 'kirsch', 'maple', 'wiese'] },
  { id: 'transport', label: 'Transport', icon: '🚆', farbe: '#4a6b8a', worter: ['bahnhof', 'station', 'train', 'zug', 'shinkansen', 'subway', 'metro', 'u-bahn', 'bus', 'airport', 'flughafen', 'flug', 'port', 'hafen', 'taxi', 'transfer', 'maut'] },
  { id: 'unterschlupf', label: 'Unterkunft', icon: '🏨', farbe: '#6d5bd0', worter: ['hotel', 'hostel', 'ryokan', 'guesthouse', 'apartment', 'feri', 'resort', 'pension', 'hütte', 'camping', 'airbnb', 'inn', 'lodge'] },
  { id: 'sonstiges', label: 'Sonstiges', icon: '📍', farbe: '#7b8494', worter: [] },
];

const DURCH_NAME = new Map(KATEGORIEN.map((k) => [k.id, k]));

export const ANDERE_KATEGORIEN = KATEGORIEN.filter((k) => k.id !== 'unterschlupf');

export function kategorie(id: string | null | undefined): Kategorie {
  return DURCH_NAME.get(id ?? '') ?? DURCH_NAME.get('sonstiges')!;
}

/** Die Kategorie, die der Text nahelegt – automatische Vorauswahl im Formular */
export function kategorieVorschlag(...texte: (string | null | undefined)[]): string {
  const heu = texte
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (!heu.trim()) return 'sonstiges';
  let treffer: { id: string; punkte: number } | null = null;
  for (const k of KATEGORIEN) {
    for (const wort of k.worter) {
      const w = wort.trim();
      if (!w || !heu.includes(w)) continue;
      const punkte = w.length;
      if (!treffer || punkte > treffer.punkte) treffer = { id: k.id, punkte };
    }
  }
  return treffer?.id ?? 'sonstiges';
}

export const ART_META: Record<string, { label: string; Icon: string; wort: string; viele: string }> = {
  aktivitaet: { label: 'Aktivität', Icon: '📍', wort: 'Aktivität', viele: 'Aktivitäten' },
  unterkunft: { label: 'Unterkunft', Icon: '🛏️', wort: 'Unterkunft', viele: 'Unterkünfte' },
  fahrt: { label: 'Fahrt', Icon: '🧳', wort: 'Fahrt', viele: 'Fahrten' },
};

export function artMeta(art: string | null | undefined) {
  return ART_META[art ?? 'aktivitaet'] ?? ART_META.aktivitaet!;
}
