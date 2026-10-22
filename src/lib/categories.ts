import type { BookingStatus, Place, Priority, TicketStatus } from './types';

/** Kategorie-Bezeichnungen → Icon + Farbe für Liste, Karte und Übersicht */
const RULES: { test: RegExp; label: string; icon: string; color: string }[] = [
  { test: /freizeitpark|park.*disney|disney|universal|nintendo|nijigen|theme/i, label: 'Freizeitpark', icon: '🎢', color: '#ff7a18' },
  { test: /tempel|schrein|shrine|jinja|torii| buddhist|kannon|dojo/i, label: 'Tempel & Schrein', icon: '⛩️', color: '#e01e2b' },
  { test: /burg|castle|schloss|residenz/i, label: 'Burg & Schloss', icon: '🏯', color: '#8d6a46' },
  { test: /bad|onsen|hot spring|ryokan|sentō|sento/i, label: 'Onsen & Bad', icon: '♨️', color: '#1fc8c8' },
  { test: /strand|beach|meer|sea|ocean|schnorchel|tauchen|dive|insel|island/i, label: 'Meer & Insel', icon: '🏝️', color: '#1989f9' },
  { test: /park|garten|garden|gyoen|korakuen|shibakoen|bambus|bamboo|see|lake/i, label: 'Parks & Gärten', icon: '🌳', color: '#3fbb3a' },
  { test: /museum|galerie|manga|anime|aquarium|kaiyukan|aussicht|view|tower|hochhaus|skytree|sky tree/i, label: 'Museum & Aussicht', icon: '🏛️', color: '#c45cf4' },
  { test: /ramen|sushi|restaurant|cafe|café|essen|food|pancake|\beis|\bice|markt|market|kaiseki|izakaya|coffee/i, label: 'Essen & Cafés', icon: '🍜', color: '#ffd21f' },
  { test: /shop|store|einkauf|kaufhaus|shopping|markt|don quijote|daiso|loft|hands|sekando|street.*gassen/i, label: 'Shoppen', icon: '🛍️', color: '#d6336c' },
  { test: /nacht|club|bar|kabuki|izakaya|viertel|stadtteil|neighbourhood|neighborhood|crossing|kreuzung|strasse|straße/i, label: 'Stadtteile & Nachtleben', icon: '🏮', color: '#f90695' },
  { test: /tattoo/i, label: 'Tattoo & Studio', icon: '✒️', color: '#7a1f3d' },
  { test: /ausflug|ausflüg|tagausflug|trip|blick|fuji|berg|mountain|rokkō|rokko|\bnatur\b/i, label: 'Ausflüge & Natur', icon: '⛰️', color: '#12875b' },
  { test: /hotel|übernachtung|unterkunft/i, label: 'Unterkunft', icon: '🏨', color: '#6c4df0' },
  { test: /transport|transfer|flug|airport|haneda|narita|shinkansen|zug|bahn|bahnhof|fähre|ferry|fahrplan/i, label: 'Transport', icon: '🚄', color: '#1b5689' },
  { test: /organisation|orga\b|suica|ic-karte|karte|ticket|sim|esim|pass|versicherung|apotheke|bank|automat|gepäck|locker|wlan|wifi/i, label: 'Organisation', icon: '🗂️', color: '#dcd3b4' },
];

export const FALLBACK = { label: 'Sonstiges', icon: '📍', color: '#8b93a1' };

export function categoryMeta(category?: string | null): { label: string; icon: string; color: string } {
  if (!category) return FALLBACK;
  const hit = RULES.find((r) => r.test.test(category));
  return hit ? { label: hit.label, icon: hit.icon, color: hit.color } : { ...FALLBACK, label: category };
}


/** Die festen Kategorien – Reihenfolge = Reihenfolge im Dropdown */
export const CATEGORY_LABELS = [...RULES.map((r) => r.label), FALLBACK.label];

export type CategoryOption = { value: string; label: string; icon: string };

/** Value = Kategorie, Label mit Symbol fürs Dropdown; eigene Werte aus der Reise bleiben erhalten */
export function categoryOptions(used: (string | null)[] = []): CategoryOption[] {
  const extras = Array.from(new Set(used.map((u) => (u ?? '').trim()).filter((u) => u && !CATEGORY_LABELS.includes(u)))).sort((a, b) => a.localeCompare(b, 'de'));
  return [...CATEGORY_LABELS, ...extras].map((label) => {
    const rule = RULES.find((r) => r.test.test(label));
    return { value: label, label, icon: rule?.icon ?? FALLBACK.icon };
  });
}

