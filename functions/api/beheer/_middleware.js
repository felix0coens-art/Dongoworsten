// Alles onder /api/beheer: alleen voor beheerders, en wijzigingen alleen vanaf de eigen site.
import { beheerder } from '../../../src/lib/auth.js';
import { fout } from '../../../src/lib/http.js';

export async function onRequest(context) {
  const { request, env } = context;
  const email = await beheerder(request, env);
  if (!email) return fout(401, 'Je bent niet aangemeld als beheerder.');

  if (!['GET', 'HEAD'].includes(request.method)) {
    const origin = request.headers.get('origin');
    if (!origin || origin !== new URL(request.url).origin) return fout(403, 'Verzoek geweigerd.');
  }
  context.data.beheerder = email;
  return context.next();
}
