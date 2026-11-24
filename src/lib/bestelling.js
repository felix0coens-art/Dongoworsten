// Het mandje narekenen en een bestelling controleren.
// Alles hier gebeurt op de server, met de prijzen uit de database. Wat de browser stuurt,
// is alleen: welk product, hoeveel, en de gegevens van de klant.
import { Ongeldig } from './http.js';

export const MAX_REGELS = 30;
export const MAX_AANTAL = 50;

/** Leest het mandje uit de browser: [{ id, aantal }]. Gooit Ongeldig bij rommel. */
export function leesMandje(regels) {
  if (!Array.isArray(regels) || regels.length === 0) throw new Ongeldig({ mandje: 'Je mandje is leeg.' });
  if (regels.length > MAX_REGELS) throw new Ongeldig({ mandje: 'Te veel verschillende producten in één bestelling.' });
  const per = new Map();
  for (const r of regels) {
    const id = r?.id, aantal = r?.aantal;
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(aantal) || aantal < 1 || aantal > MAX_AANTAL) {
      throw new Ongeldig({ mandje: 'Er staat iets vreemds in je mandje. Leeg het en probeer opnieuw.' });
    }
    per.set(id, (per.get(id) || 0) + aantal);
  }
  return [...per].map(([id, aantal]) => ({ id, aantal }));
}

/**
 * Rekent het mandje uit.
 * @param regels    [{ id, aantal }] uit leesMandje
 * @param producten Map id -> product (uit de database, met prijs_cent, voorraad, zichtbaar, naam, eenheid)
 * @param levering  'leveren' | 'afhalen' | null (null = nog niet gekozen; leverkost dan voor leveren)
 * @param postcode  enkel bij leveren
 * @param instelling de instelling "levering"
 * @returns { regels, subtotaal_cent, leverkost_cent, totaal_cent, problemen: { veld: tekst } }
 */
export function rekenMandje({ regels, producten, levering, postcode, instelling }) {
  const problemen = {};
  const uit = [];
  let subtotaal = 0;

  for (const { id, aantal } of regels) {
    const p = producten.get(id);
    if (!p || !p.zichtbaar) {
      problemen[`regel-${id}`] = 'Dit product is niet meer te koop.';
      continue;
    }
    if (p.voorraad !== null && p.voorraad < aantal) {
      problemen[`regel-${id}`] = p.voorraad === 0 ? `${p.naam} is uitverkocht.` : `Van ${p.naam} zijn er nog maar ${p.voorraad}.`;
    }
    const lijn = p.prijs_cent * aantal;
    subtotaal += lijn;
    uit.push({ id, naam: p.naam, eenheid: p.eenheid, prijs_cent: p.prijs_cent, aantal, totaal_cent: lijn });
  }

  const wijze = levering ?? (instelling.leveren_aan ? 'leveren' : 'afhalen');
  let leverkost = 0;
  if (wijze === 'leveren') {
    if (!instelling.leveren_aan) problemen.levering = 'Leveren aan huis is op dit moment niet mogelijk.';
    const gratis = instelling.gratis_vanaf_cent !== null && subtotaal >= instelling.gratis_vanaf_cent;
    leverkost = gratis ? 0 : instelling.leverkost_cent;
    if (instelling.minimum_cent && subtotaal < instelling.minimum_cent) {
      problemen.minimum = `Om te leveren moet je bestelling minstens ${euro(instelling.minimum_cent)} zijn.`;
    }
    if (postcode && instelling.postcodes.length && !instelling.postcodes.includes(postcode)) {
      problemen.postcode = 'We leveren (nog) niet in deze postcode.';
    }
  } else if (wijze === 'afhalen') {
    if (!instelling.afhalen_aan) problemen.levering = 'Afhalen is op dit moment niet mogelijk.';
  } else {
    problemen.levering = 'Kies leveren of afhalen.';
  }

  return {
    regels: uit,
    levering: wijze,
    subtotaal_cent: subtotaal,
    leverkost_cent: leverkost,
    totaal_cent: subtotaal + leverkost,
    gratis_vanaf_cent: wijze === 'leveren' ? instelling.gratis_vanaf_cent : null,
    problemen,
  };
}

function tekst(v, max) {
  return typeof v === 'string' ? v.trim().slice(0, max + 1) : '';
}

/** Controleert de klantgegevens bij het afrekenen. */
export function controleerKlant(k, levering) {
  const f = {};
  const uit = {
    naam: tekst(k?.naam, 100),
    email: tekst(k?.email, 200).toLowerCase(),
    telefoon: tekst(k?.telefoon, 30),
    straat: tekst(k?.straat, 150),
    postcode: tekst(k?.postcode, 4),
    gemeente: tekst(k?.gemeente, 80),
    opmerking: tekst(k?.opmerking, 500),
  };
  if (uit.naam.length < 2 || uit.naam.length > 100) f.naam = 'Vul je naam in.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(uit.email) || uit.email.length > 200) f.email = 'Vul een geldig e-mailadres in.';
  const cijfers = uit.telefoon.replace(/\D/g, '');
  if (!/^[0-9+ ()/.-]+$/.test(uit.telefoon) || cijfers.length < 8 || cijfers.length > 15) f.telefoon = 'Vul een telefoonnummer in, bv. 0470 12 34 56.';
  if (levering === 'leveren') {
    if (uit.straat.length < 3 || uit.straat.length > 150) f.straat = 'Vul straat en huisnummer in.';
    if (!/^[1-9]\d{3}$/.test(uit.postcode)) f.postcode = 'Vul een Belgische postcode in (4 cijfers).';
    if (uit.gemeente.length < 2 || uit.gemeente.length > 80) f.gemeente = 'Vul de gemeente in.';
  } else {
    uit.straat = ''; uit.postcode = ''; uit.gemeente = '';
  }
  if (uit.opmerking.length > 500) f.opmerking = 'Maximaal 500 tekens.';
  if (k?.akkoord !== true) f.akkoord = 'Ga akkoord met de algemene voorwaarden om te bestellen.';
  if (Object.keys(f).length) throw new Ongeldig(f);
  return uit;
}

export function euro(cent) {
  return '€ ' + (cent / 100).toFixed(2).replace('.', ',');
}

export function bestelnummer(id, datum = new Date()) {
  return `DW-${datum.getUTCFullYear()}-${String(id).padStart(4, '0')}`;
}
