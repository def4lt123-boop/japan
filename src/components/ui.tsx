'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { clsx, type ClassValue } from 'clsx';

export const cx = (...werte: ClassValue[]) => clsx(werte);

/* ── Rahmen ─────────────────────────────────────────────────────────────── */

export function Seite({ children, className }: { children: React.ReactNode; className?: string }) {
  return <main className={cx('seite', className)}>{children}</main>;
}

export function Karten({
  children,
  className,
  rand = true,
}: {
  children: React.ReactNode;
  className?: string;
  rand?: boolean;
}) {
  return <section className={cx(rand ? 'karte' : 'karte-flach', className)}>{children}</section>;
}

export function KartenKopf({
  titel,
  untertitel,
  seitlich,
  className,
}: {
  titel: React.ReactNode;
  untertitel?: React.ReactNode;
  seitlich?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('kopf', className)}>
      <div className="titel min-w-0">
        <h2 className="truncate">{titel}</h2>
        {untertitel ? <p className="mikro mt-0.5">{untertitel}</p> : null}
      </div>
      {seitlich ? <div className="flex flex-wrap items-center justify-end gap-1">{seitlich}</div> : null}
    </div>
  );
}

export function SeitenKopf({
  titel,
  untertitel,
  seitlich,
  ueber,
}: {
  titel: React.ReactNode;
  untertitel?: React.ReactNode;
  seitlich?: React.ReactNode;
  ueber?: React.ReactNode;
}) {
  return (
    <>
      {ueber}
      <header className="seitenkopf">
        <div className="titel min-w-0">
          <h1 className="text-balance">{titel}</h1>
          {untertitel ? <p className="mt-1 text-[14px] leading-snug text-[var(--text2)]">{untertitel}</p> : null}
        </div>
        {seitlich ? <div className="neben">{seitlich}</div> : null}
      </header>
    </>
  );
}

/* ── Knöpfe ─────────────────────────────────────────────────────────────── */

type KnopfTon = 'akzent' | 'ghost' | 'dezent' | 'gefahr';

export function Knopf({
  children,
  ton = 'akzent',
  klein = false,
  breit = false,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; ton?: KnopfTon; klein?: boolean; breit?: boolean }) {
  return (
    <button
      type="button"
      {...rest}
      className={cx(
        'knopf',
        ton === 'ghost' && 'knopf-ghost',
        ton === 'dezent' && 'knopf-dezent',
        ton === 'gefahr' && 'knopf-gefahr',
        klein && 'knopf-klein',
        breit && 'w-full',
        rest.className,
      )}
    >
      {children}
    </button>
  );
}

export function IconKnopf({
  children,
  titel,
  deaktiviert,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: React.ReactNode; titel: string; deaktiviert?: boolean }) {
  return (
    <button
      type="button"
      title={titel}
      aria-label={titel}
      disabled={deaktiviert}
      {...rest}
      className={cx('icon-knopf', rest.className)}
    >
      {children}
    </button>
  );
}

export function LinkKnopf({
  href,
  children,
  ton = 'ghost',
  klein = false,
  className,
  ...rest
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; children: React.ReactNode; ton?: KnopfTon; klein?: boolean }) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      {...rest}
      className={cx(
        'knopf',
        ton === 'ghost' && 'knopf-ghost',
        ton === 'dezent' && 'knopf-dezent',
        ton === 'gefahr' && 'knopf-gefahr',
        klein && 'knopf-klein',
        className,
      )}
    >
      {children}
    </a>
  );
}

/* ── Kleines ────────────────────────────────────────────────────────────── */

export function Chip({
  children,
  ton,
  className,
  titel,
}: {
  children: React.ReactNode;
  ton?: 'warnt' | 'gut';
  className?: string;
  titel?: string;
}) {
  return (
    <span title={titel} className={cx('chip', ton === 'warnt' && 'chip-warnt', ton === 'gut' && 'chip-gut', className)}>
      {children}
    </span>
  );
}

export function Punkt({ farbe, groesse = 10 }: { farbe: string; groesse?: number }) {
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{ width: groesse, height: groesse, background: farbe }}
    />
  );
}

