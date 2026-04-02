// VASP POSCAR / CONTCAR parser

export function parsePOSCAR(text) {
  const rawLines = text.split('\n')
  const lines = rawLines.map(l => l.trim())

  const title = lines[0] ?? ''
  const scale = parseFloat(lines[1] ?? '1')

  // Lattice vectors (lines 2-4, 0-indexed)
  const parseVec = (l) => l.split(/\s+/).slice(0, 3).map(Number)
  const a = parseVec(lines[2])
  const b = parseVec(lines[3])
  const c = parseVec(lines[4])

  // Apply universal scale (negative = volume; we handle positive only for simplicity)
  const s = scale < 0 ? 1 : scale
  const lattice = [a.map(x => x * s), b.map(x => x * s), c.map(x => x * s)]

  let lineIdx = 5

  // VASP5: element names; VASP4: jump straight to counts
  let elementNames = null
  if (/[A-Za-z]/.test(lines[lineIdx])) {
    elementNames = lines[lineIdx].split(/\s+/).filter(Boolean)
    lineIdx++
  }

  const counts = lines[lineIdx].split(/\s+/).filter(Boolean).map(Number)
  lineIdx++

  // Optional Selective Dynamics line
  if (lines[lineIdx] && lines[lineIdx][0].toLowerCase() === 's') lineIdx++

  // Coordinate mode
  const coordLine = (lines[lineIdx] ?? '').toLowerCase()
  const isDirect = coordLine.startsWith('d') || coordLine.startsWith('f')
  lineIdx++

  // Read atoms
  const totalAtoms = counts.reduce((s, n) => s + n, 0)
  const atoms = []
  let elemIdx = 0
  let inElem = 0

  for (let i = 0; i < totalAtoms; i++) {
    // Advance element index
    while (elemIdx < counts.length && inElem >= counts[elemIdx]) {
      elemIdx++
      inElem = 0
    }
    const parts = (lines[lineIdx + i] ?? '').split(/\s+/).filter(Boolean)
    const pos = parts.slice(0, 3).map(Number)
    const sym = elementNames ? (elementNames[elemIdx] ?? `X${elemIdx + 1}`) : `X${elemIdx + 1}`
    atoms.push({ symbol: sym, position: pos, fractional: isDirect })
    inElem++
  }

  return { title, lattice, atoms, spaceGroup: null }
}
