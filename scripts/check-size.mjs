// Fails the build when the shipped bundle exceeds the budgets in architecture §1.
// JS and CSS budgets apply to what the first visit loads: the files dist/index.html references
// (scripts, modulepreloads, stylesheets). Chunks loaded on demand (the Guide, the service-worker
// helper) are reported but not counted. Fonts count in full.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGETS_KB = { js: 90, css: 15, font: 30 };
const DIST = 'dist/assets';

const html = readFileSync('dist/index.html', 'utf8');
const initial = new Set([...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((m) => m[1]));

const kindOf = (name) =>
  name.endsWith('.js')
    ? 'js'
    : name.endsWith('.css')
      ? 'css'
      : name.endsWith('.woff2')
        ? 'font'
        : null;

const totals = { js: 0, css: 0, font: 0 };
const onDemand = [];
for (const name of readdirSync(DIST)) {
  const path = join(DIST, name);
  if (!statSync(path).isFile()) continue;
  const kind = kindOf(name);
  if (kind === null) continue;
  // woff2 is already compressed; count it as shipped.
  const bytes = kind === 'font' ? readFileSync(path).length : gzipSync(readFileSync(path)).length;
  if (kind !== 'font' && !initial.has(name)) {
    onDemand.push(`${name} ${(bytes / 1024).toFixed(1)} KB`);
    continue;
  }
  totals[kind] += bytes;
}

let failed = false;
for (const [kind, limit] of Object.entries(BUDGETS_KB)) {
  const kb = totals[kind] / 1024;
  const ok = kb <= limit;
  failed ||= !ok;
  console.log(
    `${ok ? 'ok  ' : 'FAIL'} ${kind.padEnd(4)} ${kb.toFixed(1).padStart(6)} KB / ${limit} KB${kind === 'font' ? '' : ' (initial)'}`,
  );
}
if (onDemand.length > 0) console.log(`     on demand: ${onDemand.join(', ')}`);
process.exit(failed ? 1 : 0);
