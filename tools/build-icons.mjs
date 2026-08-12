// Regenerates icons.js: a vendored subset of Lucide holding only the icons this
// site actually draws, instead of pulling the full 417 KB CDN bundle (2021 icons)
// into the critical path for the ~19 we use.
//
//   node tools/build-icons.mjs
//
// Add a new icon by putting its kebab-case name in USED below and re-running.

import { writeFileSync } from 'node:fs';

const BUNDLE = 'https://unpkg.com/lucide@1.31.0/dist/umd/lucide.min.js';
const OUT = new URL('../icons.js', import.meta.url);

// Static markup uses the kebab name in data-lucide; the weather module resolves
// the cloud/sun set at runtime, so those cannot be discovered by scanning the HTML
const USED = [
  'arrow-down', 'arrow-right', 'calendar-days', 'clock', 'download', 'heart',
  'mail', 'map-pin', 'x',
  'cloud', 'cloud-drizzle', 'cloud-fog', 'cloud-lightning', 'cloud-moon',
  'cloud-rain', 'cloud-snow', 'cloud-sun', 'moon', 'sun',
];

const toPascalCase = (name) =>
  name.replace(/(^|-)([a-z])/g, (_, __, char) => char.toUpperCase());

const source = await fetch(BUNDLE).then((res) => {
  if (!res.ok) throw new Error(`${BUNDLE} responded ${res.status}`);
  return res.text();
});

const module = { exports: {} };
const scope = {};
new Function('module', 'exports', 'window', source)(module, module.exports, scope);
const { icons } = scope.lucide ?? module.exports;

const entries = USED.map((name) => {
  const key = toPascalCase(name);
  const node = icons[key];
  if (!node) throw new Error(`"${name}" is not in the Lucide bundle`);
  return `  ${key}: ${JSON.stringify(node)},`;
});

writeFileSync(
  OUT,
  `// GENERATED FILE, DO NOT EDIT. Run: node tools/build-icons.mjs\n` +
    `// Lucide icon subset (${USED.length} of 2021), vendored from ${BUNDLE}\n` +
    `// so the page ships ~4 KB of icon data instead of a 417 KB blocking script.\n` +
    `window.lucideIcons = {\n${entries.join('\n')}\n};\n`
);

console.log(`icons.js written with ${USED.length} icons`);
