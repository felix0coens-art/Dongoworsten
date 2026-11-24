// Startpagina: teksten, producten en levering uit het beheer.
import { api, winkelInfo, startPagina, productKaart, esc, euro } from './winkel.js';

startPagina();

// "*woord*" in de titel krijgt de opvallende stijl.
const titelHtml = (t) => esc(t).replace(/\*([^*]+)\*/g, '<em>$1</em>');

function verhaalHtml(tekst) {
  const blokken = String(tekst || '').trim().split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean);
  let html = '', stappen = [];
  const sluitStappen = () => { if (stappen.length) { html += `<ol class="timeline">${stappen.join('')}</ol>`; stappen = []; } };
  for (const b of blokken) {
    if (b.startsWith('## ')) {
      const [kop, ...rest] = b.split('\n');
      stappen.push(`<li><div><h3>${esc(kop.slice(3))}</h3><p>${esc(rest.join(' '))}</p></div></li>`);
    } else if (/^["“„]/.test(b)) {
      sluitStappen();
      html += `<p class="quote">${esc(b)}</p>`;
    } else {
      sluitStappen();
      html += `<p>${esc(b).replace(/\n/g, '<br>')}</p>`;
    }
  }
  sluitStappen();
  return html;
}

function leveringHtml(l) {
  const delen = [];
  if (l.leveren_aan) {
    delen.push(`<div><h3>Diepgevroren, aan huis</h3><p>${esc(l.leveren_info || 'We leveren diepgevroren aan huis.')}</p>
      ${l.postcodes.length ? `<p class="meta">We leveren in: ${esc(l.postcodes.join(', '))}.</p>` : ''}</div>`);
    delen.push(`<div><p class="big">${l.leverkost_cent ? euro(l.leverkost_cent) : 'Gratis'}</p><p>Leverkost${l.gratis_vanaf_cent !== null && l.leverkost_cent ? ` voor bestellingen onder ${euro(l.gratis_vanaf_cent)}` : ''}.</p>
      ${l.minimum_cent ? `<p class="meta">Minimaal bestelbedrag: ${euro(l.minimum_cent)}.</p>` : ''}</div>`);
    if (l.gratis_vanaf_cent !== null && l.leverkost_cent) delen.push(`<div><p class="big">€ 0</p><p>Vanaf ${euro(l.gratis_vanaf_cent)} leveren we gratis.</p></div>`);
  }
  if (l.afhalen_aan) {
    delen.push(`<div><h3>Afhalen</h3><p>${esc(l.afhaal_adres)}</p>${l.afhaal_info ? `<p>${esc(l.afhaal_info)}</p>` : ''}<p class="meta">Afhalen is gratis.</p></div>`);
  }
  return delen.join('');
}

function strookHtml(l) {
  return [
    l.leveren_aan && 'Diepgevroren geleverd',
    l.leveren_aan && l.gratis_vanaf_cent !== null && l.leverkost_cent && `Gratis levering vanaf ${euro(l.gratis_vanaf_cent)}`,
    l.afhalen_aan && 'Afhalen kan ook',
    'Betalen met Bancontact',
    'Kleine reeksen: op is op',
  ].filter(Boolean).map((t) => `<li>${esc(t)}</li>`).join('');
}

(async () => {
  try {
    const { teksten, levering } = await winkelInfo();
    if (teksten?.hero_titel) document.getElementById('hero-titel').innerHTML = titelHtml(teksten.hero_titel);
    document.getElementById('hero-tekst').textContent = teksten?.hero_tekst || '';
    if (teksten?.verhaal_titel) document.getElementById('verhaal-titel').textContent = teksten.verhaal_titel;
    document.getElementById('verhaal-tekst').innerHTML = verhaalHtml(teksten?.verhaal_tekst);
    document.getElementById('levering-blok').innerHTML = leveringHtml(levering);
    document.getElementById('strip').innerHTML = strookHtml(levering);
  } catch { /* standaardteksten blijven staan */ }

  const grid = document.getElementById('product-grid');
  try {
    const { producten } = await api('/api/producten');
    grid.innerHTML = producten.length
      ? producten.map(productKaart).join('')
      : '<div class="leeg-blok" style="grid-column:1/-1"><h2>De vriezer wordt gevuld</h2><p>Er liggen nog geen worsten klaar. Kom snel terug.</p></div>';
  } catch (e) {
    grid.innerHTML = `<p class="foutblok" style="grid-column:1/-1">${esc(e.bericht || 'De worsten konden niet geladen worden.')} Herlaad de pagina.</p>`;
  }
})();
