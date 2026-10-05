// After a deploy: checks the live site serves this build (dist/) with its security headers.
// Retries for up to a minute while Cloudflare propagates.
//   node scripts/verify-production.mjs [https://r2size.pages.dev]
import { readFileSync } from 'node:fs';

const BASE = (process.argv[2] ?? 'https://r2size.pages.dev').replace(/\/$/, '');
const expectedScript = readFileSync('dist/index.html', 'utf8').match(
  /assets\/index-[\w-]+\.js/,
)?.[0];
if (!expectedScript) throw new Error('dist/index.html has no main script: build first');

const header = (res, name) => res.headers.get(name) ?? '';

const check = async () => {
  const page = await fetch(`${BASE}/`, { cache: 'no-store' });
  const html = await page.text();
  const problems = [];
  if (!html.includes(expectedScript))
    problems.push(`live page is not this build (want ${expectedScript})`);
  if (!header(page, 'content-security-policy').includes("connect-src 'none'"))
    problems.push('page policy missing connect-src none');
  if (!header(page, 'strict-transport-security')) problems.push('no HSTS header');
  if (header(page, 'x-content-type-options') !== 'nosniff') problems.push('no nosniff header');

  const worker = await fetch(`${BASE}/sw.js`, { cache: 'no-store' });
  const workerPolicy = header(worker, 'content-security-policy');
  if (!workerPolicy.includes("connect-src 'self'") || workerPolicy.includes("connect-src 'none'"))
    problems.push(`/sw.js policy is wrong: ${workerPolicy}`);
  return problems;
};

for (let attempt = 1; ; attempt += 1) {
  const problems = await check().catch((error) => [String(error)]);
  if (problems.length === 0) {
    console.log(`ok   ${BASE} serves ${expectedScript} with the expected headers`);
    break;
  }
  if (attempt >= 12) {
    console.error(`FAIL ${BASE}\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  await new Promise((resolve) => setTimeout(resolve, 5000));
}
