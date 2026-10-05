import { Popover } from '@base-ui/react/popover';
import { INFO_TEXT } from '../../domain/messages';
import { navigate } from '../../infra/route';
import styles from './InfoTip.module.css';

export interface InfoTipProps {
  /** What the tip explains, for the title and the button's name ("About Entry"). */
  readonly topic: string;
  /** The glossary term: picks the short text, and the Guide entry the link opens. */
  readonly term: keyof typeof INFO_TEXT;
}

/**
 * An "i" button that opens a short explanation on tap or click, never on hover alone, ending
 * with a link to the term's full entry in the Guide (M4-D3).
 */
export function InfoTip({ topic, term }: InfoTipProps) {
  const hash = `#term-${term}`;
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger} aria-label={`About ${topic}`}>
        i
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className={styles.positioner}>
          <Popover.Popup className={styles.popup}>
            <Popover.Title className={styles.title}>{topic}</Popover.Title>
            <Popover.Description className={styles.text}>{INFO_TEXT[term]}</Popover.Description>
            <a
              href={`/guide${hash}`}
              className={styles.more}
              onClick={(event) => {
                event.preventDefault();
                navigate('/guide', hash);
              }}
            >
              More in the Guide →
            </a>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
