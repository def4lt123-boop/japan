'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '../../../lib/store';
import { Card } from '../../../components/ui';

/**
 * Eine Reise öffnen heißt: dorthin, wo man gerade steht.
 * ▶️ läuft die Reise → der Tag. 🗓️ sonst → der Tagesplan.
 */
export default function TripIndexPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const router = useRouter();
  const started = store.trips.find((t) => t.id === tripId)?.started === true;

  useEffect(() => {
    if (!store.ready) return;
    router.replace?.(`/t/${tripId}/${started ? 'heute' : 'tage'}`);
  }, [store.ready, started, tripId, router]);

  return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
}
