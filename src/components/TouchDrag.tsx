'use client';

/**
 * Ziehen mit dem Daumen.
 *
 * 🗓️ Tage und 📊 Übersicht hängen am HTML5-Drag & Drop – auf dem Touchscreen gibt es das
 * nicht, dort ließ sich ein Punkt nur über Dropdown und ✓ hinlegen unterbringen. Dieser
 * Provider legt eine Pointer-Schicht darüber: Greifpunkt anfassen (oder kurz halten), der
 * Punkt folgt dem Finger, loslassen auf einem Tag legt ihn ans Ende, loslassen auf einer
 * Zeile fügt dort ein. Nah am Rand scrollt die Seite von selbst, ein Tag, der das Bett
 * dieser Nacht hat, leuchtet beim Überfahren genauso wie der Mauszeiger das tut.
 *
 * zones:   [data-dropzone="<ISOdatum>"]  bzw. [data-dropzone="pool"] für „vom Tag lösen“
 * rows:    [data-dropindex="<n>"]        innerhalb einer Zone
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { cx } from './ui';

export interface DropZone {
  /** null = zurück in die Liste „noch ohne Tag“ */
  date: string | null;
  /** Stelle in der Tagesliste, auf deren Zeile der Finger liegt – null = ans Ende */
  index: number | null;
}

export type DragProps = { 'data-drag'?: string; onPointerDown?: (e: React.PointerEvent) => void };

interface DragApi {
  /** sofort griffbereit: für den Greifpunkt (⠿) */
  grab: (id: string, label: string) => DragProps;
  /** langer Druck: für Flächen, auf denen man sonst normal scrollen will */
  hold: (id: string, label: string) => DragProps;
  dragging: boolean;
}

const Ctx = createContext<DragApi | null>(null);

/** `null`, wenn die Seite (Desktop) ohne Touch-Schicht auskommt */
export function useDrag(): DragApi | null {
  return useContext(Ctx);
}

const HOLD_MS = 240;
const SLOP = 12;
const EDGE = 64;
const SCROLL_STEP = 14;

const buzz = (ms: number) => {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(ms);
  } catch {
    /* kein Vibrationsmotor – egal */
  }
};

