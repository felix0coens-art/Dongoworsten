// Productpagina: /worst/<slug>. Ingrediënten en allergenen staan zichtbaar vóór de knop om te kopen.
import { api, winkelInfo, startPagina, productKaart, mandje, melding, esc, euro, metVet, tekstNaarHtml } from './winkel.js';

startPagina();
const doel = document.getElementById('product');
const slug = decodeURIComponent(location.pathname.split('/')[2] || '');

function galerij(p) {
  if (!p.fotos.length) return '<div class="gallery"><div class="photo main"></div></div>';
  const eerste = p.fotos[0];
  return `<div class="gallery">
    <figure class="photo main has-img" style="margin:0"><img id="hoofdfoto" src="${esc(eerste.url)}" alt="${esc(eerste.alt || p.naam)}"></figure>
    ${p.fotos.length > 1 ? `<div class="thumbs" role="group" aria-label="Foto's">${p.fotos.map((f, i) => `
      <button type="button" data-foto="${i}" aria-label="Foto ${i + 1}" aria-current="${i === 0}"><div class="photo has-img"><img src="${esc(f.url)}" alt="" loading="lazy"></div></button>`).join('')}</div>` : ''}
  </div>`;
}

function allergeenBlok(p, namen) {
  const n = (s) => namen.get(s) || s;
  if (!p.bevat.length && !p.sporen.length) {
    return `<div class="allergy" role="note"><span class="dot" aria-hidden="true">✓</span><div><strong>Bevat geen van de 14 allergenen</strong><p>Alle ingrediënten staan hieronder.</p></div></div>`;
  }
  return `<div class="allergy" role="note"><span class="dot" aria-hidden="true">!</span><div>
    <strong>${p.bevat.length ? `Bevat: ${esc(p.bevat.map(n).join(', ').toLowerCase())}` : 'Bevat geen van de 14 allergenen'}</strong>
    <p>${p.sporen.length ? `Kan sporen bevatten van ${esc(p.sporen.map(n).join(', ').toLowerCase())}. ` : ''}Alle ingrediënten staan hieronder.</p>
  </div></div>`;
}

