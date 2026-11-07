import { NextResponse } from 'next/server';
import { orteSuchen } from '../../../lib/anbieter';

export const dynamic = 'force-dynamic';

/** Ortssuche fürs Formular – Name rein, Punkt und Adresse raus. */
export async function GET(anfrage: Request) {
  const url = new URL(anfrage.url);
  const q = url.searchParams.get('q') ?? '';
  const nahe = url.searchParams.get('nahe');
  let punkt: { lat: number; lng: number } | null = null;
  if (nahe) {
    const [lat, lng] = nahe.split(',').map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng)) punkt = { lat: lat!, lng: lng! };
  }
  if (q.trim().length < 2) return NextResponse.json({ orte: [] });
  const orte = await orteSuchen(q, punkt);
  return NextResponse.json({ orte });
}
