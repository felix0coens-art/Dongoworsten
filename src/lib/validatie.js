// Controle van alles wat via het beheer binnenkomt. De server vertrouwt nooit de browser.
import { Ongeldig } from './http.js';
import { ALLERGEEN_SLEUTELS } from './allergenen.js';

function tekst(v, veld, fouten, { max = 2000, verplicht = false } = {}) {
  if (v === undefined || v === null) v = '';
  if (typeof v !== 'string') { fouten[veld] = 'Moet tekst zijn.'; return ''; }
  v = v.trim();
  if (verplicht && !v) fouten[veld] = 'Vul dit in.';
  else if (v.length > max) fouten[veld] = `Maximaal ${max} tekens.`;
  return v;
}

function geheel(v, veld, fouten, { min = 0, max = 1_000_000, leegMag = false } = {}) {
  if (leegMag && (v === null || v === undefined || v === '')) return null;
  if (!Number.isInteger(v)) { fouten[veld] = 'Moet een geheel getal zijn.'; return 0; }
  if (v < min || v > max) fouten[veld] = `Moet tussen ${min} en ${max} liggen.`;
  return v;
}

function bool(v, veld, fouten) {
  if (typeof v !== 'boolean') { fouten[veld] = 'Moet aan of uit zijn.'; return false; }
  return v;
}

function allergenenLijst(v, veld, fouten) {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.some((s) => !ALLERGEEN_SLEUTELS.has(s))) {
    fouten[veld] = 'Onbekend allergeen.';
    return [];
  }
  return [...new Set(v)];
}

export function maakSlug(naam) {
  return naam
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'product';
}

export function controleerProduct(p) {
  if (!p || typeof p !== 'object') throw new Ongeldig({ _: 'Geen product ontvangen.' });
  const f = {};
  const uit = {
    naam: tekst(p.naam, 'naam', f, { max: 120, verplicht: true }),
    korte_tekst: tekst(p.korte_tekst, 'korte_tekst', f, { max: 400 }),
    omschrijving: tekst(p.omschrijving, 'omschrijving', f, { max: 4000 }),
    prijs_cent: geheel(p.prijs_cent, 'prijs_cent', f, { min: 1, max: 100_000 }),
    eenheid: tekst(p.eenheid, 'eenheid', f, { max: 60 }),
    gewicht_gram: geheel(p.gewicht_gram, 'gewicht_gram', f, { min: 1, max: 50_000, leegMag: true }),
    ingredienten: tekst(p.ingredienten, 'ingredienten', f, { max: 2000 }),
    bevat: allergenenLijst(p.bevat, 'bevat', f),
    sporen: allergenenLijst(p.sporen, 'sporen', f),
    bewaren: tekst(p.bewaren, 'bewaren', f, { max: 1000 }),
    bereiden: tekst(p.bereiden, 'bereiden', f, { max: 2000 }),
    diepvries: bool(p.diepvries, 'diepvries', f),
    voorraad: geheel(p.voorraad, 'voorraad', f, { min: 0, max: 100_000, leegMag: true }),
    zichtbaar: bool(p.zichtbaar, 'zichtbaar', f),
    volgorde: geheel(p.volgorde ?? 0, 'volgorde', f, { min: 0, max: 10_000 }),
  };
  const dubbel = uit.sporen.filter((s) => uit.bevat.includes(s));
  if (dubbel.length) f.sporen = 'Een allergeen kan niet tegelijk "bevat" en "sporen" zijn.';
  // Wettelijk: ingrediënten moeten gekend zijn voor iemand kan kopen.
  if (uit.zichtbaar && !uit.ingredienten) f.ingredienten = 'Vul de ingrediënten in voor je het product zichtbaar maakt.';
  if (Object.keys(f).length) throw new Ongeldig(f);
  return uit;
}

// ---------- instellingen ----------

function postcodes(v, f) {
  if (!Array.isArray(v)) { f.postcodes = 'Moet een lijst zijn.'; return []; }
  const lijst = [...new Set(v.map((x) => String(x).trim()).filter(Boolean))];
  if (lijst.some((x) => !/^[1-9]\d{3}$/.test(x))) f.postcodes = 'Gebruik Belgische postcodes van 4 cijfers.';
  if (lijst.length > 500) f.postcodes = 'Maximaal 500 postcodes.';
  return lijst;
}

