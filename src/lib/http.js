// Kleine hulpfuncties voor antwoorden van de API.

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  });
}

export function fout(status, bericht, velden) {
  return json(velden ? { fout: bericht, velden } : { fout: bericht }, status);
}

export class Ongeldig extends Error {
  constructor(velden) {
    super('Ongeldige invoer');
    this.velden = velden;
  }
}

export async function leesJson(request, maxBytes = 200_000) {
  const type = request.headers.get('content-type') || '';
  if (!type.includes('application/json')) throw new Ongeldig({ _: 'Verwacht JSON.' });
  const tekst = await request.text();
  if (tekst.length > maxBytes) throw new Ongeldig({ _: 'Te veel gegevens in één keer.' });
  try {
    return JSON.parse(tekst);
  } catch {
    throw new Ongeldig({ _: 'Ongeldige JSON.' });
  }
}

// Zet fouten om naar nette antwoorden; onverwachte fouten worden gelogd, niet getoond.
export async function veilig(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Ongeldig) return fout(400, 'Controleer de gemarkeerde velden.', e.velden);
    console.error(e);
    return fout(500, 'Er ging iets mis op de server.');
  }
}
