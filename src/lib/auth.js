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

async function controleerToken(token, env) {
  const delen = token.split('.');
  if (delen.length !== 3) return null;
  const kop = leesJsonDeel(delen[0]);
  const inhoud = leesJsonDeel(delen[1]);
  if (kop.alg !== 'RS256') return null;

  const sleutels = await haalSleutels(env.ACCESS_TEAM_DOMAIN);
  const jwk = sleutels.find((k) => k.kid === kop.kid);
  if (!jwk) return null;
  const sleutel = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'],
  );
  const geldig = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5', sleutel, b64urlNaarBytes(delen[2]),
    new TextEncoder().encode(`${delen[0]}.${delen[1]}`),
  );
  if (!geldig) return null;

  const nu = Math.floor(Date.now() / 1000);
  if (inhoud.iss !== env.ACCESS_TEAM_DOMAIN) return null;
  if (typeof inhoud.exp !== 'number' || inhoud.exp < nu) return null;
  if (typeof inhoud.nbf === 'number' && inhoud.nbf > nu + 60) return null;
  const aud = Array.isArray(inhoud.aud) ? inhoud.aud : [inhoud.aud];
  if (!aud.includes(env.ACCESS_AUD)) {
    // Geldige login, maar voor een andere Access-applicatie. Geen toegang; wel de AUD meegeven
    // zodat de beheerder ze in wrangler.toml kan zetten. De AUD is geen geheim.
    const e = new Error('andere-access-applicatie');
    e.aud = aud.filter((x) => typeof x === 'string' && /^[0-9a-f]{64}$/.test(x));
    throw e;
  }
  return typeof inhoud.email === 'string' ? inhoud.email.toLowerCase() : null;
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
      if (e.message === 'andere-access-applicatie') return { email: null, reden: 'andere-access-applicatie', aud: e.aud };
      console.error('Access-token niet te controleren:', e.message);
      return { email: null, reden: 'login-niet-te-controleren' };
    }
    if (!email) return { email: null, reden: 'login-ongeldig' };
  }
  if (!lijst.includes(email)) return { email: null, reden: 'adres-niet-op-lijst' };
  return { email, reden: 'ok' };
}

/** Geeft het e-mailadres van de beheerder terug, of null als de toegang geweigerd is. */
export async function beheerder(request, env, ctx) {
  return (await beheerderMetReden(request, env, ctx)).email;
}
