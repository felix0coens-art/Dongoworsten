// De Worker van Dongo Worsten: stuurt elk verzoek naar de juiste handler.
// Statische bestanden (public/) serveert Cloudflare zelf; alleen /api, /beheer en /fotos komen hier langs
// (zie run_worker_first in wrangler.toml).
import { fout } from './lib/http.js';
import * as seo from './lib/seo.js';

import * as beheerApiPoort from './routes/api/beheer/_middleware.js';
import * as beheerPaginaPoort from './routes/beheer/_middleware.js';
import * as ik from './routes/api/beheer/ik.js';
import * as beheerProducten from './routes/api/beheer/producten/index.js';
import * as beheerProduct from './routes/api/beheer/producten/[id].js';
import * as beheerProductFotos from './routes/api/beheer/producten/[id]/fotos.js';
import * as beheerFoto from './routes/api/beheer/fotos/[id].js';
import * as beheerInstellingen from './routes/api/beheer/instellingen/index.js';
import * as beheerInstelling from './routes/api/beheer/instellingen/[sleutel].js';
import * as beheerBestellingen from './routes/api/beheer/bestellingen/index.js';
import * as beheerBestelling from './routes/api/beheer/bestellingen/[id].js';
import * as mandje from './routes/api/mandje.js';
import * as afrekenen from './routes/api/afrekenen.js';
import * as mollieWebhook from './routes/api/mollie/webhook.js';
import * as bestelling from './routes/api/bestelling.js';
import * as producten from './routes/api/producten/index.js';
import * as product from './routes/api/producten/[slug].js';
import * as winkel from './routes/api/winkel.js';
import * as fotos from './routes/fotos/[[pad]].js';

// [patroon, module]. ":naam" is één padstuk, "*naam" de rest van het pad.
const ROUTES = [
  ['/api/beheer/ik', ik],
  ['/api/beheer/producten', beheerProducten],
  ['/api/beheer/producten/:id', beheerProduct],
  ['/api/beheer/producten/:id/fotos', beheerProductFotos],
  ['/api/beheer/fotos/:id', beheerFoto],
  ['/api/beheer/instellingen', beheerInstellingen],
  ['/api/beheer/instellingen/:sleutel', beheerInstelling],
  ['/api/beheer/bestellingen', beheerBestellingen],
  ['/api/beheer/bestellingen/:id', beheerBestelling],
  ['/api/mandje', mandje],
  ['/api/afrekenen', afrekenen],
  ['/api/mollie/webhook', mollieWebhook],
  ['/api/bestelling', bestelling],
  ['/api/producten', producten],
  ['/api/producten/:slug', product],
  ['/api/winkel', winkel],
  ['/fotos/*pad', fotos],
].map(([patroon, module]) => [maakMatcher(patroon), module]);

