'use client';

import { useEffect, useMemo, useState } from 'react';
import { tagKurz } from '../lib/dates';
import { reiseTage } from '../lib/plan';
import { ANDERE_KATEGORIEN, kategorie, kategorieVorschlag, artMeta } from '../lib/kategorien';
import { kartenVorschau } from '../lib/karten';
import { stadtAusAdresse } from '../lib/orte';
import { punktFuer, suchkandidaten, type Punktquelle } from '../lib/punktfindung';
import { geld } from '../lib/format';
import { useStore } from '../lib/daten';
import type { Eintrag, EintragArt, Reise } from '../lib/types';
import { istKartenText, punktAusLink, type Kartenpunkt } from '../lib/kartenlink';
import { Ablage, Auswahl, Chip, Feld, Foto, IconKnopf, Karten, TextFeld, Umschalter, ZahlFeld, ZeitFeld, cx } from './ui';
import { WAEHRUNGEN } from '../lib/format';
import { OrtSuche, type Gewaehlt } from './OrtSuche';
import { PunktFeld } from './PunktFeld';
import { bildFragen, bildFuer } from '../lib/ortsbild';

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

/**
 * Der leere Entwurf. Ein Tag wird nur vorgemerkt, wo einer gemeint ist: beim Aufruf
 * aus einem Tag, aus dem Kalender, von einer Tagkarte – oder an einem Bett, das ohne
 * Nacht keinen Sinn ergibt. Eine Aktivität darf ohne Tag bleiben und wartet in der
 * Liste auf „Ohne Tag", bis sie einen Tag bekommt.
 */
