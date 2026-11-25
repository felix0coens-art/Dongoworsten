// Maandexport voor de boekhouding: ZIP met overzicht (CSV) en alle facturen (PDF). Zonder testfacturen.
import { fout, veilig } from '../../../../lib/http.js';
import { factuurPdf, facturenCsv } from '../../../../lib/factuur.js';
import { leesMaand } from './index.js';
import { zipSync, strToU8 } from 'fflate';

export const onRequestGet = ({ request, env }) =>
  veilig(async () => {
    const maand = leesMaand(request);
    if (!maand) return fout(400, 'Kies een maand.');
    const { results } = await env.DB.prepare("SELECT * FROM facturen WHERE reeks = 'W' AND substr(datum, 1, 7) = ? ORDER BY volgnr").bind(maand).all();
    if (!results.length) return fout(404, 'Geen facturen in deze maand.');
    const bestanden = { [`facturen-${maand}.csv`]: strToU8(facturenCsv(results)) };
    for (const f of results) bestanden[`${f.nummer}.pdf`] = await factuurPdf(f);
    const zip = zipSync(bestanden, { level: 6 });
    return new Response(zip, {
      headers: { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="dongo-facturen-${maand}.zip"`, 'cache-control': 'no-store' },
    });
  });
