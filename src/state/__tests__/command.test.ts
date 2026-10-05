import { describe, expect, it } from 'vitest';
import { computeSizing } from '../../engine';
import { parseCommand } from '../command';
import { calcReducer, INITIAL_STATE } from '../form-reducer';

const apply = (line: string) => parseCommand(line).actions.reduce(calcReducer, INITIAL_STATE);
const roles = (line: string) =>
  parseCommand(line)
    .tokens.filter((t) => t.role !== 'space')
    .map((t) => `${t.text}:${t.role}`);

describe('parseCommand', () => {
  it('turns a full line into the same form a user would type', () => {
    const state = apply(
      'tcs 4012.50 sl 3890 risk 1% cap 20% cost 0.25% t 4300 eq 2000000 cash 640000',
    );
    expect(state.symbol).toBe('TCS');
    expect(state.form).toMatchObject({
      entry: '4012.50',
      stopMode: 'price',
      stopPrice: '3890',
      riskMode: 'percent',
      riskPct: '1',
      maxAllocationPct: '20',
      costPct: '0.25',
      equity: '2000000',
      availableCash: '640000',
    });
    expect(state.form.targets[0]).toBe('4300');
    expect(computeSizing(state.form).ok).toBe(true);
  });

  it('reads a % stop and an amount of risk', () => {
    const state = apply('infy 1512.40 sl 2% risk 7,500');
    expect(state.form).toMatchObject({
      stopMode: 'percent',
      stopPct: '2',
      riskMode: 'amount',
      riskAmount: '7,500',
    });
  });

  it('reads an ATR stop with an optional multiple in any of its spellings', () => {
    for (const multiple of ['1.5x', 'x1.5', '1.5×', '1.5']) {
      expect(apply(`hdfcbank 1650 atr 32 ${multiple}`).form).toMatchObject({
        stopMode: 'atr',
        atr: '32',
        atrMultiple: '1.5',
      });
    }
    expect(apply('atr 32').form.atrMultiple).toBe(INITIAL_STATE.form.atrMultiple);
  });

  it('accepts the long and short keyword forms', () => {
    expect(apply('100 stop 95').form.stopPrice).toBe('95');
    expect(apply('100 r 2%').form.riskPct).toBe('2');
    expect(apply('alloc 15%').form.maxAllocationPct).toBe('15');
    expect(apply('tgt 120').form.targets[0]).toBe('120');
    expect(apply('target 121').form.targets[0]).toBe('121');
    expect(apply('equity 500000').form.equity).toBe('500000');
  });

  it('marks what it understood and leaves the rest unknown, changing nothing for it', () => {
    expect(roles('infy 1512.40 sl 2% wat')).toEqual([
      'infy:symbol',
      '1512.40:number',
      'sl:keyword',
      '2%:number',
      'wat:unknown',
    ]);
    expect(apply('cap 20').form.maxAllocationPct).toBe(''); // a cap needs a %
    expect(roles('cap 20')).toEqual(['cap:unknown', '20:number']);
  });

  it('never takes a keyword without a value as the symbol', () => {
    expect(apply('100 sl').symbol).toBe('');
    expect(roles('100 risk')).toEqual(['100:number', 'risk:unknown']);
  });

  it('takes only the first word that looks like a symbol', () => {
    const state = apply('tcs infy 100');
    expect(state.symbol).toBe('TCS');
    expect(roles('tcs infy 100')[1]).toBe('infy:unknown');
  });

  it('summarises each clause for the preview chips', () => {
    expect(parseCommand('tcs 4012.5 sl 3890 risk 1%').understood).toEqual([
      ['Symbol', 'TCS'],
      ['Entry', '₹4,012.5'],
      ['Stop', '₹3,890'],
      ['Risk', '1%'],
    ]);
  });

  it('keeps every space so the coloured overlay lines up with the input', () => {
    const line = '  tcs   100 ';
    expect(
      parseCommand(line)
        .tokens.map((t) => t.text)
        .join(''),
    ).toBe(line);
    expect(parseCommand('').actions).toEqual([]);
  });
});
