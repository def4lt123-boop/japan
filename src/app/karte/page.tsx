'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '../../lib/daten';
import { Karten, Leer, SeitenKopf } from '../../components/ui';

/** Karte der gerade offenen Reise – derselbe Umweg wie beim Kalender. */
export default function KarteWeiter() {
  const store = useStore();
  const router = useRouter();
  useEffect(() => {
    if (!store.bereit) return;
    router.replace(store.aktiveReise ? `/t/${store.aktiveReise.id}/karte` : '/reisen');
  }, [router, store.aktiveReise, store.bereit]);

  if (store.aktiveReise) return null;
  return (
    <main className="seite pb-6">
      <SeitenKopf titel="Karte" />
      <Karten>
        <Leer zeichen="🗺️" titel="Noch keine Reise offen" text="Reise antippen – dann erscheinen ihre Orte auf der Karte." />
      </Karten>
    </main>
  );
}
