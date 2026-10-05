import type { INFO_TEXT } from '../../domain/messages';

/** Every info tip links to `/guide#term-<id>`; the glossary must have an entry for each. */
export type InfoTerm = keyof typeof INFO_TEXT;

export interface GlossaryEntry {
  readonly id: InfoTerm | 'quantity' | 'riskPerShare' | 'rMultiple' | 'binding' | 'atr' | 'gap';
  readonly term: string;
  readonly text: readonly string[];
}

/** In the order a trader meets them: inputs first, then what R2Size works out. */
export const GLOSSARY: readonly GlossaryEntry[] = [
  {
    id: 'entry',
    term: 'Entry',
    text: [
      'The price you plan to buy at, usually your limit price. Every other number is worked out from it: the stop distance, the investment and the allocation.',
    ],
  },
  {
    id: 'stop',
    term: 'Stop',
    text: [
      'Where you will sell if the trade goes wrong. Type it as a price, as a % below entry, or as a multiple of ATR.',
      'A stop worked out from % or ATR is rounded down onto the NSE tick grid, so it is a price you can actually place. A stop you type yourself is never changed; R2Size only warns when it is off the grid.',
    ],
  },
  {
    id: 'atr',
    term: 'ATR (average true range)',
    text: [
      'How far the stock typically moves in a day, read from your chart (usually ATR 14). A stop at 1.5 × ATR below entry gives the trade room for ordinary noise. R2Size has no market data, so you type the ATR in.',
    ],
  },
  {
    id: 'tick',
    term: 'Tick size',
    text: [
      'The smallest price step NSE allows. It depends on the price band (table below). NSE assigns each stock its tick every month from the previous month’s close, so near a band edge R2Size’s estimate can differ from your broker’s. You can always override it. BSE may use different ticks.',
    ],
  },
  {
    id: 'risk',
    term: 'Risk',
    text: [
      'How much you are willing to lose if the stop is hit: a % of equity (the “1% rule”) or a ₹ amount. This is your risk budget. Costs are counted inside it, so the actual loss at the stop never exceeds it.',
    ],
  },
  {
    id: 'equity',
    term: 'Equity',
    text: [
      'Your total trading capital. Risk % and the allocation cap are worked out from it. It is saved on this device only, and R2Size reminds you when it has not been updated for a while.',
    ],
  },
  {
    id: 'availableCash',
    term: 'Available cash',
    text: [
      'Cash you can actually spend right now, which can be less than equity when money is tied up in other positions. When set, the size is capped so the order, including costs, fits.',
    ],
  },
  {
    id: 'maxAllocationPct',
    term: 'Max allocation',
    text: [
      'The most of your equity you want in one stock. A tight stop can allow a huge position; this cap stops one trade from dominating the account.',
    ],
  },
  {
    id: 'costPct',
    term: 'Round-trip cost',
    text: [
      'Your charges for buying and selling (brokerage, STT, exchange and SEBI fees, stamp duty, GST) as a % of the entry value. R2Size adds entry × cost % to the risk per share. Because the stop is below entry, this slightly overstates the cost, so the risk budget is never exceeded.',
    ],
  },
  {
    id: 'targets',
    term: 'Targets',
    text: [
      'Prices where you might take profit. Each one appears on the price ladder with its R-multiple and its P&L after costs. They are scenarios, not forecasts.',
    ],
  },
  {
    id: 'quantity',
    term: 'Quantity',
    text: [
      'Whole shares, always rounded down: rounding up would risk more than your budget. That is the ⌊ ⌋ in the R2Size mark, the floor function.',
    ],
  },
  {
    id: 'riskPerShare',
    term: 'Risk per share',
    text: [
      'What you lose on each share if the stop is hit: (entry − stop) + entry × cost %. The quantity is the risk budget divided by this, rounded down.',
    ],
  },
  {
    id: 'binding',
    term: 'Binding constraint',
    text: [
      'Which limit decided the quantity: your risk budget, the allocation cap, or available cash. When a cap binds, R2Size also shows the larger quantity risk alone would have allowed, so you know what you gave up.',
    ],
  },
  {
    id: 'rMultiple',
    term: 'R-multiple',
    text: [
      'A move measured in units of your stop distance (R = entry − stop). +2R is a gain of twice what you risk per share. The P&L shown at each level is after costs, so +1R nets slightly under one R, and the stop row equals your actual risk.',
    ],
  },
  {
    id: 'gap',
    term: 'Gap risk',
    text: [
      'A stock can open below your stop after bad news, and the stop then fills at that lower price. Your real loss can be larger than the risk shown. Position sizing limits a normal loss; it cannot prevent a gap.',
    ],
  },
];
