import { test } from 'node:test';
import assert from 'node:assert/strict';
import { controleerProduct, controleerInstelling, maakSlug } from '../src/lib/validatie.js';
import { Ongeldig } from '../src/lib/http.js';

const goed = {
  naam: 'Boerenworst', prijs_cent: 720, eenheid: 'Pak van 4', gewicht_gram: 480,
  ingredienten: 'Varkensvlees, *mosterdzaad*', bevat: ['mosterd'], sporen: ['melk'],
  diepvries: true, voorraad: null, zichtbaar: true, volgorde: 0,
};
const velden = (fn) => { try { fn(); } catch (e) { assert.ok(e instanceof Ongeldig); return e.velden; } assert.fail('geen fout'); };

test('een geldig product komt er netjes door', () => {
  const p = controleerProduct(goed);
  assert.equal(p.prijs_cent, 720);
  assert.deepEqual(p.bevat, ['mosterd']);
});

test('prijs moet een positief geheel aantal cent zijn', () => {
  assert.ok(velden(() => controleerProduct({ ...goed, prijs_cent: 7.2 })).prijs_cent);
  assert.ok(velden(() => controleerProduct({ ...goed, prijs_cent: 0 })).prijs_cent);
  assert.ok(velden(() => controleerProduct({ ...goed, prijs_cent: '720' })).prijs_cent);
});

test('onbekende allergenen en dubbele keuzes worden geweigerd', () => {
  assert.ok(velden(() => controleerProduct({ ...goed, bevat: ['kaas'] })).bevat);
  assert.ok(velden(() => controleerProduct({ ...goed, bevat: ['melk'], sporen: ['melk'] })).sporen);
});

test('zichtbaar zonder ingrediënten kan niet', () => {
  assert.ok(velden(() => controleerProduct({ ...goed, ingredienten: '' })).ingredienten);
  assert.doesNotThrow(() => controleerProduct({ ...goed, ingredienten: '', zichtbaar: false }));
});

test('slug zonder accenten of rare tekens', () => {
  assert.equal(maakSlug('Crème brûlée-worst  (pikant!)'), 'creme-brulee-worst-pikant');
});

test('levering: postcodes en afhalen', () => {
  const basis = { leveren_aan: true, leverkost_cent: 650, gratis_vanaf_cent: 5000, minimum_cent: 0, postcodes: ['9000', '9030'], leveren_info: '', afhalen_aan: false, afhaal_adres: '', afhaal_info: '' };
  assert.deepEqual(controleerInstelling('levering', basis).postcodes, ['9000', '9030']);
  assert.ok(velden(() => controleerInstelling('levering', { ...basis, postcodes: ['900'] })).postcodes);
  assert.ok(velden(() => controleerInstelling('levering', { ...basis, leveren_aan: false })).afhalen_aan);
  assert.ok(velden(() => controleerInstelling('levering', { ...basis, afhalen_aan: true })).afhaal_adres);
});

test('onbekende instelling wordt geweigerd', () => {
  assert.throws(() => controleerInstelling('geheim', {}), Ongeldig);
});
