import { describe, expect, it } from 'vitest';
import { allowScriptUrl } from '../trusted-types';

const ORIGIN = 'https://r2size.pages.dev';

describe('allowScriptUrl (the only script URL Trusted Types lets through)', () => {
  it("allows this site's service worker", () => {
    expect(allowScriptUrl('/sw.js', ORIGIN)).toBe('/sw.js');
    expect(allowScriptUrl(`${ORIGIN}/sw.js`, ORIGIN)).toBe(`${ORIGIN}/sw.js`);
  });

  it.each([
    'https://evil.example/sw.js',
    '/assets/index.js',
    '/sw.js?x=1',
    '//evil.example/sw.js',
    'data:text/javascript,alert(1)',
    'javascript:alert(1)',
  ])('refuses %s', (url) => {
    expect(() => allowScriptUrl(url, ORIGIN)).toThrow(TypeError);
  });
});
