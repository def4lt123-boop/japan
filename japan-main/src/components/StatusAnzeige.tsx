'use client';

import { useStore, type SpeicherZustand } from '../lib/daten';

/**
 * Ein Satz, kein Technik-Kram: „Datenbank verbunden", wenn die Nachfrage
 * geantwortet hat. Während des Prüfens sagt der Streifen nichts – eine
 * Behauptung wäre schlimmer als eine Pause.
 */

const TEXT: Record<SpeicherZustand, string> = {
  verbunden: 'Datenbank verbunden',
  gestoert: 'Datenbank nicht erreichbar',
  pruefen: '',
  kein_speicher: 'Auf diesem Gerät',
};

function farbe(zustand: SpeicherZustand): string {
  if (zustand === 'verbunden') return 'var(--gut)';
  if (zustand === 'gestoert') return 'var(--gefahr)';
  return 'var(--text3)';
}

export function StatusAnzeige({
  variant = 'chip',
  pruefen = false,
}: {
  /** `chip` neben einer Überschrift, `zeile` unten in der Seitenspalte */
  variant?: 'chip' | 'zeile';
  /** den Knopf zur erneuten Prüfung zeigen (nur wenn etwas nicht Reachbarkeit hat) */
  pruefen?: boolean;
}) {
  const store = useStore();
  const zustand = store.speicher.zustand;
  const text = TEXT[zustand];
  if (!text) return null;
  const fehler = zustand === 'gestoert';

  if (variant === 'zeile') {
    return (
      <p role="status" aria-live="polite" className="flex min-w-0 items-center gap-2 px-1 pb-1 text-[13px]" style={{ color: 'var(--text2)' }}>
        <span aria-hidden className="block h-2 w-2 shrink-0 rounded-full" style={{ background: farbe(zustand) }} />
        <span className="min-w-0 flex-1 truncate">{text}</span>
        {fehler && pruefen ? (
          <button type="button" className="chip !py-0.5 !text-[13px]" onClick={() => void store.speicherPruefen()}>
            erneut
          </button>
        ) : null}
      </p>
    );
  }

  return (
    <span
      role="status"
      aria-live="polite"
      className="chip !py-1"
      style={{ color: farbe(zustand), background: fehler ? 'var(--gefahr-fläche)' : undefined }}
    >
      <span aria-hidden className="block h-2 w-2 rounded-full" style={{ background: farbe(zustand) }} />
      {text}
      {fehler && pruefen ? (
        <button type="button" className="ml-1 underline" onClick={() => void store.speicherPruefen()}>
          erneut prüfen
        </button>
      ) : null}
    </span>
  );
}
