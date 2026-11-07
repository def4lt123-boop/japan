'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useStore } from '../../../../lib/daten';
import { kostenSumme, planFortschritt, reiseTage, unterkuenfte } from '../../../../lib/plan';
import { geld, plural } from '../../../../lib/format';
import { ReiseFormular, entwurfAus } from '../../../../components/ReiseFormular';
import { Ablage, Chip, Karten, KartenKopf, Knopf, cx } from '../../../../components/ui';

/** Reisedaten: das Blatt der Reise, die Prüfliste und der Mut zum Löschen. */
export default function Reisedaten() {
  const params = useParams<{ tripId: string }>();
  const store = useStore();
  const router = useRouter();
  const reise = store.reisen.find((r) => r.id === params.tripId);
  const [sperre, setSperre] = useState(false);

  if (!store.bereit || !reise) return null;

  const eintraege = store.eintraegeVon(reise.id);
  const fort = planFortschritt(reise, eintraege);
  const tage = reiseTage(reise);
  const aktivitaeten = eintraege.filter((e) => e.art === 'aktivitaet').length;
  const betten = unterkuenfte(eintraege).length;
  const { gesamt: kosten, fremde } = kostenSumme(reise, eintraege);

  return (
    <main className="pb-6">
      <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Karten className="p-3 sm:p-4">
          <ReiseFormular
            anfang={entwurfAus(reise, store.einstellungen.waehrung, store.einstellungen.personen)}
            knopfText="Reise speichern"
            speichern={async (werte) => {
              await store.reiseAendern(reise.id, werte);
              store.sagen('Reise gespeichert.');
            }}
          />
        </Karten>

        <div className="space-y-3">
          <Karten>
            <KartenKopf titel="Was noch fehlt" untertitel={`${fort.prozent}% geplant`} />
            <ul className="space-y-1.5 p-3">
              {fort.punkte.map((p) => (
                <li key={p.label} className="pruefpunkt">
                  <span aria-hidden className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-full text-[13px] font-bold', p.ok ? 'text-white' : '')} style={{ background: p.ok ? 'var(--gut)' : '#e6ebf2', color: p.ok ? undefined : 'var(--text3)' }}>
                    {p.ok ? '✓' : '○'}
                  </span>
                  <span className={cx('min-w-0 flex-1', p.ok && 'line-through decoration-[var(--rand-stark)]')}>{p.label}</span>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5 border-t p-2.5" style={{ borderColor: 'var(--rand)' }}>
              {!fort.punkte[1]?.ok ? (
                <Link href={`/t/${reise.id}/hotels`} className="chip !py-1.5 no-underline">
                  🛏️ Unterkünfte eintragen
                </Link>
              ) : null}
              {!fort.punkte[2]?.ok ? (
                <Link href={`/t/${reise.id}/kalender`} className="chip !py-1.5 no-underline">
                  🗓️ Tage füllen
                </Link>
              ) : null}
              {!fort.punkte[4]?.ok ? (
                <Link href={`/t/${reise.id}/daten`} className="chip !py-1.5 no-underline">
                  🖼️ Bild und Budget
                </Link>
              ) : null}
            </div>
          </Karten>

          <Karten>
            <KartenKopf titel="Diese Reise" />
            <div className="grid grid-cols-2 gap-px overflow-hidden bg-[var(--rand)]">
              {[
                { zahl: tage.length, eins: 'Tag', viele: 'Tage' },
                { zahl: aktivitaeten, eins: 'Aktivität', viele: 'Aktivitäten' },
                { zahl: betten, eins: 'Unterkunft', viele: 'Unterkünfte' },
                { zahl: eintraege.filter((e) => e.preis).length, eins: 'Preis', viele: 'Preise' },
              ].map((k) => (
                <div key={k.eins} className="bg-[var(--karte)] px-3 py-2">
                  <p className="text-[17px] font-semibold tabular-nums leading-tight">{k.zahl}</p>
                  <p className="mikro">{plural(k.zahl, k.eins, k.viele)}</p>
                </div>
              ))}
            </div>
            <p className="mikro flex flex-wrap items-center gap-1.5 px-3 py-2">
              <span>{geld(kosten, reise.waehrung)} verplant</span>
              {reise.budget ? (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {Math.round((kosten / reise.budget) * 100)} % von {geld(reise.budget, reise.waehrung)}
                  </span>
                </>
              ) : null}
              {reise.budget && kosten > reise.budget ? <Chip ton="warnt">über Budget</Chip> : null}
              {fremde.length ? <span>· dazu {fremde.map((f) => f.text).join(', ')} – nicht umgerechnet</span> : null}
            </p>
          </Karten>

          <Karten>
            <KartenKopf titel="Reise aus diesem Blick nehmen" />
            <div className="flex flex-wrap gap-2 p-3">
              <Knopf ton="ghost" onClick={() => void store.reiseAendern(reise.id, { archived: !reise.archived })}>
                {reise.archived ? 'aus dem Archiv holen' : 'ins Archiv legen'}
              </Knopf>
              <Knopf ton="gefahr" onClick={() => setSperre(true)}>
                Reise löschen
              </Knopf>
            </div>
          </Karten>
        </div>
      </div>

      <Ablage
        offen={sperre}
        titel="Reise löschen?"
        schliessen={() => setSperre(false)}
        fuss={
          <>
            <Knopf ton="dezent" onClick={() => setSperre(false)}>
              behalten
            </Knopf>
            <Knopf
              ton="gefahr"
              onClick={async () => {
                setSperre(false);
                await store.reiseLoeschen(reise.id);
                router.push('/reisen');
              }}
            >
              löschen
            </Knopf>
          </>
        }
      >
        <p className="py-3 text-[14.5px] leading-relaxed text-[var(--text2)]">
          „{reise.name}“ mit {plural(eintraege.length, 'Eintrag', 'Einträgen')} wird entfernt. Ein Archiv legt die Reise nur ab – das ist der Schritt davor.
        </p>
      </Ablage>
    </main>
  );
}
