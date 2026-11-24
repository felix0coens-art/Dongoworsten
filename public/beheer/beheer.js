// Beheer van Dongo Worsten: producten, foto's, levering, teksten, onderneming en bestellingen.
// Alle controles gebeuren ook op de server; wat hier gebeurt is gemak voor de gebruiker.

const app = document.getElementById('app');
let ALLERGENEN = [];
let vuil = false; // onbewaarde wijzigingen

// ---------- hulp ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const euro = (cent) => (cent == null ? '' : '€ ' + (cent / 100).toFixed(2).replace('.', ','));
const centNaarVeld = (cent) => (cent == null ? '' : (cent / 100).toFixed(2).replace('.', ','));
function veldNaarCent(v) {
  v = String(v).trim().replace(/\s/g, '').replace('€', '');
  if (!v) return null;
  if (!/^\d+([.,]\d{1,2})?$/.test(v)) return NaN;
  return Math.round(parseFloat(v.replace(',', '.')) * 100);
}
function veldNaarGeheel(v) {
  v = String(v).trim();
  if (!v) return null;
  return /^\d+$/.test(v) ? parseInt(v, 10) : NaN;
}

let toastTimer;
function melding(tekst, fout = false) {
  const t = document.getElementById('toast');
  t.textContent = tekst;
  t.classList.toggle('fout', fout);
  t.classList.add('toon');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('toon'), fout ? 5000 : 2500);
}

async function api(pad, { methode = 'GET', body, form } = {}) {
  const opties = { method: methode, headers: {} };
  if (body !== undefined) { opties.headers['content-type'] = 'application/json'; opties.body = JSON.stringify(body); }
  if (form) opties.body = form;
  let res;
  try { res = await fetch(pad, opties); } catch { throw { bericht: 'Geen verbinding. Controleer je internet en probeer opnieuw.' }; }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) throw { bericht: 'Je bent afgemeld. Herlaad de pagina om opnieuw aan te melden.' };
  if (!res.ok) throw { bericht: data.fout || 'Er ging iets mis.', velden: data.velden };
  return data;
}

function toonFouten(form, velden = {}) {
  form.querySelectorAll('.veld.fout').forEach((v) => { v.classList.remove('fout'); v.querySelector('.melding')?.remove(); });
  let eerste = null;
  for (const [naam, tekst] of Object.entries(velden)) {
    const veld = form.querySelector(`[data-veld="${naam}"]`);
    if (!veld) continue;
    veld.classList.add('fout');
    veld.insertAdjacentHTML('beforeend', `<span class="melding">${esc(tekst)}</span>`);
    eerste ??= veld;
  }
  eerste?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function veld(naam, label, invoer, hulp = '') {
  return `<label class="veld" data-veld="${naam}"><span>${label}</span>${invoer}${hulp ? `<span class="hulp">${hulp}</span>` : ''}</label>`;
}
const tekstInvoer = (naam, waarde, extra = '') => `<input type="text" id="v-${naam}" name="${naam}" value="${esc(waarde)}" ${extra}>`;
const tekstVak = (naam, waarde, extra = '') => `<textarea id="v-${naam}" name="${naam}" ${extra}>${esc(waarde)}</textarea>`;
const schakel = (naam, aan, label) => `<label class="schakel" data-veld="${naam}"><input type="checkbox" id="v-${naam}" name="${naam}" ${aan ? 'checked' : ''}><span>${label}</span></label>`;

function bewaarBalk(knopTekst, extra = '') {
  return `<div class="bewaar"><div class="wrap"><span class="status" id="status">Alles bewaard</span><div style="display:flex;gap:10px;flex-wrap:wrap">${extra}<button class="btn" type="submit" form="formulier" id="bewaarknop">${knopTekst}</button></div></div></div>`;
}
function volgWijzigingen(form) {
  vuil = false;
  form.addEventListener('input', (e) => { if (e.target.closest('#fotos')) return; vuil = true; const s = document.getElementById('status'); if (s) s.textContent = 'Niet bewaard'; });
}
async function bewaar(knop, fn) {
  knop.disabled = true;
  try { await fn(); vuil = false; const s = document.getElementById('status'); if (s) s.textContent = 'Alles bewaard'; }
  finally { knop.disabled = false; }
}
window.addEventListener('beforeunload', (e) => { if (vuil) e.preventDefault(); });

// ---------- verkleinen vóór opladen ----------
async function verklein(bestand, max = 1600) {
  const bitmap = await createImageBitmap(bestand, { imageOrientation: 'from-image' }).catch(() => null);
  if (!bitmap) return bestand;
  const schaal = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bitmap.width * schaal);
  c.height = Math.round(bitmap.height * schaal);
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  return new Promise((ok) => c.toBlob((b) => ok(b || bestand), 'image/jpeg', 0.85));
}

