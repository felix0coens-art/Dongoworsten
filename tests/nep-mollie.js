// Nagebootste Mollie, alleen voor lokaal testen (poort 8790).
// Gedraagt zich zoals de echte API voor wat de winkel gebruikt: betaling aanmaken, opvragen,
// een betaalpagina, en daarna de webhook aanroepen en terugsturen naar de winkel.
import http from 'node:http';

const betalingen = new Map();
const POORT = Number(process.env.POORT || 8790);

function stuur(res, status, data, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(data) : data);
}
const lees = (req) => new Promise((ok) => { let d = ''; req.on('data', (c) => (d += c)); req.on('end', () => ok(d)); });

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${POORT}`);
  if (url.pathname.startsWith('/v2/') && req.headers.authorization !== 'Bearer test_lokaal') {
    return stuur(res, 401, { status: 401, title: 'Unauthorized Request', detail: 'Missing authentication, or failed to authenticate' });
  }
  if (req.method === 'POST' && url.pathname === '/v2/payments') {
    const b = JSON.parse(await lees(req));
    if (!b.amount || !/^\d+\.\d{2}$/.test(b.amount.value) || !b.redirectUrl) return stuur(res, 422, { status: 422, detail: 'Ongeldig' });
    const id = 'tr_' + Math.random().toString(36).slice(2, 12);
    const p = { resource: 'payment', id, status: 'open', amount: b.amount, description: b.description, redirectUrl: b.redirectUrl, webhookUrl: b.webhookUrl, metadata: b.metadata,
      _links: { checkout: { href: `http://localhost:${POORT}/checkout/${id}` } } };
    betalingen.set(id, p);
    console.log('betaling aangemaakt', id, b.amount.value, b.description);
    return stuur(res, 201, p);
  }
  const m = url.pathname.match(/^\/v2\/payments\/(tr_\w+)$/);
  if (req.method === 'GET' && m) {
    const p = betalingen.get(m[1]);
    return p ? stuur(res, 200, p) : stuur(res, 404, { status: 404, detail: 'Not found' });
  }
  const c = url.pathname.match(/^\/checkout\/(tr_\w+)$/);
  if (c && betalingen.has(c[1])) {
    const p = betalingen.get(c[1]);
    if (req.method === 'GET') {
      return stuur(res, 200, `<!doctype html><meta charset="utf-8"><title>Nagebootste betaling</title>
        <body style="font-family:system-ui;max-width:480px;margin:60px auto"><h1>Nagebootste Mollie</h1>
        <p>${p.description}: <b>€ ${p.amount.value}</b></p>
        <form method="post"><button name="status" value="paid">Betaald</button> <button name="status" value="canceled">Annuleren</button> <button name="status" value="failed">Mislukt</button></form></body>`, 'text/html; charset=utf-8');
    }
    const status = new URLSearchParams(await lees(req)).get('status');
    p.status = ['paid', 'canceled', 'failed', 'expired'].includes(status) ? status : 'failed';
    if (p.webhookUrl) {
      const w = await fetch(p.webhookUrl, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `id=${p.id}` }).catch((e) => ({ status: e.message }));
      console.log('webhook', p.id, p.status, '->', w.status);
    }
    res.writeHead(303, { location: p.redirectUrl });
    return res.end();
  }
  stuur(res, 404, { status: 404 });
}).listen(POORT, () => console.log(`Nep-Mollie op http://localhost:${POORT}`));
