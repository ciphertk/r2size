import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { decodeSetup, EMPTY_SETUP, encodeSetup, type ShareableSetup } from '../share-url';

const MOCKUP: ShareableSetup = {
  ...EMPTY_SETUP,
  symbol: 'raymond',
  entry: '100',
  stopMode: 'percent',
  stopPct: '7',
  riskPct: '1',
  maxAllocationPct: '20',
  costPct: '0.25',
  targets: ['118.40', '', ''],
};

describe('encodeSetup', () => {
  it("writes only the active mode's values, readable", () => {
    expect(encodeSetup({ ...MOCKUP, stopPrice: '93', atr: '3', riskAmount: '5000' })).toBe(
      '#v=1&sym=RAYMOND&sm=pct&rm=pct&e=100&sp=7&r=1&al=20&c=0.25&t=118.40',
    );
    expect(
      encodeSetup({
        ...EMPTY_SETUP,
        entry: '1,000.50',
        stopMode: 'atr',
        atr: '7.3',
        atrMultiple: '1.5',
        riskMode: 'amount',
        riskAmount: '5,000',
        tick: '0.05',
        targets: ['', '1100', ''],
      }),
    ).toBe('#v=1&sm=atr&rm=amt&e=1000.50&atr=7.3&am=1.5&tk=0.05&ra=5000&t=,1100');
  });

  it('is empty when there is nothing to share', () => {
    expect(encodeSetup(EMPTY_SETUP)).toBe('');
    expect(encodeSetup({ ...EMPTY_SETUP, symbol: '  ' })).toBe('');
  });
});

describe('decodeSetup', () => {
  it('reads back what was encoded', () => {
    expect(decodeSetup(encodeSetup(MOCKUP))).toEqual({
      kind: 'setup',
      setup: { ...MOCKUP, symbol: 'RAYMOND' },
      ignored: [],
    });
  });

  it.each<[string, unknown]>([
    ['', { kind: 'none' }],
    ['#', { kind: 'none' }],
    ['#e=100', { kind: 'none' }],
    ['#v=2&e=100', { kind: 'newer' }],
    [`#v=1&sym=${'A'.repeat(600)}`, { kind: 'invalid' }],
  ])('treats %j as %o', (hash, expected) => {
    expect(decodeSetup(hash)).toEqual(expected);
  });

  it('drops invalid values one by one, keeping the rest', () => {
    const result = decodeSetup(
      '#v=1&sym=<script>&e=100&sp=abc&sm=weird&rm=amt&ra=5000&t=110,x,120,130&eq=2000000&cash=1',
    );
    expect(result).toEqual({
      kind: 'setup',
      setup: {
        ...EMPTY_SETUP,
        entry: '100',
        riskMode: 'amount',
        riskAmount: '5000',
        targets: ['110', '', '120'],
      },
      ignored: ['stop method', 'stopPct', 'symbol', 'targets', 'target 2'],
    });
  });

  it('never throws on arbitrary input', () => {
    fc.assert(fc.property(fc.string({ maxLength: 700 }), (hash) => void decodeSetup(hash)));
    fc.assert(fc.property(fc.string(), (junk) => void decodeSetup(`#v=1&${junk}`)));
  });
});

describe('the profile is never shared (ADR-005)', () => {
  const decimalText = fc.oneof(fc.constant(''), fc.stringMatching(/^[0-9]{1,6}([.][0-9]{1,2})?$/));
  const setup: fc.Arbitrary<ShareableSetup> = fc.record({
    symbol: fc.stringMatching(/^[A-Z0-9]{0,8}$/),
    entry: decimalText,
    stopMode: fc.constantFrom('price', 'percent', 'atr'),
    stopPrice: decimalText,
    stopPct: decimalText,
    atr: decimalText,
    atrMultiple: decimalText,
    tick: decimalText,
    riskMode: fc.constantFrom('percent', 'amount'),
    riskPct: decimalText,
    riskAmount: decimalText,
    maxAllocationPct: decimalText,
    costPct: decimalText,
    targets: fc.tuple(decimalText, decimalText, decimalText),
  });

  it('round-trips every setup and never mentions equity or cash', () => {
    fc.assert(
      fc.property(setup, (s) => {
        const hash = encodeSetup(s);
        expect(hash).not.toMatch(/(^|[#&])(eq|equity|cash|availableCash)=/);
        if (hash === '') return;
        const decoded = decodeSetup(hash);
        expect(decoded.kind).toBe('setup');
        if (decoded.kind !== 'setup') return;
        expect(decoded.ignored).toEqual([]);
        expect(encodeSetup(decoded.setup)).toBe(hash);
      }),
    );
  });

  it('cannot carry profile fields even if they are passed in', () => {
    const withProfile = { ...MOCKUP, equity: '2000000', availableCash: '640000' } as ShareableSetup;
    expect(encodeSetup(withProfile)).toBe(encodeSetup(MOCKUP));
  });
});
