// Alles onder /api/beheer: alleen voor beheerders, en wijzigingen alleen vanaf de eigen site.
import { beheerderMetReden } from '../../../lib/auth.js';
import { fout, json } from '../../../lib/http.js';

export async function onRequest(context) {
  const { request, env } = context;
  const { email, reden } = await beheerderMetReden(request, env, context.ctx);
  if (!email) {
    console.log('Beheer-API geweigerd:', reden);
    return json({ fout: 'Je bent niet aangemeld als beheerder.', reden }, 401);
  }

  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return fout(403, 'Verzoek geweigerd.');
  }
  context.data.beheerder = email;
  return context.next();
}
