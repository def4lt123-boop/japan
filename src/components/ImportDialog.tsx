'use client';

/**
 * Einfügen aus Text, CSV oder der eigenen Sicherung – dieselben Spalten, die der Export
 * schreibt. Erst Vorschau, dann Klick: nichts landet in der Reise, was nicht gezeigt wurde.
 */
import React, { useMemo, useRef, useState } from 'react';
import { useStore } from '../lib/store';
import { Button, Disclosure, Modal, Pill, Seg, cx } from './ui';
import { EXPORT_HINT, planImport, type ImportTarget } from '../lib/import';
import { plural, uid } from '../lib/format';
import type { Hotel, Journey, Place } from '../lib/types';

const SAMPLE: Record<ImportTarget, string> = {
  places: [
    'Datum;Aktivität;Kategorie;Stadt;Hinweise;Preis EUR;Status;Prio;Ticket',
    '24.10.2027;Fushimi Inari;Tempel & Schrein;Kyoto;Sonnenaufgang, vor 6 Uhr frei;;offen;muss;keins',
    '25.10.2027;Nishiki Markt;Essen & Trinken;Kyoto;;8;erledigt;soll;unklar',
  ].join('\n'),
  hotels: [
    'Check-in;Check-out;Unterkunft;Stadt;Preis EUR;Status;Adresse',
    '24.10.2027;27.10.2027;Hotel Kyoto;Kyoto;180;gebucht;Karasuma 3-3-5',
  ].join('\n'),
  journeys: [
    'Datum;Fahrt;Von;Nach;Art;Abflug;Dauer (min);Preis EUR',
    '24.10.2027;Ankunft KIX;Frankfurt;Tokio;Flug;06:40;700;540',
  ].join('\n'),
};

const TITEL: Record<ImportTarget, string> = { places: 'Aktivitäten', hotels: 'Unterkünfte', journeys: 'Fahrten' };
const LABEL: Record<ImportTarget, string> = { places: 'Punkt', hotels: 'Bett', journeys: 'Fahrt' };

const STATUS_TONE: Record<string, string> = {
  neu: 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/40',
  duplikat: 'bg-white/[0.06] text-slate-300 ring-white/15',
  'ohne namen': 'bg-amber-500/15 text-amber-100 ring-amber-400/30',
};

