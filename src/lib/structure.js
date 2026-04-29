import { getElement } from './elements.js'
import { mat3Inv, fracToCart, cartToFrac, micFrac, getLatticeParams, centroid } from './math.js'
import { getBondRule, getBondRuleKey } from './bondingLogic.js'

// ---- Formula ----------------------------------------------------------------

function gcd(a, b) { return b === 0 ? a : gcd(b, a % b) }

export function computeFormula(atoms) {
  const counts = {}
  for (const a of atoms) {
    counts[a.symbol] = (counts[a.symbol] ?? 0) + 1
  }
  const keys = Object.keys(counts).sort()
  if (keys.length === 0) return ''
  const g = keys.reduce((acc, k) => gcd(acc, counts[k]), counts[keys[0]])
  return keys.map(k => {
    const n = counts[k] / g
    return n === 1 ? k : `${k}${n}`
  }).join('')
}

// ---- Normalise parsed output ------------------------------------------------
// Ensures all atom positions are Cartesian and lattice/formula are present.
// Input: { title, lattice, atoms:[{symbol, position, fractional}], spaceGroup }
// Output: adds cartesian positions, latticeParams, formula

export function normalizeStructure(parsed) {
  if (!parsed) return null
  let { lattice, atoms } = parsed

  let Linv = null
  if (lattice) Linv = mat3Inv(lattice)

  const normalized = atoms.map(atom => {
    let pos = atom.position.slice()
    if (atom.fractional && lattice) {
      pos = fracToCart(pos, lattice)
    }
    return { symbol: atom.symbol, position: pos }
  })

  const formula = computeFormula(normalized)
  const latticeParams = lattice ? getLatticeParams(lattice) : null
  const center = centroid(normalized.map(a => a.position))

  return {
    ...parsed,
    atoms: normalized,
    formula,
    latticeParams,
    center,
    Linv,
  }
}

// ---- Supercell expansion ----------------------------------------------------
// Tiles a normalised structure (Cartesian coords) by (na, nb, nc).
// Returns new structure with expanded atom list and scaled lattice.

export function expandSupercell(structure, [na, nb, nc]) {
  if (!structure) return null
  const { lattice, atoms, Linv } = structure

  if (!lattice || (na === 1 && nb === 1 && nc === 1)) return structure

  const newLattice = [
    lattice[0].map(x => x * na),
    lattice[1].map(x => x * nb),
    lattice[2].map(x => x * nc),
  ]

  const expanded = []
  for (let ia = 0; ia < na; ia++) {
    for (let ib = 0; ib < nb; ib++) {
      for (let ic = 0; ic < nc; ic++) {
        const offset = [
          ia * lattice[0][0] + ib * lattice[1][0] + ic * lattice[2][0],
          ia * lattice[0][1] + ib * lattice[1][1] + ic * lattice[2][1],
          ia * lattice[0][2] + ib * lattice[1][2] + ic * lattice[2][2],
        ]
        for (const atom of atoms) {
          expanded.push({
            symbol: atom.symbol,
            position: [
              atom.position[0] + offset[0],
              atom.position[1] + offset[1],
              atom.position[2] + offset[2],
            ],
          })
        }
      }
    }
  }

  return {
    ...structure,
    lattice: newLattice,
    atoms: expanded,
    formula: computeFormula(expanded),
    latticeParams: getLatticeParams(newLattice),
    center: centroid(expanded.map(a => a.position)),
    Linv: mat3Inv(newLattice),
  }
}

function formatXYZNumber(value) {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value
  return normalized.toFixed(8)
}

function formatCrystalNumber(value) {
  const normalized = Math.abs(value) < 1e-9 ? 0 : value
  return normalized.toFixed(8)
}

function wrapFractional(value) {
  let wrapped = value % 1
  if (wrapped < 0) wrapped += 1
  if (Math.abs(wrapped - 1) < 1e-8) wrapped = 0
  return wrapped
}

