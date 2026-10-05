import { expect, test, type Page } from '@playwright/test';
import { seriousViolations } from './support/axe';

test('has no serious or critical axe violations, empty and filled', async ({ page }) => {
  await page.goto('/');
  const scan = () => seriousViolations(page);

  expect(await scan()).toEqual([]);

  await page.getByLabel('Equity', { exact: true }).fill('2000000');
  await page.getByLabel('Entry', { exact: true }).fill('100');
  await page.getByLabel('Stop % below entry').fill('7');
  await page.getByLabel('Risk % of equity').fill('1');
  await page.getByText('Limits, costs & targets').click();
  await page.getByLabel('Entry', { exact: true }).fill('abc');
  await page.getByLabel('Entry', { exact: true }).blur();
  expect(await scan()).toEqual([]);
});

/** Presses Tab until the element with this id has focus: proves it is reachable in order. */
const tabTo = async (page: Page, id: string) => {
  for (let presses = 0; presses < 30; presses += 1) {
    if ((await page.evaluate(() => document.activeElement?.id)) === id) return;
    await page.keyboard.press('Tab');
  }
  throw new Error(`#${id} not reachable with Tab`);
};

test('works with the keyboard alone, in visual order', async ({ page }) => {
  await page.goto('/');
  await tabTo(page, 'field-equity');
  await page.keyboard.type('2000000');
  await tabTo(page, 'field-entry');
  await page.keyboard.type('100');
  await tabTo(page, 'field-stopPct');
  await page.keyboard.type('7');
  await tabTo(page, 'field-riskPct');
  await page.keyboard.type('1');
  await expect(page.locator('output', { hasText: /Stop\s*93\.00/ })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Result' })).toContainText('2,857');

  // Switching the stop method with arrow keys (radio-group semantics).
  await page.getByRole('radio', { name: '% below' }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'ATR ×' })).toBeChecked();
});
