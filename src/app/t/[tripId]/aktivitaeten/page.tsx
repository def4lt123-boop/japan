'use client';

/**
 * Alle Aktivitäten als Liste untereinander: oben, was noch an keinem Tag sitzt,
 * darunter die Tage mit dem, was schon platziert ist – der Reihe nach, ohne
 * Uhrzeiten. Ein Punkt kann genau an einem Tag stehen; derselbe Name zweimal am
 * selben Tag ist ein Duplikat und wird abgewiesen.
 *
 * Vorn steht bewusst wenig: ein Titel mit der Zahl, eine Filterreihe, eine Zeile
 * Suche. Der Erklärtext liegt hinter ⓘ, der leere „Noch ohne Tag"-Kasten gar nicht.
 */
import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { ActivityRow, DayRowHeader } from '../../../../components/ActivityRow';
import { FilterBar, EMPTY_FILTER, applyFilter, filterActive, type PlaceFilter } from '../../../../components/filters';
import { Button, Card, Empty, SectionTitle } from '../../../../components/ui';
import { eachDate, fmtDate, plural } from '../../../../lib/format';
import { assign, dayPlaces } from '../../../../lib/dayplan';

const HINWEIS = 'Was noch keinen Tag hat, steht oben – in der Zeile den Tag wählen oder auf einen Tag ziehen. Punkte am Tag sind die Reihenfolge des Tages.';

export default function ActivitiesPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [filter, setFilter] = useState<PlaceFilter>({ ...EMPTY_FILTER });
  const [info, setInfo] = useState(false);
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

  if (!bundle.trip) return null;

  return (
    <div className="space-y-3">
      <SectionTitle
        title="Aktivitäten"
        icon="🗂️"
        hint={info ? HINWEIS : undefined}
        right={
          <>
            <span className="text-[11.5px] text-slate-500">
              {shown.length} {shown.length === 1 ? 'Punkt' : 'Punkte'} · {placed.length} verteilt
            </span>
            <button
              className="icon-btn"
              aria-expanded={info}
              title={info ? 'Erklärung wieder wegklappen' : 'Wie das hier gemeint ist'}
              onClick={() => setInfo((v) => !v)}
            >
              ⓘ
            </button>
          </>
        }
      />

      <FilterBar value={filter} onChange={setFilter} places={bundle.places} />

      {!shown.length ? (
        <Empty
          title={filterActive(filter) ? 'Keine Treffer im Filter' : 'Noch keine Aktivität'}
          hint={filterActive(filter) ? 'Filter oben zurücksetzen – „Alle" zeigt wieder alles.' : 'Lege den ersten Punkt an – ohne Tag, der Tag kommt später.'}
          action={
            <Button variant="primary" onClick={() => open({ kind: 'place' })}>
              ＋ Idee
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {open_.length ? (
            <Card className="p-0" data-offen={open_.length}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-t-lg border-b border-white/[0.07] bg-amber-500/[0.07] px-2.5 py-1.5">
                <h3 className="text-[12.5px] font-semibold text-amber-100">✨ Noch ohne Tag</h3>
                <span className="text-[11.5px] text-amber-100/70">{plural(open_.length, 'Punkt', 'Punkte')}</span>
                {open_.length > 6 ? (
                  <button className="ml-auto text-[11.5px] text-amber-200/90 underline-offset-2 hover:text-white hover:underline" onClick={() => setFolded((f) => ({ ...f, offen: !f.offen }))}>
                    {folded.offen ? 'alle zeigen' : 'einklappen'}
                  </button>
                ) : null}
              </div>
              <div className="space-y-1.5 p-2">
                {(folded.offen ? open_.slice(0, 6) : open_).map((p) => (
                  <ActivityRow key={p.id} place={p} all={bundle.places} dayOptions={dayOptions} tripStart={bundle.trip?.start_date} tripEnd={bundle.trip?.end_date} />
                ))}
                {folded.offen && open_.length > 6 ? (
                  <p className="px-1 text-[11px] text-slate-500">… {open_.length - 6} weitere – „alle zeigen".</p>
                ) : null}
              </div>
            </Card>
          ) : null}

          {byDay.length ? (
            byDay.map(([date, list]) => (
              <Card key={date} className="p-0" data-tag={date}>
                <DayRowHeader
                  date={date}
                  places={list}
                  right={
                    open_.length ? (
                      <button
                        className="btn-quiet !px-1.5 !py-0.5 !text-[11px]"
                        title="Obersten Punkt aus der Liste oben ans Ende dieses Tages legen"
                        onClick={() => {
                          const candidate = open_.find((c) => c.city === list[0]?.city) ?? open_[0];
                          if (candidate) assign(store, bundle.places, candidate, { date });
                        }}
                      >
                        ✨ Wunsch hierher
                      </button>
                    ) : null
                  }
                />
                <div className="space-y-1.5 p-2">
                  {dayPlaces(bundle.places, date).map((p, i, arr) => (
                    <ActivityRow
                      key={p.id}
                      place={p}
                      all={bundle.places}
                      dayOptions={dayOptions}
                      dense
                      tripStart={bundle.trip?.start_date}
                      tripEnd={bundle.trip?.end_date}
                      nr={i + 1}
                      total={arr.length}
                    />
                  ))}
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-3">
              <p className="text-[12.5px] text-slate-400">Noch ist nichts an einem Tag – in der Zeile den Tag wählen oder den Punkt auf einen Tag ziehen.</p>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
