// Facturen van de webwinkel: aanmaken (één per betaalde bestelling, doorlopende nummering),
// opmaken als PDF, en de maandexport voor de boekhouding (Accountable).
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { leesInstellingen } from './db.js';

// ---------- btw ----------

/** Splitst een bedrag inclusief btw in maatstaf (zonder btw) en btw. */
export function splitsBtw(totaalCent, procent) {
  const maatstaf = Math.round((totaalCent * 100) / (100 + procent));
  return { maatstaf_cent: maatstaf, btw_cent: totaalCent - maatstaf };
}

/** Belgisch btw-nummer: BE + 10 cijfers, beginnend met 0 of 1, met geldige controle (mod 97). Geeft "BE0123456789" of null. */
export function normaliseerBtw(invoer) {
  const s = String(invoer || '').toUpperCase().replace(/[\s.\-]/g, '');
  const m = s.match(/^(BE)?([01]\d{9})$/);
  if (!m) return null;
  const cijfers = m[2];
  const basis = Number(cijfers.slice(0, 8));
  const controle = Number(cijfers.slice(8));
  if (97 - (basis % 97) !== controle) return null;
  return `BE${cijfers}`;
}

export const toonBtw = (btw) => (btw && /^BE\d{10}$/.test(btw) ? `BE ${btw.slice(2, 6)}.${btw.slice(6, 9)}.${btw.slice(9)}` : btw || '');

