import { contextBridge, ipcRenderer } from 'electron';

import { AppointmentPreparationUpdate, AppointmentUpsert } from './shared/appointments';

// Le preload s execute dans la fenetre renderer, mais avant le code de l interface.
// Son role est d exposer une API minimale et securisee au navigateur embarque.
contextBridge.exposeInMainWorld('meetPrep', {
  // Le renderer demande la liste des rendez-vous au process main,
  // qui va lui-meme lire les donnees dans SQLite.
  listAppointments: () => ipcRenderer.invoke('appointments:list'),
  saveAppointment: (payload: AppointmentUpsert) => ipcRenderer.invoke('appointments:save', payload),
  deleteAppointment: (appointmentId: string) => ipcRenderer.invoke('appointments:delete', appointmentId),
  savePreparation: (payload: AppointmentPreparationUpdate) =>
    ipcRenderer.invoke('appointments:save-preparation', payload),
  // Cette methode envoie une requete au process main pour generer un vrai PDF.
  exportPdf: (payload: { filename: string; html: string }) => ipcRenderer.invoke('appointments:export-pdf', payload),
});
