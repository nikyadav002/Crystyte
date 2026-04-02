import { parsePOSCAR } from './poscar.js'
import { parseCIF    } from './cif.js'
import { parseXYZ    } from './xyz.js'

export function detectAndParse(text, filename) {
  const ext = (filename ?? '').split('.').pop().toLowerCase()

  if (ext === 'cif') return parseCIF(text)
  if (ext === 'xyz') return parseXYZ(text)

  // POSCAR / CONTCAR heuristics
  if (
    ext === 'poscar' ||
    ext === 'contcar' ||
    ext === 'vasp' ||
    /^(poscar|contcar)/i.test(filename ?? '') ||
    isPOSCAR(text)
  ) {
    return parsePOSCAR(text)
  }

  // CIF heuristics
  if (text.includes('_cell_length_a') || text.includes('loop_')) {
    return parseCIF(text)
  }

  // XYZ heuristic: first non-blank line is a pure integer
  const firstLine = text.trimStart().split('\n')[0].trim()
  if (/^\d+$/.test(firstLine)) return parseXYZ(text)

  // Last resort: try POSCAR
  return parsePOSCAR(text)
}

function isPOSCAR(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 8) return false
  // Lines 2-4 should be 3 numbers (lattice vectors)
  for (let i = 2; i <= 4; i++) {
    const parts = lines[i].split(/\s+/)
    if (parts.length < 3 || parts.some(p => isNaN(Number(p)))) return false
  }
  return true
}
