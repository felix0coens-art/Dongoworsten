import { json, veilig } from '../../../../src/lib/http.js';
import { leesInstellingen } from '../../../../src/lib/db.js';

export const onRequestGet = ({ env }) => veilig(async () => json({ instellingen: await leesInstellingen(env.DB) }));
