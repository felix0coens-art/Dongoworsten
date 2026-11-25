-- Fase 6: facturen van de webwinkel en bestellen als bedrijf.

-- Bedrijfsgegevens bij een bestelling (leeg = particulier).
ALTER TABLE bestellingen ADD COLUMN bedrijf_naam TEXT NOT NULL DEFAULT '';
ALTER TABLE bestellingen ADD COLUMN bedrijf_btw TEXT NOT NULL DEFAULT '';
ALTER TABLE bestellingen ADD COLUMN bedrijf_straat TEXT NOT NULL DEFAULT '';
ALTER TABLE bestellingen ADD COLUMN bedrijf_postcode TEXT NOT NULL DEFAULT '';
ALTER TABLE bestellingen ADD COLUMN bedrijf_gemeente TEXT NOT NULL DEFAULT '';

-- Eén factuur per betaalde bestelling, met een eigen doorlopende nummering per jaar (W2026-0001).
-- Testbestellingen krijgen een aparte reeks (TEST2026-0001) die niet meetelt.
-- De inhoud wordt bij het aanmaken vastgelegd (gegevens) en verandert daarna niet meer.
CREATE TABLE facturen (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nummer           TEXT    NOT NULL UNIQUE,
  reeks            TEXT    NOT NULL CHECK (reeks IN ('W', 'TEST')),
  jaar             INTEGER NOT NULL,
  volgnr           INTEGER NOT NULL,
  bestelling_id    INTEGER NOT NULL UNIQUE REFERENCES bestellingen(id),
  datum            TEXT    NOT NULL,                -- YYYY-MM-DD
  b2b              INTEGER NOT NULL DEFAULT 0,
  maatstaf_cent    INTEGER NOT NULL,                -- bedrag zonder btw
  btw_cent         INTEGER NOT NULL,
  totaal_cent      INTEGER NOT NULL,
  btw_procent      INTEGER NOT NULL,
  gegevens         TEXT    NOT NULL,                -- JSON: alles wat op de factuur staat
  peppol_verstuurd INTEGER NOT NULL DEFAULT 0,      -- alleen voor bedrijven: via Accountable verstuurd
  aangemaakt       TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE (reeks, jaar, volgnr)
);
CREATE INDEX facturen_datum ON facturen(reeks, datum);
