import { useEffect, useRef, useState, type ReactNode } from 'react';
import { copyText } from '../../infra/clipboard';
import styles from './CopyButton.module.css';

export interface CopyButtonProps {
  /** What gets copied, or a function that works it out at the moment of the tap. */
  readonly text: string | (() => string);
  /** Spoken confirmation, e.g. "Quantity" → "Quantity copied". */
  readonly what: string;
  readonly variant?: 'primary' | 'ghost';
  readonly children: ReactNode;
}

const FEEDBACK_MS = 1500;

/** One-tap copy with a visible "Copied ✓" and a polite announcement for screen readers. */
export function CopyButton({ text, what, variant = 'ghost', children }: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await copyText(typeof text === 'function' ? text() : text);
    setState(ok ? 'copied' : 'failed');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState('idle'), FEEDBACK_MS);
  };

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles[variant]}`}
        data-state={state}
        onClick={() => void onClick()}
      >
        {state === 'copied' ? 'Copied ✓' : state === 'failed' ? 'Copy failed' : children}
      </button>
      {/* Outside the button, so its accessible name stays short; absolutely positioned, so no grid cell. */}
      <span role="status" className="vh">
        {state === 'copied' ? `${what} copied` : state === 'failed' ? `Could not copy ${what}` : ''}
      </span>
    </>
  );
}
