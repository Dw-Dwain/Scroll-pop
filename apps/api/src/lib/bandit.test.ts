import { describe, it, expect } from 'vitest';
import { sampleBeta, thompsonProbabilities, thompsonWeights, type BanditArm, type Rng } from './bandit.js';

// Deterministic RNG (mulberry32) so these statistical assertions are stable in CI.
function seeded(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('sampleBeta', () => {
  it('matches the analytic mean a/(a+b)', () => {
    const rng = seeded(1);
    for (const [a, b] of [[2, 2], [8, 2], [1, 9], [50, 50]] as const) {
      const samples = Array.from({ length: 4000 }, () => sampleBeta(a, b, rng));
      expect(mean(samples)).toBeCloseTo(a / (a + b), 1);
    }
  });

  it('stays within [0,1]', () => {
    const rng = seeded(7);
    for (let i = 0; i < 1000; i++) {
      const x = sampleBeta(3, 5, rng);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});

describe('thompsonProbabilities', () => {
  it('handles trivial arm counts', () => {
    expect(thompsonProbabilities([], 100, seeded(1))).toEqual([]);
    expect(thompsonProbabilities([{ successes: 3, trials: 10 }], 100, seeded(1))).toEqual([1]);
  });

  it('gives a clear leader most of the probability mass', () => {
    const arms: BanditArm[] = [
      { successes: 120, trials: 1000 }, // 12% CTR
      { successes: 60, trials: 1000 }, //  6% CTR
    ];
    const p = thompsonProbabilities(arms, 4000, seeded(42));
    expect(p[0]! + p[1]!).toBeCloseTo(1, 5);
    expect(p[0]!).toBeGreaterThan(0.98);
  });

  it('cold-start (no data) is near-uniform across arms', () => {
    const arms: BanditArm[] = [
      { successes: 0, trials: 0 },
      { successes: 0, trials: 0 },
      { successes: 0, trials: 0 },
    ];
    const p = thompsonProbabilities(arms, 6000, seeded(99));
    for (const pi of p) expect(pi).toBeGreaterThan(0.25); // each near 1/3, well above 0
    expect(mean(p)).toBeCloseTo(1 / 3, 5);
  });

  it('keeps real uncertainty when samples are thin (does not over-commit)', () => {
    // 2/10 vs 1/10 — a lead, but wide posteriors, so the loser keeps meaningful mass.
    const p = thompsonProbabilities([{ successes: 2, trials: 10 }, { successes: 1, trials: 10 }], 5000, seeded(3));
    expect(p[0]!).toBeGreaterThan(p[1]!);
    expect(p[1]!).toBeGreaterThan(0.15); // not starved on thin data
  });
});

describe('thompsonWeights', () => {
  it('always sums to total and respects the floor', () => {
    const arms: BanditArm[] = [
      { successes: 100, trials: 1000 },
      { successes: 10, trials: 1000 },
      { successes: 5, trials: 1000 },
    ];
    const w = thompsonWeights(arms, { draws: 3000, minWeight: 2, total: 100, rng: seeded(11) });
    expect(w).toHaveLength(3);
    expect(w.reduce((a, b) => a + b, 0)).toBe(100);
    for (const wi of w) expect(wi).toBeGreaterThanOrEqual(2);
    expect(w[0]!).toBeGreaterThan(w[1]!);
    expect(w[0]!).toBeGreaterThan(w[2]!);
  });

  it('weights the leader highest', () => {
    const w = thompsonWeights(
      [{ successes: 200, trials: 1000 }, { successes: 50, trials: 1000 }],
      { draws: 3000, rng: seeded(5) },
    );
    expect(w[0]! + w[1]!).toBe(100);
    expect(w[0]!).toBeGreaterThan(80);
  });

  it('cold-start splits roughly evenly', () => {
    const w = thompsonWeights(
      [{ successes: 0, trials: 0 }, { successes: 0, trials: 0 }],
      { draws: 4000, rng: seeded(8) },
    );
    expect(w[0]! + w[1]!).toBe(100);
    expect(Math.abs(w[0]! - w[1]!)).toBeLessThan(20);
  });

  it('handles trivial arm counts', () => {
    expect(thompsonWeights([], {})).toEqual([]);
    expect(thompsonWeights([{ successes: 5, trials: 9 }], { total: 100 })).toEqual([100]);
  });

  it('clamps a floor that is too large to be feasible', () => {
    // minWeight 80 with 2 arms can't sum to 100; it clamps to an equal share (50) → [50,50].
    const w = thompsonWeights(
      [{ successes: 9, trials: 10 }, { successes: 1, trials: 10 }],
      { draws: 1000, minWeight: 80, total: 100, rng: seeded(2) },
    );
    expect(w.reduce((a, b) => a + b, 0)).toBe(100);
    expect(w).toEqual([50, 50]);
  });
});
