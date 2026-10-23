/**
 * Vorleistung pro Kopf: ein Feld, mehrere Namen, Anteile wie im Leben verteilt.
 * Aufruf: npm run test:shares
 */
import { parseShares, settleUp, splitShares } from '../src/lib/shares.ts';

const errors: string[] = [];
const step = (name: string, ok: boolean, detail?: unknown) => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? ` → ${JSON.stringify(detail)}` : ''}`);
  if (!ok) errors.push(name);
};

step('ein Name = alles allein', parseShares('Satzi').join() === 'Satzi');
step('drei Namen = drei Anteile', parseShares('Satzi / Anna / Ben').join() === 'Satzi,Anna,Ben');
step('Leerzeichen drumherum sind egal', parseShares('  Satzi/Anna  ').join() === 'Satzi,Anna');
step('Komma und & gehen auch', parseShares('Satzi, Anna & Ben').join() === 'Satzi,Anna,Ben');
step('Name mit Leerzeichen bleibt ein Kopf', parseShares('Anna Maria / Satzi').join() === 'Anna Maria,Satzi');
step('leer bleibt leer', parseShares(null).length === 0 && parseShares('   ').length === 0);

{
  // 90 € von drei Köpfen getragen, Satzi hat zwei Anteile vorgestreckt
  const split = splitShares([{ payer: 'Satzi / Satzi / Anna', amount_eur: 90 }]);
  step('geteilt nach Anteilen', split.rows[0]?.who === 'Satzi' && split.rows[0]?.paid === 60, split.rows);
  step('der andere Kopf bekommt seinen Teil', split.rows[1]?.paid === 30, split.rows[1]);
  step('Anteile werden gezählt', split.rows[0]?.shares === 2 && split.rows[1]?.shares === 1, split.rows.map((r) => r.shares));
  step('Topf und Köpfe stimmen', split.pool === 90 && split.heads === 2, { pool: split.pool, heads: split.heads });
  step('Ausgleich: Anna gibt 15 € dazu', settleUp(split).some((l) => l.who === 'Anna' && l.diff === -15), settleUp(split));
  step('Satzi bekommt 15 € zurück', settleUp(split).some((l) => l.who === 'Satzi' && l.diff === 15), settleUp(split));
}
{
  const split = splitShares([
    { payer: 'Satzi', amount_eur: 40 },
    { payer: 'Anna', amount_eur: 20 },
    { payer: null, amount_eur: 7 },
    { payer: 'Satzi / Anna', amount_eur: 30 },
  ]);
  step('ohne Zahler wird nicht verteilt', split.unsplit.count === 1 && split.unsplit.amount === 7, split.unsplit);
  step('geteilte Ausgabe zählt halb', split.rows[0]?.paid === 55 && split.rows[1]?.paid === 35 && split.pool === 90, split.rows);
  step('Ausgleichtabelle rechnet auf 10 €', settleUp(split).some((l) => l.who === 'Satzi' && l.diff === 10), settleUp(split));
  const equal = splitShares([{ payer: 'Satzi / Anna', amount_eur: 60 }]);
  step('bei Gleichstand ist nichts auszugleichen', settleUp(equal).length === 0, settleUp(equal));
}
{
  const solo = splitShares([{ payer: 'Satzi', amount_eur: 100 }]);
  step('allein zahlen = kein Ausgleich', solo.pool === 100 && settleUp(solo).length === 0, settleUp(solo));
  step('null Beträge tauchen nicht auf', splitShares([{ payer: 'Satzi', amount_eur: 0 }]).rows.length === 0);
  const names = splitShares([{ payer: 'Bäriswyl / Anna-Lena', amount_eur: 50 }]).rows;
  step('Sonderzeichen im Namen bleiben heil', names.map((r) => r.who).join() === 'Anna-Lena,Bäriswyl' && names.every((r) => r.paid === 25), names);
}

console.log(errors.length ? `\n❌ ${errors.length} Probe(n) fehlgeschlagen\n` : '\n🎉 Vorleistung wird pro Kopf richtig geteilt\n');
if (errors.length) process.exit(1);
