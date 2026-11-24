import { json, fout, veilig } from '../../../src/lib/http.js';
import { haalProduct, publiek } from '../../../src/lib/db.js';

export const onRequestGet = ({ params, env }) =>
  veilig(async () => {
    const p = await haalProduct(env.DB, 'slug', String(params.slug));
    if (!p || !p.zichtbaar) return fout(404, 'Product niet gevonden.');
    return json({ product: publiek(p) }, 200, { 'cache-control': 'public, max-age=30' });
  });
