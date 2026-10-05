/**
 * Trade setups in the URL hash (architecture §5, ADR-005). The hash never reaches the server,
 * and ShareableSetup has no equity or cash field, so the profile cannot be shared by mistake.
 */
import { parseDecimal, PLACES, type RiskMode, type StopMode } from '../engine';

export interface ShareableSetup {
  readonly symbol: string;
  readonly entry: string;
  readonly stopMode: StopMode;
  readonly stopPrice: string;
  readonly stopPct: string;
  readonly atr: string;
  readonly atrMultiple: string;
  readonly tick: string;
  readonly riskMode: RiskMode;
  readonly riskPct: string;
  readonly riskAmount: string;
  readonly maxAllocationPct: string;
  readonly costPct: string;
  readonly targets: readonly [string, string, string];
}

const SHARE_VERSION = '1';
const MAX_HASH_LENGTH = 512;
const SYMBOL = /^[A-Z0-9&.-]{1,20}$/;

/** URL key → [setup field, decimal places]. */
const NUMBER_KEYS = {
  e: ['entry', PLACES.price],
  s: ['stopPrice', PLACES.price],
  sp: ['stopPct', PLACES.percent],
  atr: ['atr', PLACES.atr],
  am: ['atrMultiple', PLACES.multiple],
  tk: ['tick', PLACES.price],
  r: ['riskPct', PLACES.percent],
  ra: ['riskAmount', PLACES.price],
  al: ['maxAllocationPct', PLACES.percent],
  c: ['costPct', PLACES.percent],
} as const;

type NumberKey = keyof typeof NUMBER_KEYS;
type NumberField = (typeof NUMBER_KEYS)[NumberKey][0];

const STOP_CODES = { price: 'price', percent: 'pct', atr: 'atr' } as const satisfies Record<
  StopMode,
  string
>;
const RISK_CODES = { percent: 'pct', amount: 'amt' } as const satisfies Record<RiskMode, string>;

/** Which number fields belong to each mode; only the active mode's values are shared. */
const STOP_FIELDS: Record<StopMode, readonly NumberKey[]> = {
  price: ['s'],
  percent: ['sp'],
  atr: ['atr', 'am'],
};
const RISK_FIELDS: Record<RiskMode, readonly NumberKey[]> = { percent: ['r'], amount: ['ra'] };

/** "1,00,000.50 " → "100000.50"; typed text may carry grouping that would clash with "," in t=. */
const clean = (text: string): string => text.replace(/[,₹\s]/g, '');

export const EMPTY_SETUP: ShareableSetup = {
  symbol: '',
  entry: '',
  stopMode: 'percent',
  stopPrice: '',
  stopPct: '',
  atr: '',
  atrMultiple: '',
  tick: '',
  riskMode: 'percent',
  riskPct: '',
  riskAmount: '',
  maxAllocationPct: '',
  costPct: '',
  targets: ['', '', ''],
};

/** "#v=1&sym=RAYMOND&e=100&…", or "" when there is nothing worth sharing. */
export const encodeSetup = (setup: ShareableSetup): string => {
  const params = new URLSearchParams({ v: SHARE_VERSION });
  const symbol = setup.symbol.trim().toUpperCase();
  if (symbol !== '') params.set('sym', symbol);

  const keys: NumberKey[] = [
    'e',
    ...STOP_FIELDS[setup.stopMode],
    'tk',
    ...RISK_FIELDS[setup.riskMode],
    'al',
    'c',
  ];
  params.set('sm', STOP_CODES[setup.stopMode]);
  params.set('rm', RISK_CODES[setup.riskMode]);
  for (const key of keys) {
    const value = clean(setup[NUMBER_KEYS[key][0]]);
    if (value !== '') params.set(key, value);
  }

  const targets = setup.targets.map(clean);
  while (targets.length > 0 && targets[targets.length - 1] === '') targets.pop();
  if (targets.length > 0) params.set('t', targets.join(','));

  const hasContent = [...params.keys()].some((key) => !['v', 'sm', 'rm'].includes(key));
  // URLSearchParams escapes "," as %2C; keep it readable, it is safe in a fragment.
  return hasContent ? `#${params.toString().replace(/%2C/g, ',')}` : '';
};

export type DecodeResult =
  | { readonly kind: 'none' }
  | { readonly kind: 'newer' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'setup'; readonly setup: ShareableSetup; readonly ignored: readonly string[] };

const validNumber = (text: string, places: number): boolean => {
  const parsed = parseDecimal(text, places);
  return parsed.kind === 'value';
};

/** Reads an untrusted hash: allowlisted keys only, every value checked, never throws. */
export const decodeSetup = (hash: string): DecodeResult => {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (raw === '') return { kind: 'none' };
  if (raw.length > MAX_HASH_LENGTH) return { kind: 'invalid' };

  let params: URLSearchParams;
  try {
    params = new URLSearchParams(raw);
  } catch {
    return { kind: 'invalid' };
  }
  const version = params.get('v');
  if (version === null) return { kind: 'none' };
  if (version !== SHARE_VERSION) return { kind: 'newer' };

  const ignored: string[] = [];
  const fields: Partial<Record<NumberField, string>> = {};

  const stopCode = params.get('sm');
  const stopMode = (Object.keys(STOP_CODES) as StopMode[]).find(
    (mode) => STOP_CODES[mode] === stopCode,
  );
  if (stopCode !== null && stopMode === undefined) ignored.push('stop method');
  const riskCode = params.get('rm');
  const riskMode = (Object.keys(RISK_CODES) as RiskMode[]).find(
    (mode) => RISK_CODES[mode] === riskCode,
  );
  if (riskCode !== null && riskMode === undefined) ignored.push('risk unit');

  for (const key of Object.keys(NUMBER_KEYS) as NumberKey[]) {
    const value = params.get(key);
    if (value === null) continue;
    const [field, places] = NUMBER_KEYS[key];
    if (validNumber(value, places)) fields[field] = value;
    else ignored.push(field);
  }

  let symbol = '';
  const sym = params.get('sym');
  if (sym !== null) {
    if (SYMBOL.test(sym.toUpperCase())) symbol = sym.toUpperCase();
    else ignored.push('symbol');
  }

  const targets: [string, string, string] = ['', '', ''];
  const t = params.get('t');
  if (t !== null) {
    const parts = t.split(',');
    if (parts.length > 3) ignored.push('targets');
    parts.slice(0, 3).forEach((part, i) => {
      if (part === '') return;
      if (validNumber(part, PLACES.price)) targets[i] = part;
      else ignored.push(`target ${i + 1}`);
    });
  }

  return {
    kind: 'setup',
    setup: {
      ...EMPTY_SETUP,
      ...fields,
      symbol,
      stopMode: stopMode ?? EMPTY_SETUP.stopMode,
      riskMode: riskMode ?? EMPTY_SETUP.riskMode,
      targets,
    },
    ignored,
  };
};
