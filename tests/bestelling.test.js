import { test } from 'node:test';
import assert from 'node:assert/strict';
import { leesMandje, rekenMandje, controleerKlant, bestelnummer } from '../src/lib/bestelling.js';
import { Ongeldig } from '../src/lib/http.js';

const instelling = { leveren_aan: true, leverkost_cent: 650, gratis_vanaf_cent: 5000, minimum_cent: 0, postcodes: [], afhalen_aan: true, afhaal_adres: 'x' };
const producten = new Map([
  [1, { id: 1, naam: 'Boerenworst', eenheid: 'Pak van 4', prijs_cent: 720, voorraad: null, zichtbaar: true }],
  [2, { id: 2, naam: 'Merguez', eenheid: 'Pak van 6', prijs_cent: 690, voorraad: 2, zichtbaar: true }],
  [3, { id: 3, naam: 'Geheim', eenheid: '', prijs_cent: 100, voorraad: null, zichtbaar: false }],
]);
const velden = async (fn) => { try { await fn(); } catch (e) { assert.ok(e instanceof Ongeldig); return e.velden; } assert.fail('geen fout'); };

test('mandje: samenvoegen en rommel weigeren', async () => {
  assert.deepEqual(leesMandje([{ id: 1, aantal: 2 }, { id: 1, aantal: 1 }]), [{ id: 1, aantal: 3 }]);
  assert.ok((await velden(() => leesMandje([]))).mandje);
  assert.ok((await velden(() => leesMandje([{ id: 1, aantal: 0 }]))).mandje);
  assert.ok((await velden(() => leesMandje([{ id: '1', aantal: 1 }]))).mandje);
  assert.ok((await velden(() => leesMandje([{ id: 1, aantal: 1.5 }]))).mandje);
  assert.ok((await velden(() => leesMandje([{ id: 1, aantal: 51 }]))).mandje);
});

test('prijzen komen uit de database, niet uit de browser', () => {
  const r = rekenMandje({ regels: [{ id: 1, aantal: 2, prijs_cent: 1 }], producten, levering: 'leveren', instelling });
  assert.equal(r.subtotaal_cent, 1440);
  assert.equal(r.leverkost_cent, 650);
  assert.equal(r.totaal_cent, 2090);
});

test('gratis levering vanaf de drempel (grens inbegrepen)', () => {
  const r = rekenMandje({ regels: [{ id: 1, aantal: 7 }], producten, levering: 'leveren', instelling: { ...instelling, gratis_vanaf_cent: 5040 } });
  assert.equal(r.subtotaal_cent, 5040);
  assert.equal(r.leverkost_cent, 0);
  const nooit = rekenMandje({ regels: [{ id: 1, aantal: 50 }], producten, levering: 'leveren', instelling: { ...instelling, gratis_vanaf_cent: null } });
  assert.equal(nooit.leverkost_cent, 650);
});

test('afhalen is gratis', () => {
  const r = rekenMandje({ regels: [{ id: 1, aantal: 1 }], producten, levering: 'afhalen', instelling });
  assert.equal(r.leverkost_cent, 0);
  assert.equal(r.totaal_cent, 720);
});

test('verborgen product en te weinig voorraad geven een probleem', () => {
  const r = rekenMandje({ regels: [{ id: 3, aantal: 1 }, { id: 2, aantal: 3 }], producten, levering: 'leveren', instelling });
  assert.ok(r.problemen['regel-3']);
  assert.match(r.problemen['regel-2'], /nog maar 2/);
  assert.equal(r.regels.length, 1);
});

test('postcode buiten de zone en minimumbedrag', () => {
  const inst = { ...instelling, postcodes: ['9000'], minimum_cent: 2000 };
  const r = rekenMandje({ regels: [{ id: 1, aantal: 1 }], producten, levering: 'leveren', postcode: '1000', instelling: inst });
  assert.ok(r.problemen.postcode);
  assert.ok(r.problemen.minimum);
  const ok = rekenMandje({ regels: [{ id: 1, aantal: 3 }], producten, levering: 'leveren', postcode: '9000', instelling: inst });
  assert.deepEqual(ok.problemen, {});
});

test('leveren of afhalen uitgeschakeld', () => {
  assert.ok(rekenMandje({ regels: [{ id: 1, aantal: 1 }], producten, levering: 'leveren', instelling: { ...instelling, leveren_aan: false } }).problemen.levering);
  assert.ok(rekenMandje({ regels: [{ id: 1, aantal: 1 }], producten, levering: 'afhalen', instelling: { ...instelling, afhalen_aan: false } }).problemen.levering);
  assert.ok(rekenMandje({ regels: [{ id: 1, aantal: 1 }], producten, levering: 'per-duif', instelling }).problemen.levering);
});

test('klantgegevens', async () => {
  const goed = { naam: 'An Peeters', email: 'An@Voorbeeld.be', telefoon: '0470 12 34 56', straat: 'Kerkstraat 1', postcode: '9000', gemeente: 'Gent', akkoord: true };
  assert.equal(controleerKlant(goed, 'leveren').email, 'an@voorbeeld.be');
  const f = await velden(() => controleerKlant({ ...goed, email: 'geen', telefoon: '12', postcode: '0123', akkoord: false }, 'leveren'));
  assert.ok(f.email && f.telefoon && f.postcode && f.akkoord);
  // Bij afhalen is een adres niet nodig en wordt het niet bewaard.
  assert.equal(controleerKlant({ ...goed, straat: '', postcode: '', gemeente: '' }, 'afhalen').straat, '');
});

test('bestelnummer', () => {
  assert.equal(bestelnummer(7, new Date('2026-12-01T10:00:00Z')), 'DW-2026-0007');
});
