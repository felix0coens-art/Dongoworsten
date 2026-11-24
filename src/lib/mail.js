// Mails na een betaalde bestelling: een bevestiging naar de klant en een melding naar de winkel.
// Verstuurd via Resend (RESEND_API_KEY als geheim in Cloudflare). Zonder sleutel wordt er niets verstuurd.
// RESEND_API_BASE is alleen voor lokaal testen met de nagebootste dienst en werkt niet buiten localhost.
import { leesInstellingen } from './db.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const euro = (cent) => '€ ' + (cent / 100).toFixed(2).replace('.', ',');

function basis(env, eigenUrl) {
  const lokaal = ['localhost', '127.0.0.1'].includes(new URL(eigenUrl).hostname);
  return lokaal && env.RESEND_API_BASE ? env.RESEND_API_BASE : 'https://api.resend.com';
}

async function verstuur(env, eigenUrl, { naar, onderwerp, html, tekst, antwoordAan, sleutel }) {
  const res = await fetch(`${basis(env, eigenUrl)}/emails`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
      // Zelfde sleutel = Resend verstuurt deze mail maar één keer, ook bij een tweede poging.
      'idempotency-key': sleutel,
    },
    body: JSON.stringify({
      from: env.MAIL_VAN || 'Dongo Worsten <bestellingen@dongoworsten.be>',
      to: [naar],
      subject: onderwerp,
      html,
      text: tekst,
      ...(antwoordAan ? { reply_to: antwoordAan } : {}),
    }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(`Resend ${res.status}: ${d.message || d.name || 'onbekende fout'}`);
  }
}

// ---------- inhoud ----------

function regelsTabel(b, regels) {
  const rij = (links, rechts, vet = false) =>
    `<tr><td style="padding:6px 0;${vet ? 'font-weight:700;font-size:18px;border-top:2px solid #141615;' : ''}">${links}</td><td style="padding:6px 0;text-align:right;white-space:nowrap;${vet ? 'font-weight:700;font-size:18px;border-top:2px solid #141615;' : ''}">${rechts}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:15px">
    ${regels.map((r) => rij(`${esc(r.aantal)} × ${esc(r.naam)}${r.eenheid ? `<br><span style="color:#4A5357;font-size:13px">${esc(r.eenheid)}</span>` : ''}`, euro(r.prijs_cent * r.aantal))).join('')}
    ${rij(b.levering === 'afhalen' ? 'Afhalen' : 'Levering', b.leverkost_cent ? euro(b.leverkost_cent) : 'gratis')}
    ${rij('Totaal (incl. btw)', euro(b.totaal_cent), true)}
  </table>`;
}

function regelsTekst(b, regels) {
  return [
    ...regels.map((r) => `${r.aantal} x ${r.naam}${r.eenheid ? ` (${r.eenheid})` : ''}: ${euro(r.prijs_cent * r.aantal)}`),
    `${b.levering === 'afhalen' ? 'Afhalen' : 'Levering'}: ${b.leverkost_cent ? euro(b.leverkost_cent) : 'gratis'}`,
    `Totaal (incl. btw): ${euro(b.totaal_cent)}`,
  ].join('\n');
}

function omhulsel(titel, inhoud, voet) {
  return `<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(titel)}</title></head>
<body style="margin:0;background:#D9EBF2;font-family:Helvetica,Arial,sans-serif;color:#141615">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:3px solid #141615;border-radius:16px">
<tr><td style="padding:24px 24px 8px"><div style="font-size:13px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#E95D7C">Dongo Worsten</div>
<h1 style="margin:8px 0 0;font-size:26px;line-height:1.15">${esc(titel)}</h1></td></tr>
<tr><td style="padding:8px 24px 24px;font-size:15px;line-height:1.55">${inhoud}</td></tr>
</table>
<p style="max-width:560px;font-size:12px;color:#4A5357;line-height:1.5;margin:16px auto 0">${voet}</p>
</td></tr></table></body></html>`;
}

const TEST_BANNER = '<p style="background:#FBE3E9;border:2px dashed #E95D7C;border-radius:8px;padding:8px 12px;font-weight:700">TESTBESTELLING: er werd niets betaald en er wordt niets geleverd.</p>';

