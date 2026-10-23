/**
 * „Wer war in Vorleistung?“ – ein Feld, mehrere Köpfe.
 *
 * Namen durch `/` trennen (Komma, `&` und `+` gehen auch). Wer zwei Anteile trug,
 * nennt sich zweimal: `Satzi / Satzi / Anna` auf 90 € sind 60 € für Satzi und 30 € für Anna.
 * Ein Name allein = alles allein vorgestreckt. Eine Ausgabe ohne Zahler bleibt aus der
 * Rechnung draußen und wird separat gemeldet.
 */
export interface ShareRow {
  who: string;
  /** vorgestreckt */
  paid: number;
  /** Anteile, die diese Person hält */
  shares: number;
}

export interface SplitResult {
  rows: ShareRow[];
  /** Summe der Ausgaben mit Zahler */
  pool: number;
  /** Köpfe, die in der Rechnung vorkommen */
  heads: number;
  /** was ohne Zahler blieb */
  unsplit: { count: number; amount: number };
}

/** `Satzi / Satzi / Anna` → ['Satzi','Satzi','Anna'] – Reihenfolge und Leerzeichen egal */
export function parseShares(payer?: string | null): string[] {
  return (payer ?? '')
    .split(/\s*[/,;&+]\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function splitShares(expenses: { payer?: string | null; amount_eur?: number | null }[]): SplitResult {
  const paid = new Map<string, number>();
  const held = new Map<string, number>();
  let pool = 0;
  let unsplitCount = 0;
  let unsplitAmount = 0;

  for (const e of expenses) {
    const amount = Number(e.amount_eur) || 0;
    if (!amount) continue;
    const names = parseShares(e.payer);
    if (!names.length) {
      unsplitCount += 1;
      unsplitAmount += amount;
      continue;
    }
    pool += amount;
    const each = amount / names.length;
    for (const name of names) {
      paid.set(name, (paid.get(name) ?? 0) + each);
      held.set(name, (held.get(name) ?? 0) + 1);
    }
  }

  const rows: ShareRow[] = Array.from(paid.entries())
    .map(([who, value]) => ({ who, paid: Math.round(value * 100) / 100, shares: held.get(who) ?? 0 }))
    .sort((a, b) => b.paid - a.paid || a.who.localeCompare(b.who, 'de'));

  return { rows, pool: Math.round(pool * 100) / 100, heads: rows.length, unsplit: { count: unsplitCount, amount: Math.round(unsplitAmount * 100) / 100 } };
}

/** Was jede Person dazugeben muss (positiv = zurückbekommen) – gleiche Anteile für alle Köpfe */
export function settleUp(result: SplitResult): { who: string; diff: number }[] {
  if (!result.heads) return [];
  const fair = result.pool / result.heads;
  return result.rows
    .map((r) => ({ who: r.who, diff: Math.round((r.paid - fair) * 100) / 100 }))
    .filter((r) => Math.abs(r.diff) > 0.5)
    .sort((a, b) => b.diff - a.diff);
}
