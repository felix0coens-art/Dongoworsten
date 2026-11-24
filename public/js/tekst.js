// Algemene voorwaarden en privacyverklaring, zoals ingevuld in het beheer.
import { winkelInfo, startPagina, tekstNaarHtml, esc } from './winkel.js';

startPagina();
const doel = document.getElementById('tekst');
(async () => {
  try {
    const { teksten } = await winkelInfo();
    const t = teksten?.[doel.dataset.sleutel];
    doel.innerHTML = `<h1>${esc(doel.dataset.titel)}</h1>` + (t ? tekstNaarHtml(t) : '<p>Deze tekst volgt binnenkort.</p>');
  } catch {
    doel.innerHTML = `<h1>${esc(doel.dataset.titel)}</h1><p class="foutblok">De tekst kon niet geladen worden. Herlaad de pagina.</p>`;
  }
})();