// =========================== PRODUCTEN ===========================
async function toonProducten() {
  const { producten } = await api('/api/beheer/producten');
  app.innerHTML = `
    <div class="kop"><h1>Producten</h1><a class="btn" href="#product/nieuw">Nieuw product</a>
      <p>Alleen producten die op <b>zichtbaar</b> staan, verschijnen in de winkel.</p></div>
    ${producten.length ? `<div class="lijst">${producten.map((p) => `
      <a class="rij" href="#product/${p.id}">
        <span class="duim" style="${p.fotos[0] ? `background-image:url('${esc(p.fotos[0].url)}')` : ''}"></span>
        <span><strong>${esc(p.naam)}</strong><small>${esc(p.eenheid)}${p.voorraad !== null ? ` · voorraad ${p.voorraad}` : ''}</small></span>
        ${p.voorraad === 0 ? '<span class="label op">Uitverkocht</span>' : p.zichtbaar ? '<span class="label aan">Zichtbaar</span>' : '<span class="label uit">Verborgen</span>'}
        <span class="prijs">${euro(p.prijs_cent)}</span>
      </a>`).join('')}</div>`
    : `<div class="leeg"><strong>Nog geen producten.</strong><span>Voeg je eerste worst toe met naam, prijs, ingrediënten en foto's.</span><a class="btn" href="#product/nieuw">Nieuw product</a></div>`}`;
}

const LEEG_PRODUCT = { naam: '', korte_tekst: '', omschrijving: '', prijs_cent: null, eenheid: '', gewicht_gram: null, ingredienten: '', bevat: [], sporen: [], bewaren: 'Diepgevroren bewaren bij −18 °C. Laat ontdooien in de koelkast en bereid binnen 24 uur. Niet opnieuw invriezen.', bereiden: '', diepvries: true, voorraad: null, zichtbaar: false, volgorde: 0, fotos: [] };

