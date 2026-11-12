import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AnsichtSchloss } from '../../components/AnsichtSchloss';
import { ANSICHT_COOKIE, aufgesperrt, zielSichern } from '../../lib/ansicht.server';

/**
 * Die tür. Steht der cookie dran, geht es ohne fragen weiter – sonst steht hier
 * das feld, in das das gehörige wort gehört. Ein benutzername wird nicht gefragt:
 * die seite ist zum ansehen da und für niemanden geschrieben.
 */
export default async function Ansicht({ searchParams }: { searchParams: Promise<{ von?: string }> }) {
  const { von } = await searchParams;
  const verrat = await cookies();
  if (await aufgesperrt(verrat.get(ANSICHT_COOKIE)?.value)) redirect(zielSichern(von));
  return (
    <main className="fixed inset-0 z-[80] overflow-y-auto" style={{ background: 'var(--karte)' }}>
      <AnsichtSchloss von={zielSichern(von)} />
    </main>
  );
}
