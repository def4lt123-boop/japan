import { NextResponse } from 'next/server';
import { bildFinden, googleBild } from '../../../lib/anbieter';

export const dynamic = 'force-dynamic';

/** Ein passendes, frei nutzbares Bild – mit dem Nachweis, den die Quelle verlangt. */
export async function GET(anfrage: Request) {
  const url = new URL(anfrage.url);
  const foto = url.searchParams.get('foto');
  if (foto) {
    const bild = await googleBild(foto);
    if (!bild) return new NextResponse('kein Bild', { status: 404 });
    return new Response(bild.body, {
      headers: {
        'content-type': bild.headers.get('content-type') ?? 'image/jpeg',
        'cache-control': 'public, max-age=604800, stale-while-revalidate=2419200',
      },
    });
  }
  const q = url.searchParams.get('q') ?? '';
  if (q.trim().length < 3) return NextResponse.json({ url: null });
  const bild = await bildFinden(q);
  if (!bild) {
    // eine leere hand wird nicht weitergereicht: die nächste frage darf es noch einmal versuchen
    return NextResponse.json({ url: null }, { headers: { 'cache-control': 'no-store' } });
  }
  // derselbe Ort sieht den ganzen Tag gleich aus – die Reihe darf fragen, so oft sie will
  return NextResponse.json(bild, { headers: { 'cache-control': 'public, max-age=86400, stale-while-revalidate=604800' } });
}
