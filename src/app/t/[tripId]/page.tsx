import { redirect } from 'next/navigation';

/** Eine Reise öffnen heißt: ihre Tage sehen. Der Rest liegt hinter den Reitern. */
export default async function TripIndexPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  redirect(`/t/${tripId}/tage`);
}