async function toonProduct(id) {
  const nieuw = id === 'nieuw';
  const p = nieuw ? { ...LEEG_PRODUCT } : (await api(`/api/beheer/producten/${id}`)).product;
  const status = (s) => (p.bevat.includes(s) ? 'bevat' : p.sporen.includes(s) ? 'sporen' : 'nee');

  app.innerHTML = `
    <a class="terug" href="#producten">← Alle producten</a>
    <div class="kop"><h1>${nieuw ? 'Nieuw product' : esc(p.naam)}</h1>
</div>
    <form id="formulier" novalidate>
      <fieldset><legend>Product</legend>
        ${veld('naam', 'Naam', tekstInvoer('naam', p.naam, 'required maxlength="120" autocomplete="off"'))}
        ${veld('korte_tekst', 'Korte omschrijving', tekstVak('korte_tekst', p.korte_tekst, 'maxlength="400" rows="2"'), 'Eén of twee zinnen. Staat bovenaan de productpagina.')}
        ${veld('omschrijving', 'Meer uitleg <small>(niet verplicht)</small>', tekstVak('omschrijving', p.omschrijving, 'maxlength="4000"'))}
      </fieldset>

      <fieldset><legend>Prijs en verpakking</legend>
        <div class="rij2">
          ${veld('prijs_cent', 'Prijs (incl. btw)', `<span class="geld"><input type="text" inputmode="decimal" id="v-prijs" name="prijs" value="${centNaarVeld(p.prijs_cent)}" placeholder="7,20"></span>`)}
          ${veld('eenheid', 'Verpakking', tekstInvoer('eenheid', p.eenheid, 'maxlength="60" placeholder="Pak van 4"'))}
          ${veld('gewicht_gram', 'Gewicht (gram)', `<input type="number" inputmode="numeric" min="1" id="v-gewicht" name="gewicht" value="${p.gewicht_gram ?? ''}" placeholder="480">`, 'Ongeveer-gewicht van één verpakking.')}
        </div>
        <p class="reken" id="kiloprijs"></p>
      </fieldset>

      <fieldset><legend>Ingrediënten en allergenen</legend>
        ${veld('ingredienten', 'Ingrediënten', tekstVak('ingredienten', p.ingredienten, 'maxlength="2000"'), 'Zet allergenen tussen sterretjes, bv. <code>*mosterdzaad*</code>. Die worden in de winkel vet getoond, zoals de wet vraagt.')}
        <div class="voorbeeld" id="ingr-voorbeeld" aria-label="Voorbeeld"></div>
        <div class="veld" data-veld="sporen"><span>Allergenen</span>
          <span class="hulp">Kies per allergeen: zit het erin (<b>bevat</b>), kan het er in sporen in zitten (<b>sporen</b>), of niet.</span>
          <div class="allergenen">${ALLERGENEN.map((a) => `
            <div class="allergeen"><span>${esc(a.naam)}</span>
              <span class="keuze" role="radiogroup" aria-label="${esc(a.naam)}">
                ${['nee', 'bevat', 'sporen'].map((w) => `<label><input type="radio" name="al-${a.sleutel}" value="${w}" ${status(a.sleutel) === w ? 'checked' : ''}><span>${w === 'nee' ? 'Nee' : w === 'bevat' ? 'Bevat' : 'Sporen'}</span></label>`).join('')}
              </span></div>`).join('')}
          </div>
        </div>
      </fieldset>

      <fieldset><legend>Bewaren en bereiden</legend>
        ${veld('bewaren', 'Bewaren', tekstVak('bewaren', p.bewaren, 'maxlength="1000"'))}
        ${veld('bereiden', 'Bereiden', tekstVak('bereiden', p.bereiden, 'maxlength="2000"'), 'Eén stap per regel.')}
        ${schakel('diepvries', p.diepvries, 'Wordt diepgevroren geleverd')}
      </fieldset>

      <fieldset><legend>Voorraad en zichtbaarheid</legend>
        ${schakel('voorraad_aan', p.voorraad !== null, 'Voorraad bijhouden')}
        <div id="voorraad-veld" ${p.voorraad === null ? 'hidden' : ''}>
          ${veld('voorraad', 'Aantal op voorraad', `<input type="number" inputmode="numeric" min="0" id="v-voorraad" name="voorraad" value="${p.voorraad ?? ''}">`, 'Gaat vanzelf omlaag bij elke betaalde bestelling. Op 0 toont de winkel "uitverkocht".')}
        </div>
        ${schakel('zichtbaar', p.zichtbaar, 'Zichtbaar in de winkel')}
        ${veld('volgorde', 'Volgorde', `<input type="number" inputmode="numeric" min="0" id="v-volgorde" name="volgorde" value="${p.volgorde}">`, 'Lager getal = eerder in de lijst.')}
      </fieldset>

      <fieldset><legend>Foto's</legend>
        ${nieuw ? '<p class="hulp">Bewaar het product eerst; daarna kun je foto\'s toevoegen.</p>' : '<div class="fotos" id="fotos"></div><span class="hulp">De eerste foto is de hoofdfoto. Een korte omschrijving helpt mensen die de foto niet zien.</span>'}
      </fieldset>
    </form>
    ${bewaarBalk(nieuw ? 'Product aanmaken' : 'Bewaren', nieuw ? '' : '<span id="verwijder-zone"><button type="button" class="btn gevaar" id="verwijder">Verwijderen</button></span>')}`;

  const form = document.getElementById('formulier');
  volgWijzigingen(form);

  // live: kiloprijs en voorbeeld van de ingrediënten
  const kilo = document.getElementById('kiloprijs');
  const rekenKilo = () => {
    const c = veldNaarCent(form.prijs.value), g = veldNaarGeheel(form.gewicht.value);
    kilo.innerHTML = c > 0 && g > 0 ? `Kiloprijs in de winkel: <strong>${euro(Math.round((c * 1000) / g))} per kg</strong>` : 'Vul prijs en gewicht in om de kiloprijs te zien.';
  };
  const ingr = document.getElementById('ingr-voorbeeld');
  const toonIngr = () => {
    const t = form.ingredienten.value.trim();
    ingr.innerHTML = t ? 'In de winkel: ' + esc(t).replace(/\*([^*]+)\*/g, '<b>$1</b>') : 'Hier zie je hoe de ingrediënten in de winkel verschijnen.';
  };
  form.prijs.addEventListener('input', rekenKilo); form.gewicht.addEventListener('input', rekenKilo);
  form.ingredienten.addEventListener('input', toonIngr);
  rekenKilo(); toonIngr();
  form.voorraad_aan.addEventListener('change', () => { document.getElementById('voorraad-veld').hidden = !form.voorraad_aan.checked; });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fouten = {};
    const prijs = veldNaarCent(form.prijs.value);
    if (prijs === null || Number.isNaN(prijs)) fouten.prijs_cent = 'Vul een prijs in, bv. 7,20.';
    const gewicht = veldNaarGeheel(form.gewicht.value);
    if (Number.isNaN(gewicht)) fouten.gewicht_gram = 'Alleen cijfers, in gram.';
    const voorraad = form.voorraad_aan.checked ? veldNaarGeheel(form.voorraad.value) : null;
    if (form.voorraad_aan.checked && (voorraad === null || Number.isNaN(voorraad))) fouten.voorraad = 'Vul het aantal in.';
    const volgorde = veldNaarGeheel(form.volgorde.value) ?? 0;
    if (Object.keys(fouten).length) { toonFouten(form, fouten); melding('Controleer de gemarkeerde velden.', true); return; }

    const bevat = [], sporen = [];
    for (const a of ALLERGENEN) {
      const w = form.querySelector(`input[name="al-${a.sleutel}"]:checked`)?.value;
      if (w === 'bevat') bevat.push(a.sleutel);
      if (w === 'sporen') sporen.push(a.sleutel);
    }
    const body = {
      naam: form.naam.value, korte_tekst: form.korte_tekst.value, omschrijving: form.omschrijving.value,
      prijs_cent: prijs, eenheid: form.eenheid.value, gewicht_gram: gewicht,
      ingredienten: form.ingredienten.value, bevat, sporen,
      bewaren: form.bewaren.value, bereiden: form.bereiden.value, diepvries: form.diepvries.checked,
      voorraad, zichtbaar: form.zichtbaar.checked, volgorde: Number.isNaN(volgorde) ? 0 : volgorde,
    };
    bewaar(document.getElementById('bewaarknop'), async () => {
      try {
        const r = nieuw
          ? await api('/api/beheer/producten', { methode: 'POST', body })
          : await api(`/api/beheer/producten/${id}`, { methode: 'PUT', body });
        toonFouten(form, {});
        melding(nieuw ? 'Product aangemaakt. Voeg nu foto\'s toe.' : 'Bewaard');
        if (nieuw) { vuil = false; location.hash = `#product/${r.product.id}`; }
        else document.querySelector('.kop h1').textContent = r.product.naam;
      } catch (err) {
        toonFouten(form, err.velden); melding(err.bericht, true); throw err;
      }
    }).catch(() => {});
  });

  if (!nieuw) {
    toonFotos(p);
    const zone = document.getElementById('verwijder-zone');
    zone.addEventListener('click', async (e) => {
      if (e.target.id === 'verwijder') {
        zone.innerHTML = `<span class="bevestig">Zeker? Ook de foto's verdwijnen. <button type="button" class="btn gevaar klein" id="echt">Ja, verwijderen</button><button type="button" class="btn wit klein" id="toch-niet">Annuleren</button></span>`;
      } else if (e.target.id === 'toch-niet') {
        zone.innerHTML = '<button type="button" class="btn gevaar" id="verwijder">Verwijderen</button>';
      } else if (e.target.id === 'echt') {
        try { await api(`/api/beheer/producten/${id}`, { methode: 'DELETE' }); vuil = false; melding('Product verwijderd'); location.hash = '#producten'; }
        catch (err) { melding(err.bericht, true); }
      }
    });
  }
}

