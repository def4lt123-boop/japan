'use client';

import { useMemo, useState } from 'react';
import { useStore } from '../lib/daten';
import { abstandTage } from '../lib/dates';
import { exportiere, liesDatei } from '../lib/datei';
import { geld, plural, sauber } from '../lib/format';
import { Ablage, Chip, IconKnopf, KartenKopf, Knopf, TextFeld, Umschalter, ZahlFeld } from './ui';
import { StatusAnzeige } from './StatusAnzeige';

/**
 * Alles, was die App über die Person weiß, an einem Ort: wie sie angesprochen
 * wird, wie hell es ist, ob Bilder gesucht werden, und wohin die Daten gehen.
 * Vorher ein eigener Reiter im Dock – vier Entscheidungen sind aber keine
 * Seite, deshalb ist es ein Blatt geworden, das von dashboard und seitenleiste
 * aus aufgeht.
 */
export function Einstellungen({ variante = 'knopf' }: { variante?: 'knopf' | 'zeile' }) {
  const store = useStore();
  const [offen, setOffen] = useState(false);
  const [sperre, setSperre] = useState(false);
  const [dateiText, setDateiText] = useState<string | null>(null);

  const zahl = useMemo(() => {
    const aktivitaeten = store.eintraege.filter((e) => e.art === 'aktivitaet').length;
    const betten = store.eintraege.filter((e) => e.art === 'unterkunft').length;
    const fahrten = store.eintraege.filter((e) => e.art === 'fahrt').length;
    const ausgaben = store.eintraege.reduce((s, e) => s + (e.preis ?? 0), 0);
    const naechte = store.eintraege
      .filter((e) => e.art === 'unterkunft')
      .reduce((s, e) => s + Math.max(1, abstandTage(e.date ?? '', e.bis_date && e.bis_date > (e.date ?? '') ? e.bis_date : e.date ?? '')), 0);
    return { aktivitaeten, betten, fahrten, ausgaben, naechte };
  }, [store.eintraege, store]);

  const zu = () => {
    setSperre(false);
    setOffen(false);
  };

  return (
    <>
      {variante === 'knopf' ? (
        <IconKnopf titel="Einstellungen" onClick={() => setOffen(true)} className="!h-11 !w-11 rounded-xl border">
          ⚙️
        </IconKnopf>
      ) : (
        <button type="button" onClick={() => setOffen(true)} className="flex min-h-11 w-full items-center gap-2.5 rounded-xl px-3 text-left text-[15px] font-medium hover:bg-[var(--akzent-fläche)]" style={{ color: 'var(--text2)', background: 'transparent', border: 0, font: 'inherit' }}>
          <span aria-hidden>⚙️</span>
          Einstellungen
        </button>
      )}

      <Ablage
        offen={offen}
        titel={sperre ? 'Wirklich alles löschen?' : 'Einstellungen'}
        schliessen={zu}
        fuss={
          sperre ? (
            <>
              <Knopf ton="dezent" onClick={() => setSperre(false)}>
                zurück
              </Knopf>
              <Knopf
                ton="gefahr"
                onClick={async () => {
                  setSperre(false);
                  setOffen(false);
                  await store.allesLoeschen();
                }}
              >
                unwiderruflich löschen
              </Knopf>
            </>
          ) : (
            <Knopf onClick={zu}>fertig</Knopf>
          )
        }
      >
        {sperre ? (
          <p className="py-3 text-[14.5px] leading-relaxed text-[var(--text2)]">
            Das entfernt {plural(store.reisen.length, 'Reise', 'Reisen')} und {plural(store.eintraege.length, 'Eintrag', 'Einträge')} aus diesem Datenbestand. Ein Backup in einer Datei ist zwei Abschnitte weiter oben.
          </p>
        ) : (
          <div className="space-y-4 py-2">
            <section>
              <KartenKopf titel="Beim Planen" untertitel="Was die App von sich aus tut" />
              <div className="mt-2 space-y-3">
                <Umschalter
                  an={store.einstellungen.bilder}
                  beimUmschalten={(an) => store.einstellen({ bilder: an })}
                  label="Bild automatisch suchen"
                  hinweis="Hinter jeder Reihe und jedem Bett liegt das Bild des Ortes – leise, und ohne dass jemand danach fragen muss."
                />
                <div className="grid grid-cols-2 gap-3">
                  <TextFeld label="Angereden als" wert={store.einstellungen.name ?? ''} beimAendern={(t) => store.einstellen({ name: sauber(t) || null })} platzhalter="Alex" />
                  <ZahlFeld label="Personen" wert={store.einstellungen.personen} beimAendern={(n) => store.einstellen({ personen: Math.max(1, Math.round(n ?? 1)) })} />
                </div>
                <div className="feld">
                  <label className="label" htmlFor="einstellung-waehrung">
                    Währung
                  </label>
                  <input
                    id="einstellung-waehrung"
                    className="eingabe"
                    value={store.einstellungen.waehrung}
                    maxLength={3}
                    onChange={(e) => store.einstellen({ waehrung: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') || 'EUR' })}
                  />
                </div>
                <p className="mikro m-0">
                  {plural(store.reisen.length, 'Reise', 'Reisen')} · {plural(zahl.aktivitaeten, 'Aktivität', 'Aktivitäten')} · {plural(zahl.betten, 'Unterkunft', 'Unterkünfte')} · {plural(zahl.naechte, 'Nacht', 'Nächte')}
                  {zahl.fahrten ? ` · ${plural(zahl.fahrten, 'Fahrt', 'Fahrten')}` : ''} — Summe {geld(zahl.ausgaben, store.einstellungen.waehrung)}
                </p>
              </div>
            </section>

            <section>
              <KartenKopf titel="Wohin die Daten gehen" seitlich={<StatusAnzeige pruefen />} />
              <p className="mt-2 text-[14px] leading-relaxed text-[var(--text2)]">
                Kein Konto, kein Passwort: {store.modus === 'online' ? 'alles liegt in einem gemeinsamen Datenbestand, und jede Person mit der Adresse der App kann sehen und ändern.' : 'ohne angebundenen Datenbestand bleibt alles auf diesem Gerät – auf einem anderen Handy startest du leer.'}
              </p>
              {store.speicher.ms !== null ? <p className="mikro mt-1">Nachfrage in {store.speicher.ms} ms beantwortet.</p> : null}
              <div className="mt-2 flex flex-wrap gap-2">
                <Knopf
                  ton="ghost"
                  onClick={() => {
                    exportiere({ reisen: store.reisen, eintraege: store.eintraege }, 'meine-reisen');
                    store.sagen('Datei erzeugt.');
                  }}
                >
                  ⬇ als Datei sichern
                </Knopf>
                <label className="knopf knopf-ghost cursor-pointer">
                  ⬆ Datei laden
                  <input
                    type="file"
                    accept="application/json"
                    className="sr-only"
                    onChange={async (e) => {
                      const datei = e.target.files?.[0];
                      if (!datei) return;
                      const paket = await liesDatei(datei);
                      if (!paket) {
                        setDateiText('Diese Datei sehe ich nicht als Reisedatei.');
                        return;
                      }
                      setDateiText(await store.importieren(paket));
                    }}
                  />
                </label>
                <Knopf ton="gefahr" onClick={() => setSperre(true)}>
                  alles löschen
                </Knopf>
              </div>
              {dateiText ? <p className="mikro mt-1">{dateiText}</p> : null}
            </section>

            <p className="mikro m-0 flex flex-wrap items-center gap-x-1.5">
              <Chip>🌗 Automatisch folgt dem Gerät</Chip>
              <span>Änderungen wirken sofort, es gibt nichts zu speichern.</span>
            </p>
          </div>
        )}
      </Ablage>
    </>
  );
}
