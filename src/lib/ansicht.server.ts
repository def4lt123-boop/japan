/**
 * Das schloss vor der seite – ein passwort, kein benutzername.
 *
 * Die seite ist zum ansehen gedacht: wer das wort kennt, liest den plan. Geprüft
 * wird nur hier, auf dem server; das wort selbst geht in keinen bruchteil des
 * bündels, das im blatt landet. Der cookie trägt deshalb nur die wurzel des
 * passwortes, nicht das passwort – und die seite nennt keine anleitung, kein
 * field für einen namen, keinen hinweis darauf, wie das schloss gebaut ist.
 */

export const ANSICHT_COOKIE = 'plan-ansicht';
export const ANSICHT_DAUER = 60 * 60 * 24 * 30;

const WURZEL_SALT = 'plan-ansicht';

/** das wort, das die tür aufmacht – gesetzt wird es über die umgebung, sonst gilt das kurze */
function passwort(): string {
  return process.env.ANSICHT_PASSWORT || '170493';
}

/** sha-256 als hex – dieselbe rechnung für cookie-wert und vergleich */
export async function wurzel(text: string): Promise<string> {
  const daten = new TextEncoder().encode(`${text}:${WURZEL_SALT}`);
  const wert = await crypto.subtle.digest('SHA-256', daten);
  return [...new Uint8Array(wert)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** der wert, der in den cookie gehört */
export async function ansichtWert(): Promise<string> {
  return wurzel(passwort());
}

/** passt das eingegebene wort? verglichen wird in festzeit, über die hex-zeichen */
export async function passtDas(eingegeben: string): Promise<boolean> {
  const [a, b] = await Promise.all([wurzel(eingegeben), wurzel(passwort())]);
  if (a.length !== b.length) return false;
  let unterschied = 0;
  for (let i = 0; i < a.length; i += 1) unterschied |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return unterschied === 0;
}

/** ist dieses blatt aufgeschlossen? der cookie trägt die wurzel des wortes */
export async function aufgesperrt(wert: string | undefined | null): Promise<boolean> {
  if (!wert) return false;
  return wert === (await ansichtWert());
}

/** wohin nach dem aufschließen – nur wege innerhalb der seite */
export function zielSichern(von: string | null | undefined, fallback = '/'): string {
  const text = (von ?? '').trim();
  if (!text.startsWith('/') || text.startsWith('//')) return fallback;
  return text.slice(0, 200);
}
