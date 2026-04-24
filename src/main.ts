import { app, BrowserWindow, ipcMain, shell } from 'electron';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import started from 'electron-squirrel-startup';

import { deleteAppointment, initializeDatabase, listAppointments, saveAppointment, savePreparation } from './database';
import { AppointmentPreparationUpdate, AppointmentUpsert } from './shared/appointments';

// Le process "main" est le point d entree Electron:
// il cree les fenetres, gere le cycle de vie natif de l application
// et execute les operations desktop sensibles comme l export PDF.
type ExportPdfPayload = {
  filename: string;
  html: string;
};

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // La BrowserWindow heberge l interface web de l application.
  // Electron affiche donc une page HTML/CSS/JS dans une fenetre desktop native.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      // Le preload sert de passerelle securisee entre le renderer et Electron.
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // En dev, Vite sert l application via un serveur local.
  // En production, Electron charge les fichiers construits sur disque.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  // Laisse les DevTools ouverts pour faciliter l apprentissage et le debug.
  mainWindow.webContents.openDevTools();
};

// Le CRUD des rendez-vous est maintenant execute dans le process main,
// car c est lui qui a acces a SQLite.
ipcMain.handle('appointments:list', async () => listAppointments());
ipcMain.handle('appointments:save', async (_event, payload: AppointmentUpsert) => saveAppointment(payload));
ipcMain.handle('appointments:delete', async (_event, appointmentId: string) => deleteAppointment(appointmentId));
ipcMain.handle('appointments:save-preparation', async (_event, payload: AppointmentPreparationUpdate) =>
  savePreparation(payload),
);

// Le renderer ne peut pas ecrire un PDF directement sur le disque.
// Il envoie donc une requete IPC au process main, qui fait le travail natif.
ipcMain.handle('appointments:export-pdf', async (_event, payload: ExportPdfPayload) => {
  const exportWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
    },
  });

  try {
    // On charge le HTML du compte-rendu dans une fenetre invisible,
    // puis Electron l imprime en PDF.
    await exportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(payload.html)}`);

    const pdfBuffer = await exportWindow.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      margins: {
        top: 0.5,
        bottom: 0.5,
        left: 0.5,
        right: 0.5,
      },
    });

    const downloadsDir = app.getPath('downloads');
    const filename = payload.filename.endsWith('.pdf') ? payload.filename : `${payload.filename}.pdf`;
    const filePath = path.join(downloadsDir, filename);

    // Le PDF est enregistre dans Downloads, puis le dossier est ouvert pour l utilisateur.
    await writeFile(filePath, pdfBuffer);
    shell.showItemInFolder(filePath);

    return { success: true, filePath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue pendant l export PDF.',
    };
  } finally {
    // La fenetre temporaire ne sert qu a la generation PDF.
    if (!exportWindow.isDestroyed()) {
      exportWindow.close();
    }
  }
});

// Electron n autorise la creation des fenetres qu une fois l application prete.
app.on('ready', async () => {
  await initializeDatabase();
  createWindow();
});

// Sur Windows/Linux on ferme l app quand toutes les fenetres sont fermees.
// Sur macOS, on respecte l usage natif: l app reste ouverte tant que l utilisateur
// ne quitte pas explicitement.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // Sur macOS, cliquer l icone du dock recree une fenetre si besoin.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