function toonFotos(p) {
  const doos = document.getElementById('fotos');
  const fotos = [...p.fotos].sort((a, b) => a.volgorde - b.volgorde);
  doos.innerHTML = fotos.map((f, i) => `
    <div class="foto" data-id="${f.id}">
      ${i === 0 ? '<span class="eerste">Hoofdfoto</span>' : ''}
      <img src="${esc(f.url)}" alt="${esc(f.alt)}" loading="lazy">
      <input type="text" value="${esc(f.alt)}" placeholder="Wat staat erop?" aria-label="Omschrijving van de foto" data-alt="${f.id}" maxlength="200">
      <div class="acties">
        <button type="button" class="btn wit klein" data-links="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Naar voren">←</button>
        <button type="button" class="btn wit klein" data-rechts="${i}" ${i === fotos.length - 1 ? 'disabled' : ''} aria-label="Naar achteren">→</button>
        <button type="button" class="btn gevaar klein" data-weg="${f.id}">Weg</button>
      </div>
    </div>`).join('') + `
    <label class="oplaad"><span>+ Foto's toevoegen<small>JPG, PNG of WebP</small></span><input type="file" accept="image/jpeg,image/png,image/webp" multiple id="foto-invoer"></label>`;

  const herlaad = async () => { p.fotos = (await api(`/api/beheer/producten/${p.id}`)).product.fotos; toonFotos(p); };

  doos.querySelector('#foto-invoer').addEventListener('change', async (e) => {
    const bestanden = [...e.target.files];
    for (const [n, b] of bestanden.entries()) {
      melding(`Foto ${n + 1} van ${bestanden.length} opladen…`);
      const form = new FormData();
      form.append('foto', await verklein(b), 'foto.jpg');
      try { await api(`/api/beheer/producten/${p.id}/fotos`, { methode: 'POST', form }); }
      catch (err) { melding(err.bericht, true); break; }
    }
    await herlaad();
    melding('Foto\'s toegevoegd');
  });

  doos.addEventListener('change', async (e) => {
    const id = e.target.dataset.alt;
    if (!id) return;
    try { await api(`/api/beheer/fotos/${id}`, { methode: 'PATCH', body: { alt: e.target.value } }); melding('Omschrijving bewaard'); }
    catch (err) { melding(err.bericht, true); }
  });

  doos.onclick = async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    try {
      if (b.dataset.weg) {
        if (b.dataset.zeker !== '1') { b.dataset.zeker = '1'; b.textContent = 'Zeker?'; return; }
        await api(`/api/beheer/fotos/${b.dataset.weg}`, { methode: 'DELETE' });
        melding('Foto verwijderd');
      } else if (b.dataset.links || b.dataset.rechts) {
        const i = Number(b.dataset.links ?? b.dataset.rechts), j = b.dataset.links ? i - 1 : i + 1;
        [fotos[i], fotos[j]] = [fotos[j], fotos[i]];
        await Promise.all(fotos.map((f, k) => api(`/api/beheer/fotos/${f.id}`, { methode: 'PATCH', body: { volgorde: k } })));
      }
      await herlaad();
    } catch (err) { melding(err.bericht, true); }
  };
}

