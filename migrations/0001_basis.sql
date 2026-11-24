-- Basis: producten, foto's, instellingen en bestellingen.
-- Bedragen staan altijd in eurocent (gehele getallen).

CREATE TABLE producten (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  slug          TEXT    NOT NULL UNIQUE,
  naam          TEXT    NOT NULL,
  korte_tekst   TEXT    NOT NULL DEFAULT '',
  omschrijving  TEXT    NOT NULL DEFAULT '',
  prijs_cent    INTEGER NOT NULL CHECK (prijs_cent >= 0),
  eenheid       TEXT    NOT NULL DEFAULT '',          -- bv. "Pak van 4"
  gewicht_gram  INTEGER CHECK (gewicht_gram IS NULL OR gewicht_gram > 0),
  ingredienten  TEXT    NOT NULL DEFAULT '',          -- allergenen tussen *sterretjes*
  bevat         TEXT    NOT NULL DEFAULT '[]',        -- JSON-lijst van allergeen-sleutels
  sporen        TEXT    NOT NULL DEFAULT '[]',        -- JSON-lijst van allergeen-sleutels
  bewaren       TEXT    NOT NULL DEFAULT '',
  bereiden      TEXT    NOT NULL DEFAULT '',
  diepvries     INTEGER NOT NULL DEFAULT 1,
  voorraad      INTEGER CHECK (voorraad IS NULL OR voorraad >= 0),  -- NULL = niet bijhouden
  zichtbaar     INTEGER NOT NULL DEFAULT 0,
  volgorde      INTEGER NOT NULL DEFAULT 0,
  aangemaakt    TEXT    NOT NULL DEFAULT (datetime('now')),
  gewijzigd     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE fotos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id  INTEGER NOT NULL REFERENCES producten(id) ON DELETE CASCADE,
  sleutel     TEXT    NOT NULL UNIQUE,                -- pad in R2
  alt         TEXT    NOT NULL DEFAULT '',
  volgorde    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX fotos_product ON fotos(product_id, volgorde);

CREATE TABLE instellingen (
  sleutel   TEXT PRIMARY KEY,
  waarde    TEXT NOT NULL,                            -- JSON
  gewijzigd TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE bestellingen (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  nummer           TEXT    NOT NULL UNIQUE,           -- bv. DW-2026-0001
  status           TEXT    NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open','betaald','klaargezet','geleverd','geannuleerd','mislukt')),
  levering         TEXT    NOT NULL CHECK (levering IN ('leveren','afhalen')),
  naam             TEXT    NOT NULL,
  email            TEXT    NOT NULL,
  telefoon         TEXT    NOT NULL,
  adres_straat     TEXT,
  adres_postcode   TEXT,
  adres_gemeente   TEXT,
  opmerking        TEXT    NOT NULL DEFAULT '',
  subtotaal_cent   INTEGER NOT NULL,
  leverkost_cent   INTEGER NOT NULL DEFAULT 0,
  totaal_cent      INTEGER NOT NULL,
  mollie_id        TEXT    UNIQUE,
  mails_verstuurd  INTEGER NOT NULL DEFAULT 0,
  aangemaakt       TEXT    NOT NULL DEFAULT (datetime('now')),
  betaald_op       TEXT
);
CREATE INDEX bestellingen_status ON bestellingen(status, aangemaakt);

CREATE TABLE bestelregels (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  bestelling_id    INTEGER NOT NULL REFERENCES bestellingen(id) ON DELETE CASCADE,
  product_id       INTEGER REFERENCES producten(id) ON DELETE SET NULL,
  naam             TEXT    NOT NULL,                  -- naam en prijs op het moment van bestellen
  eenheid          TEXT    NOT NULL DEFAULT '',
  prijs_cent       INTEGER NOT NULL,
  aantal           INTEGER NOT NULL CHECK (aantal > 0)
);

-- Startwaarden: Victor past ze aan in het beheer.
INSERT INTO instellingen (sleutel, waarde) VALUES
('levering', '{"leveren_aan":true,"leverkost_cent":650,"gratis_vanaf_cent":5000,"minimum_cent":0,"postcodes":[],"leveren_info":"We leveren diepgevroren aan huis. Na je bestelling nemen we contact op om een moment af te spreken.","afhalen_aan":false,"afhaal_adres":"","afhaal_info":""}'),
('bedrijf',  '{"naam":"Coens, Victor","handelsnaam":"Dongo Worsten","ondernemingsnummer":"1042.302.513","adres":"","email":"","telefoon":"","btw_procent":6}'),
('teksten',  '{"hero_titel":"Worsten, met de hand gemaakt.","hero_tekst":"Het begon met één Franse saucisson. Vijf jaar en meer dan 500 kilo later draait en vult Victor zijn eigen worsten, in kleine reeksen. Ze komen diepgevroren bij je thuis.","verhaal_titel":"Van één saucisson naar 500 kilo","verhaal_tekst":"","voorwaarden":"","privacy":""}');
