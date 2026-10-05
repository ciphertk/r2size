import { describe, expect, it } from 'vitest';
import { headersFile, PAGE_CSP_HEADER, PAGE_CSP_META, WORKER_CSP } from '../security-policy';

const directives = (csp: string) =>
  new Map(
    csp.split(';').map((part) => {
      const [name = '', ...values] = part.trim().split(/\s+/);
      return [name, values.join(' ')];
    }),
  );

describe('security policy', () => {
  it('blocks every network request from the page (connect-src none)', () => {
    expect(directives(PAGE_CSP_HEADER).get('connect-src')).toBe("'none'");
    expect(directives(PAGE_CSP_HEADER).get('default-src')).toBe("'none'");
  });

  it('never reports anywhere: a report would itself be a request', () => {
    expect(PAGE_CSP_HEADER).not.toMatch(/report-(uri|to)/);
  });

  it('enforces Trusted Types with the single "default" policy (M4-D7)', () => {
    const page = directives(PAGE_CSP_HEADER);
    expect(page.get('require-trusted-types-for')).toBe("'script'");
    expect(page.get('trusted-types')).toBe('default');
  });

  it('allows only same-origin scripts and styles, with no inline or eval escape hatch', () => {
    const page = directives(PAGE_CSP_HEADER);
    expect(page.get('script-src')).toBe("'self'");
    expect(page.get('style-src')).toBe("'self'");
    expect(PAGE_CSP_HEADER).not.toMatch(/unsafe-(inline|eval)/);
  });

  it('puts the same policy in the meta tag, minus header-only directives', () => {
    const meta = directives(PAGE_CSP_META);
    const header = directives(PAGE_CSP_HEADER);
    expect(meta.has('frame-ancestors')).toBe(false);
    for (const [name, value] of meta) expect(header.get(name)).toBe(value);
    expect([...header.keys()].filter((name) => !meta.has(name))).toEqual([
      'frame-ancestors',
      'upgrade-insecure-requests',
    ]);
  });

  it("gives the service worker its own policy so it can precache the app's files", () => {
    const file = headersFile();
    const worker = file.slice(file.indexOf('/sw.js'), file.indexOf('/assets/*'));
    expect(worker).toContain('! Content-Security-Policy');
    expect(worker).toContain(`Content-Security-Policy: ${WORKER_CSP}`);
    expect(directives(WORKER_CSP).get('connect-src')).toBe("'self'");
  });

  it('writes the page policy and hardening headers for every path', () => {
    const file = headersFile();
    const all = file.slice(file.indexOf('/*'), file.indexOf('/sw.js'));
    expect(all).toContain(`Content-Security-Policy: ${PAGE_CSP_HEADER}`);
    expect(all).toContain('Strict-Transport-Security: max-age=31536000');
    expect(all).toContain('X-Content-Type-Options: nosniff');
    expect(all).toContain('Referrer-Policy: no-referrer');
  });

  it('caches hashed assets forever and never caches the shell, worker or manifest', () => {
    const file = headersFile();
    expect(file).toMatch(/\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
    for (const path of ['/', '/index.html', '/sw.js', '/manifest.webmanifest']) {
      expect(file).toMatch(
        new RegExp(`\\n${path.replace(/[.*/]/g, '\\$&')}\\n(  .*\\n)*  Cache-Control: no-cache`),
      );
    }
  });
});
