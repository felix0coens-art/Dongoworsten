import { json, leesJson, veilig } from '../../../../src/lib/http.js';
import { controleerInstelling } from '../../../../src/lib/validatie.js';

export const onRequestPut = ({ params, request, env }) =>
  veilig(async () => {
    const waarde = controleerInstelling(params.sleutel, await leesJson(request));
    await env.DB.prepare(
      `INSERT INTO instellingen (sleutel, waarde) VALUES (?, ?)
       ON CONFLICT(sleutel) DO UPDATE SET waarde = excluded.waarde, gewijzigd = datetime('now')`,
    ).bind(params.sleutel, JSON.stringify(waarde)).run();
    return json({ [params.sleutel]: waarde });
  });
