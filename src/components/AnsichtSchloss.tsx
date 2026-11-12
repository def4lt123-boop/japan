'use client';

import { useState } from 'react';
import { Karten, MadeByFlo, TextFeld } from './ui';

/**
 * Das feld vor der seite: ein passwort, sonst nichts. Nach einem namen wird nicht
 * gefragt, hier gibt es nichts anzulegen und nichts zu löschen – wer das wort von
 * Flo hat, liest den plan, und wer es nicht hat, sieht nur diese karte. Was ins
 * feld getippt wird, steht in diesem blatt nirgends, aus dem man es hätte ablesen
 * können.
 */
export function AnsichtSchloss({ von }: { von: string }) {
  const [wort, setWort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [am, setAm] = useState(false);

  async function eintreten() {
    const text = wort.trim();
    if (!text || am) return;
    setAm(true);
    setFehler(null);
    try {
      const antwort = await fetch('/api/ansicht', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ passwort: text, von }),
      });
      const daten = (await antwort.json().catch(() => null)) as { ok?: boolean; von?: string; grund?: string } | null;
      if (!antwort.ok || !daten?.ok) {
        setFehler(daten?.grund ?? 'Das Passwort wurde nicht angenommen.');
        setWort('');
        setAm(false);
        return;
      }
      // ein ganzer neuladungsweg: die tür sitzt vorn an der seite, und die soll beim
      // ersten bild schon offen sein – kein flackern zwischen zwei zuständen
      window.location.replace(daten.von ?? von ?? '/');
    } catch {
      setFehler('Die Seite hat nicht geantwortet – noch einmal versuchen.');
      setAm(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-sm items-center px-4 py-8">
      <Karten className="w-full p-4">
        <span className="grid h-11 w-11 place-items-center rounded-xl text-[20px]" style={{ background: 'var(--akzent)', color: 'var(--auf-akzent)' }} aria-hidden>
          🧭
        </span>
        <h1 className="mt-2.5 text-[19px] font-semibold leading-snug">Zum Ansehen</h1>
        <p className="mikro mt-1">Gib das Passwort ein, das du von Flo bekommen hast.</p>
        <form
          className="mt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void eintreten();
          }}
        >
          <TextFeld
            label="Passwort"
            wert={wort}
            beimAendern={(t) => {
              setWort(t);
              if (fehler) setFehler(null);
            }}
            typ="password"
            eingabeModus="numeric"
            platzhalter="••••••"
            autoVeroellstaendigen="off"
            fehler={fehler ?? undefined}
          />
          <button type="submit" className="knopf mt-3 w-full" disabled={am}>
            {am ? 'wird geprüft …' : 'ansehen'}
          </button>
        </form>
      </Karten>
      <MadeByFlo className="mt-3 w-full text-center" />
    </div>
  );
}
