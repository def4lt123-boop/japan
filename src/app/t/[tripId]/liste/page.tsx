'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '../../../../lib/daten';
import { tagKurz } from '../../../../lib/dates';
import { ohneTagEintraege, reiseTage, stadtDesTages, tagEintraege } from '../../../../lib/plan';
import { ANDERE_KATEGORIEN, kategorie } from '../../../../lib/kategorien';
import { EintragZeile } from '../../../../components/EintragZeile';
import { EintragFormular } from '../../../../components/EintragFormular';
import { MehrfachFormular } from '../../../../components/MehrfachFormular';
import { OhneTagGruppen } from '../../../../components/OhneTagGruppen';
import { Chip, Karten, KartenKopf, Segment, TextFeld, cx } from '../../../../components/ui';
import type { Eintrag, EintragArt } from '../../../../lib/types';

/** Alle Orte der Reise an einer Stelle: suchen, filtern, einem Tag geben. */
export default function OrtsListe() {
  const params = useParams<{ tripId: string }>();
  const store = useStore();
  const reise = store.reisen.find((r) => r.id === params.tripId);
  const [suche, setSuche] = useState('');
  const [filter, setFilter] = useState<string | null>(null);
  const [ansicht, setAnsicht] = useState('tage');
  const [formular, setFormular] = useState<{ art: EintragArt; bestehend?: Eintrag | null; datum?: string | null } | null>(null);
  const [sammeln, setSammeln] = useState(false);

  const alle = useMemo(() => (reise ? store.eintraegeVon(reise.id).filter((e) => e.art !== 'unterkunft') : []), [reise, store]);
  const kategorien = useMemo(() => {
    const vorhanden = new Map<string, number>();
    for (const e of alle) {
      const k = kategorie(e.kategorie).id;
      vorhanden.set(k, (vorhanden.get(k) ?? 0) + 1);
    }
    return ANDERE_KATEGORIEN.filter((k) => vorhanden.has(k.id)).map((k) => ({ ...k, zahl: vorhanden.get(k.id)! }));
  }, [alle]);

  const gefiltert = useMemo(() => {
    const text = suche.trim().toLowerCase();
    return alle.filter((e) => {
      if (filter === 'ohne Tag' ? e.date !== null : filter ? e.kategorie && kategorie(e.kategorie).id === filter : false) return false;
      if (!text) return true;
      return [e.titel, e.ort, e.adresse, e.notiz].filter(Boolean).join(' ').toLowerCase().includes(text);
    });
  }, [alle, filter, suche]);

  if (!store.bereit || !reise) return null;

  const tage = reiseTage(reise);
  const ohneTag = ohneTagEintraege(gefiltert);
  const nachTag = tage.map((d) => ({ datum: d, liste: tagEintraege(gefiltert, d) })).filter((g) => g.liste.length);

  return (
    <main className="pb-4">
      <div className="space-y-2">
        <TextFeld wert={suche} beimAendern={setSuche} platzhalter="Ort, Stadt oder Notiz suchen" />
        <Segment
          wert={ansicht}
          beimAendern={setAnsicht}
          optionen={[
            { id: 'tage', label: 'Nach Tag', zeichen: '🗓️' },
            { id: 'liste', label: 'Alle', zeichen: '📚' },
            { id: 'ohne', label: ohneTag.length ? `Ohne Tag (${ohneTag.length})` : 'Ohne Tag', zeichen: '🕓' },
          ]}
        />
        {kategorien.length > 1 ? (
          <div className="gelenk">
            <button type="button" onClick={() => setFilter(null)} className={cx('chip !py-1.5 !text-[13px]', !filter && 'chip-aktiv')} style={{ borderColor: 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}>
              alle
            </button>
            {kategorien.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setFilter(filter === k.id ? null : k.id)}
                className={cx('chip !py-1.5 !text-[13px]', filter === k.id && 'chip-aktiv')}
                style={{ borderColor: filter === k.id ? k.farbe : 'var(--rand)', borderWidth: 1, borderStyle: 'solid', background: filter === k.id ? k.farbe : undefined, color: filter === k.id ? '#fff' : undefined }}
              >
                <span aria-hidden>{k.icon}</span> {k.label} <span className="tabular-nums opacity-70">{k.zahl}</span>
              </button>
            ))}
            <button type="button" onClick={() => setFilter(filter === 'ohne Tag' ? null : 'ohne Tag')} className={cx('chip !py-1.5 !text-[13px]', filter === 'ohne Tag' && 'chip-aktiv')} style={{ borderColor: 'var(--rand)', borderWidth: 1, borderStyle: 'solid' }}>
              🕓 ohne Tag
            </button>
          </div>
        ) : null}
      </div>

      {ansicht === 'liste' || ansicht === 'ohne' ? (
        <Karten className="mt-2.5 overflow-hidden">
          {ansicht === 'ohne' ? (
            <KartenKopf
              titel="Ohne Tag"
              untertitel={`${ohneTag.length} ${ohneTag.length === 1 ? 'Punkt' : 'Punkte'} – darunter in gruppen beieinander`}
              seitlich={
                <button type="button" className="chip !py-1" onClick={() => setSammeln(true)}>
                  mehrere
                </button>
              }
            />
          ) : null}
          <ul className="liste list-none m-0 p-0">
            {(ansicht === 'ohne' ? ohneTag : gefiltert).map((e) => (
              <li key={e.id} className="border-b last:border-0" style={{ borderColor: 'var(--rand)' }}>
                <EintragZeile eintrag={e} reise={reise} kompakt bearbeiten={() => setFormular({ art: e.art, bestehend: e })} />
              </li>
            ))}
          </ul>
          {!(ansicht === 'ohne' ? ohneTag : gefiltert).length ? <OhneTreffler suchwort={suche} /> : null}
        </Karten>
      ) : (
        <div className="mt-2.5 space-y-2.5">
          {nachTag.map((g) => (
            <Karten key={g.datum} className="overflow-hidden">
              <KartenKopf
                titel={`${tagKurz(g.datum)} · ${stadtDesTages(alle, reise, g.datum) ?? 'ohne Ort'}`}
                untertitel={`Reisetag ${tage.indexOf(g.datum) + 1} · ${g.liste.length} ${g.liste.length === 1 ? 'Punkt' : 'Punkte'}`}
                seitlich={
                  <button type="button" className="chip !py-1" onClick={() => setFormular({ art: 'aktivitaet', datum: g.datum })}>
                    + Punkt
                  </button>
                }
              />
              <ul className="liste list-none m-0 p-0">
                {g.liste.map((e) => (
                  <li key={e.id} className="border-b last:border-0" style={{ borderColor: 'var(--rand)' }}>
                    <EintragZeile eintrag={e} reise={reise} kompakt bearbeiten={() => setFormular({ art: e.art, bestehend: e })} />
                  </li>
                ))}
              </ul>
            </Karten>
          ))}
          {ohneTag.length ? (
            <Karten className="overflow-hidden" >
              <KartenKopf
                titel="Ohne Tag"
                untertitel="schon notiert, noch keinem Tag gegeben – darunter stehen sie in Gruppen beieinander"
                seitlich={
                  <span className="flex shrink-0 gap-1.5">
                    <button type="button" className="chip !py-1" onClick={() => setSammeln(true)}>
                      mehrere
                    </button>
                    <button type="button" className="chip !py-1" onClick={() => setFormular({ art: 'aktivitaet' })}>
                      + Punkt
                    </button>
                  </span>
                }
              />
              <ul className="liste list-none m-0 p-0">
                {ohneTag.map((e) => (
                  <li key={e.id} className="border-b last:border-0" style={{ borderColor: 'var(--rand)' }}>
                    <EintragZeile eintrag={e} reise={reise} kompakt bearbeiten={() => setFormular({ art: e.art, bestehend: e })} />
                  </li>
                ))}
              </ul>
            </Karten>
          ) : null}
          {!nachTag.length && !ohneTag.length ? (
            <Karten>
              <OhneTreffler suchwort={suche} />
            </Karten>
          ) : null}
        </div>
      )}

      {ansicht !== 'liste' && ohneTag.length ? <OhneTagGruppen reise={reise} /> : null}

      <button type="button" className="fab md:hidden" onClick={() => setFormular({ art: 'aktivitaet' })}>
        <span aria-hidden className="text-[19px] leading-none">+</span> Ort
      </button>

      {sammeln && reise ? <MehrfachFormular reise={reise} offen schliessen={() => setSammeln(false)} /> : null}

      {formular && reise ? (
        <EintragFormular reise={reise} art={formular.art ?? 'aktivitaet'} bestehend={formular.bestehend} datum={formular.bestehend?.date ?? formular.datum ?? null} offen schliessen={() => setFormular(null)} />
      ) : null}
    </main>
  );
}

function OhneTreffler({ suchwort }: { suchwort: string }) {
  return (
    <div className="p-4 text-center">
      <p className="mikro">{suchwort ? `Kein Ort passt zu „${suchwort}“.` : 'Noch keine Orte.'}</p>
      <p className="mikro mt-1">Unten auf + tippen – ein Name genügt, der Tag kommt später, wenn du ihn weißt.</p>
    </div>
  );
}
