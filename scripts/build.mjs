// Bundles the app into a single self-contained dist/index.html (no server needed).
import { build } from 'esbuild';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const res = await build({
  entryPoints: ['src/ui/main.js'],
  bundle: true, minify: true, format: 'iife', target: ['es2020'],
  write: false, outdir: 'dist', legalComments: 'none',
  banner: { js: '/*! P2P Control Testing Engine (c) 2026 Srijan Upadhyay. All rights reserved; use requires permission (see LICENSE). Includes preact (MIT), htm (Apache-2.0), fflate (MIT): see THIRD_PARTY_NOTICES.md. */' },
  loader: { '.css': 'css' }
});
const js = res.outputFiles.find((f) => f.path.endsWith('.js')).text;
const css = res.outputFiles.find((f) => f.path.endsWith('.css'))?.text || '';
const html = readFileSync('index.html', 'utf8')
  .replace('<!--CSS-->', `<style>${css}</style>`)
  .replace('<!--JS-->', () => `<script>${js.replace(/<\/script/gi, '<\\/script')}</script>`);
mkdirSync('dist', { recursive: true });
writeFileSync('dist/index.html', html);
console.log(`dist/index.html  ${(html.length / 1024).toFixed(0)} KB`);

// Variant for hosting inside a claude.ai Artifact (the host supplies the document skeleton).
const head = readFileSync('index.html', 'utf8').match(/<title>[\s\S]*?(?=<!--CSS-->)/)[0];
const artifact = `${head}<style>${css}</style>\n<div id="app"></div>\n<script>${js.replace(/<\/script/gi, '<\\/script')}</script>\n`;
writeFileSync('dist/artifact.html', artifact);
console.log(`dist/artifact.html  ${(artifact.length / 1024).toFixed(0)} KB`);
