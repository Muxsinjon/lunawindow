import { describe, expect, it } from 'vitest'
import { upsampleEphemeris } from './ephemeris'

describe('ephemeris upsampling', () => {
  it('keeps the original samples and interpolates between them', () => {
    // Earth moves linearly; Sun rotates 2° about z between the two samples
    const a = (2 * Math.PI) / 180
    const rows = new Float32Array([384000, 0, 0, 1, 0, 0, 384400, 400, 0, Math.cos(a), Math.sin(a), 0])
    const out = upsampleEphemeris(rows, 4)
    expect(out.length).toBe(5 * 6)
    expect(Array.from(out.subarray(0, 6))).toEqual(Array.from(rows.subarray(0, 6)))
    expect(Array.from(out.subarray(24, 30))).toEqual(Array.from(rows.subarray(6, 12)))
    // midpoint: Earth halfway, Sun unit vector at 1° (nlerp of a 2° arc is exact at the midpoint)
    expect(out[12]).toBeCloseTo(384200, 1)
    expect(out[13]).toBeCloseTo(200, 3)
    const ang = (Math.atan2(out[16], out[15]) * 180) / Math.PI
    expect(ang).toBeCloseTo(1, 4)
    expect(Math.hypot(out[15], out[16], out[17])).toBeCloseTo(1, 6)
    // quarter point: nlerp vs true angle error is tiny
    const q = (Math.atan2(out[10], out[9]) * 180) / Math.PI
    expect(Math.abs(q - 0.5)).toBeLessThan(0.0005)
  })
  it('validates input', () => {
    expect(() => upsampleEphemeris(new Float32Array(7), 4)).toThrow()
    expect(() => upsampleEphemeris(new Float32Array(6), 0)).toThrow()
    expect(upsampleEphemeris(new Float32Array(6), 1).length).toBe(6)
  })
})
