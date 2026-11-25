// Een factuur aan een bedrijf markeren als "via Peppol verstuurd" (vanuit Accountable).
// De inhoud van een factuur kan niet gewijzigd worden.
import { json, fout, leesJson, veilig, Ongeldig } from '../../../../lib/http.js';

export const onRequestPatch = ({ params, request, env }) =>
  veilig(async () => {
    const id = Number(params.id);
    const f = Number.isInteger(id) && id > 0 && (await env.DB.prepare('SELECT id, b2b FROM facturen WHERE id = ?').bind(id).first());
    if (!f) return fout(404, 'Factuur niet gevonden.');
    const w = await leesJson(request);
    if (typeof w.peppol_verstuurd !== 'boolean') throw new Ongeldig({ peppol_verstuurd: 'Moet aan of uit zijn.' });
    if (!f.b2b) throw new Ongeldig({ peppol_verstuurd: 'Alleen facturen aan bedrijven gaan via Peppol.' });
    await env.DB.prepare('UPDATE facturen SET peppol_verstuurd = ? WHERE id = ?').bind(w.peppol_verstuurd ? 1 : 0, id).run();
    return json({ ok: true });
  });
