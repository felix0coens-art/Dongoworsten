// Mandje en afrekenen. De bedragen die je hier ziet komen van de server (/api/mandje);
// bij het betalen rekent de server alles opnieuw uit.
import { api, winkelInfo, startPagina, mandje, esc, euro } from './winkel.js';

startPagina();
const kassa = document.getElementById('kassa');
const CONCEPT = 'dongo-afrekenen';
let producten = new Map();
let winkel;
let berekening;

const concept = {
  lees() { try { return JSON.parse(sessionStorage.getItem(CONCEPT) || '{}'); } catch { return {}; } },
  bewaar(d) { try { sessionStorage.setItem(CONCEPT, JSON.stringify(d)); } catch { /* niet erg */ } },
};

function leeg() {
  kassa.innerHTML = `<div style="grid-column:1/-1"><h1>Je mandje</h1>
    <div class="leeg-blok"><h2>Je mandje is leeg</h2><p>Kies eerst een paar worsten.</p><a class="btn" href="/#worsten">Naar de worsten</a></div></div>`;
}

function regelHtml(r, probleem) {
  const p = producten.get(r.id);
  const foto = p?.fotos?.[0]?.url;
  return `<li class="regel" data-id="${r.id}">
    <span class="duim" style="${foto ? `background-image:url('${esc(foto)}')` : ''}"></span>
    <div>
      <h3>${p ? `<a href="/worst/${esc(p.slug)}">${esc(r.naam)}</a>` : esc(r.naam)}</h3>
      <p class="meta">${esc(r.eenheid)} · ${euro(r.prijs_cent)} per stuk</p>
      ${probleem ? `<p class="probleem">${esc(probleem)}</p>` : ''}
    </div>
    <div class="rechts">
      <div class="qty">
        <button type="button" data-min="${r.id}" aria-label="Eén minder">−</button>
        <input type="number" inputmode="numeric" min="1" max="50" value="${r.aantal}" data-aantal="${r.id}" aria-label="Aantal ${esc(r.naam)}">
        <button type="button" data-plus="${r.id}" aria-label="Eén meer">+</button>
      </div>
      <strong class="price" style="font-size:20px">${euro(r.totaal_cent)}</strong>
      <button type="button" class="weg" data-weg="${r.id}">Verwijderen</button>
    </div>
  </li>`;
}

function veld(naam, label, invoer, hulp = '') {
  return `<label class="veld" data-veld="${naam}"><span>${label}</span>${invoer}${hulp ? `<span class="hulp">${hulp}</span>` : ''}</label>`;
}