// =========================== INSTELLINGEN ===========================
async function toonInstelling(sleutel) {
  const { instellingen } = await api('/api/beheer/instellingen');
  const w = instellingen[sleutel] || {};
  const vormen = {
    levering: {
      titel: 'Levering', uitleg: 'Wat de klant betaalt voor levering en waar je levert. Wijzigingen gelden meteen voor nieuwe bestellingen.',
      html: `
        <fieldset><legend>Leveren aan huis</legend>
          ${schakel('leveren_aan', w.leveren_aan, 'Leveren aan huis aanbieden')}
          <div class="rij2">
            ${veld('leverkost_cent', 'Leverkost', `<span class="geld"><input type="text" inputmode="decimal" id="v-leverkost" name="leverkost" value="${centNaarVeld(w.leverkost_cent)}"></span>`)}
            ${veld('gratis_vanaf_cent', 'Gratis levering vanaf', `<span class="geld"><input type="text" inputmode="decimal" id="v-gratis" name="gratis" value="${centNaarVeld(w.gratis_vanaf_cent)}"></span>`, 'Leeg laten = nooit gratis.')}
            ${veld('minimum_cent', 'Minimaal bestelbedrag', `<span class="geld"><input type="text" inputmode="decimal" id="v-minimum" name="minimum" value="${centNaarVeld(w.minimum_cent)}"></span>`, '0 = geen minimum.')}
          </div>
          ${veld('postcodes', 'Postcodes waar je levert', tekstVak('postcodes', (w.postcodes || []).join(', '), 'rows="3" placeholder="9000, 9030, 9031"'), 'Gescheiden door komma\'s of spaties. Leeg laten = overal in België.')}
          ${veld('leveren_info', 'Uitleg voor de klant', tekstVak('leveren_info', w.leveren_info))}
        </fieldset>
        <fieldset><legend>Afhalen</legend>
          ${schakel('afhalen_aan', w.afhalen_aan, 'Afhalen aanbieden (gratis)')}
          ${veld('afhaal_adres', 'Afhaaladres', tekstInvoer('afhaal_adres', w.afhaal_adres))}
          ${veld('afhaal_info', 'Wanneer kan men afhalen?', tekstVak('afhaal_info', w.afhaal_info, 'placeholder="Bv. op zaterdag tussen 10 en 12 uur, na afspraak."'))}
        </fieldset>`,
      lees(f) {
        const uit = { leveren_aan: f.leveren_aan.checked, afhalen_aan: f.afhalen_aan.checked, leveren_info: f.leveren_info.value, afhaal_adres: f.afhaal_adres.value, afhaal_info: f.afhaal_info.value };
        const fouten = {};
        uit.leverkost_cent = veldNaarCent(f.leverkost.value) ?? 0;
        uit.gratis_vanaf_cent = veldNaarCent(f.gratis.value);
        uit.minimum_cent = veldNaarCent(f.minimum.value) ?? 0;
        for (const k of ['leverkost_cent', 'gratis_vanaf_cent', 'minimum_cent']) if (Number.isNaN(uit[k])) fouten[k] = 'Vul een bedrag in, bv. 6,50.';
        uit.postcodes = f.postcodes.value.split(/[\s,;]+/).filter(Boolean);
        return { uit, fouten };
      },
    },
    teksten: {
      titel: 'Teksten', uitleg: 'De teksten op de startpagina en de juridische pagina\'s.',
      html: `
        <fieldset><legend>Startpagina</legend>
          ${veld('hero_titel', 'Grote titel', tekstInvoer('hero_titel', w.hero_titel, 'maxlength="120"'), 'Zet een woord tussen *sterretjes* om het in de opvallende stijl te tonen.')}
          ${veld('hero_tekst', 'Tekst eronder', tekstVak('hero_tekst', w.hero_tekst, 'maxlength="600"'))}
          ${veld('verhaal_titel', 'Titel van het verhaal', tekstInvoer('verhaal_titel', w.verhaal_titel, 'maxlength="120"'))}
          ${veld('verhaal_tekst', 'Het verhaal', tekstVak('verhaal_tekst', w.verhaal_tekst, 'maxlength="4000"'), 'Laat een lege regel tussen blokken. Een blok dat begint met <code>## Titel</code> wordt een stap in de tijdlijn; een blok tussen aanhalingstekens wordt het grote citaat.')}
        </fieldset>
        <fieldset><legend>Juridisch</legend>
          ${veld('voorwaarden', 'Algemene voorwaarden', tekstVak('voorwaarden', w.voorwaarden, 'class="groot"'), 'Regels die beginnen met # worden een tussentitel.')}
          ${veld('privacy', 'Privacyverklaring', tekstVak('privacy', w.privacy, 'class="groot"'))}
        </fieldset>`,
      lees: (f) => ({ uit: Object.fromEntries(['hero_titel', 'hero_tekst', 'verhaal_titel', 'verhaal_tekst', 'voorwaarden', 'privacy'].map((k) => [k, f[k].value])), fouten: {} }),
    },
    bedrijf: {
      titel: 'Onderneming', uitleg: 'Deze gegevens staan onderaan elke pagina, in de voorwaarden en in de mails.',
      html: `
        <fieldset><legend>Gegevens</legend>
          <div class="rij2">
            ${veld('naam', 'Naam onderneming', tekstInvoer('naam', w.naam))}
            ${veld('handelsnaam', 'Handelsnaam', tekstInvoer('handelsnaam', w.handelsnaam))}
            ${veld('ondernemingsnummer', 'Ondernemingsnummer', tekstInvoer('ondernemingsnummer', w.ondernemingsnummer, 'placeholder="1234.567.890"'))}
            ${veld('btw_procent', 'Btw op voeding (%)', `<input type="number" min="0" max="21" id="v-btw" name="btw" value="${w.btw_procent ?? 6}">`)}
          </div>
          ${veld('adres', 'Adres', tekstVak('adres', w.adres, 'rows="2"'))}
          <div class="rij2">
            ${veld('email', 'E-mailadres', `<input type="email" id="v-email" name="email" value="${esc(w.email)}">`, 'Hierop komen ook de bestelmeldingen.')}
            ${veld('telefoon', 'Telefoon', `<input type="tel" id="v-telefoon" name="telefoon" value="${esc(w.telefoon)}">`)}
          </div>
        </fieldset>`,
      lees: (f) => {
        const btw = veldNaarGeheel(f.btw.value);
        return { uit: { naam: f.naam.value, handelsnaam: f.handelsnaam.value, ondernemingsnummer: f.ondernemingsnummer.value, adres: f.adres.value, email: f.email.value, telefoon: f.telefoon.value, btw_procent: btw }, fouten: btw === null || Number.isNaN(btw) ? { btw_procent: 'Vul een percentage in.' } : {} };
      },
    },
  };
  const v = vormen[sleutel];
  app.innerHTML = `<div class="kop"><h1>${v.titel}</h1><p>${v.uitleg}</p></div><form id="formulier" novalidate>${v.html}</form>${bewaarBalk('Bewaren')}`;
  const form = document.getElementById('formulier');
  volgWijzigingen(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const { uit, fouten } = v.lees(form);
    if (Object.keys(fouten).length) { toonFouten(form, fouten); melding('Controleer de gemarkeerde velden.', true); return; }
    bewaar(document.getElementById('bewaarknop'), async () => {
      try { await api(`/api/beheer/instellingen/${sleutel}`, { methode: 'PUT', body: uit }); toonFouten(form, {}); melding('Bewaard'); }
      catch (err) { toonFouten(form, err.velden); melding(err.bericht, true); throw err; }
    }).catch(() => {});
  });
}

