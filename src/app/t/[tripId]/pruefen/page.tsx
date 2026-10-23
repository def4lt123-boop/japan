'use client';

/**
 * „Reise prüfen“ – der Rundgang über die eigenen Daten. Er meldet Löcher zwischen den
 * Betten, doppelt gebuchte Nächte, Punkte außerhalb des Zeitraums und einen Plan, der
 * komplett um ein paar Tage verrutscht ist. Nichts davon ändert er von selbst: jeder
 * Befund schickt die Zeilen mit, die sein Knopf schreibt.
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useStore, useTrip, type StoreValue } from '../../../../lib/store';
import { Button, Card, SectionTitle, cx } from '../../../../components/ui';
import { checkTrip, type Action, type Finding, type PatchSet } from '../../../../lib/checks';
import { plural } from '../../../../lib/format';
import type { Hotel, Journey, Place, Trip } from '../../../../lib/types';
import { nightCoverage } from '../../../../lib/stats';

const TONE = {
  bad: { label: 'Fehler', color: '#f43f5e', icon: '⛔' },
  warn: { label: 'Achtung', color: '#f59e0b', icon: '⚠️' },
  info: { label: 'Hinweis', color: '#64748b', icon: 'ℹ️' },
} as const;

/** ein Schreibsatz pro Tabelle – dieselbe Reihenfolge wie die Zeilen in den Daten */
async function writeSet(store: StoreValue, set: PatchSet) {
  const rows = set.rows;
  if (set.table === 'trips') await store.patchMany('trips', rows as unknown as { id: string; patch: Partial<Trip> }[]);
  else if (set.table === 'places') await store.patchMany('places', rows as unknown as { id: string; patch: Partial<Place> }[]);
  else if (set.table === 'hotels') await store.patchMany('hotels', rows as unknown as { id: string; patch: Partial<Hotel> }[]);
  else if (set.table === 'journeys') await store.patchMany('journeys', rows as unknown as { id: string; patch: Partial<Journey> }[]);
}

export default function CheckPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const [busy, setBusy] = useState<string | null>(null);

  const findings = useMemo(() => checkTrip({ ...bundle }, tripId), [bundle, tripId]);
  const nights = useMemo(() => nightCoverage({ ...bundle }), [bundle]);
  const hard = findings.filter((f) => f.tone !== 'info');

  async function apply(finding: Finding, action: Action) {
    if (!action.run?.length) return;
    setBusy(finding.id);
    try {
      const touched = action.run.reduce((n, set) => n + set.rows.length, 0);
      for (const set of action.run) await writeSet(store, set);
      store.say(`${finding.title.replace(/^\d+ /, '')} – nachgezogen${touched ? ` (${plural(touched, 'Zeile', 'Zeilen')})` : ''}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Reise prüfen"
        icon="🧯"
        hint="Zeiträume, Betten und Tage gegen sich selbst gehalten – gefunden wird nur, was in den Daten steht."
        right={
          <Link className="btn-ghost" href={`/t/${tripId}/reise`}>
            ← zurück zur Reise
          </Link>
        }
      />

      {findings.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-[15px] font-medium text-emerald-200">✓ nichts gefunden</p>
          <p className="mx-auto mt-1 max-w-md text-[12.5px] leading-relaxed text-slate-400">
            {nights.length ? `${plural(nights.length, 'Nacht', 'Nächten')} sind gebucht, ` : ''}
            {plural(bundle.places.length, 'Punkt', 'Punkte')} liegen auf einem Tag, kein Bett ist doppelt und nichts liegt neben dem
            Zeitraum.
          </p>
        </Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 text-[12.5px] text-slate-300">
            <span className="font-medium text-white">
              {hard.length ? `${plural(hard.length, 'Ding', 'Dinge')} aufzuräumen` : 'nichts Dringendes'}
            </span>
            <span className="text-slate-500">·</span>
            <span className="text-rose-200">{findings.filter((f) => f.tone === 'bad').length} Fehler</span>
            <span className="text-amber-200/90">{findings.filter((f) => f.tone === 'warn').length} Achtungen</span>
            <span className="text-slate-400">{findings.filter((f) => f.tone === 'info').length} Hinweise</span>
            <span className="ml-auto text-slate-500">Die Liste erneuert sich nach jedem Knopf von selbst.</span>
          </Card>

          <ul className="space-y-2">
            {findings.map((f) => {
              const tone = TONE[f.tone as keyof typeof TONE];
              return (
                <li key={f.id}>
                  <Card className="p-3.5" style={{ boxShadow: `inset 3px 0 0 ${tone.color}` }} data-finding={f.id}>
                    <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
                      <div className="min-w-[16rem] flex-1">
                        <p className="flex flex-wrap items-center gap-2 text-[13.5px] font-medium leading-snug text-white">
                          <span aria-hidden>{tone.icon}</span>
                          {f.title}
                          <span className="chip text-[10.5px] uppercase tracking-wide text-slate-400">{tone.label}</span>
                        </p>
                        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-400">{f.detail}</p>
                        {f.example ? (
                          <p className="mt-1.5 text-[11.5px] leading-snug text-slate-500">{f.example}</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                        {f.actions.map((a) =>
                          a.href ? (
                            <Link key={a.label} className="btn-ghost !px-2.5 !py-1 !text-[12px]" href={a.href} title={a.hint}>
                              {a.label}
                            </Link>
                          ) : (
                            <Button
                              key={a.label}
                              size="sm"
                              variant={f.tone === 'info' ? 'ghost' : 'primary'}
                              title={a.hint}
                              disabled={busy === f.id}
                              className={cx(busy === f.id && 'opacity-60')}
                              onClick={() => void apply(f, a)}
                            >
                              {a.label}
                            </Button>
                          ),
                        )}
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Card className="p-4">
        <p className="text-[12.5px] leading-relaxed text-slate-400">
          <span className="font-medium text-slate-200">Wem traust du?</span> Ein verrutschter Zeitraum entsteht, wenn eine Seite
          (Reise oder Plan) um Tage umbogen wird, während die andere stehen bleibt. Deshalb gibt es hier zwei Knöpfe: einer zieht den
          Zeitraum zu den Einträgen, der andere die Einträge zum Zeitraum. Beide schreiben nur Daten, die schon da sind – Punkte,
          Betten und Fahrten bleiben in derselben Reihenfolge.
        </p>
      </Card>
    </div>
  );
}
