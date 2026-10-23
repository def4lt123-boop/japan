/**
 * „Reise prüfen“ – ein Rundgang über die Daten, der die Fehler findet, die beim Planen
 * (und durch einen verrutschten Zeitraum) passieren: Nächte ohne Bett, zwei Betten in
 * einer Nacht, Einträge außerhalb des Reisezeitraums, Dopplungen am selben Tag.
 *
 * Gefunden wird nur, was in den Daten steht. Korrigiert wird nichts von selbst – jeder
 * Befund schickt die Zeilen mit, die sein Knopf schreiben würde, die UI entscheidet.
 */
import { addDays, dayStart, fmtDate } from './format';
import { emptyDays, nightCoverage } from './stats';
import type { BundleLike } from './stats';

export type Tone = 'bad' | 'warn' | 'info';
export type PatchTable = 'trips' | 'places' | 'hotels' | 'journeys';

/** eine Zeile, die geschrieben werden soll */
export interface PatchRow {
  id: string;
  patch: Record<string, string | number | null>;
}

/** ein Schreibvorgang pro Tabelle – die UI reicht das an `store.patchMany` weiter */
export interface PatchSet {
  table: PatchTable;
  rows: PatchRow[];
}

export interface Action {
  label: string;
  hint: string;
  /** Zeilen, die geschrieben werden … */
  run?: PatchSet[];
  /** … oder die Seite, die sich stattdessen öffnet */
  href?: string;
}

export interface Finding {
  id: string;
  tone: Tone;
  title: string;
  detail: string;
  /** bis zu vier Beispiele, damit die Liste nicht blind klickt */
  example?: string;
  actions: Action[];
}

