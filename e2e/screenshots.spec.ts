import { test } from '@playwright/test';

/**
 * Captures the filled-in calculator at phone and desktop sizes for a by-eye check against
 * design/mockup.html (M2 Task 9). Not a pixel diff; the images are CI artifacts.
 */
test('screenshots for visual review', async ({ page }, testInfo) => {
  await page.goto('/');
  await page.getByLabel('Equity', { exact: true }).fill('2000000');
  await page.getByLabel('Available cash (optional)').fill('640000');
  await page.getByLabel('Symbol').fill('raymond');
  await page.getByLabel('Entry', { exact: true }).fill('100');
  await page.getByLabel('Stop % below entry').fill('7');
  await page.getByLabel('Risk % of equity').fill('1');
  await page.getByText('Limits, costs & targets').click();
  await page.getByLabel('Max allocation', { exact: true }).fill('20');
  await page.getByLabel('Round-trip cost', { exact: true }).fill('0.25');
  await page.getByLabel('Target 1', { exact: true }).fill('118.40');
  await page.getByLabel('Target 1', { exact: true }).blur();

  await page.screenshot({ path: testInfo.outputPath('viewport.png') });
  await page.screenshot({ path: testInfo.outputPath('full.png'), fullPage: true });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.screenshot({ path: testInfo.outputPath('desktop.png') });
});
