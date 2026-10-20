'use client';

import React, { useEffect, useRef } from 'react';
import clsx from 'clsx';

export function cx(...parts: (string | false | null | undefined)[]) {
  return clsx(parts);
}

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
