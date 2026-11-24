// Status van één bestelling voor de bedankpagina. Alleen met het bestelnummer én de geheime code.
import { json, fout, veilig } from '../../lib/http.js';
import { verwerkBetaling } from '../../lib/betaling.js';

function gelijk(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return v === 0;
}

export const onRequestGet = ({ request, env }) =>
  veilig(async () => {
    const q = new URL(request.url).searchParams;
    let b = await env.DB.prepare('SELECT * FROM bestellingen WHERE nummer = ?').bind(String(q.get('b') || '')).first();
    if (!b || !b.toegangscode || !gelijk(b.toegangscode, String(q.get('c') || ''))) return fout(404, 'Bestelling niet gevonden.');

    // Is de webhook nog niet binnen? Dan vragen we het zelf na bij Mollie.
    if (b.status === 'open' && b.mollie_id && env.MOLLIE_API_KEY) {
      try { b = (await verwerkBetaling(env, request.url, b.mollie_id)) || b; } catch (e) { console.error(e.message); }
    }
    const { results } = await env.DB.prepare('SELECT naam, eenheid, prijs_cent, aantal FROM bestelregels WHERE bestelling_id = ?').bind(b.id).all();
    return json({
      nummer: b.nummer, status: b.status, levering: b.levering, naam: b.naam, test: b.mollie_status === 'test',
      subtotaal_cent: b.subtotaal_cent, leverkost_cent: b.leverkost_cent, totaal_cent: b.totaal_cent, regels: results,
    });
  });