function render() {
  const m = mandje.lees();
  if (!m.length) return leeg();
  const l = winkel.levering;
  const c = concept.lees();
  const wijze = berekening.levering;
  const weg = m.filter((r) => !berekening.regels.some((x) => x.id === r.id));

  kassa.innerHTML = `
  <form id="afreken" novalidate style="display:contents">
    <div>
      <h1>Je mandje</h1>
      <ul class="regels">
        ${berekening.regels.map((r) => regelHtml(r, berekening.problemen[`regel-${r.id}`])).join('')}
        ${weg.map((r) => `<li class="regel" data-id="${r.id}"><span class="duim"></span><div><h3>Product niet meer te koop</h3><p class="probleem">${esc(berekening.problemen[`regel-${r.id}`] || 'Dit product is niet meer te koop.')}</p></div><div class="rechts"><button type="button" class="weg" data-weg="${r.id}">Verwijderen</button></div></li>`).join('')}
      </ul>

      <div class="blok" style="margin-top:28px">
        <h2>Levering</h2>
        <div class="keuzes" data-veld="levering">
          <label class="keuze-optie${l.leveren_aan ? '' : ' uit'}"><input type="radio" name="levering" value="leveren" ${wijze === 'leveren' ? 'checked' : ''} ${l.leveren_aan ? '' : 'disabled'}>
            <strong>Leveren aan huis</strong><span>${l.leveren_aan ? (l.leverkost_cent ? `${euro(l.leverkost_cent)}${l.gratis_vanaf_cent !== null ? `, gratis vanaf ${euro(l.gratis_vanaf_cent)}` : ''}` : 'Gratis') : 'Nu niet mogelijk'}</span></label>
          <label class="keuze-optie${l.afhalen_aan ? '' : ' uit'}"><input type="radio" name="levering" value="afhalen" ${wijze === 'afhalen' ? 'checked' : ''} ${l.afhalen_aan ? '' : 'disabled'}>
            <strong>Afhalen</strong><span>${l.afhalen_aan ? `Gratis · ${esc(l.afhaal_adres)}` : 'Nu niet mogelijk'}</span></label>
        </div>
        ${wijze === 'leveren' && l.leveren_info ? `<p class="let-op">${esc(l.leveren_info)}</p>` : ''}
        ${wijze === 'afhalen' && l.afhaal_info ? `<p class="let-op">${esc(l.afhaal_info)}</p>` : ''}
        ${berekening.problemen.levering ? `<p class="foutblok">${esc(berekening.problemen.levering)}</p>` : ''}
      </div>

      <div class="blok">
        <h2>Je gegevens</h2>
        ${veld('naam', 'Naam', `<input type="text" name="naam" id="v-naam" autocomplete="name" maxlength="100" value="${esc(c.naam)}">`)}
        ${veld('email', 'E-mailadres', `<input type="email" name="email" id="v-email" autocomplete="email" maxlength="200" value="${esc(c.email)}">`, 'Hier komt je bevestiging naartoe.')}
        ${veld('telefoon', 'Telefoon', `<input type="tel" name="telefoon" id="v-telefoon" autocomplete="tel" maxlength="30" value="${esc(c.telefoon)}">`, wijze === 'leveren' ? 'Om een levermoment af te spreken.' : 'Om een afhaalmoment af te spreken.')}
        ${wijze === 'leveren' ? `
          ${veld('straat', 'Straat en huisnummer', `<input type="text" name="straat" id="v-straat" autocomplete="street-address" maxlength="150" value="${esc(c.straat)}">`)}
          <div class="velden2">
            ${veld('postcode', 'Postcode', `<input type="text" name="postcode" id="v-postcode" inputmode="numeric" autocomplete="postal-code" maxlength="4" value="${esc(c.postcode)}">`)}
            ${veld('gemeente', 'Gemeente', `<input type="text" name="gemeente" id="v-gemeente" autocomplete="address-level2" maxlength="80" value="${esc(c.gemeente)}">`)}
          </div>
          ${berekening.problemen.postcode ? `<p class="foutblok">${esc(berekening.problemen.postcode)}</p>` : ''}` : ''}
        ${veld('opmerking', 'Opmerking <span class="hulp">(niet verplicht)</span>', `<textarea name="opmerking" id="v-opmerking" maxlength="500">${esc(c.opmerking)}</textarea>`)}
      </div>
    </div>

    <aside class="kassa-zij">
      <div class="blok">
        <h2>Overzicht</h2>
        <div class="totalen">
          <div><span>Worsten</span><span>${euro(berekening.subtotaal_cent)}</span></div>
          <div><span>${wijze === 'afhalen' ? 'Afhalen' : 'Levering'}</span><span>${berekening.leverkost_cent ? euro(berekening.leverkost_cent) : 'gratis'}</span></div>
          <div class="totaal"><span>Totaal</span><span>${euro(berekening.totaal_cent)}</span></div>
          <div class="klein"><span>Inclusief ${winkel.bedrijf?.btw_procent ?? 6} % btw</span></div>
        </div>
        ${wijze === 'leveren' && berekening.leverkost_cent && berekening.gratis_vanaf_cent !== null
          ? `<p class="nog-gratis">Nog ${euro(berekening.gratis_vanaf_cent - berekening.subtotaal_cent)} en de levering is gratis.</p>` : ''}
        ${berekening.problemen.minimum ? `<p class="foutblok">${esc(berekening.problemen.minimum)}</p>` : ''}
        <label class="vink" data-veld="akkoord"><input type="checkbox" name="akkoord" id="v-akkoord" ${c.akkoord ? 'checked' : ''}>
          <span>Ik ga akkoord met de <a href="/voorwaarden" target="_blank" rel="noopener">algemene voorwaarden</a> en de <a href="/privacy" target="_blank" rel="noopener">privacyverklaring</a>.</span></label>
        <p class="let-op">Omdat het om bederfelijke voeding gaat, heb je geen herroepingsrecht.</p>
        <button class="btn betaal" type="submit" id="betaal">Betalen</button>
        <p class="let-op">Je betaalt veilig via Mollie, met Bancontact of kaart.</p>
      </div>
    </aside>
  </form>`;
}

function leesFormulier(form) {
  const d = Object.fromEntries(['naam', 'email', 'telefoon', 'straat', 'postcode', 'gemeente', 'opmerking'].map((k) => [k, form[k]?.value ?? concept.lees()[k] ?? '']));
  d.akkoord = !!form.akkoord?.checked;
  return d;
}

