// Publiek: wat de winkel moet weten over levering, onderneming en teksten.
import { json, veilig } from '../../src/lib/http.js';
import { leesInstellingen } from '../../src/lib/db.js';
import { ALLERGENEN } from '../../src/lib/allergenen.js';

export const onRequestGet = ({ env }) =>
  veilig(async () => {
    const i = await leesInstellingen(env.DB, ['levering', 'bedrijf', 'teksten']);
    return json({ ...i, allergenen: ALLERGENEN }, 200, { 'cache-control': 'public, max-age=30' });
  });
