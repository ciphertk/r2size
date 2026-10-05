/**
 * NSE capital-market tick sizes (ADR-010). Data, not logic: when NSE revises the bands,
 * edit this table and the band-edge fixtures, then redeploy.
 */
import { decimal } from './decimal';
import { div, floor, gt, lt, lte, mul, q, sub } from './rational';
import type { Rational } from './types';

export interface TickBand {
  /** Upper price bound of the band; null for the open-ended top band. */
  readonly upTo: string | null;
  readonly upToInclusive: boolean;
  readonly tick: string;
}

export const NSE_TICK_TABLE = {
  effectiveFrom: '2025-04-15',
  source: 'NSE circular NSE/CMTR/67133 (Circular Ref. 33/2025), 13 Mar 2025',
  sourceUrl: 'https://nsearchives.nseindia.com/content/circulars/CMTR67133.pdf',
  verifiedOn: '2026-10-05',
  // Boundaries exactly as in the circular: "Below 250", "≥ 250 – 1,000", "> 1,000 – 5,000",
  // "> 5,000 – 10,000", "> 10,000 – 20,000", "> 20,000". Only 250 starts a band inclusively;
  // 1,000 / 5,000 / 10,000 / 20,000 belong to the LOWER band.
  bands: [
    { upTo: '250', upToInclusive: false, tick: '0.01' },
    { upTo: '1000', upToInclusive: true, tick: '0.05' },
    { upTo: '5000', upToInclusive: true, tick: '0.10' },
    { upTo: '10000', upToInclusive: true, tick: '0.50' },
    { upTo: '20000', upToInclusive: true, tick: '1.00' },
    { upTo: null, upToInclusive: false, tick: '5.00' },
  ] as const satisfies readonly TickBand[],
} as const;

interface BoundedBand {
  readonly upTo: Rational;
  readonly upToInclusive: boolean;
  readonly tick: Rational;
}

const BOUNDED_BANDS: readonly BoundedBand[] = NSE_TICK_TABLE.bands.flatMap((band) =>
  band.upTo === null
    ? []
    : [{ upTo: decimal(band.upTo), upToInclusive: band.upToInclusive, tick: decimal(band.tick) }],
);

/** The open-ended top band is the last row (a table test enforces this). */
const TOP_TICK = decimal(NSE_TICK_TABLE.bands[5].tick);

const BOUNDARIES: readonly Rational[] = BOUNDED_BANDS.map((band) => band.upTo);

/** The tick NSE would assign at this price. An estimate: NSE uses last month's close. */
export const autoTick = (price: Rational): Rational => {
  const band = BOUNDED_BANDS.find((b) =>
    b.upToInclusive ? lte(price, b.upTo) : lt(price, b.upTo),
  );
  return band === undefined ? TOP_TICK : band.tick;
};

const TEN_PERCENT = q(1n, 10n);

/** Within ±10% of a band boundary, where last month's close may sit in another band (D11). */
export const nearBandEdge = (price: Rational): boolean =>
  BOUNDARIES.some((boundary) => {
    const distance = sub(price, boundary);
    const magnitude = lt(distance, q(0n)) ? sub(q(0n), distance) : distance;
    return !gt(magnitude, mul(boundary, TEN_PERCENT));
  });

/** Largest multiple of the tick ≤ price: "away from entry" for a long stop (D6). */
export const floorToTick = (price: Rational, tick: Rational): Rational =>
  mul(q(floor(div(price, tick))), tick);

export const isOnTick = (price: Rational, tick: Rational): boolean => div(price, tick).d === 1n;
