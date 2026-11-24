// Zoekmachines en gedeelde links: titel, beschrijving, voorvertoning (Open Graph),
// productgegevens voor Google (schema.org) en de sitemap. Alles wordt op de server in de pagina gezet,
// zodat ook WhatsApp, Facebook en zoekmachines die geen JavaScript draaien het zien.
import { haalProduct, lijstProducten, leesInstellingen } from './db.js';

const attr = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
// JSON in een <script>: "<" escapen zodat tekst uit het beheer de pagina nooit kan breken.
const jsonLd = (o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`;
const kort = (s, n = 158) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s; };

export const siteUrl = (env, request) => (env.SITE_URL || new URL(request.url).origin).replace(/\/$/, '');

function kopHtml({ titel, beschrijving, url, beeld, type = 'website', extra = '' }) {
  return `
<link rel="canonical" href="${attr(url)}">
<meta property="og:site_name" content="Dongo Worsten">
<meta property="og:locale" content="nl_BE">
<meta property="og:type" content="${attr(type)}">
<meta property="og:title" content="${attr(titel)}">
<meta property="og:description" content="${attr(beschrijving)}">
<meta property="og:url" content="${attr(url)}">
${beeld ? `<meta property="og:image" content="${attr(beeld)}">` : ''}
<meta name="twitter:card" content="${beeld ? 'summary_large_image' : 'summary'}">
${extra}`;
}

/** Vervangt titel en beschrijving en voegt de rest toe aan <head>. */
function herschrijf(antwoord, { titel, beschrijving, kop }) {
  return new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(titel); } })
    .on('meta[name="description"]', { element(e) { e.setAttribute('content', beschrijving); } })
    .on('head', { element(e) { e.append(kop, { html: true }); } })
    .transform(antwoord);
}

export async function startpagina(request, env, pagina) {
  const basis = siteUrl(env, request);
  const { teksten, bedrijf } = await leesInstellingen(env.DB, ['teksten', 'bedrijf']);
  const titel = 'Dongo Worsten · ambachtelijke worsten, diepgevroren aan huis';
  const beschrijving = kort(teksten?.hero_tekst || 'Ambachtelijke worsten van Victor Coens, met de hand gemaakt en diepgevroren aan huis geleverd.');
  const organisatie = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: bedrijf?.handelsnaam || 'Dongo Worsten',
    url: `${basis}/`,
    logo: `${basis}/logo-rond.svg`,
    ...(bedrijf?.email ? { email: bedrijf.email } : {}),
    ...(bedrijf?.telefoon ? { telephone: bedrijf.telefoon } : {}),
  };
  return herschrijf(pagina, {
    titel,
    beschrijving,
    kop: kopHtml({ titel, beschrijving, url: `${basis}/`, beeld: `${basis}/foto/grill.jpg`, extra: jsonLd(organisatie) }),
  });
}

/** Productpagina. Geeft null als het product niet (meer) zichtbaar is. */
export async function productpagina(request, env, pagina, slug) {
  const p = await haalProduct(env.DB, 'slug', slug);
  if (!p || !p.zichtbaar) return null;
  const basis = siteUrl(env, request);
  const url = `${basis}/worst/${p.slug}`;
  const titel = `${p.naam} · Dongo Worsten`;
  const beschrijving = kort(p.korte_tekst || `${p.naam}: ambachtelijke worst van Dongo Worsten${p.eenheid ? `, ${p.eenheid.toLowerCase()}` : ''}. Diepgevroren aan huis geleverd.`);
  const beeld = p.fotos[0] ? `${basis}${p.fotos[0].url}` : `${basis}/foto/grill.jpg`;
  const opVoorraad = p.voorraad === null || p.voorraad > 0;
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.naam,
    description: kort(p.korte_tekst || p.omschrijving || p.naam, 500),
    image: p.fotos.length ? p.fotos.map((f) => `${basis}${f.url}`) : [beeld],
    sku: `DW-${p.id}`,
    brand: { '@type': 'Brand', name: 'Dongo Worsten' },
    ...(p.gewicht_gram ? { weight: { '@type': 'QuantitativeValue', value: p.gewicht_gram, unitCode: 'GRM' } } : {}),
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'EUR',
      price: (p.prijs_cent / 100).toFixed(2),
      availability: opVoorraad ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      seller: { '@type': 'Organization', name: 'Dongo Worsten' },
    },
  };
  return herschrijf(pagina, {
    titel,
    beschrijving,
    kop: kopHtml({ titel, beschrijving, url, beeld, type: 'product', extra: jsonLd(product) }),
  });
}

/** Eenvoudige pagina's (voorwaarden, privacy): alleen canonieke link en voorvertoning. */
export function gewonePagina(request, env, pagina, { titel, beschrijving }) {
  const basis = siteUrl(env, request);
  const url = `${basis}${new URL(request.url).pathname}`;
  return herschrijf(pagina, { titel, beschrijving, kop: kopHtml({ titel, beschrijving, url, beeld: `${basis}/foto/grill.jpg` }) });
}

export function robots(request, env) {
  const basis = siteUrl(env, request);
  return new Response(
    `User-agent: *\nDisallow: /beheer\nDisallow: /api/\nDisallow: /mandje\nDisallow: /bedankt\n\nSitemap: ${basis}/sitemap.xml\n`,
    { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } },
  );
}

export async function sitemap(request, env) {
  const basis = siteUrl(env, request);
  const producten = await lijstProducten(env.DB, { alleenZichtbaar: true });
  const regels = [
    { loc: `${basis}/`, prio: '1.0' },
    ...producten.map((p) => ({ loc: `${basis}/worst/${p.slug}`, lastmod: String(p.gewijzigd || '').slice(0, 10), prio: '0.8' })),
    { loc: `${basis}/voorwaarden`, prio: '0.2' },
    { loc: `${basis}/privacy`, prio: '0.2' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${regels.map((r) => `  <url><loc>${attr(r.loc)}</loc>${r.lastmod ? `<lastmod>${attr(r.lastmod)}</lastmod>` : ''}<priority>${r.prio}</priority></url>`).join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

