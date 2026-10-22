import type { Place } from './types';
import { categorizePlan } from './categories';

type PatchStore = {
  patchMany: (table: 'places', changes: { id: string; patch: Partial<Place> }[]) => Promise<void> | void;
  say: (msg: string) => void;
};

/**
 * „Kategorien ergänzen": gibt allen Aktivitäten, die keine oder einen Freitext
 * ohne Treffer haben, die passende Kategorie – der Rest bleibt unangetastet.
 * Gibt zurück, wie viele gesetzt wurden.
 */
export function applyCategories(store: PatchStore, places: Place[]): number {
  const plan = categorizePlan(places);
  if (!plan.length) {
    store.say('Jede Aktivität hat schon eine Kategorie, die wir kennen.');
    return 0;
  }
  void store.patchMany('places', plan.map((item) => ({ id: item.id, patch: { category: item.category } })));
  const offen = places.filter((p) => !plan.some((x) => x.id === p.id) && !(p.category ?? '').trim()).length;
  store.say(
    `${plan.length} ${plan.length === 1 ? 'Aktivität' : 'Aktivitäten'} kategorisiert${offen ? ` · ${offen} ohne Treffer – bitte selbst wählen` : ''}.`,
  );
  return plan.length;
}
