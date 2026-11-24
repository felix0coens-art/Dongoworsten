// Gedeeld voor alle winkelpagina's: mandje, opmaak, kop en voet.
// Het mandje bevat alleen product-id en aantal; prijzen komen altijd van de server.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const euro = (cent) => '€ ' + (cent / 100).toFixed(2).replace('.', ',');

// ---------- mandje (in de browser) ----------
const SLEUTEL = 'dongo-mandje';
export const mandje = {
  lees() {
    try {
      const m = JSON.parse(localStorage.getItem(SLEUTEL) || '[]');
      return Array.isArray(m) ? m.filter((r) => Number.isInteger(r?.id) && Number.isInteger(r?.aantal) && r.aantal > 0) : [];
    } catch { return []; }
  },
  bewaar(m) {
    try { localStorage.setItem(SLEUTEL, JSON.stringify(m)); } catch { /* privévenster: mandje blijft alleen deze pagina */ }
    toonAantal();
  },
  voegToe(id, aantal = 1) {
    const m = this.lees();
    const r = m.find((x) => x.id === id);
    if (r) r.aantal = Math.min(50, r.aantal + aantal); else m.push({ id, aantal: Math.min(50, aantal) });
    this.bewaar(m);
  },
  zet(id, aantal) {
    let m = this.lees();
    if (aantal <= 0) m = m.filter((x) => x.id !== id);
    else { const r = m.find((x) => x.id === id); if (r) r.aantal = Math.min(50, aantal); }
    this.bewaar(m);
  },
  leeg() { this.bewaar([]); },
  stuks() { return this.lees().reduce((s, r) => s + r.aantal, 0); },
};

export function toonAantal() {
  const el = document.getElementById('cart-count');
  if (!el) return;
  el.textContent = mandje.stuks();
  const knop = document.getElementById('cart-btn');
  knop?.classList.remove('bump'); void knop?.offsetWidth; knop?.classList.add('bump');
}

// ---------- server ----------
export async function api(pad, { methode = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(pad, { method: methode, headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw { bericht: 'Geen verbinding. Controleer je internet en probeer opnieuw.' };
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw { status: res.status, bericht: data.fout || 'Er ging iets mis.', ...data };
  return data;
}

let winkelBelofte;
export const winkelInfo = () => (winkelBelofte ??= api('/api/winkel'));

// ---------- opmaak ----------
/** Tekst met *woord* -> woord vet (allergenen), veilig ge-escaped. */
export const metVet = (t) => esc(t).replace(/\*([^*\n]+)\*/g, '<strong>$1</strong>');

export function fotoHtml(p, { cls = '', pos = '' } = {}) {
  const f = p.fotos?.[0];
  if (!f) return `<div class="photo ${cls}"></div>`;
  return `<div class="photo has-img ${cls}"><img src="${esc(f.url)}" alt="${esc(f.alt || p.naam)}" loading="lazy" ${pos ? `style="object-position:${esc(pos)}"` : ''}></div>`;
}

export function productKaart(p) {
  const chips = [
    !p.op_voorraad ? '<span class="chip sold">Uitverkocht</span>' : p.diepvries ? '<span class="chip ice">Diepgevroren</span>' : '',
    p.op_voorraad && p.bijna_op ? '<span class="chip bijna">Bijna op</span>' : '',
  ].join('');
  return `<article class="card${p.op_voorraad ? '' : ' is-sold'}">
    <a class="card-link" href="/worst/${esc(p.slug)}" aria-label="${esc(p.naam)}">
      <div style="position:relative">${fotoHtml(p)}<div class="chips">${chips}</div></div>
    </a>
    <div class="body">
      <h3><a class="card-link" href="/worst/${esc(p.slug)}">${esc(p.naam)}</a></h3>
      <p class="meta">${esc([p.eenheid, p.gewicht_gram ? `± ${p.gewicht_gram} g` : ''].filter(Boolean).join(' · '))}</p>
      <div class="foot">
        <p class="price">${euro(p.prijs_cent)}${p.kiloprijs_cent ? `<small>${euro(p.kiloprijs_cent)} per kg</small>` : ''}</p>
        ${p.op_voorraad ? `<button class="add" type="button" data-add="${p.id}" data-naam="${esc(p.naam)}" aria-label="${esc(p.naam)} in mandje">+</button>` : ''}
      </div>
    </div>
  </article>`;
}

/** Tekst uit het beheer. Per regel: "# " of "## " = titel, "- " = opsomming, andere regels = alinea.
 *  Opeenvolgende gewone regels vormen één alinea; een lege regel begint een nieuwe. */
export function tekstNaarHtml(t, { titel = 'h2' } = {}) {
  let html = '', alinea = [], lijst = [];
  const sluitAlinea = () => { if (alinea.length) { html += `<p>${alinea.map(esc).join('<br>')}</p>`; alinea = []; } };
  const sluitLijst = () => { if (lijst.length) { html += `<ul>${lijst.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`; lijst = []; } };
  for (const ruw of String(t || '').split('\n')) {
    const r = ruw.trim();
    if (!r) { sluitAlinea(); sluitLijst(); continue; }
    if (/^#{1,3} /.test(r)) { sluitAlinea(); sluitLijst(); html += `<${titel}>${esc(r.replace(/^#{1,3} /, ''))}</${titel}>`; continue; }
    if (r.startsWith('- ')) { sluitAlinea(); lijst.push(r.slice(2)); continue; }
    sluitLijst(); alinea.push(r);
  }
  sluitAlinea(); sluitLijst();
  return html;
}

// ---------- melding ----------
let toastTimer;
export function melding(html) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.innerHTML = html;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
}

// ---------- start: kop en voet ----------
export async function startPagina() {
  toonAantal();
  document.getElementById('cart-btn')?.classList.remove('bump');

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-add]');
    if (!b) return;
    e.preventDefault();
    mandje.voegToe(Number(b.dataset.add), 1);
    melding(`${esc(b.dataset.naam)} zit in je mandje. <a href="/mandje">Naar mandje</a>`);
  });

  try {
    const { bedrijf } = await winkelInfo();
    const voet = document.getElementById('voet-bedrijf');
    if (voet && bedrijf) {
      voet.innerHTML = [
        bedrijf.handelsnaam && `<li><strong>${esc(bedrijf.handelsnaam)}</strong></li>`,
        bedrijf.naam && `<li>${esc(bedrijf.naam)}</li>`,
        bedrijf.ondernemingsnummer && `<li>Ondernemingsnummer ${esc(bedrijf.ondernemingsnummer)}</li>`,
        bedrijf.adres && `<li>${esc(bedrijf.adres).replace(/\n/g, '<br>')}</li>`,
        bedrijf.email && `<li><a href="mailto:${esc(bedrijf.email)}">${esc(bedrijf.email)}</a></li>`,
        bedrijf.telefoon && `<li>${esc(bedrijf.telefoon)}</li>`,
      ].filter(Boolean).join('');
    }
    document.querySelectorAll('[data-btw]').forEach((el) => { el.textContent = `${bedrijf?.btw_procent ?? 6} %`; });
  } catch { /* voet blijft zonder gegevens */ }
}
