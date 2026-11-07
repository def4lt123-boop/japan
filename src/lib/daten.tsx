'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { aendern, laden, loeschen, online as dbOnline, speichern, type TabellenName } from './supabase';
import { plural, uid } from './format';
import { heuteIso } from './dates';
import type { Einstellungen, Eintrag, Reise, Schnappschuss } from './types';

/**
 * Der eine Ort, an dem Daten gelesen und geschrieben werden. Erst der eigene
 * Zustand (sofort sichtbar), dann die Datenbank; schlägt die fehl, bleibt die
 * Meldung oben stehen und der Stand auf dem Gerät gilt weiter.
 */

const DATEN_SCHLUESSEL = 'reiseplan.v1';
const EINSTELLUNGS_SCHLUESSEL = 'reiseplan.einstellungen.v1';

const LEER: Schnappschuss = { reisen: [], eintraege: [] };

const EINSTELLUNGS_LEER: Einstellungen = { name: null, waehrung: 'EUR', personen: 2, bilder: true, aktive_reise: null };

function lies<T>(schluessel: string, fallback: T): T {
  try {
    const rohw = typeof window === 'undefined' ? null : window.localStorage.getItem(schluessel);
    return rohw ? ({ ...fallback, ...(JSON.parse(rohw) as object) } as T) : fallback;
  } catch {
    return fallback;
  }
}

function schreibeLokal(schluessel: string, wert: unknown) {
  try {
    window.localStorage.setItem(schluessel, JSON.stringify(wert));
  } catch {
    /* Speicher voll oder privat – die App läuft trotzdem weiter */
  }
}

export interface StoreWert {
  bereit: boolean;
  modus: 'online' | 'geraet';
  meldung: string | null;
  sagen: (text: string) => void;
  neuLaden: () => Promise<void>;
  reisen: Reise[];
  eintraege: Eintrag[];
  reise: (id: string) => Reise | undefined;
  eintraegeVon: (reiseId: string) => Eintrag[];
  reiseAnlegen: (werte: Partial<Reise>) => Promise<Reise>;
  reiseAendern: (id: string, patch: Partial<Reise>) => Promise<void>;
  reiseLoeschen: (id: string) => Promise<void>;
  eintragAnlegen: (werte: Partial<Eintrag> & { reise_id: string; titel: string }) => Promise<Eintrag>;
  eintragAendern: (id: string, patch: Partial<Eintrag>) => Promise<void>;
  eintragLoeschen: (id: string) => Promise<void>;
  eintraegeRueckwaerts: (änderungen: { id: string; patch: Partial<Eintrag> }[]) => Promise<void>;
  einstellungen: Einstellungen;
  einstellen: (patch: Partial<Einstellungen>) => void;
  aktiveReise: Reise | null;
  aktivSetzen: (id: string | null) => void;
  allesLoeschen: () => Promise<void>;
  importieren: (daten: unknown) => Promise<string>;
}

const Ctx = createContext<StoreWert | null>(null);

export function useStore(): StoreWert {
  const wert = useContext(Ctx);
  if (!wert) throw new Error('useStore braucht <DatenProvider> als Eltern');
  return wert;
}

export function useReise(id: string | null | undefined): Reise | undefined {
  const store = useStore();
  return useMemo(() => store.reisen.find((r) => r.id === id), [store.reisen, id]);
}

