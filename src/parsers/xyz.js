// XYZ and Extended-XYZ parser
// Extended XYZ: comment line may contain Lattice="a1 a2 a3 b1 b2 b3 c1 c2 c3"

function parseLatticeString(comment) {
  const m = comment.match(/[Ll]attice\s*=\s*["']?([^"']+)["']?/)
  if (!m) return null
  const nums = m[1].trim().split(/\s+/).map(Number)
  if (nums.length !== 9 || nums.some(isNaN)) return null
  // Row-major: a1 a2 a3 b1 b2 b3 c1 c2 c3
  return [
    [nums[0], nums[1], nums[2]],
    [nums[3], nums[4], nums[5]],
    [nums[6], nums[7], nums[8]],
  ]
}

export function parseXYZ(text) {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
  if (lines.length < 2) throw new Error('Invalid XYZ file')

  const nAtoms = parseInt(lines[0])
  if (isNaN(nAtoms) || nAtoms <= 0) throw new Error('Invalid atom count in XYZ')

  const comment = lines[1] ?? ''
  const lattice = parseLatticeString(comment)
  const title   = lattice ? comment.replace(/[Ll]attice\s*=\s*["']?[^"']+["']?/, '').trim() : comment

  const atoms = []
  for (let i = 0; i < nAtoms && i + 2 < lines.length; i++) {
    const parts = lines[i + 2].split(/\s+/)
    if (parts.length < 4) continue
    const sym = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase()
    const x = parseFloat(parts[1])
    const y = parseFloat(parts[2])
    const z = parseFloat(parts[3])
    if (isNaN(x) || isNaN(y) || isNaN(z)) continue
    atoms.push({ symbol: sym, position: [x, y, z], fractional: false })
  }

  return { title, lattice, atoms, spaceGroup: null }
}