// Datum in België (de factuurdatum hoort bij de Belgische kalenderdag).
export function belgischeDatum(d = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Brussels', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

// ---------- aanmaken ----------

/**
 * Maakt de factuur voor een betaalde bestelling, als die er nog niet is. Veilig om vaker aan te roepen.
 * Het nummer wordt in één SQL-opdracht bepaald en ingevoegd, zodat er geen gaten of dubbele nummers ontstaan.
 */
export async function maakFactuur(env, b) {
  const bestaand = await env.DB.prepare('SELECT * FROM facturen WHERE bestelling_id = ?').bind(b.id).first();
  if (bestaand) return bestaand;
  if (!['betaald', 'klaargezet', 'geleverd'].includes(b.status)) return null;

  const { bedrijf } = await leesInstellingen(env.DB, ['bedrijf']);
  const { results: regels } = await env.DB.prepare('SELECT naam, eenheid, prijs_cent, aantal FROM bestelregels WHERE bestelling_id = ? ORDER BY id').bind(b.id).all();
  const procent = Number.isInteger(bedrijf?.btw_procent) ? bedrijf.btw_procent : 6;
  const reeks = b.mollie_status === 'test' ? 'TEST' : 'W';
  const datum = belgischeDatum();
  const jaar = Number(datum.slice(0, 4));
  const b2b = !!b.bedrijf_naam;
  const { maatstaf_cent, btw_cent } = splitsBtw(b.totaal_cent, procent);

  const gegevens = {
    verkoper: {
      naam: bedrijf?.handelsnaam || 'Dongo Worsten',
      eigenaar: bedrijf?.naam || '',
      adres: bedrijf?.adres || '',
      btw: bedrijf?.ondernemingsnummer ? `BE ${bedrijf.ondernemingsnummer}` : '',
      email: bedrijf?.email || '',
      telefoon: bedrijf?.telefoon || '',
    },
    klant: b2b
      ? { naam: b.bedrijf_naam, contact: b.naam, btw: toonBtw(b.bedrijf_btw), adres: [b.bedrijf_straat, `${b.bedrijf_postcode} ${b.bedrijf_gemeente}`.trim()].filter(Boolean), email: b.email }
      : { naam: b.naam, adres: b.levering === 'leveren' ? [b.adres_straat, `${b.adres_postcode} ${b.adres_gemeente}`.trim()] : [], email: b.email },
    bestelnummer: b.nummer,
    betaald_op: String(b.betaald_op || '').slice(0, 10),
    levering: b.levering,
    regels: regels.map((r) => ({ naam: r.naam, eenheid: r.eenheid, aantal: r.aantal, prijs_cent: r.prijs_cent, totaal_cent: r.prijs_cent * r.aantal })),
    leverkost_cent: b.leverkost_cent,
    test: reeks === 'TEST',
  };

  try {
    await env.DB.prepare(
      `INSERT INTO facturen (nummer, reeks, jaar, volgnr, bestelling_id, datum, b2b, maatstaf_cent, btw_cent, totaal_cent, btw_procent, gegevens)
       SELECT ?1 || printf('%d', ?2) || '-' || printf('%04d', COALESCE(MAX(volgnr), 0) + 1), ?1, CAST(?2 AS INTEGER), COALESCE(MAX(volgnr), 0) + 1, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
       FROM facturen WHERE reeks = ?1 AND jaar = CAST(?2 AS INTEGER)`,
    ).bind(reeks, jaar, b.id, datum, b2b ? 1 : 0, maatstaf_cent, btw_cent, b.totaal_cent, procent, JSON.stringify(gegevens)).run();
  } catch (e) {
    // Tegelijk aangemaakt door een andere aanvraag? Dan bestaat ze nu al.
    if (!/UNIQUE/i.test(e.message)) throw e;
  }
  return env.DB.prepare('SELECT * FROM facturen WHERE bestelling_id = ?').bind(b.id).first();
}

// ---------- PDF ----------

const euro = (cent) => '€ ' + (cent / 100).toFixed(2).replace('.', ',');
const datumNl = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

export async function factuurPdf(f) {
  const g = JSON.parse(f.gegevens);
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Factuur ${f.nummer}`);
  pdf.setAuthor(g.verkoper.naam);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const gewoon = await pdf.embedFont(StandardFonts.Helvetica);
  const vet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const inkt = rgb(0.08, 0.09, 0.08), grijs = rgb(0.29, 0.33, 0.34), roze = rgb(0.91, 0.36, 0.49);
  const L = 50, R = 545;

  // Alleen tekens die het standaardlettertype kent; de rest vervangen.
  const veilig = (font, t) => [...String(t ?? '')].map((c) => { try { font.encodeText(c); return c; } catch { return c === '−' ? '-' : '?'; } }).join('');
  const tekst = (t, x, y, { font = gewoon, grootte = 10, kleur = inkt, rechts = false } = {}) => {
    const s = veilig(font, t);
    page.drawText(s, { x: rechts ? x - font.widthOfTextAtSize(s, grootte) : x, y, size: grootte, font, color: kleur });
  };
  const breek = (t, font, grootte, breedte) => {
    const woorden = veilig(font, t).split(' '); const regels = []; let r = '';
    for (const w of woorden) { const p = r ? `${r} ${w}` : w; if (font.widthOfTextAtSize(p, grootte) > breedte && r) { regels.push(r); r = w; } else r = p; }
    if (r) regels.push(r);
    return regels;
  };

  let y = 790;
  tekst(g.verkoper.naam.toUpperCase(), L, y, { font: vet, grootte: 11, kleur: roze });
  tekst(g.test ? 'TESTFACTUUR' : 'FACTUUR', R, y, { font: vet, grootte: 20, rechts: true });
  y -= 18;
  for (const r of [g.verkoper.eigenaar, g.verkoper.adres, g.verkoper.btw && `Btw ${g.verkoper.btw}`, g.verkoper.email, g.verkoper.telefoon].filter(Boolean)) {
    tekst(r, L, y, { grootte: 9, kleur: grijs }); y -= 12;
  }

  let ry = 772;
  for (const [k, v] of [['Factuurnummer', f.nummer], ['Factuurdatum', datumNl(f.datum)], ['Bestelling', g.bestelnummer], ['Betaald op', datumNl(g.betaald_op)]]) {
    tekst(k, 400, ry, { grootte: 9, kleur: grijs }); tekst(v, R, ry, { font: vet, grootte: 9, rechts: true }); ry -= 13;
  }

  y = Math.min(y, ry) - 24;
  tekst('Factuur aan', L, y, { font: vet, grootte: 9, kleur: grijs }); y -= 14;
  tekst(g.klant.naam, L, y, { font: vet, grootte: 11 }); y -= 14;
  for (const r of [g.klant.contact && `t.a.v. ${g.klant.contact}`, ...(g.klant.adres || []), g.klant.btw && `Btw ${g.klant.btw}`].filter(Boolean)) {
    tekst(r, L, y); y -= 13;
  }

  if (g.test) {
    y -= 8;
    page.drawRectangle({ x: L, y: y - 6, width: R - L, height: 22, color: rgb(0.98, 0.89, 0.91) });
    tekst('TESTBESTELLING: er werd niets betaald. Deze factuur telt niet mee in de boekhouding.', L + 8, y, { font: vet, grootte: 9 });
    y -= 20;
  }

  // tabel
  y -= 18;
  const kol = { aantal: 330, prijs: 440, totaal: R };
  tekst('Omschrijving', L, y, { font: vet, grootte: 9 });
  tekst('Aantal', kol.aantal, y, { font: vet, grootte: 9, rechts: true });
  tekst('Prijs (incl. btw)', kol.prijs, y, { font: vet, grootte: 9, rechts: true });
  tekst('Totaal (incl. btw)', kol.totaal, y, { font: vet, grootte: 9, rechts: true });
  y -= 6; page.drawLine({ start: { x: L, y }, end: { x: R, y }, thickness: 1.5, color: inkt }); y -= 14;

  const regel = (oms, sub, aantal, prijs, totaal) => {
    const delen = breek(oms, gewoon, 10, 250);
    delen.forEach((d, i) => tekst(d, L, y - i * 12));
    tekst(aantal, kol.aantal, y, { rechts: true }); tekst(prijs, kol.prijs, y, { rechts: true }); tekst(totaal, kol.totaal, y, { rechts: true });
    y -= delen.length * 12;
    if (sub) { tekst(sub, L, y, { grootte: 8, kleur: grijs }); y -= 11; }
    y -= 6;
  };
  for (const r of g.regels) regel(r.naam, r.eenheid, String(r.aantal), euro(r.prijs_cent), euro(r.totaal_cent));
  regel(g.levering === 'afhalen' ? 'Afhalen' : 'Levering', '', '1', euro(g.leverkost_cent), euro(g.leverkost_cent));

  page.drawLine({ start: { x: L, y: y + 4 }, end: { x: R, y: y + 4 }, thickness: 0.5, color: grijs }); y -= 12;
  for (const [k, v, isVet] of [
    [`Maatstaf van heffing ${f.btw_procent} %`, euro(f.maatstaf_cent)],
    [`Btw ${f.btw_procent} %`, euro(f.btw_cent)],
    ['Totaal', euro(f.totaal_cent), true],
  ]) {
    tekst(k, kol.prijs, y, { font: isVet ? vet : gewoon, grootte: isVet ? 12 : 10, rechts: true });
    tekst(v, kol.totaal, y, { font: isVet ? vet : gewoon, grootte: isVet ? 12 : 10, rechts: true });
    y -= isVet ? 18 : 14;
  }
  y -= 10;
  tekst(g.test ? 'Niet betaald (testbestelling).' : `Volledig betaald via de webwinkel op ${datumNl(g.betaald_op)}. Er is niets meer te betalen.`, L, y, { grootte: 9 });
  y -= 13;
  tekst('Bederfelijke voeding: geen herroepingsrecht (art. VI.53, 4° WER).', L, y, { grootte: 9, kleur: grijs });

  tekst(`${g.verkoper.naam} · ${[g.verkoper.adres, g.verkoper.btw && `Btw ${g.verkoper.btw}`].filter(Boolean).join(' · ')}`, L, 40, { grootte: 8, kleur: grijs });
  return pdf.save();
}

// ---------- export ----------

const csvVeld = (v) => { const s = String(v ?? ''); return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const komma = (cent) => (cent / 100).toFixed(2).replace('.', ',');

/** CSV (puntkomma, decimale komma: opent goed in Excel met Belgische instellingen). */
export function facturenCsv(facturen) {
  const kop = ['Factuurnummer', 'Datum', 'Bestelling', 'Klant', 'Btw-nummer klant', 'Bedrijf', 'Maatstaf', 'Btw %', 'Btw', 'Totaal incl. btw', 'Peppol verstuurd'];
  const rijen = facturen.map((f) => {
    const g = JSON.parse(f.gegevens);
    return [f.nummer, datumNl(f.datum), g.bestelnummer, g.klant.naam, g.klant.btw || '', f.b2b ? 'ja' : 'nee', komma(f.maatstaf_cent), f.btw_procent, komma(f.btw_cent), komma(f.totaal_cent), f.b2b ? (f.peppol_verstuurd ? 'ja' : 'nee') : ''];
  });
  const som = (k) => facturen.reduce((s, f) => s + f[k], 0);
  rijen.push([], ['Totaal', '', '', '', '', '', komma(som('maatstaf_cent')), '', komma(som('btw_cent')), komma(som('totaal_cent')), '']);
  return '﻿' + [kop, ...rijen].map((r) => r.map(csvVeld).join(';')).join('\r\n') + '\r\n';
}
