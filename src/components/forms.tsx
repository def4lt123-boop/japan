'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Field, Modal, Select, TextArea, TextInput, cx } from './ui';
import { BOOKING_STATUSES, EXPENSE_CATEGORIES, JOURNEY_MODES, PRIORITIES, TIME_SLOTS, type Expense, type Hotel, type Journey, type Place, type Trip } from '../lib/types';
import { PRIORITY_META, STATUS_META, TICKET_META, TICKET_ORDER, mapsUrl } from '../lib/categories';
import { eachDate, fmtDate, fmtDuration, num, parseDuration, uid } from '../lib/format';
import { DateField, DateRangeField } from './dates';
import type { TicketStatus } from '../lib/types';
import { CATEGORY_SUGGESTIONS } from '../lib/categories';
import { geocode, parseMapsUrl, queryFor } from '../lib/geocode';

const statusOptions = BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }));
const priorityOptions = PRIORITIES.map((p) => ({ value: p, label: `${PRIORITY_META[p].icon} ${PRIORITY_META[p].label}` }));

/** Gemeinsame Geo-Komponente: OSM-Suche + Google-Maps-URL einfügen */
function GeoFields({
  lat,
  lng,
  query,
  onChange,
  suggest,
}: {
  lat: number | null;
  lng: number | null;
  query: string | null;
  onChange: (patch: Partial<{ lat: number | null; lng: number | null; maps_query: string | null }>) => void;
  suggest: string;
}) {
  const [mapsInput, setMapsInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const runGeocode = async () => {
    setBusy(true);
    setMsg(null);
    const hit = await geocode(query?.trim() || suggest);
    setBusy(false);
    if (hit) {
      onChange({ lat: round(hit.lat), lng: round(hit.lng), maps_query: query?.trim() || suggest });
      setMsg(`Gefunden: ${hit.label.slice(0, 90)}`);
    } else {
      setMsg('Nichts gefunden – bitte Google-Maps-Link unten einfügen.');
    }
  };

  const useMapsLink = () => {
    const parsed = parseMapsUrl(mapsInput);
    if (!parsed) {
      setMsg('Den Link konnte ich nicht lesen. Erwartet wird z. B. …/maps/place/…/@35.6597,139.7007,17z');
      return;
    }
    onChange({ lat: round(parsed.lat), lng: round(parsed.lng), maps_query: query || parsed.query || suggest });
    setMapsInput('');
    setMsg('Koordinaten aus dem Google-Maps-Link übernommen ✔');
  };

  return (
    <Card className="bg-black/20 p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Karte & Google Maps</span>
        <span className="text-[11.5px] tabular-nums text-slate-400">
          {lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : 'keine Koordinaten'}
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
        <Field label="Suchbegriff für Maps" className="min-w-0">
          <TextInput value={query ?? ''} placeholder={suggest} onChange={(e) => onChange({ maps_query: e.target.value })} />
        </Field>
        <Field label="Breitengrad">
          <TextInput type="number" step="0.000001" value={lat ?? ''} onChange={(e) => onChange({ lat: num(e.target.value), lng })} className="w-[132px]" />
        </Field>
        <Field label="Längengrad">
          <TextInput type="number" step="0.000001" value={lng ?? ''} onChange={(e) => onChange({ lng: num(e.target.value), lat })} className="w-[132px]" />
        </Field>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Button size="sm" variant="ghost" onClick={runGeocode} disabled={busy}>
          {busy ? 'Suche…' : '🌍 Koordinaten suchen (OSM)'}
        </Button>
        <Button size="sm" variant="ghost" onClick={useMapsLink} disabled={!mapsInput.trim()}>
          📌 Google-Maps-Link übernehmen
        </Button>
        <TextInput className="min-w-[220px] flex-1" placeholder="https://www.google.com/maps/place/…/…/@35.65,139.70,17z" value={mapsInput} onChange={(e) => setMapsInput(e.target.value)} />
        {lat !== null && lng !== null ? (
          <a className="btn-quiet" href={mapsUrl({ lat, lng, name: '', city: '', maps_query: query ?? null })} target="_blank" rel="noreferrer">
            In Google Maps öffnen ↗
          </a>
        ) : null}
      </div>
      {msg ? <p className="mt-1.5 text-[11.5px] text-slate-400">{msg}</p> : null}
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
  onSubmit: (place: Place) => void;
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
  const [durationText, setDurationText] = useState(fmtDuration(value?.duration_min ?? null));

  useEffect(() => {
    document.getElementById('place-name-input')?.focus();
  }, []);

  const set = (patch: Partial<Place>) => setDraft((d) => ({ ...d, ...patch }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) return;
    const { name, city } = draft;
    const end = draft.end_date && draft.date && draft.end_date < draft.date ? draft.date : draft.end_date;
    onSubmit({
      ...draft,
      name: name.trim(),
      city: city.trim() || 'Unbekannt',
      end_date: draft.date ? end : null,
      duration_min: parseDuration(durationText) ?? draft.duration_min,
      ticket_status: (draft.ticket_status ?? 'unklar') as TicketStatus,
      sort_order: draft.sort_order ?? 0,
    });
  };

  return (
    <Modal
      title={isNew ? 'Neuer Eintrag' : 'Eintrag bearbeiten'}
      subtitle={isNew ? 'Ort anlegen – Datum ist optional, ohne Datum liegt er in der Wünscheliste.' : draft.name}
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
          <Button variant="primary" onClick={(e) => submit(e as unknown as React.FormEvent)}>
            Speichern <span className="opacity-60">(⌘↵)</span>
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
          <Field label="Was ist es? *">
            <TextInput id="place-name-input" value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="z. B. Nara-Park" />
          </Field>
          <Field label="Stadt">
            <TextInput list="city-list" value={draft.city} onChange={(e) => set({ city: e.target.value })} placeholder="Nara" />
            <datalist id="city-list">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="Stadtteil / Viertel">
            <TextInput value={draft.district ?? ''} onChange={(e) => set({ district: e.target.value })} placeholder="Higashiyama" />
          </Field>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1.3fr]">
          <Field label="Kategorie">
            <TextInput list="cat-list" value={draft.category ?? ''} onChange={(e) => set({ category: e.target.value })} placeholder="Park, Tempel, Ramen …" />
            <datalist id="cat-list">
              {CATEGORY_SUGGESTIONS.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <div>
            <span className="label">Ticket</span>
            <TicketPicker value={draft.ticket_status} note={draft.ticket_note} onChange={(patch) => set(patch)} />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_0.8fr]">
          <Field label="Preis in € (gesamt)">
            <TextInput type="number" step="0.01" min="0" value={draft.price_eur ?? ''} onChange={(e) => set({ price_eur: num(e.target.value) })} placeholder="16,00" />
          </Field>
          <Field label="Preis in ¥" hint="beim Verlassen → € mit aktuellem Kurs">
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
          <Field label="Preis-Hinweis">
            <TextInput value={draft.price_note ?? ''} onChange={(e) => set({ price_note: e.target.value })} placeholder="online günstiger / 2 Personen" />
          </Field>
          <Field label="Prio">
            <Select options={priorityOptions} value={draft.priority} onChange={(e) => set({ priority: e.target.value as Place['priority'] })} />
          </Field>
        </div>

        <GeoFields lat={draft.lat} lng={draft.lng} query={draft.maps_query} suggest={queryFor(draft)} onChange={(patch) => set(patch)} />

        <Field label="Hinweise">
          <TextArea value={draft.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder="früh da sein, Ticket am Schalter, geschlossen Mo …" />
        </Field>

        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Link (Buchung/Website)">
            <TextInput value={draft.booking_url ?? ''} onChange={(e) => set({ booking_url: e.target.value })} placeholder="https://…" />
          </Field>
          <Field label="Bild-URL (optional)">
            <TextInput value={draft.image_url ?? ''} onChange={(e) => set({ image_url: e.target.value })} placeholder="https://…" />
          </Field>
        </div>

        <details className="rounded-xl border border-white/[0.08] bg-black/20 p-2.5" open={Boolean(draft.date || draft.start_time || draft.duration_min || draft.time_slot)}>
          <summary className="cursor-pointer select-none text-[12.5px] font-semibold text-slate-200">
            Wann? – <span className="font-normal text-slate-500">können wir später auch per Drag &amp; Drop auf einen Tag ziehen</span>
          </summary>
          <div className="mt-2.5 space-y-2.5">
            <div className="grid gap-2 sm:grid-cols-2">
              <DateField
                name="date"
                label="Tag der Reise"
                value={draft.date}
                onChange={(v) => set({ date: v, end_date: v && draft.end_date && draft.end_date < v ? null : draft.end_date })}
                hint={draft.date ? undefined : 'leer = Wünscheliste'}
                quickDates={tripDays}
                tripBounds={bounds}
              />
              <DateField
                name="end_date"
                label="bis (Mehrtages-Ausflug)"
                value={draft.end_date}
                onChange={(v) => set({ end_date: v })}
                hint={draft.date && draft.end_date ? `${Math.max(1, eachDate(draft.date, draft.end_date).length)} Tage` : 'optional'}
                minDate={draft.date}
                maxDate={tripEnd ?? null}
                startHint={draft.date ? 'Endtag wählen' : 'erst Tag wählen'}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Tageszeit">
                <Select allowEmpty options={TIME_SLOTS} value={draft.time_slot ?? ''} onChange={(e) => set({ time_slot: (e.target.value || null) as Place['time_slot'] })} emptyLabel="—" />
              </Field>
              <Field label="Uhrzeit">
                <TextInput type="time" value={draft.start_time ?? ''} onChange={(e) => set({ start_time: e.target.value || null })} />
              </Field>
              <Field label="Dauer" hint='"2h", "1:30", "45 min"'>
                <TextInput value={durationText} onChange={(e) => setDurationText(e.target.value)} placeholder="2 h" />
              </Field>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Fahrzeit vom Hotel">
                <TextInput value={draft.travel_time ?? ''} onChange={(e) => set({ travel_time: e.target.value })} placeholder="Ca 30 Min" />
              </Field>
              <Field label="Buchungsstatus">
                <Select options={statusOptions} value={draft.booking_status} onChange={(e) => set({ booking_status: e.target.value as Place['booking_status'] })} />
              </Field>
            </div>
          </div>
        </details>
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
  onSubmit: (h: Hotel) => void;
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
          onChange={(p) => set({ lat: p.lat, lng: p.lng })}
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
      title={isNew ? 'Neue Etappe' : 'Etappe bearbeiten'}
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
  onSubmit: (e: Expense) => void;
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
      subtitle="Alles, was nicht schon bei Hotels/Eintritten/Etappen steht"
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
          <Field label="Wer war in Vorleistung?">
            <TextInput value={draft.payer ?? ''} onChange={(e) => set({ payer: e.target.value })} placeholder="z. B. Satzi / Anna" />
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