export function TouchDragProvider({ onDrop, children }: { onDrop: (id: string, zone: DropZone) => void; children: React.ReactNode }) {
  const [ghost, setGhost] = useState<{ label: string; x: number; y: number } | null>(null);
  const api = useRef<{ arm: (id: string, label: string, e: PointerEvent, mode: 'grab' | 'hold') => void } | null>(null);
  const drop = useRef(onDrop);
  useEffect(() => {
    drop.current = onDrop;
  }, [onDrop]);

  useEffect(() => {
    let armed: { id: string; label: string; x0: number; y0: number; el: HTMLElement; timer: number } | null = null;
    let ses: { id: string; label: string; x: number; y: number; el: HTMLElement; over: DropZone | null; marked: HTMLElement[]; raf: number } | null = null;

    const paint = (els: HTMLElement[], zone: DropZone | null) => {
      for (const el of els) el.removeAttribute('data-drag-over');
      els.length = 0;
      if (!zone) return;
      const card = zone.date === null ? document.querySelector<HTMLElement>('[data-dropzone="pool"]') : document.querySelector<HTMLElement>(`[data-dropzone="${zone.date}"]`);
      if (card) {
        card.setAttribute('data-drag-over', 'true');
        els.push(card);
      }
    };

    const hit = (x: number, y: number): DropZone | null => {
      const zones = Array.from(document.querySelectorAll<HTMLElement>('[data-dropzone]'));
      let best: { zone: DropZone; el: HTMLElement; area: number } | null = null;
      let row: HTMLElement | null = null;
      for (const el of zones) {
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (x < r.left || x > r.right || y < r.top || y > r.bottom) continue;
        const area = r.width * r.height;
        if (best && area >= best.area) continue;
        const raw = el.getAttribute('data-dropzone') ?? '';
        let index: number | null = null;
        let found: HTMLElement | null = null;
        for (const candidate of Array.from(el.querySelectorAll<HTMLElement>('[data-dropindex]'))) {
          const rr = candidate.getBoundingClientRect();
          if (!rr.width || !rr.height) continue;
          if (y >= rr.top && y <= rr.bottom) {
            index = Number(candidate.getAttribute('data-dropindex'));
            found = candidate;
            break;
          }
        }
        best = { zone: { date: raw === 'pool' ? null : raw, index }, el, area };
        row = found;
      }
      if (!best || !ses) return null;
      paint(ses.marked, best.zone);
      if (row) {
        row.setAttribute('data-drag-over', 'true');
        ses.marked.push(row);
      }
      return best.zone;
    };

    const step = () => {
      if (!ses) return;
      const h = window.innerHeight || 800;
      if (ses.y < EDGE) window.scrollBy(0, -SCROLL_STEP);
      else if (ses.y > h - EDGE) window.scrollBy(0, SCROLL_STEP);
      ses.raf = requestAnimationFrame(step);
    };

    const begin = (id: string, label: string, x: number, y: number, el: HTMLElement) => {
      ses = { id, label, x, y, el, over: null, marked: [], raf: 0 };
      el.dataset.dragging = 'true';
      document.body.classList.add('is-dragging');
      setGhost({ label, x, y });
      buzz(14);
      ses.raf = requestAnimationFrame(step);
    };

    const finish = (commit: boolean) => {
      if (ses) {
        cancelAnimationFrame(ses.raf);
        paint(ses.marked, null);
        delete ses.el.dataset.dragging;
        if (commit && ses.over) drop.current(ses.id, ses.over);
      }
      ses = null;
      document.body.classList.remove('is-dragging');
      setGhost(null);
      if (commit) buzz(8);
    };

    const disarm = () => {
      if (armed) {
        clearTimeout(armed.timer);
        armed = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      if (ses) {
        ses.x = e.clientX;
        ses.y = e.clientY;
        ses.over = hit(e.clientX, e.clientY);
        setGhost({ label: ses.label, x: e.clientX, y: e.clientY });
        if (e.cancelable) e.preventDefault();
        return;
      }
      if (armed && Math.hypot(e.clientX - armed.x0, e.clientY - armed.y0) > SLOP) disarm(); // das war Scrollen, kein Ziehen
    };

    const onUp = () => {
      if (ses) finish(true);
      disarm();
    };
    const onCancel = () => {
      if (ses) finish(false);
      disarm();
    };

    api.current = {
      arm: (id, label, e, mode) => {
        if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return; // die Maus behält ihr eigenes DnD
        if (e.button) return;
        if (ses) return;
        disarm();
        const el = (e.currentTarget as HTMLElement) ?? (e.target as HTMLElement);
        if (mode === 'grab') {
          e.preventDefault();
          begin(id, label, e.clientX, e.clientY, el);
          return;
        }
        // langer Druck: erst aufnehmen, wenn die Fingerbewegung klein bleibt
        const x0 = e.clientX;
        const y0 = e.clientY;
        armed = {
          id,
          label,
          x0,
          y0,
          el,
          timer: window.setTimeout(() => {
            const a = armed;
            armed = null;
            if (a) begin(a.id, a.label, a.x0, a.y0, a.el);
          }, HOLD_MS),
        };
      },
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      disarm();
      if (ses) finish(false);
      api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const arm = (mode: 'grab' | 'hold') => (id: string, label: string): DragProps => ({
    'data-drag': id,
    onPointerDown: (e: React.PointerEvent) => api.current?.arm(id, label, e as unknown as PointerEvent, mode),
  });
  const grab = useCallback(arm('grab'), []);
  const hold = useCallback(arm('hold'), []);

  const value = React.useMemo<DragApi>(() => ({ grab, hold, dragging: Boolean(ghost) }), [grab, hold, ghost]);

  return (
    <Ctx.Provider value={value}>
      {children}
      {ghost ? (
        <div className="drag-ghost" style={{ transform: `translate3d(${Math.round(ghost.x)}px, ${Math.round(ghost.y - 34)}px, 0) rotate(-1.4deg)` }} aria-hidden>
          <span className="drag-ghost-icon" aria-hidden>
            ⠿
          </span>
          <span className="drag-ghost-label">{ghost.label}</span>
        </div>
      ) : null}
    </Ctx.Provider>
  );
}

/** Der Greifpunkt selbst – klein, gut zu treffen, auf dem Handy nie ein Scroll-Konkurrent */
export function Grip({ grab, id, label, className, title = 'halten und auf einen Tag ziehen' }: { grab?: DragApi['grab']; id: string; label: string; className?: string; title?: string }) {
  const props = grab?.(id, label) ?? {};
  return (
    <span
      {...props}
      title={title}
      aria-hidden
      className={cx('grip touch-none', className)}
      data-grip={id}
    >
      ⠿
    </span>
  );
}
