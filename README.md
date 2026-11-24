# Dongo Worsten

Website en webshop voor Dongo Worsten, de ambachtelijke worsten van Victor Coens.

## Stand van zaken

| Fase | Wat | Status |
|---|---|---|
| 0. Input | Logo, foto's, ondernemingsgegevens | ✅ |
| 1. Ontwerp | Homepage en productpagina (statisch, voorbeeldproducten) | ✅ goedgekeurd |
| 2. Basis | Cloudflare-project, D1-database, beheer met login | volgende stap |
| 3. Shop | Catalogus uit de database, mandje, afrekenen met Mollie (test), webhook | |
| 4. Mails | Bevestiging naar de klant, bestelmelding naar Victor | |
| 5. Juridisch | Algemene voorwaarden, privacyverklaring, ondernemingsgegevens | |
| 6. Live | Domein, Mollie live-sleutel | |

Na elke fase volgt eerst een akkoord voor we verdergaan.

## Mappen

- `ontwerp/` – het goedgekeurde ontwerp. Open `ontwerp/index.html` in een browser; `#product` toont de productpagina.
- `merk/` – het logo: het originele Illustrator-bestand en SVG-versies (met en zonder blauwe cirkel).

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
