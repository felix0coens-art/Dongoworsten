// Publiek: de zichtbare producten.
import { json, veilig } from '../../../lib/http.js';
import { lijstProducten, publiek } from '../../../lib/db.js';

export const onRequestGet = ({ env }) =>
  veilig(async () => {
    const producten = (await lijstProducten(env.DB, { alleenZichtbaar: true })).map(publiek);
    return json({ producten }, 200, { 'cache-control': 'public, max-age=30' });
  });

