import { fout, veilig } from '../../../../../lib/http.js';
import { factuurPdf } from '../../../../../lib/factuur.js';

export const onRequestGet = ({ params, env }) =>
  veilig(async () => {
    const id = Number(params.id);
    const f = Number.isInteger(id) && id > 0 && (await env.DB.prepare('SELECT * FROM facturen WHERE id = ?').bind(id).first());
    if (!f) return fout(404, 'Factuur niet gevonden.');
    return new Response(await factuurPdf(f), {
      headers: { 'content-type': 'application/pdf', 'content-disposition': `inline; filename="${f.nummer}.pdf"`, 'cache-control': 'no-store' },
    });
  });
