// Databasehulp voor producten, foto's en instellingen.
import { maakSlug } from './validatie.js';

export function productUitRij(rij, fotos = []) {
  return {
    id: rij.id,
    slug: rij.slug,
    naam: rij.naam,
    korte_tekst: rij.korte_tekst,
    omschrijving: rij.omschrijving,
    prijs_cent: rij.prijs_cent,
    eenheid: rij.eenheid,
    gewicht_gram: rij.gewicht_gram,
    // Kiloprijs wordt altijd berekend, nooit ingevoerd.
    kiloprijs_cent: rij.gewicht_gram ? Math.round((rij.prijs_cent * 1000) / rij.gewicht_gram) : null,
    ingredienten: rij.ingredienten,
    bevat: JSON.parse(rij.bevat),
    sporen: JSON.parse(rij.sporen),
    bewaren: rij.bewaren,
    bereiden: rij.bereiden,
    diepvries: !!rij.diepvries,
    voorraad: rij.voorraad,
    zichtbaar: !!rij.zichtbaar,
    volgorde: rij.volgorde,
    gewijzigd: rij.gewijzigd,
    fotos: fotos.map((f) => ({ id: f.id, url: `/fotos/${f.sleutel}`, alt: f.alt, volgorde: f.volgorde })),
  };
}

export async function fotosPerProduct(db, ids) {
  const per = new Map(ids.map((id) => [id, []]));
  if (!ids.length) return per;
  const plaats = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(`SELECT * FROM fotos WHERE product_id IN (${plaats}) ORDER BY volgorde, id`)
    .bind(...ids)
    .all();
  for (const f of results) per.get(f.product_id)?.push(f);
  return per;
}

export async function lijstProducten(db, { alleenZichtbaar }) {
  const { results } = await db
    .prepare(`SELECT * FROM producten ${alleenZichtbaar ? 'WHERE zichtbaar = 1' : ''} ORDER BY volgorde, naam`)
    .all();
  const fotos = await fotosPerProduct(db, results.map((r) => r.id));
  return results.map((r) => productUitRij(r, fotos.get(r.id)));
}

export async function haalProduct(db, waar, waarde) {
  const kolom = waar === 'slug' ? 'slug' : 'id';
  const rij = await db.prepare(`SELECT * FROM producten WHERE ${kolom} = ?`).bind(waarde).first();
  if (!rij) return null;
  const fotos = await fotosPerProduct(db, [rij.id]);
  return productUitRij(rij, fotos.get(rij.id));
}

export async function uniekeSlug(db, naam, behalveId = null) {
  const basis = maakSlug(naam);
  for (let i = 1; i < 100; i++) {
    const kandidaat = i === 1 ? basis : `${basis}-${i}`;
    const rij = await db.prepare('SELECT id FROM producten WHERE slug = ?').bind(kandidaat).first();
    if (!rij || rij.id === behalveId) return kandidaat;
  }
  return `${basis}-${crypto.randomUUID().slice(0, 8)}`;
}

export function productWaarden(p) {
  return [
    p.naam, p.korte_tekst, p.omschrijving, p.prijs_cent, p.eenheid, p.gewicht_gram,
    p.ingredienten, JSON.stringify(p.bevat), JSON.stringify(p.sporen), p.bewaren, p.bereiden,
    p.diepvries ? 1 : 0, p.voorraad, p.zichtbaar ? 1 : 0, p.volgorde,
  ];
}

export async function leesInstellingen(db, sleutels) {
  const { results } = await db.prepare('SELECT sleutel, waarde FROM instellingen').all();
  const uit = {};
  for (const r of results) if (!sleutels || sleutels.includes(r.sleutel)) uit[r.sleutel] = JSON.parse(r.waarde);
  return uit;
}

// Wat de buitenwereld van een product mag zien.
export function publiek(p) {
  const { zichtbaar, volgorde, gewijzigd, voorraad, ...rest } = p;
  // De exacte voorraad tonen we niet; wel of er nog is en of het bijna op is.
  return { ...rest, op_voorraad: voorraad === null || voorraad > 0, bijna_op: voorraad !== null && voorraad > 0 && voorraad <= 5 };
}
