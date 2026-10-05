/**
 * The price ladder's maths and controls: where each price sits on the axis, and draggable,
 * arrow-keyable stop / entry / target lines. Prices sent to the form are built from whole
 * paise snapped to the tick, so a drag never produces an off-tick or float-rounded value.
 * Pixel positions use floating point; values never do.
 */
import {
  useState,
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Rational, SizingResult, StopMode, StopPreview } from '../../engine';
import type { CalcAction, CalcState } from '../../state/form-reducer';
import { firstTarget } from './first-target';

export type HandleKind = 'entry' | 'stop' | 'target';

interface Domain {
  readonly low: number;
  readonly high: number;
}

interface Snapshot {
  readonly entry: number;
  readonly stop: number;
  readonly mode: StopMode;
}

/** For positioning only. */
const toNumber = (r: Rational): number => Number(r.n) / Number(r.d);
const parseTyped = (typed: string): number => Number.parseFloat(typed.replace(/,/g, ''));
const fromPaise = (paise: number): string =>
  `${Math.floor(paise / 100)}.${String(paise % 100).padStart(2, '0')}`;

/** The price nearest `price` on the tick grid, as an exact two-decimal string. */
export const snapToTick = (price: number, tickPaise: number): string =>
  fromPaise(Math.round((price * 100) / tickPaise) * tickPaise);

export interface LadderInput {
  readonly state: CalcState;
  readonly preview: StopPreview | null;
  readonly result: SizingResult | null;
  readonly dispatch: Dispatch<CalcAction>;
}

