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
  const aud = Array.isArray(inhoud.aud) ? inhoud.aud : [inhoud.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (inhoud.iss !== env.ACCESS_TEAM_DOMAIN) return null;
  if (typeof inhoud.exp !== 'number' || inhoud.exp < nu) return null;
  if (typeof inhoud.nbf === 'number' && inhoud.nbf > nu + 60) return null;
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

/** Geeft het e-mailadres van de beheerder terug, of null als de toegang geweigerd is. */
export async function beheerder(request, env) {
  const url = new URL(request.url);
  const lokaal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
  if (lokaal && env.BEHEER_DEV_EMAIL) return String(env.BEHEER_DEV_EMAIL).toLowerCase();

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return null;
  const token = request.headers.get('cf-access-jwt-assertion') || cookie(request, 'CF_Authorization');
  if (!token) return null;

  let email = null;
  try {
    email = await controleerToken(token, env);
  } catch (e) {
    console.error('Access-token niet te controleren:', e.message);
    return null;
  }
  if (!email || !toegelaten(env).includes(email)) return null;
  return email;
}
