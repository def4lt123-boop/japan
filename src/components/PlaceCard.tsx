'use client';

import React, { useState } from 'react';
import type { Place } from '../lib/types';
import { useStore } from '../lib/store';
import { useEditor } from './EditorProvider';
import { PRIORITY_META, STATUS_META, TICKET_META, categoryMeta, mapsUrl, nextTicket, routeUrl } from '../lib/categories';
import { fmtDuration, fmtDate } from '../lib/format';
import { fmtWindow, windowOf } from '../lib/dayplan';
import { Button, Card, LinkTag, Money, Pill, cx } from './ui';
import { MapPreview } from './MapPreview';

export function StatusPill({ status }: { status: Place['booking_status'] }) {
  const meta = STATUS_META[status];
  return (
    <Pill className={meta.color} title={`Status: ${meta.label}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </Pill>
  );
}

export function PlaceCard({
  place,
  showDate,
  draggable = true,
  dense = false,
  onMove,
}: {
  place: Place;
  showDate?: boolean;
  draggable?: boolean;
  dense?: boolean;
  /** ◀ ▶: Eintrag einen Tag zurück/weiter schieben */
  onMove?: (dir: -1 | 1) => void;
}) {
  const store = useStore();
  const { open } = useEditor();
  const meta = categoryMeta(place.category);
  const prio = PRIORITY_META[place.priority] ?? PRIORITY_META.soll;
  const [showMap, setShowMap] = useState(false);

  return (
    <Card
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', place.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).dataset.dragging = 'true';
      }}
      onDragEnd={(e) => delete (e.currentTarget as HTMLElement).dataset.dragging}
      className={cx('print-block group relative overflow-hidden border-l-[3px] transition hover:border-white/25', dense && 'border-l-2')}
      style={{ borderLeftColor: meta.color }}
    >
      <div className={cx('flex items-start gap-2.5', dense ? 'px-2.5 py-2' : 'px-3 py-2.5')}>
        <span aria-hidden className={cx('shrink-0 select-none', dense ? 'text-base' : 'text-lg leading-6')} title={meta.label}>
          {meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button
              onClick={() => open({ kind: 'place', id: place.id })}
              className="truncate text-left text-[14px] font-semibold text-white underline-offset-2 hover:underline"
              title="Bearbeiten"
            >
              {place.name}
            </button>
            {place.priority !== 'kann' ? (
              <span className="text-[11px] text-shu-300" title={`Priorität: ${prio.label}`}>
                {prio.icon} {prio.label}
              </span>
            ) : null}
            {showDate && place.date ? <span className="text-[11px] text-slate-400">{fmtDate(place.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}</span> : null}
            {place.date && place.end_date && place.end_date !== place.date ? (
              <span className="text-[11px] text-slate-400" title="Mehrtages-Eintrag">
                → {fmtDate(place.end_date, { day: '2-digit', month: '2-digit' })}
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-slate-400">
            {place.city ? <span className="text-slate-300">{place.city}</span> : null}
            {place.district ? <span className="text-slate-500">· {place.district}</span> : null}
            {place.time_slot ? <span>· {place.time_slot}</span> : null}
            {place.start_time && place.duration_min ? (
              <span className="tabular-nums text-slate-300">· {fmtWindow(windowOf(place)!.start, windowOf(place)!.end)}</span>
            ) : place.start_time ? (
              <span className="tabular-nums text-slate-300">· {place.start_time} Uhr</span>
            ) : null}
            {place.duration_min && !place.start_time ? <span>· {fmtDuration(place.duration_min)}</span> : null}
            {place.travel_time ? <span title="Fahrzeit vom Hotel">· 🚈 {place.travel_time}</span> : null}
            {place.category && !place.category.startsWith(meta.label) ? <span className="text-slate-500">· {place.category}</span> : null}
          </div>

          {place.notes ? <p className="mt-1.5 whitespace-pre-line text-[12.5px] leading-snug text-slate-300/90">{place.notes}</p> : null}

          {place.ticket_note ? <p className="mt-1 text-[11.5px] text-slate-400">🎟 {place.ticket_note}</p> : null}

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <StatusPill status={place.booking_status} />
            <button
              onClick={() => store.patch('places', place.id, { ticket_status: nextTicket(place.ticket_status) })}
              title={`${(TICKET_META[place.ticket_status ?? 'unklar'] ?? TICKET_META.unklar).label} – klicken zum Weiterschalten (unklar → nötig → gekauft → keins)`}
              className={cx('chip ring-1 transition hover:brightness-125', (TICKET_META[place.ticket_status ?? 'unklar'] ?? TICKET_META.unklar).chip)}
            >
              <span aria-hidden>{(TICKET_META[place.ticket_status ?? 'unklar'] ?? TICKET_META.unklar).icon}</span>
              {(TICKET_META[place.ticket_status ?? 'unklar'] ?? TICKET_META.unklar).short}
            </button>
            {place.price_eur !== null && place.price_eur !== undefined ? (
              <Pill className="bg-white/[0.05] text-slate-200 ring-white/10">
                <Money value={place.price_eur} />
                {place.price_note ? <span className="ml-1 text-[10.5px] text-slate-400">{place.price_note}</span> : null}
              </Pill>
            ) : place.price_note ? (
              <Pill className="bg-white/[0.05] text-slate-300 ring-white/10">{place.price_note}</Pill>
            ) : null}
            {place.image_url ? (
              <a href={place.image_url} target="_blank" rel="noreferrer" className="text-[11.5px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
                🖼 Bild
              </a>
            ) : null}
            <LinkTag href={mapsUrl(place)} title="In Google Maps öffnen">📍 Maps</LinkTag>
            <LinkTag href={routeUrl(place)} title="Route in Google Maps">🧭 Route</LinkTag>
            {place.booking_url ? (
              <LinkTag href={place.booking_url.startsWith('http') ? place.booking_url : `https://${place.booking_url}`} title="Buchungsseite öffnen">
                🔗 Buchen
              </LinkTag>
            ) : null}
          </div>
        </div>

        <div className="no-print flex shrink-0 flex-col items-end gap-1 opacity-70 transition group-hover:opacity-100">
          {onMove ? (
            <span className="flex gap-0.5">
              <Button size="sm" variant="quiet" title="einen Tag zurück" onClick={() => onMove(-1)}>
                ◀
              </Button>
              <Button size="sm" variant="quiet" title="einen Tag weiter" onClick={() => onMove(1)}>
                ▶
              </Button>
            </span>
          ) : null}
          {place.booking_status !== 'erledigt' ? (
            <Button size="sm" variant="quiet" title="Als erledigt markieren" onClick={() => store.patch('places', place.id, { booking_status: 'erledigt' })}>
              ✓
            </Button>
          ) : (
            <Button size="sm" variant="quiet" title="Wieder auf offen setzen" onClick={() => store.patch('places', place.id, { booking_status: 'offen' })}>
              ↺
            </Button>
          )}
          <Button size="sm" variant="quiet" title="Bearbeiten" onClick={() => open({ kind: 'place', id: place.id })}>
            ✎
          </Button>
          <Button
            size="sm"
            variant="quiet"
            title="Duplizieren (neue Aktivität ohne Tag – liegt danach in der Liste)"
            onClick={() =>
              open({
                kind: 'place',
                defaults: { ...place, id: undefined, date: null, name: `${place.name} (Kopie)` },
              })
            }
          >
            ⧉
          </Button>
          {place.date ? (
            <Button size="sm" variant="quiet" title="Von diesem Tag lösen → zurück in die Liste" onClick={() => store.patch('places', place.id, { date: null })}>
              ⤓
            </Button>
          ) : null}
          <Button
            size="sm"
            variant={showMap ? 'primary' : 'quiet'}
            title="Karte hier in der App zeigen"
            onClick={() => setShowMap((v) => !v)}
            aria-expanded={showMap}
          >
            🗺️
          </Button>
        </div>
      </div>

      {showMap ? (
        <div className="border-t border-white/[0.07] p-2.5">
          <MapPreview
            place={place}
            query={`${place.name} ${place.district ?? ''} ${place.city ?? ''}`.replace(/\s+/g, ' ').trim()}
            height={190}
            zoom={place.lat !== null ? 16 : 13}
            heading={place.name}
          />
        </div>
      ) : null}
    </Card>
  );
}
