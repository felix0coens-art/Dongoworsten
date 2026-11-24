// De Worker van Dongo Worsten: stuurt elk verzoek naar de juiste handler.
// Statische bestanden (public/) serveert Cloudflare zelf; alleen /api, /beheer en /fotos komen hier langs
// (zie run_worker_first in wrangler.toml).
import { fout } from './lib/http.js';

import * as beheerApiPoort from './routes/api/beheer/_middleware.js';
import * as beheerPaginaPoort from './routes/beheer/_middleware.js';
import * as ik from './routes/api/beheer/ik.js';
import * as beheerProducten from './routes/api/beheer/producten/index.js';
import * as beheerProduct from './routes/api/beheer/producten/[id].js';
import * as beheerProductFotos from './routes/api/beheer/producten/[id]/fotos.js';
import * as beheerFoto from './routes/api/beheer/fotos/[id].js';
import * as beheerInstellingen from './routes/api/beheer/instellingen/index.js';
import * as beheerInstelling from './routes/api/beheer/instellingen/[sleutel].js';
import * as beheerBestellingen from './routes/api/beheer/bestellingen.js';
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
  return { request, env, params, data, next: volgende, waitUntil: ctx.waitUntil.bind(ctx) };
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

export default {
  async fetch(request, env, ctx) {
    const pad = new URL(request.url).pathname;
    const data = {};

    // Beheer-API: eerst de poort (login + herkomst), dan de route.
    if (pad === '/api/beheer' || pad.startsWith('/api/beheer/')) {
      return beheerApiPoort.onRequest(maakContext(request, env, ctx, {}, data, () => api(request, env, ctx, pad, data)));
    }
    // Beheerpagina's: eerst de poort, dan het statische bestand.
    if (pad === '/beheer' || pad.startsWith('/beheer/')) {
      return beheerPaginaPoort.onRequest(maakContext(request, env, ctx, {}, data, () => env.ASSETS.fetch(request)));
    }
    if (pad.startsWith('/api/') || pad.startsWith('/fotos/')) return api(request, env, ctx, pad, data);

    return env.ASSETS.fetch(request);
  },
};
