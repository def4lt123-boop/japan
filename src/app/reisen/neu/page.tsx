'use client';

import { useRouter } from 'next/navigation';
import { useStore } from '../../../lib/daten';
import { ReiseFormular, entwurfAus } from '../../../components/ReiseFormular';
import { Hinweis, Karten, SeitenKopf } from '../../../components/ui';

/** Eine Reise anlegen – kurzes Blatt, sinnvolle Vorauswahl. */
export default function NeueReise() {
  const store = useStore();
  const router = useRouter();
  const anfang = entwurfAus(null, store.einstellungen.waehrung, store.einstellungen.personen);

  return (
    <main className="seite pb-6">
      <SeitenKopf titel="Neue Reise" untertitel="Name und zwei Termine genügen – den Rest füllt die Planung." />
      <Karten className="p-3 sm:p-4">
        <ReiseFormular
          anfang={anfang}
          knopfText="Reise anlegen"
          abbrechen={() => router.back()}
          speichern={async (werte) => {
            const reise = await store.reiseAnlegen(werte);
            store.aktivSetzen(reise.id);
            store.sagen('Reise angelegt.');
            router.push(`/t/${reise.id}`);
          }}
        />
      </Karten>
      <Hinweis className="mt-3">
        Nach dem Anlegen geht es direkt zum ersten Reisetag. Budget, Währung und Ziele lassen sich jederzeit unter „Reisedaten“ ändern.
      </Hinweis>
    </main>
  );
}
