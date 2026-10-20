'use client';

/**
 * Google-Maps-Karten, die mitten in der App laufen – ohne Schlüssel, ohne Abrechnung.
 *   <MapPreview>   ein Punkt oder eine Suche, live während der Eingabe
 *   <RoutePreview> der Weg über die Punkte eines Tages
 * Beide haben oben rechts den Link „bei Google Maps öffnen", damit man in der großen
 * Karte weiterarbeiten kann (Straßen, Öffnungszeiten, Navi).
 */
import React, { useEffect, useState } from 'react';
import { mapsEmbedUrl, mapsLink, queryEmbedUrl, routeEmbedUrl, routeUrl, type MapsPoint, type TravelMode } from '../lib/maps';
import { cx } from './ui';

type Node = MapsPoint & { name?: string | null };

function useDebounced<T>(value: T, ms = 450): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function Frame({
  src,
  href,
  heading,
  height,
  hint,
  onRefresh,
}: {
  src: string;
  href: string;
  heading: string;
  height: number;
  hint?: React.ReactNode;
  onRefresh?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => setLoaded(false), [src]);
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/25">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-white/[0.07] px-2.5 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Google Maps</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-slate-300" title={heading}>
          {heading}
        </span>
        {hint ? <span className="shrink-0 text-[11px] text-slate-500">{hint}</span> : null}
        {onRefresh ? (
          <button type="button" onClick={onRefresh} title="Karte neu laden" className="shrink-0 text-[11px] text-slate-400 hover:text-white">
            ↻
          </button>
        ) : null}
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] text-sky-200/85 transition hover:bg-white/[0.07] hover:text-white"
        >
          öffnen ↗
        </a>
      </div>
      <div className="relative bg-[#0b0e14]" style={{ height }}>
        {!loaded ? (
          <div className="absolute inset-0 grid place-items-center text-[11.5px] text-slate-500">Karte wird geladen …</div>
        ) : null}
        <iframe
          key={src}
          src={src}
          title={heading}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          onLoad={() => setLoaded(true)}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}

/** Karte zu einem Punkt – folgt der Eingabe im Formular (mit kurzer Verzögerung) */
export function MapPreview({
  place,
  query,
  zoom = 16,
  height = 210,
  heading,
  className,
  debounce = 450,
}: {
  place?: Node | null;
  query?: string;
  zoom?: number;
  height?: number;
  heading?: string;
  className?: string;
  debounce?: number;
}) {
  const lat = place?.lat ?? null;
  const lng = place?.lng ?? null;
  const hasPoint = lat !== null && lng !== null;
  const typed = query?.trim() ?? '';
  const text = useDebounced(hasPoint ? '' : typed, debounce);
  const point: Node = { ...(place ?? {}), lat, lng, name: place?.name ?? typed };
  const ready = hasPoint || Boolean(typed);
  const src = ready ? (hasPoint ? mapsEmbedUrl(point, zoom) : queryEmbedUrl(text || typed, zoom)) : '';
  const href = ready ? (hasPoint ? mapsLink(point) : mapsLink({ lat: null, lng: null, maps_query: typed })) : '';
  const label = heading ?? (hasPoint ? place?.name || 'Kartenpunkt' : typed || 'Karte');

  return (
    <div className={cx(className)}>
      {ready && src && href ? (
        <Frame src={src} href={href} heading={label} height={height} hint={`×${zoom}`} />
      ) : (
        <div className="grid place-items-center rounded-xl border border-dashed border-white/[0.12] px-3 py-6 text-center text-[11.5px] text-slate-500" style={{ height }}>
          Noch kein Kartenpunkt – Name oder Stadt reicht, die Karte erscheint hier von selbst.
        </div>
      )}
    </div>
  );
}

/** Der Weg über die Punkte eines Tages: Hotel → Stops → letzter Punkt */
export function RoutePreview({
  origin,
  destination,
  stops = [],
  mode = 'transit',
  height = 260,
  heading,
  className,
}: {
  origin: Node;
  destination: Node;
  stops?: Node[];
  mode?: TravelMode;
  height?: number;
  heading?: string;
  className?: string;
}) {
  return (
    <div className={cx(className)}>
      <Frame
        src={routeEmbedUrl({ origin, destination, mode })}
        href={routeUrl({ origin, destination, stops, mode })}
        heading={heading ?? 'Route des Tages'}
        height={height}
        hint={stops.length ? `${stops.length} Zwischenstopp${stops.length === 1 ? '' : 's'}` : undefined}
      />
    </div>
  );
}

export default MapPreview;
