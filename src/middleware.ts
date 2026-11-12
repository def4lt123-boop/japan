import { NextResponse, type NextRequest } from 'next/server';
import { ANSICHT_COOKIE, aufgesperrt } from './lib/ansicht.server';

/**
 * Vor die seite gehört ein passwort – zum ansehen, ohne benutzernamen.
 *
 * Geprüft wird hier nur der cookie: steht er dran und paßt, geht der weg weiter;
 * sonst landet der besuch beim schloss, mit dem weg, den er eigentlich wollte.
 * Das wort selbst kommt in dieses blatt nie hinein, und die seite erfährt davon
 * nichts außer der frage danach.
 */

const AUSNAHMEN = [/^\/ansicht$/, /^\/api\/ansicht$/, /^\/api\/status$/];

export async function middleware(anfrage: NextRequest) {
  const weg = anfrage.nextUrl.pathname;
  if (AUSNAHMEN.some((muster) => muster.test(weg))) return NextResponse.next();
  if (await aufgesperrt(anfrage.cookies.get(ANSICHT_COOKIE)?.value)) return NextResponse.next();
  const ziel = anfrage.nextUrl.clone();
  ziel.pathname = '/ansicht';
  ziel.search = '';
  if (weg !== '/') ziel.searchParams.set('von', `${weg}${anfrage.nextUrl.search}`);
  return NextResponse.redirect(ziel);
}

export const config = {
  // bilder, skripte und daten bleiben draußen – sonst kommt kein stil mehr an
  matcher: ['/((?!api/orte|api/bild|api/karte|api/ansicht|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map)$).*)'],
};
