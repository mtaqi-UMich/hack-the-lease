// npm run ext:build  → extension/dist (load unpacked)   ·   npm run ext:dev → rebuild on change
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const here = fileURLToPath(new URL('.', import.meta.url));
const dist = `${here}dist`;
const watch = process.argv.includes('--watch');
rmSync(dist, { recursive: true, force: true }); mkdirSync(dist, { recursive: true });
cpSync(`${here}static`, dist, { recursive: true });
const opts = {
  entryPoints: { background: `${here}src/background.ts`, panel: `${here}src/panel.ts`, pill: `${here}src/pill.ts` },
  outdir: dist, bundle: true, format: 'esm', target: 'chrome116', minify: !watch, sourcemap: watch ? 'inline' : false,
  alias: { '@': fileURLToPath(new URL('..', import.meta.url)) }, logLevel: 'info',
  define: { 'process.env.NODE_ENV': JSON.stringify(watch ? 'development' : 'production') },
};
if (watch) { const ctx = await context(opts); await ctx.watch(); console.log('watching extension/src …'); }
else { await build(opts); console.log(`built → ${dist}`); }