let rekenTimer;
async function herreken({ direct = false } = {}) {
  clearTimeout(rekenTimer);
  const doe = async () => {
    const m = mandje.lees();
    if (!m.length) return leeg();
    const form = document.getElementById('afreken');
    if (form) concept.bewaar(leesFormulier(form));
    const c = concept.lees();
    const keuze = form?.levering?.value || c.levering || null;
    try {
      berekening = await api('/api/mandje', { methode: 'POST', body: { regels: m, levering: keuze, postcode: c.postcode || null } });
    } catch (e) {
      if (e.velden?.mandje) { mandje.leeg(); return leeg(); }
      kassa.innerHTML = `<p class="foutblok">${esc(e.bericht)}</p>`;
      return;
    }
    const scroll = window.scrollY;
    const actief = document.activeElement?.id;
    render();
    window.scrollTo(0, scroll);
    if (actief) document.getElementById(actief)?.focus();
  };
  if (direct) return doe();
  rekenTimer = setTimeout(doe, 250);
}

function toonFouten(velden = {}) {
  kassa.querySelectorAll('.fout').forEach((v) => { v.classList.remove('fout'); v.querySelector('.melding')?.remove(); });
  let eerste;
  for (const [naam, tekst] of Object.entries(velden)) {
    const v = kassa.querySelector(`[data-veld="${naam}"]`);
    if (!v) continue;
    v.classList.add('fout');
    v.insertAdjacentHTML('beforeend', `<span class="melding">${esc(tekst)}</span>`);
    eerste ??= v;
  }
  eerste?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// ---------- gebeurtenissen ----------
kassa.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const m = mandje.lees();
  const id = Number(b.dataset.min || b.dataset.plus || b.dataset.weg);
  if (!id) return;
  const r = m.find((x) => x.id === id);
  if (b.dataset.weg) mandje.zet(id, 0);
  else if (b.dataset.min && r) mandje.zet(id, Math.max(1, r.aantal - 1));
  else if (b.dataset.plus && r) mandje.zet(id, r.aantal + 1);
  herreken({ direct: true });
});

// Een veld dat je aanpast, verliest zijn foutmelding.
kassa.addEventListener('input', (e) => {
  const v = e.target.closest('.fout');
  if (v) { v.classList.remove('fout'); v.querySelector('.melding')?.remove(); }
});

kassa.addEventListener('change', (e) => {
  const t = e.target;
  if (t.dataset.aantal) {
    mandje.zet(Number(t.dataset.aantal), Math.max(1, Math.min(50, parseInt(t.value, 10) || 1)));
    return herreken({ direct: true });
  }
  if (t.name === 'levering') {
    concept.bewaar({ ...leesFormulier(t.form), levering: t.value });
    return herreken({ direct: true });
  }
  if (t.name === 'postcode') return herreken();
  if (t.form) concept.bewaar({ ...concept.lees(), ...leesFormulier(t.form) });
});

kassa.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const klant = leesFormulier(form);
  concept.bewaar({ ...klant, levering: form.levering?.value });
  if (!form.levering?.value) return toonFouten({ levering: 'Kies leveren of afhalen.' });

  const knop = document.getElementById('betaal');
  knop.disabled = true;
  knop.textContent = 'Even geduld…';
  try {
    const r = await api('/api/afrekenen', { methode: 'POST', body: { regels: mandje.lees(), levering: form.levering.value, klant } });
    if (!r.betaalUrl) throw { bericht: 'Betalen lukt nu even niet.' };
    location.href = r.betaalUrl;
  } catch (err) {
    knop.disabled = false;
    knop.textContent = 'Betalen';
    if (err.problemen) { await herreken({ direct: true }); return toonFouten({ levering: err.bericht }); }
    toonFouten(err.velden || {});
    if (!err.velden) kassa.querySelector('.kassa-zij .blok')?.insertAdjacentHTML('beforeend', `<p class="foutblok">${esc(err.bericht)}</p>`);
  }
});

// ---------- start ----------
(async () => {
  if (!mandje.lees().length) return leeg();
  try {
    const [w, { producten: lijst }] = await Promise.all([winkelInfo(), api('/api/producten')]);
    winkel = w;
    producten = new Map(lijst.map((p) => [p.id, p]));
  } catch (e) {
    kassa.innerHTML = `<p class="foutblok">${esc(e.bericht || 'Het mandje kon niet geladen worden.')} Herlaad de pagina.</p>`;
    return;
  }
  herreken({ direct: true });
})();