/** vorzeichenbehafteter Abstand zweier Daten in Tagen (b − a) */
function dayDiff(a: string, b: string): number {
  const from = dayStart(a);
  const to = dayStart(b);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

const list = (parts: (string | null | undefined)[], sep = ' · ') => parts.filter(Boolean).join(sep);

/** in Befislen reicht Tag.Monat – der volle Datum steht in der Erklärung */
const short = (iso?: string | null) => (iso ? fmtDate(iso, { day: '2-digit', month: '2-digit' }) : '—');

/** alle Einträge mit einem Datum, sortiert – die Klammer um den Plan */
function dated(bundle: BundleLike) {
  const rows = [
    ...bundle.places.map((p) => ({ table: 'places' as PatchTable, id: p.id, date: p.date, name: p.name })),
    ...bundle.journeys.map((j) => ({ table: 'journeys' as PatchTable, id: j.id, date: j.date, name: j.title })),
    ...bundle.hotels.flatMap((h) => [
      { table: 'hotels' as PatchTable, id: h.id, date: h.check_in, name: h.name },
      { table: 'hotels' as PatchTable, id: h.id, date: h.check_out, name: h.name },
    ]),
  ].filter((r): r is typeof r & { date: string } => Boolean(r.date));
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return rows;
}

/** Nächte, die eine Unterkunft beansprucht – ohne Nacht am Abreisetag */
function nightsOf(checkIn: string, checkOut: string): string[] {
  const n = dayDiff(checkIn, checkOut);
  if (n <= 0) return [];
  return Array.from({ length: n }, (_, i) => addDays(checkIn, i));
}

/** leere Schreibsätze filtern – ein Knopf ohne Zeilen ist kein Knopf */
function sets(...items: (PatchSet | null)[]): PatchSet[] {
  return items.filter((s): s is PatchSet => Boolean(s && s.rows.length));
}

export function checkTrip(bundle: BundleLike, tripId: string): Finding[] {
  const out: Finding[] = [];
  const trip = bundle.trip;
  const base = `/t/${tripId}`;
  if (!trip) return out;

  const start = trip.start_date;
  const end = trip.end_date;
  const entries = dated(bundle);
  /** der Plan, wie er gemeint ist – nach einem erkannten Versatz umgezogen */
  let probe: BundleLike = bundle;

  /* ── 1 · der Zeitraum selbst ─────────────────────────────────────────────── */
  if (!start || !end) {
    out.push({
      id: 'kein-zeitraum',
      tone: 'bad',
      title: 'Es steht kein vollständiger Zeitraum an der Reise',
      detail: 'Ohne Anfang und Ende gibt es keine Tagesliste, keine Nächte und keinen Grund, etwas zu verschieben.',
      actions: [{ label: 'Zeitraum eintragen', hint: 'das Formular für Anfang, Ende, Personen', href: `${base}/reise` }],
    });
  } else if (dayDiff(start, end) < 0) {
    out.push({
      id: 'zeitraum-vertauscht',
      tone: 'bad',
      title: 'Anfang und Ende sind vertauscht',
      detail: `Die Reise steht auf ${fmtDate(end)} bis ${fmtDate(start)} – gerechnet wird aber von ${fmtDate(start)} nach ${fmtDate(end)}.`,
      actions: [
        {
          label: 'Vertauschung beheben',
          hint: 'Anfang wird das frühere, Ende das spätere Datum',
          run: [{ table: 'trips', rows: [{ id: trip.id, patch: { start_date: end, end_date: start } }] }],
        },
      ],
    });
  }

  /* ── 2 · der klassische eine-Tag-Versatz ─────────────────────────────────── */
  if (start && end && entries.length) {
    const first = entries[0].date;
    const tail = entries[entries.length - 1].date;
    const headOffset = dayDiff(start, first);
    const tailOffset = dayDiff(end, tail);
    if (headOffset !== 0 && headOffset === tailOffset && Math.abs(headOffset) <= 3) {
      // ab hier rechnet der Rundgang mit dem Plan, so wie er nach dem Nachziehen dasteht –
      // sonst würden Löcher und Ausreißer gemeldet, die es gar nicht gibt
      const drag = (d?: string | null) => (d ? addDays(d, -headOffset) : d ?? null);
      probe = {
        ...bundle,
        places: bundle.places.map((row) => ({ ...row, date: drag(row.date), end_date: drag(row.end_date) })),
        journeys: bundle.journeys.map((row) => ({ ...row, date: drag(row.date), end_date: drag(row.end_date) })),
        hotels: bundle.hotels.map((row) => ({ ...row, check_in: drag(row.check_in), check_out: drag(row.check_out) })),
      };
      const dir = headOffset > 0 ? 'nach' : 'vor';
      const tage = Math.abs(headOffset);
      out.push({
        id: 'versatz',
        tone: 'warn',
        title: `Der ganze Plan liegt ${tage} ${tage === 1 ? 'Tag' : 'Tage'} ${dir} dem Reisezeitraum`,
        detail: `Reise ${fmtDate(start)} – ${fmtDate(end)}, drin liegt aber alles von ${fmtDate(first)} bis ${fmtDate(tail)}. Meist ist dabei eine von beiden Seiten verrutscht – entscheidend ist, welcher Zahl du traust.`,
        example: list(
          Array.from(new Set(entries.map((e) => `${short(e.date)} ${e.name}`))).slice(0, 4),
          ' · ',
        ),
        actions: [
          {
            label: 'Reise nachziehen',
            hint: `Anfang und Ende auf ${fmtDate(first)} – ${fmtDate(tail)} setzen, die Einträge bleiben, wie sie sind`,
            run: [{ table: 'trips', rows: [{ id: trip.id, patch: { start_date: first, end_date: tail } }] }],
          },
          {
            label: 'Einträge nachziehen',
            hint: `alle ${entries.length} Daten ${dir === 'nach' ? 'vor' : 'zurück'} um ${tage} ${tage === 1 ? 'Tag' : 'Tage'} – der Reisezeitraum bleibt`,
            run: sets(
              {
                table: 'places',
                rows: bundle.places
                  .filter((p) => p.date)
                  .map((p) => ({
                    id: p.id,
                    patch: { date: addDays(p.date as string, -headOffset), ...(p.end_date ? { end_date: addDays(p.end_date, -headOffset) } : {}) },
                  })),
              },
              {
                table: 'journeys',
                rows: bundle.journeys
                  .filter((j) => j.date || j.end_date)
                  .map((j) => ({
                    id: j.id,
                    patch: {
                      ...(j.date ? { date: addDays(j.date, -headOffset) } : {}),
                      ...(j.end_date ? { end_date: addDays(j.end_date, -headOffset) } : {}),
                    },
                  })),
              },
              {
                table: 'hotels',
                rows: bundle.hotels
                  .filter((h) => h.check_in || h.check_out)
                  .map((h) => ({
                    id: h.id,
                    patch: {
                      ...(h.check_in ? { check_in: addDays(h.check_in, -headOffset) } : {}),
                      ...(h.check_out ? { check_out: addDays(h.check_out, -headOffset) } : {}),
                    },
                  })),
              },
            ),
          },
        ],
      });
    }
  }

  /* ── 3 · Ausreißer außerhalb des Zeitraums ───────────────────────────────── */
  if (start && end) {
    const after = entries.filter((e) => e.date > end);
    const before = entries.filter((e) => e.date < start);
    for (const [side, rows] of [
      ['nach', after],
      ['vor', before],
    ] as const) {
      if (!rows.length) continue;
      // Ausreißer, die schon unter den Versatz-Befund fallen, nicht doppelt melden
      if (out.some((f) => f.id === 'versatz')) continue;
      const far = rows.map((r) => r.date).sort();
      const limit = side === 'nach' ? end : start;
      const steps = Math.abs(dayDiff(limit, side === 'nach' ? far[far.length - 1] : far[0]));
      out.push({
        id: `außerhalb-${side}`,
        tone: steps <= 7 ? 'warn' : 'info',
        title: `${rows.length} ${rows.length === 1 ? 'Eintrag liegt' : 'Einträge liegen'} ${side} dem Reisezeitraum`,
        detail:
          side === 'nach'
            ? `Nach ${fmtDate(end)} ist noch was geplant – auf der Tagesliste taucht das erst auf, wenn die Reise länger ist (oder die Tage lichter werden).`
            : `Vor ${fmtDate(start)} liegt schon was – entweder fängt die Reise früher an, oder der Tag gehört nicht hierher.`,
        example: rows
          .slice(0, 4)
          .map((r) => `${short(r.date)} ${r.name}`)
          .join(' · '),
        actions:
          steps <= 30
            ? [
                {
                  label: side === 'nach' ? 'Reise verlängern' : 'Reise vorziehen',
                  hint: `Zeitraum bis ${fmtDate(side === 'nach' ? far[far.length - 1] : far[0])}`,
                  run: [
                    {
                      table: 'trips',
                      rows: [
                        {
                          id: trip.id,
                          patch: side === 'nach' ? { end_date: far[far.length - 1] } : { start_date: far[0] },
                        },
                      ],
                    },
                  ],
                },
              ]
            : [{ label: 'Tage ansehen', hint: 'auf 🗓️ Tage liegt jeder Punkt einzeln', href: `${base}/tage` }],
      });
    }
  }

  /* ── 4 · Nächte: Lücken und Doppelbuchungen ─────────────────────────────── */
  const coverage = nightCoverage(probe);
  if (coverage.length) {
    const gaps = coverage.filter((c) => !c.covered);
    if (gaps.length) {
      const runs: string[] = [];
      let from = gaps[0].date;
      let prev = gaps[0].date;
      for (const g of gaps.slice(1)) {
        if (dayDiff(prev, g.date) === 1) prev = g.date;
        else {
          runs.push(from === prev ? short(from) : `${short(from)} – ${short(prev)}`);
          from = g.date;
          prev = g.date;
        }
      }
      runs.push(from === prev ? short(from) : `${short(from)} – ${short(prev)}`);
      out.push({
        id: 'nächte-fehlen',
        tone: 'bad',
        title: `${gaps.length} ${gaps.length === 1 ? 'Nacht' : 'Nächte'} ohne Bett`,
        detail: `In diesen Nächten ist nichts eingetragen: ${list(runs.slice(0, 4), ', ')}${runs.length > 4 ? ` … und ${runs.length - 4} weitere` : ''}.`,
        actions: [{ label: 'Betten ansehen', hint: 'Nacht antippen und eintragen', href: `${base}/unterkuenfte` }],
      });
    }

    const doubles: string[] = [];
    for (const night of coverage) {
      const hits = probe.hotels.filter((h) => h.check_in && h.check_out && night.date >= h.check_in && night.date < h.check_out);
      if (hits.length > 1) doubles.push(`${short(night.date)} ${hits.map((h) => h.name || h.city).join(' + ')}`);
    }
    if (doubles.length) {
      out.push({
        id: 'doppeltes-bett',
        tone: 'warn',
        title: `${doubles.length} ${doubles.length === 1 ? 'Nacht mit' : 'Nächte mit'} zwei Betten`,
        detail:
          'Zwei Unterkünfte beanspruchen dieselbe Nacht. Muss nichts sein – eine Basis plus eine Nacht außer Haus ist üblich – aber der Preis zählt doppelt.',
        example: doubles.slice(0, 3).join(' · '),
        actions: [{ label: 'Betten ansehen', hint: 'eine der beiden Unterkünfte kürzen', href: `${base}/unterkuenfte` }],
      });
    }

  } else if (probe.hotels.length && start && end) {
    out.push({
      id: 'keine-nächte',
      tone: 'warn',
      title: 'Keine einzige Nacht ist gebucht',
      detail: 'Unterkünfte sind da, aber keine hat ein Anfangs- und Enddatum – ohne die beiden ist keine Nacht gezählt.',
      actions: [{ label: 'Nächte eintragen', hint: 'Check-in und Check-out je Unterkunft', href: `${base}/unterkuenfte` }],
    });
  }

  /* ── 5 · Unterkünfte, die sich nicht ausgehen ────────────────────────────── */
  const noNight = probe.hotels.filter((h) => !h.check_in || !h.check_out || dayDiff(h.check_in, h.check_out) <= 0);
  if (noNight.length) {
    out.push({
      id: 'betten-ohne-nacht',
      tone: 'warn',
      title: `${noNight.length} ${noNight.length === 1 ? 'Unterkunft hat' : 'Unterkünfte haben'} keine Nacht`,
      detail: 'Check-out liegt auf dem Check-in oder fehlt – solche Betten erscheinen im Nächte-Check nirgends.',
      example: list(
        noNight.slice(0, 3).map((h) => h.name || h.city),
        ', ',
      ),
      actions: [{ label: 'Nachsehen', hint: 'Spanne pro Unterkunft korrigieren', href: `${base}/unterkuenfte` }],
    });
  }

  /* ── 6 · Punkte am selben Tag doppelt ────────────────────────────────────── */
  const seen = new Map<string, { name: string; date: string; ids: string[] }>();
  for (const p of probe.places) {
    if (!p.date) continue;
    const key = `${p.date}|${p.name.trim().toLowerCase().replace(/\s+/g, ' ')}`;
    const hit = seen.get(key);
    if (hit) hit.ids.push(p.id);
    else seen.set(key, { name: p.name, date: p.date, ids: [p.id] });
  }
  const dupes = Array.from(seen.values()).filter((d) => d.ids.length > 1);
  if (dupes.length) {
    out.push({
      id: 'doppelt-am-tag',
      tone: 'info',
      title: `${dupes.length} ${dupes.length === 1 ? 'Punkt steht' : 'Punkte stehen'} zweimal am selben Tag`,
      detail: 'Manchmal Absicht (zweimal derselbe Markt an einem Tag), manchmal ein Rest vom Ausprobieren.',
      example: dupes
        .slice(0, 3)
        .map((d) => `${short(d.date)} ${d.name} ×${d.ids.length}`)
        .join(' · '),
      actions: [{ label: 'Tage ansehen', hint: 'Zeilen dort löschen, die zu viel sind', href: `${base}/tage` }],
    });
  }

  /* ── 7 · Was noch offen liegt ────────────────────────────────────────────── */
  const pool = probe.places.filter((p) => !p.date).length;
  if (pool) {
    out.push({
      id: 'pool',
      tone: 'info',
      title: `${pool} ${pool === 1 ? 'Punkt wartet' : 'Punkte warten'} noch auf einen Tag`,
      detail: 'Die Liste ist gewollt – sie ist die Auswahl, aus der du pro Tag nimmst.',
      actions: [{ label: 'Aktivitäten ansehen', hint: 'Tag im Dropdown wählen und ✓ hinlegen', href: `${base}/aktivitaeten` }],
    });
  }

  const noLocus = probe.places.filter((p) => p.lat === null || p.lng === null).length;
  if (noLocus) {
    out.push({
      id: 'ohne-punkt',
      tone: 'info',
      title: `${noLocus} ${noLocus === 1 ? 'Punkt hat' : 'Punkte haben'} noch keinen Ort`,
      detail: 'Ohne Ort funktioniert die Route des Tages und die Karten-Nähe nicht – die Suche setzt ihn in einem Schritt.',
      actions: [{ label: 'Karte öffnen', hint: 'Punkte suchen und nachziehen', href: `${base}/karte` }],
    });
  }

  const noDateJourneys = probe.journeys.filter((j) => !j.date).length;
  if (noDateJourneys) {
    out.push({
      id: 'fahrten-ohne-datum',
      tone: 'info',
      title: `${noDateJourneys} ${noDateJourneys === 1 ? 'Fahrt hat' : 'Fahrten haben'} kein Datum`,
      detail: 'Fahrten tauchen nur an ihrem Tag auf – ohne Datum bleiben sie im Log und fehlen auf der Tagesseite.',
      actions: [{ label: 'Fahrten ansehen', hint: 'Datum je Fahrt eintragen', href: `${base}/reise` }],
    });
  }

  const empty = start && end ? emptyDays(probe) : [];
  if (empty.length) {
    out.push({
      id: 'leere-tage',
      tone: 'info',
      title: `${empty.length} ${empty.length === 1 ? 'Reisetag ist' : 'Reisetage sind'} ganz ohne Punkt`,
      detail: `Zum Beispiel ${list(empty.slice(0, 4).map((d) => short(d)), ', ')}${empty.length > 4 ? ' …' : ''} – Ruhetage sind erlaubt, ein Loch ist es auch.`,
      actions: [{ label: 'Tage ansehen', hint: 'punkten, was an den Tag soll', href: `${base}/tage` }],
    });
  }

  const rank: Record<Tone, number> = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.tone] - rank[b.tone]);
}

/** Zählung für Knopf-Beschriftungen – „2 Dinge", ohne die Hinweise mitzuzählen */
export function findingCount(findings: Finding[]): { bad: number; warn: number; info: number } {
  return {
    bad: findings.filter((f) => f.tone === 'bad').length,
    warn: findings.filter((f) => f.tone === 'warn').length,
    info: findings.filter((f) => f.tone === 'info').length,
  };
}