const INSTELLINGEN = {
  levering(w) {
    const f = {};
    const uit = {
      leveren_aan: bool(w.leveren_aan, 'leveren_aan', f),
      leverkost_cent: geheel(w.leverkost_cent, 'leverkost_cent', f, { min: 0, max: 10_000 }),
      gratis_vanaf_cent: geheel(w.gratis_vanaf_cent, 'gratis_vanaf_cent', f, { min: 0, max: 1_000_000, leegMag: true }),
      minimum_cent: geheel(w.minimum_cent ?? 0, 'minimum_cent', f, { min: 0, max: 1_000_000 }),
      postcodes: postcodes(w.postcodes ?? [], f),
      leveren_info: tekst(w.leveren_info, 'leveren_info', f, { max: 1000 }),
      afhalen_aan: bool(w.afhalen_aan, 'afhalen_aan', f),
      afhaal_adres: tekst(w.afhaal_adres, 'afhaal_adres', f, { max: 300 }),
      afhaal_info: tekst(w.afhaal_info, 'afhaal_info', f, { max: 1000 }),
    };
    if (!uit.leveren_aan && !uit.afhalen_aan) f.afhalen_aan = 'Zet leveren of afhalen aan, anders kan niemand bestellen.';
    if (uit.afhalen_aan && !uit.afhaal_adres) f.afhaal_adres = 'Vul het afhaaladres in.';
    if (Object.keys(f).length) throw new Ongeldig(f);
    return uit;
  },
  bedrijf(w) {
    const f = {};
    const uit = {
      naam: tekst(w.naam, 'naam', f, { max: 120, verplicht: true }),
      handelsnaam: tekst(w.handelsnaam, 'handelsnaam', f, { max: 120 }),
      ondernemingsnummer: tekst(w.ondernemingsnummer, 'ondernemingsnummer', f, { max: 20, verplicht: true }),
      adres: tekst(w.adres, 'adres', f, { max: 300 }),
      email: tekst(w.email, 'email', f, { max: 200 }),
      telefoon: tekst(w.telefoon, 'telefoon', f, { max: 40 }),
      btw_procent: geheel(w.btw_procent, 'btw_procent', f, { min: 0, max: 21 }),
    };
    if (uit.ondernemingsnummer && !/^[01]\d{3}\.?\d{3}\.?\d{3}$/.test(uit.ondernemingsnummer.replace(/\s/g, ''))) {
      f.ondernemingsnummer = 'Gebruik de vorm 1234.567.890.';
    }
    if (uit.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uit.email)) f.email = 'Geen geldig e-mailadres.';
    if (Object.keys(f).length) throw new Ongeldig(f);
    return uit;
  },
  teksten(w) {
    const f = {};
    const uit = {
      hero_titel: tekst(w.hero_titel, 'hero_titel', f, { max: 120, verplicht: true }),
      hero_tekst: tekst(w.hero_tekst, 'hero_tekst', f, { max: 600 }),
      verhaal_titel: tekst(w.verhaal_titel, 'verhaal_titel', f, { max: 120 }),
      verhaal_tekst: tekst(w.verhaal_tekst, 'verhaal_tekst', f, { max: 4000 }),
      voorwaarden: tekst(w.voorwaarden, 'voorwaarden', f, { max: 40_000 }),
      privacy: tekst(w.privacy, 'privacy', f, { max: 40_000 }),
    };
    if (Object.keys(f).length) throw new Ongeldig(f);
    return uit;
  },
};

export const INSTELLING_SLEUTELS = Object.keys(INSTELLINGEN);

export function controleerInstelling(sleutel, waarde) {
  const fn = INSTELLINGEN[sleutel];
  if (!fn) throw new Ongeldig({ _: 'Onbekende instelling.' });
  if (!waarde || typeof waarde !== 'object' || Array.isArray(waarde)) throw new Ongeldig({ _: 'Geen gegevens ontvangen.' });
  return fn(waarde);
}
