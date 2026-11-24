// Foto opladen bij een product. De browser verkleint de foto eerst; hier controleren we type en grootte.
import { json, fout, veilig } from '../../../../../src/lib/http.js';
import { haalProduct } from '../../../../../src/lib/db.js';

const MAX_BYTES = 6 * 1024 * 1024;
const MAX_FOTOS = 12;

function soort(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { ext: 'png', type: 'image/png' };
  const riff = String.fromCharCode(...bytes.slice(0, 4)), webp = String.fromCharCode(...bytes.slice(8, 12));
  if (riff === 'RIFF' && webp === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

export const onRequestPost = ({ params, request, env }) =>
  veilig(async () => {
    const id = Number(params.id);
    if (!Number.isInteger(id) || id < 1 || !(await haalProduct(env.DB, 'id', id))) return fout(404, 'Product niet gevonden.');

    const lengte = Number(request.headers.get('content-length') || 0);
    if (lengte > MAX_BYTES + 100_000) return fout(413, 'De foto is te groot (maximaal 6 MB).');

    let form;
    try { form = await request.formData(); } catch { return fout(400, 'Geen foto ontvangen.'); }
    const bestand = form.get('foto');
    if (!bestand || typeof bestand === 'string') return fout(400, 'Geen foto ontvangen.');
    if (bestand.size > MAX_BYTES) return fout(413, 'De foto is te groot (maximaal 6 MB).');

    const buf = await bestand.arrayBuffer();
    const s = soort(new Uint8Array(buf.slice(0, 12)));
    if (!s) return fout(415, 'Alleen JPG-, PNG- of WebP-foto\'s.');

    const aantal = await env.DB.prepare('SELECT COUNT(*) AS n, COALESCE(MAX(volgorde), -1) AS max FROM fotos WHERE product_id = ?').bind(id).first();
    if (aantal.n >= MAX_FOTOS) return fout(400, `Maximaal ${MAX_FOTOS} foto's per product.`);

    const alt = String(form.get('alt') || '').trim().slice(0, 200);
    const sleutel = `producten/${id}/${crypto.randomUUID()}.${s.ext}`;
    await env.FOTOS.put(sleutel, buf, { httpMetadata: { contentType: s.type } });
    const r = await env.DB.prepare('INSERT INTO fotos (product_id, sleutel, alt, volgorde) VALUES (?, ?, ?, ?)')
      .bind(id, sleutel, alt, aantal.max + 1).run();
    return json({ foto: { id: r.meta.last_row_id, url: `/fotos/${sleutel}`, alt, volgorde: aantal.max + 1 } }, 201);
  });
