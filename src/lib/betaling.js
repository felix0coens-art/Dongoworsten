// Een Mollie-betaling verwerken. Wordt aangeroepen door de webhook én door de bedankpagina
// (als de webhook nog niet binnen is). Mag dus veilig meerdere keren draaien.
import { haalBetaling, centNaarMollie } from './mollie.js';
import { verstuurBestelmails } from './mail.js';

const MISLUKT = ['canceled', 'expired', 'failed'];

export async function verwerkBetaling(env, eigenUrl, betaalId) {
  const betaling = await haalBetaling(env, eigenUrl, betaalId); // altijd zelf opvragen, nooit het bericht geloven
  const b = await env.DB.prepare('SELECT * FROM bestellingen WHERE mollie_id = ?').bind(betaling.id).first();
  if (!b) return null;

  await env.DB.prepare('UPDATE bestellingen SET mollie_status = ? WHERE id = ?').bind(betaling.status, b.id).run();

  if (betaling.status === 'paid') {
    const bedragKlopt = betaling.amount?.currency === 'EUR' && betaling.amount?.value === centNaarMollie(b.totaal_cent);
    if (!bedragKlopt) {
      await env.DB.prepare("UPDATE bestellingen SET notitie = notitie || ? WHERE id = ? AND notitie NOT LIKE '%Bedrag bij Mollie%'")
        .bind(`Bedrag bij Mollie (${betaling.amount?.value}) wijkt af van de bestelling. Controleer dit. `, b.id).run();
      return { ...b, mollie_status: betaling.status };
    }
    // Alleen de eerste keer van "open" naar "betaald".
    const r = await env.DB.prepare("UPDATE bestellingen SET status = 'betaald', betaald_op = datetime('now') WHERE id = ? AND status = 'open'")
      .bind(b.id).run();
    if (r.meta.changes === 1) await verlaagVoorraad(env, b.id);
  } else if (MISLUKT.includes(betaling.status)) {
    await env.DB.prepare("UPDATE bestellingen SET status = 'mislukt' WHERE id = ? AND status = 'open'").bind(b.id).run();
  }
  const nu = await env.DB.prepare('SELECT * FROM bestellingen WHERE id = ?').bind(b.id).first();
  // Betaald en nog geen mails? Dan nu versturen. Mislukt dat, dan gooit dit een fout en
  // antwoordt de webhook met 500, zodat Mollie het later opnieuw probeert.
  if (nu && !nu.mails_verstuurd && ['betaald', 'klaargezet', 'geleverd'].includes(nu.status)) {
    const site = (env.SITE_URL || new URL(eigenUrl).origin).replace(/\/$/, '');
    if (await verstuurBestelmails(env, eigenUrl, nu, site)) nu.mails_verstuurd = 1;
  }
  return nu;
}

async function verlaagVoorraad(env, bestellingId) {
  const { results } = await env.DB.prepare('SELECT product_id, naam, aantal FROM bestelregels WHERE bestelling_id = ? AND product_id IS NOT NULL')
    .bind(bestellingId).all();
  const tekort = [];
  for (const r of results) {
    const u = await env.DB.prepare('UPDATE producten SET voorraad = voorraad - ? WHERE id = ? AND voorraad IS NOT NULL AND voorraad >= ?')
      .bind(r.aantal, r.product_id, r.aantal).run();
    if (u.meta.changes === 0) {
      const p = await env.DB.prepare('SELECT voorraad FROM producten WHERE id = ?').bind(r.product_id).first();
      if (p && p.voorraad !== null) {
        tekort.push(r.naam);
        await env.DB.prepare('UPDATE producten SET voorraad = 0 WHERE id = ?').bind(r.product_id).run();
      }
    }
  }
  if (tekort.length) {
    await env.DB.prepare('UPDATE bestellingen SET notitie = notitie || ? WHERE id = ?')
      .bind(`Te weinig voorraad bij betaling voor: ${tekort.join(', ')}. `, bestellingId).run();
  }
}
