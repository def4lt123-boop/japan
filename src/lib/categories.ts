import type { BookingStatus, Place, Priority } from './types';

/** Kategorie-Bezeichnungen → Icon + Farbe für Liste, Karte und Übersicht */
const RULES: { test: RegExp; label: string; icon: string; color: string }[] = [
  { test: /freizeitpark|park.*disney|disney|universal|nintendo|nijigen|theme/i, label: 'Freizeitpark', icon: '🎢', color: '#f04e23' },
  { test: /tempel|schrein|shrine|jinja|torii| buddhist|kannon|dojo/i, label: 'Tempel & Schrein', icon: '⛩️', color: '#e0483d' },
  { test: /burg|castle|schloss|residenz/i, label: 'Burg & Schloss', icon: '🏯', color: '#b3742e' },
  { test: /bad|onsen|hot spring|ryokan|sentō|sento/i, label: 'Onsen & Bad', icon: '♨️', color: '#0ea5a4' },
  { test: /strand|beach|meer|sea|ocean|schnorchel|tauchen|dive|insel|island/i, label: 'Meer & Insel', icon: '🏝️', color: '#0ea3d9' },
  { test: /park|garten|garden|gyoen|korakuen|shibakoen|bambus|bamboo|see|lake/i, label: 'Parks & Gärten', icon: '🌳', color: '#4f9d5b' },
  { test: /museum|galerie|manga|anime|aquarium|kaiyukan|aussicht|view|tower|hochhaus|skytree|sky tree/i, label: 'Museum & Aussicht', icon: '🏛️', color: '#7c5cd6' },
  { test: /ramen|sushi|restaurant|cafe|café|essen|food|pancake|eis|ice|markt|market|kaiseki|izakaya|coffee/i, label: 'Essen & Cafés', icon: '🍜', color: '#e8912f' },
  { test: /shop|store|einkauf|kaufhaus|shopping|markt|don quijote|daiso|loft|hands|sekando|street.*gassen/i, label: 'Shoppen', icon: '🛍️', color: '#d64f9e' },
  { test: /nacht|club|bar|kabuki|izakaya|viertel|stadtteil|neighbourhood|neighborhood|crossing|kreuzung|strasse|straße/i, label: 'Stadtteile & Nachtleben', icon: '🏮', color: '#c2417f' },
  { test: /tattoo/i, label: 'Tattoo & Studio', icon: '💉', color: '#5c6ac4' },
  { test: /ausflug|tagausflug|trip|blick|fuji|berg|mountain|rokkō|rokko/i, label: 'Ausflüge & Natur', icon: '⛰️', color: '#2f8f6b' },
  { test: /hotel|übernachtung|unterkunft/i, label: 'Unterkunft', icon: '🏨', color: '#3f5f96' },
  { test: /transfer|flug|airport|haneda|narita|shinkansen|zug|bahn|fähre|ferry/i, label: 'Transport', icon: '🚄', color: '#6b7280' },
  { test: /suica|karte|ticket|sim|esim|pass|versicherung|apotheke|bank|automat/i, label: 'Organisation', icon: '🎫', color: '#8a8f98' },
];

export const FALLBACK = { label: 'Sonstiges', icon: '📍', color: '#94a3b8' };

export function categoryMeta(category?: string | null): { label: string; icon: string; color: string } {
  if (!category) return FALLBACK;
  const hit = RULES.find((r) => r.test.test(category));
  return hit ? { label: hit.label, icon: hit.icon, color: hit.color } : { ...FALLBACK, label: category };
}

/** Alle bekannten Kategorie-Vorschläge fürs Formular */
export const CATEGORY_SUGGESTIONS = Array.from(
  new Set([
    'Sehenswürdigkeit',
    'Tempel',
    'Schrein',
    'Burg',
    'Garten',
    'Park',
    'Museum',
    'Freizeitpark',
    'Aussichtspunkt',
    'Stadtteil',
    'Nachtleben',
    'Einkaufsstraße',
    'Shopping',
    'Restaurant',
    'Ramen',
    'Café',
    'Markt',
    'Onsen',
    'Strand',
    'Ausflug',
    'Wünscheliste',
    'Organisation',
    'Unterkunft',
    ...RULES.map((r) => r.label),
  ]),
).sort((a, b) => a.localeCompare(b, 'de'));

export const STATUS_META: Record<BookingStatus, { label: string; color: string; dot: string }> = {
  offen: { label: 'offen', color: 'text-slate-300 bg-slate-500/15 ring-slate-400/30', dot: '#94a3b8' },
  reserviert: { label: 'reserviert', color: 'text-amber-200 bg-amber-500/15 ring-amber-400/30', dot: '#f59e0b' },
  gebucht: { label: 'gebucht', color: 'text-emerald-200 bg-emerald-500/15 ring-emerald-400/30', dot: '#22c55e' },
  erledigt: { label: 'erledigt', color: 'text-sky-200 bg-sky-500/15 ring-sky-400/30', dot: '#38bdf8' },
};

export const PRIORITY_META: Record<Priority, { label: string; icon: string }> = {
  muss: { label: 'Muss', icon: '★' },
  soll: { label: 'Soll', icon: '☆' },
  kann: { label: 'Kann', icon: '·' },
};

/** Google-Maps-Link: bevorzugt Koordinaten, sonst Suchbegriff */
export function mapsUrl(place: Pick<Place, 'lat' | 'lng' | 'maps_query' | 'name' | 'city'>): string {
  if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  }
  const q = place.maps_query || `${place.name} ${place.city}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function routeUrl(place: Pick<Place, 'lat' | 'lng' | 'name' | 'city'>): string {
  if (typeof place.lat === 'number' && typeof place.lng === 'number') {
    return `https://www.google.com/maps/dir/?api=1&destination=${place.lat.toFixed(6)},${place.lng.toFixed(6)}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${place.name} ${place.city}`)}`;
}