/**
 * Raten, wohin ein Punkt gehört – erst die Kategorie selbst, dann Name, Notiz und
 * Stadtteil. Die Suchwörter sind absichtlich grob: lieber ein klarer Treffer pro
 * Regel als Raterei, und was nicht passt, bleibt unangetastet.
 */
const GUESS: { label: string; test: RegExp }[] = [
  { label: 'Freizeitpark', test: /disney|universal|usj|nintendo|nijigen|legoland|space world|theme ?park|freizeitpark/i },
  { label: 'Tempel & Schrein', test: /tempel|schrein|shrine|jinja|jingū|taisha|torii|\b[a-zäöüōû]{2,}-(?:ji|dera)\b|\bdera\b|kannon|kwanon|buddh|dojo|kiyomizu|hasedera|senso|sensō|tōdai|fushimi|kasuga/i },
  { label: 'Burg & Schloss', test: /burg|castle|schloss|residenz|\bjō\b|\bjo\b-?park/i },
  { label: 'Onsen & Bad', test: /onsen|sentō|sento|hot ?spring|\bbad\b|dōgo|dogo|schwitz|sauna|♨|ryokan.*bad|yudōmari|yunishik/i },
  { label: 'Meer & Insel', test: /strand|beach|\bumi\b|meer|sea|ocean|insel|island|schnorchel|snorkel|tauchen|\bdive|aoshima|yakushima.*meer/i },
  { label: 'Parks & Gärten', test: /park|garten|garden|kōen|koen|bambus|bamboo|\bkyu\b|korakuen|kenrokuen|kairakuen|shukkei|rikugien|koishikawa|shibakoen|\bsee\b|lake|teich|\bgarden/i },
  { label: 'Museum & Aussicht', test: /museum|galerie|gallery|aquarium|kaiyukan|aussicht|view ?point|\bview\b|tower|skytree|sky tree|hochhaus|aussichtsturm|planetar|manga|anime|observ/i },
  { label: 'Essen & Cafés', test: /ramen|sushi|izakaya|cafe|café|kissaten|coffee|restaurant|pancake|waffle|\beis|\beiscreme|ice ?cream|\bessen\b|food|kaiseki|obanzai|yakitori|tonkatsu|udon|soba|curry|donburi|depachika|markt|market|ameyoko|nishiki/i },
  { label: 'Shoppen', test: /shop\b|store\b|einkauf|kaufhaus|department|don ?qui|donsoki|daiso|\bloft\b|hands|todoroki?|sekando|100-?shop|konbini|conbini|outlet|gassen.*kauf|shinsaibashi/i },
  { label: 'Stadtteile & Nachtleben', test: /viertel|stadtteil|old town|altstadt|gasse|gassen|straße|strasse|\bdōri\b|\bdori\b|crossing|kreuzung|nachtleben|bei nacht|\bnacht\b|kabukicho|gion|pontochō|pontocho|shinsekai|d[ōo]tonbori|neon|\bbar\b|club|\bkabuki\b|kanal|canal|nachtsmarkt/i },
  { label: 'Tattoo & Studio', test: /tattoo|piercing|schmuck.*atelier|ringe selber|workshop.*ring/i },
  { label: 'Ausflüge & Natur', test: /ausflug|ausflüg|tagausflug|\b_trip\b|blick|fuji|\bberg\b|mountain|\bmount\b|rokkō|rokko|wasserfall|waterfall|schlucht|gorge|\bdüne|dune|düne|dünen|\bdunes?\b|wüste|desert|vulkan|nationalpark|seilbahn|sessellift|ropeway|\bnatur\b/i },
  { label: 'Unterkunft', test: /hotel|ryokan|minshuku|hostel|guest ?house|übernachtung|unterkunft/i },
  { label: 'Transport', test: /transfer|flug|airport|haneda|narita|shinkansen|\bzug\b|bahn|bahnhof|station|fähre|ferry|bus\b/i },
  { label: 'Organisation', test: /suica|ic-karte|\bsim\b|esim|wifi|wlan|versicherung|apotheke|bank\b|automat|gepäck|locker|ticket|pass\b|schalter/i },
];

