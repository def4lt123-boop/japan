'use client';

import { useEffect, useMemo, useState } from 'react';
import { tagKurz } from '../lib/dates';
import { reiseTage } from '../lib/plan';
import { ANDERE_KATEGORIEN, kategorie, kategorieVorschlag, artMeta } from '../lib/kategorien';
import { kartenLink, kartenVorschau } from '../lib/karten';
import { punktAusText, stadtAusAdresse } from '../lib/orte';
import { punktFuer, suchkandidaten, type Punktquelle } from '../lib/punktfindung';
import { geld } from '../lib/format';
import { useStore } from '../lib/daten';
import type { Eintrag, EintragArt, Reise } from '../lib/types';
import { Ablage, Auswahl, Chip, Feld, Foto, IconKnopf, Karten, TextFeld, Umschalter, ZahlFeld, ZeitFeld, cx } from './ui';
import { WAEHRUNGEN } from '../lib/format';
import { OrtSuche, type Gewaehlt } from './OrtSuche';

/**
 * Das eine Formular für Aktivität, Unterkunft und Fahrt. Kurz halten, was
 * häufig ist (Name, Tag, Zeit), und den Rest einklappen.
 */

interface Entwurf {
  titel: string;
  kategorie: string;
  date: string;
  zeit: string;
  bis_zeit: string;
  dauer: string;
  bis_date: string;
  ort: string;
  adresse: string;
  lat: number | null;
  lng: number | null;
  karten_stichwort: string | null;
  preis: number | null;
  waehrung: string;
  buchung_url: string;
  buchung_nr: string;
  notiz: string;
  foto_url: string | null;
  foto_nachweis: string | null;
}

const leer = (vor: Partial<Eintrag> | null | undefined, reise: Reise, datum: string | null | undefined): Entwurf => ({
  titel: vor?.titel ?? '',
  kategorie: vor?.kategorie ?? '',
  date: vor?.date ?? datum ?? reise.start_date ?? '',
  zeit: vor?.zeit ?? (vor?.art === 'unterkunft' ? '15:00' : ''),
  bis_zeit: vor?.bis_zeit ?? (vor?.art === 'unterkunft' ? '11:00' : ''),
  dauer: vor?.dauer_min ? String(vor.dauer_min) : '',
  bis_date: vor?.bis_date ?? '',
  ort: vor?.ort ?? '',
  adresse: vor?.adresse ?? '',
  lat: vor?.lat ?? null,
  lng: vor?.lng ?? null,
  karten_stichwort: vor?.karten_stichwort ?? null,
  preis: vor?.preis ?? null,
  waehrung: vor?.waehrung ?? '',
  buchung_url: vor?.buchung_url ?? '',
  buchung_nr: vor?.buchung_nr ?? '',
  notiz: vor?.notiz ?? '',
  foto_url: vor?.foto_url ?? null,
  foto_nachweis: vor?.foto_nachweis ?? null,
});

