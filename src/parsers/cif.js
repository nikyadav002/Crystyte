// Minimal CIF parser with symmetry expansion
// Handles: cell parameters, atom_site loops, symmetry operations, space group

import { labelToSymbol } from '../lib/elements.js'
import { latticeFromParams, fracToCart } from '../lib/math.js'

// ---- Tokenizer --------------------------------------------------------------
function tokenize(text) {
  const tokens = []
  const lines = text.split('\n')
  let inSemiBlock = false
  let semiVal = ''

  for (const rawLine of lines) {
    const line = rawLine.trimEnd()

    // Semicolon-delimited multi-line strings
    if (inSemiBlock) {
      if (line.startsWith(';')) {
        tokens.push({ type: 'value', val: semiVal.trim() })
        semiVal = ''
        inSemiBlock = false
      } else {
        semiVal += line + '\n'
      }
      continue
    }
    if (line.startsWith(';')) {
      inSemiBlock = true
      continue
    }

    // Strip comments
    const noComment = line.replace(/#.*$/, '').trim()
    if (!noComment) continue

    let i = 0
    while (i < noComment.length) {
      // Skip whitespace
      while (i < noComment.length && /\s/.test(noComment[i])) i++
      if (i >= noComment.length) break

      const ch = noComment[i]
      // Quoted string
      if (ch === "'" || ch === '"') {
        const q = ch
        i++
        let s = ''
        while (i < noComment.length && noComment[i] !== q) s += noComment[i++]
        i++ // closing quote
        tokens.push({ type: 'value', val: s })
      } else {
        // Bare token
        let s = ''
        while (i < noComment.length && !/\s/.test(noComment[i])) s += noComment[i++]
        if (s.startsWith('_')) tokens.push({ type: 'key', val: s.toLowerCase() })
        else if (s.toLowerCase() === 'loop_') tokens.push({ type: 'loop' })
        else if (s.toLowerCase().startsWith('data_')) tokens.push({ type: 'data', val: s })
        else tokens.push({ type: 'value', val: s })
      }
    }
  }
  return tokens
}

// Strip uncertainty notation: 0.2345(12) → 0.2345
function stripUncertainty(s) {
  return s.replace(/\(.*?\)/, '')
}

function toFloat(s) {
  if (typeof s !== 'string') return NaN
  return parseFloat(stripUncertainty(s))
}

// ---- Symmetry operation evaluator -------------------------------------------
function evalSymExpr(expr, x, y, z) {
  let e = expr.trim().toLowerCase()
  // Normalise: ensure explicit leading sign
  if (e && e[0] !== '+' && e[0] !== '-') e = '+' + e

  // Split into terms at each +/- boundary
  const termRe = /[+-][^+-]*/g
  const terms = e.match(termRe) ?? []
  let result = 0

  for (const term of terms) {
    const sign = term[0] === '-' ? -1 : 1
    const body = term.slice(1).trim()

    if (/x/.test(body)) result += sign * x
    else if (/y/.test(body)) result += sign * y
    else if (/z/.test(body)) result += sign * z
    else if (body.includes('/')) {
      const [num, den] = body.split('/')
      result += sign * (parseFloat(num.trim()) / parseFloat(den.trim()))
    } else if (body !== '') {
      result += sign * parseFloat(body)
    }
  }
  return result
}

function parseSymOps(opList) {
  return opList.map(op => {
    const parts = op.split(',')
    if (parts.length !== 3) return null
    return (x, y, z) => parts.map(p => evalSymExpr(p, x, y, z))
  }).filter(Boolean)
}

function wrapFrac(x) {
  return ((x % 1) + 1) % 1
}

function applySymmetry(asymAtoms, symOps) {
  const all = []
  const TOL = 0.01

  function isDuplicate(sym, pos) {
    for (const a of all) {
      if (a.symbol !== sym) continue
      const same = pos.every((v, i) => {
        let d = Math.abs(v - a.position[i])
        if (d > 0.5) d = 1 - d
        return d < TOL
      })
      if (same) return true
    }
    return false
  }

  for (const atom of asymAtoms) {
    const [x0, y0, z0] = atom.position
    for (const op of symOps) {
      const raw = op(x0, y0, z0)
      const pos = raw.map(wrapFrac)
      if (!isDuplicate(atom.symbol, pos)) {
        all.push({ symbol: atom.symbol, position: pos, fractional: true })
      }
    }
  }

  // Fallback: if symmetry produced nothing useful, return original atoms
  return all.length > 0 ? all : asymAtoms
}

// ---- Main parser ------------------------------------------------------------
export function parseCIF(text) {
  const tokens = tokenize(text)
  let idx = 0

  function peek() { return tokens[idx] }
  function next() { return tokens[idx++] }
  function expectValue() {
    const t = next()
    return t ? t.val : ''
  }

  // We collect from the first data block
  let cellA, cellB, cellC, cellAlpha = 90, cellBeta = 90, cellGamma = 90
  let spaceGroup = null
  const symOpStrings = []
  const atomSiteData = []
  let title = ''

  while (idx < tokens.length) {
    const t = next()
    if (!t) break

    if (t.type === 'data') {
      title = t.val.replace(/^data_/i, '')
      continue
    }

    if (t.type === 'key') {
      const key = t.val
      const val = expectValue()

      if (key === '_cell_length_a') cellA = toFloat(val)
      else if (key === '_cell_length_b') cellB = toFloat(val)
      else if (key === '_cell_length_c') cellC = toFloat(val)
      else if (key === '_cell_angle_alpha') cellAlpha = toFloat(val)
      else if (key === '_cell_angle_beta')  cellBeta  = toFloat(val)
      else if (key === '_cell_angle_gamma') cellGamma = toFloat(val)
      else if (
        key === '_symmetry_space_group_name_h-m' ||
        key === '_space_group_name_h-m_alt' ||
        key === '_symmetry_int_tables_number' ||
        key === '_space_group_it_number'
      ) { spaceGroup = val }
      else if (
        key === '_symmetry_equiv_pos_as_xyz' ||
        key === '_space_group_symop_operation_xyz'
      ) { symOpStrings.push(val) }
      continue
    }

    if (t.type === 'loop') {
      // Collect column headers
      const cols = []
      while (idx < tokens.length && peek()?.type === 'key') {
        cols.push(next().val)
      }

      // Collect rows of values
      const rows = []
      while (idx < tokens.length && peek()?.type === 'value') {
        const row = []
        for (let k = 0; k < cols.length; k++) {
          const vt = next()
          row.push(vt ? vt.val : '.')
        }
        rows.push(row)
      }

      // Detect symmetry op loop
      const symopCol = cols.findIndex(c =>
        c === '_symmetry_equiv_pos_as_xyz' ||
        c === '_space_group_symop_operation_xyz'
      )
      if (symopCol !== -1) {
        for (const row of rows) symOpStrings.push(row[symopCol])
      }

      // Detect atom site loop
      const hasAtomSite = cols.some(c => c.startsWith('_atom_site'))
      if (hasAtomSite) {
        const ci = {
          label: cols.indexOf('_atom_site_label'),
          type:  cols.indexOf('_atom_site_type_symbol'),
          fx:    cols.indexOf('_atom_site_fract_x'),
          fy:    cols.indexOf('_atom_site_fract_y'),
          fz:    cols.indexOf('_atom_site_fract_z'),
          cx:    cols.indexOf('_atom_site_cartn_x'),
          cy:    cols.indexOf('_atom_site_cartn_y'),
          cz:    cols.indexOf('_atom_site_cartn_z'),
        }

        for (const row of rows) {
          const rawLabel = ci.type >= 0 ? row[ci.type] : (ci.label >= 0 ? row[ci.label] : '')
          const label    = ci.label >= 0 ? row[ci.label] : rawLabel
          const sym = labelToSymbol(rawLabel || label)

          const hasFrac = ci.fx >= 0 && ci.fy >= 0 && ci.fz >= 0
          const hasCart = ci.cx >= 0 && ci.cy >= 0 && ci.cz >= 0

          if (hasFrac) {
            const fx = toFloat(row[ci.fx])
            const fy = toFloat(row[ci.fy])
            const fz = toFloat(row[ci.fz])
            if (!isNaN(fx) && !isNaN(fy) && !isNaN(fz)) {
              atomSiteData.push({ symbol: sym, position: [fx, fy, fz], fractional: true })
            }
          } else if (hasCart) {
            const cx = toFloat(row[ci.cx])
            const cy = toFloat(row[ci.cy])
            const cz = toFloat(row[ci.cz])
            if (!isNaN(cx) && !isNaN(cy) && !isNaN(cz)) {
              atomSiteData.push({ symbol: sym, position: [cx, cy, cz], fractional: false })
            }
          }
        }
      }
    }
  }

  // Build lattice
  const hasCell = [cellA, cellB, cellC].every(v => v !== undefined && !isNaN(v))
  const lattice = hasCell
    ? latticeFromParams(cellA, cellB, cellC, cellAlpha, cellBeta, cellGamma)
    : null

  // Apply symmetry
  let atoms = atomSiteData
  if (symOpStrings.length > 0) {
    const ops = parseSymOps(symOpStrings)
    if (ops.length > 0 && atoms.every(a => a.fractional)) {
      atoms = applySymmetry(atoms, ops)
    }
  }

  return { title, lattice, atoms, spaceGroup }
}