export function DatenProvider({ children }: { children: React.ReactNode }) {
  const [daten, setDaten] = useState<Schnappschuss>(LEER);
  const { reisen, eintraege } = daten;
  const [bereit, setBereit] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [einstellungen, setEinstellungen] = useState<Einstellungen>(EINSTELLUNGS_LEER);
  const warner = useRef<number | null>(null);

  const sagen = useCallback((text: string) => {
    setMeldung(text);
    if (warner.current) window.clearTimeout(warner.current);
    warner.current = window.setTimeout(() => setMeldung(null), 2800);
  }, []);

  useEffect(() => {
    setEinstellungen(lies(EINSTELLUNGS_SCHLUESSEL, EINSTELLUNGS_LEER));
    const vorher = lies<Schnappschuss>(DATEN_SCHLUESSEL, LEER);
    if (vorher.reisen?.length) setDaten({ reisen: vorher.reisen, eintraege: vorher.eintraege ?? [] });
    if (!dbOnline) {
      setBereit(true);
      return;
    }
    let abbruch = false;
    void (async () => {
      try {
        const [reisen, eintraege] = await Promise.all([laden<Reise>('reisen'), laden<Eintrag>('eintraege')]);
        if (abbruch) return;
        const neu = { reisen, eintraege };
        setDaten(neu);
        schreibeLokal(DATEN_SCHLUESSEL, neu);
      } catch (fehler) {
        sagen(`Online nicht erreicht – weiter mit dem Stand auf diesem Gerät. ${(fehler as Error).message}`);
      } finally {
        if (!abbruch) setBereit(true);
      }
    })();
    return () => {
      abbruch = true;
    };
  }, [sagen]);

  useEffect(() => {
    if (bereit) schreibeLokal(DATEN_SCHLUESSEL, daten);
  }, [daten, bereit]);

  useEffect(() => {
    schreibeLokal(EINSTELLUNGS_SCHLUESSEL, einstellungen);
  }, [einstellungen]);

  const taetigen = useCallback(async (tabelle: TabellenName, aktion: 'speichern' | 'aendern' | 'loeschen', payload: unknown, id?: string) => {
    if (!dbOnline) return;
    try {
      if (aktion === 'speichern') await speichern(tabelle, payload as { id: string });
      else if (aktion === 'aendern') await aendern(tabelle, id!, payload as Record<string, unknown>);
      else await loeschen(tabelle, id!);
    } catch (fehler) {
      sagen(`${(fehler as Error).message} – auf diesem Gerät gespeichert.`);
    }
  }, [sagen]);

  const reiseAnlegen = useCallback(
    async (werte: Partial<Reise>) => {
      const reise: Reise = {
        id: uid('r'),
        name: 'Neue Reise',
        land: null,
        stationen: null,
        start_date: heuteIso(),
        end_date: null,
        cover_url: null,
        cover_credit: null,
        beschreibung: null,
        budget: null,
        waehrung: einstellungen.waehrung,
        personen: einstellungen.personen,
        archived: false,
        ...werte,
      };
      reise.end_date = reise.end_date ?? (reise.start_date ? addWoche(reise.start_date!) : null);
      setDaten((vorher) => ({ ...vorher, reisen: [reise, ...vorher.reisen] }));
      setEinstellungen((v) => ({ ...v, aktive_reise: reise.id }));
      await taetigen('reisen', 'speichern', reise);
      return reise;
    },
    [einstellungen, taetigen],
  );

  const reiseAendern = useCallback(
    async (id: string, patch: Partial<Reise>) => {
      setDaten((vorher) => ({ ...vorher, reisen: vorher.reisen.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
      await taetigen('reisen', 'aendern', patch, id);
    },
    [taetigen],
  );

  const reiseLoeschen = useCallback(
    async (id: string) => {
      const brocken = daten.eintraege.filter((e) => e.reise_id === id);
      setDaten((vorher) => ({ reisen: vorher.reisen.filter((r) => r.id !== id), eintraege: vorher.eintraege.filter((e) => e.reise_id !== id) }));
      setEinstellungen((v) => (v.aktive_reise === id ? { ...v, aktive_reise: null } : v));
      await Promise.all([taetigen('reisen', 'loeschen', null, id), ...brocken.map((e) => taetigen('eintraege', 'loeschen', null, e.id))]);
      sagen('Reise gelöscht.');
    },
    [daten.eintraege, sagen, taetigen],
  );

  const eintragAnlegen = useCallback(
    async (werte: Partial<Eintrag> & { reise_id: string; titel: string }) => {
      const liste = daten.eintraege.filter((e) => e.reise_id === werte.reise_id && e.art !== 'unterkunft' && e.date === (werte.date ?? null));
      const eintrag: Eintrag = {
        id: uid('e'),
        art: 'aktivitaet',
        kategorie: null,
        date: null,
        zeit: null,
        bis_zeit: null,
        dauer_min: null,
        bis_date: null,
        ort: null,
        adresse: null,
        lat: null,
        lng: null,
        karten_stichwort: null,
        notiz: null,
        preis: null,
        waehrung: null,
        buchung_nr: null,
        buchung_url: null,
        foto_url: null,
        foto_nachweis: null,
        sortierung: liste.reduce((m, e) => Math.max(m, e.sortierung), 0) + 1,
        ...werte,
      };
      setDaten((vorher) => ({ ...vorher, eintraege: [...vorher.eintraege, { ...eintrag, titel: werte.titel }] }));
      await taetigen('eintraege', 'speichern', eintrag);
      return { ...eintrag, titel: werte.titel };
    },
    [daten.eintraege, taetigen],
  );

  const eintragAendern = useCallback(
    async (id: string, patch: Partial<Eintrag>) => {
      setDaten((vorher) => ({ ...vorher, eintraege: vorher.eintraege.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
      await taetigen('eintraege', 'aendern', patch, id);
    },
    [taetigen],
  );

  const eintragLoeschen = useCallback(
    async (id: string) => {
      setDaten((vorher) => ({ ...vorher, eintraege: vorher.eintraege.filter((e) => e.id !== id) }));
      await taetigen('eintraege', 'loeschen', null, id);
      sagen('Eintrag gelöscht.');
    },
    [sagen, taetigen],
  );

  const eintraegeRueckwaerts = useCallback(
    async (änderungen: { id: string; patch: Partial<Eintrag> }[]) => {
      if (!änderungen.length) return;
      setDaten((vorher) => {
        const treffer = new Map(änderungen.map((a) => [a.id, a.patch]));
        return { ...vorher, eintraege: vorher.eintraege.map((e) => (treffer.has(e.id) ? { ...e, ...treffer.get(e.id) } : e)) };
      });
      await Promise.all(änderungen.map((a) => taetigen('eintraege', 'aendern', a.patch, a.id)));
    },
    [taetigen],
  );

  const stellen = useCallback((patch: Partial<Einstellungen>) => setEinstellungen((v) => ({ ...v, ...patch })), []);

  const allesLoeschen = useCallback(async () => {
    if (dbOnline) await Promise.all([...daten.reisen.map((r) => taetigen('reisen', 'loeschen', null, r.id)), ...daten.eintraege.map((e) => taetigen('eintraege', 'loeschen', null, e.id))]);
    setDaten(LEER);
    schreibeLokal(DATEN_SCHLUESSEL, LEER);
    sagen('Alles gelöscht – die App ist wieder leer.');
  }, [daten.eintraege, daten.reisen, sagen, taetigen]);

  const importieren = useCallback(
    async (rohw: unknown) => {
      const paket = rohw as Partial<Schnappschuss>;
      if (!paket || !Array.isArray(paket.reisen)) return 'Das ist keine Reisendatei.';
      const reisen = paket.reisen.filter((r) => r && typeof r.id === 'string') as Reise[];
      const eintraege = (Array.isArray(paket.eintraege) ? paket.eintraege : []).filter((e) => e && typeof e.id === 'string') as Eintrag[];
      setDaten({ reisen, eintraege });
      for (const r of reisen) await taetigen('reisen', 'speichern', r);
      for (const e of eintraege) await taetigen('eintraege', 'speichern', e);
      return `${plural(reisen.length, 'Reise', 'Reisen')} und ${plural(eintraege.length, 'Eintrag', 'Einträge')} geladen.`;
    },
    [sagen, taetigen],
  );

  const aktivSetzen = useCallback((id: string | null) => setEinstellungen((v) => ({ ...v, aktive_reise: id })), []);

  const wert = useMemo<StoreWert>(
    () => ({
      bereit,
      modus: dbOnline ? 'online' : 'geraet',
      meldung,
      sagen,
      neuLaden: async () => {
        if (!dbOnline) return;
        const [reisen, eintraege] = await Promise.all([laden<Reise>('reisen'), laden<Eintrag>('eintraege')]);
        setDaten({ reisen, eintraege });
      },
      reisen,
      eintraege,
      reise: (id) => reisen.find((r) => r.id === id),
      eintraegeVon: (reiseId) => eintraege.filter((e) => e.reise_id === reiseId),
      reiseAnlegen,
      reiseAendern,
      reiseLoeschen,
      eintragAnlegen,
      eintragAendern,
      eintragLoeschen,
      eintraegeRueckwaerts,
      einstellungen,
      einstellen: stellen,
      aktiveReise: reisen.find((r) => r.id === einstellungen.aktive_reise) ?? null,
      aktivSetzen,
      allesLoeschen,
      importieren,
    }),
    [bereit, eintraege, eintragAendern, eintragAnlegen, eintragLoeschen, eintraegeRueckwaerts, einstellungen, reisen, reiseAendern, reiseAnlegen, reiseLoeschen, sagen, stellen, aktivSetzen, allesLoeschen, importieren, meldung],
  );

  return <Ctx.Provider value={wert}>{children}</Ctx.Provider>;
}

const addWoche = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const zeit = Date.UTC(y, m - 1, d) + 6 * 86_400_000;
  const neu = new Date(zeit);
  return `${neu.getUTCFullYear()}-${String(neu.getUTCMonth() + 1).padStart(2, '0')}-${String(neu.getUTCDate()).padStart(2, '0')}`;
};
