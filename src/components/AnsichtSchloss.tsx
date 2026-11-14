'use client';

import { useState } from 'react';
import { Karten, MadeByFlo } from './ui';

/**
 * Das feld vor der seite: ein passwort, sonst nichts. Nach einem namen wird nicht
 * gefragt, hier gibt es nichts anzulegen und nichts zu löschen – wer das wort von
 * Flo hat, liest den plan, und wer es nicht hat, sieht nur diese karte. Was ins
 * feld getippt wird, steht in diesem blatt nirgends, aus dem man es hätte ablesen
 * können.
 *
 * Von oben nach unten, in einer mittigen spalte: das zeichen, ein satz dazu, das
 * feld auf einer karte, der name darunter. Nichts steht neben etwas anderem.
 */
export function AnsichtSchloss({ von }: { von: string }) {
  const [wort, setWort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [am, setAm] = useState(false);
  const [zeigen, setZeigen] = useState(false);

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
    <div className="mx-auto flex min-h-dvh w-full max-w-sm flex-col items-center justify-center px-5 py-10">
      <div
        className="grid h-[76px] w-[76px] place-items-center rounded-[24px] text-[36px]"
        style={{ background: 'linear-gradient(145deg, var(--akzent) 0%, #14998e 100%)', color: 'var(--auf-akzent)', boxShadow: '0 14px 30px -12px rgb(15 118 110 / 0.55)' }}
        aria-hidden
      >
        🧭
      </div>
      <h1 className="mt-5 text-center text-[26px] font-semibold leading-tight">Willkommen</h1>
      <p className="mt-1.5 max-w-[19rem] text-center text-[15px] leading-snug" style={{ color: 'var(--text2)' }}>
        Dieser Reiseplan ist privat. Gib das Passwort ein, das du von Flo bekommen hast.
      </p>

      <Karten className="mt-6 w-full p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void eintreten();
          }}
        >
          <label className="label" htmlFor="ansicht-passwort">
            Passwort
          </label>
          <div className="relative">
            <input
              id="ansicht-passwort"
              className="eingabe !pr-12 text-center text-[18px] tracking-[0.25em]"
              type={zeigen ? 'text' : 'password'}
              inputMode="numeric"
              autoComplete="off"
              placeholder="••••••"
              value={wort}
              aria-invalid={fehler ? true : undefined}
              aria-describedby={fehler ? 'ansicht-fehler' : undefined}
              onChange={(e) => {
                setWort(e.target.value);
                if (fehler) setFehler(null);
              }}
            />
            <button
              type="button"
              onClick={() => setZeigen((z) => !z)}
              aria-label={zeigen ? 'Passwort verbergen' : 'Passwort anzeigen'}
              aria-pressed={zeigen}
              className="absolute inset-y-0 right-1 grid w-11 place-items-center rounded-lg text-[18px]"
              style={{ background: 'transparent', border: 0, color: 'var(--text3)' }}
            >
              <span aria-hidden>{zeigen ? '🙈' : '👁️'}</span>
            </button>
          </div>
          {fehler ? (
            <p id="ansicht-fehler" role="alert" className="mt-2 text-center text-[13.5px] font-medium" style={{ color: 'var(--gefahr)' }}>
              {fehler}
            </p>
          ) : null}
          <button type="submit" className="knopf mt-3 w-full" disabled={am || !wort.trim()}>
            {am ? 'wird geprüft …' : 'ansehen'}
          </button>
        </form>
      </Karten>

      <MadeByFlo className="mt-6 text-center" />
    </div>
  );
}
