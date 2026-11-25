// Facturen per maand (YYYY-MM). Met ?test=1 de testfacturen.
import { json, fout, veilig } from '../../../../lib/http.js';

export function leesMaand(request) {
  const m = new URL(request.url).searchParams.get('maand') || '';
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(m) ? m : null;
}

export const onRequestGet = ({ request, env }) =>
  veilig(async () => {
    const maand = leesMaand(request);
    if (!maand) return fout(400, 'Kies een maand.');
    const reeks = new URL(request.url).searchParams.get('test') === '1' ? 'TEST' : 'W';
    const { results } = await env.DB.prepare(
      `SELECT f.id, f.nummer, f.datum, f.b2b, f.maatstaf_cent, f.btw_cent, f.totaal_cent, f.btw_procent, f.peppol_verstuurd,
              f.bestelling_id, json_extract(f.gegevens, '$.klant.naam') AS klant, json_extract(f.gegevens, '$.bestelnummer') AS bestelnummer
       FROM facturen f WHERE f.reeks = ? AND substr(f.datum, 1, 7) = ? ORDER BY f.volgnr`,
    ).bind(reeks, maand).all();
    return json({ facturen: results });
  });
