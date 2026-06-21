/**
 * Thompson sampling (Beta-Bernoulli) for A/B variant weighting.
 *
 * Each variant's success probability (CTR or conversion rate) is modeled as a Beta posterior:
 *   Beta(successes + 1, failures + 1)
 * We draw one sample per variant and count how often each is the largest — that fraction is the
 * variant's probability of being the best arm. Weights are set ∝ P(best), so the allocator
 * self-balances explore vs. exploit with zero tuning knobs:
 *   • thin data  → wide posteriors → near-equal samples → near-equal weights (natural cold-start);
 *   • clear leader → narrow posterior high up → wins most draws → most of the traffic;
 *   • a laggard that recovers still has posterior mass → keeps a small share → can climb back.
 *
 * Pure + deterministic given `rng` (injectable for tests). No external dependencies — runs in the
 * API (Node), where Math.random is fine (this is NOT snippet/Workflow code).
 */

export interface BanditArm {
  /** Unique successful visitors (unique clickers for CTR, unique converters for conversion). */
  successes: number;
  /** Unique visitors who saw this variant (reach). `successes` is treated as bounded by this. */
  trials: number;
}

export type Rng = () => number;

/** Standard normal via Box–Muller. */
function sampleNormal(rng: Rng): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng(); // (0,1] — avoid log(0)
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Gamma(shape, 1) via Marsaglia–Tsang. Our shapes are always ≥ 1 (success/failure counts + 1),
 * but the shape < 1 boost trick is included for completeness/safety.
 */
function sampleGamma(shape: number, rng: Rng): number {
  if (shape < 1) {
    const u = rng();
    return sampleGamma(shape + 1, rng) * Math.pow(u === 0 ? Number.MIN_VALUE : u, 1 / shape);
  }
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  // Rejection loop; expected iterations < 1.5, so it always terminates quickly.
  for (;;) {
    const x = sampleNormal(rng);
    const v0 = 1 + c * x;
    if (v0 <= 0) continue;
    const v = v0 * v0 * v0;
    const u = rng();
    if (u < 1 - 0.0331 * x * x * x * x) return d * v;
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

/** Sample from Beta(a, b) with a, b > 0. */
export function sampleBeta(a: number, b: number, rng: Rng = Math.random): number {
  const x = sampleGamma(a, rng);
  const y = sampleGamma(b, rng);
  const s = x + y;
  return s === 0 ? 0.5 : x / s;
}

/**
 * Probability that each arm is the best, under independent Beta(successes+1, failures+1)
 * posteriors, estimated by Monte-Carlo with `draws` samples. Returns one probability per arm,
 * summing to 1. [] for no arms, [1] for a single arm.
 */
export function thompsonProbabilities(arms: BanditArm[], draws = 2000, rng: Rng = Math.random): number[] {
  const n = arms.length;
  if (n === 0) return [];
  if (n === 1) return [1];
  const alpha = arms.map((a) => Math.max(0, Math.min(a.successes, a.trials)) + 1);
  const beta = arms.map((a) => Math.max(0, a.trials - Math.max(0, a.successes)) + 1);
  const wins = new Array<number>(n).fill(0);
  for (let d = 0; d < draws; d++) {
    let bestIdx = 0;
    let bestVal = -1;
    for (let i = 0; i < n; i++) {
      const theta = sampleBeta(alpha[i]!, beta[i]!, rng);
      if (theta > bestVal) {
        bestVal = theta;
        bestIdx = i;
      }
    }
    wins[bestIdx] = wins[bestIdx]! + 1;
  }
  return wins.map((w) => w / draws);
}

/**
 * Integer weights summing to `total` (default 100), each ≥ `minWeight` (default 1), proportional to
 * each arm's probability of being best. The floor keeps a small exploration share so no arm is
 * starved to 0 — important here because the snippet/config builder DROPS weight-0 variants from
 * serving, which would strand visitors already sticky-assigned to that variant and halt its data.
 *
 * Apportionment uses the largest-remainder method, so the result sums to `total` exactly.
 */
export function thompsonWeights(
  arms: BanditArm[],
  opts: { draws?: number; minWeight?: number; total?: number; rng?: Rng } = {},
): number[] {
  const { draws = 2000, total = 100, rng = Math.random } = opts;
  const n = arms.length;
  if (n === 0) return [];
  if (n === 1) return [total];
  // A floor larger than an equal share can't sum to `total`; clamp it.
  const minWeight = Math.max(0, Math.min(opts.minWeight ?? 1, Math.floor(total / n)));
  const probs = thompsonProbabilities(arms, draws, rng);
  const remaining = total - minWeight * n;
  const quotas = probs.map((p) => p * remaining);
  const floors = quotas.map((q) => Math.floor(q));
  const leftover = remaining - floors.reduce((s, f) => s + f, 0);
  // Hand the leftover units to the arms with the largest fractional remainders.
  const order = quotas
    .map((q, i) => ({ i, frac: q - Math.floor(q) }))
    .sort((a, b) => b.frac - a.frac);
  const bonus = new Array<number>(n).fill(0);
  for (let k = 0; k < leftover; k++) bonus[order[k]!.i] = bonus[order[k]!.i]! + 1;
  return floors.map((f, i) => minWeight + f + bonus[i]!);
}