function maakMatcher(patroon) {
  const namen = [];
  const re = patroon
    .split('/')
    .map((deel) => {
      if (deel.startsWith(':')) { namen.push(deel.slice(1)); return '([^/]+)'; }
      if (deel.startsWith('*')) { namen.push(deel.slice(1)); return '(.+)'; }
      return deel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('/');
  const regex = new RegExp(`^${re}/?$`);
  return (pad) => {
    const m = regex.exec(pad);
    if (!m) return null;
    const params = {};
    namen.forEach((n, i) => {
      try { params[n] = decodeURIComponent(m[i + 1]); } catch { params[n] = m[i + 1]; }
    });
    return params;
  };
}

function kiesHandler(module, methode) {
  const naam = methode === 'HEAD' ? 'Get' : methode.charAt(0) + methode.slice(1).toLowerCase();
  return module[`onRequest${naam}`] || module.onRequest || null;
}

// Zelfde vorm als de context van Pages Functions, zodat de handlers niet hoeven te veranderen.
function maakContext(request, env, ctx, params, data, volgende) {
  return { request, env, params, data, next: volgende, ctx, waitUntil: ctx.waitUntil.bind(ctx) };
}

async function api(request, env, ctx, pad, data) {
  for (const [match, module] of ROUTES) {
    const params = match(pad);
    if (!params) continue;
    const handler = kiesHandler(module, request.method);
    if (!handler) return fout(405, 'Deze actie bestaat hier niet.');
    return handler(maakContext(request, env, ctx, params, data));
  }
  return fout(404, 'Niet gevonden.');
}

async function ruimOp(env) {
  const oud = `aangemaakt < datetime('now', '-10 years') OR (status IN ('open', 'mislukt') AND aangemaakt < datetime('now', '-1 year'))`;
  // Eerst de regels, dan de bestellingen zelf.
  const r = await env.DB.batch([
    env.DB.prepare(`DELETE FROM bestelregels WHERE bestelling_id IN (SELECT id FROM bestellingen WHERE ${oud})`),
    env.DB.prepare(`DELETE FROM bestellingen WHERE ${oud}`),
  ]);
  console.log('Opruiming:', r.map((x) => x.meta.changes).join(' / '), 'bestellingen verwijderd');
}

// Als de extra zoekmachinegegevens niet lukken (bv. database even weg), toon dan gewoon de pagina.
async function veiligSeo(fn, terugval) {
  try { return await fn(); } catch (e) { console.error('SEO:', e.message); return terugval(); }
}

export default {
  // Elke nacht: oude bestellingen opruimen, zoals de privacyverklaring belooft.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ruimOp(env));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // www.dongoworsten.be -> dongoworsten.be (één adres voor de winkel)
    if (url.hostname.startsWith('www.')) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    const pad = url.pathname;
    const data = {};

    // Het workers.dev-adres van de echte site stuurt door naar het eigen domein (geen dubbele site voor Google).
    // Testversies (<versie>-dongoworsten....workers.dev) en de API blijven werken.
    if (env.SITE_URL && url.hostname.endsWith('.workers.dev') && url.hostname.startsWith('dongoworsten.')
        && ['GET', 'HEAD'].includes(request.method) && !pad.startsWith('/api/')) {
      return Response.redirect(`${env.SITE_URL}${pad}${url.search}`, 301);
    }
    if (pad === '/robots.txt') return seo.robots(request, env);
    if (pad === '/sitemap.xml') return veiligSeo(() => seo.sitemap(request, env), () => new Response('Niet beschikbaar', { status: 503 }));

    // Beheer-API: eerst de poort (login + herkomst), dan de route.
    if (pad === '/api/beheer' || pad.startsWith('/api/beheer/')) {
      return beheerApiPoort.onRequest(maakContext(request, env, ctx, {}, data, () => api(request, env, ctx, pad, data)));
    }
    // Beheerpagina's: eerst de poort, dan het statische bestand.
    if (pad === '/beheer' || pad.startsWith('/beheer/')) {
      return beheerPaginaPoort.onRequest(maakContext(request, env, ctx, {}, data, () => env.ASSETS.fetch(request)));
    }
    if (pad.startsWith('/api/') || pad.startsWith('/fotos/')) return api(request, env, ctx, pad, data);

    // Productpagina's: /worst/<slug> toont altijd dezelfde pagina; die haalt het product zelf op.
    // De server zet er wel titel, beschrijving, voorvertoning en productgegevens in.
    const worst = pad.match(/^\/worst\/([a-z0-9-]+)\/?$/);
    if (worst) {
      const pagina = await env.ASSETS.fetch(new Request(new URL('/worst', request.url), request));
      const metSeo = await veiligSeo(() => seo.productpagina(request, env, pagina.clone(), worst[1]), () => pagina.clone());
      if (metSeo) return metSeo;
      // Product bestaat niet (meer): de pagina toont dat zelf, maar zoekmachines krijgen een 404.
      const r = new Response(pagina.body, { status: 404, headers: pagina.headers });
      r.headers.set('x-robots-tag', 'noindex');
      return r;
    }

    if (pad === '/' || pad === '/index.html') {
      const pagina = await env.ASSETS.fetch(request);
      if (!pagina.ok) return pagina;
      return veiligSeo(() => seo.startpagina(request, env, pagina.clone()), () => pagina);
    }
    const juridisch = { '/voorwaarden': ['Algemene voorwaarden · Dongo Worsten', 'De algemene voorwaarden van Dongo Worsten.'], '/privacy': ['Privacyverklaring · Dongo Worsten', 'Hoe Dongo Worsten met je gegevens omgaat.'] }[pad];
    if (juridisch) {
      const pagina = await env.ASSETS.fetch(request);
      if (!pagina.ok) return pagina;
      return seo.gewonePagina(request, env, pagina, { titel: juridisch[0], beschrijving: juridisch[1] });
    }
    if (pad === '/mandje' || pad === '/bedankt') {
      const pagina = await env.ASSETS.fetch(request);
      const r = new Response(pagina.body, pagina);
      r.headers.set('x-robots-tag', 'noindex');
      return r;
    }

    return env.ASSETS.fetch(request);
  },
};
