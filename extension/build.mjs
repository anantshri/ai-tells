// Bundles the ES-module sources in src/ into dist/ for the extension.
//
// MV3 content scripts can't use static ES-module `import`, so the content script
// is bundled as an IIFE. The service worker and popup keep ESM. Static assets
// (manifest, html, css, icons) are copied across unchanged.

import { build } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dist = resolve(root, 'dist');
const src = resolve(root, 'src');

async function main() {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });

  await build({
    entryPoints: {
      content: resolve(src, 'content.js'),
      background: resolve(src, 'background.js'),
      popup: resolve(src, 'popup.js'),
    },
    bundle: true,
    format: 'iife',
    target: 'chrome105',
    outdir: dist,
    logLevel: 'info',
  });

  // Static assets copied verbatim.
  const assets = [
    ['manifest.json', 'manifest.json'],
    ['src/popup.html', 'popup.html'],
    ['src/popup.css', 'popup.css'],
    ['icons', 'icons'],
  ];
  for (const [from, to] of assets) {
    await cp(resolve(root, from), resolve(dist, to), { recursive: true }).catch((err) => {
      console.warn(`skip asset ${from}: ${err.message}`);
    });
  }
  console.log('Built extension into dist/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
