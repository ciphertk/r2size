import { expect, test, type Page } from '@playwright/test';

const LINE = 'raymond 100 sl 7% risk 1% eq 2000000 cash 640000 cap 20% cost 0.25% t 118.40';
const qty = (page: Page) => page.locator('#ticket-qty');
const slider = (page: Page, name: string) => page.getByRole('slider', { name });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Quick setup' }).fill(LINE);
  await page.keyboard.press('Enter');
  await expect(qty(page)).toContainText('2,758');
});

test('one typed line fills every field', async ({ page }) => {
  await expect(page.getByLabel('Symbol')).toHaveValue('RAYMOND');
  await expect(page.getByLabel('Stop % below entry')).toHaveValue('7');
  await expect(page.getByLabel('Target 1', { exact: true })).toHaveValue('118.40');
  await expect(page.getByText('Saved on this device · updated today')).toBeVisible();
});

test('arrow keys move a ladder line one tick, and the quantity follows', async ({ page }) => {
  const stop = slider(page, 'Stop line');
  await stop.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByLabel('Stop price')).toHaveValue('92.99');
  await page.keyboard.press('Shift+ArrowDown');
  await expect(page.getByLabel('Stop price')).toHaveValue('92.89');
  await expect(qty(page)).not.toContainText('2,758'); // wider stop, fewer shares
});

test('dragging the stop line snaps to the tick and resizes the trade', async ({
  page,
  browserName,
}) => {
  // Playwright's emulated WebKit touch device doesn't turn mouse input into pointer events.
  test.skip(browserName === 'webkit', 'Pointer drag is not emulated on WebKit mobile');
  const stop = slider(page, 'Stop line');
  await stop.scrollIntoViewIfNeeded();
  const box = await stop.boundingBox();
  if (!box) throw new Error('no stop line');
  const x = box.x + 30;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 30, { steps: 8 });
  await page.mouse.up();
  const value = await page.getByLabel('Stop price').inputValue();
  expect(Number(value)).toBeLessThan(93);
  expect(value).toMatch(/^\d+\.\d{2}$/);
  await expect(qty(page)).not.toContainText('2,758');
});

test('C copies the quantity from anywhere outside a field', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'Clipboard reads need Chromium permissions');
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press('c');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('2758');
});
