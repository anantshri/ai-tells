// Bundles the ES-module sources in src/ into per-browser packages under dist/.
//
// The detection/UI code is identical across browsers (callback-style `chrome.*`
// works in Chrome, Edge, Opera, Firefox, and Safari). The ONLY thing that
// differs is the manifest's `background` key and Firefox's required add-on id:
//
//   chrome  (Chrome/Edge/Opera/Brave) -> background.service_worker
//   firefox                            -> background.scripts + gecko id/min-version
//   safari                             -> background.scripts (event page; Safari's
//                                         service worker has known bugs)
//
// MV3 content scripts can't use static ES-module `import`, so everything is
// bundled to an IIFE. Usage:
//   node build.mjs            # build all targets
//   node build.mjs firefox    # build one target

import { build } from 'esbuild';
import { cp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');

// Firefox add-on id — REQUIRED for storage.sync to work in Firefox, and for
// signing/distribution. Safari ignores the gecko block; Chromium ignores the
// whole browser_specific_settings key.
const GECKO_ID = 'ai-tells@users.noreply.github.com';
// Highlight API landed in Firefox 140, so nothing below that can run the tool.
const FIREFOX_MIN_VERSION = '140.0';

// Per-target manifest transforms, applied to the base manifest.json.
const TARGETS = {
  // Chrome, Edge, Opera, Brave and any other Chromium browser.
  chrome: (m) => m,
  // Firefox: event-page background + required add-on id.
  firefox: (m) => ({
    ...m,
    background: { scripts: ['background.js'] },
    browser_specific_settings: {
      gecko: { id: GECKO_ID, strict_min_version: FIREFOX_MIN_VERSION },
    },
  }),
  // Safari: event-page background (its service worker is buggy). Package with
  // `xcrun safari-web-extension-converter dist/safari` on macOS + Xcode.
  safari: (m) => ({ ...m, background: { scripts: ['background.js'] } }),
};

const ASSETS = [
  ['src/popup.html', 'popup.html'],
  ['src/popup.css', 'popup.css'],
  ['icons', 'icons'],
];

async function buildTarget(name, baseManifest) {
  const outdir = resolve(dist, name);
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  await build({
    entryPoints: {
      content: resolve(src, 'content.js'),
      background: resolve(src, 'background.js'),
      popup: resolve(src, 'popup.js'),
    },
    bundle: true,
    format: 'iife',
    target: ['chrome105', 'firefox140', 'safari17'],
    outdir,
    logLevel: 'warning',
  });

  for (const [from, to] of ASSETS) {
    await cp(resolve(root, from), resolve(outdir, to), { recursive: true }).catch((err) => {
      console.warn(`skip asset ${from}: ${err.message}`);
    });
  }

  const manifest = TARGETS[name](structuredClone(baseManifest));
  await writeFile(resolve(outdir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`  dist/${name}/`);
}

async function main() {
  const requested = process.argv[2];
  const names = requested ? [requested] : Object.keys(TARGETS);
  for (const n of names) {
    if (!TARGETS[n]) {
      console.error(`Unknown target "${n}". Valid: ${Object.keys(TARGETS).join(', ')}`);
      process.exit(2);
    }
  }
  const baseManifest = JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'));
  await mkdir(dist, { recursive: true });
  console.log('Building extension:');
  for (const n of names) await buildTarget(n, baseManifest);
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
