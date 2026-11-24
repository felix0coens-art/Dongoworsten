// De beheerpagina's zelf: niet tonen aan wie geen beheerder is.
import { beheerderMetReden } from '../../lib/auth.js';

export async function onRequest(context) {
  const { email, reden } = await beheerderMetReden(context.request, context.env, context.ctx);
  if (!email) {
    console.log('Beheer geweigerd:', reden);
    return new Response(`Geen toegang tot het beheer van Dongo Worsten.\n\nReden: ${reden}`, {
      status: 403,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  const res = await context.next();
  const r = new Response(res.body, res);
  r.headers.set('cache-control', 'no-store');
  r.headers.set('x-robots-tag', 'noindex');
  return r;
}