export function ImportDialog({ tripId, target = 'places', onClose }: { tripId: string; target?: ImportTarget; onClose: () => void }) {
  const store = useStore();
  const [kind, setKind] = useState<ImportTarget>(target);
  const [text, setText] = useState('');
  const [allowDupes, setAllowDupes] = useState(false);
  const [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const bundle = useMemo(
    () => ({
      trip: store.trips.find((t) => t.id === tripId),
      places: store.places.filter((p) => p.trip_id === tripId),
      hotels: store.hotels.filter((h) => h.trip_id === tripId),
      journeys: store.journeys.filter((j) => j.trip_id === tripId),
    }),
    [store.trips, store.places, store.hotels, store.journeys, tripId],
  );

  const plan = useMemo(() => planImport(text, kind, { ...bundle, tripId }), [text, kind, bundle]);
  const chosen = plan.rows.filter((r) => r.status === 'neu' || (allowDupes && r.status === 'duplikat'));
  const ohneTag = kind === 'places' ? chosen.filter((r) => !(r.value as Place).date).length : 0;
  const neuCount = plan.rows.filter((r) => r.status === 'neu').length;

  async function insert() {
    if (!chosen.length || busy) return;
    setBusy(true);
    try {
      const values = chosen.map((r) => ({ ...r.value, id: uid(kind === 'places' ? 'pl' : kind === 'hotels' ? 'ht' : 'jr') })) as never as (Place & Hotel & Journey)[];
      if (kind === 'places') await store.bulkCreate('places', values as unknown as Place[]);
      else if (kind === 'hotels') await store.bulkCreate('hotels', values as unknown as Hotel[]);
      else await store.bulkCreate('journeys', values as unknown as Journey[]);
      store.say(
        `${plural(values.length, LABEL[kind], TITEL[kind])} eingefügt${ohneTag ? ` · ${plural(ohneTag, 'einer', 'mehrere')} ohne Tag` : ''} – oben in der Liste, noch ohne Platz am Tag.`,
      );
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Einfügen – ${TITEL[kind]}`}
      subtitle="CSV aus Excel oder Numbers, der eigene Export, Zeilen aus den Notizen oder die JSON-Sicherung. Spaltenfolgen sind egal."
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-slate-500">
            {plan.total
              ? `${plural(plan.total, 'Zeile', 'Zeilen')} gelesen · ${plural(neuCount, 'Neuer', 'Neue')} · ${plan.rows.filter((r) => r.status === 'duplikat').length} schon da`
              : 'noch nichts eingefügt'}
          </span>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" disabled={!chosen.length || busy} onClick={() => void insert()}>
            {busy ? '…' : `⇪ ${chosen.length ? plural(chosen.length, LABEL[kind], TITEL[kind]) : 'einfügen'}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Seg
            title="Was soll eingefügt werden?"
            options={[
              { value: 'places' as ImportTarget, label: `🗺️ ${TITEL.places}` },
              { value: 'hotels' as ImportTarget, label: `🏨 ${TITEL.hotels}` },
              { value: 'journeys' as ImportTarget, label: `🚄 ${TITEL.journeys}` },
            ]}
            value={kind}
            onChange={setKind}
          />
          <input
            ref={file}
            type="file"
            accept=".csv,.txt,.json,text/csv,application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setText(await f.text());
            }}
          />
          <Button size="sm" variant="ghost" onClick={() => file.current?.click()}>
            📁 Datei wählen
          </Button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={7}
          spellCheck={false}
          placeholder={`${EXPORT_HINT[kind]}\n\nEinfach hier reinkleben – eine Zeile pro ${LABEL[kind]}.`}
          className="input w-full font-mono !text-[11.5px] leading-relaxed"
        />

        {plan.problems.length ? (
          <ul className="space-y-1 rounded-xl border border-amber-400/25 bg-amber-500/[0.06] px-3 py-2 text-[11.5px] text-amber-100">
            {plan.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : null}

        {plan.total ? (
          <>
            <div className="flex flex-wrap items-center gap-1.5 text-[11.5px]">
              <Pill className="bg-emerald-500/15 text-emerald-100">{plural(neuCount, LABEL[kind], TITEL[kind])} neu</Pill>
              {plan.rows.some((r) => r.status === 'duplikat') ? (
                <label className="flex cursor-pointer items-center gap-1.5 text-slate-400">
                  <input type="checkbox" checked={allowDupes} onChange={(e) => setAllowDupes(e.target.checked)} className="h-3.5 w-3.5 accent-emerald-400" />
                  die {plan.rows.filter((r) => r.status === 'duplikat').length} vorhandenen trotzdem noch einmal
                </label>
              ) : null}
              {ohneTag ? <span className="text-slate-500">· {plural(ohneTag, 'einer', 'welche')} ohne Tag → kommen in die Liste</span> : null}
              {plan.columns.length ? <span className="ml-auto text-slate-500">{plural(plan.columns.length, 'Spalte', 'Spalten')} gelesen</span> : null}
            </div>
            <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
              {plan.rows.slice(0, 200).map((r) => (
                <li
                  key={r.index}
                  className={cx(
                    'flex flex-wrap items-baseline gap-x-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5',
                    r.status === 'neu' && 'border-emerald-400/20',
                  )}
                >
                  <span className="text-[12.5px] font-medium text-slate-100">{r.label}</span>
                  <span className="text-[11.5px] text-slate-500">{r.sub}</span>
                  {r.note ? <span className="text-[11px] text-amber-200/90">{r.note}</span> : null}
                  <span className={cx('chip ml-auto ring-1', STATUS_TONE[r.status])}>{r.status}</span>
                </li>
              ))}
              {plan.rows.length > 200 ? <li className="text-[11.5px] text-slate-500">… und {plan.rows.length - 200} weitere Zeilen</li> : null}
            </ul>
          </>
        ) : (
          <Disclosure title="Wie die Zeilen aussehen können" hint="Der Export aus dieser App passt 1:1 – Überschriften sind aber nicht nötig.">
            <pre className="overflow-x-auto rounded-lg bg-black/30 p-2 text-[11px] leading-relaxed text-slate-300">{SAMPLE[kind]}</pre>
            <button
              type="button"
              onClick={() => setText(SAMPLE[kind])}
              className="mt-1.5 text-[11.5px] text-slate-400 underline-offset-2 hover:text-slate-100 hover:underline"
            >
              dieses Beispiel ins Feld
            </button>
          </Disclosure>
        )}
      </div>
    </Modal>
  );
}
