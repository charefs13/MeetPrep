import './index.css';

import { FormEvent, useEffect, useState, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route } from 'react-router-dom';

import {
  Appointment,
  AppointmentDraft,
  AppointmentPreparationUpdate,
  AppointmentUpsert,
  createEmptyDraft,
} from './shared/appointments';
import { StatusTone } from './shared/ui';

const Home = lazy(() => import('./pages/Home'));
const Prepare = lazy(() => import('./pages/Prepare'));

// ==========================================
// ARCHITECTURE GLOBALE DU FRONTEND (RENDERER)
// ==========================================
// 1. React & Vite : L'interface est construite avec des composants React. Vite gère le rechargement à chaud en dev.
// 2. React Router (HashRouter) : Permet de créer une "Navigation Multi-pages" sans recharger l'application Electron.
// 3. IPC (Inter-Process Communication) : Le renderer ne parle JAMAIS directement à SQLite ou Electron. 
//    Il passe par l'objet `window.meetPrep` (exposé par le fichier preload.ts) pour demander au process `main` de le faire.

declare global {
  interface Window {
    meetPrep?: {
      listAppointments: () => Promise<Appointment[]>;
      saveAppointment: (payload: AppointmentUpsert) => Promise<Appointment[]>;
      deleteAppointment: (appointmentId: string) => Promise<Appointment[]>;
      savePreparation: (payload: AppointmentPreparationUpdate) => Promise<Appointment[]>;
      exportPdf: (payload: { filename: string; html: string }) => Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
      }>;
    };
  }
}

// ==========================================
// Composant Principal (MainApp) contenant le State et le Routeur
// ==========================================
function MainApp() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [draft, setDraft] = useState<AppointmentDraft>(createEmptyDraft());
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appointmentStatus, setAppointmentStatus] = useState<{ message: string; tone: StatusTone }>({
    message: 'Remplissez les champs puis ajoutez un nouveau rendez-vous.',
    tone: 'default',
  });

  const refreshAppointments = async () => {
    if (!window.meetPrep?.listAppointments) return;
    const rows = await window.meetPrep.listAppointments();
    setAppointments(rows);
  };

  useEffect(() => {
    void (async () => {
      try {
        await refreshAppointments();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const saveAppointmentFromDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!window.meetPrep?.saveAppointment) return;

    const payload: AppointmentUpsert = {
      id: editingAppointmentId ?? undefined,
      title: draft.title.trim() || 'Nouveau rendez-vous',
      date: draft.date,
      time: draft.time,
      client: draft.client,
      company: draft.company,
    };
    
    const rows = await window.meetPrep.saveAppointment(payload);
    setAppointments(rows);
    setDraft(createEmptyDraft());
    setEditingAppointmentId(null);
    setAppointmentStatus({
      message: editingAppointmentId ? 'Rendez-vous mis a jour.' : 'Nouveau rendez-vous ajoute.',
      tone: 'success',
    });
  };

  const deleteAppointment = async (appointmentId: string) => {
    if (!window.meetPrep?.deleteAppointment) return;
    const rows = await window.meetPrep.deleteAppointment(appointmentId);
    setAppointments(rows);
    if (editingAppointmentId === appointmentId) {
      setEditingAppointmentId(null);
      setDraft(createEmptyDraft());
    }
  };

  const updatePreparedAppointment = async (nextAppointment: Appointment, statusMessage: string) => {
    // Met a jour l'etat local immediatement pour la reactivite
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) => (appointment.id === nextAppointment.id ? nextAppointment : appointment)),
    );
    // Sauvegarde en DB via IPC
    if (window.meetPrep?.savePreparation) {
      const rows = await window.meetPrep.savePreparation({
        id: nextAppointment.id,
        goal: nextAppointment.fields.goal,
        notes: nextAppointment.fields.notes,
        preparationChecklist: nextAppointment.preparationChecklist,
      });
      setAppointments(rows);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
        Chargement des rendez-vous depuis SQLite...
      </div>
    );
  }

  return (
    <HashRouter>
      {/* Le HashRouter gère l'historique de navigation de façon compatible avec les fichiers locaux d'Electron */}
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-200">
          Chargement de la page...
        </div>
      }>
        <Routes>
          {/* Route 1: Page d'accueil */}
          <Route 
            path="/" 
            element={
              <Home 
                appointments={appointments}
                draft={draft}
                setDraft={setDraft}
                editingAppointmentId={editingAppointmentId}
                setEditingAppointmentId={setEditingAppointmentId}
                appointmentStatus={appointmentStatus}
                setAppointmentStatus={setAppointmentStatus}
                saveAppointmentFromDraft={saveAppointmentFromDraft}
                deleteAppointment={deleteAppointment}
              />
            } 
          />
          {/* Route 2: Page de préparation spécifique à un ID */}
          <Route 
            path="/prepare/:id" 
            element={
              <Prepare 
                appointments={appointments}
                updatePreparedAppointment={updatePreparedAppointment}
              />
            } 
          />
        </Routes>
      </Suspense>
    </HashRouter>
  );
}

const container = document.querySelector<HTMLDivElement>('#app');

if (!container) {
  throw new Error('App container not found');
}

createRoot(container).render(<MainApp />);
