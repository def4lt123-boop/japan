'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Disclosure, Field, Modal, Select, TextArea, TextInput, cx } from './ui';
import { BOOKING_STATUSES, EXPENSE_CATEGORIES, JOURNEY_MODES, PRIORITIES, type Expense, type Hotel, type Journey, type Place, type Trip } from '../lib/types';
import { PRIORITY_META, STATUS_META, TICKET_META, TICKET_ORDER, mapsUrl } from '../lib/categories';
import { eachDate, fmtDate, fmtDuration, num, parseDuration, uid } from '../lib/format';
import { CategoryPicker } from './CategoryPicker';
import { DateField, DateRangeField } from './dates';
import type { TicketStatus } from '../lib/types';
import { geocode, mapsUrlName, parseMapsUrl, queryFor, resolveMapsLink } from '../lib/geocode';
import { MapPreview } from './MapPreview';
import { useStore } from '../lib/store';

const statusOptions = BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }));
const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: `${PRIORITY_META[p].icon} ${PRIORITY_META[p].label}` }));

/** Gemeinsame Geo-Komponente: OSM-Suche + Google-Maps-URL einfügen */
function GeoFields({
  lat,
  lng,
  query,
  onChange,
  suggest,
  name,
  onName,
}: {
  lat: number | null;
  lng: number | null;
  query: string | null;
  onChange: (patch: Partial<{ lat: number | null; lng: number | null; maps_query: string | null }>) => void;
  suggest: string;
  /** Name des Eintrags – ein Maps-Link darf ihn füllen bzw. vorschlagen */
  name?: string;
  onName?: (name: string) => void;
}) {
  const [mapsInput, setMapsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [zoom, setZoom] = useState<number | null>(null);
  const [namedBy, setNamedBy] = useState<string | null>(null);
  const [linkOk, setLinkOk] = useState(false);

  /** Link (auch maps.app.goo.gl) lesen → Punkt, Name und Zoomebene übernehmen */
  const applyMapsLink = async (raw?: string) => {
    const text = (raw ?? mapsInput).trim();
    if (!text) return;
    setBusy(true);
    setMsg(null);
    const finalUrl = await resolveMapsLink(text);
    const parsed = parseMapsUrl(finalUrl);
    const found = mapsUrlName(finalUrl);
    setBusy(false);
    if (parsed) {
      onChange({
        lat: round(parsed.lat),
        lng: round(parsed.lng),
        maps_query: parsed.query || found || query || suggest,
      });
      if (parsed.zoom) setZoom(parsed.zoom);
      setLinkOk(true);
      const same = (a?: string | null, b?: string | null) => (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();
      if (found && !same(found, name)) {
        if (onName && !(name ?? '').trim()) {
          onName(found);
          setMsg(`Punkt und Name „${found}“ übernommen ✔`);
        } else {
          setNamedBy(found);
          setMsg(`Punkt übernommen – der Link nennt „${found}“.`);
        }
      } else {
        setMsg('Punkt übernommen ✔');
      }
      setMapsInput('');
    } else if (found) {
      onChange({ maps_query: found });
      if (onName && !(name ?? '').trim()) onName(found);
      setMsg(`Der Link nennt „${found}“, aber keinen Punkt – Suchbegriff übernommen, 🔍 suchen setzt den Punkt.`);
      setMapsInput('');
    } else {
      setMsg('Den Link konnte ich nicht lesen. In Google Maps auf den Ort drücken, dann „Teilen“ bzw. die Adresszeile kopieren und hier einfügen.');
    }
  };

  const runGeocode = async () => {
    setBusy(true);
    setMsg(null);
    const hit = await geocode(query?.trim() || suggest);
    setBusy(false);
    if (hit) {
      onChange({ lat: round(hit.lat), lng: round(hit.lng), maps_query: query?.trim() || suggest });
      setMsg(`Gefunden: ${hit.label.slice(0, 90)}`);
    } else {
      setMsg('Nichts gefunden – bitte den Punkt bei Google Maps aussuchen und den Link einfügen.');
    }
  };

  return (
    <Card className="bg-black/20 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Punkt auf der Karte</span>
        <span className="text-[11.5px] text-slate-400">{lat !== null && lng !== null ? '✓ Punkt gesetzt' : 'noch kein Punkt'}</span>
      </div>
      <div className="grid gap-2">
        <Field label="Was soll Google Maps zeigen?" className="min-w-0">
          <TextInput value={query ?? ''} placeholder={suggest} onChange={(e) => onChange({ maps_query: e.target.value })} />
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={runGeocode} disabled={busy}>
          {busy ? 'Suche…' : '🔍 Punkt suchen'}
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void applyMapsLink()} disabled={!mapsInput.trim() || busy}>
          {busy ? 'lese…' : '📌 Ausgewählten Punkt übernehmen'}
        </Button>
        <TextInput
          className={cx('min-w-[220px] flex-1', linkOk && '!border-emerald-400/50')}
          placeholder="Link aus Google Maps hier einfügen (auch maps.app.goo.gl)"
          value={mapsInput}
          onChange={(e) => {
            setMapsInput(e.target.value);
            setLinkOk(false);
          }}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text') ?? '';
            if (/goo\.gl|google\.[a-z.]+\/maps|^-?\d{1,3}([.,]\d+)?\s*[,;/]/i.test(text.trim())) {
              e.preventDefault();
              setMapsInput(text.trim());
              void applyMapsLink(text.trim());
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void applyMapsLink();
            }
          }}
        />
        <a
          className="btn-quiet"
          href={mapsUrl({ lat, lng, name: suggest, city: '', maps_query: query ?? null })}
          target="_blank"
          rel="noreferrer"
          title="Öffnet Google Maps mit diesem Suchbegriff – dort den Ort anklicken und den Link hier einfügen"
        >
          🎯 Punkt bei Google Maps wählen ↗
        </a>
        <Button size="sm" variant="ghost" onClick={() => setShowMap((v) => !v)} aria-expanded={showMap}>
          {showMap ? 'Vorschau zu' : '🗺️ Vorschau'}
        </Button>
      </div>
      {showMap ? (
        <div className="mt-2">
          <MapPreview
            place={{ lat, lng, name: suggest, city: null, district: null, maps_query: query }}
            query={query?.trim() || suggest}
            height={200}
            zoom={zoom ?? (lat !== null && lng !== null ? 16 : 13)}
            heading={lat !== null && lng !== null ? 'Kartenpunkt' : 'Suchvorschau'}
          />
          <p className="mt-1 text-[11px] leading-snug text-slate-500">
            Die Vorschau folgt dem Suchbegriff – bei jedem Tipp, auch bevor etwas gespeichert ist.
          </p>
        </div>
      ) : null}
      {namedBy && onName ? (
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 rounded-lg bg-shu-500/10 px-2 py-1 text-[11.5px] text-slate-200 ring-1 ring-inset ring-shu-400/25">
          <span>Name aus Google Maps:</span>
          <b className="text-white">{namedBy}</b>
          <button
            type="button"
            className="btn-quiet !px-1.5 !py-0.5 !text-[11px]"
            onClick={() => {
              onName(namedBy);
              setMsg(`Namen „${namedBy}“ übernommen ✔`);
              setNamedBy(null);
            }}
          >
            übernehmen
          </button>
          <button type="button" className="text-[11px] text-slate-400 hover:text-white" onClick={() => setNamedBy(null)}>
            egal
          </button>
        </div>
      ) : null}
      {msg ? <p className="mt-1.5 text-[11.5px] leading-snug text-slate-400">{msg}</p> : null}
      <p className="mt-1 text-[11px] leading-snug text-slate-500">
        So geht’s: bei Google Maps den Ort anklicken, den Link hier einfügen – Punkt und Name wandern in die Aktivität.
      </p>
    </Card>
  );
}