export function serializeXYZ(structure, title = '') {
  if (!structure?.atoms?.length) return ''

  const lines = [String(structure.atoms.length)]
  const headerParts = []
  if (structure.lattice) {
    const latticeText = structure.lattice
      .flat()
      .map(formatXYZNumber)
      .join(' ')
    headerParts.push(`Lattice="${latticeText}"`)
  }
  if (title) headerParts.push(title)
  lines.push(headerParts.join(' ').trim())

  for (const atom of structure.atoms) {
    lines.push([
      atom.symbol,
      formatXYZNumber(atom.position[0]),
      formatXYZNumber(atom.position[1]),
      formatXYZNumber(atom.position[2]),
    ].join(' '))
  }

  return `${lines.join('\n')}\n`
}

export function serializePOSCAR(structure, title = '') {
  if (!structure?.atoms?.length || !structure.lattice) return ''

  const Linv = structure.Linv ?? mat3Inv(structure.lattice)
  const groupedAtoms = new Map()
  for (const atom of structure.atoms) {
    if (!groupedAtoms.has(atom.symbol)) groupedAtoms.set(atom.symbol, [])
    groupedAtoms.get(atom.symbol).push(atom)
  }

  const symbols = [...groupedAtoms.keys()]
  const lines = [title || structure.title || 'crystyte supercell', '1.0']
  for (const vector of structure.lattice) {
    lines.push(vector.map(formatCrystalNumber).join(' '))
  }
  lines.push(symbols.join(' '))
  lines.push(symbols.map(symbol => groupedAtoms.get(symbol).length).join(' '))
  lines.push('Direct')

  for (const symbol of symbols) {
    for (const atom of groupedAtoms.get(symbol)) {
      const frac = cartToFrac(atom.position, Linv).map(wrapFractional)
      lines.push(frac.map(formatCrystalNumber).join(' '))
    }
  }

  return `${lines.join('\n')}\n`
}

export function serializeCIF(structure, title = '') {
  if (!structure?.atoms?.length || !structure.lattice) return ''

  const Linv = structure.Linv ?? mat3Inv(structure.lattice)
  const params = structure.latticeParams ?? getLatticeParams(structure.lattice)
  const blockName = (title || structure.title || 'crystyte_supercell')
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'crystyte_supercell'

  const lines = [
    `data_${blockName}`,
    `_cell_length_a ${formatCrystalNumber(params.a)}`,
    `_cell_length_b ${formatCrystalNumber(params.b)}`,
    `_cell_length_c ${formatCrystalNumber(params.c)}`,
    `_cell_angle_alpha ${formatCrystalNumber(params.alpha)}`,
    `_cell_angle_beta ${formatCrystalNumber(params.beta)}`,
    `_cell_angle_gamma ${formatCrystalNumber(params.gamma)}`,
    `_symmetry_space_group_name_H-M 'P 1'`,
    '',
    'loop_',
    '_symmetry_equiv_pos_as_xyz',
    "'x, y, z'",
    '',
    'loop_',
    '_atom_site_label',
    '_atom_site_type_symbol',
    '_atom_site_fract_x',
    '_atom_site_fract_y',
    '_atom_site_fract_z',
  ]

  const labelCounts = {}
  for (const atom of structure.atoms) {
    labelCounts[atom.symbol] = (labelCounts[atom.symbol] ?? 0) + 1
    const label = `${atom.symbol}${labelCounts[atom.symbol]}`
    const frac = cartToFrac(atom.position, Linv).map(wrapFractional)
    lines.push([
      label,
      atom.symbol,
      ...frac.map(formatCrystalNumber),
    ].join(' '))
  }

  return `${lines.join('\n')}\n`
}

// ---- Bond detection (MIC) ---------------------------------------------------
// Returns array of { i, j, start, mid, end } (all Cartesian)
// `end` is the MIC image of atom j relative to atom i.

