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

// Run the collapse + worker-sync after EVERY successful build — in watch mode too.
// Previously these only ran on the one-shot build, so a watch rebuild (or any process that
// touched dist/p.js) could leave apps/worker/src/p.txt in an UN-collapsed state. That stale
// p.txt then got committed and broke the CI "p.txt matches a fresh build" gate. Doing it in
// onEnd guarantees p.txt is always the canonical, collapsed bundle. esbuild watches src/, not
// dist/, so rewriting dist/p.js here never triggers a rebuild loop.
const collapseAndSyncPlugin = {
  name: 'collapse-and-sync',
  setup(build) {
    build.onEnd((result) => {
      if (result.errors.length) return;
      collapseCssWhitespace();
      syncWorkerSnippet();
    });
  },
};

const sharedOpts = {
  bundle: true,
  minify: true,
  format: /** @type {'iife'} */ ('iife'),
  platform: /** @type {'browser'} */ ('browser'),
  target: ['es2020', 'chrome80', 'firefox75', 'safari13'],
  define: { 'process.env.NODE_ENV': '"production"' },
  drop: /** @type {['console']} */ (['console']),
  legalComments: /** @type {'none'} */ ('none'),
};

const ctx = await esbuild.context({
  ...sharedOpts,
  entryPoints: ['src/main.ts'],
  outfile: 'dist/p.js',
  plugins: [collapseAndSyncPlugin],
});

// Spin-to-win lazy chunk — built separately so the main p.js stays under 10 KB.
// The main snippet fetches this dynamically only when a spin_wheel campaign is served.
const spinCtx = await esbuild.context({
  ...sharedOpts,
  entryPoints: ['src/spin.ts'],
  outfile: 'dist/spin.js',
});

// Advanced-targeting lazy chunk — built separately; the core fetches it only when a campaign
// uses url_regex / returning_visitor / session_page_views / utm rules. Budget: ≤2 KB gzip.
const targetingCtx = await esbuild.context({
  ...sharedOpts,
  entryPoints: ['src/targeting.ts'],
  outfile: 'dist/targeting.js',
});

if (watch) {
  await ctx.watch();
  await spinCtx.watch();
  await targetingCtx.watch();
  console.log('Watching for changes...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  await spinCtx.rebuild();
  await spinCtx.dispose();
  await targetingCtx.rebuild();
  await targetingCtx.dispose();
  console.log('Snippet built → dist/p.js + dist/spin.js + dist/targeting.js');
}
