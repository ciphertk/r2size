// Fails the build when the shipped bundle exceeds the budgets in architecture §1.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGETS_KB = { js: 90, css: 15, font: 30 };
const DIST = 'dist/assets';

const totals = { js: 0, css: 0, font: 0 };
for (const name of readdirSync(DIST)) {
  const path = join(DIST, name);
  if (!statSync(path).isFile()) continue;
  const kind = name.endsWith('.js')
    ? 'js'
    : name.endsWith('.css')
      ? 'css'
      : name.endsWith('.woff2')
        ? 'font'
        : null;
  if (kind === null) continue;
  // woff2 is already compressed; count it as shipped.
  const bytes = kind === 'font' ? readFileSync(path).length : gzipSync(readFileSync(path)).length;
  totals[kind] += bytes;
}

let failed = false;
for (const [kind, limit] of Object.entries(BUDGETS_KB)) {
  const kb = totals[kind] / 1024;
  const ok = kb <= limit;
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${kind.padEnd(4)} ${kb.toFixed(1).padStart(6)} KB / ${limit} KB`,
  );
}
process.exit(failed ? 1 : 0);