// =========================== BESTELLINGEN ===========================
const STATUS_NAAM = { '': 'Alle', betaald: 'Te verwerken', klaargezet: 'Klaargezet', geleverd: 'Geleverd', open: 'Niet betaald', geannuleerd: 'Geannuleerd', mislukt: 'Mislukt' };
async function toonBestellingen(status = 'betaald') {
  const { bestellingen } = await api(`/api/beheer/bestellingen${status ? `?status=${status}` : ''}`);
  app.innerHTML = `
    <div class="kop"><h1>Bestellingen</h1></div>
    <div class="filters">${Object.entries(STATUS_NAAM).map(([k, n]) => `<button type="button" data-status="${k}" aria-pressed="${k === status}">${n}</button>`).join('')}</div>
    ${bestellingen.length ? `<div class="tabel"><table>
      <thead><tr><th>Nummer</th><th>Datum</th><th>Klant</th><th>Levering</th><th>Status</th><th class="getal">Totaal</th></tr></thead>
      <tbody>${bestellingen.map((b) => `<tr><td><a href="#bestelling/${b.id}">${esc(b.nummer)}</a></td><td>${esc(b.aangemaakt.slice(0, 16))}</td><td>${esc(b.naam)}</td><td>${b.levering === 'afhalen' ? 'Afhalen' : esc(`${b.adres_postcode ?? ''} ${b.adres_gemeente ?? ''}`)}</td><td>${esc(STATUS_NAAM[b.status] || b.status)}</td><td class="getal">${euro(b.totaal_cent)}</td></tr>`).join('')}</tbody>
    </table></div>`
    : `<div class="leeg"><strong>Geen bestellingen${status ? ` met status "${esc(STATUS_NAAM[status])}"` : ''}.</strong><span>Betaalde bestellingen verschijnen hier vanzelf.</span></div>`}`;
  app.querySelector('.filters').addEventListener('click', (e) => { const s = e.target.dataset.status; if (s !== undefined) toonBestellingen(s); });
}

