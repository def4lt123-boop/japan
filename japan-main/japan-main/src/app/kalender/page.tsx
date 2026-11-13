'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../lib/daten';
import { Karten, Leer, SeitenKopf } from '../../components/ui';

/** Die Leiste zeigt „Kalender" und „Karte" – hier landet man beim Blatt der gerade offenen Reise. */
function Weiter({ bereich, titel }: { bereich: 'kalender' | 'karte'; titel: string }) {
  const store = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!store.bereit) return;
    router.replace(store.aktiveReise ? `/t/${store.aktiveReise.id}/${bereich}` : '/reisen');
  }, [bereich, router, store.aktiveReise, store.bereit]);

  if (store.aktiveReise) return null;
  return (
    <main className="seite pb-6">
      <SeitenKopf titel={titel} />
      <Karten>
        <Leer zeichen="🗓️" titel="Noch keine Reise offen" text="Reise antippen – dann zeigt dieser Reiter ihren Kalender." />
      </Karten>
    </main>
  );
}

export default function KalenderWeiter() {
  return <Weiter bereich="kalender" titel="Kalender" />;
}
