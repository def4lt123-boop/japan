import { NextResponse } from 'next/server';
import { orteSuchen, frageLohnt, bremsZuletzt } from '../../../lib/anbieter';

/**
 * Ortssuche fürs Formular – Name rein, Punkt und Adresse raus. Die antwort bleibt
 * am rand liegen, damit dasselbe wort im nächsten formular kein zweites mal ins
 * netz muss; ein „neu=1" holt sie trotzdem frisch.
 */
export const dynamic = 'force-dynamic';

export async function GET(anfrage: Request) {
  const url = new URL(anfrage.url);
  const q = url.searchParams.get('q') ?? '';
  const nahe = url.searchParams.get('nahe');
  let punkt: { lat: number; lng: number } | null = null;
  if (nahe) {
    const [lat, lng] = nahe.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) punkt = { lat: lat!, lng: lng! };
  }
  if (!frageLohnt(q)) return NextResponse.json({ orte: [] });
  const frisch = url.searchParams.get('neu') === '1';
  const orte = await orteSuchen(q, punkt, frisch);
  const gebremst = bremsZuletzt();
  // eine leere hand wird nicht zwischengelagert – sonst hängt sie als „kein punkt"
  // über jeder weiteren frage, und ein einzelner ausfall wird zur dauerantwort
  const lagern = orte.length && !frisch && !gebremst;
  return NextResponse.json(
    { orte, ...(gebremst ? { brems: true } : {}) },
    { headers: { 'Cache-Control': lagern ? 'public, s-maxage=1800, stale-while-revalidate=86400' : 'no-store' } },
  );
}
