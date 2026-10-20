/**
 * Liest das Ziel eines Google-Maps-Kurzlinks (maps.app.goo.gl/…) aus.
 * Der Browser darf das wegen CORS nicht selbst, deshalb springt hier die
 * Server-Seite einmal kurz mit – ohne Schlüssel, ohne Konto, ohne Datenhaltung.
 */
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED = /^https?:\/\/(((?:www|maps)\.)?google\.[a-z.]{2,6}\/|maps\.app\.goo\.gl\/|goo\.gl\/)/i;

export async function GET(request: Request) {
  const url = new URL(request.url).searchParams.get('url') ?? '';
  if (!/^https?:\/\//i.test(url) || !ALLOWED.test(url)) {
    return NextResponse.json({ error: 'Nur Google-Maps-Links werden aufgelöst.' }, { status: 400 });
  }
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Urlaubsplaner)' },
      cache: 'no-store',
      signal: AbortSignal.timeout(6000),
    });
    const final = res.url || url;
    // /data= und !3m1-Kram abschneiden: reicht zum Auslesen von Punkt und Namen
    const clean = final.replace(/\/data=.*$/, '').replace(/[?&]hl=[^&]*/g, '');
    return NextResponse.json({ url: clean, ok: true });
  } catch {
    return NextResponse.json({ url, ok: false }, { status: 200 });
  }
}
