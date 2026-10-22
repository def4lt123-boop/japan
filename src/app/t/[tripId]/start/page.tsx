import { redirect } from 'next/navigation';

/** Kurzkürzel für unterwegs: landet immer auf der Tagesseite (die selbst entscheidet, was sie zeigt). */
export default async function StartPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  redirect(`/t/${tripId}/heute`);
}
