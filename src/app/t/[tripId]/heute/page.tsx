'use client';

/**
 * Unterwegs – der Tag einer gestarteten Reise.
 *
 * Gross, fingerfreundlich, ohne Editier-Orgie: der Tag ist eine nummerierte Liste,
 * jeder Punkt mit 🗺️ Route, Hinweisen und ✓. Gebaut wird auf 🗓️ Tage; hier wird
 * gegangen, angesehen und abgehakt. Beendet mit ✕ Reise beenden.
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Button, Card, Menu, ProgressBar, cx } from '../../../../components/ui';
import { endTrip, liveDay, nextUp, startHint, startTrip } from '../../../../lib/mode';
import { dayPlaces, shiftWithin } from '../../../../lib/dayplan';
import { dayContext } from '../../../../lib/today';
import { locusChanges, stayOn } from '../../../../lib/locus';
import { ChangeStrip } from '../../../../components/Ortswechsel';
import { dayPlan } from '../../../../lib/stats';
import { TICKET_META, categoryMeta, mapsUrl } from '../../../../lib/categories';
import { dayStops, routeUrl } from '../../../../lib/maps';
import { CategoryDot } from '../../../../components/CategoryDot';
import { fmtDate, plural, today } from '../../../../lib/format';
import type { Place } from '../../../../lib/types';

export default function TodayPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [offen, setOffen] = useState<string | null>(null);

  const iso = liveDay(bundle.trip, today())?.iso ?? today();
  const days = useMemo(() => (bundle.trip ? dayPlan(bundle) : []), [bundle]);
  const changes = useMemo(() => locusChanges(bundle.places, bundle.hotels, days.map((d) => d.date), bundle.journeys), [bundle, days]);
  const day = days.find((d) => d.date === iso) ?? null;
  const list = dayPlaces(bundle.places, iso);

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  const ctx = dayContext(bundle.trip, today());
  const shared = { bundle, tripId, open, store, iso, list, days, changes, day, ctx, offen, setOffen };

  if (!bundle.trip.started) return <NichtGestartet {...shared} />;
  return <Unterwegs {...shared} info={liveDay(bundle.trip, today())} />;
}

type View = {
  bundle: ReturnType<typeof useTrip>;
  tripId: string;
  open: ReturnType<typeof useEditor>['open'];
  store: ReturnType<typeof useStore>;
  iso: string;
  list: Place[];
  days: ReturnType<typeof dayPlan>;
  changes: ReturnType<typeof locusChanges>;
  day: ReturnType<typeof dayPlan>[number] | null;
  ctx: ReturnType<typeof dayContext>;
  offen: string | null;
  setOffen: (v: string | null) => void;
};

/* ─────────────────────────── nicht gestartet ─────────────────────────── */