function render(p, winkel, anderen) {
  const namen = new Map(winkel.allergenen.map((a) => [a.sleutel, a.naam]));
  const l = winkel.levering;
  document.title = `${p.naam} · Dongo Worsten`;
  const stappen = p.bereiden.split('\n').map((s) => s.trim()).filter(Boolean);

  doel.innerHTML = `
  <div class="wrap">
    <p class="crumbs"><a href="/#worsten">Worsten</a> / ${esc(p.naam)}</p>
    <div class="pdp">
      ${galerij(p)}
      <div class="buy">
        <div class="chips">${p.diepvries ? '<span class="chip ice">Diepgevroren</span>' : ''}${!p.op_voorraad ? '<span class="chip sold">Uitverkocht</span>' : p.bijna_op ? '<span class="chip bijna">Bijna op</span>' : ''}</div>
        <h1>${esc(p.naam)}</h1>
        ${p.korte_tekst ? `<p class="lead">${esc(p.korte_tekst)}</p>` : ''}
        <div class="price-row">
          <span class="price">${euro(p.prijs_cent)}</span>
          <span class="unit">${esc([p.eenheid, p.gewicht_gram ? `± ${p.gewicht_gram} g` : ''].filter(Boolean).join(' · '))}<br>
          ${p.kiloprijs_cent ? `${euro(p.kiloprijs_cent)} per kg · ` : ''}incl. ${winkel.bedrijf?.btw_procent ?? 6} % btw</span>
        </div>
        ${allergeenBlok(p, namen)}
        ${p.op_voorraad ? `
        <form class="order" id="bestel">
          <div class="qty">
            <button type="button" id="min" aria-label="Eén minder">−</button>
            <input id="aantal" name="aantal" type="number" inputmode="numeric" min="1" max="50" value="1" aria-label="Aantal">
            <button type="button" id="plus" aria-label="Eén meer">+</button>
          </div>
          <button class="btn" type="submit">In mijn mandje</button>
        </form>` : '<p class="foutblok">Deze worst is uitverkocht. Kijk binnenkort opnieuw.</p>'}
        <ul class="facts">
          ${p.op_voorraad ? `<li class="stock">${p.bijna_op ? 'Bijna op: nog een paar in de vriezer' : 'Op voorraad'}</li>` : ''}
          ${l.leveren_aan ? `<li>Diepgevroren geleverd${l.gratis_vanaf_cent !== null && l.leverkost_cent ? ` · gratis vanaf ${euro(l.gratis_vanaf_cent)}` : ''}</li>` : ''}
          ${l.afhalen_aan ? '<li>Afhalen kan ook</li>' : ''}
          <li>Betalen met Bancontact of kaart</li>
        </ul>
      </div>
    </div>
  </div>

  <section class="details">
    <div class="wrap">
      <div>
        <h2>Ingrediënten</h2>
        <p class="ingr">${metVet(p.ingredienten)}</p>
      </div>
      <div>
        <h2>Allergenen</h2>
        ${p.bevat.length ? `<p><strong>Bevat:</strong></p><ul class="allergens">${p.bevat.map((k) => `<li class="yes">${esc(namen.get(k) || k)}</li>`).join('')}</ul>` : ''}
        ${p.sporen.length ? `<p style="margin-top:12px"><strong>Kan sporen bevatten van:</strong></p><ul class="allergens">${p.sporen.map((k) => `<li class="trace">${esc(namen.get(k) || k)}</li>`).join('')}</ul>` : ''}
        ${!p.bevat.length && !p.sporen.length ? '<p>Bevat geen van de 14 wettelijke allergenen.</p>' : ''}
      </div>
      ${p.bewaren ? `<div><h2>Bewaren</h2><p>${esc(p.bewaren)}</p></div>` : ''}
      ${stappen.length ? `<div><h2>Bereiden</h2><ol class="steps">${stappen.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>` : ''}
      ${p.omschrijving ? `<div class="omschrijving" style="grid-column:1/-1"><h2>Over deze worst</h2>${tekstNaarHtml(p.omschrijving, { titel: 'h3' })}</div>` : ''}
    </div>
  </section>

  ${anderen.length ? `<section class="section"><div class="wrap">
    <div class="section-head"><h2>Ook uit de vriezer</h2></div>
    <div class="grid">${anderen.slice(0, 4).map(productKaart).join('')}</div>
  </div></section>` : ''}`;

  // foto's wisselen
  doel.querySelectorAll('[data-foto]').forEach((b) => b.addEventListener('click', () => {
    const f = p.fotos[Number(b.dataset.foto)];
    const img = document.getElementById('hoofdfoto');
    img.src = f.url; img.alt = f.alt || p.naam;
    doel.querySelectorAll('[data-foto]').forEach((x) => x.setAttribute('aria-current', String(x === b)));
  }));

  // aantal en in mandje
  const form = document.getElementById('bestel');
  if (form) {
    const veld = document.getElementById('aantal');
    const zet = (v) => { veld.value = Math.max(1, Math.min(50, Number.isFinite(v) ? v : 1)); };
    document.getElementById('min').onclick = () => zet(Number(veld.value) - 1);
    document.getElementById('plus').onclick = () => zet(Number(veld.value) + 1);
    veld.addEventListener('change', () => zet(parseInt(veld.value, 10)));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const n = Math.max(1, Math.min(50, parseInt(veld.value, 10) || 1));
      mandje.voegToe(p.id, n);
      melding(`${n} × ${esc(p.naam)} in je mandje. <a href="/mandje">Naar mandje</a>`);
    });
  }
}

(async () => {
  try {
    const [{ product }, winkel, { producten }] = await Promise.all([
      api(`/api/producten/${encodeURIComponent(slug)}`),
      winkelInfo(),
      api('/api/producten'),
    ]);
    render(product, winkel, producten.filter((x) => x.id !== product.id && x.op_voorraad));
  } catch (e) {
    doel.innerHTML = `<div class="wrap section"><div class="leeg-blok"><h2>${e.status === 404 ? 'Deze worst vinden we niet' : 'Dit lukte niet'}</h2>
      <p>${e.status === 404 ? 'Misschien is ze uitverkocht of uit het aanbod gehaald.' : esc(e.bericht || '')}</p><a class="btn" href="/#worsten">Alle worsten</a></div></div>`;
  }
})();
