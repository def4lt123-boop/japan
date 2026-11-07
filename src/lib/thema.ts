/**
 * Das Licht der App. Gespeichert bei den Einstellungen, entschieden vor dem
 * ersten Bild: ein kurzes Skript in der Wurzel liest denselben Wert und setzt
 * das Attribut an `<html>`, damit nichts weiß aufblitzt. Diese Datei hält, was
 * davon zu rechnen ist – ohne Dokument, damit es sich prüfen lässt.
 */

export type Licht = 'hell' | 'dunkel';
export type Wunsch = Licht | 'auto';

export const THEMA_ATTRIBUTE = 'data-thema';

/** 'auto' folgt dem Gerät, alles andre ist gesagt – der eine Ort dieser Regel */
export function lichtWert(wunsch: Wunsch | undefined, bevorzugtDunkel: boolean): Licht {
  if (wunsch === 'hell' || wunsch === 'dunkel') return wunsch;
  return bevorzugtDunkel ? 'dunkel' : 'hell';
}

export const LICHT_OPTIONEN: { id: Wunsch; label: string; zeichen: string }[] = [
  { id: 'hell', label: 'Hell', zeichen: '☀️' },
  { id: 'dunkel', label: 'Dunkel', zeichen: '🌙' },
  { id: 'auto', label: 'Wie Gerät', zeichen: '🌗' },
];

/** Der Sprung ins Dokument – hier, nicht im Blatt, damit ein setter zwei wirkungen hat */
export function wendeAn(wunsch: Wunsch): void {
  if (typeof document === 'undefined') return;
  const bevorzugtDunkel = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)').matches : false;
  const licht = lichtWert(wunsch, bevorzugtDunkel);
  const wurzel = document.documentElement;
  wurzel.setAttribute(THEMA_ATTRIBUTE, licht);
  // felder, scrollbalken und die kopfleiste ziehen mit
  wurzel.style.colorScheme = licht;
  const farbe = document.querySelector('meta[name="theme-color"]');
  farbe?.setAttribute('content', licht === 'dunkel' ? '#0e1218' : '#f4f6f9');
}
