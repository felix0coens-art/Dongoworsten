-- Alleen voor lokaal testen: twee voorbeeldproducten. Niet in productie uitvoeren.
INSERT INTO producten (slug, naam, korte_tekst, prijs_cent, eenheid, gewicht_gram, ingredienten, bevat, sporen, bewaren, bereiden, diepvries, voorraad, zichtbaar, volgorde)
VALUES
('voorbeeld-boerenworst', 'Voorbeeld: boerenworst met mosterdzaad', 'Grof gedraaid varkensvlees met heel mosterdzaad.', 720, 'Pak van 4', 480,
 'Varkensvlees (78 %), varkensspek, water, zout, *mosterdzaad*, zwarte peper, nootmuskaat, knoflook, natuurlijke varkensdarm.',
 '["mosterd"]', '["selderij","melk"]', 'Diepgevroren bewaren bij −18 °C.', 'Bak 12 à 15 minuten op middelhoog vuur.', 1, 14, 1, 1),
('voorbeeld-kruidenworst', 'Voorbeeld: kruidenworst met peterselie', '', 750, 'Pak van 4', 440,
 'Varkensvlees, peterselie, zout, peper, natuurlijke varkensdarm.', '[]', '[]', '', '', 1, NULL, 0, 2);
