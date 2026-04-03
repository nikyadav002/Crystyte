// CPK colors and covalent / van-der-Waals radii (Å)
// Colors from Jmol/CPK convention; radii from Alvarez 2008 + CCDC
export const ELEMENTS = {
  H:  { name:'Hydrogen',     color:'#C8C8C8', radius:0.31, vdw:1.20 },
  He: { name:'Helium',       color:'#D9FFFF', radius:0.28, vdw:1.40 },
  Li: { name:'Lithium',      color:'#CC80FF', radius:1.28, vdw:1.82 },
  Be: { name:'Beryllium',    color:'#C2FF00', radius:0.96, vdw:1.53 },
  B:  { name:'Boron',        color:'#FFB5B5', radius:0.84, vdw:1.92 },
  C:  { name:'Carbon',       color:'#909090', radius:0.77, vdw:1.70 },
  N:  { name:'Nitrogen',     color:'#3050F8', radius:0.75, vdw:1.55 },
  O:  { name:'Oxygen',       color:'#FF0D0D', radius:0.73, vdw:1.52 },
  F:  { name:'Fluorine',     color:'#90E050', radius:0.71, vdw:1.47 },
  Ne: { name:'Neon',         color:'#B3E3F5', radius:0.69, vdw:1.54 },
  Na: { name:'Sodium',       color:'#AB5CF2', radius:1.66, vdw:2.27 },
  Mg: { name:'Magnesium',    color:'#8AFF00', radius:1.41, vdw:1.73 },
  Al: { name:'Aluminum',     color:'#BFA6A6', radius:1.21, vdw:1.84 },
  Si: { name:'Silicon',      color:'#F0C8A0', radius:1.11, vdw:2.10 },
  P:  { name:'Phosphorus',   color:'#FF8000', radius:1.07, vdw:1.80 },
  S:  { name:'Sulfur',       color:'#FFFF30', radius:1.05, vdw:1.80 },
  Cl: { name:'Chlorine',     color:'#1FF01F', radius:1.02, vdw:1.75 },
  Ar: { name:'Argon',        color:'#80D1E3', radius:1.06, vdw:1.88 },
  K:  { name:'Potassium',    color:'#8F40D4', radius:2.03, vdw:2.75 },
  Ca: { name:'Calcium',      color:'#3DFF00', radius:1.76, vdw:2.31 },
  Sc: { name:'Scandium',     color:'#E6E6E6', radius:1.70, vdw:2.11 },
  Ti: { name:'Titanium',     color:'#BFC2C7', radius:1.60, vdw:2.00 },
  V:  { name:'Vanadium',     color:'#A6A6AB', radius:1.53, vdw:2.00 },
  Cr: { name:'Chromium',     color:'#8A99C7', radius:1.39, vdw:2.00 },
  Mn: { name:'Manganese',    color:'#9C7AC7', radius:1.61, vdw:2.00 },
  Fe: { name:'Iron',         color:'#E06633', radius:1.32, vdw:2.00 },
  Co: { name:'Cobalt',       color:'#F090A0', radius:1.50, vdw:2.00 },
  Ni: { name:'Nickel',       color:'#50D050', radius:1.24, vdw:1.63 },
  Cu: { name:'Copper',       color:'#C88033', radius:1.32, vdw:1.40 },
  Zn: { name:'Zinc',         color:'#7D80B0', radius:1.22, vdw:1.39 },
  Ga: { name:'Gallium',      color:'#C28F8F', radius:1.22, vdw:1.87 },
  Ge: { name:'Germanium',    color:'#668F8F', radius:1.20, vdw:2.11 },
  As: { name:'Arsenic',      color:'#BD80E3', radius:1.19, vdw:1.85 },
  Se: { name:'Selenium',     color:'#FFA100', radius:1.20, vdw:1.90 },
  Br: { name:'Bromine',      color:'#A62929', radius:1.20, vdw:1.85 },
  Kr: { name:'Krypton',      color:'#5CB8D1', radius:1.16, vdw:2.02 },
  Rb: { name:'Rubidium',     color:'#702EB0', radius:2.20, vdw:3.03 },
  Sr: { name:'Strontium',    color:'#00FF00', radius:1.95, vdw:2.49 },
  Y:  { name:'Yttrium',      color:'#94FFFF', radius:1.90, vdw:2.00 },
  Zr: { name:'Zirconium',    color:'#94E0E0', radius:1.75, vdw:2.00 },
  Nb: { name:'Niobium',      color:'#73C2C9', radius:1.64, vdw:2.00 },
  Mo: { name:'Molybdenum',   color:'#54B5B5', radius:1.54, vdw:2.00 },
  Tc: { name:'Technetium',   color:'#3B9E9E', radius:1.47, vdw:2.00 },
  Ru: { name:'Ruthenium',    color:'#248F8F', radius:1.46, vdw:2.00 },
  Rh: { name:'Rhodium',      color:'#0A7D8C', radius:1.42, vdw:2.00 },
  Pd: { name:'Palladium',    color:'#006985', radius:1.39, vdw:1.63 },
  Ag: { name:'Silver',       color:'#C0C0C0', radius:1.45, vdw:1.72 },
  Cd: { name:'Cadmium',      color:'#FFD98F', radius:1.44, vdw:1.58 },
  In: { name:'Indium',       color:'#A67573', radius:1.42, vdw:1.93 },
  Sn: { name:'Tin',          color:'#668080', radius:1.39, vdw:2.17 },
  Sb: { name:'Antimony',     color:'#9E63B5', radius:1.39, vdw:2.06 },
  Te: { name:'Tellurium',    color:'#D47A00', radius:1.38, vdw:2.06 },
  I:  { name:'Iodine',       color:'#940094', radius:1.39, vdw:1.98 },
  Xe: { name:'Xenon',        color:'#429EB0', radius:1.40, vdw:2.16 },
  Cs: { name:'Cesium',       color:'#57178F', radius:2.44, vdw:3.43 },
  Ba: { name:'Barium',       color:'#00C900', radius:2.15, vdw:2.68 },
  La: { name:'Lanthanum',    color:'#70D4FF', radius:2.07, vdw:2.00 },
  Ce: { name:'Cerium',       color:'#FFFFC7', radius:2.04, vdw:2.00 },
  Pr: { name:'Praseodymium', color:'#D9FFC7', radius:2.03, vdw:2.00 },
  Nd: { name:'Neodymium',    color:'#C7FFC7', radius:2.01, vdw:2.00 },
  Pm: { name:'Promethium',   color:'#A3FFC7', radius:1.99, vdw:2.00 },
  Sm: { name:'Samarium',     color:'#8FFFC7', radius:1.98, vdw:2.00 },
  Eu: { name:'Europium',     color:'#61FFC7', radius:1.98, vdw:2.00 },
  Gd: { name:'Gadolinium',   color:'#45FFC7', radius:1.96, vdw:2.00 },
  Tb: { name:'Terbium',      color:'#30FFC7', radius:1.94, vdw:2.00 },
  Dy: { name:'Dysprosium',   color:'#1FFFC7', radius:1.92, vdw:2.00 },
  Ho: { name:'Holmium',      color:'#00FF9C', radius:1.92, vdw:2.00 },
  Er: { name:'Erbium',       color:'#00E675', radius:1.89, vdw:2.00 },
  Tm: { name:'Thulium',      color:'#00D452', radius:1.90, vdw:2.00 },
  Yb: { name:'Ytterbium',    color:'#00BF38', radius:1.87, vdw:2.00 },
  Lu: { name:'Lutetium',     color:'#00AB24', radius:1.87, vdw:2.00 },
  Hf: { name:'Hafnium',      color:'#4DC2FF', radius:1.75, vdw:2.00 },
  Ta: { name:'Tantalum',     color:'#4DA6FF', radius:1.70, vdw:2.00 },
  W:  { name:'Tungsten',     color:'#2194D6', radius:1.62, vdw:2.00 },
  Re: { name:'Rhenium',      color:'#267DAB', radius:1.51, vdw:2.00 },
  Os: { name:'Osmium',       color:'#266696', radius:1.44, vdw:2.00 },
  Ir: { name:'Iridium',      color:'#175487', radius:1.41, vdw:2.00 },
  Pt: { name:'Platinum',     color:'#D0D0E0', radius:1.36, vdw:1.75 },
  Au: { name:'Gold',         color:'#FFD123', radius:1.36, vdw:1.66 },
  Hg: { name:'Mercury',      color:'#B8B8D0', radius:1.32, vdw:1.55 },
  Tl: { name:'Thallium',     color:'#A6544D', radius:1.45, vdw:1.96 },
  Pb: { name:'Lead',         color:'#575961', radius:1.46, vdw:2.02 },
  Bi: { name:'Bismuth',      color:'#9E4FB5', radius:1.48, vdw:2.07 },
  Po: { name:'Polonium',     color:'#AB5C00', radius:1.40, vdw:1.97 },
  At: { name:'Astatine',     color:'#754F45', radius:1.50, vdw:2.02 },
  Rn: { name:'Radon',        color:'#428296', radius:1.50, vdw:2.20 },
  Fr: { name:'Francium',     color:'#420066', radius:2.60, vdw:3.48 },
  Ra: { name:'Radium',       color:'#007D00', radius:2.21, vdw:2.83 },
  Ac: { name:'Actinium',     color:'#70ABFA', radius:2.15, vdw:2.00 },
  Th: { name:'Thorium',      color:'#00BAFF', radius:2.06, vdw:2.00 },
  Pa: { name:'Protactinium', color:'#00A1FF', radius:2.00, vdw:2.00 },
  U:  { name:'Uranium',      color:'#008FFF', radius:1.96, vdw:1.86 },
  Np: { name:'Neptunium',    color:'#0080FF', radius:1.90, vdw:2.00 },
  Pu: { name:'Plutonium',    color:'#006BFF', radius:1.87, vdw:2.00 },
  Am: { name:'Americium',    color:'#545CF2', radius:1.80, vdw:2.00 },
  Cm: { name:'Curium',       color:'#785CE3', radius:1.69, vdw:2.00 },
  XX: { name:'Unknown',      color:'#FF69B4', radius:1.50, vdw:1.80 },
}

