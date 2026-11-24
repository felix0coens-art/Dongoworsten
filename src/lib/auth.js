// Toegang tot het beheer.
//
// Cloudflare Access staat vóór /beheer en /api/beheer en laat alleen de
// toegelaten e-mailadressen door. Deze code controleert dat nog eens zelf:
// het Access-token moet geldig ondertekend zijn, voor onze applicatie (AUD),
// niet verlopen, en het e-mailadres moet in BEHEER_EMAILS staan. Zo blijft
// het beheer dicht, ook als Access ooit verkeerd ingesteld zou zijn.
//
// Alleen lokaal (localhost) kan BEHEER_DEV_EMAIL uit .dev.vars gebruikt worden.

const certCache = { url: '', sleutels: null, tot: 0 };

function b64urlNaarBytes(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(s.length / 4) * 4, '=');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function leesJsonDeel(deel) {
  return JSON.parse(new TextDecoder().decode(b64urlNaarBytes(deel)));
}

async function haalSleutels(teamDomein) {
  const url = `${teamDomein}/cdn-cgi/access/certs`;
  if (certCache.url === url && certCache.sleutels && Date.now() < certCache.tot) return certCache.sleutels;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Access-certificaten niet opgehaald (${res.status})`);
  const { keys } = await res.json();
  certCache.url = url;
  certCache.sleutels = keys;
  certCache.tot = Date.now() + 60 * 60 * 1000;
  return keys;
}

// Gooit een Error met een korte reden als het token niet klopt; geeft anders het e-mailadres terug.
function weiger(reden, extra = {}) {
  return Object.assign(new Error(reden), { reden, ...extra });
}

async function controleerToken(token, env) {
  const delen = token.split('.');
  if (delen.length !== 3) throw weiger('login-vorm');
  let kop, inhoud;
  try { kop = leesJsonDeel(delen[0]); inhoud = leesJsonDeel(delen[1]); } catch { throw weiger('login-vorm'); }
  if (kop.alg !== 'RS256') throw weiger('login-algoritme');

  const sleutels = await haalSleutels(env.ACCESS_TEAM_DOMAIN);
  const jwk = sleutels.find((k) => k.kid === kop.kid);
  if (!jwk) throw weiger('login-sleutel-onbekend');
  const sleutel = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const geldig = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', sleutel, b64urlNaarBytes(delen[2]),
    new TextEncoder().encode(`${delen[0]}.${delen[1]}`),
  );
  if (!geldig) throw weiger('login-ongeldig');

  // Vanaf hier is het token echt door Cloudflare ondertekend; de waarden mogen in een foutmelding.
  const nu = Math.floor(Date.now() / 1000);
  if (inhoud.iss !== env.ACCESS_TEAM_DOMAIN) throw weiger('login-ander-team', { info: `uitgever ${inhoud.iss}` });
  if (typeof inhoud.exp !== 'number' || inhoud.exp < nu) throw weiger('login-verlopen');
  if (typeof inhoud.nbf === 'number' && inhoud.nbf > nu + 60) throw weiger('login-nog-niet-geldig');
  const aud = Array.isArray(inhoud.aud) ? inhoud.aud : [inhoud.aud];
  if (!aud.includes(env.ACCESS_AUD)) {
    throw weiger('andere-access-applicatie', { aud: aud.filter((x) => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x)) });
  }
  if (typeof inhoud.email !== 'string') throw weiger('login-zonder-email');
  return inhoud.email.toLowerCase();
}

function toegelaten(env) {
  return String(env.BEHEER_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

function cookie(request, naam) {
  const c = request.headers.get('cookie') || '';
  for (const deel of c.split(';')) {
    const [k, ...v] = deel.trim().split('=');
    if (k === naam) return v.join('=');
  }
  return null;
}

/**
 * Wie is de beheerder? Geeft { email, reden } terug; email is null als de toegang geweigerd is.
 * De reden is een korte code zonder gevoelige gegevens, handig om een probleem te vinden.
 *
 * Twee manieren waarop Cloudflare Access een login doorgeeft:
 *  1. Access op de Worker zelf: de runtime zet ctx.access (kan niet vervalst worden door een bezoeker).
 *  2. Access op een domein: een ondertekend token in de header Cf-Access-Jwt-Assertion of de cookie CF_Authorization.
 */
export async function beheerderMetReden(request, env, ctx) {
  const url = new URL(request.url);
  const lokaal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (lokaal && env.BEHEER_DEV_EMAIL) return { email: String(env.BEHEER_DEV_EMAIL).toLowerCase(), reden: 'lokaal' };

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return { email: null, reden: 'access-niet-ingesteld' };
  const lijst = toegelaten(env);
  if (!lijst.length) return { email: null, reden: 'geen-beheerders-ingesteld' };

  let email = null;
  if (ctx && ctx.access) {
    if (ctx.access.aud && ctx.access.aud !== env.ACCESS_AUD) return { email: null, reden: 'andere-access-applicatie', aud: [ctx.access.aud] };
    try {
      const identiteit = await ctx.access.getIdentity();
      email = typeof identiteit?.email === 'string' ? identiteit.email.toLowerCase() : null;
    } catch (e) {
      console.error('Access-identiteit niet op te halen:', e.message);
    }
  }
  if (!email) {
    const token = request.headers.get('cf-access-jwt-assertion') || cookie(request, 'CF_Authorization');
    if (!token) return { email: null, reden: 'geen-login' };
    try {
      email = await controleerToken(token, env);
    } catch (e) {
      if (e.reden) return { email: null, reden: e.reden, aud: e.aud, info: e.info };
      console.error('Access-token niet te controleren:', e.message);
      return { email: null, reden: 'login-niet-te-controleren' };
    }
  }
  if (!lijst.includes(email)) return { email: null, reden: 'adres-niet-op-lijst' };
  return { email, reden: 'ok' };
}

/** Geeft het e-mailadres van de beheerder terug, of null als de toegang geweigerd is. */
export async function beheerder(request, env, ctx) {
  return (await beheerderMetReden(request, env, ctx)).email;
}
