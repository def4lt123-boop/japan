import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Fühlt dem Speicher auf den Zahn: eine echte winzige Abfrage, kein Test auf
 * gesetzte Umgebungswerte. Darum kann die App „verbunden" sagen, ohne es zu
 * behaupten.
 */

const GRUND = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, '') ?? '';
const SCHLUESSEL = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export async function GET() {
  if (!GRUND || !SCHLUESSEL) return NextResponse.json({ speicher: 'aus', erreichbar: false });
  const anfang = Date.now();
  try {
    const antwort = await fetch(`${GRUND}/rest/v1/reisen?select=id&limit=1`, {
      headers: { apikey: SCHLUESSEL, Authorization: `Bearer ${SCHLUESSEL}`, Accept: 'application/json' },
      signal: AbortSignal.timeout(4000),
      cache: 'no-store',
    });
    if (!antwort.ok) return NextResponse.json({ speicher: 'an', erreichbar: false, status: antwort.status });
    await antwort.json().catch(() => []);
    return NextResponse.json({ speicher: 'an', erreichbar: true, ms: Date.now() - anfang });
  } catch (fehler) {
    const grund = (fehler as Error)?.name === 'TimeoutError' ? 'zeit' : 'netz';
    return NextResponse.json({ speicher: 'an', erreichbar: false, grund });
  }
}