export function useLadder({ state, preview, result, dispatch }: LadderInput) {
  // The chart element (a callback ref) and the scale frozen for a drag are state, not refs:
  // both are read while rendering.
  const [box, setBox] = useState<HTMLElement | null>(null);
  const [frozen, setFrozen] = useState<Domain | null>(null);
  const [dragging, setDragging] = useState<HandleKind | null>(null);

  const entry = parseTyped(state.form.entry);
  const stop = preview?.stop ? toNumber(preview.stop.price) : Number.NaN;
  const ready =
    preview !== null && Number.isFinite(entry) && Number.isFinite(stop) && stop > 0 && stop < entry;

  const engineTarget = result ? firstTarget(result) : undefined;
  const rawTarget = engineTarget ? toNumber(engineTarget.price) : parseTyped(state.form.targets[0]);
  const target = Number.isFinite(rawTarget) && rawTarget > entry ? rawTarget : Number.NaN;
  const hasTarget = Number.isFinite(target);

  const r = entry - stop;
  const tickPaise = preview ? Math.max(1, Math.round(toNumber(preview.tick.value) * 100)) : 1;
  const tick = tickPaise / 100;
  const live: Domain = {
    low: stop - r * 0.6,
    high: Math.max(entry + 3 * r, hasTarget ? target : 0) + r * 0.6,
  };
  // While dragging, the scale holds still so the line tracks the pointer 1:1.
  const domain = frozen ?? live;
  const span = domain.high - domain.low;

  /** Distance from the top of the axis, in %. */
  const pos = (price: number): number => ((domain.high - price) / span) * 100;
  const place = (price: number): CSSProperties => ({ top: `${pos(price)}%` });
  const snap = (price: number): string => snapToTick(price, tickPaise);

  const commit = (kind: HandleKind, price: number, from: Snapshot) => {
    if (!Number.isFinite(price)) return;
    if (kind === 'stop') {
      const clamped = Math.min(price, from.entry - tick);
      if (clamped < tick) return;
      if (from.mode !== 'price') dispatch({ type: 'setStopMode', mode: 'price' });
      dispatch({ type: 'setField', field: 'stopPrice', value: snap(clamped) });
    } else if (kind === 'target') {
      dispatch({ type: 'setTarget', slot: 0, value: snap(Math.max(price, from.entry + tick)) });
    } else {
      // A % or ATR stop moves with the entry; a price stop stays put, so entry stays above it.
      const floor = from.mode === 'price' ? from.stop + tick : tick;
      dispatch({ type: 'setField', field: 'entry', value: snap(Math.max(price, floor)) });
    }
  };

  /** The price under a pointer on the given scale (the drawn one unless a drag froze it). */
  const priceAt = (event: { readonly clientY: number }, d: Domain = domain): number => {
    const rect = box?.getBoundingClientRect();
    if (!rect || rect.height === 0) return Number.NaN;
    return d.high - ((event.clientY - rect.top) / rect.height) * (d.high - d.low);
  };

  const priceOf = (kind: HandleKind): number =>
    kind === 'stop' ? stop : kind === 'entry' ? entry : target;

  const snapshot = (): Snapshot => ({ entry, stop, mode: state.form.stopMode });

  const grab = (kind: HandleKind) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    const scale = live;
    setFrozen(scale);
    setDragging(kind);
    // Move by the pointer's travel, so grabbing a line off-centre doesn't make it jump.
    const offset = priceOf(kind) - priceAt(event, scale);
    const from = snapshot();
    let mode = from.mode;
    const move = (e: PointerEvent) => {
      commit(kind, priceAt(e, scale) + offset, { ...from, mode });
      if (kind === 'stop') mode = 'price';
    };
    const end = () => {
      setFrozen(null);
      setDragging(null);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  };

  const STEPS: Record<string, number> = { ArrowUp: 1, PageUp: 10, ArrowDown: -1, PageDown: -10 };
  const nudge = (kind: HandleKind) => (event: ReactKeyboardEvent<HTMLElement>) => {
    const steps = STEPS[event.key];
    if (steps === undefined) return;
    event.preventDefault();
    commit(kind, priceOf(kind) + steps * tick * (event.shiftKey ? 10 : 1), snapshot());
  };

  /** ARIA slider semantics, pointer and keys, and position for one draggable line. */
  const handle = (kind: HandleKind, label: string) => {
    const price = priceOf(kind);
    return {
      role: 'slider' as const,
      tabIndex: 0,
      'aria-label': `${label} line`,
      'aria-orientation': 'vertical' as const,
      'aria-valuemin': Math.max(0, Math.round(domain.low * 100) / 100),
      'aria-valuemax': Math.round(domain.high * 100) / 100,
      'aria-valuenow': price,
      'aria-valuetext': `${label} ₹${price.toFixed(2)}`,
      'data-kind': kind,
      'data-dragging': dragging === kind ? '' : undefined,
      style: place(price),
      onPointerDown: grab(kind),
      onKeyDown: nudge(kind),
    };
  };

  /** Click-to-place: below entry sets a price stop, above it sets target 1. */
  const placeAt = (price: number) => {
    if (!Number.isFinite(price) || price <= 0) return;
    if (price < entry) commit('stop', price, snapshot());
    else commit('target', price, snapshot());
  };

  const levels = result
    ? result.rTable
        .filter((row) => row.kind === 'r1' || row.kind === 'r2' || row.kind === 'r3')
        .map((row) => ({ row, price: toNumber(row.price) }))
    : [];

  /** True when a fixed R level would sit on top of a draggable line. */
  const crowded = (price: number, gapPct = 3.5): boolean =>
    [stop, entry, ...(hasTarget ? [target] : [])].some(
      (p) => Math.abs(pos(p) - pos(price)) < gapPct,
    );

  return {
    ready,
    /** Pass as the chart's `ref`. */
    box: setBox,
    domain,
    dragging,
    entry,
    stop,
    target,
    hasTarget,
    r,
    levels,
    pos,
    place,
    snap,
    priceAt,
    handle,
    placeAt,
    crowded,
    addTarget: () => dispatch({ type: 'setTarget', slot: 0, value: snap(entry + 2 * r) }),
  };
}

export type Ladder = ReturnType<typeof useLadder>;
