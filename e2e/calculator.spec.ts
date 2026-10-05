import { expect, test, type Page } from '@playwright/test';

/** The M1 worked example "mockup", typed as a trader would. */
const enterMockupSetup = async (page: Page) => {
  await page.getByLabel('Equity', { exact: true }).fill('2000000');
  await page.getByLabel('Available cash (optional)').fill('640000');
  await page.getByLabel('Symbol').fill('raymond');
  await page.getByLabel('Entry', { exact: true }).fill('100');
  await page.getByRole('radio', { name: '% below' }).click();
  await page.getByLabel('Stop % below entry').fill('7');
  await page.getByLabel('Risk % of equity').fill('1');
  await page.getByText('Limits, costs & targets').click();
  await page.getByLabel('Max allocation', { exact: true }).fill('20');
  await page.getByLabel('Round-trip cost', { exact: true }).fill('0.25');
  await page.getByLabel('Target 1', { exact: true }).fill('118.40');
};

const ticket = (page: Page) => page.getByRole('complementary', { name: 'Result' });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
});

test('sizes the mockup setup exactly (M1 worked example)', async ({ page }) => {
  await expect(ticket(page).getByText('Your quantity appears here')).toBeVisible();
  await enterMockupSetup(page);

  const result = ticket(page);
  await expect(result.locator('#ticket-qty')).toContainText('2,758');
  await expect(result).toContainText('Risk-bound');
  await expect(result).toContainText('RAYMOND @ 100.00 · SL 93.00');
  await expect(result).toContainText('₹19,995.50');
  await expect(result).toContainText('1.00%');
  await expect(result).toContainText('₹2,75,800.00');
  await expect(result).toContainText('13.79%');
  await expect(result).toContainText('4,000 alloc · 6,384 cash');

  const ladder = result.getByRole('table', { name: 'Scenarios, not forecasts' });
  await expect(ladder.getByRole('row', { name: /^\+1R/ })).toContainText('+18,616.50');
  await expect(ladder.getByRole('row', { name: /^T1/ })).toContainText('+50,057.70');
  await expect(ladder.getByRole('row', { name: /^Stop/ })).toContainText('−19,995.50');
});

test('shows the derived stop and tick while typing, before equity is known', async ({ page }) => {
  await page.getByLabel('Entry', { exact: true }).fill('200');
  await page.getByLabel('Stop % below entry').fill('5');
  await expect(page.locator('output', { hasText: /Stop\s*190\.00/ })).toBeVisible();
  await expect(page.getByText(/Tick 0\.01 · NSE estimate/)).toBeVisible();
  await expect(ticket(page)).toContainText('Still needed: Equity, Risk % of equity.');
});

test('copies plain digits for the broker, and the summary line', async ({ page, browserName }) => {
  await enterMockupSetup(page);
  const copyQty = ticket(page).getByRole('button', { name: 'Copy quantity' });
  await copyQty.click();
  await expect(copyQty).toContainText('Copied ✓');
  if (browserName === 'chromium') {
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('2758');
    await ticket(page).getByRole('button', { name: 'Copy order line' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      'RAYMOND · BUY 2,758 · LMT ₹100.00 · SL ₹93.00 · TGT ₹118.40',
    );
    await ticket(page).getByRole('button', { name: 'Copy target 1' }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('118.40');
  }
});

test('explains problems in trader language', async ({ page }) => {
  const entry = page.getByLabel('Entry', { exact: true });
  await entry.fill('abc');
  await expect(page.getByText('Enter a number, like 1250.50.')).toHaveCount(0); // not until the field is left
  await entry.blur();
  await expect(page.getByText('Enter a number, like 1250.50.')).toBeVisible();
  await expect(entry).toHaveAttribute('aria-invalid', 'true');

  await entry.fill('1500');
  await page.getByRole('radio', { name: 'Price' }).click();
  await page.getByLabel('Stop price').fill('1450');
  await page.getByLabel('Risk % of equity').fill('0.01');
  await page.getByLabel('Equity', { exact: true }).fill('1000');
  await expect(ticket(page).getByRole('alert')).toHaveText(
    'Your risk budget is too small for 1 share at this stop.',
  );
});

test('uses the decimal keypad and groups numbers only after typing', async ({ page }) => {
  const equity = page.getByLabel('Equity', { exact: true });
  await expect(equity).toHaveAttribute('inputmode', 'decimal');
  await equity.fill('2000000');
  await expect(equity).toHaveValue('2000000');
  await equity.blur();
  await expect(equity).toHaveValue('20,00,000');
});

test('opens an info tip on tap', async ({ page }) => {
  await page.getByRole('button', { name: 'About Entry' }).click();
  await expect(page.getByText('The price you plan to buy at')).toBeVisible();
});

test('keeps the quantity and Copy in reach on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'The dock is phone-only');
  await enterMockupSetup(page);
  const dock = page.getByRole('region', { name: 'Quick copy' });
  await expect(dock).toBeVisible();
  await expect(dock).toContainText('2,758');
  await expect(dock).toBeInViewport();
});

test('time to copy stays well inside the 15 s budget (scripted regression guard)', async ({
  page,
}) => {
  const started = Date.now();
  await page.goto('/');
  await page.getByLabel('Equity', { exact: true }).fill('2000000');
  await page.getByLabel('Entry', { exact: true }).fill('100');
  await page.getByLabel('Stop % below entry').fill('7');
  await page.getByLabel('Risk % of equity').fill('1');
  const copy = page
    .getByRole('region', { name: 'Quick copy' })
    .or(ticket(page))
    .getByRole('button', { name: /Copy quantity|Copied/ })
    .first();
  await copy.click();
  await expect(copy).toContainText('Copied ✓');
  expect(Date.now() - started).toBeLessThan(5_000);
});

test('never scrolls sideways at 320 px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await enterMockupSetup(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
