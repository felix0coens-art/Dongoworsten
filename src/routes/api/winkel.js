// Publiek: wat de winkel moet weten over levering, onderneming en teksten.
import { json, veilig } from '../../lib/http.js';
import { leesInstellingen } from '../../lib/db.js';
import { ALLERGENEN } from '../../lib/allergenen.js';
import { testmodus } from '../../lib/betaling.js';

export const onRequestGet = ({ env }) =>
  veilig(async () => {
    const i = await leesInstellingen(env.DB, ['levering', 'bedrijf', 'teksten']);
    return json({ ...i, allergenen: ALLERGENEN, testmodus: testmodus(env) }, 200, { 'cache-control': 'public, max-age=30' });
  });
