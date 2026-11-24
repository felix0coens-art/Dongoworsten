// Het beheer mag alleen open voor een geldig Access-token van een toegelaten e-mailadres.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { beheerder } from '../src/lib/auth.js';

const TEAM = 'https://dongo-test.cloudflareaccess.com';
const AUD = 'aud-123';
const env = { ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, BEHEER_EMAILS: 'victor@voorbeeld.be, felix@voorbeeld.be' };

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...(await crypto.subtle.exportKey('jwk', publicKey)), kid: 'k1' };
globalThis.fetch = async (url) => {
  assert.equal(url, `${TEAM}/cdn-cgi/access/certs`);
  return new Response(JSON.stringify({ keys: [jwk] }));
};

const b64 = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');
async function token(inhoud, kid = 'k1') {
  const kop = b64({ alg: 'RS256', kid });
  const body = b64({ iss: TEAM, aud: [AUD], exp: Math.floor(Date.now() / 1000) + 600, email: 'victor@voorbeeld.be', ...inhoud });
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(`${kop}.${body}`));
  return `${kop}.${body}.${Buffer.from(sig).toString('base64url')}`;
}
const req = (t, host = 'dongo.be') => new Request(`https://${host}/api/beheer/ik`, t ? { headers: { 'cf-access-jwt-assertion': t } } : {});

test('geldig token van een toegelaten adres', async () => {
  assert.equal(await beheerder(req(await token({})), env), 'victor@voorbeeld.be');
});
test('ook via de CF_Authorization-cookie', async () => {
  const r = new Request('https://dongo.be/beheer/', { headers: { cookie: `x=1; CF_Authorization=${await token({})}` } });
  assert.equal(await beheerder(r, env), 'victor@voorbeeld.be');
});
test('geen token: geweigerd', async () => assert.equal(await beheerder(req(null), env), null));
test('adres niet op de lijst: geweigerd', async () => assert.equal(await beheerder(req(await token({ email: 'iemand@anders.be' })), env), null));
test('verlopen token: geweigerd', async () => assert.equal(await beheerder(req(await token({ exp: 1000 })), env), null));
test('andere applicatie (aud): geweigerd', async () => assert.equal(await beheerder(req(await token({ aud: ['iets-anders'] })), env), null));
test('ander team (iss): geweigerd', async () => assert.equal(await beheerder(req(await token({ iss: 'https://kwaad.cloudflareaccess.com' })), env), null));
test('vervalste handtekening: geweigerd', async () => {
  const t = await token({});
  const [k, , s] = t.split('.');
  const vals = `${k}.${b64({ iss: TEAM, aud: [AUD], exp: 9e9, email: 'victor@voorbeeld.be' })}.${s}`;
  assert.equal(await beheerder(req(vals), env), null);
});
test('Access niet ingesteld: alles dicht', async () => {
  assert.equal(await beheerder(req(await token({})), { ...env, ACCESS_AUD: '' }), null);
});
test('dev-aanmelding werkt alleen op localhost', async () => {
  const dev = { BEHEER_DEV_EMAIL: 'dev@localhost' };
  assert.equal(await beheerder(req(null, 'localhost:8788'), dev), 'dev@localhost');
  assert.equal(await beheerder(req(null, 'dongo.be'), dev), null);
});

// Access op de Worker zelf: de runtime geeft ctx.access mee.
import { beheerderMetReden } from '../src/lib/auth.js';
const ctxAccess = (email, aud = AUD) => ({ access: { aud, getIdentity: async () => ({ email }) } });

test('Worker-Access: toegelaten adres via ctx.access', async () => {
  assert.equal(await beheerder(req(null), env, ctxAccess('Victor@Voorbeeld.be')), 'victor@voorbeeld.be');
});
test('Worker-Access: adres niet op de lijst', async () => {
  assert.deepEqual(await beheerderMetReden(req(null), env, ctxAccess('iemand@anders.be')), { email: null, reden: 'adres-niet-op-lijst' });
});
test('Worker-Access: andere applicatie', async () => {
  assert.equal((await beheerderMetReden(req(null), env, ctxAccess('victor@voorbeeld.be', 'x'))).reden, 'andere-access-applicatie');
});
test('redenen bij weigering', async () => {
  assert.equal((await beheerderMetReden(req(null), env)).reden, 'geen-login');
  assert.equal((await beheerderMetReden(req(null), { ...env, BEHEER_EMAILS: '' })).reden, 'geen-beheerders-ingesteld');
  assert.equal((await beheerderMetReden(req(null), { BEHEER_EMAILS: 'a@b.be' })).reden, 'access-niet-ingesteld');
});
