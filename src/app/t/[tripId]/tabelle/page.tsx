'use client';

import React, { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore, useTrip } from '../../../../lib/store';
import { useEditor } from '../../../../components/EditorProvider';
import { FilterBar, EMPTY_FILTER, applyFilter, type PlaceFilter } from '../../../../components/filters';
import { Button, Card, Empty, Pill, Select, SectionTitle, TextInput, cx } from '../../../../components/ui';
import { STATUS_META, TICKET_META, TICKET_ORDER, categoryMeta, mapsUrl, priorityLabel } from '../../../../lib/categories';
import { CategoryPicker } from '../../../../components/CategoryPicker';
import { BOOKING_STATUSES, PRIORITIES, TICKET_STATUSES, type Place } from '../../../../lib/types';
import { fmtDate, fmtMoney } from '../../../../lib/format';
import { dayPlaces, moveToIndex } from '../../../../lib/dayplan';
import { download, placeCsv } from '../../../../lib/export';

type SortKey = 'date' | 'reihe' | 'city' | 'name' | 'category' | 'price' | 'status' | 'prio' | 'ticket';

const COLS: { key: SortKey | null; label: string; hint?: string; className?: string }[] = [
  { key: 'date', label: 'Tag', hint: 'Wann – leer = noch an keinem Tag' },
  { key: 'reihe', label: 'Reihe', hint: 'Stelle an diesem Tag – Zahl eintippen und mit Enter übernehmen' },
  { key: 'city', label: 'Stadt' },
  { key: 'name', label: 'Aktivität' },
  { key: 'category', label: 'Kategorie' },
  { key: null, label: 'Hinweise' },
  { key: 'price', label: 'Preis' },
  { key: 'status', label: 'Status' },
  { key: 'ticket', label: 'Ticket', hint: 'brauche ich dort ein Ticket – und ist es schon gekauft?' },
  { key: 'prio', label: 'Prio' },
  { key: null, label: 'Karte' },
  { key: null, label: '' },
];

