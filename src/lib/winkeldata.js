// Producten en levering ophalen voor het mandje.
import { leesInstellingen } from './db.js';

export async function productenVoorMandje(db, ids) {
  const per = new Map();
  if (!ids.length) return per;
  const { results } = await db
    .prepare(`SELECT id, naam, eenheid, prijs_cent, voorraad, zichtbaar FROM producten WHERE id IN (${ids.map(() => '?').join(',')})`)
    .bind(...ids).all();
  for (const r of results) per.set(r.id, { ...r, zichtbaar: !!r.zichtbaar });
  return per;
}

export async function leveringInstelling(db) {
  return (await leesInstellingen(db, ['levering'])).levering;
}
