# Online zetten op Cloudflare

De site draait als één **Cloudflare Worker** (`dongoworsten`): de statische bestanden uit `public/` en de API uit `src/`.
Er staan geen sleutels of wachtwoorden in de code.

## Al gedaan
- D1-database `dongoworsten` met alle tabellen en startwaarden (`docs/d1-console.sql`).
- R2-bucket `dongoworsten-fotos`.
- Worker `dongoworsten` aangemaakt (nog met de standaardcode "Hello world").

## 1. Worker koppelen aan GitHub
1. **Compute → Workers & Pages → dongoworsten → Settings → Build → Connect** (Git repository).
2. Repository: `Dongoworsten`. Branch: `claude/tender-bohr-st13f8` (later `main`).
3. Build command: leeg. Deploy command: `npx wrangler deploy` (standaard). Root directory: `/`.
4. Opslaan. Elke push naar die branch zet de site automatisch online.

## 2. Wie mag beheren
**dongoworsten → Settings → Variables and Secrets → Add**: type *Secret*, naam `BEHEER_EMAILS`,
waarde: de e-mailadressen van de beheerders, gescheiden door een komma.

## 3. Inloggen op het beheer (Cloudflare Access)
Zolang er geen eigen domein is, beschermen we het hele `workers.dev`-adres. De winkel is toch nog niet publiek.
1. **Zero Trust** (linkermenu): de eerste keer een teamnaam kiezen (bv. `dongo`) en het gratis plan.
2. **dongoworsten → Settings → Domains & Routes → workers.dev → Enable Cloudflare Access**.
3. **Zero Trust → Access → Applications** → de nieuwe applicatie → **Policies**: zet bij *Include → Emails* de adressen uit `BEHEER_EMAILS`. Inlogmethode: One-time PIN.
4. Noteer de **Application Audience (AUD) Tag** en het **teamdomein** (bv. `https://dongo.cloudflareaccess.com`); die komen in `wrangler.toml`.

Zodra er een eigen domein is, beschermen we alleen nog `/beheer` en `/api/beheer` en wordt de winkel publiek.

## Databasewijzigingen later
Nieuwe bestanden in `migrations/` voeren we uit met `npx wrangler d1 migrations apply DB --remote`, of via de Console van D1.
