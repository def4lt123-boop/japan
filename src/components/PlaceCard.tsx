'use client';

import React, { useState } from 'react';
import type { Place } from '../lib/types';
import { useStore } from '../lib/store';
import { useEditor } from './EditorProvider';
import { STATUS_META, TICKET_META, categoryMeta, mapsUrl, nextTicket, routeUrl } from '../lib/categories';
import { fmtDay, knownCity } from '../lib/format';
import { Card, LinkTag, Menu, Money, Pill, PriorityTag, cx } from './ui';
import { MapPreview } from './MapPreview';
import { CategoryDot } from './CategoryDot';
import { Grip, useDrag } from './TouchDrag';

/** Kleiner Chip mit dem Buchungsstand – wird auch in den Panels der Reise-Seite genutzt. */
export function StatusPill({ status }: { status: Place['booking_status'] }) {
  const meta = STATUS_META[status] ?? STATUS_META.offen;
  return (
    <Pill className={meta.color} title={`Stand: ${meta.label}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
      {meta.label}
    </Pill>
  );
}

/**
 * Eine Aktivität als Karte: Nummer in der Tagesliste, Name, Preis, Ticket – und
 * rechts die drei Griffe (abhaken, Karte, mehr). Uhrzeiten gibt es nicht mehr,
 * die Reihenfolge macht den Tag.
 */
export function PlaceCard({
  place,
  showDate,
  draggable = true,
  dense = false,
  nr,
  onMove,
  onUp,
  onDown,
}: {
  place: Place;
  showDate?: boolean;
  draggable?: boolean;
  dense?: boolean;
  /** Stelle am Tag, 1 = erster Punkt */
  nr?: number;
  /** ◀ ▶: Eintrag einen Tag zurück/weiter schieben */
  onMove?: (dir: -1 | 1) => void;
  /** ▲▼: innerhalb des Tages rücken */
  onUp?: () => void;
  onDown?: () => void;
}) {
  const store = useStore();
  const { open } = useEditor();
  const drag = useDrag();
  const meta = categoryMeta(place.category);
  const ticket = TICKET_META[place.ticket_status ?? 'unklar'] ?? TICKET_META.unklar;
  const [showMap, setShowMap] = useState(false);
  const done = place.booking_status === 'erledigt';

  return (
    <Card
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', place.id);
        e.dataTransfer.effectAllowed = 'move';
        (e.currentTarget as HTMLElement).dataset.dragging = 'true';
      }}
      onDragEnd={(e) => delete (e.currentTarget as HTMLElement).dataset.dragging}
      className={cx('print-block group relative overflow-hidden border-l-[3px] transition hover:border-white/25', dense && 'border-l-2', done && 'opacity-70')}
      style={{ borderLeftColor: meta.color }}
    >
      <div className={cx('flex flex-wrap items-start gap-x-2.5 gap-y-1 px-3', dense ? 'py-2' : 'py-3')}>
        {draggable && drag ? <Grip grab={drag.grab} id={place.id} label={place.name} className="mt-0.5" /> : null}
        {nr ? <span className="mt-0.5 w-4 shrink-0 text-right text-[13px] tabular-nums text-slate-400" title={`Stelle ${nr}`}>{nr}</span> : null}
        <CategoryDot category={place.category} size={dense ? 19 : 23} className="mt-px" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <button
              onClick={() => open({ kind: 'place', id: place.id })}
              className="truncate text-left text-[14px] font-semibold text-white underline-offset-2 hover:underline"
              title="Bearbeiten"
            >
              {place.name}
            </button>
            <PriorityTag priority={place.priority} />
            {showDate && place.date ? <span className="text-[13px] text-slate-400">{fmtDay(place.date)}</span> : null}

          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-400">
            {knownCity(place.city) ? <span className="text-slate-300">{knownCity(place.city)}</span> : null}
            {nr && !showDate ? null : null}
            {place.price_eur !== null && place.price_eur !== undefined ? (
              <span className="text-slate-200">
                · <Money value={place.price_eur} />
                {place.price_note ? <span className="text-[13px] text-slate-400"> ({place.price_note})</span> : null}
              </span>
            ) : place.price_note ? (
              <span className="text-slate-300">· {place.price_note}</span>
            ) : null}
            <LinkTag href={mapsUrl(place)} title="In Google Maps öffnen">
              📍
            </LinkTag>
          </div>

          {place.notes ? <p className="mt-1.5 whitespace-pre-line text-[13px] leading-snug text-slate-300/90">{place.notes}</p> : null}

          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={cx('chip ring-1 transition hover:brightness-125', (STATUS_META[place.booking_status] ?? STATUS_META.offen).color)}
              title={done ? 'Abhaken: wieder auf „offen“ setzen' : 'Als erledigt markieren'}
              onClick={() => store.patch('places', place.id, { booking_status: done ? 'offen' : 'erledigt' })}
            >
              {done ? '✓' : '○'} {STATUS_META[place.booking_status]?.label ?? place.booking_status}
            </button>
            <button
              type="button"
              onClick={() => store.patch('places', place.id, { ticket_status: nextTicket(place.ticket_status) })}
              title={`${ticket.label} – klicken zum Weiterschalten (unklar → nötig → gekauft → keins)`}
              className={cx('chip ring-1 transition hover:brightness-125', ticket.chip)}
            >
              <span aria-hidden>{ticket.icon}</span>
              {ticket.short}
            </button>
            {place.ticket_note ? <span className="text-[13px] text-slate-400">{place.ticket_note}</span> : null}
            {place.image_url ? (
              <a href={place.image_url} target="_blank" rel="noreferrer" className="text-[13px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
                🖼 Bild
              </a>
            ) : null}
          </div>
        </div>

        <div className="no-print flex w-full shrink-0 flex-wrap items-center justify-end gap-1 opacity-70 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100 md:w-auto md:flex-nowrap md:items-start md:gap-0.5">
          {onUp || onDown ? (
            <span className="flex flex-row gap-1 md:mr-0.5 md:flex-col md:gap-0.5">
              <button className="icon-btn" title="eine Stelle höher" onClick={onUp} disabled={!onUp}>
                ▲
              </button>
              <button className="icon-btn" title="eine Stelle tiefer" onClick={onDown} disabled={!onDown}>
                ▼
              </button>
            </span>
          ) : null}
          {onMove ? (
            <span className="flex gap-1 md:mr-0.5 md:gap-0.5">
              <button className="icon-btn" title="einen Tag zurück" onClick={() => onMove(-1)}>
                ◀
              </button>
              <button className="icon-btn" title="einen Tag weiter" onClick={() => onMove(1)}>
                ▶
              </button>
            </span>
          ) : null}
          <button className={cx('icon-btn', showMap && '!bg-shu-500/25 !text-white')} title="Karte hier in der App zeigen" aria-expanded={showMap} onClick={() => setShowMap((v) => !v)}>
            🗺️
          </button>
          <Menu
            align="right"
            variant="quiet"
            icon="⋯"
            title="Mehr mit dieser Aktivität"
            items={[
              { icon: '✎', label: 'Bearbeiten', run: () => open({ kind: 'place', id: place.id }) },
              { icon: '🧭', label: 'Route ab Hotel', hint: 'In Google Maps öffnen', run: () => window.open(routeUrl(place), '_blank', 'noopener') },
              { icon: '⧉', label: 'Duplizieren', hint: 'liegt danach ohne Tag in der Liste', run: () => open({ kind: 'place', defaults: { ...place, id: undefined, date: null, name: `${place.name} (Kopie)` } }) },
              ...(place.date ? [{ icon: '⤓', label: 'Vom Tag lösen', hint: 'zurück in die Liste', run: () => store.patch('places', place.id, { date: null }) }] : []),
              ...(place.booking_url
                ? [{ icon: '🔗', label: 'Buchungsseite öffnen', href: place.booking_url.startsWith('http') ? place.booking_url : `https://${place.booking_url}` }]
                : []),
              ...(done ? [{ icon: '↺', label: 'Wieder auf offen setzen', run: () => store.patch('places', place.id, { booking_status: 'offen' }) }] : []),
            ]}
          />
        </div>
      </div>

      {showMap ? (
        <div className="border-t border-white/[0.07] p-2.5">
          <MapPreview
            place={place}
            query={`${place.name} ${place.city ?? ''}`.replace(/\s+/g, ' ').trim()}
            height={190}
            zoom={place.lat !== null ? 16 : 13}
            heading={place.name}
          />
        </div>
      ) : null}
    </Card>
  );
}
