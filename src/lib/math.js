// ---- 3×3 matrix helpers ----
// Matrices stored as [[r0x,r0y,r0z],[r1x,r1y,r1z],[r2x,r2y,r2z]]
// Lattice L: rows are lattice vectors a, b, c

export function mat3Det(m) {
  return (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) -
    m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) +
    m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  )
}

export function mat3Inv(m) {
  const d = mat3Det(m)
  return [
    [
      (m[1][1] * m[2][2] - m[1][2] * m[2][1]) / d,
      (m[0][2] * m[2][1] - m[0][1] * m[2][2]) / d,
      (m[0][1] * m[1][2] - m[0][2] * m[1][1]) / d,
    ],
    [
      (m[1][2] * m[2][0] - m[1][0] * m[2][2]) / d,
      (m[0][0] * m[2][2] - m[0][2] * m[2][0]) / d,
      (m[0][2] * m[1][0] - m[0][0] * m[1][2]) / d,
    ],
    [
      (m[1][0] * m[2][1] - m[1][1] * m[2][0]) / d,
      (m[0][1] * m[2][0] - m[0][0] * m[2][1]) / d,
      (m[0][0] * m[1][1] - m[0][1] * m[1][0]) / d,
    ],
  ]
}

// Row-vector × matrix: v @ M
export function vecMat(v, M) {
  return [
    v[0] * M[0][0] + v[1] * M[1][0] + v[2] * M[2][0],
    v[0] * M[0][1] + v[1] * M[1][1] + v[2] * M[2][1],
    v[0] * M[0][2] + v[1] * M[1][2] + v[2] * M[2][2],
  ]
}

// Fractional → Cartesian:  r_cart = frac @ L
export function fracToCart(frac, L) {
  return vecMat(frac, L)
}

// Cartesian → Fractional:  frac = r_cart @ L⁻¹
export function cartToFrac(cart, Linv) {
  return vecMat(cart, Linv)
}

// a, b, c lengths and α, β, γ angles (degrees) from lattice matrix
export function getLatticeParams(L) {
  const a = Math.hypot(L[0][0], L[0][1], L[0][2])
  const b = Math.hypot(L[1][0], L[1][1], L[1][2])
  const c = Math.hypot(L[2][0], L[2][1], L[2][2])

  const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2]
  const clamp = (x) => Math.max(-1, Math.min(1, x))

  const alpha = Math.acos(clamp(dot(L[1], L[2]) / (b * c))) * (180 / Math.PI)
  const beta  = Math.acos(clamp(dot(L[0], L[2]) / (a * c))) * (180 / Math.PI)
  const gamma = Math.acos(clamp(dot(L[0], L[1]) / (a * b))) * (180 / Math.PI)

  return { a, b, c, alpha, beta, gamma }
}

// Build lattice matrix from a, b, c, α, β, γ (degrees)
// Convention: a along x; b in xy-plane; c general
export function latticeFromParams(a, b, c, alpha, beta, gamma) {
  const al = alpha * (Math.PI / 180)
  const be = beta  * (Math.PI / 180)
  const ga = gamma * (Math.PI / 180)

  const cosAl = Math.cos(al)
  const cosBe = Math.cos(be)
  const cosGa = Math.cos(ga)
  const sinGa = Math.sin(ga)

  const cx = cosBe
  const cy = (cosAl - cosBe * cosGa) / sinGa
  const cz = Math.sqrt(Math.max(0, 1 - cx * cx - cy * cy))

  return [
    [a,           0,           0     ],
    [b * cosGa,   b * sinGa,   0     ],
    [c * cx,      c * cy,      c * cz],
  ]
}

// Apply Minimum Image Convention to a fractional displacement vector
// Returns fractional displacement wrapped to [-0.5, 0.5)
export function micFrac(df) {
  return df.map(x => x - Math.round(x))
}

// Euclidean length of a 3-vector
export function vecLen(v) {
  return Math.hypot(v[0], v[1], v[2])
}

// Centroid of an array of 3-vectors
export function centroid(pts) {
  const n = pts.length
  const s = [0, 0, 0]
  for (const p of pts) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2] }
  return [s[0] / n, s[1] / n, s[2] / n]
}