const leer = (vor: Partial<Eintrag> | null | undefined, reise: Reise, datum: string | null | undefined, art: EintragArt = 'aktivitaet'): Entwurf => ({
  titel: vor?.titel ?? '',
  kategorie: vor?.kategorie ?? '',
  date: vor?.date ?? datum ?? (art === 'unterkunft' ? reise.start_date ?? '' : ''),
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
  const [entwurf, setEntwurf] = useState<Entwurf>(() => leer(bestehend ?? vorlage, reise, datum, art));
  // an einer Unterkunft sind Adresse, Buchung und Notiz Kernangaben – das Fach bleibt dort offen
  const [mehr, setMehr] = useState(() => Boolean(bestehend?.notiz || bestehend?.buchung_url || bestehend?.buchung_nr) || art === 'unterkunft');
  const [bildLaeuft, setBildLaeuft] = useState(false);
  const [bildlos, setBildlos] = useState(false);

  useEffect(() => {
    if (!offen) return;
    setEntwurf(leer(bestehend ?? vorlage, reise, datum, art));
    setBildLaeuft(false);
    setBildlos(false);
  }, [offen, bestehend, vorlage, reise, datum]);

  const tage = useMemo(() => reiseTage(reise), [reise]);
  // gesucht wird dort, wo gerade geplant wird: bei den Punkten dieses Tages, sonst bei
  // denen der ganzen Reise – nicht beim allerersten Eintrag, der in einer anderen Stadt liegen kann
  const mittelpunkt = useMemo(() => {
    const mitPunkt = store.eintraegeVon(reise.id).filter((e) => e.id !== bestehend?.id && typeof e.lat === 'number' && typeof e.lng === 'number');
    const amTag = entwurf.date ? mitPunkt.filter((e) => e.date === entwurf.date) : [];
    const grundlage = amTag.length ? amTag : mitPunkt;
    if (!grundlage.length) return null;
    const mitte = (feld: 'lat' | 'lng') => grundlage.reduce((summe, e) => summe + (e[feld] as number), 0) / grundlage.length;
    return { lat: mitte('lat'), lng: mitte('lng') };
  }, [store, reise.id, entwurf.date, bestehend?.id]);
  const metadaten = artMeta(art);
  const istBett = art === 'unterkunft';
  const set = (patch: Partial<Entwurf>) => setEntwurf((v) => ({ ...v, ...patch }));

  const uebernehmen = (v: Gewaehlt) => {
    const orte = entwurf.ort || stadtAusAdresse(v.adresse, reise.land) || '';
    set({
      titel: v.titel,
      adresse: v.adresse ?? '',
      lat: v.lat,
      lng: v.lng,
      karten_stichwort: v.stichwort,
      ort: orte,
      kategorie: entwurf.kategorie || (art === 'unterkunft' ? 'unterschlupf' : kategorieVorschlag(v.titel, v.adresse ?? '')),
    });
    // hat Google das Foto des Ortes gleich mitgebracht, ist es das richtige – sonst folgt das
    // Bild demselben weg wie an der reihe, mit dem namen, was gerade übernommen ist
    if (store.einstellungen.bilder && !entwurf.foto_url) {
      if (v.foto) set({ foto_url: v.foto.url, foto_nachweis: v.foto.nachweis });
      else void bildeins({ titel: v.titel, adresse: v.adresse, ort: orte });
    }
  };

  /**
   * Der punkt aus einem hereinkopierten Google-Maps-link: die suche hat ihn nicht
   * gefunden, jetzt kommt er von woanders her. der name aus dem link geht als
   * stichwort mit, ein link allein wird kein titel – wer in die suche klebt, hat
   * keinen namen gemeint, und den punkt hat die zeile dann trotzdem.
   */
  const ausDemLink = (punkt: Kartenpunkt) => {
    const geklebt = istKartenText(entwurf.titel);
    const titel = geklebt ? (punkt.name ?? '') : entwurf.titel;
    set({ titel, lat: punkt.lat, lng: punkt.lng, ...(punkt.name ? { karten_stichwort: punkt.name } : {}) });
    store.sagen(`Punkt aus dem ${punkt.quelle}-Link übernommen.`);
    if (store.einstellungen.bilder && !entwurf.foto_url) void bildeins({ titel: titel || punkt.name || '', ort: entwurf.ort, adresse: entwurf.adresse });
  };

  /** derselbe weg für den link, der in die suche geraten ist – auch der kurze */
  const ausDerSuche = async (link: string) => {
    const { punkt, grund } = await punktAusLink(link);
    if (!punkt) {
      store.sagen(
        grund === 'zu kurz'
          ? 'Der kurze Link ließ sich nicht auflösen – in Google Maps den Ort antippen und die Adresszeile einfügen.'
          : 'In diesem Link steht kein Punkt.'
      );
      return;
    }
    ausDemLink(punkt);
  };

  /**
   * Gefragt wird die staffel (name, name und ort, die reise), nie ein langer
   * adresssatz: „big ben, Westminster, London, England" malt nirgends ein bild,
   * „big ben" malt den turm. `frisch` wirft das gedächtnis weg.
   */
  async function bildeins(vorlage?: { titel?: string | null; ort?: string | null; adresse?: string | null }, frisch = false) {
    const grundlage = vorlage ?? entwurf;
    if ((grundlage.titel ?? '').trim().length < 3) {
      setBildlos(true);
      return;
    }
    setBildLaeuft(true);
    setBildlos(false);
    try {
      const bild = await bildFuer(grundlage, { stationen: reise.stationen, land: reise.land }, { frisch });
      if (bild) set({ foto_url: bild.url, foto_nachweis: bild.nachweis });
      else setBildlos(true);
    } finally {
      setBildLaeuft(false);
    }
  }

  /** die erste frage der staffel – sie steht auch in den links, wenn nichts zu finden war */
  const bildfrage = bildFragen(entwurf, { stationen: reise.stationen, land: reise.land })[0] ?? entwurf.titel.trim();

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
      store.sagen('Keinen passenden Punkt gefunden – den Google-Maps-Link beim Punkt einfügen.');
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
    store.sagen(werte.date ? `${metadaten.wort} gespeichert.` : `${metadaten.wort} gespeichert – ohne Tag.`);
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
          beimKartenLink={(link) => void ausDerSuche(link)}
          hinweis="Einen Vorschlag antippen oder Enter drücken – Name, Adresse, Punkt und Bild wandern automatisch hinein. Ein Link aus Google Maps wird zum Punkt, nicht zum Suchwort."
        />

        <PunktFeld lat={entwurf.lat} lng={entwurf.lng} beimSetzen={(werte) => set(werte)} beimUebernehmen={ausDemLink} />

        <div>
          <p className="label mb-1">{istBett ? 'Nächte' : 'Tag'}</p>
          <div className="gelenk">
            {istBett ? null : (
              <button
                type="button"
                onClick={() => set({ date: '' })}
                className={cx('chip !px-3 !py-2 !text-[13.5px]', !entwurf.date && 'chip-aktiv')}
                style={{ borderColor: !entwurf.date ? 'var(--akzent)' : 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}
              >
                🕓 ohne Tag
              </button>
            )}
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
            {!punkte.length && !istBett ? <span className="mikro self-center">die Reise hat keinen Zeitraum – ohne Tag geht trotzdem, einen Tag kannst du unten selbst setzen.</span> : null}
          </div>
          {!istBett && !entwurf.date ? <p className="mikro mt-1">ohne Tag genügt – der Punkt steht dann in der Liste unter „Ohne Tag", bis du ihn einem Tag gibst.</p> : null}
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
              <button type="button" className="knopf knopf-ghost knopf-klein" onClick={() => void bildeins()} disabled={bildLaeuft || entwurf.titel.trim().length < 3}>
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
          {!bildLaeuft && bildlos && !entwurf.foto_url ? (
            <div className="mikro mt-1 space-y-1.5">
              <p>
                Kein Bild gefunden –{' '}
                <a href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(bildfrage)}`} target="_blank" rel="noreferrer" className="font-medium">
                  in Google Bilder
                </a>{' '}
                oder{' '}
                <a href={`https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(bildfrage)}`} target="_blank" rel="noreferrer" className="font-medium">
                  in Wikimedia Commons
                </a>{' '}
                nachsehen und es über „eigenes“ herholen.
              </p>
              <button type="button" className="knopf knopf-ghost knopf-klein" onClick={() => void bildeins(entwurf, true)}>
                nochmal suchen
              </button>
            </div>
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
            <TextFeld label="Buchungs-Nr." wert={entwurf.buchung_nr} beimAendern={(t) => set({ buchung_nr: t })} platzhalter="z. B. 4K2L9" />
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
