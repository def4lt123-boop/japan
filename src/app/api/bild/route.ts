import { NextResponse } from 'next/server';
import { bildFinden } from '../../../lib/anbieter';

export const dynamic = 'force-dynamic';

/** Ein passendes, frei nutzbares Bild – mit dem Nachweis, den die Quelle verlangt. */
export async function GET(anfrage: Request) {
  const q = new URL(anfrage.url).searchParams.get('q') ?? '';
  if (q.trim().length < 3) return NextResponse.json({ url: null });
  const bild = await bildFinden(q);
  return NextResponse.json(bild ?? { url: null });
}
