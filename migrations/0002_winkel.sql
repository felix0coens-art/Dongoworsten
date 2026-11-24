-- Fase 3: geheime code per bestelling (voor de bedankpagina) en een notitie voor Victor.
ALTER TABLE bestellingen ADD COLUMN toegangscode TEXT NOT NULL DEFAULT '';
ALTER TABLE bestellingen ADD COLUMN notitie TEXT NOT NULL DEFAULT '';
ALTER TABLE bestellingen ADD COLUMN mollie_status TEXT NOT NULL DEFAULT '';
-- Startverhaal, alleen als het nog leeg is. Blokken gescheiden door een lege regel:
-- "## Titel" + tekst = stap in de tijdlijn, een blok tussen aanhalingstekens = citaat.
UPDATE instellingen
SET waarde = json_set(waarde, '$.verhaal_tekst',
'"Dit moet ik zelf kunnen maken!"

## Ruim vijf jaar geleden
Victor proeft in Frankrijk een saucisson die hem niet meer loslaat.

## Terug thuis
Hij koopt een gehaktmolen en een worstenvuller. De keuken wordt een werkplaats.

## Bij de slager
Hij werkt samen met een ervaren slager, leert de fijne kneepjes en maakt zijn eerste charcuterie.

## Vandaag
Meer dan 500 kilo worsten later. Nog altijd met de hand, nog altijd in kleine reeksen.')
WHERE sleutel = 'teksten' AND COALESCE(json_extract(waarde, '$.verhaal_tekst'), '') = '';
