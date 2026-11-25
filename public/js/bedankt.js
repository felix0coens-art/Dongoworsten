// Na het betalen komt Mollie hier terug. We tonen de status; de server bevestigt de betaling, niet deze pagina.
import { api, startPagina, mandje, esc, euro } from './winkel.js';

startPagina();
const doel = document.getElementById('bedankt');
const q = new URLSearchParams(location.search);
const b = q.get('b') || '', c = q.get('c') || '';
let pogingen = 0;

function overzicht(d) {
  return `<ul class="regels">${d.regels.map((r) => `<li class="regel" style="grid-template-columns:minmax(0,1fr) auto"><div><h3>${esc(r.aantal)} × ${esc(r.naam)}</h3><p class="meta">${esc(r.eenheid)}</p></div><strong>${euro(r.prijs_cent * r.aantal)}</strong></li>`).join('')}</ul>
  <div class="totalen blok">
    <div><span>Worsten</span><span>${euro(d.subtotaal_cent)}</span></div>
    <div><span>${d.levering === 'afhalen' ? 'Afhalen' : 'Levering'}</span><span>${d.leverkost_cent ? euro(d.leverkost_cent) : 'gratis'}</span></div>
    <div class="totaal"><span>${d.test ? 'Totaal (test)' : 'Betaald'}</span><span>${euro(d.totaal_cent)}</span></div>
  </div>`;
}

async function kijk() {
  let d;
  try {
    d = await api(`/api/bestelling?b=${encodeURIComponent(b)}&c=${encodeURIComponent(c)}`);
  } catch (e) {
    doel.innerHTML = `<h1>Bestelling niet gevonden</h1><p class="lead">${e.status === 404 ? 'Deze link klopt niet (meer).' : esc(e.bericht)}</p><a class="btn" href="/">Naar de winkel</a>`;
    return;
  }
  const voornaam = esc(d.naam.split(' ')[0]);
  if (['betaald', 'klaargezet', 'geleverd'].includes(d.status)) {
    mandje.leeg();
    try { sessionStorage.removeItem('dongo-afrekenen'); } catch { /* niet erg */ }
    doel.innerHTML = `<p class="eyebrow">Bestelling ${esc(d.nummer)}</p><h1>Bedankt, ${voornaam}!</h1>
      ${d.test ? '<p class="foutblok">Dit was een testbestelling: er werd niets betaald en er wordt niets geleverd.</p>' : ''}
      <p class="lead">${d.test ? 'Je testbestelling is ontvangen.' : 'Je betaling is gelukt.'} ${d.levering === 'afhalen' ? 'We nemen contact op om een afhaalmoment af te spreken.' : 'We nemen contact op om een levermoment af te spreken. Je worsten komen diepgevroren aan.'}</p>
      ${overzicht(d)}
      ${d.factuur ? `<p><a class="link-arrow" href="/api/factuur?b=${encodeURIComponent(b)}&c=${encodeURIComponent(c)}" target="_blank" rel="noopener">Download je factuur ${esc(d.factuur)} (PDF)</a>${d.bedrijf ? `<br>De elektronische factuur op naam van ${esc(d.bedrijf)} ontvang je ook via Peppol.` : ''}</p>` : ''}
      <a class="btn ghost" href="/">Terug naar de winkel</a>`;
  } else if (d.status === 'open') {
    pogingen++;
    doel.innerHTML = `<p class="eyebrow">Bestelling ${esc(d.nummer)}</p><h1>Even geduld…</h1>
      <p class="status"><span class="draai" aria-hidden="true"></span>We wachten op de bevestiging van je betaling.</p>
      ${pogingen > 20 ? '<p class="lead">Dit duurt langer dan normaal. Herlaad deze pagina binnen een paar minuten. Betaalde je al? Dan is je bestelling niet verloren.</p>' : ''}`;
    if (pogingen <= 20) setTimeout(kijk, 3000);
  } else if (d.status === 'mislukt') {
    doel.innerHTML = `<p class="eyebrow">Bestelling ${esc(d.nummer)}</p><h1>Betaling niet gelukt</h1>
      <p class="lead">Er is niets afgeschreven. Je mandje staat nog klaar, zodat je het opnieuw kunt proberen.</p>
      <a class="btn" href="/mandje">Terug naar je mandje</a>`;
  } else {
    doel.innerHTML = `<p class="eyebrow">Bestelling ${esc(d.nummer)}</p><h1>Deze bestelling is geannuleerd</h1><a class="btn" href="/">Naar de winkel</a>`;
  }
}
kijk();
