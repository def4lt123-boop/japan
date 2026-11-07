'use client';

import { useMemo, useState } from 'react';
import { useStore } from '../../lib/daten';
import { exportiere, liesDatei } from '../../lib/datei';
import { geld, plural, sauber } from '../../lib/format';
import { abstandTage } from '../../lib/dates';
import { Ablage, Chip, Hinweis, Karten, KartenKopf, Knopf, SeitenKopf, TextFeld, Umschalter, ZahlFeld } from '../../components/ui';

/** Profil: wie die App spricht, was sie vorausfüllt, und wohin die Daten gehören. */
export default function Profil() {
  const store = useStore();
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
  }, [store.eintraege, store.reisen, store]);

  return (
    <main className="seite pb-6">
      <SeitenKopf titel="Profil" untertitel="Kein Konto, kein Passwort – die Reise gehört dem Gerät und dem Datenbestand darunter." />

      <div className="space-y-3">
        <Karten>
          <KartenKopf titel="Angereden werden" untertitel="Nur für die Begrüßung – sonst nichts" />
          <div className="space-y-3 p-3">
            <TextFeld label="Vorname" wert={store.einstellungen.name ?? ''} beimAendern={(t) => store.einstellen({ name: sauber(t) || null })} platzhalter="Alex" />
            <div className="grid grid-cols-2 gap-3">
              <div className="feld">
                <label className="label" htmlFor="waehrung">
                  Währung
                </label>
                <input
                  id="waehrung"
                  className="eingabe"
                  value={store.einstellungen.waehrung}
                  maxLength={3}
                  onChange={(e) => store.einstellen({ waehrung: e.target.value.toUpperCase().replace(/[^A-Z]/g, '') || 'EUR' })}
                />
              </div>
              <ZahlFeld label="Personen pro Reise" wert={store.einstellungen.personen} beimAendern={(n) => store.einstellen({ personen: Math.max(1, Math.round(n ?? 1)) })} />
            </div>
            <Umschalter
              an={store.einstellungen.bilder}
              beimUmschalten={(an) => store.einstellen({ bilder: an })}
              label="Bild automatisch suchen"
              hinweis="Beim Anlegen eines Ortes gleich das passende Foto mitnehmen."
            />
          </div>
        </Karten>

        <Karten>
          <KartenKopf titel="Was bisher geplant ist" />
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-b-xl bg-[var(--rand)] sm:grid-cols-4">
            {[
              { zahl: store.reisen.length, eins: 'Reise', viele: 'Reisen' },
              { zahl: zahl.aktivitaeten, eins: 'Aktivität', viele: 'Aktivitäten' },
              { zahl: zahl.betten, eins: 'Unterkunft', viele: 'Unterkünfte' },
              { zahl: zahl.naechte, eins: 'Nacht', viele: 'Nächte' },
            ].map((k) => (
              <div key={k.eins} className="bg-[var(--karte)] px-3 py-2.5">
                <p className="text-[19px] font-semibold tabular-nums leading-tight">{k.zahl}</p>
                <p className="mikro">{plural(k.zahl, k.eins, k.viele)}</p>
              </div>
            ))}
          </div>
          <p className="mikro px-3 py-2.5">
            {zahl.fahrten ? `${plural(zahl.fahrten, 'Fahrt', 'Fahrten')} notiert · ` : ''}
            Summe der Preise: {geld(zahl.ausgaben, store.einstellungen.waehrung)}
          </p>
        </Karten>

        <Karten>
          <KartenKopf
            titel="Wohin die Daten gehen"
            seitlich={<Chip ton={store.modus === 'online' ? 'gut' : undefined}>{store.modus === 'online' ? 'im Datenspeicher verbunden' : 'auf diesem Gerät'}</Chip>}
          />
          <div className="space-y-2 p-3">
            <p className="text-[14px] leading-relaxed text-[var(--text2)]">
              {store.modus === 'online'
                ? 'Alle Reisen liegen in einem gemeinsamen Datenbestand. Ohne Anmeldung kann jede Person, die die Adresse der App kennt, sehen und ändern – praktisch für die Familie, bitte im Kopf behalten.'
                : 'Solange kein Datenbestand angebunden ist, bleibt alles auf diesem Gerät: Reisen, Einträge und Bilder. Auf einem anderen Handy startest du leer.'}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
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
                    const meldung = await store.importieren(paket);
                    setDateiText(meldung);
                  }}
                />
              </label>
              <Knopf ton="gefahr" onClick={() => setSperre(true)}>
                alles löschen
              </Knopf>
            </div>
            {dateiText ? <p className="mikro">{dateiText}</p> : null}
          </div>
        </Karten>

        <Hinweis>
          Reicht dir die Planung so? Unterwegs hilft der Tag mit den Punkten in der Reihenfolge – Änderungen wirken sofort, es gibt nichts zu speichern.
        </Hinweis>
      </div>

      <Ablage offen={sperre} titel="Wirklich alles löschen?" schliessen={() => setSperre(false)} fuss={
        <>
          <Knopf ton="dezent" onClick={() => setSperre(false)}>
            abbrechen
          </Knopf>
          <Knopf
            ton="gefahr"
            onClick={async () => {
              setSperre(false);
              await store.allesLoeschen();
            }}
          >
            unwiderruflich löschen
          </Knopf>
        </>
      }>
        <p className="py-3 text-[14.5px] leading-relaxed text-[var(--text2)]">
          Das entfernt {plural(store.reisen.length, 'Reise', 'Reisen')} und {plural(store.eintraege.length, 'Eintrag', 'Einträge')} aus diesem Datenbestand. Ein Backup in einer Datei ist eine Zeile weiter oben.
        </p>
      </Ablage>
    </main>
  );
}
