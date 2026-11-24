// Overzicht van bestellingen. Bestellingen zelf komen pas binnen vanaf fase 3 (afrekenen).
import { json, veilig } from '../../../../lib/http.js';

const STATUSSEN = ['open', 'betaald', 'klaargezet', 'geleverd', 'geannuleerd', 'mislukt'];

export const onRequestGet = ({ request, env }) =>
  veilig(async () => {
    const status = new URL(request.url).searchParams.get('status');
    const filter = STATUSSEN.includes(status) ? status : null;
    const { results } = await env.DB.prepare(
      `SELECT id, nummer, status, levering, naam, email, telefoon, adres_postcode, adres_gemeente,
              totaal_cent, aangemaakt, betaald_op
       FROM bestellingen ${filter ? 'WHERE status = ?' : ''} ORDER BY aangemaakt DESC LIMIT 200`,
    ).bind(...(filter ? [filter] : [])).all();
    return json({ bestellingen: results });
  });
