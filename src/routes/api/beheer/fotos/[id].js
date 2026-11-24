// Foto aanpassen (omschrijving, volgorde) of verwijderen.
import { json, fout, leesJson, veilig, Ongeldig } from '../../../../lib/http.js';

async function haal(env, params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return null;
  return env.DB.prepare('SELECT * FROM fotos WHERE id = ?').bind(id).first();
}

export const onRequestPatch = ({ params, request, env }) =>
  veilig(async () => {
    const foto = await haal(env, params);
    if (!foto) return fout(404, 'Foto niet gevonden.');
    const w = await leesJson(request);
    const alt = w.alt === undefined ? foto.alt : String(w.alt).trim().slice(0, 200);
    let volgorde = foto.volgorde;
    if (w.volgorde !== undefined) {
      if (!Number.isInteger(w.volgorde) || w.volgorde < 0 || w.volgorde > 1000) throw new Ongeldig({ volgorde: 'Ongeldige volgorde.' });
      volgorde = w.volgorde;
    }
    await env.DB.prepare('UPDATE fotos SET alt = ?, volgorde = ? WHERE id = ?').bind(alt, volgorde, foto.id).run();
    return json({ foto: { id: foto.id, url: `/fotos/${foto.sleutel}`, alt, volgorde } });
  });

export const onRequestDelete = ({ params, env }) =>
  veilig(async () => {
    const foto = await haal(env, params);
    if (!foto) return fout(404, 'Foto niet gevonden.');
    await env.DB.prepare('DELETE FROM fotos WHERE id = ?').bind(foto.id).run();
    await env.FOTOS.delete(foto.sleutel);
    return json({ ok: true });
  });
