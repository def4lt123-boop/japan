'use client';

import 'leaflet/dist/leaflet.css';
import React, { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, Polyline, ScaleControl, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import type { Hotel, Place } from '../lib/types';
import { categoryMeta, mapsUrl, routeUrl } from '../lib/categories';
import { cx } from './ui';
import { fmtDate, fmtDuration, fmtMoney } from '../lib/format';

interface Props {
  places: Place[];
  hotels: Hotel[];
  showHotels: boolean;
  routePlaces: Place[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onEditPlace: (id: string) => void;
  onEditHotel: (id: string) => void;
  dayLabel: string | null;
}

const hotelIcon = L.divIcon({
  className: '',
  html: `<div class="marker-clusterish" style="background:#12151d;box-shadow:0 0 0 2px rgba(63,95,150,.9), 0 6px 16px rgba(0,0,0,.5)">🏨</div>`,
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function FlyTo({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (typeof lat === 'number' && typeof lng === 'number') map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [map, lat, lng]);
  return null;
}

function FitBounds({ points, fitKey }: { points: [number, number][]; fitKey: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points).pad(0.22), { animate: false });
    } else if (points.length === 1) {
      map.setView([points[0][0], points[0][1]], 14, { animate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey, points.length]);
  return null;
}

export default function MapView({ places, hotels, showHotels, routePlaces, selectedId, onSelect, onEditPlace, onEditHotel, dayLabel }: Props) {
  const withCoords = useMemo(() => places.filter((p) => p.lat !== null && p.lng !== null), [places]);
  const bounds = useMemo<[number, number][]>(() => withCoords.map((p) => [p.lat as number, p.lng as number]), [withCoords]);
  const route = useMemo<[number, number][]>(
    () =>
      routePlaces
        .filter((p) => p.lat !== null && p.lng !== null)
        .sort((a, b) => (a.start_time ?? '99').localeCompare(b.start_time ?? '99') || a.sort_order - b.sort_order)
        .map((p) => [p.lat as number, p.lng as number]),
    [routePlaces],
  );
  const focus = selectedId ? withCoords.find((p) => p.id === selectedId) : null;
  /** Kachel-Look: dunkel passt zur App, hell ist die normale OSM-Karte */
  const [dark, setDark] = useState(true);

  return (
    <div className="relative">
      <MapContainer
        center={[36.2, 138.25]}
        zoom={6}
        scrollWheelZoom
        zoomControl={false}
        className="h-[74vh] min-h-[420px] w-full rounded-xl border border-white/10"
        preferCanvas
      >
        {/*
         * Offene OpenStreetMap-Kacheln – kein API-Key, keine Testphase, keine Rechnung.
         * Für den dunklen Look werden nur die Kacheln invertiert (CSS-Filter), alles
         * andere (Punkte, Route, Popups) bleibt von der App gezeichnet.
         */}
        <TileLayer
          url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'
          className={cx(dark && 'tiles-dark')}
        />
        <ScaleControl position="bottomleft" imperial={false} />
        <ZoomControl position="bottomright" />
      <FitBounds points={bounds} fitKey={`${bounds.length}-${dayLabel ?? 'all'}`} />
      <FlyTo lat={focus?.lat ?? null} lng={focus?.lng ?? null} />

      {route.length > 1 ? <Polyline positions={route} pathOptions={{ color: '#f04e23', weight: 3, opacity: 0.75, dashArray: '6 5' }} /> : null}

      {showHotels
        ? hotels
            .filter((h) => h.lat !== null && h.lng !== null)
            .map((h) => (
              <Marker key={h.id} position={[h.lat as number, h.lng as number]} icon={hotelIcon}>
                <Popup>
                  <b>{h.name}</b>
                  <br />
                  {h.city} · {h.nights ?? '?'} Nächte · {fmtMoney(h.price_total_eur)}
                  <br />
                  {h.check_in ? `${fmtDate(h.check_in)} → ${fmtDate(h.check_out)}` : ''}
                  <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                    <a href={mapsUrl({ lat: h.lat, lng: h.lng, name: h.name, city: h.city, maps_query: null })} target="_blank" rel="noreferrer">
                      Maps
                    </a>
                    <button onClick={() => onEditHotel(h.id)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: '#9db6dc' }}>
                      bearbeiten
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))
        : null}

      {withCoords.map((p) => {
        const meta = categoryMeta(p.category);
        const selected = selectedId === p.id;
        return (
          <CircleMarker
            key={p.id}
            center={[p.lat as number, p.lng as number]}
            radius={selected ? 11 : p.priority === 'muss' ? 9 : 7}
            pathOptions={{
              color: selected ? '#ffffff' : 'rgba(255,255,255,0.9)',
              weight: selected ? 3 : 1.4,
              fillColor: meta.color,
              fillOpacity: p.date ? 0.95 : 0.55,
              dashArray: p.date ? undefined : '3 3',
            }}
            eventHandlers={{ click: () => onSelect(p.id) }}
          >
            <Tooltip direction="top" offset={[0, -6]} opacity={1}>
              <span style={{ fontSize: 11 }}>
                {meta.icon} <b>{p.name}</b>
                {p.date ? ` · ${fmtDate(p.date, { day: '2-digit', month: '2-digit' })}` : ' · Pool'}
              </span>
            </Tooltip>
            <Popup>
              <div style={{ minWidth: 190 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 15 }}>{meta.icon}</span>
                  <b>{p.name}</b>
                </div>
                <div style={{ marginTop: 4, color: '#94a3b8', fontSize: 11.5 }}>
                  {p.city}
                  {p.district ? ` · ${p.district}` : ''} · {p.date ? fmtDate(p.date, { weekday: 'short', day: '2-digit', month: '2-digit' }) : 'noch ohne Tag'}
                </div>
                <div style={{ marginTop: 4, fontSize: 12 }}>
                  {[p.start_time, p.time_slot, p.duration_min ? fmtDuration(p.duration_min) : null, p.travel_time ? `🚈 ${p.travel_time}` : null, p.price_eur ? fmtMoney(p.price_eur) : null]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </div>
                {p.notes ? <p style={{ marginTop: 5, fontSize: 12 }}>{p.notes}</p> : null}
                <div style={{ marginTop: 7, display: 'flex', flexWrap: 'wrap', gap: 9, alignItems: 'center' }}>
                  <a href={mapsUrl(p)} target="_blank" rel="noreferrer">
                    📍 Maps
                  </a>
                  <a href={routeUrl(p)} target="_blank" rel="noreferrer">
                    🧭 Route
                  </a>
                  <button onClick={() => onEditPlace(p.id)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: '#9db6dc' }}>
                    ✎ bearbeiten
                  </button>
                </div>
                <div style={{ marginTop: 4, fontSize: 10.5, color: '#64748b' }}>
                  {p.lat?.toFixed(5)}, {p.lng?.toFixed(5)}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
      </MapContainer>

      <div className="absolute right-2 top-2 z-[1000] flex items-center gap-1 rounded-xl border border-white/10 bg-ink-900/85 p-1 backdrop-blur">
        <button
          type="button"
          onClick={() => setDark((v) => !v)}
          className="chip bg-white/[0.06] px-2 py-1 text-[11.5px] text-slate-200 ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.12]"
          title={dark ? 'Helle OpenStreetMap-Kacheln zeigen' : 'Dunkle Kacheln zeigen'}
        >
          {dark ? '☀️ hell' : '🌙 dunkel'}
        </button>
        <span className="px-1 text-[10.5px] text-slate-500">Kacheln: OpenStreetMap</span>
      </div>
    </div>
  );
}
