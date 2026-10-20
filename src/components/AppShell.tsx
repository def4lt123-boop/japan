'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useStore } from '../lib/store';
import { hasSupabase } from '../lib/supabase';
import { cx } from './ui';

/**
 * Kopfzeile für die ganze App: Marke, Reise-Umschalter, Datenmodus.
 * Die Tab-Navigation lebt im Layout der Reise (src/app/t/[tripId]/layout.tsx).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const pathname = usePathname();
  const tripMatch = pathname?.match(/^\/t\/([^/]+)/);
  const activeTripId = tripMatch?.[1];

  return (
    <div className="app-shell mx-auto flex min-h-screen max-w-[1500px] flex-col px-3 pb-16 pt-3 sm:px-5">
      <header className="no-print mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-shu-500/15 text-[18px] ring-1 ring-inset ring-shu-400/40 transition group-hover:bg-shu-500/25" aria-hidden>
            🗾
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-semibold tracking-tight text-white">Urlaubsplaner</span>
            <span className="block text-[11px] text-slate-400">Tabelle → Web · Japan &amp; mehr</span>
          </span>
        </Link>

        <div className="flex items-center gap-1.5">
          <label className="sr-only" htmlFor="trip-switch">
            Reise wählen
          </label>
          <select
            id="trip-switch"
            className="input !w-auto !py-1.5 pr-7 text-[13px] font-medium"
            value={activeTripId ?? ''}
            onChange={(e) => {
              if (e.target.value) window.location.href = `/t/${e.target.value}`;
              else window.location.href = '/';
            }}
          >
            <option value="">— Reise wählen —</option>
            {store.trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.archived ? ' (Archiv)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <span
            title={hasSupabase ? 'Alle Änderungen werden für dich gesichert' : 'Änderungen sind nur in diesem Browser sichtbar'}
            className={cx(
              'chip',
              hasSupabase ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/30' : 'bg-amber-500/10 text-amber-200 ring-amber-400/30',
            )}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', hasSupabase ? 'bg-emerald-400' : 'bg-amber-400')} />
            {hasSupabase ? 'Datenbank verbunden' : 'Nur in diesem Browser'}
          </span>
          {store.ready ? (
            <span className="text-[11.5px] tabular-nums text-slate-500">
              {store.trips.length} Reisen · {store.places.length} Orte · {store.hotels.length} Unterkünfte
            </span>
          ) : (
            <span className="text-[11.5px] text-slate-500">lade Daten …</span>
          )}
        </div>
      </header>

      {!hasSupabase ? (
        <div className="no-print mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.07] px-3 py-2 text-[12.5px] text-amber-100/90">
          <span>💾</span>
          <span className="flex-1">
            <b>Nur in diesem Browser:</b> nichts geteilt, nichts gesichert – Änderungen siehst nur du auf diesem Gerät.
          </span>
          <button className="btn-ghost !py-1 !text-[12px]" onClick={() => void store.refresh()}>
            Neu laden
          </button>
          <button className="btn-ghost !py-1 !text-[12px]" onClick={() => void store.resetLocalData()}>
            Auf Tabellen-Stand zurücksetzen
          </button>
        </div>
      ) : null}

      <main className="flex-1">{children}</main>

      <Toast />
    </div>
  );
}

function Toast() {
  const { note } = useStore();
  if (!note) return null;
  return (
    <div className="no-print pointer-events-none fixed inset-x-0 bottom-4 z-[1100] flex justify-center px-3">
      <div className="pop-in max-w-2xl rounded-xl border border-white/15 bg-ink-800/95 px-3.5 py-2 text-center text-[12.5px] font-medium text-slate-100 shadow-[0_18px_50px_-20px_rgba(0,0,0,0.9)]">
        {note}
      </div>
    </div>
  );
}
