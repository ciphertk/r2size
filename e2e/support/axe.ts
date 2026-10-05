import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';

/**
 * Serious and critical axe violations, scanned only once every animation and transition has
 * finished. A dialog that is still fading in has see-through text, which axe would report as
 * low contrast (seen on slow Linux WebKit in CI).
 */
export const seriousViolations = async (page: Page) => {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
};