async function toonBestelling(id) {
  const { bestelling: b } = await api(`/api/beheer/bestellingen/${id}`);
  const KNOP = { klaargezet: 'Klaargezet', geleverd: b.levering === 'afhalen' ? 'Afgehaald' : 'Geleverd', betaald: 'Terug naar "te verwerken"', geannuleerd: 'Annuleren' };
  app.innerHTML = `
    <a class="terug" href="#bestellingen">← Alle bestellingen</a>
    <div class="kop"><h1>${esc(b.nummer)}</h1><span class="label ${b.status === 'betaald' ? 'aan' : ''}">${esc(STATUS_NAAM[b.status] || b.status)}</span>
      <p>Besteld op ${esc(b.aangemaakt.slice(0, 16))}${b.betaald_op ? ` · betaald op ${esc(b.betaald_op.slice(0, 16))}` : ''} · Mollie: ${esc(b.mollie_status || '–')}${['betaald', 'klaargezet', 'geleverd'].includes(b.status) ? ` · Bevestigingsmail: ${b.mails_verstuurd ? 'verstuurd' : 'nog niet verstuurd'}` : ''}</p></div>
    <div class="rij2" style="align-items:start">
      <fieldset><legend>Klant</legend>
        <div><strong>${esc(b.naam)}</strong><br><a href="mailto:${esc(b.email)}">${esc(b.email)}</a><br><a href="tel:${esc(b.telefoon.replace(/[^0-9+]/g, ''))}">${esc(b.telefoon)}</a></div>
        <div><strong>${b.levering === 'afhalen' ? 'Afhalen' : 'Leveren aan'}</strong>${b.levering === 'leveren' ? `<br>${esc(b.adres_straat)}<br>${esc(b.adres_postcode)} ${esc(b.adres_gemeente)}` : ''}</div>
        ${b.opmerking ? `<div><strong>Opmerking van de klant</strong><br>${esc(b.opmerking)}</div>` : ''}
      </fieldset>
      <fieldset><legend>Bestelling</legend>
        <div class="tabel" style="border:0"><table>
          <tbody>${b.regels.map((r) => `<tr><td>${esc(r.aantal)} ×</td><td style="white-space:normal">${esc(r.naam)}<br><small>${esc(r.eenheid)}</small></td><td class="getal">${euro(r.prijs_cent * r.aantal)}</td></tr>`).join('')}
          <tr><td></td><td>${b.levering === 'afhalen' ? 'Afhalen' : 'Levering'}</td><td class="getal">${euro(b.leverkost_cent)}</td></tr>
          <tr><td></td><td><strong>Totaal</strong></td><td class="getal"><strong>${euro(b.totaal_cent)}</strong></td></tr></tbody>
        </table></div>
      </fieldset>
    </div>
    <form id="formulier" novalidate style="margin-top:20px">
      <fieldset><legend>Opvolging</legend>
        ${veld('notitie', 'Notitie (alleen voor jou)', tekstVak('notitie', b.notitie, 'maxlength="2000"'))}
        <div style="display:flex;gap:10px;flex-wrap:wrap" id="statusknoppen">
          ${b.mag_naar.map((s) => `<button type="button" class="btn ${s === 'geannuleerd' ? 'gevaar' : s === 'betaald' ? 'wit' : ''}" data-naar="${s}">${esc(KNOP[s] || s)}</button>`).join('')}
        </div>
        ${b.mag_naar.includes('geannuleerd') && b.status !== 'open' ? '<span class="hulp">Annuleren betaalt niet automatisch terug. Dat doe je in je Mollie-dashboard.</span>' : ''}
      </fieldset>
    </form>
    ${bewaarBalk('Notitie bewaren')}`;
  const form = document.getElementById('formulier');
  volgWijzigingen(form);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    bewaar(document.getElementById('bewaarknop'), async () => {
      try { await api(`/api/beheer/bestellingen/${id}`, { methode: 'PATCH', body: { notitie: form.notitie.value } }); melding('Notitie bewaard'); }
      catch (err) { melding(err.bericht, true); throw err; }
    }).catch(() => {});
  });
  document.getElementById('statusknoppen').addEventListener('click', async (e) => {
    const k = e.target.closest('[data-naar]');
    if (!k) return;
    if (k.dataset.naar === 'geannuleerd' && k.dataset.zeker !== '1') { k.dataset.zeker = '1'; k.textContent = 'Zeker annuleren?'; return; }
    try {
      await api(`/api/beheer/bestellingen/${id}`, { methode: 'PATCH', body: { status: k.dataset.naar, notitie: form.notitie.value } });
      vuil = false; melding('Status aangepast'); toonBestelling(id);
    } catch (err) { melding(err.bericht, true); }
  });
}

