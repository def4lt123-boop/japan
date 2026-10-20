import { redirect } from 'next/navigation';

/** Die Wünscheliste ist in die Aktivitätsliste aufgegangen. */
export default async function LegacyWishlistPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  redirect(`/t/${tripId}/aktivitaeten`);
}
