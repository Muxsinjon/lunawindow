// Rebuild the hourly ephemeris from the shipped coarse file (every `factor`-th hour).
// Earth (km) is linearly interpolated; the Sun unit vector is interpolated and re-normalized (nlerp).
// Over 6 h the Sun moves about 3° in the Moon's frame, so nlerp error is far below 0.001°.

/** rows: Float32Array of n×6 [ex, ey, ez, sx, sy, sz]. Returns ((n−1)·factor + 1)×6. */
export function upsampleEphemeris(rows: Float32Array, factor: number): Float32Array {
  if (!Number.isInteger(factor) || factor < 1) throw new RangeError('factor must be a positive integer')
  const n = rows.length / 6
  if (!Number.isInteger(n) || n < 1) throw new RangeError('rows must be a multiple of 6')
  if (factor === 1) return rows
  const m = (n - 1) * factor + 1
  const out = new Float32Array(m * 6)
  for (let i = 0; i < n - 1; i++) {
    const a = i * 6
    const b = a + 6
    for (let k = 0; k < factor; k++) {
      const w = k / factor
      const o = (i * factor + k) * 6
      for (let c = 0; c < 3; c++) out[o + c] = rows[a + c] + (rows[b + c] - rows[a + c]) * w
      const sx = rows[a + 3] + (rows[b + 3] - rows[a + 3]) * w
      const sy = rows[a + 4] + (rows[b + 4] - rows[a + 4]) * w
      const sz = rows[a + 5] + (rows[b + 5] - rows[a + 5]) * w
      const s = Math.sqrt(sx * sx + sy * sy + sz * sz)
      out[o + 3] = sx / s
      out[o + 4] = sy / s
      out[o + 5] = sz / s
    }
  }
  out.set(rows.subarray((n - 1) * 6, n * 6), (m - 1) * 6)
  return out
}
