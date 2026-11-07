import type { Schnappschuss } from './types';

/** Reisen als Datei sichern oder wieder hereinholen – ein Klick, kein Konto. */

export function exportiere(daten: Schnappschuss, name = 'reisen'): string {
  const text = JSON.stringify({ ...daten, exporting: new Date().toISOString() }, null, 2);
  if (typeof document !== 'undefined') {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const klick = document.createElement('a');
    klick.href = url;
    klick.download = `${name}.json`;
    klick.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  return text;
}

export async function liesDatei(datei: File): Promise<Schnappschuss | null> {
  try {
    const text = await datei.text();
    const paket = JSON.parse(text) as Partial<Schnappschuss>;
    if (!Array.isArray(paket.reisen)) return null;
    return { reisen: paket.reisen, eintraege: Array.isArray(paket.eintraege) ? paket.eintraege : [] };
  } catch {
    return null;
  }
}
