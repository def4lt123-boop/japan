import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { ANSICHT_COOKIE, ANSICHT_DAUER, ansichtWert, passtDas, zielSichern } from '../../../lib/ansicht.server';

/**
 * Das schloss vorn an der seite: ein passwort, kein benutzername.
 *
 * Angefragt wird von dem blatt, das das wort zeigt; zurückkommt nur, ob die tür
 * aufgeht und wohin sie führt. Was ins feld getippt wird, wird hier verglichen und
 * nirgends hingeschrieben – auch nicht in eine meldung, die jemand mitliest.
 */

export const dynamic = 'force-dynamic';

/** fünf mal probieren, dann eine minute zuwarten – damit ein probierlauf nichts wird */
const FRIST = 60_000;
const VERSUCHE = 5;
const angemerkt = new Map<string, { anzahl: number; bis: number }>();

function gesperrt(schlussel: string, jetzt: number): boolean {
  const fund = angemerkt.get(schlussel);
  if (!fund) return false;
  if (fund.bis <= jetzt) {
    angemerkt.delete(schlussel);
    return false;
  }
  return fund.anzahl >= VERSUCHE;
}

export async function POST(anfrage: Request) {
  const leib = (await anfrage.json().catch(() => null)) as { passwort?: string; von?: string } | null;
  const schlussel = anfrage.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'heim';
  const jetzt = Date.now();
  if (gesperrt(schlussel, jetzt)) {
    return NextResponse.json({ ok: false, grund: 'Zu oft probiert – in einer Minute noch einmal.' }, { status: 429 });
  }
  const eingegeben = (leib?.passwort ?? '').trim();
  if (!eingegeben || !(await passtDas(eingegeben))) {
    const fund = angemerkt.get(schlussel) ?? { anzahl: 0, bis: jetzt + FRIST };
    angemerkt.set(schlussel, { anzahl: fund.anzahl + 1, bis: jetzt + FRIST });
    return NextResponse.json({ ok: false, grund: 'Das passt nicht zum Passwort.' }, { status: 401 });
  }
  const verrat = await cookies();
  verrat.set(ANSICHT_COOKIE, await ansichtWert(), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ANSICHT_DAUER,
    secure: process.env.NODE_ENV === 'production',
  });
  angemerkt.delete(schlussel);
  return NextResponse.json({ ok: true, von: zielSichern(leib?.von) });
}
