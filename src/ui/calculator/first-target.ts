import type { SizingResult } from '../../engine';

/** Target 1, else the first valid typed target (M2-D1, M2-D2). */
export const firstTarget = (result: SizingResult) =>
  result.rTable
    .filter((row) => row.kind === 'target')
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))[0];