export function EintragFormular({
  reise,
  art,
  bestehend,
  vorlage,
  datum,
  offen,
  schliessen,
  nachSpeichern,
}: {
  reise: Reise;
  art: EintragArt;
  bestehend?: Eintrag | null;
  vorlage?: Partial<Eintrag> | null;
  datum?: string | null;
  offen: boolean;
  schliessen: () => void;
  nachSpeichern?: (eintrag: Eintrag) => void;
}) {
  const store = useStore();
  const [entwurf, setEntwurf] = useState<Entwurf>(() => leer(bestehend ?? vorlage, reise, datum));
  // an einer Unterkunft sind Adresse, Buchung und Notiz Kernangaben – das Fach bleibt dort offen
  const [mehr, setMehr] = useState(() => Boolean(bestehend?.notiz || bestehend?.buchung_url || bestehend?.buchung_nr) || art === 'unterkunft');
  const [bildLaeuft, setBildLaeuft] = useState(false);

  useEffect(() => {
    if (!offen) return;
    setEntwurf(leer(bestehend ?? vorlage, reise, datum));
    setBildLaeuft(false);
  }, [offen, bestehend, vorlage, reise, datum]);

  const tage = useMemo(() => reiseTage(reise), [reise]);
  const mittelpunkt = useMemo(() => {
    const nabar = store.eintraegeVon(reise.id).find((e) => typeof e.lat === 'number' && typeof e.lng === 'number');
    return typeof nabar?.lat === 'number' && typeof nabar?.lng === 'number' ? { lat: nabar.lat, lng: nabar.lng } : null;
  }, [store, reise.id]);
  const metadaten = artMeta(art);
  const istBett = art === 'unterkunft';
  const set = (patch: Partial<Entwurf>) => setEntwurf((v) => ({ ...v, ...patch }));

  const uebernehmen = (v: Gewaehlt) => {
    set({
      titel: v.titel,
      adresse: v.adresse ?? '',
      lat: v.lat,
      lng: v.lng,
      karten_stichwort: v.stichwort,
      ort: entwurf.ort || stadtAusAdresse(v.adresse, reise.land) || '',
      kategorie: entwurf.kategorie || (art === 'unterkunft' ? 'unterschlupf' : kategorieVorschlag(v.titel, v.adresse ?? '')),
    });
    if (store.einstellungen.bilder && !entwurf.foto_url) void bildeins(v.titel, v.adresse);
  };

  async function bildeins(stichwortTitel: string, adresse?: string | null) {
    const frage = [stichwortTitel, adresse ?? entwurf.ort ?? reise.land ?? ''].filter(Boolean).join(', ');
    if (frage.length < 3) return;
    setBildLaeuft(true);
    try {
      const antwort = await fetch(`/api/bild?q=${encodeURIComponent(frage)}`, { cache: 'no-store' });
      const daten = (await antwort.json()) as { url?: string; nachweis?: string | null };
      if (daten.url) set({ foto_url: daten.url, foto_nachweis: daten.nachweis ?? null });
    } catch {
      /* ohne Bild läuft es genauso */
    } finally {
      setBildLaeuft(false);
    }
  }

  async function eigenesBild(datei: File | null) {
    if (!datei) return;
    setBildLaeuft(true);
    try {
      const url = await verschiebenInDatenUrl(datei);
      set({ foto_url: url, foto_nachweis: null });
    } finally {
      setBildLaeuft(false);
    }
  }

  const punkte = tage.length ? tage : [entwurf.date].filter(Boolean);

  /**
   * Wer ohne Punkt speichert, kriegt ihn von der Suche nachgereicht – nach dem
   * Schließen, damit das Speichern nie auf ein Netzwerk wartet. Der Nachweis
   * bleibt im Toast, damit jemand sehen kann, woher der Punkt kommt.
   */
  const punktNachtragen = async (eintragsId: string, quelltext: Punktquelle) => {
    if (!suchkandidaten(quelltext).length) return;
    const treffer = await punktFuer(quelltext, reise.land);
    if (!treffer) {
      store.sagen('Keinen passenden Punkt gefunden – in der Zeile den Ort suchen.');
      return;
    }
    await store.eintragAendern(eintragsId, treffer.patch);
    store.sagen(`Punkt von ${treffer.name} · ${treffer.quelle} übernommen.`);
  };

  const speichern = async () => {
    const titel = entwurf.titel.trim();
    if (!titel) return;
    const dauer = entwurf.dauer ? Math.round(Number(entwurf.dauer.replace(',', '.'))) : null;
    const werte: Partial<Eintrag> = {
      art,
      titel,
      kategorie: istBett ? 'unterschlupf' : entwurf.kategorie || kategorieVorschlag(titel, entwurf.ort),
      date: entwurf.date || null,
      bis_date: istBett ? entwurf.bis_date || null : null,
      zeit: entwurf.zeit || null,
      bis_zeit: entwurf.bis_zeit || null,
      dauer_min: istBett ? null : Number.isFinite(dauer) && dauer ? dauer : null,
      ort: entwurf.ort.trim() || null,
      adresse: entwurf.adresse.trim() || null,
      lat: entwurf.lat,
      lng: entwurf.lng,
      karten_stichwort: entwurf.karten_stichwort,
      preis: entwurf.preis,
      waehrung: entwurf.waehrung.trim().toUpperCase() || null,
      buchung_url: entwurf.buchung_url.trim() || null,
      buchung_nr: entwurf.buchung_nr.trim() || null,
      notiz: entwurf.notiz.trim() || null,
      foto_url: entwurf.foto_url,
      foto_nachweis: entwurf.foto_nachweis,
    };
    const quelltext: Punktquelle = { titel, ort: werte.ort, adresse: werte.adresse, karten_stichwort: werte.karten_stichwort };
    if (bestehend) {
      await store.eintragAendern(bestehend.id, werte);
      nachSpeichern?.({ ...bestehend, ...werte } as Eintrag);
      if (werte.lat === null) void punktNachtragen(bestehend.id, quelltext);
    } else {
      const neu = await store.eintragAnlegen({ ...werte, reise_id: reise.id, titel } as Partial<Eintrag> & { reise_id: string; titel: string });
      nachSpeichern?.(neu);
      if (werte.lat === null) void punktNachtragen(neu.id, quelltext);
    }
    store.sagen(`${metadaten.wort} gespeichert.`);
    schliessen();
  };

  return (
    <Ablage
      offen={offen}
      fokus
      titel={`${bestehend ? 'Bearbeiten' : 'Neu'}: ${metadaten.label}`}
      schliessen={schliessen}
      fuss={
        <>
          <button type="button" className="knopf-dezent knopf" onClick={schliessen}>
            abbrechen
          </button>
          <button type="button" className="knopf" onClick={speichern} disabled={!entwurf.titel.trim()}>
            speichern
          </button>
        </>
      }
    >
      <div className="space-y-3 pt-3">
        <OrtSuche
          wert={entwurf.titel}
          beimAendern={(t) => set({ titel: t, kategorie: entwurf.kategorie || kategorieVorschlag(t) })}
          beiAuswahl={uebernehmen}
          platzhalter={istBett ? 'Hotel, Pension, Adresse' : art === 'fahrt' ? 'Zug Kyoto → Osaka, Flug …' : 'Was willst du dort tun?'}
          konzentriert={mittelpunkt}
          hinweis="Einen Vorschlag antippen – Name, Adresse, Punkt und Bild wandern automatisch hinein."
        />

        {entwurf.lat !== null && entwurf.lng !== null ? (
          <div className="flex items-center gap-2">
            <Chip ton="gut">📍 Punkt übernommen</Chip>
            <a href={kartenLink({ lat: entwurf.lat, lng: entwurf.lng, titel: entwurf.titel })} target="_blank" rel="noreferrer" className="text-[13.5px]">
              auf Google Maps ansehen
            </a>
          </div>
        ) : null}

        <div>
          <p className="label mb-1">{istBett ? 'Nächte' : 'Tag'}</p>
          <div className="gelenk">
            {punkte.map((d) => {
              const an = entwurf.date === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => set({ date: d })}
                  className={cx('chip !px-3 !py-2 !text-[13.5px]', an && 'chip-aktiv')}
                  style={{ borderColor: an ? 'var(--akzent)' : 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
                >
                  {tagKurz(d)}
                </button>
              );
            })}
            {!punkte.length ? <span className="mikro self-center">Reise hat keinen Zeitraum – zuerst unten den Tag wählen.</span> : null}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Feld label={istBett ? 'Check-in' : 'Am'}>
              <input type="date" className="eingabe" value={entwurf.date} onChange={(e) => set({ date: e.target.value })} />
            </Feld>
            {istBett ? (
              <Feld label="Check-out">
                <input type="date" className="eingabe" value={entwurf.bis_date} min={entwurf.date || undefined} onChange={(e) => set({ bis_date: e.target.value })} />
              </Feld>
            ) : (
              <ZeitFeld label="Von" wert={entwurf.zeit || null} beimAendern={(z) => set({ zeit: z ?? '' })} />
            )}
          </div>
          {istBett ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ZeitFeld label="Check-in Zeit" wert={entwurf.zeit || null} beimAendern={(z) => set({ zeit: z ?? '' })} />
              <ZeitFeld label="Check-out Zeit" wert={entwurf.bis_zeit || null} beimAendern={(z) => set({ bis_zeit: z ?? '' })} />
            </div>
          ) : (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <ZeitFeld label="Bis" wert={entwurf.bis_zeit || null} beimAendern={(z) => set({ bis_zeit: z ?? '', dauer: z && entwurf.zeit ? String(dauerZwischen(entwurf.zeit, z)) : entwurf.dauer })} />
              <ZahlFeld label="Dauer in Minuten" wert={entwurf.dauer ? Number(entwurf.dauer) : null} beimAendern={(n) => set({ dauer: n === null ? '' : String(n) })} />
            </div>
          )}
          {istBett && entwurf.bis_date && entwurf.date ? (
            <p className="mikro mt-1.5">
              gilt für {naehte(entwurf.date, entwurf.bis_date)} {naehte(entwurf.date, entwurf.bis_date) === 1 ? 'Nacht' : 'Nächte'} – erscheint an jedem dieser Tage.
            </p>
          ) : null}
        </div>

        {art === 'aktivitaet' ? (
          <div>
            <p className="label">Kategorie</p>
            <div className="gelenk">
              {ANDERE_KATEGORIEN.map((k) => {
                const an = (entwurf.kategorie || kategorieVorschlag(entwurf.titel)) === k.id;
                return (
                  <button key={k.id} type="button" onClick={() => set({ kategorie: k.id })} className={cx('chip !px-3 !py-2 !text-[13.5px]', an && 'chip-aktiv')} style={{ borderColor: an ? k.farbe : 'var(--rand)', borderWidth: 1, borderStyle: 'solid', background: an ? k.farbe : undefined }}>
                    <span aria-hidden>{k.icon}</span> {k.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <TextFeld label="Ort" wert={entwurf.ort} beimAendern={(t) => set({ ort: t })} platzhalter="Stadt oder Insel" />
          <div className="grid grid-cols-[minmax(0,1fr)_6.4rem] items-start gap-1.5">
            <ZahlFeld
              label="Preis"
              wert={entwurf.preis}
              beimAendern={(n) => set({ preis: n })}
              vorzeichen={geld(1, entwurf.waehrung || reise.waehrung).replace(/[\d.,\s]/g, '')}
              hinweis={istBett && entwurf.preis ? `${geld(entwurf.preis / Math.max(1, naehte(entwurf.date, entwurf.bis_date || entwurf.date)), entwurf.waehrung || reise.waehrung)} pro Nacht` : undefined}
            />
            <Auswahl
              label="Währung"
              wert={entwurf.waehrung}
              beimAendern={(w) => set({ waehrung: w })}
              optionen={[{ value: '', label: `${reise.waehrung} (wie Reise)` }, ...WAEHRUNGEN.filter((w) => w !== reise.waehrung).map((w) => ({ value: w, label: w }))]}
            />
          </div>
        </div>

        <div>
          <p className="label">Bild</p>
          <div className="flex items-center gap-2">
            <Foto url={entwurf.foto_url} nachweis={entwurf.foto_nachweis} alt={entwurf.titel || 'Bild'} zeichen={istBett ? '🏨' : metadaten.Icon} hoehe={64} />
            <div className="flex min-w-0 flex-wrap gap-1.5">
              <button type="button" className="knopf knopf-ghost knopf-klein" onClick={() => void bildeins(entwurf.titel, entwurf.adresse || entwurf.ort)} disabled={bildLaeuft}>
                {bildLaeuft ? 'suche …' : 'Bild suchen'}
              </button>
              <label className="knopf knopf-ghost knopf-klein cursor-pointer">
                eigenes
                <input type="file" accept="image/*" className="sr-only" onChange={(e) => void eigenesBild(e.target.files?.[0] ?? null)} />
              </label>
              {entwurf.foto_url ? (
                <IconKnopf titel="Bild entfernen" onClick={() => set({ foto_url: null, foto_nachweis: null })}>
                  ✕
                </IconKnopf>
              ) : null}
            </div>
          </div>
          {entwurf.foto_url && !entwurf.foto_url.startsWith('data:') ? (
            <p className="mikro mt-1">{entwurf.foto_nachweis || 'Bild von Wikimedia Commons – Nachweis bleibt am Bild stehen.'}</p>
          ) : null}
        </div>

        {entwurf.lat !== null ? (
          <Karten rand={false} className="overflow-hidden">
            <iframe title="Kartenvorschau" src={kartenVorschau({ lat: entwurf.lat, lng: entwurf.lng, titel: entwurf.titel })} className="block h-[170px] w-full border-0" loading="lazy" />
          </Karten>
        ) : null}

        <button type="button" className="mikro flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left" onClick={() => setMehr((m) => !m)}>
          <span>{mehr ? (istBett ? 'weniger Angaben' : 'mehr Angaben (Adresse, Buchung, Notiz)') : istBett ? 'Adresse, Buchung, Notiz' : 'mehr Angaben (Adresse, Buchung, Notiz)'}</span>
          <span aria-hidden>{mehr ? '⌃' : '⌄'}</span>
        </button>
        {mehr ? (
          <div className="space-y-3 rounded-xl border p-2.5" style={{ borderColor: 'var(--rand)' }}>
            <TextFeld label="Adresse" wert={entwurf.adresse} beimAendern={(t) => set({ adresse: t })} platzhalter="Straße und Hausnummer" />
            <div className="grid grid-cols-2 gap-2">
              <TextFeld label="Punkt" wert={entwurf.lat !== null ? `${entwurf.lat.toFixed(5)}, ${entwurf.lng?.toFixed(5)}` : ''} beimAendern={(t) => set(punktAusText(t))} platzhalter="35.0116, 135.7681" hinweis="Komma-getrennt – oder oben einen Ort suchen." />
              <TextFeld label="Buchungs-Nr." wert={entwurf.buchung_nr} beimAendern={(t) => set({ buchung_nr: t })} platzhalter="z. B. 4K2L9" />
            </div>
            <TextFeld label="Buchungslink" wert={entwurf.buchung_url} beimAendern={(t) => set({ buchung_url: t })} platzhalter="https://…" typ="url" eingabeModus="url" />
            <TextFeld label="Notiz" wert={entwurf.notiz} beimAendern={(t) => set({ notiz: t })} platzhalter="Ankunft 14:30, Schlüssel beim Automat …" mehrzeilig />
            <Umschalter an={store.einstellungen.bilder} beimUmschalten={(an) => store.einstellen({ bilder: an })} label="Bild automatisch suchen" hinweis="Beim nächsten Ort gleich mitmachen." />
          </div>
        ) : null}
      </div>
    </Ablage>
  );
}

function dauerZwischen(von: string, bis: string): number {
  const [vh, vm] = von.split(':').map(Number);
  const [bh, bm] = bis.split(':').map(Number);
  const d = bh * 60 + bm - (vh * 60 + vm);
  return d > 0 ? d : Math.max(0, d + 1440);
}

function naehte(von: string, bis: string): number {
  const a = Date.parse(`${von}T00:00:00Z`);
  const b = Date.parse(`${bis}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  return Math.round((b - a) / 86_400_000);
}

/** Ein eigenes Bild bleibt klein: 900 px Kante, als Datenurl im Eintrag */
async function verschiebenInDatenUrl(datei: File): Promise<string> {
  const quelle = await new Promise<string>((fertig, fehler) => {
    const leser = new FileReader();
    leser.onload = () => fertig(String(leser.result));
    leser.onerror = () => fehler(new Error('Bild nicht lesbar'));
    leser.readAsDataURL(datei);
  });
  const bild = await new Promise<HTMLImageElement>((fertig, fehler) => {
    const b = new Image();
    b.onload = () => fertig(b);
    b.onerror = () => fehler(new Error('Bildformat nicht unterstützt'));
    b.src = quelle;
  });
  const skala = Math.min(1, 900 / Math.max(bild.naturalWidth, bild.naturalHeight, 1));
  const tuch = document.createElement('canvas');
  tuch.width = Math.round(bild.naturalWidth * skala);
  tuch.height = Math.round(bild.naturalHeight * skala);
  const stift = tuch.getContext('2d');
  if (!stift) return quelle;
  stift.drawImage(bild, 0, 0, tuch.width, tuch.height);
  return tuch.toDataURL('image/jpeg', 0.82);
}
