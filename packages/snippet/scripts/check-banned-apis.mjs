// AST-based enforcement of CLAUDE.md rule #1 / #2 — the snippet (and customer-facing code) must
// NEVER use history.pushState / history.replaceState / popstate listeners / onbeforeunload
// navigation interception (Google spam-policy violation, enforced 2026-06-15).
//
// This REPLACES the old `grep -rE` CI check, which a bracket-access (`history['pushState']`) or an
// alias (`const h = window.history; h.pushState(...)`) trivially evaded, and which never covered
// onbeforeunload at all. We parse the snippet TypeScript with the TS compiler and inspect the AST:
//   • any property access / element access named pushState | replaceState | onpopstate | onbeforeunload
//     — catches dot access, bracket access, and aliased receivers (we match the member name, not
//     the object), so `h.pushState`, `history['pushState']`, `window.onbeforeunload = …` all trip.
//   • any string literal 'popstate' | 'beforeunload' — catches addEventListener(evtName, …) and
//     computed access by string; the snippet has no legitimate use of these event names.
//   • the identifier `back_button_capture`.
// The wp-plugin is PHP (can't be AST-parsed here) but only injects the snippet — we still token-scan
// its source as a secondary net so a future inline <script> can't smuggle a banned call past CI.
//
// Run via `pnpm --filter @scrollpop/snippet lint` (wired into the CI `lint` gate) and the dedicated
// `no-history-manipulation` CI job. Exits non-zero on any violation.

import ts from 'typescript';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const SNIPPET_SRC = join(REPO_ROOT, 'packages/snippet/src');
const WP_PLUGIN = join(REPO_ROOT, 'packages/wp-plugin');

const BANNED_MEMBERS = new Set(['pushState', 'replaceState', 'onpopstate', 'onbeforeunload']);
const BANNED_EVENT_STRINGS = new Set(['popstate', 'beforeunload']);
const BANNED_IDENTIFIERS = new Set(['onpopstate', 'onbeforeunload', 'back_button_capture']);
// Secondary token net for non-AST (PHP) sources.
const TOKEN_RE = /\b(pushState|replaceState|onpopstate|onbeforeunload|back_button_capture)\b|addEventListener\s*\(\s*['"`](popstate|beforeunload)['"`]/;

/** @type {{file:string,line:number,detail:string}[]} */
const violations = [];
const seen = new Set();
function record(file, line, detail) {
  const key = `${file}:${line}:${detail}`;
  if (seen.has(key)) return;
  seen.add(key);
  violations.push({ file: relative(REPO_ROOT, file), line, detail });
}

function walk(dir, exts) {
  /** @type {string[]} */
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full, exts));
    else if (exts.some((e) => entry.endsWith(e))) out.push(full);
  }
  return out;
}

function checkAst(file) {
  const src = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const lineOf = (node) => src.getLineAndCharacterOfPosition(node.getStart(src)).line + 1;
  const visit = (node) => {
    if (ts.isPropertyAccessExpression(node) && BANNED_MEMBERS.has(node.name.text)) {
      record(file, lineOf(node), `banned member access ".${node.name.text}"`);
    } else if (ts.isElementAccessExpression(node) && ts.isStringLiteralLike(node.argumentExpression)) {
      const t = node.argumentExpression.text;
      if (BANNED_MEMBERS.has(t) || BANNED_EVENT_STRINGS.has(t)) record(file, lineOf(node), `banned element access ["${t}"]`);
    } else if (ts.isStringLiteralLike(node) && BANNED_EVENT_STRINGS.has(node.text)) {
      record(file, lineOf(node), `banned event string "${node.text}"`);
    } else if (ts.isIdentifier(node) && BANNED_IDENTIFIERS.has(node.text)) {
      record(file, lineOf(node), `banned identifier "${node.text}"`);
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

function checkTokens(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((ln, i) => { if (TOKEN_RE.test(ln)) record(file, i + 1, `banned token in non-AST source: ${ln.trim().slice(0, 80)}`); });
}

for (const f of walk(SNIPPET_SRC, ['.ts'])) checkAst(f);          // the shipped JS runtime (AST)
for (const f of walk(WP_PLUGIN, ['.js', '.mjs'])) checkAst(f);    // any plugin JS (AST)
for (const f of walk(WP_PLUGIN, ['.php'])) checkTokens(f);        // plugin PHP / inline JS (token net)

if (violations.length) {
  console.error('❌ FAIL: banned navigation-manipulation APIs found (CLAUDE.md rule #1 / #2):\n');
  for (const v of violations) console.error(`  ${v.file}:${v.line} — ${v.detail}`);
  console.error('\nhistory.pushState/replaceState, popstate listeners, and onbeforeunload navigation');
  console.error('interception are banned in the snippet and customer-facing code. See CLAUDE.md rule #1.');
  process.exit(1);
}
console.log('✅ PASS: no banned navigation-manipulation APIs (AST scan of snippet + wp-plugin).');
