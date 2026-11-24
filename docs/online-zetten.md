# Online zetten op Cloudflare

Alles gebeurt in het Cloudflare-dashboard (dash.cloudflare.com). Er zijn geen sleutels of wachtwoorden nodig in de code.

## 1. Database (D1)
1. **Storage & Databases → D1 SQL Database → Create**. Naam: `dongoworsten`.
2. Kopieer de **Database ID**; die komt in `wrangler.toml`.
3. Open het tabblad **Console**, plak de volledige inhoud van `migrations/0001_basis.sql` en klik **Execute**.
   Voer `seed/voorbeeld.sql` niet uit: dat is alleen voor lokaal testen.

## 2. Opslag voor foto's (R2)
1. **Storage & Databases → R2**. De eerste keer vraagt Cloudflare een betaalkaart; tot 10 GB is het gratis.
2. **Create bucket**. Naam: `dongoworsten-fotos`. Locatie: automatisch. Laat de bucket privé: de site toont de foto's zelf.

## 3. Pages-project
1. **Workers & Pages → Create → Pages → Connect to Git**, kies `Dongoworsten`.
2. Production branch: `claude/tender-bohr-st13f8` (later `main`).
3. Framework: *None*. Build command: leeg. Output directory: `public`.
4. Na de eerste deploy: **Settings → Variables and Secrets → Add**, type *Secret*, naam `BEHEER_EMAILS`,
   waarde: de e-mailadressen van de beheerders, gescheiden door een komma.

## 4. Inloggen op het beheer (Cloudflare Access)
1. **Zero Trust** (linkermenu). De eerste keer: kies een teamnaam, bv. `dongo`, en het gratis plan.
2. **Access → Applications → Add an application → Self-hosted**.
   - Naam: `Dongo beheer`. Sessieduur: 1 week.
   - Domein 1: `dongoworsten.pages.dev`, pad `beheer`.
   - Domein 2: `dongoworsten.pages.dev`, pad `api/beheer`.
3. Policy: *Allow*, regel **Emails** met dezelfde adressen als in `BEHEER_EMAILS`.
4. Inlogmethode: **One-time PIN** (een code per mail).
5. Kopieer de **Application Audience (AUD) Tag** (Applications → Dongo beheer → Overview)
   en het **teamdomein** (Settings → Custom Pages, bv. `https://dongo.cloudflareaccess.com`).

## 5. Afronden
Database ID, AUD-tag en teamdomein komen in `wrangler.toml`. Na de volgende deploy werkt `https://dongoworsten.pages.dev/beheer/`.
