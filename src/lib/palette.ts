/**
 * Eine Farbe pro Unterkunft – der gleiche Schlüssel ergibt überall die gleiche Farbe
 * (Nächte-Check, Betten-Band, Tageskarte). Wirkt ohne Datenbank und ohne Konfiguration.
 */
export interface Tint {
  /** volle Farbe für Punkte und Ränder */
  base: string;
  /** weicher Hintergrund für Flächen */
  soft: string;
  /** heller Rand für die Oberkante */
  edge: string;
}

const shade = (key: string) => {
  let h = 7;
  for (const c of key) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (h * 47 + 18) % 360;
};

export function tintFor(key?: string | null, index?: number): Tint {
  const hue = key ? shade(key) : ((index ?? 0) * 47 + 18) % 360;
  return {
    base: `hsl(${hue} 58% 48%)`,
    soft: `hsl(${hue} 58% 48% / 0.16)`,
    edge: `hsl(${hue} 74% 66%)`,
  };
}
