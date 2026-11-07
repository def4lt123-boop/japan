'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useStore } from '../../lib/daten';
import { heuteIso } from '../../lib/dates';
import { laufend, vergangen } from '../../lib/plan';
import { ReiseKarte } from '../../components/ReiseKarte';
import { Karten, Knopf, Leer, SeitenKopf, Segment, TextFeld, cx } from '../../components/ui';

/** Meine Reisen: suchen, blättern, archivieren. */
export default function Reisen() {
  const store = useStore();
  const [suche, setSuche] = useState('');
  const [ansicht, setAnsicht] = useState('geplant');
  const heute = heuteIso();

  const gruppen = useMemo(() => {
    const alle = [...store.reisen].sort((a, b) => (a.start_date ?? '9999').localeCompare(b.start_date ?? '9999'));
    const treffer = suche.trim()
      ? alle.filter((r) => [r.name, r.land, r.stationen, r.beschreibung].filter(Boolean).join(' ').toLowerCase().includes(suche.trim().toLowerCase()))
      : alle;
    return {
      geplant: treffer.filter((r) => !r.archived && !laufend(r, heute) && !vergangen(r, heute)),
      laeuft: treffer.filter((r) => !r.archived && laufend(r, heute)),
      vergangen: treffer.filter((r) => !r.archived && vergangen(r, heute)),
      archiv: treffer.filter((r) => r.archived),
    };
  }, [suche, store.reisen, heute]);

  const liste = gruppen[ansicht as keyof typeof gruppen] ?? [];

  return (
    <main className="seite pb-6">
      <SeitenKopf
        titel="Meine Reisen"
        untertitel={`${store.reisen.length} ${store.reisen.length === 1 ? 'Reise' : 'Reisen'} · jede mit eigenem Kalender`}
        seitlich={
          <Link href="/reisen/neu" className="knopf no-underline">
            + Neue Reise
          </Link>
        }
      />

      <div className="mb-2.5 space-y-2">
        <TextFeld wert={suche} beimAendern={setSuche} platzhalter="Name, Land oder Ort suchen" />
        <Segment
          wert={ansicht}
          beimAendern={setAnsicht}
          optionen={[
            { id: 'geplant', label: 'Geplant', zeichen: '🗓️' },
            { id: 'läuft', label: 'Läuft', zeichen: '📍' },
            { id: 'vergangen', label: 'Vergangen', zeichen: '📚' },
            { id: 'archiv', label: 'Archiv', zeichen: '🗄' },
          ].map((o) => ({ ...o, id: o.id === 'läuft' ? 'laeuft' : o.id }))}
        />
      </div>

      {liste.length ? (
        <div className={cx('grid gap-2.5', ansicht === 'archiv' ? 'grid-cols-1' : 'grid-cols-1 xl:grid-cols-2')}>
          {liste.map((r) => (
            <ReiseKarte
              key={r.id}
              reise={r}
              eintraege={store.eintraegeVon(r.id)}
              verwalten={[
                { label: 'Reisedaten ändern', zeichen: '✏️', href: `/t/${r.id}/daten` },
                { label: 'Kalender öffnen', zeichen: '🗓️', href: `/t/${r.id}/kalender` },
                { label: r.archived ? 'aus dem Archiv holen' : 'ins Archiv legen', zeichen: '🗄', onClick: () => void store.reiseAendern(r.id, { archived: !r.archived }) },
                { label: 'Reise löschen', zeichen: '🗑', gefahr: true, onClick: () => void store.reiseLoeschen(r.id) },
              ]}
            />
          ))}
        </div>
      ) : (
        <Karten>
          <Leer
            zeichen={suche ? '🔍' : '🧳'}
            titel={suche ? 'Keine Reise passt zur Suche' : ansicht === 'archiv' ? 'Archiv ist leer' : 'Hier ist noch nichts'}
            text={suche ? 'Andere Wörter versuchen oder die Suche leeren.' : 'Neue Reise anlegen – Name und Datum genügen für den Anfang.'}
            knopf={
              <>
                {suche ? (
                  <Knopf ton="ghost" onClick={() => setSuche('')}>
                    Suche leeren
                  </Knopf>
                ) : null}
                <Link href="/reisen/neu" className="knopf no-underline">
                  Reise anlegen
                </Link>
              </>
            }
          />
        </Karten>
      )}
    </main>
  );
}