const round = (n: number) => Math.round(n * 1e6) / 1e6;

/** Vier Zustände statt Klick-Orgie: unklar → nötig → gekauft → keins */
function TicketPicker({
  value,
  note,
  onChange,
}: {
  value?: TicketStatus | null;
  note?: string | null;
  onChange: (patch: { ticket_status: TicketStatus; ticket_note?: string | null }) => void;
}) {
  const current = (value ?? 'unklar') as TicketStatus;
  return (
    <div>
      <div className="flex flex-wrap gap-1">
        {TICKET_ORDER.map((state) => {
          const meta = TICKET_META[state];
          const active = current === state;
          return (
            <button
              key={state}
              type="button"
              onClick={() => onChange({ ticket_status: state })}
              aria-pressed={active}
              title={meta.label}
              className={cx('chip ring-1 transition', active ? 'bg-shu-500/25 text-white ring-shu-400/50' : 'bg-white/[0.04] text-slate-300 ring-white/10 hover:bg-white/[0.09]')}
            >
              <span aria-hidden>{meta.icon}</span> {meta.short}
            </button>
          );
        })}
      </div>
      <TextInput className="mt-1" value={note ?? ''} onChange={(e) => onChange({ ticket_status: current, ticket_note: e.target.value })} placeholder="z. B. Timed Entry 10:00 · 2 Personen · online günstiger" />
    </div>
  );
}

