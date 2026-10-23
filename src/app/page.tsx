'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '../lib/store';
import { TripForm } from '../components/forms';
import { Button, Card, Field, Menu, Modal, Money, SectionTitle, Stat, TextInput, cx } from '../components/ui';
import { costsOf, dayPlan, nightCoverage, tripLengthLabel } from '../lib/stats';
import { dayContext } from '../lib/today';
import { endTrip, startHint, startTrip, tripMode } from '../lib/mode';
import { addDays, fmtDate, fmtMoney, fmtRange, plural } from '../lib/format';
import type { Trip, TripBundle } from '../lib/types';

export default function HomePage() {
  const store = useStore();
  const [creating, setCreating] = useState(false);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<string | null>(null);
  const [dupForm, setDupForm] = useState({ name: '', start_date: '', end_date: '', travelers: 2, moveDates: true });
  const [busy, setBusy] = useState(false);

  const bundles = useMemo(() => {
    const byTrip = (tripId: string): TripBundle => ({
      trip: store.trips.find((t) => t.id === tripId)!,
      places: store.places.filter((p) => p.trip_id === tripId),
      hotels: store.hotels.filter((h) => h.trip_id === tripId),
      journeys: store.journeys.filter((j) => j.trip_id === tripId),
      expenses: store.expenses.filter((e) => e.trip_id === tripId),
    });
    return store.trips
      .slice()
      .sort((a, b) => (b.start_date ?? '').localeCompare(a.start_date ?? ''))
      .map((t) => byTrip(t.id));
  }, [store]);

  const runDuplicate = async () => {
    if (!duplicateSource) return;
    setBusy(true);
    const id = await store.duplicateTrip(duplicateSource, dupForm.name, {
      start_date: dupForm.start_date || null,
      end_date: dupForm.end_date || null,
      travelers: dupForm.travelers,
    });
    setBusy(false);
    setDuplicateSource(null);
    if (id) window.location.href = `/t/${id}`;
  };

  const openDuplicate = (source: Trip | undefined) => {
    if (!source) return;
    const nextStart = source.start_date ?? null;
    const nextEnd = source.end_date ?? null;
    setDupForm({
      name: `${source.name.replace(/\d{4}/, '').trim()} ${Number(source.name.match(/\d{4}/)?.[0] ?? new Date().getFullYear()) + 1}`.trim(),
      start_date: nextStart ? addDays(nextStart, 371) : '',
      end_date: nextEnd ? addDays(nextEnd, 371) : '',
      travelers: source.travelers,
      moveDates: true,
    });
    setDuplicateSource(source.id);
  };

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ai-900/60 via-ink-900/70 to-shu-700/25 px-5 py-6 sm:px-7 sm:py-8">
        <div className="pointer-events-none absolute -right-10 -top-16 text-[150px] leading-none opacity-15 select-none" aria-hidden>
          ⛩️
        </div>
        <h1 className="max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl">
          Urlaubsplanung – jeder Tag, jedes Hotel, jeder offene Punkt
        </h1>
        <p className="mt-2 max-w-xl text-[13.5px] leading-relaxed text-slate-300">
          Jeder Punkt mit Kategorie, Hinweis, Ticket, Preis und Ort auf der Karte – pro Tag als nummerierte Liste.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {bundles[0] ? (
            <Link href={`/t/${bundles[0].trip.id}/tage`} className="btn-primary">
              Weiter zu „{bundles[0].trip.name}“ →
            </Link>
          ) : null}
          <Button variant="quiet" onClick={() => setCreating(true)}>
            ＋ Neue Reise
          </Button>
          <Button variant="quiet" onClick={() => openDuplicate(store.trips[store.trips.length - 1] ?? store.trips[0])}>
            ⧉ Als Vorlage duplizieren
          </Button>
        </div>
      </section>

      <section>
        <SectionTitle
          title="Reisen"
          hint="Archivierte Reisen bleiben als Referenz erhalten – ändern kannst du sie trotzdem."
          icon="🧳"
          right={bundles.length ? <span className="text-[12px] text-slate-500">{plural(bundles.length, 'Reise', 'Reisen')}</span> : null}
        />

        {!store.ready ? (
          <Card className="px-4 py-8 text-center text-sm text-slate-400">Daten werden geladen …</Card>
        ) : !bundles.length ? (
          <Card className="px-5 py-10 text-center">
            <p className="text-sm text-slate-300">Noch keine Reisen.</p>
            <Button className="mt-3" variant="primary" onClick={() => setCreating(true)}>
              Erste Reise anlegen
            </Button>
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {bundles.map((bundle) => (
              <TripCard
                key={bundle.trip.id}
                bundle={bundle}
                onStart={() => {
                  if (startTrip(store, bundle)) window.location.href = `/t/${bundle.trip.id}/heute`;
                }}
                onEnd={() => endTrip(store, bundle, false)}
                onEdit={() => setEditingTrip(bundle.trip)}
                onDuplicate={() => openDuplicate(bundle.trip)}
                onDelete={async () => {
                  if (window.confirm(`Reise „${bundle.trip.name}“ inkl. aller Einträge löschen?`)) await store.deleteTrip(bundle.trip.id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <TipsCard />


      {creating ? (
        <TripForm
          onCancel={() => setCreating(false)}
          onSubmit={async (trip) => {
            await store.upsert('trips', trip);
            setCreating(false);
            window.location.href = `/t/${trip.id}`;
          }}
        />
      ) : null}

      {editingTrip ? (
        <TripForm
          value={editingTrip}
          onCancel={() => setEditingTrip(null)}
          onSubmit={async (t) => {
            await store.upsert('trips', t);
            setEditingTrip(null);
            store.say('Reise aktualisiert.');
          }}
          onDelete={async (t) => {
            await store.deleteTrip(t.id);
            setEditingTrip(null);
          }}
        />
      ) : null}

      {duplicateSource ? (
        <Modal
          title="Reise duplizieren"
          subtitle="Aktivitäten, Unterkünfte und Fahrten werden kopiert – Tage verschoben, Buchungsstatus zurückgesetzt."
          onClose={() => setDuplicateSource(null)}
          width="max-w-md"
          footer={
            <>
              <Button variant="quiet" onClick={() => setDuplicateSource(null)}>
                Abbrechen
              </Button>
              <Button variant="primary" disabled={busy} onClick={runDuplicate}>
                {busy ? 'Kopiere …' : 'Kopie anlegen'}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <Field label="Name der neuen Reise">
              <TextInput value={dupForm.name} onChange={(e) => setDupForm({ ...dupForm, name: e.target.value })} placeholder="Japan 2027" autoFocus />
            </Field>
            <div className="grid gap-2 sm:grid-cols-3">
              <Field label="Startdatum" hint="Vorbelegt mit +371 Tagen (53 Wochen) → gleiche Wochentage">
                <TextInput type="date" value={dupForm.start_date} onChange={(e) => setDupForm({ ...dupForm, start_date: e.target.value })} />
              </Field>
              <Field label="Enddatum">
                <TextInput type="date" value={dupForm.end_date} onChange={(e) => setDupForm({ ...dupForm, end_date: e.target.value })} />
              </Field>
              <Field label="Personen">
                <TextInput type="number" min="1" value={dupForm.travelers} onChange={(e) => setDupForm({ ...dupForm, travelers: Number(e.target.value) || 1 })} />
              </Field>
            </div>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
            Die Quelle ist „{store.trips.find((t) => t.id === duplicateSource)?.name}“. Neu angelegte Aktivitäten starten in der <b>Liste</b> (ohne Tag), damit du selbst planen kannst – oder du lässt sie
            automatisch auf die Stadttage verteilen.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {store.trips.map((t) => (
              <button
                key={t.id}
                onClick={() => setDuplicateSource(t.id)}
                className={cx('chip ring-1', t.id === duplicateSource ? 'bg-shu-500/20 text-white ring-shu-400/50' : 'bg-white/[0.04] text-slate-300 ring-white/10')}
              >
                {t.name}
              </button>
            ))}
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function TripCard({ bundle, onEdit, onDuplicate, onDelete, onStart, onEnd }: { bundle: TripBundle; onEdit: () => void; onDuplicate: () => void; onDelete: () => void; onStart: () => void; onEnd: () => void }) {
  const ctx = dayContext(bundle.trip);
  const live = tripMode(bundle.trip) === 'live';
  const heuteTag = dayPlan(bundle).find((d) => d.date === ctx?.iso) ?? null;
  const costs = costsOf(bundle);
  const gaps = nightCoverage(bundle).filter((n) => !n.covered);
  const planned = bundle.places.filter((p) => p.date).length;
  const pool = bundle.places.length - planned;
  const openBookings = bundle.places.filter((p) => p.booking_status === 'offen' && p.priority === 'muss').length + bundle.journeys.filter((j) => j.booking_status === 'offen').length;

  return (
    <Card className="print-block flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-[17px] font-semibold text-white">
              <Link href={`/t/${bundle.trip.id}/tage`} className="underline-offset-2 hover:underline">
                {bundle.trip.name}
              </Link>
            </h3>
            {bundle.trip.archived ? <span className="chip bg-white/[0.06] text-slate-300 ring-white/10">Archiv</span> : null}
          </div>
          <p className="mt-0.5 text-[12.5px] text-slate-400">
            {bundle.trip.destination || '—'} · {fmtRange(bundle.trip.start_date, bundle.trip.end_date)} · {tripLengthLabel(bundle.trip)} · {plural(bundle.trip.travelers, 'Person', 'Personen')}
          </p>
        </div>
        <span className="flex shrink-0 items-center gap-1.5">
          {live ? <span className="chip bg-emerald-500/15 text-emerald-100 ring-emerald-400/30" title="seit 🗓️">🚶 unterwegs</span> : null}
          <Link href={`/t/${bundle.trip.id}/${live ? 'heute' : 'tage'}`} className="btn-primary">
            {live ? '🚶 Unterwegs' : '🗓️ Planen →'}
          </Link>
        </span>
      </div>

      {live ? (
        <Link href={`/t/${bundle.trip.id}/heute`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-emerald-400/[0.09] px-2.5 py-1.5 text-[12px] text-emerald-100 ring-1 ring-inset ring-emerald-400/25 transition hover:bg-emerald-400/[0.16]">
          <span aria-hidden>🚶</span>
          <span className="font-medium">
            Läuft · Tag {heuteTag ? (ctx?.dayIndex ?? 1) : 1} von {ctx?.totalDays || '?'}
          </span>
          <span className="text-emerald-200/70">
            {heuteTag?.places.length
              ? `${plural(heuteTag.places.filter((x) => x.booking_status !== 'erledigt').length, 'Punkt', 'Punkte')} heute noch offen`
              : 'heute nichts eingetragen'}
            {heuteTag?.cities.length ? ` · ${heuteTag.cities.join(' / ')}` : ''}
          </span>
          <span className="ml-auto text-[11px] text-emerald-200/60 underline-offset-2">Zum Tag →</span>
        </Link>
      ) : !bundle.trip.archived && ctx?.state === 'vorher' ? (
        <Link href={`/t/${bundle.trip.id}/tage`} className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-white/[0.03] px-2.5 py-1.5 text-[12px] text-slate-300 ring-1 ring-inset ring-white/[0.07] transition hover:bg-white/[0.07]">
          <span aria-hidden>🗓️</span>
          <span>
            {bundle.trip.start_date
              ? `geplant ${ctx.daysToStart ? `in ${plural(ctx.daysToStart, 'Tag', 'Tagen')}` : 'dieses'} · ${fmtDate(bundle.trip.start_date, { day: '2-digit', month: '2-digit', year: 'numeric' })}`
              : 'noch ohne Reisezeitraum'}
          </span>
          <span className="ml-auto text-[11px] text-slate-500">Zum Plan →</span>
        </Link>
      ) : null}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Aktivitäten geplant" value={planned} hint={pool ? `${pool} noch ohne Tag` : 'alles verplant'} tone={pool ? 'warn' : 'good'} />
        <Stat label="Unterkünfte" value={bundle.hotels.length} hint={`${bundle.hotels.reduce((a, h) => a + (h.nights ?? 0), 0)} Nächte`} />
        <Stat label="Kosten" value={fmtMoney(costs.total)} hint={bundle.trip.budget_eur ? `Budget ${fmtMoney(bundle.trip.budget_eur)}` : 'kein Budget hinterlegt'} tone={bundle.trip.budget_eur && costs.total > bundle.trip.budget_eur ? 'bad' : undefined} />
        <Stat label="Offene Punkte" value={openBookings} hint={gaps.length ? `${gaps.length} Nächte ohne Hotel` : 'Nächte abgedeckt'} tone={openBookings ? 'warn' : 'good'} />
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-[12px] text-slate-400">
        {costs.byCity.slice(0, 8).map((c) => (
          <span key={c.city} className="chip bg-white/[0.04] text-slate-300 ring-white/10">
            {c.city} <span className="text-slate-500">{c.places}</span>
          </span>
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-white/[0.07] pt-3">
        <span className="text-[11.5px] text-slate-500">
          <Money value={costs.accommodation} /> Unterkunft · <Money value={costs.transport} /> Transport · <Money value={costs.entries} /> Einträge
        </span>
        <span className="ml-auto flex items-center gap-1.5">
          <Link href={`/t/${bundle.trip.id}/kosten`} className="chip bg-white/[0.05] text-slate-300 ring-white/10 hover:bg-white/[0.09]">
            Kosten im Detail
          </Link>
          <Menu
            align="right"
            variant="quiet"
            icon="⋯"
            title="Mit dieser Reise"
            items={[
              { icon: '✎', label: 'Reise bearbeiten', hint: 'Zeitraum, Budget, Personen, ¥-Kurs', run: onEdit },
              { icon: '☀️', label: 'Heute & nächste Tage', href: `/t/${bundle.trip.id}/heute` },
              ...(!bundle.trip.archived && !live
                ? [{ icon: '▶️', label: 'Reise starten', hint: startHint({ ...bundle }) || 'die Unterwegs-Seite öffnet sich', run: onStart }]
                : []),
              ...(live ? [{ icon: '✕', label: 'Reise beenden', hint: 'zurück in die Planung – Abgehaktes bleibt', run: onEnd }] : []),
              { icon: '🗓️', label: 'Tage ansehen', href: `/t/${bundle.trip.id}/tage` },
              { icon: '🌐', label: 'Übersicht ansehen', href: `/t/${bundle.trip.id}/uebersicht` },
              { icon: '⧉', label: 'Duplizieren', hint: 'Vorlage für eine nächste Reise', run: onDuplicate },
              { icon: '🗑', label: 'Reise löschen', danger: true, run: onDelete },
            ]}
          />
        </span>
      </div>
    </Card>
  );
}

function TipsCard() {
  const store = useStore();
  return (
    <section className="grid gap-3 lg:grid-cols-[1.4fr_1fr]">
      <Card className="p-4">
        <SectionTitle title="So arbeitest du" icon="💡" hint="Plane pro Tag, sieh was fehlt, und behalte Betten und Kosten im Blick." />
        <ul className="grid gap-1.5 text-[13px] leading-relaxed text-slate-300 sm:grid-cols-2">
          <li>
            <b>Tage</b>: Aktivität aus der Leiste links auf einen Tag ziehen – oder eine Lücke im Zeitband anklicken.
          </li>
          <li>
            <b>Aktivitäten</b>: was noch keinen Tag hat, steht oben; ⚡ verteilt sie auf freie Zeit.
          </li>
          <li>
            <b>Karte</b>: alles, was einen Punkt hat – und eine Suche für die, die noch keinen haben.
          </li>
          <li>
            <b>Reise</b>: Unterkünfte, Fahrten, Kosten und alle Downloads an einem Ort.
          </li>
          <li className="sm:col-span-2 text-[12.5px] text-slate-400">
            In jedem Screen steckt oben rechts ein <b>⋯</b> – dort liegen Bearbeiten, Nachziehen, Export und Drucken.
          </li>
        </ul>
      </Card>
      <Card className="p-4">
        <SectionTitle title="Diese Reise-Liste" icon="🧭" hint={store.mode === 'supabase' ? 'Datenbank verbunden – Änderungen gelten auf allen Geräten.' : 'Änderungen bleiben in diesem Browser.'} />
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => window.print()}>
            🖨 Drucken / PDF
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void store.refresh()}>
            ↻ Neu laden
          </Button>
          {store.mode !== 'supabase' ? (
            <Button size="sm" variant="ghost" onClick={() => void store.resetLocalData()} title="Alle Reisen und Einträge durch die mitgelieferte Vorlage ersetzen">
              ⟲ Vorlage wiederherstellen
            </Button>
          ) : null}
        </div>
      </Card>
    </section>
  );
}