/** Zuordnung anhand des Texts – gibt die feste Kategorie zurück oder null */
export function guessCategory(place: { name?: string | null; category?: string | null; notes?: string | null; district?: string | null; city?: string | null }): string | null {
  const own = (place.category ?? '').trim();
  if (own) {
    const hit = RULES.find((r) => r.test.test(own));
    if (hit) return hit.label;
  }
  // erst der Name (das ist die klare Aussage), dann Notiz und Stadtteil
  const name = (place.name ?? '').trim();
  const byName = name ? GUESS.find((g) => g.test.test(name)) : undefined;
  if (byName) return byName.label;
  const hay = [place.notes, place.district, place.city, place.category, name].filter(Boolean).join(' ');
  const byNotes = GUESS.find((g) => g.test.test(hay));
  return byNotes ? byNotes.label : null;
}

/**
 * Was die Kategorie noch braucht: leer oder ein Freitext aus der Tabelle, den keine
 * Regel kennt. Alles andere lassen wir in Ruhe – „Wasserkanäle im Altstadtdorf" ist
 * eine Notiz, die man nicht wegklicken will.
 */
export function needsCategory(place: { category?: string | null }): boolean {
  const own = (place.category ?? '').trim();
  if (!own) return true;
  // wer bewusst „Sonstiges“ gewählt hat, wird nicht nochmal umgeräumt
  if (own === FALLBACK.label) return false;
  return !RULES.some((r) => r.test.test(own));
}

/** Planung für „alle kategorisieren" – nur Treffer landen drin, der Rest bleibt wie er ist */
export function categorizePlan(places: { id: string; name?: string | null; category?: string | null; notes?: string | null; district?: string | null; city?: string | null }[]): { id: string; name: string; category: string }[] {
  const out: { id: string; name: string; category: string }[] = [];
  for (const p of places) {
    if (!needsCategory(p)) continue;
    const guess = guessCategory(p);
    if (guess && guess !== FALLBACK.label) out.push({ id: p.id, name: p.name ?? '', category: guess });
  }
  return out;
}

export const STATUS_META: Record<BookingStatus, { label: string; color: string; dot: string }> = {
  offen: { label: 'offen', color: 'text-slate-300 bg-slate-500/15 ring-slate-400/30', dot: '#94a3b8' },
  reserviert: { label: 'reserviert', color: 'text-amber-200 bg-amber-500/15 ring-amber-400/30', dot: '#f59e0b' },
  gebucht: { label: 'gebucht', color: 'text-emerald-200 bg-emerald-500/15 ring-emerald-400/30', dot: '#22c55e' },
  erledigt: { label: 'erledigt', color: 'text-sky-200 bg-sky-500/15 ring-sky-400/30', dot: '#38bdf8' },
};

/** Ticket-Frage pro Ort – ein Klick auf den Chip schaltet weiter */
export const TICKET_META: Record<TicketStatus, { label: string; short: string; icon: string; chip: string; dot: string }> = {
  unklar: { label: 'Ticket noch ungeklärt', short: 'Ticket?', icon: '🎟️', chip: 'bg-white/[0.05] text-slate-400 ring-white/10', dot: '#94a3b8' },
  noetig: { label: 'Ticket nötig – noch nicht gekauft', short: 'Ticket offen', icon: '🎟️', chip: 'bg-shu-500/15 text-shu-100 ring-shu-400/40', dot: '#f04e23' },
  gekauft: { label: 'Ticket gekauft', short: 'Ticket ✓', icon: '✅', chip: 'bg-emerald-500/15 text-emerald-100 ring-emerald-400/40', dot: '#22c55e' },
  keins: { label: 'Hier braucht man kein Ticket', short: 'kein Ticket', icon: '🚪', chip: 'bg-white/[0.05] text-slate-300 ring-white/10', dot: '#64748b' },
};

export const TICKET_ORDER: TicketStatus[] = ['unklar', 'noetig', 'gekauft', 'keins'];

export function nextTicket(current?: TicketStatus | null): TicketStatus {
  const i = TICKET_ORDER.indexOf((current ?? 'unklar') as TicketStatus);
  return TICKET_ORDER[(i + 1) % TICKET_ORDER.length];
}

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
