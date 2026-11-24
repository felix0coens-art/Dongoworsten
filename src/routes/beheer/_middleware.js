// De beheerpagina's zelf: niet tonen aan wie geen beheerder is.
import { beheerder } from '../../lib/auth.js';

export async function onRequest(context) {
  const email = await beheerder(context.request, context.env);
  if (!email) {
    return new Response('Geen toegang. Meld je aan via het beheer van Dongo Worsten.', {
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
