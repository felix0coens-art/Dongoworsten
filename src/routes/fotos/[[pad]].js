// Productfoto's uit R2. Elke foto heeft een unieke naam, dus mag lang in de cache.
export async function onRequestGet({ params, env }) {
  const pad = Array.isArray(params.pad) ? params.pad.join('/') : String(params.pad || '');
  if (!/^producten\/\d+\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(pad)) return new Response('Niet gevonden', { status: 404 });
  const obj = await env.FOTOS.get(pad);
  if (!obj) return new Response('Niet gevonden', { status: 404 });
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('x-content-type-options', 'nosniff');
  return new Response(obj.body, { headers });
}
