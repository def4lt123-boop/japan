'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { Button, Card, Empty, Money, ProgressBar, SectionTitle, Stat, cx } from '../../../../components/ui';
import { fmtDate, fmtMoney, plural } from '../../../../lib/format';
import { costsOf } from '../../../../lib/stats';
import { STATUS_META } from '../../../../lib/categories';

interface CostRow {
  id: string;
  date: string | null;
  group: 'Unterkunft' | 'Transport' | 'Orte & Tickets' | 'Ausgaben';
  source: string;
  label: string;
  amount: number;
  status: keyof typeof STATUS_META;
  payer: string | null;
}

export default function CostsPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const { open } = useEditor();
  const [only, setOnly] = useState<string>('');

  const rows = useMemo<CostRow[]>(() => {
    const out: CostRow[] = [];
    for (const h of bundle.hotels)
      if (h.price_total_eur) out.push({ id: h.id, date: h.check_in, group: 'Unterkunft', source: h.name, label: `${h.nights ?? '?'} Nächte in ${h.city}`, amount: h.price_total_eur, status: h.booking_status, payer: null });
    for (const j of bundle.journeys)
      if (j.price_eur) out.push({ id: j.id, date: j.date, group: 'Transport', source: j.mode ?? 'Etappe', label: j.title, amount: j.price_eur, status: j.booking_status, payer: null });
    for (const p of bundle.places)
      if (p.price_eur) out.push({ id: p.id, date: p.date, group: 'Orte & Tickets', source: p.category ?? 'Ort', label: `${p.name}${p.price_note ? ` · ${p.price_note}` : ''}`, amount: p.price_eur, status: p.booking_status, payer: null });
    for (const e of bundle.expenses) out.push({ id: e.id, date: e.date, group: 'Ausgaben', source: e.category, label: e.description ?? 'Ausgabe', amount: e.amount_eur, status: 'erledigt', payer: e.payer });
    return out.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999') || a.group.localeCompare(b.group));
  }, [bundle]);

  const filtered = only ? rows.filter((r) => r.group === only) : rows;
  const costs = bundle.trip ? costsOf({ ...bundle, trip: bundle.trip }) : null;
  const total = costs?.total ?? 0;
  const yen = bundle.trip?.jpy_rate ? total * bundle.trip.jpy_rate : null;
  const tripDays = bundle.trip?.start_date && bundle.trip?.end_date ? Math.max(1, daysInclusive(bundle.trip.start_date, bundle.trip.end_date)) : null;

  const payerTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of bundle.expenses) {
      const key = (e.payer ?? '—').trim() || '—';
      map.set(key, (map.get(key) ?? 0) + (e.amount_eur || 0));
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [bundle.expenses]);

  const byStatus = useMemo(() => {
    const map = new Map<string, { value: number; count: number }>();
    for (const r of rows) {
      const cur = map.get(r.status) ?? { value: 0, count: 0 };
      map.set(r.status, { value: cur.value + r.amount, count: cur.count + 1 });
    }
    return map;
  }, [rows]);

  if (!bundle.trip) return null;
  const budget = bundle.trip.budget_eur;

  return (
    <div className="space-y-4">
      <SectionTitle
        title="Kosten & Budget"
        icon="💶"
        hint="Hotels, Etappen, Ticket-Preise aus den Einträgen und zusätzliche Ausgaben – zusammengezählt."
        right={
          <>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              🖨 Drucken
            </Button>
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'expense' })}>
              ＋ Ausgabe
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <Stat label="Gesamt" value={fmtMoney(total)} hint={plural(rows.length, 'Posten', 'Posten')} />
        <Stat label="pro Person" value={fmtMoney(total / Math.max(1, bundle.trip.travelers))} hint={`${plural(bundle.trip.travelers, 'Person', 'Personen')}`} />
        <Stat label="pro Tag" value={tripDays ? fmtMoney(total / tripDays) : '—'} hint={tripDays ? `${plural(tripDays, 'Reisetag', 'Reisetage')}` : 'Datum fehlt'} />
        <Stat label="in Yen" value={yen !== null ? fmtMoney(yen, 'JPY') : '—'} hint={bundle.trip.jpy_rate ? `Kurs 1 € = ${bundle.trip.jpy_rate} ¥ (⚙ anpassbar)` : 'kein Kurs gesetzt'} />
        <Stat
          label="Budget"
          value={budget ? fmtMoney(budget) : '—'}
          hint={budget ? (total > budget ? `${fmtMoney(total - budget)} über Budget` : `${fmtMoney(budget - total)} frei`) : 'kein Budget'}
          tone={budget && total > budget ? 'bad' : budget ? 'good' : undefined}
        />
      </div>

      {budget ? (
        <Card className="p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[14px] font-semibold text-white">Budgetauslastung</h3>
            <span className={cx('text-[12.5px] tabular-nums', total > budget ? 'text-shu-200' : 'text-slate-400')}>{Math.round((total / budget) * 100)} %</span>
          </div>
          <ProgressBar value={total} max={budget} />
          <div className="mt-2 grid gap-2 sm:grid-cols-4">
            {(costs?.byCategory ?? []).map((c) => (
              <button
                key={c.label}
                onClick={() => setOnly((v) => (v === c.label ? '' : v))}
                className={cx('rounded-lg border px-2.5 py-2 text-left transition', only === c.label ? 'border-shu-400/60 bg-shu-500/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/20')}
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-500">{c.label}</div>
                <div className="mt-0.5 text-[15px] font-semibold tabular-nums text-white">{fmtMoney(c.value)}</div>
                <div className="text-[11px] text-slate-500">{c.value && total ? `${Math.round((c.value / total) * 100)} % · ` : ''}
                  {plural(c.count, 'Posten', 'Posten')}
                </div>
              </button>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="flex flex-wrap items-center gap-2 p-4 text-[13px] text-slate-300">
          <span>💡 Noch kein Budget gesetzt.</span>
          <Button size="sm" variant="ghost" onClick={() => open({ kind: 'trip', id: bundle.trip!.id })}>
            Budget & ¥-Kurs eintragen
          </Button>
        </Card>
      )}

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Card className="p-0">
          <div className="flex flex-wrap items-center gap-1.5 border-b border-white/[0.07] px-3 py-2">
            <h3 className="text-[14px] font-semibold text-white">Alle Posten</h3>
            {['Unterkunft', 'Transport', 'Orte & Tickets', 'Ausgaben'].map((g) => (
              <button
                key={g}
                onClick={() => setOnly((v) => (v === g ? '' : g))}
                className={cx('chip ring-1 transition', only === g ? 'bg-shu-500/20 text-white ring-shu-400/40' : 'bg-white/[0.04] text-slate-300 ring-white/10 hover:bg-white/[0.08]')}
              >
                {g} <span className="tabular-nums text-slate-400">{rows.filter((r) => r.group === g).length}</span>
              </button>
            ))}
            {only ? (
              <button className="btn-quiet !text-[12px]" onClick={() => setOnly('')}>
                ✕ alles
              </button>
            ) : null}
            <span className="ml-auto text-[12px] text-slate-400">
              Summe: <span className="font-semibold tabular-nums text-white">{fmtMoney(filtered.reduce((a, r) => a + r.amount, 0))}</span>
            </span>
          </div>

          {!filtered.length ? (
            <div className="p-4">
              <Empty title="Keine Preise erfasst" hint="Preise gehören in die Einträge, Unterkünfte, Etappen oder Ausgaben." action={<Button variant="primary" onClick={() => open({ kind: 'expense' })}>＋ Erste Ausgabe</Button>} />
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-1.5 font-semibold">Datum</th>
                  <th className="px-3 py-1.5 font-semibold">Posten</th>
                  <th className="px-3 py-1.5 font-semibold">Gruppe</th>
                  <th className="px-3 py-1.5 text-right font-semibold">Betrag</th>
                  <th className="px-3 py-1.5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={`${r.group}-${r.id}`} className="border-t border-white/[0.05] text-[12.5px] hover:bg-white/[0.03]">
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums text-slate-400">{r.date ? fmtDate(r.date, { day: '2-digit', month: '2-digit' }) : '—'}</td>
                    <td className="px-3 py-1.5">
                      <button
                        className="text-left text-slate-100 underline-offset-2 hover:underline"
                        onClick={() => open({ kind: r.group === 'Unterkunft' ? 'hotel' : r.group === 'Transport' ? 'journey' : r.group === 'Ausgaben' ? 'expense' : 'place', id: r.id })}
                      >
                        {r.label}
                      </button>
                      <span className="block text-[11px] text-slate-500">{r.source}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-slate-400">{r.group}</td>
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums font-medium text-slate-100">{fmtMoney(r.amount)}</td>
                    <td className="whitespace-nowrap px-3 py-1.5">
                      <span className={cx('chip ring-1', STATUS_META[r.status].color)}>{STATUS_META[r.status].label}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-3">
          <Card className="p-3">
            <h3 className="mb-2 text-[13px] font-semibold text-white">Nach Buchungsstatus</h3>
            <ul className="space-y-1.5 text-[12.5px]">
              {Object.entries(STATUS_META).map(([key, meta]) => {
                const v = byStatus.get(key) ?? { value: 0, count: 0 };
                return (
                  <li key={key} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: meta.dot }} />
                    <span className="flex-1 text-slate-300">{meta.label}</span>
                    <span className="tabular-nums text-slate-500">{v.count}×</span>
                    <Money value={v.value} className="w-20 text-right" />
                  </li>
                );
              })}
            </ul>
          </Card>

          <Card className="p-3">
            <h3 className="mb-1 text-[13px] font-semibold text-white">Wer hat vorgestreckt?</h3>
            {!payerTotals.length ? (
              <p className="text-[12.5px] text-slate-500">Noch keine Ausgaben mit Zahler. Trage bei Ausgaben „Wer war in Vorleistung?“ ein – dann rechne ich den Ausgleich aus.</p>
            ) : (
              <ul className="space-y-1 text-[12.5px]">
                {payerTotals.map(([who, value]) => (
                  <li key={who} className="flex items-center gap-2">
                    <span className="flex-1 text-slate-300">{who}</span>
                    <Money value={value} className="tabular-nums" />
                  </li>
                ))}
                <li className="mt-2 border-t border-white/10 pt-2 text-[12px] text-slate-400">
                  {(() => {
                    const fair = payerTotals.reduce((a, [, v]) => a + v, 0) / payerTotals.length;
                    const lines = payerTotals
                      .map(([who, v]) => ({ who, diff: v - fair }))
                      .filter((l) => Math.abs(l.diff) > 0.5)
                      .sort((a, b) => b.diff - a.diff);
                    const outgoers = lines.filter((l) => l.diff > 0);
                    const incomers = lines.filter((l) => l.diff < 0);
                    const notes: string[] = [];
                    for (const o of outgoers) {
                      let left = o.diff;
                      for (const i of incomers) {
                        if (left <= 0.5 || i.diff >= -0.5) continue;
                        const pay = Math.min(left, -i.diff);
                        notes.push(`${i.who} → ${o.who}: ${fmtMoney(pay)}`);
                        left -= pay;
                        i.diff += pay;
                      }
                    }
                    return notes.length ? (
                      <>
                        <b className="text-slate-200">Ausgleich:</b>
                        <ul className="mt-1 space-y-0.5">
                          {notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      'Ist ausgeglichen 👍'
                    );
                  })()}
                </li>
              </ul>
            )}
          </Card>

          <Card className="p-3">
            <h3 className="mb-1 text-[13px] font-semibold text-white">Preise ohne Angabe</h3>
            <p className="text-[12.5px] leading-relaxed text-slate-400">
              {bundle.places.filter((p) => !p.price_eur).length} von {bundle.places.length} Orten haben noch keinen Preis. {bundle.hotels.filter((h) => !h.price_total_eur).length} Unterkünfte ohne Preis.{' '}
              {bundle.journeys.filter((j) => !j.price_eur).length} Etappen ohne Preis.
            </p>
            <Button size="sm" variant="ghost" className="mt-2" onClick={() => open({ kind: 'place' })}>
              ＋ Preis nachtragen
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}

function daysInclusive(a: string, b: string) {
  return Math.round((new Date(`${b}T00:00:00`).getTime() - new Date(`${a}T00:00:00`).getTime()) / 86400000) + 1;
}
