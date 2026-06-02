// build.mjs — esbuild script for packages/snippet
// Produces dist/p.js: minified IIFE, no external deps, targets modern browsers.
// Run: node build.mjs [--watch]

import esbuild from 'esbuild';
import { createRequire } from 'module';
import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'fs';

const watch = process.argv.includes('--watch');

// The Cloudflare Worker serves the snippet by importing apps/worker/src/p.txt.
// Keep it in sync with the freshly built bundle so source changes actually reach
// production (this was a silent staleness source before).
const WORKER_SNIPPET = '../../apps/worker/src/p.txt';

// After minification, the only newlines left in the bundle live inside template
// literals — i.e. the embedded <style> CSS. esbuild does not minify template-literal
// contents, so collapse leading-whitespace newlines there to shave a few hundred
// bytes. Safe: it never touches code (which is already single-line post-minify).
function collapseCssWhitespace() {
  try {
    const src = readFileSync('dist/p.js', 'utf8');
    writeFileSync('dist/p.js', src.replace(/\n\s*/g, ''));
  } catch (err) {
    console.warn('CSS whitespace collapse skipped:', err.message);
  }
}

function syncWorkerSnippet() {
  try {
    copyFileSync('dist/p.js', WORKER_SNIPPET);
    console.log('Synced → apps/worker/src/p.txt');
  } catch (err) {
    console.warn('Could not sync worker snippet:', err.message);
  }
}

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  platform: 'browser',
  target: ['es2020', 'chrome80', 'firefox75', 'safari13'],
  outfile: 'dist/p.js',
  // No external deps — snippet must be fully self-contained
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  drop: ['console'],
  legalComments: 'none',
});

if (watch) {
  await ctx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  collapseCssWhitespace();
  console.log('Snippet built → dist/p.js');
  syncWorkerSnippet();
}
