/**
 * The quick-setup language: one typed line becomes form actions, and every token gets a role
 * so the bar can colour what it understood. Nothing is guessed: a word it can't place is
 * marked "unknown" and changes nothing.
 *
 *   tcs 4012.50 sl 3890 risk 1% cap 20% t 4300
 *   infy 1512.40 sl 2% risk 7500 cost 0.25%
 *   hdfcbank 1650 atr 32 1.5x
 */
import { formatTyped } from '../domain/format';
import type { CalcAction } from './form-reducer';

export type TokenRole = 'space' | 'symbol' | 'number' | 'keyword' | 'unknown';

export interface CommandToken {
  readonly text: string;
  role: TokenRole;
}

export interface ParsedCommand {
  readonly actions: readonly CalcAction[];
  /** One [label, value] pair per understood clause, for the preview chips. */
  readonly understood: readonly (readonly [string, string])[];
  /** The line split into tokens, spaces kept, so it can be redrawn exactly. */
  readonly tokens: readonly CommandToken[];
}

const NUMBER = /^[0-9][0-9,]*(\.[0-9]+)?$/;
const SYMBOL = /^[a-z][a-z0-9&.-]{0,19}$/;

const percentOf = (text: string | undefined): string | null =>
  text?.endsWith('%') && NUMBER.test(text.slice(0, -1)) ? text.slice(0, -1) : null;
const numberOf = (text: string | undefined): string | null =>
  text !== undefined && NUMBER.test(text) ? text : null;
const rupees = (value: string) => `₹${formatTyped(value)}`;

const STOP = new Set(['sl', 'stop']);
const RISK = new Set(['risk', 'r']);
const CAP = new Set(['cap', 'alloc']);
const TARGET = new Set(['t', 'tgt', 'target']);
const EQUITY = new Set(['eq', 'equity']);
const KEYWORDS = new Set([...STOP, ...RISK, ...CAP, ...TARGET, ...EQUITY, 'cost', 'cash', 'atr']);

/** A keyword and the value after it, turned into actions; null when the value doesn't fit. */
type Clause = { actions: CalcAction[]; label: string; shown: string } | null;

const clause = (keyword: string, value: string | undefined): Clause => {
  const pct = percentOf(value);
  const num = numberOf(value);
  if (STOP.has(keyword)) {
    if (pct !== null) {
      return {
        actions: [
          { type: 'setStopMode', mode: 'percent' },
          { type: 'setField', field: 'stopPct', value: pct },
        ],
        label: 'Stop',
        shown: `${pct}% below`,
      };
    }
    if (num !== null) {
      return {
        actions: [
          { type: 'setStopMode', mode: 'price' },
          { type: 'setField', field: 'stopPrice', value: num },
        ],
        label: 'Stop',
        shown: rupees(num),
      };
    }
    return null;
  }
  if (RISK.has(keyword)) {
    if (pct !== null) {
      return {
        actions: [
          { type: 'setRiskMode', mode: 'percent' },
          { type: 'setField', field: 'riskPct', value: pct },
        ],
        label: 'Risk',
        shown: `${pct}%`,
      };
    }
    if (num !== null) {
      return {
        actions: [
          { type: 'setRiskMode', mode: 'amount' },
          { type: 'setField', field: 'riskAmount', value: num },
        ],
        label: 'Risk',
        shown: rupees(num),
      };
    }
    return null;
  }
  if (CAP.has(keyword) && pct !== null) {
    return {
      actions: [{ type: 'setField', field: 'maxAllocationPct', value: pct }],
      label: 'Cap',
      shown: `${pct}%`,
    };
  }
  if (keyword === 'cost' && pct !== null) {
    return {
      actions: [{ type: 'setField', field: 'costPct', value: pct }],
      label: 'Cost',
      shown: `${pct}%`,
    };
  }
  if (TARGET.has(keyword) && num !== null) {
    return {
      actions: [{ type: 'setTarget', slot: 0, value: num }],
      label: 'Target',
      shown: rupees(num),
    };
  }
  if (EQUITY.has(keyword) && num !== null) {
    return {
      actions: [{ type: 'setField', field: 'equity', value: num }],
      label: 'Equity',
      shown: rupees(num),
    };
  }
  if (keyword === 'cash' && num !== null) {
    return {
      actions: [{ type: 'setField', field: 'availableCash', value: num }],
      label: 'Cash',
      shown: rupees(num),
    };
  }
  return null;
};

const multipleOf = (text: string | undefined): string | null =>
  numberOf(text?.replace(/^[x×]/i, '').replace(/[x×]$/i, ''));

export const parseCommand = (line: string): ParsedCommand => {
  const tokens: CommandToken[] = line
    .split(/(\s+)/)
    .filter((text) => text !== '')
    .map((text) => ({ text, role: /^\s+$/.test(text) ? 'space' : 'unknown' }));
  const words = tokens.filter((token) => token.role !== 'space');
  const actions: CalcAction[] = [];
  const understood: [string, string][] = [];

  for (let k = 0; k < words.length; k += 1) {
    const word = words[k];
    if (word === undefined) continue;
    const keyword = word.text.toLowerCase();
    const next = words[k + 1];

    if (keyword === 'atr' && numberOf(next?.text) !== null && next) {
      actions.push(
        { type: 'setStopMode', mode: 'atr' },
        { type: 'setField', field: 'atr', value: next.text },
      );
      understood.push(['ATR', rupees(next.text)]);
      word.role = 'keyword';
      next.role = 'number';
      k += 1;
      const after = words[k + 1];
      const multiple = multipleOf(after?.text);
      if (after && multiple !== null) {
        actions.push({ type: 'setField', field: 'atrMultiple', value: multiple });
        understood.push(['Multiple', `${multiple}×`]);
        after.role = 'number';
        k += 1;
      }
      continue;
    }

    const parsed = clause(keyword, next?.text);
    if (parsed && next) {
      actions.push(...parsed.actions);
      understood.push([parsed.label, parsed.shown]);
      word.role = 'keyword';
      next.role = 'number';
      k += 1;
    } else if (NUMBER.test(keyword)) {
      actions.push({ type: 'setField', field: 'entry', value: word.text });
      understood.push(['Entry', rupees(word.text)]);
      word.role = 'number';
    } else if (
      SYMBOL.test(keyword) &&
      !KEYWORDS.has(keyword) &&
      !understood.some(([label]) => label === 'Symbol')
    ) {
      actions.push({ type: 'setSymbol', value: keyword.toUpperCase() });
      understood.push(['Symbol', keyword.toUpperCase()]);
      word.role = 'symbol';
    }
  }
  return { actions, understood, tokens };
};
