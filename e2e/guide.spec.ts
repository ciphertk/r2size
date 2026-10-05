import { expect, test } from '@playwright/test';
import { seriousViolations } from './support/axe';

test('an info tip opens its Guide entry, and Back returns with the setup', async ({ page }) => {
  await page.goto('/#v=1&sym=RAYMOND&e=100&sm=pct&sp=7&rm=pct&r=1');
  await page.getByRole('button', { name: 'About Tick size' }).click();
  await page.getByRole('link', { name: 'More in the Guide →' }).click();
  await expect(page).toHaveURL(/\/guide#term-tick$/);
  await expect(page.locator('#term-tick')).toBeInViewport();

  await page.goBack();
  await expect(page.getByLabel('Symbol')).toHaveValue('RAYMOND');
  await expect(page.getByLabel('Entry', { exact: true })).toHaveValue('100');
});

test('the Guide computes the worked example and passes axe', async ({ page }) => {
  await page.goto('/guide');
  const steps = page.getByRole('table', { name: 'Worked example, step by step' });
  await expect(steps.getByRole('row', { name: /^Quantity/ })).toContainText('2,758 shares');
  await expect(page.getByText(/effective 15 Apr 2025/)).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});

test('"Back to the calculator" works when the Guide was opened directly', async ({ page }) => {
  await page.goto('/guide');
  await page.getByRole('link', { name: '← Back to the calculator' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('textbox', { name: 'Quick setup' })).toBeVisible();
});
