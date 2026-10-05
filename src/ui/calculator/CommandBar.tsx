import { useEffect, useRef, useState, type Dispatch } from 'react';
import { parseCommand } from '../../state/command';
import { calcReducer, type CalcAction, type CalcState } from '../../state/form-reducer';
import styles from './CommandBar.module.css';

export interface CommandBarProps {
  readonly state: CalcState;
  readonly dispatch: Dispatch<CalcAction>;
  /** Called with the form as it will be after the line is applied (to save the profile). */
  readonly onApplied?: (next: CalcState, actions: readonly CalcAction[]) => void;
}

const HISTORY = 20;

/**
 * Quick setup: one typed line fills the form ("tcs 4012.50 sl 3890 risk 1%"). The text is
 * redrawn underneath a transparent input so each word can be coloured by what it was read as,
 * and chips preview what Enter will set. ↑ recalls the last line, Esc clears, "/" focuses.
 */
export function CommandBar({ state, dispatch, onApplied }: CommandBarProps) {
  const [line, setLine] = useState('');
  const [applied, setApplied] = useState<readonly (readonly [string, string])[]>([]);
  const [history, setHistory] = useState<readonly string[]>([]);
  const input = useRef<HTMLInputElement>(null);
  const overlay = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest('input, textarea, select, [contenteditable]')) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const parsed = parseCommand(line);
  const syncScroll = () => {
    if (overlay.current && input.current) overlay.current.scrollLeft = input.current.scrollLeft;
  };

  return (
    <form
      className={styles.command}
      onSubmit={(event) => {
        event.preventDefault();
        if (line.trim() === '') return;
        parsed.actions.forEach(dispatch);
        onApplied?.(parsed.actions.reduce(calcReducer, state), parsed.actions);
        setApplied(parsed.understood);
        setHistory((h) => [line, ...h.filter((x) => x !== line)].slice(0, HISTORY));
        setLine('');
      }}
    >
      <div className={styles.field}>
        <span className={styles.prompt} aria-hidden="true">
          ›
        </span>
        <div className={styles.stack}>
          <div ref={overlay} className={styles.overlay} aria-hidden="true">
            {parsed.tokens.map((token, i) => (
              <span key={i} data-role={token.role}>
                {token.text}
              </span>
            ))}
          </div>
          <input
            ref={input}
            className={styles.input}
            aria-label="Quick setup"
            aria-describedby="command-help"
            placeholder="tcs 4012.50 sl 3890 risk 1%"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="go"
            value={line}
            onChange={(event) => {
              setLine(event.target.value);
              requestAnimationFrame(syncScroll);
            }}
            onScroll={syncScroll}
            onKeyDown={(event) => {
              if (event.key === 'ArrowUp' && line === '' && history[0] !== undefined) {
                event.preventDefault();
                setLine(history[0]);
              } else if (event.key === 'Escape') {
                setLine('');
                event.currentTarget.blur();
              }
            }}
          />
        </div>
        <kbd className={styles.kbd} aria-hidden="true">
          {line === '' ? '/' : '↵'}
        </kbd>
      </div>
      <div className={styles.chips} aria-live="polite">
        {(line === '' ? applied : parsed.understood).map(([label, value]) => (
          <span key={label} className={line === '' ? `${styles.chip} ${styles.done}` : styles.chip}>
            <span className={styles.chipLabel}>{label}</span> {value}
          </span>
        ))}
        {/* Always present: it is the input's description, even while chips show. */}
        <span
          id="command-help"
          className={line === '' && applied.length === 0 ? styles.help : 'vh'}
        >
          Try <code>sl 5%</code> · <code>atr 32 1.5x</code> · <code>risk 5000</code> ·{' '}
          <code>cap 20%</code> · <code>t 4300</code>
        </span>
      </div>
    </form>
  );
}
