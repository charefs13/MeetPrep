import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('Application launches and shows title', async () => {
  // Launch Electron app
  const electronApp = await electron.launch({ args: ['.'] });

  // Evaluation in the main process
  const isPackaged = await electronApp.evaluate(async ({ app }) => {
    return app.isPackaged;
  });
  expect(isPackaged).toBe(false);

  // Get the first window that the app opens
  const window = await electronApp.firstWindow();
  
  // Check the title of the HTML page
  const title = await window.title();
  expect(title).toBe('meetprep');

  // Verify that a specific text from the Home component is visible
  await expect(window.locator('text=MeetPrep Assistant')).toBeVisible();

  // Close the app
  await electronApp.close();
});
