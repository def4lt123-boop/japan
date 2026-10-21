'use client';

/**
 * Alle Aktivitäten als Liste untereinander: oben, was noch an keinem Tag sitzt,
 * darunter die Tage mit dem, was schon platziert ist. Ein Punkt kann genau an
 * einem Tag stehen – ein zweiter Eintrag mit demselben Namen an demselben Tag
 * wird abgewiesen. Uhrzeit + Dauer zeigen sofort, welcher Abschnitt blockiert ist.
 */
import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useBatchGeocode, useEditor } from '../../../../components/EditorProvider';
import { ActivityRow, DayRowHeader } from '../../../../components/ActivityRow';
import { FilterBar, EMPTY_FILTER, applyFilter, type PlaceFilter } from '../../../../components/filters';
import { Button, Card, Empty, SectionTitle, cx } from '../../../../components/ui';
import { distributePool } from '../../../../lib/planner';
import { eachDate, fmtDate, plural } from '../../../../lib/format';
import { assign, minToTime, plannedMinutes } from '../../../../lib/dayplan';

type View = 'alle' | 'offen' | 'platziert';

export default function ActivitiesPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const geocodeAll = useBatchGeocode(tripId);
  const [filter, setFilter] = useState<PlaceFilter>({ ...EMPTY_FILTER });
  const [view, setView] = useState<View>('alle');
  const [folded, setFolded] = useState<Record<string, boolean>>({});

  const dayOptions = useMemo(() => {
    const dates = eachDate(bundle.trip?.start_date, bundle.trip?.end_date);
    const extra = Array.from(new Set(bundle.places.map((p) => p.date).filter((d): d is string => Boolean(d)))).filter((d) => !dates.includes(d));
    return [...dates, ...extra.sort()].map((d) => ({ value: d, label: fmtDate(d, { weekday: 'short', day: '2-digit', month: '2-digit' }) }));
  }, [bundle.trip?.start_date, bundle.trip?.end_date, bundle.places]);

  const shown = useMemo(() => applyFilter(bundle.places, filter), [bundle.places, filter]);
  const open_ = useMemo(() => shown.filter((p) => !p.date), [shown]);
  const placed = useMemo(() => shown.filter((p) => p.date), [shown]);
  const byDay = useMemo(() => {
    const map = new Map<string, typeof placed>();
    for (const p of placed) map.set(p.date as string, [...(map.get(p.date as string) ?? []), p]);
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [placed]);

  const openMinutes = open_.reduce((sum, p) => sum + (p.duration_min ?? 90), 0);

  const runAutoPlan = () => {
    if (!bundle.trip) return;
    const updated = distributePool(bundle.places, bundle.trip.start_date, bundle.trip.end_date);
    const changed = updated.filter((p, i) => p.date !== bundle.places[i]?.date && p.date);
    if (!changed.length) {
      store.say('Nichts zu verteilen – alle Aktivitäten haben schon einen Tag (oder die Reise hat kein Datum).');
      return;
    }
    if (!window.confirm(`${plural(changed.length, 'Aktivität', 'Aktivitäten')} ohne Tag auf die Reisetage verteilen?`)) return;
    for (const p of changed) store.patch('places', p.id, { date: p.date });
    store.say(`${plural(changed.length, 'Aktivität', 'Aktivitäten')} verteilt.`);
  };

  if (!bundle.trip) return null;

  const tabs: { key: View; label: string }[] = [
    { key: 'alle', label: `Alle ${shown.length}` },
    { key: 'offen', label: `Ohne Tag ${open_.length}` },
    { key: 'platziert', label: `Am Tag ${placed.length}` },
  ];

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Aktivitäten"
        icon="🗂️"
        hint="Was noch keinen Tag hat, steht oben – ziehen, ⚡ verteilen oder in der Zeile auf einen Tag legen"
        right={
          <>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setView(t.key)}
                className={cx('rounded-lg px-2 py-1 text-[12px] ring-1 transition', view === t.key ? 'bg-shu-500/20 text-white ring-shu-400/40' : 'text-slate-300 ring-white/10 hover:bg-white/[0.06]')}
              >
                {t.label}
              </button>
            ))}
            {open_.length ? (
              <Button size="sm" variant="ghost" onClick={runAutoPlan}>
                ⚡ {open_.length} verteilen
              </Button>
            ) : null}
          </>
        }
      />

      <FilterBar value={filter} onChange={setFilter} places={bundle.places} />

      <p className="-mt-1 text-[11.5px] text-slate-500">
        {open_.length ? <>{open_.length} ohne Tag · {Math.round(openMinutes / 60)} h zu verteilen · </> : 'jeder Punkt hat einen Tag · '}
        {placed.length} platziert auf {byDay.length} {plural(byDay.length, 'Tag', 'Tagen')}
      </p>

      {!shown.length ? (
        <Empty
          title={filter.q || filter.city || filter.ticket ? 'Keine Treffer im Filter' : 'Noch keine Aktivität'}
          hint={filter.q || filter.city || filter.ticket ? 'Filter oben zurücksetzen.' : 'Lege den ersten Punkt an – ohne Tag, der Tag kommt später.'}
          action={
            <Button variant="primary" onClick={() => open({ kind: 'place' })}>
              ＋ Aktivität anlegen
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {view !== 'platziert' ? (
            <Card className="p-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-t-lg border-b border-white/[0.07] bg-amber-500/[0.07] px-2.5 py-1.5">
                <h3 className="text-[12.5px] font-semibold text-amber-100">✨ Noch ohne Tag</h3>
                <span className="text-[11.5px] text-amber-100/70">{plural(open_.length, 'Punkt', 'Punkte')} · {Math.round(openMinutes / 60)} h warten</span>
                {open_.length ? (
                  <button className="ml-auto text-[11.5px] text-amber-200/90 underline-offset-2 hover:text-white hover:underline" onClick={() => setFolded((f) => ({ ...f, offen: !f.offen }))}>
                    {folded.offen ? 'alle zeigen' : 'einklappen'}
                  </button>
                ) : null}
              </div>
              {open_.length ? (
                <div className="space-y-1.5 p-2">
                  {(folded.offen ? open_.slice(0, 6) : open_).map((p) => (
                    <ActivityRow key={p.id} place={p} all={bundle.places} dayOptions={dayOptions} tripStart={bundle.trip?.start_date} tripEnd={bundle.trip?.end_date} />
                  ))}
                  {folded.offen && open_.length > 6 ? (
                    <p className="px-1 text-[11px] text-slate-500">… {open_.length - 6} weitere – „alle zeigen“.</p>
                  ) : null}
                </div>
              ) : (
                <p className="px-2.5 py-3 text-[12.5px] text-slate-400">🎉 Nichts mehr offen – jeder Punkt hat einen Tag. Neue Aktivität rechts oben anlegen.</p>
              )}
            </Card>
          ) : null}

          {view !== 'offen' ? (
            byDay.length ? (
              byDay.map(([date, list]) => (
                <Card key={date} className="p-0">
                  <DayRowHeader
                    date={date}
                    places={list}
                    onPickSlot={(m) => {
                      const candidate = open_[0];
                      if (candidate) assign(store, bundle.places, candidate, { date, start_time: minToTime(m) });
                    }}
                    note={
                      <span className="text-slate-400">
                        {plural(list.length, 'Aktivität', 'Aktivitäten')} · {Math.round(plannedMinutes(list) / 60)} h verplant
                      </span>
                    }
                  />
                  <div className="space-y-1.5 p-2">
                    {list
                      .slice()
                      .sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99'))
                      .map((p) => (
                        <ActivityRow key={p.id} place={p} all={bundle.places} dayOptions={dayOptions} dense tripStart={bundle.trip?.start_date} tripEnd={bundle.trip?.end_date} />
                      ))}
                  </div>
                </Card>
              ))
            ) : (
              <Card className="p-3">
                <p className="text-[12.5px] text-slate-400">Noch ist nichts platziert – zieh in der Liste oben einen Punkt auf einen Tag oder wähle rechts den Tag.</p>
              </Card>
            )
          ) : null}
        </div>
      )}
    </div>
  );
}
