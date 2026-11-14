/**
 * Google liefert eine Strecke als „encoded polyline“: Zahlenfolgen in einem Text,
 * jede als Unterschied zur vorigen, auf fünf Stellen gerundet. Hier wird daraus
 * die Liste von [lat, lng], die die Karte zeichnet. Rein gerechnet, ohne Netz.
 */
export function linieAusText(text: string | null | undefined, hoechstens = 1500): [number, number][] {
  const roh = text ?? '';
  const punkte: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const zahl = (): number | null => {
    let ergebnis = 0;
    let schub = 0;
    let byte: number;
    do {
      if (index >= roh.length) return null;
      byte = roh.charCodeAt(index) - 63;
      index += 1;
      ergebnis |= (byte & 0x1f) << schub;
      schub += 5;
    } while (byte >= 0x20 && schub < 35);
    return ergebnis & 1 ? ~(ergebnis >> 1) : ergebnis >> 1;
  };
  while (index < roh.length) {
    const dLat = zahl();
    const dLng = zahl();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    punkte.push([lat / 1e5, lng / 1e5]);
  }
  if (punkte.length <= hoechstens) return punkte;
  // eine lange Strecke wird ausgedünnt, Anfang und Ende bleiben
  const schritt = Math.ceil(punkte.length / hoechstens);
  return punkte.filter((_, i) => i % schritt === 0 || i === punkte.length - 1);
}
