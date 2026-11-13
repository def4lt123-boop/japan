import { NextResponse } from 'next/server';

/**
 * Der kurze link aus dem teilen-knopf von Google Maps trägt den punkt nicht, ein
 * verweis führt erst hin. Hier wird der verweis vorgelegt und die ankunft
 * zurückgegeben – mehr nicht, nur die adresse, nie der seiteninhalt. Was der
 * dienst nicht erreichen kann, kommt als leere hand zurück, damit das feld es
 * sagen kann, statt zu raten.
 */
export const dynamic = 'force-dynamic';

const ERLAUBT = /^https?:\/\/(?:[-a-z0-9]+\.)*(?:goo\.gl|google\.[a-z.]{2,8})$/iu;
const FRIST = 6000;

export async function GET(anfrage: Request) {
  const url = new URL(anfrage.url);
  const quelle = url.searchParams.get('u')?.trim() ?? '';
  let start: URL | null = null;
  try {
    start = new URL(quelle);
  } catch {
    start = null;
  }
  if (!start || !ERLAUBT.test(start.origin)) return NextResponse.json({ ziel: null });
  try {
    const antwort = await fetch(start.toString(), {
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(FRIST),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; reiseplan)', Accept: 'text/html' },
    });
    if (!antwort.url) return NextResponse.json({ ziel: null });
    const erreicht = new URL(antwort.url);
    if (!/^https?:/u.test(erreicht.protocol)) return NextResponse.json({ ziel: null });
    return NextResponse.json({ ziel: erreicht.href }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ziel: null });
  }
}
