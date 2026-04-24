import { contextBridge, ipcRenderer } from 'electron';

// Le preload s execute dans la fenetre renderer, mais avant le code de l interface.
// Son role est d exposer une API minimale et securisee au navigateur embarque.
contextBridge.exposeInMainWorld('meetPrep', {
  // Cette methode envoie une requete au process main pour generer un vrai PDF.
  exportPdf: (payload: { filename: string; html: string }) => ipcRenderer.invoke('appointments:export-pdf', payload),
});
