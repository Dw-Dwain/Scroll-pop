/**
 * ScrollPop snippet — security sanitizers.
 *
 * Every value that originates from tenant-controlled config (design JSON, affiliate
 * slots, targeting rules) and lands in the DOM MUST pass through one of these before
 * it reaches an HTML body, attribute, style block, or href. This is the single
 * choke-point that guarantees the snippet cannot be turned into a code-injection
 * vector on a customer's site, regardless of what is stored in the database.
 *
 * Pure functions only — no DOM, no side effects — so they are unit-testable in isolation.
 */

/** Escape the five HTML-significant characters for safe insertion as text or attribute values. */
export function escapeHtml(str: string | undefined | null): string {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/** Ensure href/src only use http(s) — blocks javascript:, data:, vbscript:, etc. */
export function safeHref(url: string | undefined | null): string {
  if (!url) return '#';
  try {
    const p = new URL(url);
    return (p.protocol === 'https:' || p.protocol === 'http:') ? url : '#';
  } catch { return '#'; }
}

/** Validate a hex color, else return the fallback. */
export function safeCssColor(val: unknown, fallback: string): string {
  return typeof val === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(val) ? val : fallback;
}

/** Validate a URL for use inside CSS url(...) — http(s) only, no CSS-breaking chars. */
export function safeCssUrl(val: unknown): string {
  if (typeof val !== 'string' || !val) return '';
  try {
    const p = new URL(val);
    if (p.protocol !== 'https:' && p.protocol !== 'http:') return '';
    if (/[()'"\\]/.test(val)) return '';
    return val;
  } catch { return ''; }
}

/** Clamp an integer CSS value to [min, max], returning fallback for non-integers. */
export function safeCssInt(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val);
  return Number.isInteger(n) && n >= min && n <= max ? n : fallback;
}

/** A finite number for CSS (px/%/z-index/opacity). Non-numbers can't carry injection. */
export function cssNum(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * font-family — strip everything except letters, digits, spaces, commas, quotes, hyphens.
 * Blocks " (attribute breakout) and ; } : ( (CSS declaration / url() breakout).
 */
export function cssFont(val: unknown): string {
  if (typeof val !== 'string') return 'inherit';
  const cleaned = val.replace(/[^a-zA-Z0-9 ,'"_-]/g, '').slice(0, 60);
  return cleaned || 'inherit';
}

/** text-align whitelist. */
export function cssAlign(val: unknown, fallback: string): string {
  return val === 'left' || val === 'right' || val === 'center' || val === 'justify' ? val : fallback;
}

/** font-weight whitelist (numeric 100–900 or named keywords). */
export function cssWeight(val: unknown, fallback: string): string {
  const s = String(val);
  return /^(100|200|300|400|500|600|700|800|900|normal|bold|bolder|lighter)$/.test(s) ? s : fallback;
}

/**
 * Length value (padding/margin/gap). Numbers become "Npx"; strings allowed only if they
 * contain no CSS-breaking chars — no " ; } : ( so neither the attribute nor the rule can escape.
 */
export function cssLen(val: unknown, fallback: string): string {
  if (typeof val === 'number' && Number.isFinite(val)) return `${val}px`;
  if (typeof val === 'string' && val.length <= 40 && /^[0-9.\sa-z%-]+$/i.test(val)) return val;
  return fallback;
}

/**
 * Reject operator-supplied url_regex patterns that can cause catastrophic backtracking
 * (ReDoS) when evaluated against a visitor's URL in the snippet. These patterns run in
 * every visitor's browser, so a malicious targeting rule could hang the host page.
 *
 * This is a conservative allow-by-default check: it rejects the known dangerous shapes
 * (quantified groups whose body is itself quantified or contains alternation, and huge
 * bounded repetitions) plus anything that doesn't compile. Legitimate URL-matching
 * patterns (`^https://example\.com/blog/.*`, `/products/\d+`) are unaffected.
 * See CTO-AUDIT Phase 4, Finding 6 / P1-17.
 */
export function isSafeRegex(pattern: string): boolean {
  if (typeof pattern !== 'string') return false;
  if (pattern.length > 200) return false;

  // 1. Nested quantifiers: a quantified group whose body also contains a quantifier,
  //    e.g. (a+)+, (a*)*, ([a-z]+){5} — the classic exponential-backtracking shape.
  if (/\([^()]*[+*?][^()]*\)\s*[+*{]/.test(pattern)) return false;

  // 2. Quantified group containing alternation, e.g. (a|b)+, (foo|foobar)* — overlapping
  //    alternatives backtrack catastrophically. Conservatively reject all such shapes.
  if (/\([^()]*\|[^()]*\)\s*[+*{]/.test(pattern)) return false;

  // 3. Absurdly large bounded repetitions {n,m} — cheap CPU/memory blowup even without nesting.
  for (const r of pattern.match(/\{\s*(\d+)\s*(?:,\s*(\d+)\s*)?\}/g) ?? []) {
    const m = /\{\s*(\d+)\s*(?:,\s*(\d+)\s*)?\}/.exec(r);
    const upper = m?.[2] ? parseInt(m[2], 10) : m?.[1] ? parseInt(m[1], 10) : 0;
    if (upper > 1000) return false;
  }

  // 4. Must actually compile — a malformed pattern should never reach a live RegExp.
  try {
    new RegExp(pattern);
  } catch {
    return false;
  }

  return true;
}
