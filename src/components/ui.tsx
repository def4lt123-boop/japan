'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import clsx from 'clsx';

/** useLayoutEffect nur im Browser – beim Server-Rendering würde React sonst warnen */
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export function cx(...parts: (string | false | null | undefined)[]) {
  return clsx(parts);
}

/** Aufklappbarer Block für alles, was nicht beim ersten Blick stören muss */
export function Disclosure({ title, children, open = false, hint }: { title: React.ReactNode; children: React.ReactNode; open?: boolean; hint?: React.ReactNode }) {
  return (
    <details open={open} className="group/disclosure rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[12.5px] font-medium text-slate-300 [&::-webkit-details-marker]:hidden">
        <span aria-hidden className="text-[10px] text-slate-500 transition group-open/disclosure:rotate-90">
          ▸
        </span>
        {title}
        {hint ? <span className="font-normal text-slate-500">· {hint}</span> : null}
      </summary>
      <div className="mt-2.5 space-y-2.5">{children}</div>
    </details>
  );
}

/** Kleine eckige Icon-Aktionen, die im Ruhezustand leise bleiben */
export function IconBtn({ children, className, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={cx('icon-btn', className)} {...rest}>
      {children}
    </button>
  );
}

/** Segmented control: wenige, klar beschriftete choices statt Dropdown-Liste */
export function Seg<T extends string>({
  options,
  value,
  onChange,
  className,
  title,
}: {
  options: { value: T; label: React.ReactNode; title?: string }[];
  value: T | '' | null;
  onChange: (v: T) => void;
  className?: string;
  title?: string;
}) {
  return (
    <div className={cx('seg', className)} title={title} role="group">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          className={cx(value === o.value && 'seg-on')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface MenuItem {
  label: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  run?: () => void;
  href?: string;
  danger?: boolean;
}

/**
 * Ein Knopf, der Aktionen erst zeigt, wenn man sie braucht.
 * Das Panel sitzt am Viewport verankert und nicht am Knopf festgeklebt: dadurch wird es
 * auf dem Handy nicht abgeschnitten, klemmt nicht in Containern mit overflow und rutscht
 * nach oben, wenn unter dem Knopf zu wenig Platz ist. Unter 640 px öffnet es als Blech
 * von unten – mit großen Feldern für den Daumen.
 */
export function Menu({
  items,
  label,
  icon,
  title,
  variant = 'ghost',
  align = 'right',
}: {
  items: MenuItem[];
  label?: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
  variant?: 'primary' | 'ghost' | 'quiet';
  align?: 'left' | 'right';
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [sheet, setSheet] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const place = React.useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const btn = btnRef.current;
    setSheet(vw < 640);
    if (!btn || vw < 640) return;
    const r = btn.getBoundingClientRect();
    const pop = popRef.current;
    const width = Math.min(pop?.offsetWidth || 268, vw - 16);
    const height = pop?.offsetHeight || Math.min(44 + items.length * 44, vh * 0.72);
    const raw = align === 'left' ? r.left : r.right - width;
    const left = Math.max(8, Math.min(raw, vw - width - 8));
    const below = r.bottom + 8;
    const top = below + height > vh - 8 ? Math.max(8, r.top - height - 8) : below;
    setPos({ top, left, width });
  }, [align, items.length]);

  useIsoLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node) && !popRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    const move = () => place();
    window.addEventListener('mousedown', away);
    window.addEventListener('keydown', esc);
    window.addEventListener('resize', move);
    window.addEventListener('scroll', move, true);
    return () => {
      window.removeEventListener('mousedown', away);
      window.removeEventListener('keydown', esc);
      window.removeEventListener('resize', move);
      window.removeEventListener('scroll', move, true);
    };
  }, [open, place]);

  const rows = (big: boolean) => (
    <>
      {items.map((item, i) =>
        item.href ? (
          <Link
            key={i}
            href={item.href}
            onClick={() => setOpen(false)}
            className={cx('flex items-start gap-2 rounded-lg px-2 text-[13px] text-slate-200 transition hover:bg-white/[0.07] hover:text-white', big ? 'py-2.5' : 'py-1.5')}
          >
            {item.icon ? <span aria-hidden className="mt-px">{item.icon}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="block">{item.label}</span>
              {item.hint ? <span className="block text-[11px] text-slate-500">{item.hint}</span> : null}
            </span>
          </Link>
        ) : (
          <button
            key={i}
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              item.run?.();
            }}
            className={cx('flex w-full items-start gap-2 rounded-lg px-2 text-left text-[13px] transition hover:bg-white/[0.07]', big ? 'py-2.5' : 'py-1.5', item.danger ? 'text-red-200/90 hover:text-red-100' : 'text-slate-200 hover:text-white')}
          >
            {item.icon ? <span aria-hidden className="mt-px">{item.icon}</span> : null}
            <span className="min-w-0 flex-1">
              <span className="block">{item.label}</span>
              {item.hint ? <span className="block text-[11px] text-slate-500">{item.hint}</span> : null}
            </span>
          </button>
        ),
      )}
    </>
  );

  return (
    <div className="relative" ref={wrapRef}>
      <button
        ref={btnRef}
        type="button"
        className={clsBtn(variant)}
        title={title}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => {
          setPos(null);
          setOpen((v) => !v);
        }}
      >
        {icon ? <span aria-hidden>{icon}</span> : null}
        {label}
        <span aria-hidden className={cx('text-[9px] opacity-60 transition', open && 'rotate-180')}>
          ▾
        </span>
      </button>

      {/* ins document.body gesetzt – sonst klemmt das Panel in Containern mit backdrop-blur/overflow */}
      {open && sheet && typeof document !== 'undefined'
        ? createPortal(
            <>
              <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden />
              <div ref={popRef} role="menu" className="menu-pop menu-sheet">
                <div className="mx-auto mb-2 h-1 w-9 rounded-full bg-white/20" aria-hidden />
                {title ? <p className="px-2 pb-1.5 text-[11px] uppercase tracking-[0.12em] text-slate-500">{title}</p> : null}
                {rows(true)}
                <button type="button" className="btn-quiet mt-1.5 w-full justify-center" onClick={() => setOpen(false)}>
                  schließen
                </button>
              </div>
            </>,
            document.body,
          )
        : null}

      {open && !sheet && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={popRef}
              role="menu"
              className="menu-pop"
              style={{ position: 'fixed', right: 'auto', marginTop: 0, top: pos?.top ?? 0, left: pos?.left ?? 0, width: pos?.width, visibility: pos ? 'visible' : 'hidden' }}
            >
              {rows(false)}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const clsBtn = (variant: 'primary' | 'ghost' | 'quiet') => (variant === 'primary' ? 'btn-primary' : variant === 'quiet' ? 'btn-quiet' : 'btn-ghost');

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx('card', className)} {...rest}>
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
  icon,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  right?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight text-white">
          {icon ? <span aria-hidden>{icon}</span> : null}
          {title}
        </h2>
        {hint ? <p className="mt-0.5 text-[12.5px] text-slate-400">{hint}</p> : null}
      </div>
      {right ? <div className="flex flex-wrap items-center gap-1.5">{right}</div> : null}
    </div>
  );
}

