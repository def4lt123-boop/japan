'use client';

/**
 * Unterwegs – der Tag einer gestarteten Reise, für die Hosentasche.
 *
 * Ein Ring mit der Tagesnummer sagt, wo in der Reise du stehst, die Farbleiste darunter
 * ist die ganze Reise (ein Feld pro Nacht, so gefärbt wie das Bett). darunter der eine
 * Auftrag des Tages mit einem ✓ groß genug für den Daumen. Der Rest der Liste klappt auf
 * Tipp auseinander; umgebaut wird weiterhin auf 🗓️ Tage.
 */
import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Card, Menu, cx } from '../../../../components/ui';
import { endTrip, liveDay, nextUp, startHint, startTrip, type LiveDay } from '../../../../lib/mode';
import { dayPlaces, shiftWithin } from '../../../../lib/dayplan';
import { dayContext } from '../../../../lib/today';
import { locusChanges } from '../../../../lib/locus';
import { ChangeStrip } from '../../../../components/ChangeStrip';
import { DayNav, DayRing, LiveRow, NextUpCard, PlanChip, StickyNext, TripBar, useOutOfView } from '../../../../components/live';
import { dayPlan, nightCoverage } from '../../../../lib/stats';
import { mapsUrl } from '../../../../lib/categories';
import { dayStops, routeUrl } from '../../../../lib/maps';
import { tintFor } from '../../../../lib/palette';
import { fmtDate, plural, today } from '../../../../lib/format';
import type { Place } from '../../../../lib/types';

export default function TodayPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [offen, setOffen] = useState<string | null>(null);

  const info = liveDay(bundle.trip, today());
  const baseIso = info?.iso ?? today();
  const days = useMemo(() => (bundle.trip ? dayPlan(bundle) : []), [bundle]);
  const changes = useMemo(() => locusChanges(bundle.hotels, days.map((d) => d.date), bundle.journeys), [bundle, days]);
  const baseIdx = Math.max(0, days.findIndex((d) => d.date === baseIso));

  /** ◀ ▶ auf der Seite: geblättert wird relativ zum laufenden Tag */
  const [offset, setOffset] = useState(0);
  const iso = days[baseIdx + offset]?.date ?? baseIso;
  useEffect(() => setOffset(0), [baseIso]);

  const day = days.find((d) => d.date === iso) ?? null;
  const list = dayPlaces(bundle.places, iso);

  if (!store.ready) return <Card className="p-8 text-center text-sm text-slate-400">lädt …</Card>;
  if (!bundle.trip) return null;

  const ctx = dayContext(bundle.trip, today());
  const shared = { bundle, tripId, open, store, iso, list, days, changes, day, ctx, offen, setOffen, info, offset, setOffset, baseIdx };

  if (!bundle.trip.started) return <NichtGestartet {...shared} />;
  return <Unterwegs {...shared} />;
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
  info: LiveDay | null;
  offset: number;
  setOffset: (n: number) => void;
  baseIdx: number;
};

/* ─────────────────────────── nicht gestartet ─────────────────────────── */

