// De 14 allergenen uit EU-verordening 1169/2011, bijlage II.
export const ALLERGENEN = [
  { sleutel: 'gluten', naam: 'Glutenbevattende granen' },
  { sleutel: 'schaaldieren', naam: 'Schaaldieren' },
  { sleutel: 'eieren', naam: 'Eieren' },
  { sleutel: 'vis', naam: 'Vis' },
  { sleutel: 'pinda', naam: "Pinda's" },
  { sleutel: 'soja', naam: 'Soja' },
  { sleutel: 'melk', naam: 'Melk' },
  { sleutel: 'noten', naam: 'Noten' },
  { sleutel: 'selderij', naam: 'Selderij' },
  { sleutel: 'mosterd', naam: 'Mosterd' },
  { sleutel: 'sesam', naam: 'Sesamzaad' },
  { sleutel: 'sulfiet', naam: 'Zwaveldioxide en sulfieten' },
  { sleutel: 'lupine', naam: 'Lupine' },
  { sleutel: 'weekdieren', naam: 'Weekdieren' },
];

export const ALLERGEEN_SLEUTELS = new Set(ALLERGENEN.map((a) => a.sleutel));