const DISPLAY_COLORS = {
  H:  '#d8b6b6',
  B:  '#cc9292',
  C:  '#8e5f40',
  N:  '#8ea2da',
  O:  '#d94a4a',
  F:  '#57b864',
  Si: '#c69672',
  P:  '#d58b34',
  S:  '#d6b54b',
  Cl: '#48a45a',
  Br: '#8a4a3f',
  I:  '#7b2f82',
}

export function getElement(symbol) {
  if (!symbol) return ELEMENTS.XX
  if (ELEMENTS[symbol]) return ELEMENTS[symbol]
  const cap = symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase()
  return ELEMENTS[cap] ?? ELEMENTS.XX
}

export function getElementColor(symbol) {
  if (!symbol) return ELEMENTS.XX.color
  const normalized = symbol.charAt(0).toUpperCase() + symbol.slice(1).toLowerCase()
  const element = getElement(normalized)
  return DISPLAY_COLORS[normalized] ?? element.color
}

// Extract element symbol from a CIF-style atom label like "Cu1", "Fe2a", "O1_a"
export function labelToSymbol(label) {
  const m = label.match(/^([A-Z][a-z]?)/)
  if (!m) return 'XX'
  const sym = m[1]
  return ELEMENTS[sym] ? sym : 'XX'
}
