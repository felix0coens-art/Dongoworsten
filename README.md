# Dongo Worsten

Website en webshop voor Dongo Worsten, de ambachtelijke worsten van Victor Coens.

## Stand van zaken

| Fase | Wat | Status |
|---|---|---|
| 0. Input | Logo, foto's, ondernemingsgegevens | ✅ |
| 1. Ontwerp | Homepage en productpagina (statisch, voorbeeldproducten) | ✅ goedgekeurd |
| 2. Basis | D1-database, beheer met login, foto's in R2 | ✅ lokaal getest, nog niet online |
| 3. Shop | Catalogus uit de database, mandje, afrekenen met Mollie (test), webhook | |
| 4. Mails | Bevestiging naar de klant, bestelmelding naar Victor | |
| 5. Juridisch | Algemene voorwaarden, privacyverklaring, ondernemingsgegevens | |
| 6. Live | Domein, Mollie live-sleutel | |

Na elke fase volgt eerst een akkoord voor we verdergaan.

## Mappen

- `public/` – wat online komt. `index.html` is voorlopig het goedgekeurde ontwerp (`#product` toont de productpagina); in fase 3 wordt dat de echte winkel.
- `public/beheer/` – de beheerpagina (`/beheer/`).
- `functions/` – de server (Cloudflare Pages Functions): `api/beheer/*` voor het beheer, `api/producten` en `api/winkel` voor de winkel, `fotos/*` voor productfoto's.
- `src/lib/` – gedeelde code: toegangscontrole, invoercontrole, database.
- `migrations/` – het databaseschema. `seed/` – voorbeeldproducten, alleen voor lokaal testen.
- `merk/` – het logo: het originele Illustrator-bestand en SVG-versies.

## Lokaal draaien

```bash
npm install
cp .dev.vars.example .dev.vars   # lokaal ben je zo automatisch beheerder
npm run db:migrate:local
npm run db:seed:local
npm run dev                      # http://localhost:8788 en http://localhost:8788/beheer/
npm test
```

## Beheer: wat kan Victor zelf

- **Producten:** naam, teksten, prijs, verpakking en gewicht (kiloprijs wordt berekend), ingrediënten met allergenen tussen `*sterretjes*`, per allergeen bevat / sporen / nee, bewaren en bereiden, voorraad, zichtbaar of verborgen, volgorde, foto's (worden in de browser verkleind tot 1600 px).
- **Levering:** leveren aan/uit, leverkost, gratis vanaf, minimumbedrag, postcodes, afhalen aan/uit met adres en uitleg.
- **Teksten:** titel en tekst op de startpagina, het verhaal, algemene voorwaarden, privacyverklaring.
- **Onderneming:** naam, ondernemingsnummer, adres, e-mail, telefoon, btw-percentage.
- **Bestellingen:** overzicht per status (vult zich vanaf fase 3).

Een product kan pas zichtbaar worden als de ingrediënten ingevuld zijn.

## Beveiliging van het beheer

1. Cloudflare Access staat voor `/beheer/*` en `/api/beheer/*` en laat alleen de toegelaten e-mailadressen binnen (inloggen met een code per mail).
2. De server controleert het Access-token daarnaast zelf (handtekening, AUD, uitgever, vervaldatum) en het adres moet in `BEHEER_EMAILS` staan. Zonder `ACCESS_TEAM_DOMAIN` en `ACCESS_AUD` blijft het beheer dicht.
3. Wijzigingen worden alleen aanvaard van de eigen site (Origin-controle).
4. De lokale dev-aanmelding (`BEHEER_DEV_EMAIL`) werkt alleen op `localhost`.

## Merk

- Kleuren: worstroze `#E95D7C`, inkt `#141615`, hemelsblauw `#D9EBF2`, wit.
- Lettertype: Bricolage Grotesque (Google Fonts), voor alles.

## Gekozen aanpak

- Statische site op Cloudflare Pages, met Pages Functions voor afrekenen, webhook en beheer.
- Producten, prijzen, voorraad, leverkosten en teksten in Cloudflare D1; Victor beheert alles zelf via `/beheer`.
- Productfoto's in Cloudflare R2, op te laden via het beheer.
- Inloggen op het beheer via Cloudflare Access (Victor en Felix).
- Het mandje staat in de browser en bevat alleen product-id en aantal. Het totaal wordt altijd op de server berekend uit de database.
- Mollie: één betaling per bestelling (Bancontact, kaart). De webhook vraagt de status zelf op bij Mollie en verstuurt daarna de mails.
- Sleutels (Mollie, mail) als Cloudflare secrets, nooit in de code. Eerst alles met de Mollie-testsleutel.

## Ondernemingsgegevens

Coens, Victor · ondernemingsnummer 1042.302.513 · btw 6 % op voeding · adres en e-mailadres volgen.