export function Fortschritt({ prozent, className }: { prozent: number; className?: string }) {
  return (
    <div className={cx('fortschritt', className)} role="progressbar" aria-valuenow={Math.round(prozent)} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${Math.max(0, Math.min(100, prozent))}%` }} />
    </div>
  );
}

export function Segment({
  wert,
  optionen,
  beimAendern,
  className,
}: {
  wert: string;
  optionen: { id: string; label: string; zeichen?: string }[];
  beimAendern: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cx('gelenk', className)} role="tablist">
      {optionen.map((o) => {
        const aktiv = o.id === wert;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={aktiv}
            onClick={() => beimAendern(o.id)}
            className={cx('chip !text-[13.5px] !px-3 !py-2', aktiv ? 'chip-aktiv' : '')}
            style={{ borderColor: aktiv ? 'var(--akzent)' : 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
          >
            {o.zeichen ? <span aria-hidden>{o.zeichen} </span> : null}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Umschalter({
  an,
  beimUmschalten,
  label,
  hinweis,
}: {
  an: boolean;
  beimUmschalten: (an: boolean) => void;
  label: string;
  hinweis?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={an}
      onClick={() => beimUmschalten(!an)}
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-left"
      style={{ borderColor: 'var(--rand)', background: 'var(--karte)' }}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hinweis ? <span className="mikro block">{hinweis}</span> : null}
      </span>
      <span
        aria-hidden
        className="flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors"
        style={{ background: an ? 'var(--akzent)' : '#dbe1ea' }}
      >
        <span className="h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: an ? 'translateX(20px)' : undefined }} />
      </span>
    </button>
  );
}

/* ── Felder ─────────────────────────────────────────────────────────────── */

export function Feld({
  label,
  hinweis,
  children,
  className,
}: {
  label?: string;
  hinweis?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx('feld', className)}>
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div data-feld={label ? id : undefined}>{children}</div>
      {hinweis ? <p className="mikro mt-1">{hinweis}</p> : null}
    </div>
  );
}

function feldKlasse(fehler?: string) {
  return cx('eingabe', fehler && '!border-[var(--gefahr)]');
}

export function TextFeld({
  label,
  wert,
  beimAendern,
  platzhalter,
  typ = 'text',
  fehler,
  mehrzeilig = false,
  zeilen = 3,
  autoVeroellstaendigen,
  eingabeModus,
  hinweis,
  className,
  onTaste,
}: {
  label?: string;
  wert: string;
  beimAendern: (wert: string) => void;
  platzhalter?: string;
  typ?: string;
  fehler?: string;
  mehrzeilig?: boolean;
  /** zeilen im mehrzeiligen feld – ein eingefügter text braucht höhe */
  zeilen?: number;
  autoVeroellstaendigen?: string;
  eingabeModus?: 'text' | 'decimal' | 'url' | 'email' | 'tel';
  hinweis?: React.ReactNode;
  className?: string;
  /** tastatur am eingabefeld – hier für „eintreten = erster vorschlag" */
  onTaste?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}) {
  const id = useId();
  return (
    <div className={cx('feld', className)}>
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      {mehrzeilig ? (
        <textarea id={id} className={feldKlasse(fehler)} value={wert} placeholder={platzhalter} onChange={(e) => beimAendern(e.target.value)} rows={zeilen} />
      ) : (
        <input
          id={id}
          className={feldKlasse(fehler)}
          type={typ}
          value={wert}
          placeholder={platzhalter}
          inputMode={eingabeModus}
          autoComplete={autoVeroellstaendigen}
          onChange={(e) => beimAendern(e.target.value)}
          onKeyDown={onTaste}
        />
      )}
      {fehler ? (
        <p className="mt-1 text-[13px] font-medium text-[var(--gefahr)]">{fehler}</p>
      ) : hinweis ? (
        <p className="mikro mt-1">{hinweis}</p>
      ) : null}
    </div>
  );
}

export function ZahlFeld({
  label,
  wert,
  beimAendern,
  vorzeichen,
  hinweis,
  platzhalter = '—',
  className,
}: {
  label?: string;
  wert: number | null;
  beimAendern: (wert: number | null) => void;
  vorzeichen?: string;
  hinweis?: React.ReactNode;
  platzhalter?: string;
  className?: string;
}) {
  const [text, setText] = useState(wert === null ? '' : String(wert).replace('.', ','));
  useEffect(() => {
    setText((aktuell) => {
      const gedeutet = parseZahl(aktuell);
      return gedeutet === wert ? aktuell : wert === null ? '' : String(wert).replace('.', ',');
    });
  }, [wert]);
  const id = useId();
  return (
    <div className={cx('feld', className)}>
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="relative">
        <input
          id={id}
          className={cx('eingabe', vorzeichen && 'pr-10')}
          inputMode="decimal"
          value={text}
          placeholder={platzhalter}
          onChange={(e) => {
            setText(e.target.value);
            beimAendern(parseZahl(e.target.value));
          }}
        />
        {vorzeichen ? <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[14px] text-[var(--text3)]">{vorzeichen}</span> : null}
      </div>
      {hinweis ? <p className="mikro mt-1">{hinweis}</p> : null}
    </div>
  );
}

function parseZahl(text: string): number | null {
  const sauber = text.replace(/[^\d,.-]/g, '').replace(',', '.');
  if (!sauber || sauber === '-' || sauber === '.') return null;
  const zahl = Number(sauber);
  return Number.isFinite(zahl) ? zahl : null;
}

export function Auswahl({
  label,
  wert,
  optionen,
  beimAendern,
  className,
  hinweis,
}: {
  label?: string;
  wert: string;
  optionen: { value: string; label: string }[];
  beimAendern: (wert: string) => void;
  className?: string;
  hinweis?: React.ReactNode;
}) {
  const id = useId();
  return (
    <div className={cx('feld', className)}>
      {label ? (
        <label className="label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <select id={id} className={cx('eingabe selekt', hinweis && 'mb-0')} value={wert} onChange={(e) => beimAendern(e.target.value)}>
        {optionen.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hinweis ? <p className="mikro mt-1">{hinweis}</p> : null}
    </div>
  );
}

export function ZeitFeld({ label, wert, beimAendern, className }: { label: string; wert: string | null; beimAendern: (wert: string | null) => void; className?: string }) {
  const id = useId();
  return (
    <div className={cx('feld', className)}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="time"
        className="eingabe"
        value={wert ?? ''}
        onChange={(e) => beimAendern(e.target.value || null)}
      />
    </div>
  );
}

export function DatumFeld({ label, wert, beimAendern, kleinste, groesste, className }: { label: string; wert: string | null; beimAendern: (wert: string | null) => void; kleinste?: string; groesste?: string; className?: string }) {
  const id = useId();
  return (
    <div className={cx('feld', className)}>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        className="eingabe"
        value={wert ?? ''}
        min={kleinste}
        max={groesste}
        onChange={(e) => beimAendern(e.target.value || null)}
      />
    </div>
  );
}

/* ── Bilder ─────────────────────────────────────────────────────────────── */

export function Foto({
  url,
  nachweis,
  alt,
  zeichen = '🧭',
  hoehe = 56,
  rund = false,
  className,
}: {
  url: string | null | undefined;
  nachweis?: string | null;
  alt: string;
  zeichen?: string;
  hoehe?: number;
  rund?: boolean;
  className?: string;
}) {
  const [kaputt, setKaputt] = useState(false);
  const bild = url && !kaputt;
  const gross = hoehe >= 110;
  return (
    <span
      title={nachweis && !gross ? nachweis : undefined}
      className={cx('relative block shrink-0 overflow-hidden', rund ? 'rounded-full' : 'rounded-xl', className)}
      style={{
        height: hoehe,
        width: hoehe,
        background: bild ? '#e9edf4' : 'linear-gradient(135deg, #dfe7f1, #eef3f8)',
      }}
    >
      {bild ? (
        <img src={url} alt={alt} loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setKaputt(true)} />
      ) : (
        <span aria-hidden className="flex h-full w-full items-center justify-center" style={{ fontSize: Math.round(hoehe * 0.42) }}>
          {zeichen}
        </span>
      )}
      {nachweis && gross ? (
        <span className="mikro absolute inset-x-0 bottom-0 truncate bg-black/50 px-1.5 py-0.5 text-center text-white">
          {nachweis.length > 40 ? `${nachweis.slice(0, 38)}…` : nachweis}
        </span>
      ) : null}
    </span>
  );
}

/* ── Blech unten (Ablage) – Menü und Formular – nie abgeschnitten ───────── */

export function Ablage({
  offen,
  titel,
  schliessen,
  children,
  fuss,
  fokus = false,
}: {
  offen: boolean;
  titel: string;
  schliessen: () => void;
  children: React.ReactNode;
  fuss?: React.ReactNode;
  fokus?: boolean;
}) {
  const [koerper, setKoerper] = useState<HTMLElement | null>(null);
  const randRef = useRef<HTMLDivElement | null>(null);
  /* der Schließknopf kommt bei jedem Render als neuer – die Sperre soll das nicht tun */
  const schliessenRef = useRef(schliessen);

  useEffect(() => setKoerper(document.body), []);

  useEffect(() => {
    schliessenRef.current = schliessen;
  }, [schliessen]);

  useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessenRef.current();
    };
    document.addEventListener('keydown', taste);
    const vorher = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const zeit = window.setTimeout(() => {
      const ziel = randRef.current?.querySelector<HTMLElement>(fokus ? 'input,select,textarea' : '[daten-erstes]');
      (ziel ?? randRef.current)?.focus?.();
    }, 60);
    return () => {
      document.removeEventListener('keydown', taste);
      document.body.style.overflow = vorher;
      window.clearTimeout(zeit);
    };
  }, [offen, fokus]);

  if (!offen || !koerper) return null;
  return createPortal(
    <div
      className="boden-ablage"
      onClick={(e) => {
        if (e.target === e.currentTarget) schliessen();
      }}
    >
      <div className="ablage" role="dialog" aria-modal="true" aria-label={titel} tabIndex={-1} ref={randRef}>
        <div className="ablage-kopf">
          <h2 className="min-w-0 flex-1 truncate">{titel}</h2>
          <IconKnopf titel="schließen" onClick={schliessen}>
            ✕
          </IconKnopf>
        </div>
        <div className="ablage-inhalt">{children}</div>
        {fuss ? (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t p-3" style={{ borderColor: 'var(--rand)' }}>
            {fuss}
          </div>
        ) : null}
      </div>
    </div>,
    koerper,
  );
}

export interface MenuePunkt {
  label: string;
  zeichen?: string;
  onClick?: () => void;
  href?: string;
  gefahr?: boolean;
  deaktiviert?: boolean;
}

export function Menue({ punkte, titel = 'Aktionen', knopfTitel = 'mehr' }: { punkte: MenuePunkt[]; titel?: string; knopfTitel?: string }) {
  const [offen, setOffen] = useState(false);
  const zu = punkte.filter((p) => !p.deaktiviert).length;
  if (zu === 0) return null;
  return (
    <>
      <IconKnopf titel={knopfTitel} onClick={() => setOffen(true)}>
        ⋯
      </IconKnopf>
      <Ablage offen={offen} titel={titel} schliessen={() => setOffen(false)}>
        <ul className="list-none space-y-1.5 p-0">
          {punkte.map((p) =>
            p.href ? (
              <li key={p.label}>
                <a
                  href={p.href}
                  target={p.href.startsWith('http') ? '_blank' : undefined}
                  rel={p.href.startsWith('http') ? 'noreferrer' : undefined}
                  onClick={() => setOffen(false)}
                  className="flex min-h-11 items-center gap-3 rounded-xl border px-3 text-[15px]"
                  style={{ borderColor: 'var(--rand)', color: p.gefahr ? 'var(--gefahr)' : 'var(--text)' }}
                >
                  {p.zeichen ? <span aria-hidden>{p.zeichen}</span> : null}
                  <span className="min-w-0 flex-1">{p.label}</span>
                  {p.href.startsWith('http') ? <span aria-hidden className="text-[13px] text-[var(--text3)]">↗</span> : null}
                </a>
              </li>
            ) : (
              <li key={p.label}>
                <button
                  type="button"
                  data-erstes=""
                  disabled={p.deaktiviert}
                  onClick={() => {
                    setOffen(false);
                    p.onClick?.();
                  }}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl border px-3 text-left text-[15px] disabled:opacity-40"
                  style={{ borderColor: 'var(--rand)', color: p.gefahr ? 'var(--gefahr)' : 'var(--text)' }}
                >
                  {p.zeichen ? <span aria-hidden>{p.zeichen}</span> : null}
                  <span className="min-w-0 flex-1">{p.label}</span>
                </button>
              </li>
            ),
          )}
        </ul>
      </Ablage>
    </>
  );
}

/* ── Zustände ───────────────────────────────────────────────────────────── */

export function Leer({
  zeichen = '🧭',
  titel,
  text,
  knopf,
}: {
  zeichen?: string;
  titel: string;
  text?: React.ReactNode;
  knopf?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-9 text-center">
      <span aria-hidden className="text-[30px] leading-none">
        {zeichen}
      </span>
      <h3 className="text-[16px] font-semibold">{titel}</h3>
      {text ? <p className="max-w-[34ch] text-[14px] leading-relaxed text-[var(--text2)]">{text}</p> : null}
      {knopf ? <div className="mt-2 flex flex-wrap justify-center gap-2">{knopf}</div> : null}
    </div>
  );
}

export function Hinweis({ children, ton = 'info', className }: { children: React.ReactNode; ton?: 'info' | 'warnt' | 'gut'; className?: string }) {
  return (
    <p
      className={cx('rounded-xl px-3 py-2.5 text-[13.5px] leading-relaxed', className)}
      style={{
        background: ton === 'warnt' ? 'var(--warnt-fläche)' : ton === 'gut' ? 'var(--gut-fläche)' : 'var(--akzent-fläche)',
        color: ton === 'warnt' ? 'var(--warnt)' : ton === 'gut' ? 'var(--gut)' : 'var(--akzent-text)',
      }}
    >
      {children}
    </p>
  );
}
