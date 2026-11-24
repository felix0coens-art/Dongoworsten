import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mailKlant, mailWinkel } from '../src/lib/mail.js';

const b = { id: 7, nummer: 'DW-2026-0007', naam: 'An <script>Peeters', email: 'an@voorbeeld.be', telefoon: '0470 12 34 56', levering: 'leveren',
  adres_straat: 'Kerkstraat 1', adres_postcode: '9000', adres_gemeente: 'Gent', opmerking: 'Bel <b>aan</b>', subtotaal_cent: 1440, leverkost_cent: 650, totaal_cent: 2090, notitie: '' };
const regels = [{ naam: 'Boerenworst', eenheid: 'Pak van 4', prijs_cent: 720, aantal: 2 }];
const inst = { bedrijf: { handelsnaam: 'Dongo Worsten', naam: 'Coens, Victor', ondernemingsnummer: '1042.302.513', email: 'dongo@dongoworsten.be' }, levering: {} };

test('bevestiging klant: bedragen, adres en geen herroepingsrecht', () => {
  const m = mailKlant(b, regels, inst, 'https://dongoworsten.be');
  assert.equal(m.onderwerp, 'Bedankt voor je bestelling DW-2026-0007');
  assert.match(m.html, /€ 14,40/); assert.match(m.html, /€ 6,50/); assert.match(m.html, /€ 20,90/);
  assert.match(m.html, /Kerkstraat 1/);
  assert.match(m.html, /geen herroepingsrecht/);
  assert.match(m.tekst, /Totaal \(incl\. btw\): € 20,90/);
});

test('tekst van de klant wordt ge-escaped', () => {
  const m = mailKlant(b, regels, inst, 'https://dongoworsten.be');
  assert.ok(!m.html.includes('<script>'));
  const w = mailWinkel(b, regels, 'https://dongoworsten.be');
  assert.ok(!w.html.includes('<script>') && !w.html.includes('<b>aan</b>'));
  assert.match(w.html, /Bel &lt;b&gt;aan&lt;\/b&gt;/);
});

test('melding winkel: klantgegevens en link naar het beheer', () => {
  const w = mailWinkel(b, regels, 'https://dongoworsten.be');
  assert.match(w.onderwerp, /Nieuwe bestelling DW-2026-0007/);
  assert.match(w.html, /0470 12 34 56/);
  assert.match(w.html, /https:\/\/dongoworsten\.be\/beheer\/#bestelling\/7/);
});

test('afhalen: geen leveradres, wel het afhaaladres', () => {
  const m = mailKlant({ ...b, levering: 'afhalen', leverkost_cent: 0, totaal_cent: 1440 }, regels,
    { ...inst, levering: { afhaal_adres: 'Dorpstraat 5, Gent' } }, 'https://dongoworsten.be');
  assert.match(m.html, /Dorpstraat 5, Gent/);
  assert.ok(!m.html.includes('Kerkstraat'));
  assert.match(m.html, /afhaalmoment/);
});
