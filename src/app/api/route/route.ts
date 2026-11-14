import { NextResponse } from 'next/server';
import { SIEHBT_GOOGLE, googleTabelle, googleWeg } from '../../../lib/anbieter';

/**
 * Wege nach Google Maps: der Schlüssel bleibt im Server, die Seite fragt hier. Ohne
 * Schlüssel sagt die Antwort `konfiguriert: false`, und die Seite rechnet wie bisher
 * über die offenen Wegdienste. Die Route steht hinter dem Passwort der Seite – anders
 * als die Ortssuche kann sie also niemand von außen auf Rechnung des Schlüssels fragen.
 */
export const dynamic = 'force-dynamic';

const MODI = ['zu fuss', 'rad', 'auto', 'bahn'];

function punkt(text: string | null): { lat: number; lng: number } | null {
  const [lat, lng] = (text ?? '').split(',').map(Number);
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export async function GET(anfrage: Request) {
  const url = new URL(anfrage.url);
  if (!SIEHBT_GOOGLE) return NextResponse.json({ konfiguriert: false, route: null });
  const von = punkt(url.searchParams.get('von'));
  const nach = punkt(url.searchParams.get('nach'));
  const modus = url.searchParams.get('modus') ?? 'zu fuss';
  if (!von || !nach || !MODI.includes(modus)) return NextResponse.json({ konfiguriert: true, route: null }, { status: 400 });
  const route = await googleWeg(von, nach, modus, url.searchParams.get('linie') === '1');
  return NextResponse.json({ konfiguriert: true, route }, { headers: { 'Cache-Control': route ? 'private, max-age=3600' : 'no-store' } });
}

export async function POST(anfrage: Request) {
  if (!SIEHBT_GOOGLE) return NextResponse.json({ konfiguriert: false, tabelle: null });
  const roh = (await anfrage.json().catch(() => null)) as { punkte?: { lat?: number; lng?: number }[]; modus?: string } | null;
  const punkte = (roh?.punkte ?? []).map((p) => punkt(`${p.lat},${p.lng}`));
  const modus = roh?.modus ?? 'zu fuss';
  if (punkte.length < 2 || punkte.length > 12 || punkte.some((p) => !p) || !MODI.includes(modus)) {
    return NextResponse.json({ konfiguriert: true, tabelle: null }, { status: 400 });
  }
  const tabelle = await googleTabelle(punkte as { lat: number; lng: number }[], modus);
  return NextResponse.json({ konfiguriert: true, tabelle }, { headers: { 'Cache-Control': 'no-store' } });
}
