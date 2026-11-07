import { NextResponse } from 'next/server';
import { bildFinden } from '../../../lib/anbieter';

export const dynamic = 'force-dynamic';

/** Ein passendes, frei nutzbares Bild – mit dem Nachweis, den die Quelle verlangt. */
export async function GET(anfrage: Request) {
  const q = new URL(anfrage.url).searchParams.get('q') ?? '';
  if (q.trim().length < 3) return NextResponse.json({ url: null });
  const bild = await bildFinden(q);
  // derselbe Ort sieht den ganzen Tag gleich aus – die Reihe darf fragen, so oft sie will
  return NextResponse.json(bild ?? { url: null }, { headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
