import { test, expect } from '@playwright/test';

test('no Max effect chain reached on first load', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    errors.push(err.message);
  });

  // Navigate to the app
  await page.goto('/');

  // Wait for the app to load (it should at least render the shell)
  await page.waitForSelector('.app-shell', { timeout: 10000 });

  // Give the app some time to settle
  await page.waitForTimeout(2000);

  // Check that no ReactiveError with "Max effect chain reached" was thrown
  const reactiveErrors = errors.filter(err => err.includes('Max effect chain reached'));
  
  if (reactiveErrors.length > 0) {
    console.error('Found reactive errors:', reactiveErrors);
  }

  expect(reactiveErrors, `Found reactive errors: ${reactiveErrors.join(', ')}`).toHaveLength(0);
});