function NichtGestartet({ bundle, tripId, open, store, iso, list, ctx }: View) {
  const trip = bundle.trip!;
  return (
    <div className="mx-auto w-full max-w-xl space-y-3">
      <section className="start-hero rise p-5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-shu-200">🚶 unterwegs</p>
        <h1 className="mt-1.5 text-[22px] font-semibold leading-snug text-white">
          {trip.archived ? `„${trip.name}“ ist Referenz` : 'Los geht’s, wenn du sagst'}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
          {trip.archived ? (
            <>Abgelegt zum Anschauen, nicht zum Losfahren. {' '}
              <Link href={`/t/${tripId}/tage`} className="underline underline-offset-2 hover:text-white">
                Zum Tagesplan →
              </Link>
            </>
          ) : trip.start_date ? (
            <>
              Mit <b className="text-white">▶️ Reise starten</b> wird {ctx?.state === 'live' ? 'heute' : fmtDate(iso, { day: 'numeric', month: 'long', year: 'numeric' })} der erste Tag – {startHint({ ...bundle })}.{' '}
              {list.length ? `${plural(list.length, 'Punkt', 'Punkte')} stehen für den Tag bereit.` : 'Für den Tag ist noch nichts eingetragen.'}
            </>
          ) : (
            <>Für diese Reise steht noch kein Zeitraum. Erst damit weiß die Unterwegs-Seite, welcher Tag heute ist.</>
          )}
        </p>
        {!trip.archived && trip.start_date ? (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11.5px] text-slate-300">
              <span className="chip bg-white/[0.07]">📅 Tag 1 wird heute</span>
              <span className="chip bg-white/[0.07]">↔️ Punkte und Betten rutschen mit</span>
              <span className="chip bg-white/[0.07]">✕ beendet jederzeit</span>
            </div>
            <button
              type="button"
              className="btn-go mt-4"
              onClick={() => {
                startTrip(store, bundle);
              }}
              title={`Was der Start tut: ${startHint({ ...bundle })}`}
            >
              ▶️ Reise starten
            </button>
          </>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {!trip.start_date && !trip.archived ? (
            <button type="button" className="btn-ghost !px-3 !py-2 !text-[13px]" onClick={() => open({ kind: 'trip', id: tripId })}>
              ✎ Zeitraum setzen
            </button>
          ) : null}
          <Link href={`/t/${tripId}/tage`} className="btn-ghost !px-3 !py-2 !text-[13px]">
            🗓️ Erst planen
          </Link>
        </div>
      </section>
    </div>
  );
}

/* ────────────────────────────── unterwegs ────────────────────────────── */

function Unterwegs({ bundle, tripId, open, store, iso, list, days, changes, offen, setOffen, info, offset, setOffset, baseIdx }: View) {
  const trip = bundle.trip!;
  const done = list.filter((p) => p.booking_status === 'erledigt').length;
  const coverage = useMemo(() => new Map(nightCoverage(bundle).map((n) => [n.date, n])), [bundle]);
  /** geschlafen wird, wo ein Bett die Nacht deckt – sonst ist die Nacht frei, und das darf die Seite zeigen */
  const nacht = coverage.get(iso) ?? null;
  const stay = nacht?.covered && nacht.hotelId ? bundle.hotels.find((h) => h.id === nacht.hotelId) ?? null : null;
  const change = changes.find((c) => c.date === iso) ?? null;
  const naechsteChange = changes.find((c) => c.date > iso) ?? null;
  const next = nextUp(list);
  const tag = Math.max(1, days.findIndex((d) => d.date === iso) + 1);
  const naeheTage = days.filter((d) => d.date > iso).slice(0, 4);
  const stops = dayStops(list);
  const origin = stay ?? stops[0] ?? null;
  const destination = stops.length > 1 ? stops[stops.length - 1] : stops[0] ?? null;
  const via = stops.length > 2 ? stops.slice(1, -1) : [];
  const routeHref = stops.length > 1 ? routeUrl({ origin: origin!, destination: destination!, stops: via, mode: 'transit' }) : null;
  const orte = list.map((p) => p.city).filter(Boolean) as string[];
  const ort = stay?.city ?? orte[0] ?? 'ohne Ort';
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;
  const schaffe = list.length > 0 && done === list.length;

  /** jede Unterkunft behält ihre Farbe – Kopf, Leiste und Chips reden dieselbe Sprache */
  const hotelIndex = useMemo(() => {
    const m = new Map<string, number>();
    bundle.hotels
      .slice()
      .sort((a, b) => (a.check_in ?? '').localeCompare(b.check_in ?? ''))
      .forEach((h, i) => m.set(h.id, i));
    return m;
  }, [bundle.hotels]);
  const tint = tintFor(stay?.id ?? null, stay ? hotelIndex.get(stay.id) ?? 0 : days.length);
  const bettFarbe = (date: string) => {
    const n = coverage.get(date);
    return { bed: Boolean(n?.covered), color: n?.covered && n.hotelId ? tintFor(n.hotelId, hotelIndex.get(n.hotelId) ?? 0).base : '', last: date === days[days.length - 1]?.date };
  };

  /** ✓ feedback: ein Aufblitzen, dann ist der Punkt durch */
  const [gerade, setGerade] = useState<string | null>(null);
  useEffect(() => {
    if (!gerade) return;
    const t = setTimeout(() => setGerade(null), 950);
    return () => clearTimeout(t);
  }, [gerade]);
  const toggle = (p: Place) => {
    const warOffen = p.booking_status !== 'erledigt';
    void store.patch('places', p.id, { booking_status: warOffen ? 'erledigt' : 'offen' });
    if (warOffen) setGerade(p.id);
  };

  const { ref: nextRef, out: verdeckt } = useOutOfView(Boolean(next) && offset === 0);
  const stunde = new Date().getHours();
  const gruss = stunde < 11 ? 'Guten Morgen ☀️' : stunde < 18 ? 'Guter Tag 🌤️' : stunde < 23 ? 'Guten Abend 🌇' : 'Gute Nacht 🌙';
  const label = offset === 0 ? 'Heute' : offset === -1 ? 'Gestern' : offset === 1 ? 'Morgen' : fmtDate(iso, { weekday: 'long' });

  return (
    <div className="mx-auto w-full max-w-xl space-y-3 pb-24">
      <section className="live-hero rise p-3.5" style={{ ['--hc' as string]: tint.wash } as React.CSSProperties}>
        <div className="flex items-start gap-3">
          <DayRing tag={tag} total={info?.total || days.length} done={done} count={list.length} color={schaffe ? '#4f9d5b' : tint.edge} />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              <span aria-hidden>🚶</span> unterwegs · {gruss}
              {info?.klemmt ? <span className="normal-case tracking-normal text-amber-200/85">{info.klemmt === 'vorher' ? 'der Plan beginnt erst – Tag 1 wird gezeigt' : 'der Plan ist vorbei – letzter Tag wird gezeigt'}</span> : null}
            </p>
            <h1 className="mt-1 text-[21px] font-semibold leading-tight text-white">{fmtDate(iso, { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="chip !py-0.5 !text-[11.5px] bg-white/[0.07] tabular-nums">
                Tag {tag} von {info?.total || days.length}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px]" style={{ background: tint.soft, boxShadow: `inset 0 0 0 1px ${tint.edge}55` }}>
                <span aria-hidden>📍</span>
                <b className="font-semibold text-white">{ort}</b>
              </span>
              <span className={cx('text-[12px] tabular-nums', schaffe ? 'text-emerald-200' : 'text-slate-400')}>
                {done}/{list.length} erledigt
              </span>
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
              ...(routeHref ? [{ icon: '🧭', label: 'Tagesroute bei Google Maps', hint: `${stops.length} Halte, in Listenreihenfolge`, href: routeHref }] : []),
              ...(trip.planned_start ? [{ icon: '↩', label: 'Start zurücknehmen', hint: 'Planungszeitraum wieder herstellen', run: () => endTrip(store, bundle, true) }] : []),
              { icon: '✕', label: 'Reise beenden', hint: 'zurück in die Planung', run: () => endTrip(store, bundle, false) },
            ]}
          />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <div className="bar-fill h-full rounded-full" style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${tint.base}, ${tint.edge})` }} />
          </div>
          <span className="w-9 text-right text-[11px] tabular-nums text-slate-400">{pct}%</span>
        </div>

        <div className="mt-3">
          <DayNav
            viewed={iso}
            isToday={offset === 0}
            canPrev={baseIdx + offset > 0}
            canNext={baseIdx + offset < days.length - 1}
            onPrev={() => setOffset(offset - 1)}
            onNext={() => setOffset(offset + 1)}
            onToday={() => setOffset(0)}
            label={label}
          />
        </div>
        <div className="mt-2.5">
          <TripBar
            days={days.map((d) => d.date)}
            viewed={iso}
            today={info?.iso ?? iso}
            colorFor={bettFarbe}
            onPick={(date) => setOffset(Math.max(0, days.findIndex((d) => d.date === date)) - baseIdx)}
          />
        </div>

        {stay ? (
          <a
            href={mapsUrl({ name: stay.name, city: stay.city, lat: stay.lat, lng: stay.lng, maps_query: null })}
            target="_blank"
            rel="noreferrer"
            className="mt-2.5 flex items-center gap-2 rounded-xl bg-black/25 px-2.5 py-2 text-[12.5px] text-slate-200 transition hover:bg-black/40 active:scale-[0.99]"
          >
            <span aria-hidden>🏨</span>
            <span className="min-w-0 flex-1 truncate">{stay.name}</span>
            <span className="shrink-0 text-[11.5px] text-sky-200/85">🗺️ Route ab Bett</span>
          </a>
        ) : (
          <Link href={`/t/${tripId}/unterkuenfte`} className="mt-2.5 flex items-center gap-2 rounded-xl bg-amber-500/12 px-2.5 py-2 text-[12.5px] text-amber-100 ring-1 ring-inset ring-amber-400/25 transition hover:bg-amber-500/20">
            <span aria-hidden>🏨</span>
            <span className="min-w-0 flex-1">Diese Nacht hat noch keine Unterkunft</span>
            <span className="shrink-0 text-[11.5px] underline underline-offset-2">eine wählen</span>
          </Link>
        )}
      </section>

      {change ? (
        <div className="rise overflow-hidden rounded-2xl" style={{ ['--d' as string]: '60ms' } as React.CSSProperties}>
          <ChangeStrip date={change.date} from={change.from} to={change.to} fromHotel={change.fromHotel} toHotel={change.toHotel} nightsInOld={change.nightsInOld} journey={change.journey?.title ?? null} />
        </div>
      ) : null}

      {next ? (
        <div className="rise" style={{ ['--d' as string]: '90ms' } as React.CSSProperties}>
          <NextUpCard
            place={next.place}
            nr={next.nr}
            total={next.total}
            offen={next.offen}
            note={next.place.notes ? next.place.notes.split(/[.\n]/)[0]?.trim().slice(0, 72) : null}
            eyebrow={offset === 0 ? undefined : `Tag ${tag} · erster Punkt`}
            when={offset === 0 ? 'heute' : 'an dem Tag'}
            route={routeHref ? { href: routeHref, stops: stops.length } : null}
            onDone={() => toggle(next.place)}
            cardRef={nextRef}
          />
        </div>
      ) : null}

      {!list.length ? (
        <Card className="rise p-5 text-center" style={{ ['--d' as string]: '90ms' } as React.CSSProperties}>
          <p className="text-[15px] font-medium text-white">Heute ist nichts eingetragen</p>
          <p className="mx-auto mt-1 max-w-[28rem] text-[12.5px] leading-relaxed text-slate-400">
            {bundle.places.filter((p) => !p.date).length ? 'In der Liste warten Punkte auf einen Tag – auf der Planungsseite ist einer in zwei Klicks hier.' : 'Ein freier Tag. Auch der ist ein Plan.'}
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5">
            <Link href={`/t/${tripId}/tage#${iso}`} className="btn-ghost !px-3 !py-1.5 !text-[13px]">
              🗓️ Tag planen
            </Link>
            <button type="button" className="btn-primary !px-3 !py-1.5 !text-[13px]" onClick={() => open({ kind: 'place', defaults: { date: iso } })}>
              ＋ Punkt für heute
            </button>
          </div>
        </Card>
      ) : schaffe ? (
        <div
          className="card rise p-4 text-center"
          style={{ borderColor: 'rgba(167,211,160,.34)', background: 'linear-gradient(150deg, rgba(79,157,91,.22), rgba(255,255,255,.02))' } as React.CSSProperties}
        >
          <p className="text-[16px] font-semibold text-white">🎉 Tag {tag} geschafft</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-slate-200">
            {plural(done, 'Punkt', 'Punkte')} erledigt.{' '}
            {naeheTage[0] ? `Morgen: ${plural(naeheTage[0].places.length, 'Punkt', 'Punkte')}${naeheTage[0].cities.length ? ` in ${naeheTage[0].cities.join(' / ')}` : ''}.` : 'Das war der letzte eingetragene Tag.'}
          </p>
          <div className="mt-2.5 flex flex-wrap justify-center gap-1.5">
            {naeheTage[0] ? (
              <button type="button" className="btn-ghost !px-3 !py-1.5 !text-[12.5px]" onClick={() => setOffset(offset + 1)}>
                Morgen ansehen →
              </button>
            ) : null}
            <button type="button" className="btn-quiet !px-2.5 !py-1.5 !text-[12.5px]" onClick={() => endTrip(store, bundle, false)}>
              ✕ Reise beenden
            </button>
          </div>
        </div>
      ) : null}

      {list.length ? (
        <Card className="rise divide-y divide-white/[0.05] p-0" style={{ ['--d' as string]: '150ms' } as React.CSSProperties}>
          {list.map((p, i) => (
            <LiveRow
              key={p.id}
              place={p}
              nr={i + 1}
              total={list.length}
              index={i}
              expanded={offen === p.id}
              justDone={gerade === p.id}
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
        <section className="rise" style={{ ['--d' as string]: '210ms' } as React.CSSProperties}>
          <div className="mb-1.5 flex items-baseline gap-2 px-1">
            <h3 className="text-[12.5px] font-semibold text-white">Reiseplan</h3>
            <span className="text-[11px] text-slate-500">die nächsten {plural(naeheTage.length, 'Tag', 'Tage')}</span>
            <Link href={`/t/${tripId}/tage`} className="ml-auto text-[11.5px] text-slate-400 underline-offset-2 hover:text-white hover:underline">
              ganzer Plan →
            </Link>
          </div>
          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1">
            {naeheTage.map((d, i) => {
              const night = coverage.get(d.date)?.covered ? bundle.hotels.find((h) => h.id === coverage.get(d.date)!.hotelId) ?? null : null;
              const c = changes.find((x) => x.date === d.date);
              return (
                <PlanChip
                  key={d.date}
                  date={d.date}
                  index={i}
                  label={i === 0 ? 'Morgen' : fmtDate(d.date, { weekday: 'short' })}
                  count={d.places.length}
                  city={d.cities[0] ?? night?.city ?? null}
                  color={night ? tintFor(night.id, hotelIndex.get(night.id) ?? 0).base : '#8b93a1'}
                  change={c ? { from: c.from, to: c.to } : null}
                  noBed={!night}
                  onOpen={() => setOffset(days.indexOf(d) - baseIdx)}
                />
              );
            })}
          </div>
          {naechsteChange ? (
            <p className="mt-1.5 px-1 text-[11.5px] text-shu-200/90">
              🔀 nächster Ortswechsel {fmtDate(naechsteChange.date, { weekday: 'short', day: '2-digit', month: '2-digit' })}: {naechsteChange.from} → {naechsteChange.to}
              {naechsteChange.toHotel ? ` · 🏨 ${naechsteChange.toHotel}` : ' · 🏨 noch ohne Bett'}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 px-1 pt-1">
        <button type="button" className="btn-quiet !px-2.5 !py-1.5 !text-[12.5px]" onClick={() => endTrip(store, bundle, false)}>
          ✕ Reise beenden
        </button>
        <span className="text-[11.5px] text-slate-500">danach ist wieder die Planung dran</span>
      </div>

      <StickyNext place={offset === 0 && verdeckt ? next?.place ?? null : null} visible={offset === 0 && verdeckt && Boolean(next)} onDone={() => next && toggle(next.place)} />
    </div>
  );
}
