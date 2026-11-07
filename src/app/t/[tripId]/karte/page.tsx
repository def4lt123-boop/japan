'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '../../../../lib/daten';
import { abstandTage, tagKurz } from '../../../../lib/dates';
import { kartenEintraege, reiseTage } from '../../../../lib/plan';
import { artMeta, kategorie } from '../../../../lib/kategorien';
import { kartenLink, punktVorhanden } from '../../../../lib/karten';
import { uhrzeitText } from '../../../../lib/format';
import { punktFuer } from '../../../../lib/punktfindung';
import { routeZwischen } from '../../../../lib/routen';
import { wieVorher } from '../../../../lib/format';
import { Chip, Karten, KartenKopf, Punkt, Segment, cx } from '../../../../components/ui';
import type { KartenPunkt } from '../../../../components/KartenAnsicht';

const KartenBrett = dynamic(() => import('../../../../components/KartenAnsicht').then((m) => m.KartenAnsicht), {
  ssr: false,
  loading: () => <Ladekarte />,
});

function Ladekarte() {
  return (
    <div className="grid min-h-[320px] w-full place-items-center" style={{ background: '#e9eef4' }}>
      <p className="mikro">Karte wird geladen …</p>
    </div>
  );
}

/** Die Reise als Punkte: Nummer in Kategoriefarbe, antippen öffnet das Blatt. */
export default function ReiseKarte() {
  const params = useParams<{ tripId: string }>();
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === params.tripId);
  const [tag, setTag] = useState<string>('alle');
  const [punkteSucht, setPunkteSucht] = useState(false);
  const [route, setRoute] = useState<[number, number][] | null>(null);

  const eintraege = reise ? store.eintraegeVon(reise.id) : [];
  const tage = useMemo(() => (reise ? reiseTage(reise) : []), [reise]);

  const punkte = useMemo<KartenPunkt[]>(() => {
    if (!reise) return [];
    const zahlbar = kartenEintraege(eintraege, tag === 'alle' ? null : tag).filter(punktVorhanden);
    let stelle = 0;
    return zahlbar.map((e) => {
      const k = kategorie(e.kategorie);
      const istBett = e.art === 'unterkunft';
      const naechte = istBett && e.date && e.bis_date ? abstandTage(e.date, e.bis_date) : 0;
      const zeit = [e.zeit ? `Check-in ${uhrzeitText(e.zeit)}` : null, e.bis_zeit ? `Check-out ${uhrzeitText(e.bis_zeit)}` : null, naechte ? `${naechte} ${naechte === 1 ? 'Nacht' : 'Nächte'}` : null].filter(Boolean).join(' · ');
      return {
        id: e.id,
        nr: istBett ? null : (stelle += 1),
        lat: e.lat as number,
        lng: e.lng as number,
        titel: e.titel,
        farbe: istBett ? kategorie('unterschlupf').farbe : k.farbe,
        zeichen: istBett ? artMeta('unterkunft').Icon : e.art === 'fahrt' ? artMeta('fahrt').Icon : k.icon,
        marke: istBett ? artMeta('unterkunft').wort : e.art === 'fahrt' ? artMeta('fahrt').wort : k.label,
        untertitel: istBett
          ? [zeit, e.ort].filter(Boolean).join(' · ')
          : [e.zeit ? uhrzeitText(e.zeit) : null, e.ort].filter(Boolean).join(' · '),
        foto: e.foto_url,
        nachweis: e.foto_nachweis,
        href: istBett ? `/t/${reise.id}/hotels` : e.date ? `/t/${reise.id}/tag/${e.date}` : `/t/${reise.id}/liste`,
        karten: kartenLink(e),
      };
    });
  }, [eintraege, reise, tag]);

  const zahlPunkte = punkte.filter((p) => p.nr !== null).length;
  const zahlBetten = punkte.length - zahlPunkte;
  // ein eintrag ohne punkt liegt nirgends – das soll nicht unerklärt bleiben
  const ohnePunktListe = useMemo(() => (reise ? kartenEintraege(eintraege, tag === 'alle' ? null : tag).filter((e) => !punktVorhanden(e)) : []), [eintraege, reise, tag]);
  const ohnePunkt = ohnePunktListe.length;

  /**
   * Der Punkt, den sich die App selbst holt: wer eine unterkunft nach name und
   * ort angelegt hat, soll sie nicht noch einmal anfassen müssen, damit die
   * karte sie zeigt. Höchstens fünf auf einmal – die offene Suche will nicht
   * gemäht werden.
   */
  const punkteFinden = async () => {
    if (!reise) return;
    setPunkteSucht(true);
    let gesetzt = 0;
    for (const [stelle, e] of ohnePunktListe.slice(0, 5).entries()) {
      // zwischen zwei anfragen liegt eine pause – die offene suche mag es nicht eilig
      if (stelle) await new Promise((r) => window.setTimeout(r, 240));
      const treffer = await punktFuer({ titel: e.titel, ort: e.ort, adresse: e.adresse, karten_stichwort: e.karten_stichwort }, reise.land);
      if (!treffer) continue;
      await store.eintragAendern(e.id, treffer.patch);
      gesetzt += 1;
    }
    setPunkteSucht(false);
    store.sagen(
      gesetzt
        ? `${gesetzt} ${gesetzt === 1 ? 'Punkt' : 'Punkte'} gesetzt · zum Nachprüfen in der Liste antippen`
        : 'Keinen passenden Punkt gefunden – in der Zeile den Ort suchen.',
    );
  };

  useEffect(() => {
    let abbruch = false;
    const folge = punkte.filter((p) => p.nr !== null);
    if (tag === 'alle' || folge.length < 2) {
      setRoute((vorher) => wieVorher(vorher, null));
      return;
    }
    void (async () => {
      const schnur: [number, number][] = [];
      for (let i = 0; i + 1 < punkte.length; i += 1) {
        const info = await routeZwischen(folge[i]!, folge[i + 1]!, 'zu fuss', true);
        if (info?.strecke?.length) schnur.push(...info.strecke);
        else {
          schnur.push([folge[i]!.lat, folge[i]!.lng], [folge[i + 1]!.lat, folge[i + 1]!.lng]);
        }
      }
      if (!abbruch) setRoute((vorher) => wieVorher(vorher, schnur));
    })();
    return () => {
      abbruch = true;
    };
  }, [punkte, tag]);

  if (!store.bereit || !reise) return null;

  return (
    <main className="pb-4">
      <div className="mb-2.5 space-y-2">
        <Segment
          wert={tag}
          beimAendern={setTag}
          optionen={[{ id: 'alle', label: 'Ganze Reise', zeichen: '🧭' }, ...tage.map((d) => ({ id: d, label: tagKurz(d), zeichen: '' }))]}
        />
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <span className="mikro">
            {[zahlPunkte ? `${zahlPunkte} ${zahlPunkte === 1 ? 'Punkt' : 'Punkte'}` : null, zahlBetten ? `${zahlBetten} ${zahlBetten === 1 ? 'Unterkunft' : 'Unterkünfte'}` : null].filter(Boolean).join(' · ') || 'noch nichts'}
          </span>
          {tag !== 'alle' && zahlPunkte > 1 ? <Chip>🚶 Weg an diesem Tag</Chip> : null}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="mikro ml-auto no-underline hover:underline">
            Kartenmaterial © OpenStreetMap
          </a>
        </div>
      </div>

      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_336px]">
        <Karten className="overflow-hidden">
          {punkte.length ? (
            <div className="h-[56dvh] min-h-[320px] w-full lg:h-[calc(100dvh-190px)]">
              <KartenBrett punkte={punkte} strecke={route} klasse="h-full w-full" />
            </div>
          ) : (
            <div className="p-4 text-center">
              <p className="text-[15px] font-semibold">Noch kein Punkt auf der Karte</p>
              <p className="mikro mt-1">Einen Ort anlegen und in der Suche einen Vorschlag antippen – dann steht er hier. Auch das Bett erscheint auf der Karte, sobald es einen Punkt hat.</p>
              <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2">
                <Link href={`/t/${reise.id}/liste`} className="knopf knopf-klein no-underline">
                  Ort anlegen
                </Link>
                {ohnePunktListe.length ? (
                  <button type="button" className="knopf knopf-klein" onClick={() => void punkteFinden()} disabled={punkteSucht}>
                    {punkteSucht ? 'suche Punkte …' : 'Punkte finden'}
                  </button>
                ) : null}
              </div>
            </div>
          )}
          {ohnePunktListe.length ? (
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 border-t px-3 py-2" style={{ borderColor: 'var(--rand)' }}>
              <p className="mikro m-0 min-w-0 flex-1">
                {ohnePunktListe.length === 1 ? 'Ein Eintrag hat keinen Punkt' : `${ohnePunktListe.length} Einträge haben keinen Punkt`} – ohne Punkt steht nichts auf der Karte: {ohnePunktListe.map((e) => e.titel).slice(0, 3).join(' · ')}
              </p>
              <button type="button" className="knopf knopf-klein" onClick={() => void punkteFinden()} disabled={punkteSucht}>
                {punkteSucht ? 'suche Punkte …' : 'Punkte finden'}
              </button>
            </div>
          ) : null}
        </Karten>

        <Karten className="overflow-hidden">
          <KartenKopf titel={tag === 'alle' ? 'Alle Punkte' : tagKurz(tag)} untertitel="erst die Halte, dann die Betten" />
          <ul className="liste list-none m-0 max-h-[46dvh] overflow-y-auto p-0">
            {punkte.map((p) => (
              <li key={p.id} className="border-b last:border-0" style={{ borderColor: 'var(--rand)' }}>
                <Link href={p.href} className="flex min-w-0 items-center gap-2.5 px-3 py-2 no-underline hover:bg-[var(--akzent-fläche)]">
                  {p.nr !== null ? (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white tabular-nums" style={{ background: p.farbe }}>
                      {p.nr}
                    </span>
                  ) : (
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px]" style={{ border: `1px solid ${p.farbe}`, background: 'var(--bett-fläche)' }} aria-hidden>
                      🛏️
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{p.titel}</span>
                    <span className="mikro block truncate">{p.untertitel}</span>
                  </span>
                  <span aria-hidden className="mikro shrink-0">⌄</span>
                </Link>
              </li>
            ))}
            {!punkte.length ? <li className="p-3 mikro">Nichts zu zeigen – Punkte entstehen mit Datum und Ort.</li> : null}
          </ul>
          {punkte.length ? (
            <div className="flex flex-wrap items-center gap-2 border-t p-2.5" style={{ borderColor: 'var(--rand)' }}>
              <span className="mikro">Legende</span>
              {Array.from(new Map(punkte.map((p) => [p.farbe, p.marke])).values()).map((marke) => {
                const p = punkte.find((q) => q.marke === marke)!;
                return (
                  <span key={marke} className="mikro flex items-center gap-1">
                    <Punkt farbe={p.farbe} groesse={8} /> {p.zeichen} {marke}
                  </span>
                );
              })}
            </div>
          ) : null}
        </Karten>
      </div>
    </main>
  );
}
