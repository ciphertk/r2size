import { beforeEach, describe, expect, it } from 'vitest';
import {
  arrivedInApp,
  canonicalizeLocation,
  canonicalPath,
  currentRoute,
  navigate,
  routeOf,
  subscribeToRoute,
} from '../route';

beforeEach(() => window.history.replaceState(null, '', '/'));

describe('canonicalPath (M4-D1)', () => {
  it.each([
    ['/', '/'],
    ['', '/'],
    ['/guide', '/guide'],
    ['/guide/', '/guide'],
    ['/Guide/terms', '/guide'],
    ['/prototypes/redesign/', '/'],
    ['/guidebook', '/'],
    ['/index.html', '/'],
  ])('%s → %s', (path, expected) => {
    expect(canonicalPath(path)).toBe(expected);
    expect(routeOf(path)).toBe(expected === '/guide' ? 'guide' : 'calculator');
  });
});

describe('canonicalizeLocation', () => {
  it('rewrites an unknown path to "/", keeping the setup hash', () => {
    window.history.replaceState(null, '', '/anything/at/all#v=1&e=100');
    canonicalizeLocation();
    expect(window.location.pathname).toBe('/');
    expect(window.location.hash).toBe('#v=1&e=100');
  });

  it('drops a query string (setups live in the hash, never the query)', () => {
    window.history.replaceState(null, '', '/?utm=x#v=1');
    canonicalizeLocation();
    expect(window.location.search).toBe('');
    expect(window.location.hash).toBe('#v=1');
  });

  it('keeps /guide and its term anchor', () => {
    window.history.replaceState(null, '', '/guide/#term-tick');
    canonicalizeLocation();
    expect(`${window.location.pathname}${window.location.hash}`).toBe('/guide#term-tick');
  });
});

describe('navigate', () => {
  it('pushes a marked history entry and notifies subscribers', () => {
    let calls = 0;
    const unsubscribe = subscribeToRoute(() => (calls += 1));
    expect(arrivedInApp()).toBe(false);
    navigate('/guide', '#term-stop');
    expect(currentRoute()).toBe('guide');
    expect(window.location.hash).toBe('#term-stop');
    expect(arrivedInApp()).toBe(true);
    expect(calls).toBe(1);
    unsubscribe();
  });
});

describe('setup hash writer on other routes', () => {
  it('never writes the setup onto /guide', async () => {
    const { createHashWriter } = await import('../url-hash');
    const writer = createHashWriter(0);
    window.history.replaceState(null, '', '/guide');
    writer.write('#v=1&e=100');
    writer.flush();
    expect(window.location.hash).toBe('');
  });
});
