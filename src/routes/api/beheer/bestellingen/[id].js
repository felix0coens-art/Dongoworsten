// Eén bestelling bekijken en de status aanpassen (klaargezet, geleverd, geannuleerd).
import { json, fout, leesJson, veilig, Ongeldig } from '../../../../lib/http.js';

const MAG_NAAR = {
  betaald: ['klaargezet', 'geleverd', 'geannuleerd'],
  klaargezet: ['betaald', 'geleverd', 'geannuleerd'],
  geleverd: ['klaargezet'],
  open: ['geannuleerd'],
  mislukt: [],
  geannuleerd: [],
};

async function haal(env, params) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id < 1) return null;
  return env.DB.prepare('SELECT * FROM bestellingen WHERE id = ?').bind(id).first();
}

export const onRequestGet = ({ params, env }) =>
  veilig(async () => {
    const b = await haal(env, params);
    if (!b) return fout(404, 'Bestelling niet gevonden.');
    const { results } = await env.DB.prepare('SELECT naam, eenheid, prijs_cent, aantal FROM bestelregels WHERE bestelling_id = ?').bind(b.id).all();
    const { toegangscode, ...rest } = b;
    return json({ bestelling: { ...rest, regels: results, mag_naar: MAG_NAAR[b.status] || [] } });
  });

export const onRequestPatch = ({ params, request, env }) =>
  veilig(async () => {
    const b = await haal(env, params);
    if (!b) return fout(404, 'Bestelling niet gevonden.');
    const w = await leesJson(request);
    const status = w.status ?? b.status;
    if (status !== b.status && !(MAG_NAAR[b.status] || []).includes(status)) throw new Ongeldig({ status: 'Deze statuswijziging kan niet.' });
    const notitie = w.notitie === undefined ? b.notitie : String(w.notitie).slice(0, 2000);
    await env.DB.prepare('UPDATE bestellingen SET status = ?, notitie = ? WHERE id = ?').bind(status, notitie, b.id).run();
    return json({ ok: true, status, notitie });
  });