// =========================== NAVIGATIE ===========================
let vorigeHash = location.hash;
async function route() {
  if (vuil && location.hash !== vorigeHash) {
    // Waarschuw één keer; tweede klik gaat door.
    melding('Je hebt niet-bewaarde wijzigingen. Bewaar eerst, of klik nog eens om ze te laten vallen.', true);
    vuil = false;
    history.replaceState(null, '', vorigeHash || '#producten');
    return;
  }
  vorigeHash = location.hash;
  const [tab, id] = (location.hash.slice(1) || 'producten').split('/');
  const actief = tab === 'product' ? 'producten' : tab === 'bestelling' ? 'bestellingen' : tab;
  document.querySelectorAll('[data-tab]').forEach((a) => a.setAttribute('aria-current', a.dataset.tab === actief ? 'page' : 'false'));
  app.innerHTML = '<p class="laden">Even laden…</p>';
  try {
    if (tab === 'product' && id) await toonProduct(id);
    else if (tab === 'bestellingen') await toonBestellingen();
    else if (tab === 'bestelling' && id) await toonBestelling(id);
    else if (tab === 'levering') await toonInstelling('levering');
    else if (tab === 'teksten') await toonInstelling('teksten');
    else if (tab === 'onderneming') await toonInstelling('bedrijf');
    else await toonProducten();
    window.scrollTo(0, 0);
  } catch (err) {
    app.innerHTML = `<div class="leeg"><strong>Dit lukte niet.</strong><span>${esc(err.bericht || 'Onbekende fout.')}</span><a class="btn" href="">Opnieuw proberen</a></div>`;
  }
}

(async function start() {
  try {
    const ik = await api('/api/beheer/ik');
    ALLERGENEN = ik.allergenen;
    document.getElementById('wie').textContent = ik.email;
  } catch (err) {
    app.innerHTML = `<div class="leeg"><strong>Geen toegang.</strong><span>${esc(err.bericht)}</span></div>`;
    return;
  }
  window.addEventListener('hashchange', route);
  route();
})();
