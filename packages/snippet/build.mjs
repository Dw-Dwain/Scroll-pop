// build.mjs — esbuild script for packages/snippet
// Produces dist/p.js: minified IIFE, no external deps, targets modern browsers.
// Run: node build.mjs [--watch]

import esbuild from 'esbuild';
import { createRequire } from 'module';

const watch = process.argv.includes('--watch');

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
  console.log('Snippet built → dist/p.js');
}
