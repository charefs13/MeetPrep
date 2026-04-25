import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('Application launches and shows title', async () => {
  // Launch Electron app
  const electronApp = await electron.launch({ args: ['.'] });

  // Check packaging state
  const isPackaged = await electronApp.evaluate(async ({ app }) => {
    return app.isPackaged;
  });
  expect(isPackaged).toBe(false);

  // Get the first window
  const window = await electronApp.firstWindow();

  // Attendre que la fenêtre soit vraiment prête
  await window.waitForLoadState('domcontentloaded');

  // 🔥 IMPORTANT : forcer une taille
  await window.setViewportSize({ width: 1280, height: 800 });

  // Attendre que le rendu soit stabilisé
  await window.waitForTimeout(500);

  // Optionnel : vérifier que le body est bien là
  await window.waitForSelector('body');

  // Verify that a specific text from the Home component is visible
  await expect(window.locator('text=MeetPrep Assistant')).toBeVisible();

  // --- 1. Tester l'ajout d'un rendez-vous ---
  await window.getByPlaceholder('Titre du RDV').fill('Soutenance de projet');
  await window.getByPlaceholder('John Doe').fill('Professeur D.');
  await window.getByPlaceholder("Nom de l'entreprise").fill('Universite');
  
  // Utiliser input type date et time
  await window.locator('input[type="date"]').fill('2026-06-15');
  await window.locator('input[type="time"]').fill('14:00');
  
  // Cliquer sur le bouton
  await window.locator('button:has-text("Ajouter un RDV")').click();

  // --- 2. Verifier que le RDV apparait ---
  await expect(window.locator('text=Soutenance de projet')).toBeVisible();
  await expect(window.locator('text=Professeur D. • Universite')).toBeVisible();

  // Prendre une capture d'ecran de l'application avec les donnees
  await window.screenshot({ path: 'test-results/screenshot-with-data.png' });

  // --- 3. Tester la suppression du rendez-vous ---
  const addedArticle = window.locator('article', { hasText: 'Soutenance de projet' });
  await addedArticle.locator('button:has-text("Supprimer")').click();

  // --- 4. Verifier que le RDV a disparu ---
  await expect(window.locator('text=Soutenance de projet')).not.toBeVisible();

  // Screenshot
  await window.screenshot({ path: 'test-results/screenshot-home.png' });

  // Close
  await electronApp.close();
});