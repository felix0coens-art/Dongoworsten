// Mollie: betaling aanmaken en status opvragen.
// MOLLIE_API_KEY staat als geheim in Cloudflare. MOLLIE_API_BASE is alleen voor lokaal testen
// met de nagebootste Mollie (tests/nep-mollie.js) en werkt niet buiten localhost.

function basis(env, eigenUrl) {
  const lokaal = ['localhost', '127.0.0.1'].includes(new URL(eigenUrl).hostname);
  return lokaal && env.MOLLIE_API_BASE ? env.MOLLIE_API_BASE : 'https://api.mollie.com';
}

async function verzoek(env, eigenUrl, pad, opties = {}) {
  if (!env.MOLLIE_API_KEY) throw new Error('MOLLIE_API_KEY ontbreekt');
  const res = await fetch(`${basis(env, eigenUrl)}/v2${pad}`, {
    ...opties,
    headers: { authorization: `Bearer ${env.MOLLIE_API_KEY}`, 'content-type': 'application/json', ...(opties.headers || {}) },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mollie ${res.status}: ${data.detail || data.title || 'onbekende fout'}`);
  return data;
}

export const centNaarMollie = (cent) => (cent / 100).toFixed(2);

export function maakBetaling(env, eigenUrl, { totaal_cent, omschrijving, redirectUrl, webhookUrl, metadata }) {
  return verzoek(env, eigenUrl, '/payments', {
    method: 'POST',
    body: JSON.stringify({
      amount: { currency: 'EUR', value: centNaarMollie(totaal_cent) },
      description: omschrijving,
      redirectUrl,
      webhookUrl,
      locale: 'nl_BE',
      metadata,
      // Geen "method": Mollie toont de betaalmethoden die Victor in zijn Mollie-account aanzet.
    }),
  });
}

export function haalBetaling(env, eigenUrl, id) {
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) throw new Error('Ongeldig betaal-id');
  return verzoek(env, eigenUrl, `/payments/${id}`);
}
