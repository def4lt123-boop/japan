'use client';

import React, { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useBatchGeocode, useEditor } from '../../../../components/EditorProvider';
import { Button, Card, Empty, SectionTitle, Select, cx } from '../../../../components/ui';
import { eachDate, fmtDay, plural } from '../../../../lib/format';
import { CATEGORY_LABELS, categoryMeta, mapsUrl, needsCategory } from '../../../../lib/categories';
import { applyCategories } from '../../../../lib/categorize';
import { dayStops, hotelForDay, routeUrl } from '../../../../lib/maps';
import { MapPreview, RoutePreview } from '../../../../components/MapPreview';
import { geocode, queryFor } from '../../../../lib/geocode';

const MapView = dynamic(() => import('../../../../components/MapView'), { ssr: false, loading: () => <Card className="grid h-[74vh] place-items-center text-sm text-slate-400">Karte wird geladen …</Card> });

export default function MapPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const geocodeAll = useBatchGeocode(tripId);
  const [day, setDay] = useState('');
  const [city, setCity] = useState('');
  const [cat, setCat] = useState('');
  const [showHotels, setShowHotels] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const dayOptions = useMemo(() => {
    const dates = eachDate(bundle.trip?.start_date, bundle.trip?.end_date);
    const placeDates = Array.from(new Set(bundle.places.map((p) => p.date).filter((d): d is string => Boolean(d))));
    return [...dates, ...placeDates.filter((d) => !dates.includes(d)).sort()].map((d) => ({ value: d, label: fmtDay(d) }));
  }, [bundle.trip?.start_date, bundle.trip?.end_date, bundle.places]);

  const cities = useMemo(() => Array.from(new Set(bundle.places.map((p) => p.city).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'de')), [bundle.places]);

  const visible = useMemo(
    () =>
      bundle.places.filter(
        (p) =>
          (!day || p.date === day) &&
          (!city || p.city === city) &&
          (!cat || (cat === '—' ? needsCategory(p) : categoryMeta(p.category).label === cat)),
      ),
    [bundle.places, day, city, cat],
  );
  const routed = day ? visible : [];
  const stops = dayStops(visible);
  const anchor = visible.find((p) => p.id === selected) ?? stops[0] ?? null;
  const hotel = hotelForDay(bundle.hotels, day || null, city || stops[0]?.city || null);
  const routeReady = stops.length > 1;
  const missing = visible.filter((p) => p.lat === null || p.lng === null);
  const uncategorized = bundle.places.filter((p) => needsCategory(p));
  const onMap = visible.filter((p) => p.lat !== null && p.lng !== null);

  /** Kategorien, die in dieser Reise wirklich vorkommen – mit Zähler fürs Dropdown */
  const catCounts = CATEGORY_LABELS.map((label) => ({
    label,
    n: bundle.places.filter((p) => categoryMeta(p.category).label === label).length,
  })).filter((x) => x.n > 0);

  const legend = useMemo(() => {
    const map = new Map<string, { color: string; icon: string; count: number }>();
    for (const p of onMap) {
      const meta = categoryMeta(p.category);
      const cur = map.get(meta.label) ?? { color: meta.color, icon: meta.icon, count: 0 };
      map.set(meta.label, { ...cur, count: cur.count + 1 });
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [onMap]);

  if (!bundle.trip) return null;

  return (
    <div className="space-y-3">
      <SectionTitle
        title="Karte"
        icon="🗺️"
        hint={`${plural(onMap.length, 'Marker', 'Marker')} auf der Karte · gefüllt = mit Tag, hohl = noch ohne Tag · Linie = Route des gewählten Tages`}
        right={
          <>
            <Select
              className="!w-auto"
              allowEmpty
              emptyLabel="Alle Tage"
              options={dayOptions}
              value={day}
              onChange={(e) => {
                setDay(e.target.value);
                setSelected(null);
              }}
            />
            <Select className="!w-auto" allowEmpty emptyLabel="Alle Städte" options={cities} value={city} onChange={(e) => setCity(e.target.value)} />
            <Select
              className="!w-auto"
              allowEmpty
              emptyLabel="Alle Kategorien"
              options={[
                ...catCounts.map((x) => ({ value: x.label, label: `${categoryMeta(x.label).icon}  ${x.label} (${x.n})` })),
                ...(uncategorized.length ? [{ value: '—', label: `ohne klare Kategorie (${uncategorized.length})` }] : []),
              ]}
              value={cat}
              onChange={(e) => setCat(e.target.value)}
            />
            <Button size="sm" variant={showHotels ? 'primary' : 'ghost'} onClick={() => setShowHotels((v) => !v)}>
              🏨 Unterkünfte
            </Button>
            {routeReady ? (
              <a
                className="btn-quiet"
                href={routeUrl({
                  origin: hotel ?? stops[0],
                  destination: stops[stops.length - 1],
                  stops: stops.slice(1, -1),
                  mode: 'transit',
                })}
                target="_blank"
                rel="noreferrer"
                title={`${stops.length} Punkte als Route – mit Fahrplan und Umstiegen`}
              >
                🧭 Route ({stops.length})
              </a>
            ) : null}
            {day ? (
              <Button size="sm" variant="ghost" onClick={() => setDay('')}>
                Tag zurücksetzen
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,320px)]">
        <Card className="overflow-hidden p-0">
          <MapView
            places={visible}
            hotels={bundle.hotels}
            showHotels={showHotels}
            routePlaces={routed}
            selectedId={selected}
            onSelect={setSelected}
            onEditPlace={(id) => open({ kind: 'place', id })}
            onEditHotel={(id) => open({ kind: 'hotel', id })}
            onCategory={(id, category) => store.patch('places', id, { category })}
            allCategories={bundle.places.map((x) => x.category)}
            dayLabel={day || null}
          />
        </Card>

        <div className="space-y-3">
          {anchor ? (
            <Card className="p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <h3 className="text-[13px] font-semibold text-white">{selected ? 'Auswahl bei Google Maps' : 'Gegend bei Google Maps'}</h3>
                <button className="text-[13px] text-slate-400 hover:text-white" onClick={() => setSelected(null)} title="Auswahl aufheben">
                  ×
                </button>
              </div>
              {selected && stops.length > 1 ? (
                <RoutePreview
                  origin={hotel ?? stops[0]}
                  destination={stops[stops.length - 1]}
                  stops={stops.slice(1, -1)}
                  mode="transit"
                  height={200}
                  heading={anchor.name}
                />
              ) : (
                <MapPreview
                  place={anchor}
                  query={`${anchor.name} ${anchor.district ?? ''} ${anchor.city ?? ''}`.replace(/\s+/g, ' ').trim()}
                  height={210}
                  zoom={anchor.lat !== null ? 16 : 12}
                  heading={anchor.name}
                />
              )}
              <p className="mt-1 text-[13px] leading-snug text-slate-400">
                Marker in der Liste antippen – die Karte folgt. {routeReady ? 'Der Route-Knopf oben verbindet alle Punkte des gewählten Tages in Google Maps.' : 'Sobald ein Tag gewählt ist, erscheint hier der Weg über die Punkte.'}
              </p>
            </Card>
          ) : null}
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[13px] font-semibold text-white">Legende</h3>
              <span className="text-[13px] text-slate-400">{legend.length} Kategorien</span>
            </div>
            {cat ? (
              <p className="mb-2 -mt-1 text-[13px] text-slate-400">
                gefiltert auf {categoryMeta(cat === '—' ? '' : cat).icon} {cat === '—' ? 'ohne klare Kategorie' : cat} ·{' '}
                <button className="underline-offset-2 hover:text-white hover:underline" onClick={() => setCat('')}>
                  alle zeigen
                </button>
              </p>
            ) : null}
            <ul className="grid grid-cols-2 gap-x-2 gap-y-1 text-[13px] text-slate-300">
              {legend.map(([label, v]) => (
                <li key={label} className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: v.color }} />
                  <span aria-hidden>{v.icon}</span>
                  <span className="min-w-0 flex-1 truncate" title={label}>
                    {label}
                  </span>
                  <span className="tabular-nums text-slate-400">{v.count}</span>
                </li>
              ))}
              {!legend.length ? <li className="col-span-2 text-slate-400">Keine Marker im Filter.</li> : null}
            </ul>
            {uncategorized.length ? (
              <button
                className="btn-quiet mt-2 w-full justify-center !text-[13px]"
                onClick={() => {
                  applyCategories(store, bundle.places);
                }}
                title="Weist allen Punkten, deren Kategorie noch kein Symbol hat, die passende zu – aus Name und Notiz"
              >
                🏷️ {uncategorized.length} {uncategorized.length === 1 ? 'Aktivität' : 'Aktivitäten'} automatisch kategorisieren
              </button>
            ) : (
              <p className="mt-2 text-[13px] text-emerald-200/80">✓ Alle Aktivitäten haben eine Kategorie, die wir kennen.</p>
            )}
          </Card>

          <Card className="max-h-[40vh] overflow-y-auto p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-white">Sichtbare Aktivitäten</h3>
            </div>
            <ul className="space-y-1">
              {onMap.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setSelected(p.id)}
                    className={cx('flex w-full items-start gap-1.5 rounded-lg px-2 py-1 text-left text-[13px] transition', selected === p.id ? 'bg-shu-500/15 ring-1 ring-inset ring-shu-400/40' : 'hover:bg-white/[0.05]')}
                  >
                    <span aria-hidden>{categoryMeta(p.category).icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-slate-100">{p.name}</span>
                      <span className="block text-[13px] text-slate-400">
                        {p.city}
                        {p.date ? ` · ${fmtDay(p.date)}` : ' · Pool'}
                      </span>
                    </span>
                    <a
                      href={mapsUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-[13px] text-sky-200/80 hover:text-sky-100"
                      title="In Google Maps öffnen"
                    >
                      ↗
                    </a>
                  </button>
                </li>
              ))}
            </ul>

            {missing.length ? (
              <div className="mt-3 border-t border-white/10 pt-2">
                <p className="mb-1.5 flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-amber-200/80">
                  ohne Punkt ({missing.length})
                  <button className="btn-quiet ml-auto !px-1.5 normal-case tracking-normal" onClick={() => void geocodeAll()} title="Die Lage für alle Punkte ohne Ort über die Kartensuche holen">
                    🌍 alle nachziehen
                  </button>
                </p>
                <ul className="space-y-1">
                  {missing.map((p) => (
                    <li key={p.id} className="flex items-center gap-1.5 text-[13px] text-slate-400">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <button
                        className="btn-quiet !px-1.5 !py-0.5 !text-[13px]"
                        title="Punkt in der Kartensuche holen"
                        onClick={async () => {
                          const hit = await geocode(queryFor(p));
                          if (hit) {
                            store.patch('places', p.id, { lat: Math.round(hit.lat * 1e6) / 1e6, lng: Math.round(hit.lng * 1e6) / 1e6 });
                            store.say(`${p.name}: ${hit.label.slice(0, 60)}`);
                          } else {
                            store.say(`Nichts gefunden für „${queryFor(p)}“ – im Formular den Punkt selbst in Google Maps auswählen.`);
                          }
                        }}
                      >
                        🌍
                      </button>
                      <button className="btn-quiet !px-1.5 !py-0.5 !text-[13px]" title="Bearbeiten" onClick={() => open({ kind: 'place', id: p.id })}>
                        ✎
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {!visible.length ? <Empty title="Keine Aktivitäten im Filter" hint="Tag oder Stadt zurücksetzen." /> : null}
          </Card>
        </div>
      </div>
    </div>
  );
}