export default function TablePage() {
  const params = useParams<{ tripId: string }>();
  const tripId = String(params?.tripId ?? '');
  const store = useStore();
  const bundle = useTrip(tripId);
  const usedCategories = bundle.places.map((x) => x.category);
  const { open } = useEditor();
  const [filter, setFilter] = useState<PlaceFilter>(EMPTY_FILTER);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'date', dir: 1 });
  const [wideNotes, setWideNotes] = useState(false);

  const rows = useMemo(() => {
    const list = applyFilter(bundle.places, filter);
    const val = (p: Place): string | number => {
      switch (sort.key) {
        case 'date':
          return p.date ?? '9999-99-99';
        case 'name':
          return p.name.toLowerCase();
        case 'city':
          return `${p.city ?? ''}`.toLowerCase();
        case 'category':
          return (p.category ?? '').toLowerCase();
        case 'reihe':
          return reihe.get(p.id) ?? 999;
        case 'price':
          return p.price_eur ?? 0;
        case 'status':
          return p.booking_status;
        case 'ticket':
          return p.ticket_status ?? 'unklar';
        case 'prio':
          return 3 - PRIORITIES.indexOf(p.priority);
      }
    };
    return list.sort((a, b) => {
      const av = val(a);
      const bv = val(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'de');
      return cmp !== 0 ? cmp * sort.dir : a.name.localeCompare(b.name, 'de');
    });
  }, [bundle.places, filter, sort]);

  const totalCost = rows.reduce((a, p) => a + (p.price_eur ?? 0), 0);
  /** welche Stelle ein Punkt an seinem Tag hat */
  const reihe = useMemo(() => {
    const map = new Map<string, number>();
    const dates = new Set(bundle.places.map((p) => p.date).filter(Boolean) as string[]);
    for (const d of dates) dayPlaces(bundle.places, d).forEach((p, i) => map.set(p.id, i + 1));
    return map;
  }, [bundle.places]);

  if (!bundle.trip) return null;

  return (
    <div className="space-y-3">
      <SectionTitle
        title="Tabelle"
        icon="📊"
        hint="Alle Punkte in einer Zeile – Tag, Kategorie, Status, Ticket und Prio direkt änderbar."
        right={
          <>
            <Button size="sm" variant="ghost" onClick={() => setWideNotes((v) => !v)}>
              {wideNotes ? 'Hinweise kürzen' : 'Hinweise ausklappen'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => window.print()}>
              🖨 Drucken
            </Button>
            <Button size="sm" variant="ghost" onClick={() => download(`${tripId}-orte.csv`, placeCsv(rows, bundle.hotels))}>
              ⇩ CSV
            </Button>
            <Button size="sm" variant="primary" onClick={() => open({ kind: 'place' })}>
              ＋ Aktivität
            </Button>
          </>
        }
      />

      <FilterBar
        value={filter}
        onChange={setFilter}
        places={bundle.places}
        detailed
        right={
          <span className="chip bg-white/[0.05] text-slate-300 ring-white/10">{fmtMoney(totalCost)}</span>
        }
      />

      {!rows.length ? (
        <Empty title="Keine Zeilen" hint="Filter anpassen oder neue Aktivität anlegen." action={<Button variant="primary" onClick={() => open({ kind: 'place' })}>＋ Aktivität</Button>} />
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[1020px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-ink-800/95 backdrop-blur">
              <tr>
                {COLS.map((c) => (
                  <th key={c.label} title={c.hint} className="border-b border-white/10 px-2 py-2 text-[13px] font-semibold uppercase tracking-wide text-slate-400">
                    {c.key ? (
                      <button
                        className={cx('inline-flex items-center gap-1 hover:text-white', sort.key === c.key && 'text-shu-200')}
                        onClick={() => setSort((s) => ({ key: c.key as SortKey, dir: s.key === c.key ? ((s.dir * -1) as 1 | -1) : 1 }))}
                      >
                        {c.label}
                        {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : <span className="text-slate-400">↕</span>}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((p, i) => {
                const meta = categoryMeta(p.category);
                return (
                  <tr key={p.id} className={cx('group border-b border-white/[0.05] align-top transition hover:bg-white/[0.04]', i % 2 ? 'bg-white/[0.015]' : '', p.booking_status === 'erledigt' && 'opacity-70')}>
                    <td className="cell whitespace-nowrap">
                      <input
                        type="date"
                        value={p.date ?? ''}
                        onChange={(e) => store.patch('places', p.id, { date: e.target.value || null })}
                        className="w-[128px] rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] text-slate-200 outline-none hover:border-white/15 focus:border-shu-400/70 focus:bg-black/30"
                        title={p.date ? fmtDate(p.date, { weekday: 'long' }) : 'noch kein Tag – steht in der Liste unter Aktivitäten'}
                      />
                    </td>
                    <td className="cell whitespace-nowrap text-center">
                      {p.date ? (
                        <input
                          key={`${p.id}-${reihe.get(p.id) ?? 0}`}
                          data-order={p.id}
                          type="number"
                          min={1}
                          max={99}
                          defaultValue={reihe.get(p.id) ?? 1}
                          onBlur={(e) => {
                            const want = Number.parseInt(e.target.value, 10);
                            const now = reihe.get(p.id) ?? 0;
                            if (!Number.isFinite(want) || want < 1 || want === now) return;
                            moveToIndex(store, bundle.places, p.id, p.date as string, want - 1);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          }}
                          className="w-[46px] rounded border border-transparent bg-transparent px-1 py-0.5 text-center text-[13px] tabular-nums text-slate-300 outline-none hover:border-white/15 focus:border-shu-400/70 focus:bg-black/30"
                          title="Stelle an diesem Tag – 3 und Enter setzt den Punkt an dritte Stelle"
                          aria-label={`Stelle für ${p.name}`}
                        />
                      ) : (
                        <span className="text-[13px] tabular-nums text-slate-400">—</span>
                      )}
                    </td>
                    <td className="cell whitespace-nowrap">
                      <span className="block text-[13px] font-medium text-slate-200">{p.city}</span>
                    </td>
                    <td className="cell min-w-[190px]">
                      <button onClick={() => open({ kind: 'place', id: p.id })} className="text-left text-[13px] font-medium text-white underline-offset-2 hover:underline">
                        {p.name}
                      </button>
                    </td>
                    <td className="cell whitespace-nowrap">
                      <div className="flex items-center gap-1" style={{ color: meta.color }}>
                        <span aria-hidden title={meta.label}>{meta.icon}</span>
                        <CategoryPicker
                          size="sm"
                          className="!border-transparent !bg-transparent !px-1 !py-0.5"
                          value={p.category}
                          used={usedCategories}
                          onChange={(v) => store.patch('places', p.id, { category: v })}
                        />
                      </div>
                    </td>
                    <td className={cx('cell text-slate-300/90', wideNotes ? 'min-w-[320px] whitespace-pre-wrap' : 'max-w-[280px] truncate')} title={p.notes ?? undefined}>
                      {p.notes ?? ''}
                    </td>
                    <td className="cell whitespace-nowrap">
                      <span className="block tabular-nums text-slate-200">{p.price_eur ? fmtMoney(p.price_eur) : '—'}</span>
                      <span className="block text-[13px] text-slate-400">{p.price_note ?? ''}</span>
                    </td>
                    <td className="cell whitespace-nowrap">
                      <Select
                        className="!w-auto !border-transparent !bg-transparent !px-1 !py-0.5 !text-[13px]"
                        options={BOOKING_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label }))}
                        value={p.booking_status}
                        onChange={(e) => store.patch('places', p.id, { booking_status: e.target.value as Place['booking_status'] })}
                      />
                    </td>
                    <td className="cell whitespace-nowrap">
                      <Select
                        className="!w-auto !border-transparent !bg-transparent !px-1 !py-0.5 !text-[13px]"
                        options={TICKET_STATUSES.map((v) => ({ value: v, label: TICKET_META[v].short }))}
                        value={p.ticket_status ?? 'unklar'}
                        onChange={(e) => store.patch('places', p.id, { ticket_status: e.target.value as Place['ticket_status'] })}
                        title={TICKET_META[(p.ticket_status ?? 'unklar') as keyof typeof TICKET_META]?.label}
                      />
                    </td>
                    <td className="cell whitespace-nowrap">
                      <Select
                        className="!w-auto !border-transparent !bg-transparent !px-1 !py-0.5 !text-[13px]"
                        options={PRIORITIES.map((v) => ({ value: v, label: priorityLabel(v) }))}
                        value={p.priority}
                        onChange={(e) => store.patch('places', p.id, { priority: e.target.value as Place['priority'] })}
                      />
                    </td>
                    <td className="cell whitespace-nowrap">
                      <a href={mapsUrl(p)} target="_blank" rel="noreferrer" className="text-[13px] text-sky-200/90 underline-offset-2 hover:underline" title="Bei Google Maps öffnen">
                        📍 öffnen
                      </a>
                    </td>
                    <td className="cell whitespace-nowrap text-right">
                      <div className="flex justify-end gap-0.5 opacity-60 transition group-hover:opacity-100 [@media(hover:none)]:opacity-100">
                        <button className="btn-quiet !px-1" title="Duplizieren" onClick={() => open({ kind: 'place', defaults: { ...p, id: undefined, name: `${p.name} (Kopie)` } })}>
                          ⧉
                        </button>
                        <button className="btn-quiet !px-1" title="Bearbeiten" onClick={() => open({ kind: 'place', id: p.id })}>
                          ✎
                        </button>
                        <button
                          className="btn-quiet !px-1 text-red-300/80 hover:!text-red-200"
                          title="Löschen"
                          onClick={() => window.confirm(`„${p.name}“ wirklich löschen?`) && store.remove('places', p.id)}
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/10 bg-white/[0.03] text-[13px] text-slate-300">
                <td className="px-2 py-1.5" colSpan={6}>
                  {rows.length} Punkte · {rows.filter((p) => p.date).length} an einem Tag
                </td>
                <td className="px-2 py-1.5 tabular-nums font-semibold">{fmtMoney(totalCost)}</td>
                <td className="px-2 py-1.5" colSpan={5} />
              </tr>
            </tfoot>
          </table>
        </Card>
      )}

      <p className="no-print text-[13px] text-slate-400">
        Tipp: Mit „⇩ CSV“ bekommst du den ganzen Plan als Datei (Semikolon-getrennt, de-DE) – fürs Backup, die Weitergabe oder den Import in jedes Tabellenprogramm.
      </p>
    </div>
  );
}