export const BOND_SCALE = 1.15   // tolerance factor on sum of covalent radii
export const MIN_BOND = 0.4      // ignore pairs closer than this (Å)
const MAX_ATOMS_FOR_BONDS = 8000

export function detectBonds(atoms, lattice, Linv, bondOverrides = {}) {
  if (!atoms || atoms.length === 0) return []
  if (atoms.length > MAX_ATOMS_FOR_BONDS) return []

  const hasPBC = Boolean(lattice && Linv)
  const bonds = []

  for (let i = 0; i < atoms.length; i++) {
    const ri = atoms[i].position
    const ri_sym = atoms[i].symbol
    const ri_rad = getElement(ri_sym).radius

    for (let j = i + 1; j < atoms.length; j++) {
      const rj = atoms[j].position
      const rj_sym = atoms[j].symbol
      const defaultMaxBond = (ri_rad + getElement(rj_sym).radius) * BOND_SCALE
      const override = bondOverrides[getBondRuleKey(ri_sym, rj_sym)]
      if (override?.enabled === false) continue
      const rule = override ?? getBondRule(ri_sym, rj_sym)
      const minBond = Math.max(MIN_BOND, rule?.min ?? 0)
      const maxBond = rule?.max ?? defaultMaxBond

      let dx = rj[0] - ri[0]
      let dy = rj[1] - ri[1]
      let dz = rj[2] - ri[2]

      if (hasPBC) {
        // Convert to fractional, apply MIC, convert back
        const df = cartToFrac([dx, dy, dz], Linv)
        const dfMIC = micFrac(df)
        const dCart = [
          dfMIC[0] * lattice[0][0] + dfMIC[1] * lattice[1][0] + dfMIC[2] * lattice[2][0],
          dfMIC[0] * lattice[0][1] + dfMIC[1] * lattice[1][1] + dfMIC[2] * lattice[2][1],
          dfMIC[0] * lattice[0][2] + dfMIC[1] * lattice[1][2] + dfMIC[2] * lattice[2][2],
        ]
        dx = dCart[0]; dy = dCart[1]; dz = dCart[2]
      }

      const dist = Math.hypot(dx, dy, dz)
      if (dist < minBond || dist > maxBond) continue

      bonds.push({
        i, j,
        start: ri,
        mid: [ri[0] + dx * 0.5, ri[1] + dy * 0.5, ri[2] + dz * 0.5],
        end:  [ri[0] + dx,       ri[1] + dy,        ri[2] + dz],
      })
    }
  }

  return bonds
}

// ---- Unit cell box edges ----------------------------------------------------
// Returns 24 points (12 edges × 2 endpoints) as flat Float32Array for LineSegments
export function cellBoxLines(L) {
  if (!L) return null
  const [a, b, c] = L
  const o  = [0, 0, 0]
  const va = a
  const vb = b
  const vc = c
  const ab = [a[0]+b[0], a[1]+b[1], a[2]+b[2]]
  const ac = [a[0]+c[0], a[1]+c[1], a[2]+c[2]]
  const bc = [b[0]+c[0], b[1]+c[1], b[2]+c[2]]
  const abc= [a[0]+b[0]+c[0], a[1]+b[1]+c[1], a[2]+b[2]+c[2]]

  const edges = [
    // 4 edges along a
    [o,  va], [vb, ab], [vc, ac], [bc, abc],
    // 4 edges along b
    [o,  vb], [va, ab], [vc, bc], [ac, abc],
    // 4 edges along c
    [o,  vc], [va, ac], [vb, bc], [ab, abc],
  ]

  const arr = new Float32Array(edges.length * 6)
  let idx = 0
  for (const [p, q] of edges) {
    arr[idx++] = p[0]; arr[idx++] = p[1]; arr[idx++] = p[2]
    arr[idx++] = q[0]; arr[idx++] = q[1]; arr[idx++] = q[2]
  }
  return arr
}
