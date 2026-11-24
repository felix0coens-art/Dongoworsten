import { json, leesJson, veilig } from '../../../../src/lib/http.js';
import { controleerProduct } from '../../../../src/lib/validatie.js';
import { lijstProducten, haalProduct, uniekeSlug, productWaarden } from '../../../../src/lib/db.js';

export const onRequestGet = ({ env }) =>
  veilig(async () => json({ producten: await lijstProducten(env.DB, { alleenZichtbaar: false }) }));

export const onRequestPost = ({ request, env }) =>
  veilig(async () => {
    const p = controleerProduct(await leesJson(request));
    const slug = await uniekeSlug(env.DB, p.naam);
    const r = await env.DB.prepare(
      `INSERT INTO producten (slug, naam, korte_tekst, omschrijving, prijs_cent, eenheid, gewicht_gram,
        ingredienten, bevat, sporen, bewaren, bereiden, diepvries, voorraad, zichtbaar, volgorde)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(slug, ...productWaarden(p)).run();
    return json({ product: await haalProduct(env.DB, 'id', r.meta.last_row_id) }, 201);
  });
