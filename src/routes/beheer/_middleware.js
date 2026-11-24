// De beheerpagina's zelf: niet tonen aan wie geen beheerder is.
import { beheerderMetReden } from '../../lib/auth.js';

export async function onRequest(context) {
  const { email, reden, aud, info } = await beheerderMetReden(context.request, context.env, context.ctx);
  if (!email) {
    console.log('Beheer geweigerd:', reden);
    const extra = (aud?.length ? `\n\nAUD-tag van je login: ${aud.join(', ')}\nStuur deze code door om het beheer te openen.` : '')
      + (info ? `\n\n${info}` : '');
    return new Response(`Geen toegang tot het beheer van Dongo Worsten.\n\nReden: ${reden}${extra}`, {
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