export function mailKlant(b, regels, { bedrijf, levering }, siteUrl) {
  const voornaam = String(b.naam).split(' ')[0];
  const test = b.mollie_status === 'test';
  const plaats = b.levering === 'afhalen'
    ? `<p><strong>Afhalen</strong><br>${esc(levering?.afhaal_adres)}${levering?.afhaal_info ? `<br>${esc(levering.afhaal_info)}` : ''}</p>`
    : `<p><strong>Leveren aan</strong><br>${esc(b.naam)}<br>${esc(b.adres_straat)}<br>${esc(b.adres_postcode)} ${esc(b.adres_gemeente)}</p>`;
  const contact = [bedrijf?.email, bedrijf?.telefoon].filter(Boolean).map(esc).join(' · ');
  const voet = [
    esc(bedrijf?.handelsnaam || 'Dongo Worsten'), esc(bedrijf?.naam), bedrijf?.ondernemingsnummer && `ondernemingsnummer ${esc(bedrijf.ondernemingsnummer)}`, bedrijf?.adres && esc(bedrijf.adres),
  ].filter(Boolean).join(' · ') + `<br>Bederfelijke voeding: geen herroepingsrecht. <a href="${siteUrl}/voorwaarden" style="color:#4A5357">Algemene voorwaarden</a>`;

  const html = omhulsel(`Bedankt, ${voornaam}!`, `
    ${test ? TEST_BANNER : ''}
    <p>${test ? 'Je testbestelling is ontvangen.' : 'Je betaling is gelukt.'} Dit is je bestelling <strong>${esc(b.nummer)}</strong>:</p>
    ${regelsTabel(b, regels)}
    ${plaats}
    <p>${b.levering === 'afhalen' ? 'We nemen contact met je op om een afhaalmoment af te spreken.' : 'We nemen contact met je op om een levermoment af te spreken. Je worsten komen diepgevroren aan: leg ze meteen in de diepvriezer.'}</p>
    <p>Vragen? Antwoord gewoon op deze mail${contact ? ` of contacteer ons via ${contact}` : ''}.</p>`, voet);

  const tekst = [
    ...(test ? ['TESTBESTELLING: er werd niets betaald en er wordt niets geleverd.', ''] : []),
    `Bedankt, ${voornaam}!`, '', `${test ? 'Je testbestelling is ontvangen.' : 'Je betaling is gelukt.'} Dit is je bestelling ${b.nummer}:`, '', regelsTekst(b, regels), '',
    b.levering === 'afhalen' ? `Afhalen: ${levering?.afhaal_adres || ''}` : `Leveren aan: ${b.adres_straat}, ${b.adres_postcode} ${b.adres_gemeente}`,
    '', b.levering === 'afhalen' ? 'We nemen contact met je op om een afhaalmoment af te spreken.' : 'We nemen contact met je op om een levermoment af te spreken. Je worsten komen diepgevroren aan.',
    '', 'Vragen? Antwoord gewoon op deze mail.', '', 'Dongo Worsten', `${siteUrl}/voorwaarden`,
  ].join('\n');
  return { onderwerp: `${test ? '[TEST] ' : ''}Bedankt voor je bestelling ${b.nummer}`, html, tekst };
}

export function mailWinkel(b, regels, siteUrl) {
  const link = `${siteUrl}/beheer/#bestelling/${b.id}`;
  const test = b.mollie_status === 'test';
  const html = omhulsel(`Nieuwe bestelling ${b.nummer}`, `
    ${test ? TEST_BANNER : ''}
    <p><strong>${esc(b.naam)}</strong><br><a href="mailto:${esc(b.email)}">${esc(b.email)}</a><br><a href="tel:${esc(String(b.telefoon).replace(/[^0-9+]/g, ''))}">${esc(b.telefoon)}</a></p>
    <p><strong>${b.levering === 'afhalen' ? 'Komt afhalen' : 'Leveren aan'}</strong>${b.levering === 'leveren' ? `<br>${esc(b.adres_straat)}<br>${esc(b.adres_postcode)} ${esc(b.adres_gemeente)}` : ''}</p>
    ${b.opmerking ? `<p><strong>Opmerking</strong><br>${esc(b.opmerking)}</p>` : ''}
    ${regelsTabel(b, regels)}
    ${b.notitie ? `<p style="background:#FBE3E9;padding:8px 12px;border-radius:8px"><strong>Let op:</strong> ${esc(b.notitie)}</p>` : ''}
    <p><a href="${link}" style="display:inline-block;background:#E95D7C;color:#141615;font-weight:700;text-decoration:none;padding:10px 20px;border:2px solid #141615;border-radius:999px">Open in het beheer</a></p>`,
    'Deze melding komt van de webwinkel van Dongo Worsten.');
  const tekst = [
    `Nieuwe bestelling ${b.nummer}`, '', b.naam, b.email, b.telefoon, '',
    b.levering === 'afhalen' ? 'Komt afhalen' : `Leveren aan: ${b.adres_straat}, ${b.adres_postcode} ${b.adres_gemeente}`,
    b.opmerking ? `\nOpmerking: ${b.opmerking}` : '', '', regelsTekst(b, regels), b.notitie ? `\nLet op: ${b.notitie}` : '', '', link,
  ].join('\n');
  return { onderwerp: `${test ? '[TEST] ' : ''}Nieuwe bestelling ${b.nummer} – ${b.naam} – ${euro(b.totaal_cent)}`, html, tekst };
}

/**
 * Verstuurt beide mails voor een betaalde bestelling, maar één keer (kolom mails_verstuurd).
 * Lukt het niet, dan blijft de vlag op 0 en probeert de volgende melding van Mollie het opnieuw.
 */
export async function verstuurBestelmails(env, eigenUrl, b, siteUrl) {
  if (!env.RESEND_API_KEY) { console.log('Geen RESEND_API_KEY: geen mails verstuurd voor', b.nummer); return false; }
  if (!['betaald', 'klaargezet', 'geleverd'].includes(b.status) || b.mails_verstuurd) return false;

  const { results: regels } = await env.DB.prepare('SELECT naam, eenheid, prijs_cent, aantal FROM bestelregels WHERE bestelling_id = ?').bind(b.id).all();
  const inst = await leesInstellingen(env.DB, ['bedrijf', 'levering']);
  const winkelAdres = inst.bedrijf?.email;

  const klant = mailKlant(b, regels, inst, siteUrl);
  await verstuur(env, eigenUrl, { naar: b.email, ...klant, antwoordAan: winkelAdres, sleutel: `bestelling-${b.id}-klant` });
  if (winkelAdres) {
    const winkel = mailWinkel(b, regels, siteUrl);
    await verstuur(env, eigenUrl, { naar: winkelAdres, ...winkel, antwoordAan: b.email, sleutel: `bestelling-${b.id}-winkel` });
  }
  await env.DB.prepare('UPDATE bestellingen SET mails_verstuurd = 1 WHERE id = ?').bind(b.id).run();
  return true;
}
