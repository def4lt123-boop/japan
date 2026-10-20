'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useBatchGeocode, useEditor } from '../../../../components/EditorProvider';
import { PlaceCard } from '../../../../components/PlaceCard';
import { FilterBar, EMPTY_FILTER, applyFilter, type PlaceFilter } from '../../../../components/filters';
import { Button, Card, Empty, SectionTitle, Select, cx } from '../../../../components/ui';
import { distributePool } from '../../../../lib/planner';
import { eachDate, fmtDate, plural } from '../../../../lib/format';
import { categoryMeta } from '../../../../lib/categories';

export default function WishlistPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const geocodeAll = useBatchGeocode(tripId);
  const [filter, setFilter] = useState<PlaceFilter>({ ...EMPTY_FILTER, missing: 'ohne-termin' });
  const [grouped, setGrouped] = useState(true);

  const dayOptions = useMemo(() => {
    const dates = eachDate(bundle.trip?.start_date, bundle.trip?.end_date);
    return dates.map((d) => ({ value: d, label: fmtDate(d, { weekday: 'short', day: '2-digit', month: '2-digit' }) }));
  }, [bundle.trip?.start_date, bundle.trip?.end_date]);

  const shown = useMemo(() => applyFilter(bundle.places, filter), [bundle.places, filter]);
  const byCity = useMemo(() => {
    const map = new Map<string, typeof shown>();
    for (const p of shown) {
      const key = p.city || '—';
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return Array.from(map.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [shown]);

  const runAutoPlan = () => {
    if (!bundle.trip) return;
    const updated = distributePool(bundle.places, bundle.trip.start_date, bundle.trip.end_date);
    const changed = updated.filter((p, i) => p.date !== bundle.places[i]?.date && p.date);
    if (!changed.length) {
      store.say('Nichts zu verteilen – alle Einträge haben schon einen Tag (oder die Reise hat kein Datum).');
      return;
    }
    if (!window.confirm(`${changed.length} Einträge ohne Tag auf die Reisetage verteilen?`)) return;
    for (const p of changed) store.patch('places', p.id, { date: p.date });
    store.say(`${plural(changed.length, 'Eintrag', 'Einträge')} verteilt.`);
  };

  if (!bundle.trip) return null;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Wünscheliste & Pool"
        icon="✨"
        hint="Alle Orte ohne Tag warten hier. Per Dropdown einem Tag zuweisen, insel-weise ziehen oder automatisch verteilen lassen."
        right={
          <>
            <Button size="sm" variant="ghost" onClick={() => setGrouped((g) => !g)}>
              {grouped ? 'Liste' : 'nach Stadt'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void geocodeAll()} title="Offene Koordinaten über OpenStreetMap suchen">
              🌍 Geocodieren
            </Button>
            <Button size="sm" variant="ghost" onClick={runAutoPlan}>
              ⚡ Automatisch verteilen
            </Button>
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'place' })}>
              ＋ Neuer Wunsch
            </Button>
          </>
        }
      />

      <FilterBar value={filter} onChange={setFilter} places={bundle.places} />

      {!shown.length ? (
        <Empty
          title={filter.q || filter.city ? 'Keine Treffer' : 'Nichts mehr in der Wünscheliste 🎉'}
          hint={filter.q || filter.city ? 'Filter anpassen – oder neue Einträge anlegen.' : 'Jeder Ort hat einen Tag. Neuen Wunsch unten anlegen, wenn doch noch etwas dazu soll.'}
          action={
            <Button variant="primary" onClick={() => open({ kind: 'place' })}>
              ＋ Eintrag anlegen
            </Button>
          }
        />
      ) : !grouped ? (
        <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-3">
          {shown.map((p) => (
            <div key={p.id} className="space-y-1">
              <PlaceCard place={p} dense showDate />
              <AssignBar place={p} options={dayOptions} />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {byCity.map(([city, list]) => (
            <Card key={city} className="p-3">
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-white">{city}</h3>
                <span className="chip bg-white/[0.05] text-slate-300 ring-white/10">{plural(list.length, 'Ort', 'Orte')}</span>
                <span className="ml-auto flex flex-wrap gap-1 text-[11px] text-slate-500">
                  {Array.from(new Set(list.map((p) => categoryMeta(p.category).icon))).join(' ')}
                </span>
              </div>
              <div className="grid gap-2 xl:grid-cols-2">
                {list.map((p) => (
                  <div key={p.id} className={cx('space-y-1 rounded-lg bg-white/[0.02] p-1')}>
                    <PlaceCard place={p} dense />
                    <AssignBar place={p} options={dayOptions} />
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AssignBar({ place, options }: { place: { id: string; date: string | null; name: string }; options: { value: string; label: string }[] }) {
  const store = useStore();
  if (!options.length) return null;
  return (
    <div className="no-print flex items-center gap-1.5 px-1 pb-1">
      <span className="text-[11px] text-slate-500">Tag:</span>
      <Select
        className="!w-auto !py-1 !text-[12px]"
        allowEmpty
        emptyLabel="kein Tag"
        options={options}
        value={place.date ?? ''}
        onChange={(e) => {
          store.patch('places', place.id, { date: e.target.value || null });
          store.say(e.target.value ? `„${place.name}“ → ${fmtDate(e.target.value, { weekday: 'long', day: '2-digit', month: 'long' })}` : `„${place.name}“ zurück in der Liste.`);
        }}
      />
    </div>
  );
}
