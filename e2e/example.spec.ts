import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';

test('Application launches and shows title', async () => {
  // Launch Electron app with a flag to reset DB
  const electronApp = await electron.launch({
    args: ['.'],
    env: { ...process.env, TEST_MODE: '1' },
  });

  // Get the first window
  const window = await electronApp.firstWindow();

  // Attendre que la fenêtre soit vraiment prête
  await window.waitForLoadState('domcontentloaded');

  // 🔥 IMPORTANT : forcer une taille
  await window.setViewportSize({ width: 1280, height: 800 });

  // 1. Chargement de la page -> screen
  await window.waitForSelector('body');
  await expect(window.locator('text=MeetPrep Assistant')).toBeVisible();
  await window.waitForTimeout(500);
  await window.screenshot({ path: 'test-results/1-chargement.png' });

  // 2. Suppression RDV (seed) -> screen
  // Le seed est automatiquement créé car on a réinitialisé la BDD avec TEST_MODE
  const deleteBtn = window.locator('button:has-text("Supprimer")').first();
  await deleteBtn.click();
  await window.waitForTimeout(500); // Laisse le temps au DOM de se mettre à jour
  await window.screenshot({ path: 'test-results/2-suppression-seed.png' });

  // 3. Ajout d'un Rdv -> screen
  await window.getByPlaceholder('Titre du RDV').fill('RDV de Soutenance');
  await window.getByPlaceholder('John Doe').fill('Jury ECE');
  await window.getByPlaceholder("Nom de l'entreprise").fill('Ecole');
  
  // Mettre la date d'aujourd'hui pour qu'il apparaisse dans la liste "RDV du jour"
  const today = new Date().toISOString().split('T')[0];
  await window.locator('input[type="date"]').fill(today);
  await window.locator('input[type="time"]').fill('10:00');
  
  await window.locator('button:has-text("Ajouter un RDV")').click();
  await window.waitForTimeout(500);
  await expect(window.locator('text=RDV de Soutenance').first()).toBeVisible();
  await window.screenshot({ path: 'test-results/3-ajout-rdv.png' });

  // 4. Clique sur préparer RDV et screen de la nouvelle page
  await window.locator('button:has-text("Preparer le RDV")').first().click();
  
  // Attendre que la nouvelle page s'affiche
  await expect(window.locator('text=Preparation du rendez-vous')).toBeVisible();
  await window.waitForTimeout(500);
  await window.screenshot({ path: 'test-results/4-page-preparation.png' });

  // Close
  await electronApp.close();
});