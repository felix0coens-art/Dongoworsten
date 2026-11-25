// Bestelling aanmaken en doorsturen naar Mollie. Het totaal wordt hier berekend, nooit in de browser.
import { json, fout, leesJson, veilig, Ongeldig } from '../../lib/http.js';
import { leesMandje, rekenMandje, controleerKlant, bestelnummer } from '../../lib/bestelling.js';
import { productenVoorMandje, leveringInstelling } from '../../lib/winkeldata.js';
import { maakBetaling } from '../../lib/mollie.js';
import { testmodus, verlaagVoorraad } from '../../lib/betaling.js';
import { verstuurBestelmails } from '../../lib/mail.js';
import { maakFactuur } from '../../lib/factuur.js';

function code() {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export const onRequestPost = ({ request, env }) =>
  veilig(async () => {
    const eigen = new URL(request.url);
    const origin = request.headers.get('origin');
    if (origin && origin !== eigen.origin) return fout(403, 'Verzoek geweigerd.');

    const body = await leesJson(request, 20_000);
    const regels = leesMandje(body.regels);
    if (!['leveren', 'afhalen'].includes(body.levering)) throw new Ongeldig({ levering: 'Kies leveren of afhalen.' });
    const klant = controleerKlant(body.klant, body.levering);

    const producten = await productenVoorMandje(env.DB, regels.map((r) => r.id));
    const r = rekenMandje({ regels, producten, levering: body.levering, postcode: klant.postcode || null, instelling: await leveringInstelling(env.DB) });
    if (Object.keys(r.problemen).length) return json({ fout: 'Je mandje is intussen veranderd. Kijk het even na.', problemen: r.problemen, mandje: r }, 409);
    const test = testmodus(env);
    if (!test && !env.MOLLIE_API_KEY) return fout(503, 'Online betalen is nog niet ingesteld. Probeer het later opnieuw.');

    const toegangscode = code();
    const nieuw = await env.DB.prepare(
      `INSERT INTO bestellingen (nummer, status, levering, naam, email, telefoon, adres_straat, adres_postcode, adres_gemeente,
         opmerking, subtotaal_cent, leverkost_cent, totaal_cent, toegangscode,
         bedrijf_naam, bedrijf_btw, bedrijf_straat, bedrijf_postcode, bedrijf_gemeente)
       VALUES (?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
    ).bind(`tijdelijk-${toegangscode}`, r.levering, klant.naam, klant.email, klant.telefoon,
      klant.straat || null, klant.postcode || null, klant.gemeente || null, klant.opmerking,
      r.subtotaal_cent, r.leverkost_cent, r.totaal_cent, toegangscode,
      klant.bedrijf_naam, klant.bedrijf_btw, klant.bedrijf_straat, klant.bedrijf_postcode, klant.bedrijf_gemeente).first();
    const nummer = bestelnummer(nieuw.id);
    await env.DB.batch([
      env.DB.prepare('UPDATE bestellingen SET nummer = ? WHERE id = ?').bind(nummer, nieuw.id),
      ...r.regels.map((l) => env.DB.prepare('INSERT INTO bestelregels (bestelling_id, product_id, naam, eenheid, prijs_cent, aantal) VALUES (?, ?, ?, ?, ?, ?)')
        .bind(nieuw.id, l.id, l.naam, l.eenheid, l.prijs_cent, l.aantal)),
    ]);

    const bedankt = `${eigen.origin}/bedankt?b=${encodeURIComponent(nummer)}&c=${toegangscode}`;

    // Testmodus: geen betaling, de bestelling telt meteen als "betaald" maar is overal als TEST gemarkeerd.
    if (test) {
      await env.DB.prepare("UPDATE bestellingen SET status = 'betaald', betaald_op = datetime('now'), mollie_status = 'test', notitie = 'TESTBESTELLING: er werd niets betaald. ' WHERE id = ?")
        .bind(nieuw.id).run();
      await verlaagVoorraad(env, nieuw.id);
      const b = await env.DB.prepare('SELECT * FROM bestellingen WHERE id = ?').bind(nieuw.id).first();
      try { await maakFactuur(env, b); } catch (e) { console.error('Testfactuur niet gemaakt:', e.message); }
      const site = (env.SITE_URL || eigen.origin).replace(/\/$/, '');
      try { await verstuurBestelmails(env, request.url, b, site); } catch (e) { console.error('Testmail niet verstuurd:', e.message); }
      return json({ nummer, betaalUrl: bedankt, test: true });
    }

    let betaling;
    try {
      betaling = await maakBetaling(env, request.url, {
        totaal_cent: r.totaal_cent,
        omschrijving: `Dongo Worsten ${nummer}`,
        redirectUrl: bedankt,
        webhookUrl: `${eigen.origin}/api/mollie/webhook`,
        metadata: { bestelling: nummer },
      });
    } catch (e) {
      console.error('Mollie-betaling niet aangemaakt:', e.message);
      await env.DB.prepare("UPDATE bestellingen SET status = 'mislukt', notitie = 'Betaling kon niet aangemaakt worden.' WHERE id = ?").bind(nieuw.id).run();
      return fout(502, 'Betalen lukt nu even niet. Probeer het over een paar minuten opnieuw.');
    }
    await env.DB.prepare('UPDATE bestellingen SET mollie_id = ?, mollie_status = ? WHERE id = ?').bind(betaling.id, betaling.status, nieuw.id).run();
    return json({ nummer, betaalUrl: betaling._links?.checkout?.href });
  });
