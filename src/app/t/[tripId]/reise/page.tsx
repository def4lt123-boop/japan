'use client';

/**
 * „Reise“ bündelt, was um die Tage herum passiert: das Bett, die Wege dazwischen,
 * das Geld – und darunter die Dateien für andere Geräte.
 */
import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Button, Card, SectionTitle, Seg } from '../../../../components/ui';
import { download, hotelCsv, jsonExport, journeyCsv, placeCsv } from '../../../../lib/export';
import { placesToKml } from '../../../../lib/maps';
import HotelsPanel from '../unterkuenfte/page';
import JourneysPanel from '../verlauf/page';
import CostsPanel from '../kosten/page';

type Panel = 'betten' | 'wege' | 'geld';

export default function TripPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [panel, setPanel] = useState<Panel>('betten');

  const files = useMemo(
    () => [
      { label: 'Aktivitäten (CSV)', hint: 'alle Felder, Semikolon, de-DE', run: () => download(`${tripId}-aktivitaeten.csv`, placeCsv(bundle.places, bundle.hotels)) },
      { label: 'Unterkünfte (CSV)', hint: 'Nächte, Preise, Adresse', run: () => download(`${tripId}-hotels.csv`, hotelCsv(bundle.hotels)) },
      { label: 'Fahrten (CSV)', hint: 'Flüge, Züge, Fähren', run: () => download(`${tripId}-fahrten.csv`, journeyCsv(bundle.journeys)) },
      { label: 'Google Maps (KML)', hint: 'in Google My Maps laden – alle Punkte auf einer Karte', run: () => download(`${tripId}-kml.kml`, placesToKml(bundle.places, bundle.trip?.name ?? 'Reise'), 'application/vnd.google-earth.kml+xml') },
      { label: 'Alles (JSON)', hint: 'zum Weitersichern – geht auch wieder rein', run: () => download(`${tripId}.json`, jsonExport(bundle), 'application/json') },
      { label: '⇪ Etwas einfügen', hint: 'CSV, Textzeilen oder die Sicherung – Vorschau, dann Klick', icon: '⇪', run: () => open({ kind: 'import', target: 'places' }) },
    ],
    [bundle, tripId],
  );

  const noDate = bundle.trip && !bundle.trip.start_date;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Reise"
        icon="🧳"
        hint="Bett, Wege, Geld – alles, was um die Tage herum dazugehört."
        right={
          <>
            <Button size="sm" variant="ghost" onClick={() => open({ kind: 'trip', id: tripId })}>
              ⚙ Zeitraum & Budget
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              🖨 Drucken
            </Button>
          </>
        }
      />

      {noDate ? (
        <Card className="flex flex-wrap items-center gap-2 border-amber-400/25 bg-amber-500/[0.06] p-3">
          <span className="text-[13px] text-amber-100">Für diese Reise steht noch kein Zeitraum fest – ohne ihn gibt es keine Tagesliste zum Planen.</span>
          <Button size="sm" variant="primary" className="ml-auto" onClick={() => open({ kind: 'trip', id: tripId })}>
            Zeitraum eintragen
          </Button>
        </Card>
      ) : null}

      <Seg
        className="w-full overflow-x-auto"
        options={[
          { value: 'betten' as Panel, label: `🏨 Unterkünfte · ${bundle.hotels.length}` },
          { value: 'wege' as Panel, label: `🚄 Fahrten · ${bundle.journeys.length}` },
          { value: 'geld' as Panel, label: '💶 Kosten' },
        ]}
        value={panel}
        onChange={setPanel}
      />

      {panel === 'betten' ? <HotelsPanel /> : panel === 'wege' ? <JourneysPanel /> : <CostsPanel />}

      <Card id="export" className="scroll-mt-24 p-4">
        <SectionTitle title="Dateien" icon="⇩" hint="Zum Weitergeben, für Google Maps oder als Sicherung – die App bleibt das Original." />
        <ul className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
          {files.map((f) => (
            <li key={f.label}>
              <button
                onClick={f.run}
                className="flex w-full items-start gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.05]"
              >
                <span aria-hidden className="mt-0.5 text-[13px] text-slate-500">
                  {f.icon ?? '⇩'}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-slate-100">{f.label}</span>
                  <span className="block text-[11.5px] leading-snug text-slate-500">{f.hint}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
