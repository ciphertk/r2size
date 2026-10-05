import { CalculatorScreen } from '../calculator/CalculatorScreen';
import styles from './App.module.css';

export function App() {
  return (
    <>
      <header className={styles.bar}>
        <span className={styles.wordmark}>R2Size</span>
        <span className={styles.tagline}>Position size calculator · NSE cash · long only</span>
      </header>
      <main>
        <h1 className="vh">R2Size position size calculator</h1>
        <CalculatorScreen />
      </main>
    </>
  );
}
