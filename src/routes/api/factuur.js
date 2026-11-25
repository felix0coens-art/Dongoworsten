// Factuur als PDF voor de klant: alleen met bestelnummer én geheime code (zoals de bedankpagina).
import { fout, veilig } from '../../lib/http.js';
import { factuurPdf } from '../../lib/factuur.js';

function gelijk(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}

export const onRequestGet = ({ request, env }) =>
  veilig(async () => {
    const q = new URL(request.url).searchParams;
    const b = await env.DB.prepare('SELECT id, toegangscode FROM bestellingen WHERE nummer = ?').bind(String(q.get('b') || '')).first();
    if (!b || !b.toegangscode || !gelijk(b.toegangscode, String(q.get('c') || ''))) return fout(404, 'Factuur niet gevonden.');
    const f = await env.DB.prepare('SELECT * FROM facturen WHERE bestelling_id = ?').bind(b.id).first();
    if (!f) return fout(404, 'De factuur is nog niet klaar. Probeer het over een paar minuten opnieuw.');
    return new Response(await factuurPdf(f), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="factuur-${f.nummer}.pdf"`, 'cache-control': 'private, no-store', 'x-robots-tag': 'noindex' },
    });
  });
