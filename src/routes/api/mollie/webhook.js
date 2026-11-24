// Mollie meldt hier dat een betaling veranderd is. We vragen de status zelf op bij Mollie.
import { verwerkBetaling } from '../../../lib/betaling.js';

export async function onRequestPost({ request, env }) {
  let id = '';
  try { id = String((await request.formData()).get('id') || ''); } catch { /* leeg */ }
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return new Response('ok');
  try {
    await verwerkBetaling(env, request.url, id);
  } catch (e) {
    console.error('Webhook niet verwerkt:', e.message);
    return new Response('opnieuw proberen', { status: 500 }); // Mollie probeert het later opnieuw
  }
  return new Response('ok');
}
