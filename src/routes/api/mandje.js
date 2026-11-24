// Het mandje narekenen (zonder te bestellen), zodat de klant de echte bedragen ziet.
import { json, leesJson, veilig, Ongeldig } from '../../lib/http.js';
import { leesMandje, rekenMandje } from '../../lib/bestelling.js';
import { productenVoorMandje, leveringInstelling } from '../../lib/winkeldata.js';

export const onRequestPost = ({ request, env }) =>
  veilig(async () => {
    const body = await leesJson(request, 20_000);
    const regels = leesMandje(body.regels);
    const levering = body.levering ?? null;
    if (levering !== null && !['leveren', 'afhalen'].includes(levering)) throw new Ongeldig({ levering: 'Kies leveren of afhalen.' });
    const postcode = /^[1-9]\d{3}$/.test(String(body.postcode || '')) ? String(body.postcode) : null;
    const producten = await productenVoorMandje(env.DB, regels.map((r) => r.id));
    return json(rekenMandje({ regels, producten, levering, postcode, instelling: await leveringInstelling(env.DB) }));
  });
