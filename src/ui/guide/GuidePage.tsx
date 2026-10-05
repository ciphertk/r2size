import { useEffect } from 'react';
import { NSE_TICK_TABLE } from '../../engine';
import { formatCalendarDate, formatTyped } from '../../domain/format';
import { SOURCE_URL } from '../../domain/messages';
import { arrivedInApp, navigate } from '../../infra/route';
import { GLOSSARY } from './glossary';
import styles from './GuidePage.module.css';
import { WorkedExample } from './WorkedExample';

const rupees = (value: string) => `₹${formatTyped(value)}`;

/**
 * The band's price range in the circular's own words: "Below ₹250", "₹250 to ₹1,000",
 * "Above ₹1,000 to ₹5,000", …, "Above ₹20,000". A band starts at the previous bound inclusively
 * only when that bound was exclusive for the band below (D5).
 */
export const bandLabel = (index: number): string => {
  const band = NSE_TICK_TABLE.bands[index];
  const below = NSE_TICK_TABLE.bands[index - 1];
  if (band === undefined) return '';
  if (below === undefined || below.upTo === null) return `Below ${rupees(band.upTo ?? '0')}`;
  const from = below.upToInclusive ? `Above ${rupees(below.upTo)}` : rupees(below.upTo);
  return band.upTo === null ? from : `${from} to ${rupees(band.upTo)}`;
};

/**
 * The Guide & trust page (ADR-008): what every term means, how the quantity is worked out (live,
 * from the engine), the NSE tick bands with their date, and the privacy promise with how to check
 * it. Loaded on demand and precached for offline use.
 */
export function GuidePage() {
  // Arriving from an info tip: bring that term into view (the hash is "#term-<id>").
  useEffect(() => {
    const id = decodeURIComponent(window.location.hash.slice(1));
    if (id === '') {
      window.scrollTo(0, 0);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, []);

  const back = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    // Came from the calculator: go back to it, setup and all. Opened directly: go to "/".
    if (arrivedInApp()) window.history.back();
    else navigate('/');
  };

  return (
    <article className={styles.page}>
      <a href="/" className={styles.back} onClick={back}>
        ← Back to the calculator
      </a>
      <h1 className={styles.title}>Guide</h1>
      <p className={styles.lede}>
        How R2Size sizes a trade, what every term means, and how to check that nothing leaves your
        device.
      </p>

      <nav aria-label="On this page" className={styles.toc}>
        <a href="#how">How the quantity is worked out</a>
        <a href="#terms">Terms</a>
        <a href="#ticks">NSE tick sizes</a>
        <a href="#privacy">Privacy</a>
      </nav>

      <section id="how" className={styles.section} aria-labelledby="how-title">
        <h2 id="how-title">How the quantity is worked out</h2>
        <p>
          R2Size sizes from risk first: decide what you can lose, measure what each share loses at
          the stop, divide, and round down. Then it checks the two caps. Every number below is
          computed live by the same code the calculator uses.
        </p>
        <WorkedExample />
        <p className={styles.note}>
          ⌊x⌋ means “round down to a whole number”. A quantity is never rounded up, so the actual
          risk is never more than your budget.
        </p>
      </section>

      <section id="terms" className={styles.section} aria-labelledby="terms-title">
        <h2 id="terms-title">Terms</h2>
        <dl className={styles.glossary}>
          {GLOSSARY.map((entry) => (
            <div key={entry.id} id={`term-${entry.id}`} className={styles.entry}>
              <dt>{entry.term}</dt>
              {entry.text.map((paragraph) => (
                <dd key={paragraph}>{paragraph}</dd>
              ))}
            </div>
          ))}
        </dl>
      </section>

      <section id="ticks" className={styles.section} aria-labelledby="ticks-title">
        <h2 id="ticks-title">NSE tick sizes</h2>
        <p>
          Equity cash segment, effective {formatCalendarDate(NSE_TICK_TABLE.effectiveFrom)}. ETFs
          are excluded; BSE may differ.
        </p>
        <div className={styles.tableWrap} role="region" aria-label="NSE tick sizes" tabIndex={0}>
          <table className={styles.table}>
            <caption className="vh">NSE tick size by price band</caption>
            <thead>
              <tr>
                <th scope="col">Price</th>
                <th scope="col" className={styles.value}>
                  Tick
                </th>
              </tr>
            </thead>
            <tbody>
              {NSE_TICK_TABLE.bands.map((band, index) => (
                <tr key={band.tick}>
                  <th scope="row">{bandLabel(index)}</th>
                  <td className={styles.value}>₹{band.tick}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={styles.note}>
          Source:{' '}
          <a href={NSE_TICK_TABLE.sourceUrl} rel="noopener noreferrer" target="_blank">
            {NSE_TICK_TABLE.source}
          </a>
          . NSE assigns ticks monthly from the previous month’s close, so near a band edge the
          estimate is flagged and you can override it.
        </p>
      </section>

      <section id="privacy" className={styles.section} aria-labelledby="privacy-title">
        <h2 id="privacy-title">Privacy</h2>
        <p>
          <b>Nothing you type leaves this device.</b> R2Size makes no network requests after the
          page loads. When you reopen it online, the browser only checks this site for an app
          update. There are no accounts, analytics, ads or trackers.
        </p>
        <ul className={styles.list}>
          <li>
            Equity, cash and presets are stored in this browser only (Settings → Export to move
            them).
          </li>
          <li>
            A shared setup link carries trade inputs in the part after “#”, which browsers never
            send to the server. It never includes your equity or cash.
          </li>
          <li>
            The site’s security policy forbids the page from connecting anywhere (
            <code>connect-src &apos;none&apos;</code>), so this is enforced by your browser, not
            just promised.
          </li>
        </ul>
        <h3>Check it yourself</h3>
        <ol className={styles.list}>
          <li>Open your browser’s developer tools and choose the Network tab.</li>
          <li>Reload, then use the calculator, presets, copy and export.</li>
          <li>
            After the first load, the list stays empty. Or turn on airplane mode: everything still
            works.
          </li>
        </ol>
        <p>
          R2Size is open source:{' '}
          <a href={SOURCE_URL} rel="noopener noreferrer" target="_blank">
            {SOURCE_URL.replace('https://', '')}
          </a>
          .
        </p>
      </section>
    </article>
  );
}