/** Reisezeitraum für Kalender-Grenzen + Schnellwahl der Reisetage */
/** Überschrift über einer Feldgruppe im Formular */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function useTripDays(tripStart?: string | null, tripEnd?: string | null) {
  const days = eachDate(tripStart ?? null, tripEnd ?? null);
  return { days, bounds: [tripStart ?? null, tripEnd ?? null] as [string | null, string | null] };
}

export function PlaceForm({
  tripId,
  value,
  cities,
  jpyRate = 175,
  tripStart,
  tripEnd,
  onSubmit,
  onCancel,
  onDelete,
}: {
  tripId: string;
  value?: Partial<Place> | null;
  cities: string[];
  jpyRate?: number;
  tripStart?: string | null;
  tripEnd?: string | null;
  onSubmit: (place: Place, again?: boolean) => void;
  onCancel: () => void;
  onDelete?: (place: Place) => void;
}) {
  const { days: tripDays, bounds } = useTripDays(tripStart, tripEnd);
  const isNew = !value?.id;
  const [draft, setDraft] = useState<Place>(() => ({
    id: value?.id ?? uid('pl'),
    trip_id: tripId,
    name: '',
    city: '',
    district: null,
    category: null,
    date: null,
    end_date: null,
    time_slot: null,
    start_time: null,
    duration_min: null,
    travel_time: null,
    notes: null,
    price_eur: null,
    price_note: null,
    booking_status: 'offen',
    booking_url: null,
    ticket_status: 'unklar',
    ticket_note: null,
    priority: 'soll',
    maps_query: null,
    lat: null,
    lng: null,
    image_url: null,
    sort_order: 0,
    ...value,
  }));
  useEffect(() => {
    document.getElementById('place-name-input')?.focus();
  }, []);

  const set = (patch: Partial<Place>) => setDraft((d) => ({ ...d, ...patch }));
  const store = useStore();
  /** was in dieser Reise an Kategorien schon benutzt wird, bleibt wählbar */
  const knownCategories = useMemo(() => store.places.filter((x) => x.trip_id === tripId).map((x) => x.category), [store.places, tripId]);
  const amTag = draft.date ? store.places.filter((p) => p.date === draft.date && p.id !== value?.id).length : 0;

  const submit = (e: React.FormEvent, again = false) => {
    e.preventDefault?.();
    if (!draft.name.trim()) return;
    const { name, city } = draft;
    onSubmit(
      {
        ...draft,
        name: name.trim(),
        city: city.trim() || 'Unbekannt',
        ticket_status: (draft.ticket_status ?? 'unklar') as TicketStatus,
        sort_order: draft.sort_order ?? 0,
      },
      again,
    );
  };

  return (
    <Modal
      title={isNew ? 'Aktivität anlegen' : 'Aktivität bearbeiten'}
      subtitle={isNew ? 'Name, Stadt, Ticket, Preis – der Tag kommt später. Ohne Tag steht die Aktivität in der Liste.' : draft.name}
      onClose={onCancel}
      footer={
        <>
          {onDelete && !isNew ? (
            <Button variant="danger" onClick={() => onDelete(draft)} className="mr-auto">
              Löschen
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onCancel}>
            Abbrechen
          </Button>
          {isNew ? (
            <Button
              variant="ghost"
              title="speichern und weitertippen – Tag, Stadt und Status bleiben im Formular stehen"
              onClick={(e) => submit(e as unknown as React.FormEvent, true)}
            >
              ✓ speichern &amp; weiter
            </Button>
          ) : null}
          <Button variant="primary" onClick={(e) => submit(e as unknown as React.FormEvent)}>
            Speichern <span className="opacity-60">(⌘↵)</span>
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Group title="Was und wo">
          <Field label="Was ist es? *">
            <TextInput id="place-name-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Nara-Park" />
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Stadt">
              <TextInput list="city-list" value={draft.city} onChange={(e) => set({ city: e.target.value })} placeholder="Nara" />
              <datalist id="city-list">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Kategorie" hint="bestimmt Symbol, Farbe auf der Karte und die Gruppen">
              <CategoryPicker
                value={draft.category}
                used={knownCategories}
                onChange={(v) => set({ category: v })}
              />
            </Field>
          </div>
          <Field label="Notizen" hint="was du dir merken willst – Öffnungszeiten, Warteschlange, geschlossene Tage …">
            <TextArea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="früh da sein, Ticket am Schalter, geschlossen Mo …" />
          </Field>
        </Group>

        <Group title="Wann">
          <div className="grid gap-2 sm:grid-cols-2">
            <DateField
              name="date"
              label="An welchem Tag?"
              value={draft.date}
              onChange={(v) => set({ date: v })}
              hint={draft.date ? undefined : 'leer = Aktivität kommt in die Liste'}
              quickDates={tripDays}
              tripBounds={bounds}
            />
            <Field label="Status">
              <Select className="!w-auto" options={statusOptions} value={draft.booking_status} onChange={(e) => set({ booking_status: e.target.value as Place['booking_status'] })} />
            </Field>
          </div>
          <div className="mt-2">
            <span className="label">Wie wichtig?</span>
            <div className="flex gap-1">
              {priorityOptions.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => set({ priority: o.value as Place['priority'] })}
                  aria-pressed={draft.priority === o.value}
                  className={cx('chip flex-1 justify-center', draft.priority === o.value ? 'bg-shu-500/20 text-white' : 'bg-white/[0.04] text-slate-400 hover:bg-white/[0.08]')}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-2 text-[11.5px] leading-snug text-slate-500">
            {draft.date
              ? `Am ${draft.date.split('-').reverse().slice(0, 2).join('.')} stehen ${amTag ? `${amTag} ${amTag === 1 ? 'Punkt' : 'Punkte'} davor` : 'noch keine Punkte'} – die Liste beginnt mit dem, was du zuerst machen willst.`
              : 'Ohne Tag bleibt die Aktivität in der Liste „Noch ohne Tag“ und wartet dort auf ihren Platz.'}
          </p>
        </Group>

        <Group title="Ticket & Preis">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <span className="label">Ticket</span>
              <TicketPicker value={draft.ticket_status} note={draft.ticket_note} onChange={(patch) => set(patch)} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Preis in € (gesamt)">
                <TextInput type="number" step="0.01" min="0" value={draft.price_eur ?? ''} onChange={(e) => set({ price_eur: num(e.target.value) })} placeholder="16,00" />
              </Field>
              <Field label="Preis in ¥" hint="→ € mit Kurs">
                <TextInput
                  inputMode="numeric"
                  defaultValue=""
                  placeholder="2.700 ¥"
                  onBlur={(e) => {
                    const yen = num(e.target.value);
                    if (yen !== null) set({ price_note: `${yen.toLocaleString('de-DE')} ¥`, price_eur: Math.round((yen / (jpyRate || 175)) * 100) / 100 });
                  }}
                />
              </Field>
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Preis-Hinweis">
              <TextInput value={draft.price_note ?? ''} onChange={(e) => set({ price_note: e.target.value })} placeholder="online günstiger / 2 Personen" />
            </Field>
            <GeoFields
              lat={draft.lat}
              lng={draft.lng}
              query={draft.maps_query}
              suggest={queryFor(draft)}
              name={draft.name}
              onName={(value) => set({ name: value })}
              onChange={(patch) => set(patch)}
            />
          </div>
        </Group>

        <Disclosure title="Noch optional" hint="Links für Buchung und Bild">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Link (Buchung / Website)">
              <TextInput value={draft.booking_url ?? ''} onChange={(e) => set({ booking_url: e.target.value })} placeholder="https://…" />
            </Field>
            <Field label="Bild-URL">
              <TextInput value={draft.image_url ?? ''} onChange={(e) => set({ image_url: e.target.value })} placeholder="https://…" />
            </Field>
          </div>
        </Disclosure>
      </form>
    </Modal>
  );
}

export function HotelForm({
  tripId,
  value,
  cities,
  tripStart,
  tripEnd,
  onSubmit,
  onCancel,
  onDelete,
}: {
  tripId: string;
  value?: Partial<Hotel> | null;
  cities: string[];
  tripStart?: string | null;
  tripEnd?: string | null;
  onSubmit: (h: Hotel, again?: boolean) => void;
  onCancel: () => void;
  onDelete?: (h: Hotel) => void;
}) {
  const { bounds } = useTripDays(tripStart, tripEnd);
  const isNew = !value?.id;
  const [draft, setDraft] = useState<Hotel>(() => ({
    id: value?.id ?? uid('ht'),
    trip_id: tripId,
    name: '',
    city: '',
    check_in: null,
    check_out: null,
    nights: null,
    price_total_eur: null,
    price_per_night_eur: null,
    address: null,
    lat: null,
    lng: null,
    booking_url: null,
    booking_status: 'offen',
    notes: null,
    ...value,
  }));
  const set = (patch: Partial<Hotel>) => setDraft((d) => ({ ...d, ...patch }));

  const derived = useMemo(() => {
    const nights = draft.nights ?? null;
    const total = draft.price_total_eur ?? null;
    return {
      nights,
      perNight: total !== null && nights ? Math.round((total / nights) * 100) / 100 : draft.price_per_night_eur,
    };
  }, [draft.nights, draft.price_total_eur, draft.price_per_night_eur]);

  useEffect(() => {
    if (!draft.check_in || !draft.check_out) return;
    const a = new Date(`${draft.check_in}T00:00:00`).getTime();
    const b = new Date(`${draft.check_out}T00:00:00`).getTime();
    const n = Math.max(0, Math.round((b - a) / 86400000));
    if (n && n !== draft.nights) set({ nights: n });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.check_in, draft.check_out]);

  return (
    <Modal
      title={isNew ? 'Neue Unterkunft' : 'Unterkunft bearbeiten'}
      subtitle="Nächte + Preis = Budget Baustein „Unterkunft“"
      onClose={onCancel}
      footer={
        <>
          {onDelete && !isNew ? (
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(draft)}>
              Löschen
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onCancel}>
            Abbrechen
          </Button>
          {isNew ? (
            <Button
              variant="ghost"
              title="speichern und gleich das nächste Bett in derselben Stadt ansetzen – ab dem Check-out von hier"
              onClick={() => {
                if (!draft.name.trim()) return;
                onSubmit({ ...draft, name: draft.name.trim(), price_per_night_eur: derived.perNight ?? null }, true);
              }}
            >
              ✓ speichern &amp; weiter
            </Button>
          ) : null}
          <Button
            variant="primary"
            onClick={() => {
              if (!draft.name.trim()) return;
              onSubmit({ ...draft, name: draft.name.trim(), price_per_night_eur: derived.perNight ?? null });
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <Field label="Name *">
            <TextInput value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Hotel The Royal Park Canvas Cigappa Shinjuku" autoFocus />
          </Field>
          <Field label="Stadt">
            <TextInput list="city-list-h" value={draft.city} onChange={(e) => set({ city: e.target.value })} placeholder="Tokio" />
            <datalist id="city-list-h">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
        </div>
        <DateRangeField
          label="Anreise → Abreise"
          start={draft.check_in}
          end={draft.check_out}
          onChange={(a, b) => set({ check_in: a, check_out: b })}
          unit="Nacht"
          tripBounds={bounds}
          hint="Nächte zählt sich automatisch"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Nächte" hint={draft.check_in && draft.check_out ? 'aus den Daten berechnet' : undefined}>
            <TextInput type="number" min="0" value={draft.nights ?? ''} onChange={(e) => set({ nights: num(e.target.value) })} />
          </Field>
          <Field label="Status">
            <Select options={statusOptions} value={draft.booking_status} onChange={(e) => set({ booking_status: e.target.value as Hotel['booking_status'] })} />
          </Field>
          <Field label="Stadt">
            <TextInput value={draft.city} onChange={(e) => set({ city: e.target.value })} placeholder="Tokio" />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Preis gesamt (€)" hint="Zimmer, alle Personen, alle Nächte">
            <TextInput type="number" step="0.01" min="0" value={draft.price_total_eur ?? ''} onChange={(e) => set({ price_total_eur: num(e.target.value) })} />
          </Field>
          <Field label="Rechnet automatisch → € / Nacht">
            <TextInput readOnly value={derived.perNight ?? ''} className="opacity-70" placeholder="—" />
          </Field>
          <Field label="€ / Nacht als manuelle Angabe">
            <TextInput type="number" step="0.01" min="0" value={draft.price_per_night_eur ?? ''} onChange={(e) => set({ price_per_night_eur: num(e.target.value) })} />
          </Field>
        </div>
        <Field label="Adresse">
          <TextInput value={draft.address ?? ''} onChange={(e) => set({ address: e.target.value })} placeholder="Japan, 〒160-0022 Tokyo, Shinjuku…" />
        </Field>
        <Field label="Buchungslink">
          <TextInput value={draft.booking_url ?? ''} onChange={(e) => set({ booking_url: e.target.value })} placeholder="https://booking.com/hotel/…" />
        </Field>
        <Field label="Notizen">
          <TextArea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Frühstück inklusive, Gepäckaufbewahrung, Anzahlung…" />
        </Field>
        <GeoFields
          lat={draft.lat}
          lng={draft.lng}
          query={null}
          suggest={draft.address || `${draft.name} ${draft.city}`}
          name={draft.name}
          onName={(value) => set({ name: value })}
          onChange={(p) => set({ lat: p.lat, lng: p.lng, ...(p.maps_query ? { address: p.maps_query } : {}) })}
        />
      </div>
    </Modal>
  );
}

export function JourneyForm({
  tripId,
  value,
  tripStart,
  tripEnd,
  onSubmit,
  onCancel,
  onDelete,
}: {
  tripId: string;
  value?: Partial<Journey> | null;
  tripStart?: string | null;
  tripEnd?: string | null;
  onSubmit: (j: Journey) => void;
  onCancel: () => void;
  onDelete?: (j: Journey) => void;
}) {
  const { bounds } = useTripDays(tripStart, tripEnd);
  const isNew = !value?.id;
  const [draft, setDraft] = useState<Journey>(() => ({
    id: value?.id ?? uid('jn'),
    trip_id: tripId,
    date: null,
    end_date: null,
    title: '',
    from_city: null,
    to_city: null,
    mode: null,
    departure_time: null,
    duration_min: null,
    price_eur: null,
    hotel_name: null,
    nights: null,
    booking_status: 'offen',
    notes: null,
    ...value,
  }));
  const [durationText, setDurationText] = useState(fmtDuration(value?.duration_min ?? null));
  const set = (patch: Partial<Journey>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal
      title={isNew ? 'Flug / Zug anlegen' : 'Fahrt bearbeiten'}
      subtitle="Flüge, Shinkansen, Fähren – der Reiseverlauf"
      onClose={onCancel}
      footer={
        <>
          {onDelete && !isNew ? (
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(draft)}>
              Löschen
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!draft.title.trim()) return;
              onSubmit({
                ...draft,
                title: draft.title.trim(),
                end_date: draft.date && draft.end_date && draft.end_date < draft.date ? null : draft.end_date,
                duration_min: parseDuration(durationText) ?? draft.duration_min,
              });
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Titel *">
          <TextInput value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Flug München → Tokio (Haneda)" autoFocus />
        </Field>
        <DateRangeField
          label={draft.mode === 'Flug' ? 'Abflug → Ankunft / Rückflug' : 'Datum → Ende'}
          start={draft.date}
          end={draft.end_date}
          onChange={(a, b) => set({ date: a, end_date: b })}
          unit="Tag"
          tripBounds={bounds}
          hint="ein Klick = Abflug, zweiter Klick = Ankunft oder Rückflug"
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Von">
            <TextInput value={draft.from_city ?? ''} onChange={(e) => set({ from_city: e.target.value })} placeholder="Tokio" />
          </Field>
          <Field label="Nach">
            <TextInput value={draft.to_city ?? ''} onChange={(e) => set({ to_city: e.target.value })} placeholder="Hakodate" />
          </Field>
          <Field label="Verkehrsmittel">
            <Select allowEmpty options={JOURNEY_MODES} value={draft.mode ?? ''} onChange={(e) => set({ mode: e.target.value || null })} emptyLabel="—" />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <Field label="Abflug">
            <TextInput type="time" value={draft.departure_time ?? ''} onChange={(e) => set({ departure_time: e.target.value || null })} />
          </Field>
          <Field label="Dauer">
            <TextInput value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="1:30h" />
          </Field>
          <Field label="Preis (€)">
            <TextInput type="number" step="0.01" min="0" value={draft.price_eur ?? ''} onChange={(e) => set({ price_eur: num(e.target.value) })} />
          </Field>
          <Field label="Status">
            <Select options={statusOptions} value={draft.booking_status} onChange={(e) => set({ booking_status: e.target.value as Journey['booking_status'] })} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <Field label="Hotel an diesem Tag">
            <TextInput value={draft.hotel_name ?? ''} onChange={(e) => set({ hotel_name: e.target.value })} placeholder="Hotel Tokio" />
          </Field>
          <Field label="Nächte dort">
            <TextInput type="number" min="0" value={draft.nights ?? ''} onChange={(e) => set({ nights: num(e.target.value) })} />
          </Field>
        </div>
        <Field label="Notizen">
          <TextArea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Ticket am Schalter ziehen, Sitzplatz reservieren, Gepäck vorausschicken (Takkyubin)…" />
        </Field>
      </div>
    </Modal>
  );
}

export function ExpenseForm({
  tripId,
  value,
  jpyRate = 175,
  tripStart,
  tripEnd,
  onSubmit,
  onCancel,
  onDelete,
}: {
  tripId: string;
  value?: Partial<Expense> | null;
  jpyRate?: number;
  tripStart?: string | null;
  tripEnd?: string | null;
  onSubmit: (e: Expense, again?: boolean) => void;
  onCancel: () => void;
  onDelete?: (e: Expense) => void;
}) {
  const isNew = !value?.id;
  const [draft, setDraft] = useState<Expense>(() => ({
    id: value?.id ?? uid('ex'),
    trip_id: tripId,
    date: null,
    category: 'Sonstiges',
    description: null,
    amount_eur: 0,
    payer: null,
    ...value,
  }));
  const set = (patch: Partial<Expense>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal
      title={isNew ? 'Ausgabe erfassen' : 'Ausgabe bearbeiten'}
      subtitle="Alles, was nicht schon in Unterkunft, Aktivitäten oder Fahrten steht"
      onClose={onCancel}
      footer={
        <>
          {onDelete && !isNew ? (
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(draft)}>
              Löschen
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onCancel}>
            Abbrechen
          </Button>
          {isNew ? (
            <Button
              variant="ghost"
              title="speichern und den nächsten Bon eintippen – Datum, Kategorie und Wer-zahlte bleiben stehen"
              onClick={() => onSubmit({ ...draft, amount_eur: draft.amount_eur ?? 0 }, true)}
            >
              ✓ speichern &amp; weiter
            </Button>
          ) : null}
          <Button variant="primary" onClick={() => onSubmit({ ...draft, amount_eur: draft.amount_eur ?? 0 })}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_1.6fr_1fr]">
          <DateField label="Datum" value={draft.date} onChange={(v) => set({ date: v })} quickDates={eachDate(tripStart ?? null, tripEnd ?? null).slice(-10)} tripBounds={[tripStart ?? null, tripEnd ?? null]} startHint="Tag wählen" />
          <Field label="Wofür?">
            <TextInput value={draft.description ?? ''} onChange={(e) => set({ description: e.target.value })} placeholder="Konbini-Frühstück, Coin Laundry, …" autoFocus />
          </Field>
          <Field label="Betrag (€) *">
            <TextInput type="number" step="0.01" value={draft.amount_eur ?? ''} onChange={(e) => set({ amount_eur: num(e.target.value) ?? 0 })} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Kategorie">
            <Select options={EXPENSE_CATEGORIES} value={draft.category} onChange={(e) => set({ category: e.target.value })} />
          </Field>
          <Field label="Wer war in Vorleistung?" hint="ein Name pro Anteil – `Satzi / Satzi / Anna` heißt: Satzi trug zwei der drei Anteile">
            <TextInput value={draft.payer ?? ''} onChange={(e) => set({ payer: e.target.value })} placeholder="Satzi / Satzi / Anna" />
          </Field>
        </div>
        <Field label="Betrag in ¥" hint="beim Verlassen: Umrechnung mit dem Kurs der Reise">
          <TextInput
            inputMode="numeric"
            placeholder="1.200 ¥"
            defaultValue=""
            onBlur={(e) => {
              const yen = num(e.target.value);
              if (yen !== null) set({ amount_eur: Math.round((yen / (jpyRate || 175)) * 100) / 100 });
            }}
          />
        </Field>
      </div>
    </Modal>
  );
}

export function TripForm({ value, onSubmit, onCancel, onDelete }: { value?: Partial<Trip> | null; onSubmit: (t: Trip) => void; onCancel: () => void; onDelete?: (t: Trip) => void }) {
  const isNew = !value?.id;
  const [draft, setDraft] = useState<Trip>(() => ({
    id: value?.id ?? uid('trip'),
    name: '',
    destination: 'Japan',
    start_date: null,
    end_date: null,
    travelers: 2,
    budget_eur: null,
    jpy_rate: 175,
    notes: null,
    archived: false,
    started: false,
    started_at: null,
    planned_start: null,
    planned_end: null,
    ...value,
  }));
  const set = (patch: Partial<Trip>) => setDraft((d) => ({ ...d, ...patch }));

  return (
    <Modal
      title={isNew ? 'Neue Reise anlegen' : 'Reise bearbeiten'}
      subtitle={isNew ? 'Tipp: Danach über „Duplizieren“ die alte Reise als Vorlage übernehmen.' : draft.name}
      onClose={onCancel}
      footer={
        <>
          {onDelete && !isNew ? (
            <Button variant="danger" className="mr-auto" onClick={() => onDelete(draft)}>
              Reise löschen
            </Button>
          ) : null}
          <Button variant="quiet" onClick={onCancel}>
            Abbrechen
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!draft.name.trim()) return;
              onSubmit({ ...draft, name: draft.name.trim() });
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <Field label="Name *">
            <TextInput value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Fernreise 2028" autoFocus />
          </Field>
          <Field label="Land / Ziel">
            <TextInput value={draft.destination} onChange={(e) => set({ destination: e.target.value })} placeholder="Japan" />
          </Field>
        </div>
        <DateRangeField
          label="Zeitraum der Reise"
          start={draft.start_date}
          end={draft.end_date}
          onChange={(a, b) => set({ start_date: a, end_date: b })}
          unit="Nacht"
          hint="erster Klick = Anreise, zweiter Klick = Abreise"
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Personen">
            <TextInput type="number" min="1" value={draft.travelers} onChange={(e) => set({ travelers: num(e.target.value) ?? 1 })} />
          </Field>
          <Field label="Budget (€)">
            <TextInput type="number" step="1" value={draft.budget_eur ?? ''} onChange={(e) => set({ budget_eur: num(e.target.value) })} />
          </Field>
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
          <Field label="¥ pro €" hint="Kurs für die ¥-Felder">
            <TextInput type="number" step="0.01" value={draft.jpy_rate ?? ''} onChange={(e) => set({ jpy_rate: num(e.target.value) })} />
          </Field>
          <Field label="Notizen zur Reise">
            <TextArea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="Visum, JR Pass, Reisepass-Frist, Impfungen, Reiseversicherung…" />
          </Field>
        </div>
        <label className={cx('flex items-center gap-2 text-[13px] text-slate-300')}>
          <input type="checkbox" checked={draft.archived} onChange={(e) => set({ archived: e.target.checked })} className="h-4 w-4 accent-shu-500" />
          Archiviert / nur Referenz (bleibt aber sichtbar)
        </label>
      </div>
    </Modal>
  );
}
