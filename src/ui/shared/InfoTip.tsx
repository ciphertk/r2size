import { Popover } from '@base-ui/react/popover';
import styles from './InfoTip.module.css';

export interface InfoTipProps {
  /** What the tip explains, for the button's accessible name ("About entry"). */
  readonly topic: string;
  readonly text: string;
}

/** An "i" button that opens a short explanation on tap or click, never on hover alone. */
export function InfoTip({ topic, text }: InfoTipProps) {
  return (
    <Popover.Root>
      <Popover.Trigger className={styles.trigger} aria-label={`About ${topic}`}>
        i
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={8} className={styles.positioner}>
          <Popover.Popup className={styles.popup}>
            <Popover.Title className={styles.title}>{topic}</Popover.Title>
            <Popover.Description className={styles.text}>{text}</Popover.Description>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
