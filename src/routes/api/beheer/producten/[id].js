import { json, fout, leesJson, veilig } from '../../../../lib/http.js';
import { controleerProduct } from '../../../../lib/validatie.js';
import { haalProduct, uniekeSlug, productWaarden } from '../../../../lib/db.js';

function leesId(params) {
  const id = Number(params.id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const onRequestGet = ({ params, env }) =>
  veilig(async () => {
    const id = leesId(params);
    const product = id && (await haalProduct(env.DB, 'id', id));
    return product ? json({ product }) : fout(404, 'Product niet gevonden.');
  });

export const onRequestPut = ({ params, request, env }) =>
  veilig(async () => {
    const id = leesId(params);
    const bestaand = id && (await haalProduct(env.DB, 'id', id));
    if (!bestaand) return fout(404, 'Product niet gevonden.');
    const p = controleerProduct(await leesJson(request));
    // De link (slug) volgt de naam; zonder naamswijziging blijft ze dezelfde.
    const slug = p.naam === bestaand.naam ? bestaand.slug : await uniekeSlug(env.DB, p.naam, id);
    await env.DB.prepare(
      `UPDATE producten SET slug = ?, naam = ?, korte_tekst = ?, omschrijving = ?, prijs_cent = ?, eenheid = ?,
        gewicht_gram = ?, ingredienten = ?, bevat = ?, sporen = ?, bewaren = ?, bereiden = ?, diepvries = ?,
        voorraad = ?, zichtbaar = ?, volgorde = ?, gewijzigd = datetime('now')
       WHERE id = ?`,
    ).bind(slug, ...productWaarden(p), id).run();
    return json({ product: await haalProduct(env.DB, 'id', id) });
  });

export const onRequestDelete = ({ params, env }) =>
  veilig(async () => {
    const id = leesId(params);
    const bestaand = id && (await haalProduct(env.DB, 'id', id));
    if (!bestaand) return fout(404, 'Product niet gevonden.');
    const { results } = await env.DB.prepare('SELECT sleutel FROM fotos WHERE product_id = ?').bind(id).all();
    await env.DB.batch([
      env.DB.prepare('DELETE FROM fotos WHERE product_id = ?').bind(id),
      env.DB.prepare('DELETE FROM producten WHERE id = ?').bind(id),
    ]);
    if (results.length) await env.FOTOS.delete(results.map((f) => f.sleutel));
    return json({ ok: true });
  });