function NichtGestartet({ bundle, tripId, open, store, iso, list, ctx }: View) {
  const trip = bundle.trip!;
  return (
    <div className="mx-auto w-full max-w-xl space-y-3">
      <Card className="p-5">
        <p className="text-[11.5px] uppercase tracking-wide text-slate-500">🚶 unterwegs</p>
        <h1 className="mt-1 text-[19px] font-semibold leading-snug text-white">Diese Reise läuft gerade nicht</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
          {trip.archived ? (
            <>
              „{trip.name}“ ist als Referenz abgelegt – zum Anschauen, nicht zum Losfahren.{' '}
              <Link href={`/t/${tripId}/tage`} className="underline underline-offset-2 hover:text-white">
                Zum Tagesplan →
              </Link>
            </>
          ) : trip.start_date ? (
            <>
              Mit <b className="text-white">▶️ Reise starten</b> wird {ctx?.state === 'live' ? 'heute' : fmtDate(iso, { day: '2-digit', month: 'long', year: 'numeric' })} der erste Tag – {startHint({ ...bundle })}. {list.length ? `${plural(list.length, 'Punkt', 'Punkte')} stehen für den Tag bereit.` : 'Für den Tag ist noch nichts eingetragen.'}
            </>
          ) : (
            <>Für diese Reise steht noch kein Zeitraum. Erst damit weiß die Unterwegs-Seite, welcher Tag heute ist.</>
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!trip.archived ? (
            <Button
              variant="primary"
              onClick={() => {
                startTrip(store, bundle);
              }}
              title={`Was der Start tut: ${startHint({ ...bundle })}`}
            >
              ▶️ Reise starten
            </Button>
          ) : null}
          {!trip.start_date && !trip.archived ? (
            <Button variant="ghost" onClick={() => open({ kind: 'trip', id: tripId })}>
              ✎ Zeitraum setzen
            </Button>
          ) : null}
          <Link href={`/t/${tripId}/tage`} className="btn-ghost">
            🗓️ Planen
          </Link>
        </div>
      </Card>
    </div>
  );
}

/* ────────────────────────────── unterwegs ────────────────────────────── */

function Unterwegs({ bundle, tripId, open, store, iso, list, days, changes, offen, setOffen, info, ctx }: View & { info: ReturnType<typeof liveDay> }) {
  const trip = bundle.trip!;
  const done = list.filter((p) => p.booking_status === 'erledigt').length;
  const stay = stayOn(bundle.hotels, iso);
  const change = changes.find((c) => c.date === iso) ?? null;
  const naechsteChange = changes.find((c) => c.date > iso) ?? null;
  const next = nextUp(list);
  const naeheTage = days.filter((d) => d.date > iso).slice(0, 3);
  const stops = dayStops(list);
  const hotel = stayOn(bundle.hotels, iso);
  const origin = hotel ?? stops[0] ?? null;
  const destination = stops.length > 1 ? stops[stops.length - 1] : stops[0] ?? null;
  const via = stops.length > 2 ? stops.slice(1, -1) : [];

  const toggle = (p: Place) => store.patch('places', p.id, { booking_status: p.booking_status === 'erledigt' ? 'offen' : 'erledigt' });

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 pb-24">
      <Card className="border-emerald-300/20 bg-ink-800 p-3">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] uppercase tracking-wide text-emerald-200/80">
              <span aria-hidden>🚶</span> unterwegs
              {info?.klemmt ? <span className="normal-case tracking-normal text-amber-200/80">{info.klemmt === 'vorher' ? 'der Plan beginnt erst – Tag 1 wird gezeigt' : 'der Plan ist vorbei – letzter Tag wird gezeigt'}</span> : null}
            </p>
            <h1 className="mt-0.5 text-[20px] font-semibold leading-tight text-white">{fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-slate-300">
              <span className="text-slate-400">
                Tag {info?.tagIndex ?? '–'} von {info?.total || ctx?.totalDays || '?'}
              </span>
              <span className="text-slate-600">·</span>
              <span aria-hidden>📍</span>
              <span className="font-medium">{list[0]?.city ?? stay?.city ?? 'ohne Ort'}</span>
              {list.length ? (
                <>
                  <span className="text-slate-600">·</span>
                  <span className={cx('tabular-nums', done === list.length ? 'text-emerald-200' : 'text-slate-400')}>
                    {done}/{list.length} erledigt
                  </span>
                </>
              ) : null}
            </p>
          </div>
          <Menu
            align="right"
            variant="quiet"
            icon="⋯"
            title="Unterwegs"
            items={[
              { icon: '🗓️', label: 'Alles planen', hint: 'Tage, Aktivitäten, Karte', href: `/t/${tripId}/tage` },
              { icon: '🗺️', label: 'Karte der Stadt', hint: 'Punkte und Unterkünfte', href: `/t/${tripId}/karte` },
              ...(stops.length > 1 ? [{ icon: '🧭', label: 'Tagesroute bei Google Maps', hint: `${stops.length} Halte, in Listenreihenfolge`, href: routeUrl({ origin: origin!, destination: destination!, stops: via, mode: 'transit' as const }) }] : []),
              ...(trip.planned_start ? [{ icon: '↩', label: 'Start zurücknehmen', hint: 'Planungszeitraum wieder herstellen', run: () => endTrip(store, bundle, true) }] : []),
              { icon: '✕', label: 'Reise beenden', hint: 'zurück in die Planung', run: () => endTrip(store, bundle, false) },
            ]}
          />
        </div>
        {list.length ? (
          <div className="mt-2">
            <ProgressBar value={done} max={list.length} tone="matcha" />
          </div>
        ) : null}
        {stay ? (
          <a href={mapsUrl({ name: stay.name, city: stay.city, lat: stay.lat, lng: stay.lng, maps_query: null })} target="_blank" rel="noreferrer" className="mt-2 flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-1.5 text-[12.5px] text-slate-300 active:bg-black/40">
            <span aria-hidden>🏨</span>
            <span className="min-w-0 flex-1 truncate">{stay.name}</span>
            <span className="shrink-0 text-[11.5px] text-sky-200/80">🗺️ Route ab Bett</span>
          </a>
        ) : (
          <p className="mt-2 rounded-xl bg-amber-500/10 px-2.5 py-1.5 text-[12.5px] text-amber-100">
            🏨 Diese Nacht hat noch keine Unterkunft – <Link href={`/t/${tripId}/unterkuenfte`} className="underline underline-offset-2">eine wählen</Link>
          </p>
        )}
      </Card>

      {change ? (
        <Card className="overflow-hidden p-0">
          <ChangeStrip date={change.date} from={change.from ?? '—'} to={change.to} fromHotel={change.fromHotel} toHotel={change.toHotel} daysInOld={change.daysInOld} onOpen={() => open({ kind: 'move', date: change.date })} />
        </Card>
      ) : null}

      {!list.length ? (
        <Card className="p-5 text-center">
          <p className="text-[15px] font-medium text-white">Heute ist nichts eingetragen</p>
          <p className="mx-auto mt-1 max-w-[28rem] text-[12.5px] leading-relaxed text-slate-400">
            {bundle.places.filter((p) => !p.date).length ? 'In der Liste warten Punkte auf einen Tag – auf der Planungsseite ist einer in zwei Klicks hier.' : 'Ein freier Tag. Auch der ist ein Plan.'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Link href={`/t/${tripId}/tage#${iso}`} className="btn-ghost !px-3 !py-1.5 !text-[13px]">
              🗓️ Tag planen
            </Link>
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'place', defaults: { date: iso } })}>
              ＋ Punkt für heute
            </Button>
          </div>
        </Card>
      ) : list.length === done ? (
        <Card className="border-emerald-300/30 bg-emerald-400/[0.08] p-3.5">
          <p className="text-[14.5px] font-semibold text-white">🎉 Tag {info?.tagIndex ?? ''} geschafft – {plural(done, 'Punkt', 'Punkte')} erledigt</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-300">
            {naeheTage[0] ? `Morgen: ${plural(naeheTage[0].places.length, 'Punkt', 'Punkte')}${naeheTage[0].cities.length ? ` in ${naeheTage[0].cities.join(' / ')}` : ''}.` : 'Das war der letzte eingetragene Tag.'}{' '}
            <button className="text-shu-200 underline-offset-2 hover:underline" onClick={() => endTrip(store, bundle, false)}>
              ✕ Reise beenden
            </button>
          </p>
        </Card>
      ) : null}

      {next ? (
        <Card className="border-emerald-300/25 bg-emerald-400/[0.07] p-3">
          <p className="text-[11.5px] uppercase tracking-wide text-emerald-200/80">
            als nächstes · stelle {next.nr} von {next.total}
          </p>
          <div className="mt-1 flex items-start gap-2.5">
            <CategoryDot category={next.place.category} size={26} />
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-semibold leading-snug text-white">{next.place.name}</p>
              <p className="mt-0.5 text-[12.5px] text-slate-300">
                {next.place.city || '—'}
                {next.place.notes ? ` · ${next.place.notes.split(/[.\n]/)[0]?.trim().slice(0, 70)}` : ''}
              </p>
              {next.place.ticket_status === 'noetig' ? (
                <p className="mt-1 text-[12px] text-amber-100">
                  🎫 {TICKET_META.noetig.label}
                  {next.place.ticket_note ? ` – ${next.place.ticket_note}` : ''}
                </p>
              ) : null}
            </div>
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <a href={mapsUrl(next.place)} target="_blank" rel="noreferrer" className="btn-primary !px-3 !py-1.5 !text-[13px]">
              🗺️ Hinfinden
            </a>
            <Button size="sm" variant="ghost" onClick={() => toggle(next.place)}>
              ✓ erledigt
            </Button>
            {stops.length > 1 ? (
              <a href={routeUrl({ origin: origin!, destination: destination!, stops: via, mode: 'transit' })} target="_blank" rel="noreferrer" className="btn-quiet !px-2.5 !py-1.5 !text-[12.5px]">
                🧭 Tagesroute
              </a>
            ) : null}
          </div>
        </Card>
      ) : null}

      {list.length ? (
        <Card className="divide-y divide-white/[0.05] p-0">
          {list.map((p, i) => (
            <Row
              key={p.id}
              place={p}
              nr={i + 1}
              total={list.length}
              expanded={offen === p.id}
              onExpand={() => setOffen(offen === p.id ? null : p.id)}
              onToggle={() => toggle(p)}
              onEdit={() => open({ kind: 'place', id: p.id })}
              onUp={i > 0 ? () => shiftWithin(store, bundle.places, p, -1) : undefined}
              onDown={i < list.length - 1 ? () => shiftWithin(store, bundle.places, p, 1) : undefined}
            />
          ))}
        </Card>
      ) : null}

      {naeheTage.length ? (
        <Card className="p-3">
          <div className="flex items-baseline gap-2">
            <h3 className="text-[13px] font-semibold text-white">Reiseplan</h3>
            <span className="text-[11.5px] text-slate-500">die nächsten {plural(naeheTage.length, 'Tag', 'Tage')}</span>
            <Link href={`/t/${tripId}/tage`} className="ml-auto text-[11.5px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
              ganzer Plan →
            </Link>
          </div>
          <ul className="mt-1.5 space-y-2.5">
            {naeheTage.map((d, i) => {
              const night = stayOn(bundle.hotels, d.date);
              const change = changes.find((c) => c.date === d.date);
              return (
                <li key={d.date}>
                  <Link href={`/t/${tripId}/tage#${d.date}`} className="block">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[12.5px] font-semibold text-white">{i === 0 ? 'Morgen' : fmtDate(d.date, { weekday: 'long' })}</span>
                      <span className="text-[11px] text-slate-500">{fmtDate(d.date, { day: '2-digit', month: '2-digit' })}</span>
                      <span className="ml-auto text-[11px] text-slate-500">{d.places.length ? plural(d.places.length, 'Punkt', 'Punkte') : 'frei'}</span>
                    </div>
                    {d.places.length ? <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-300">{d.places.slice(0, 4).map((x) => x.name).join(' · ')}</p> : null}
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-slate-500">
                      <span aria-hidden>📍</span>
                      <span>{d.cities.join(' / ') || night?.city || 'ohne Ort'}</span>
                      {change ? <span className="text-shu-200">🔀 {change.from} → {change.to}</span> : null}
                      {!night ? <span className="text-amber-200/70">🏨 Nacht ohne Bett</span> : null}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
          {naechsteChange ? (
            <p className="mt-2 border-t border-white/[0.06] pt-2 text-[12px] text-shu-200">
              🔀 nächster Ortswechsel {fmtDate(naechsteChange.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}: {naechsteChange.from} → {naechsteChange.to}
              {naechsteChange.toHotel ? ` · 🏨 ${naechsteChange.toHotel}` : ' · 🏨 noch ohne Bett'}
            </p>
          ) : null}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 px-1">
        <Button variant="quiet" size="sm" onClick={() => endTrip(store, bundle, false)}>
          ✕ Reise beenden
        </Button>
        <span className="text-[11.5px] text-slate-500">danach ist wieder die Planung dran</span>
      </div>

      {next ? (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-xl px-3 pb-3">
          <Card className="flex items-center gap-2.5 bg-ink-800/95 p-2.5 shadow-[0_-8px_30px_rgba(0,0,0,0.5)] backdrop-blur">
            <CategoryDot category={next.place.category} size={22} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">
                {next.nr}. {next.place.name}
              </p>
              <p className="truncate text-[11.5px] text-slate-400">
                {next.place.city || '—'} · noch {plural(next.offen, 'Punkt', 'Punkte')} heute
              </p>
            </div>
            <a href={mapsUrl(next.place)} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 !text-[12px]" title="Bei Google Maps öffnen">
              🗺️
            </a>
            <button className="btn-primary !px-2.5 !py-1 !text-[12px]" onClick={() => toggle(next.place)} title="erledigt abhaken">
              ✓
            </button>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

/** eine Zeile im Vorbeigehen: abhaken, ansehen, Hinweise – Bearbeiten nur als ✎ */
function Row({
  place,
  nr,
  total,
  expanded,
  onExpand,
  onToggle,
  onEdit,
  onUp,
  onDown,
}: {
  place: Place;
  nr: number;
  total: number;
  expanded: boolean;
  onExpand: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onUp?: () => void;
  onDown?: () => void;
}) {
  const done = place.booking_status === 'erledigt';
  const meta = categoryMeta(place.category);
  const ticket = place.ticket_status && place.ticket_status !== 'unklar' && place.ticket_status !== 'keins' ? TICKET_META[place.ticket_status] : null;
  return (
    <li className={cx('px-2.5 py-2.5 transition', done && 'bg-emerald-400/[0.05]')}>
      <div className="flex items-start gap-2.5">
        <button
          onClick={onToggle}
          className={cx(
            'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[14px] transition',
            done ? 'border-emerald-400/50 bg-emerald-400/20 text-emerald-200' : 'border-white/20 text-transparent hover:border-white/40 hover:text-white/40 active:text-white/60',
          )}
          title={done ? 'wieder offen' : 'erledigt'}
          aria-label={done ? 'wieder offen' : 'erledigt'}
        >
          ✓
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className={cx('text-[11.5px] tabular-nums', done ? 'text-slate-600' : 'text-slate-400')}>
              {nr}/{total}
            </span>
            <span className={cx('min-w-0 flex-1 text-[15px] font-medium leading-snug', done ? 'text-slate-500 line-through' : 'text-white')}>{place.name}</span>
          </div>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-slate-400">
            <CategoryDot category={place.category} size={17} />
            <span>{meta.label}</span>
            {place.city ? <span>· 📍 {place.city}</span> : null}
            {place.price_eur ? <span>· {place.price_eur} €</span> : place.price_note ? <span>· {place.price_note}</span> : null}
            {ticket ? <span className={cx('chip', place.ticket_status === 'gekauft' ? 'bg-emerald-500/15 text-emerald-100' : 'bg-amber-500/15 text-amber-100')}>{ticket.short}</span> : null}
          </p>
          {expanded ? (
            <div className="mt-1.5 space-y-1 rounded-xl bg-black/25 p-2.5 text-[12.5px] leading-relaxed text-slate-300">
              {place.notes ? <p>{place.notes}</p> : <p className="text-slate-500">keine Notiz</p>}
              {place.ticket_note ? <p>🎫 {place.ticket_note}</p> : null}
              {place.booking_url ? (
                <a href={place.booking_url.startsWith('http') ? place.booking_url : `https://${place.booking_url}`} target="_blank" rel="noreferrer" className="text-sky-200 underline underline-offset-2">
                  🔗 Webseite / Buchung
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <a href={mapsUrl(place)} target="_blank" rel="noreferrer" className="btn-ghost !px-2 !py-1 !text-[12px]" title="Bei Google Maps öffnen (Route, Fahrplan, Umgebung)">
            🗺️
          </a>
          {place.notes ? (
            <button className="btn-quiet !px-2 !py-0.5 !text-[11px] normal-case tracking-normal" onClick={onExpand} title="Hinweise und Preis">
              {expanded ? 'zu' : 'Notiz'}
            </button>
          ) : null}
          <span className="flex gap-0.5">
            {onUp ? (
              <button className="icon-btn !h-5 !text-[10px]" title="früher" onClick={onUp} disabled={nr <= 1}>
                ▲
              </button>
            ) : null}
            {onDown ? (
              <button className="icon-btn !h-5 !text-[10px]" title="später" onClick={onDown}>
                ▼
              </button>
            ) : null}
          </span>
          <button className="icon-btn !text-[11px] text-slate-500" onClick={onEdit} title="Bearbeiten">
            ✎
          </button>
        </div>
      </div>
    </li>
  );
}
