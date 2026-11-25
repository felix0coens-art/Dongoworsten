import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitsBtw, normaliseerBtw, toonBtw, factuurPdf, facturenCsv } from '../src/lib/factuur.js';
import { controleerKlant } from '../src/lib/bestelling.js';
import { Ongeldig } from '../src/lib/http.js';

// Geldig nummer opbouwen: 8 cijfers + controle (97 - n mod 97).
const geldig = (acht) => { const c = 97 - (Number(acht) % 97); return `0${acht.slice(1)}${String(c).padStart(2, '0')}`.slice(-10); };

test('btw splitsen: maatstaf + btw = totaal, 6 %', () => {
  assert.deepEqual(splitsBtw(2090, 6), { maatstaf_cent: 1972, btw_cent: 118 });
  for (const t of [1, 99, 720, 5000, 123457]) { const s = splitsBtw(t, 6); assert.equal(s.maatstaf_cent + s.btw_cent, t); }
});

test('Belgisch btw-nummer: vormen en controlegetal', () => {
  assert.equal(normaliseerBtw('BE 1042.302.513'), 'BE1042302513');
  assert.equal(normaliseerBtw('be1042302513'), 'BE1042302513');
  assert.equal(normaliseerBtw('1042.302.513'), 'BE1042302513');
  assert.equal(normaliseerBtw('BE 1042.302.514'), null);   // fout controlegetal
  assert.equal(normaliseerBtw('BE 2042.302.513'), null);   // moet met 0 of 1 beginnen
  assert.equal(normaliseerBtw('NL123456789B01'), null);
  assert.equal(toonBtw('BE1042302513'), 'BE 1042.302.513');
});

test('bestellen als bedrijf: velden verplicht en btw gecontroleerd', () => {
  const basis = { naam: 'An Peeters', email: 'an@voorbeeld.be', telefoon: '0470 12 34 56', straat: 'Kerkstraat 1', postcode: '9000', gemeente: 'Gent', akkoord: true };
  assert.equal(controleerKlant(basis, 'leveren').bedrijf_naam, '');
  try { controleerKlant({ ...basis, bedrijf: true, bedrijf_btw: 'BE 1042.302.514' }, 'leveren'); assert.fail(); }
  catch (e) { assert.ok(e instanceof Ongeldig); assert.ok(e.velden.bedrijf_naam && e.velden.bedrijf_btw && e.velden.bedrijf_straat); }
  const k = controleerKlant({ ...basis, bedrijf: true, bedrijf_naam: 'Slagerij Peeters', bedrijf_btw: 'BE 1042.302.513', bedrijf_straat: 'Markt 2', bedrijf_postcode: '8000', bedrijf_gemeente: 'Brugge' }, 'leveren');
  assert.equal(k.bedrijf_btw, 'BE1042302513');
});

const factuur = (extra = {}) => ({
  nummer: 'W2026-0001', datum: '2026-11-25', maatstaf_cent: 1972, btw_cent: 118, totaal_cent: 2090, btw_procent: 6, b2b: 0, peppol_verstuurd: 0,
  gegevens: JSON.stringify({
    verkoper: { naam: 'Dongo Worsten', eigenaar: 'Coens, Victor', adres: 'Bruggesteenweg 14, 8340 Damme', btw: 'BE 1042.302.513', email: 'dongo@dongoworsten.be' },
    klant: { naam: 'An Peeters', adres: ['Kerkstraat 1', '9000 Gent'] }, bestelnummer: 'DW-2026-0001', betaald_op: '2026-11-25', levering: 'leveren',
    regels: [{ naam: 'Boerenworst met mosterdzaad — ± 480 g', eenheid: 'Pak van 4', aantal: 2, prijs_cent: 720, totaal_cent: 1440 }], leverkost_cent: 650, test: false,
  }),
  ...extra,
});

test('PDF wordt gemaakt, ook met speciale tekens', async () => {
  const pdf = await factuurPdf(factuur());
  assert.equal(String.fromCharCode(...pdf.slice(0, 5)), '%PDF-');
  assert.ok(pdf.length > 1000);
});

test('export: puntkomma, decimale komma en totaalregel', () => {
  const csv = facturenCsv([factuur(), factuur({ nummer: 'W2026-0002', b2b: 1, peppol_verstuurd: 1 })]);
  assert.ok(csv.startsWith('\uFEFF'), 'BOM voor Excel');
  const regels = csv.slice(1).trim().split('\r\n');
  assert.match(regels[0], /^Factuurnummer;Datum;/);
  assert.match(regels[1], /^W2026-0001;25\/11\/2026;DW-2026-0001;An Peeters;;nee;19,72;6;1,18;20,90;$/);
  assert.match(regels[2], /;ja;19,72;6;1,18;20,90;ja$/);
  assert.match(regels.at(-1), /^Totaal;;;;;;39,44;;2,36;41,80;$/);
});
