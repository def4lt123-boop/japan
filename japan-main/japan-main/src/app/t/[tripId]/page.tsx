'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useStore } from '../../../lib/daten';
import { heuteIso } from '../../../lib/dates';
import { heutigerTag } from '../../../lib/plan';
import { SeitenKopf } from '../../../components/ui';

/** `/t/<reise>` landet beim heutigen Tag, sonst beim ersten der Reise. */
export default function ReiseZeiger() {
  const params = useParams<{ tripId: string }>();
  const store = useStore();
  const router = useRouter();
  const reise = store.reisen.find((r) => r.id === params.tripId);

  useEffect(() => {
    if (!store.bereit) return;
    if (!reise) {
      router.replace('/reisen');
      return;
    }
    const tag = heutigerTag(reise, heuteIso());
    router.replace(tag ? `/t/${reise.id}/tag/${tag}` : `/t/${reise.id}/daten`);
  }, [reise, router, store.bereit]);

  return (
    <main className="seite">
      <SeitenKopf titel={reise?.name ?? 'Reise'} untertitel="Tag wird geöffnet …" />
    </main>
  );
}
