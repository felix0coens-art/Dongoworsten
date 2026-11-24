import { json, veilig } from '../../../../lib/http.js';
import { leesInstellingen } from '../../../../lib/db.js';

export const onRequestGet = ({ env }) => veilig(async () => json({ instellingen: await leesInstellingen(env.DB) }));