export function Pill({
  children,
  className,
  style,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}) {
  return (
    <span title={title} className={cx('chip', className)} style={style}>
      {children}
    </span>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: 'good' | 'warn' | 'bad' }) {
  return (
    <Card className={cx('px-3 py-2.5', tone === 'bad' && 'border-shu-500/40')}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-0.5 text-xl font-semibold leading-tight text-white">{value}</div>
      {hint ? <div className={cx('mt-0.5 text-[11.5px]', tone === 'bad' ? 'text-shu-300' : tone === 'warn' ? 'text-amber-200/80' : tone === 'good' ? 'text-emerald-200/80' : 'text-slate-400')}>{hint}</div> : null}
    </Card>
  );
}

export function Button({
  variant = 'ghost',
  size = 'md',
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'quiet' | 'danger'; size?: 'sm' | 'md' }) {
  return (
    <button
      className={cx(
        variant === 'primary' && 'btn-primary',
        variant === 'ghost' && 'btn-ghost',
        variant === 'quiet' && 'btn-quiet',
        variant === 'danger' && 'btn bg-red-500/15 text-red-200 ring-1 ring-inset ring-red-500/30 hover:bg-red-500/25',
        size === 'sm' && '!px-2 !py-1 !text-[12px]',
        className,
      )}
      {...rest}
    />
  );
}

export function Field({ label, children, hint, className }: { label: string; children: React.ReactNode; hint?: React.ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="label">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input className={cx('input', className)} {...rest} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea rows={3} className={cx('input resize-y leading-snug', className)} {...rest} />;
}

export function Select({
  options,
  className,
  allowEmpty,
  emptyLabel = '—',
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & { options: (string | { value: string; label: string })[]; allowEmpty?: boolean; emptyLabel?: string }) {
  return (
    <select className={cx('input appearance-none bg-[length:0]', className)} {...rest}>
      {allowEmpty ? <option value="">{emptyLabel}</option> : null}
      {options.map((o) => {
        const value = typeof o === 'string' ? o : o.value;
        const label = typeof o === 'string' ? o : o.label;
        return (
          <option key={value} value={value} className="bg-ink-900 text-slate-100">
            {label}
          </option>
        );
      })}
    </select>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  width = 'max-w-3xl',
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        const form = ref.current?.querySelector('form');
        if (form) form.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div className="no-print fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className={cx('pop-in card my-auto w-full', width)}>
        <div className="flex items-start justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div>
            <h3 className="text-[15px] font-semibold text-white">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-[12px] text-slate-400">{subtitle}</p> : null}
          </div>
          <Button variant="quiet" size="sm" onClick={onClose} aria-label="Schließen">
            ✕
          </Button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-4 py-3">{children}</div>
        {footer ? <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 px-4 py-3">{footer}</div> : null}
      </div>
    </div>
  );
}

export function Empty({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-md text-[12.5px] text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-3 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Money({ value, className }: { value?: number | null; className?: string }) {
  if (value === null || value === undefined) return <span className={cx('text-slate-600', className)}>—</span>;
  return (
    <span className={cx('whitespace-nowrap tabular-nums', value === 0 ? 'text-emerald-300/80' : 'text-slate-100', className)}>
      {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(value)}
    </span>
  );
}

export function LinkTag({ href, children, title }: { href: string; children: React.ReactNode; title?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      title={title}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-sky-200/90 ring-1 ring-inset ring-sky-400/25 transition hover:bg-sky-400/10 hover:text-white"
    >
      {children}
    </a>
  );
}

export function ProgressBar({ value, max, tone = 'shu' }: { value: number; max: number; tone?: 'shu' | 'matcha' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  const over = max > 0 && value > max;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={cx('h-full rounded-full transition-all', over ? 'bg-shu-500' : tone === 'matcha' ? 'bg-matcha-500' : 'bg-shu-400')} style={{ width: `${pct}%` }} />
    </div>
  );
}
