'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '../../../../lib/daten';
import { tagKurz } from '../../../../lib/dates';
import { chronologisch, reiseTage, tagEintraege } from '../../../../lib/plan';
import { kategorie } from '../../../../lib/kategorien';
import { kartenLink, punktVorhanden } from '../../../../lib/karten';
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
  const [route, setRoute] = useState<[number, number][] | null>(null);

  const eintraege = reise ? store.eintraegeVon(reise.id) : [];
  const tage = useMemo(() => (reise ? reiseTage(reise) : []), [reise]);

  const punkte = useMemo<KartenPunkt[]>(() => {
    if (!reise) return [];
    const quelltext = tag === 'alle' ? eintraege.filter((e) => e.art !== 'unterkunft' && e.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || chronologisch(a, b)) : tagEintraege(eintraege, tag);
    const zahlbar = quelltext.filter(punktVorhanden);
    return zahlbar.map((e, i) => {
      const k = kategorie(e.kategorie);
      return {
        id: e.id,
        nr: i + 1,
        lat: e.lat as number,
        lng: e.lng as number,
        titel: e.titel,
        farbe: e.art === 'unterkunft' ? kategorie('unterschlupf').farbe : k.farbe,
        ort: e.ort,
        zeit: e.zeit,
        foto: e.foto_url,
        nachweis: e.foto_nachweis,
        href: e.date ? `/t/${reise.id}/tag/${e.date}` : `/t/${reise.id}/liste`,
        karten: kartenLink(e),
      };
    });
  }, [eintraege, reise, tag]);

  useEffect(() => {
    let abbruch = false;
    if (tag === 'alle' || punkte.length < 2) {
      setRoute((vorher) => wieVorher(vorher, null));
      return;
    }
    void (async () => {
      const schnur: [number, number][] = [];
      for (let i = 0; i + 1 < punkte.length; i += 1) {
        const info = await routeZwischen(punkte[i]!, punkte[i + 1]!, 'zu fuss', true);
        if (info?.strecke?.length) schnur.push(...info.strecke);
        else {
          schnur.push([punkte[i]!.lat, punkte[i]!.lng], [punkte[i + 1]!.lat, punkte[i + 1]!.lng]);
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
            {punkte.length ? `${punkte.length} ${punkte.length === 1 ? 'Punkt' : 'Punkte'}` : 'keine Punkte'}
          </span>
          {tag !== 'alle' && punkte.length > 1 ? <Chip>🚶 Weg an diesem Tag</Chip> : null}
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
              <p className="text-[15px] font-semibold">Noch kein Punkt</p>
              <p className="mikro mt-1">Einen Ort anlegen und in der Suche einen Vorschlag antippen – dann steht er hier.</p>
              <Link href={`/t/${reise.id}/liste`} className="knopf knopf-klein mt-2.5 no-underline">
                Ort anlegen
              </Link>
            </div>
          )}
        </Karten>

        <Karten className="overflow-hidden">
          <KartenKopf titel={tag === 'alle' ? 'Alle Punkte' : tagKurz(tag)} untertitel="in der Reihenfolge" />
          <ul className="liste list-none m-0 max-h-[46dvh] overflow-y-auto p-0">
            {punkte.map((p) => (
              <li key={p.id} className="border-b last:border-0" style={{ borderColor: 'var(--rand)' }}>
                <Link href={p.href} className="flex min-w-0 items-center gap-2.5 px-3 py-2 no-underline hover:bg-[var(--akzent-fläche)]">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] font-bold text-white tabular-nums" style={{ background: p.farbe }}>
                    {p.nr}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{p.titel}</span>
                    <span className="mikro block truncate">{[p.zeit, p.ort].filter(Boolean).join(' · ')}</span>
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
              {Array.from(new Map(punkte.map((p) => [p.farbe, p])).values()).slice(0, 6).map((p) => (
                <span key={p.id} className="mikro flex items-center gap-1">
                  <Punkt farbe={p.farbe} groesse={8} /> {p.titel.length > 14 ? `${p.titel.slice(0, 13)}…` : p.titel}
                </span>
              ))}
            </div>
          ) : null}
        </Karten>
      </div>
    </main>
  );
}
