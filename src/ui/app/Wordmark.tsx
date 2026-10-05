import { WORDMARK } from './brand-paths';

/** ⌊R2⌋SIZE as outlines (no font needed), in the current text colour. */
export function Wordmark({ height = 16 }: { readonly height?: number }) {
  return (
    <svg
      viewBox={`0 0 ${WORDMARK.width} ${WORDMARK.height}`}
      height={height}
      width={(WORDMARK.width / WORDMARK.height) * height}
      role="img"
      aria-label="R2Size"
      focusable="false"
    >
      <path d={WORDMARK.d} fill="currentColor" />
    </svg>
  );
}
