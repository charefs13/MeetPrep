import './index.css';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Routes, Route, useNavigate, useParams, Link } from 'react-router-dom';

import {
  Appointment,
  AppointmentDraft,
  AppointmentPreparationUpdate,
  AppointmentUpsert,
  appointmentLabel,
  appointmentSubtitle,
  createEmptyDraft,
  todayIso,
} from './shared/appointments';

// Le renderer React ne stocke plus les rendez-vous dans localStorage.
// Il dialogue maintenant avec le process main via le preload pour utiliser SQLite.

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

type StatusTone = 'default' | 'success' | 'error';

const statusClassName = (tone: StatusTone) => {
  if (tone === 'success') {
    return 'text-sm text-emerald-300';
  }
  if (tone === 'error') {
    return 'text-sm text-rose-300';
  }
  return 'text-sm text-slate-400';
};

// ==========================================
// Composant de la page d'accueil (Home)
// Contient le formulaire d'ajout, la liste globale et la liste du jour
// ==========================================
function Home({
  appointments,
  draft,
  setDraft,
  editingAppointmentId,
  setEditingAppointmentId,
  appointmentStatus,
  setAppointmentStatus,
  saveAppointmentFromDraft,
  deleteAppointment,
}: {
  appointments: Appointment[];
  draft: AppointmentDraft;
  setDraft: React.Dispatch<React.SetStateAction<AppointmentDraft>>;
  editingAppointmentId: string | null;
  setEditingAppointmentId: React.Dispatch<React.SetStateAction<string | null>>;
  appointmentStatus: { message: string; tone: StatusTone };
  setAppointmentStatus: React.Dispatch<React.SetStateAction<{ message: string; tone: StatusTone }>>;
  saveAppointmentFromDraft: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  deleteAppointment: (appointmentId: string) => Promise<void>;
}) {
  const navigate = useNavigate();

  const isEditing = Boolean(editingAppointmentId);
  const todaysAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.date === todayIso()),
    [appointments],
  );

  const startEditingAppointment = (appointmentId: string) => {
    const appointment = appointments.find((entry) => entry.id === appointmentId);
    if (!appointment) return;

    setDraft({
      title: appointment.title,
      date: appointment.date,
      time: appointment.time,
      client: appointment.fields.client,
      company: appointment.fields.company,
    });
    setEditingAppointmentId(appointment.id);
    setAppointmentStatus({
      message: 'Le RDV est charge dans le formulaire de gauche.',
      tone: 'success',
    });
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 pt-14 pb-8 lg:px-10">
        <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          
          {/* COLONNE GAUCHE : Formulaire & Liste de tous les RDV */}
          <aside className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">MeetPrep Assistant</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">Rendez-vous</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Ajoutez ou modifiez vos rendez-vous.
                </p>
              </div>
            </div>

            <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={saveAppointmentFromDraft}>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold text-white">
                  {isEditing ? 'Modifier le RDV' : 'Ajouter un RDV'}
                </p>
              </div>
              <label className="sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-200">Titre</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Titre du RDV"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">Date</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => setDraft((current) => ({ ...current, date: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">Heure</span>
                <input
                  type="time"
                  value={draft.time}
                  onChange={(event) => setDraft((current) => ({ ...current, time: event.target.value }))}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">Nom du client</span>
                <input
                  value={draft.client}
                  onChange={(event) => setDraft((current) => ({ ...current, client: event.target.value }))}
                  placeholder="John Doe"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>
              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">Entreprise</span>
                <input
                  value={draft.company}
                  onChange={(event) => setDraft((current) => ({ ...current, company: event.target.value }))}
                  placeholder="Nom de l'entreprise"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>
              <div className="sm:col-span-2">
                <span className={statusClassName(appointmentStatus.tone)}>{appointmentStatus.message}</span>
              </div>
              <div className="sm:col-span-2 mt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  {isEditing ? 'Enregistrer les modifications' : 'Ajouter un RDV'}
                </button>
                {isEditing ? (
                  <button
                     type="button"
                     onClick={() => {
                       setDraft(createEmptyDraft());
                       setEditingAppointmentId(null);
                       setAppointmentStatus({
                         message: 'Modification annulee. Le formulaire est reinitialise.',
                         tone: 'success',
                       });
                     }}
                     className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                   >
                     Annuler
                   </button>
                 ) : null}
              </div>
            </form>

            <div className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Tous mes rendez-vous</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {appointments.length}
                </span>
              </div>
              <div className="space-y-3">
                {appointments.length ? (
                  appointments.map((appointment) => (
                    <article
                      key={appointment.id}
                      className="rounded-[1.5rem] border border-white/10 bg-slate-950/70 p-4 transition"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{appointment.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{appointmentLabel(appointment)}</p>
                        <p className="mt-2 text-xs text-slate-500">{appointmentSubtitle(appointment)}</p>
                      </div>

                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEditingAppointment(appointment.id)}
                          className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void deleteAppointment(appointment.id);
                          }}
                          className="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20"
                        >
                          Supprimer
                        </button>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
                    Aucun rendez-vous enregistre.
                  </div>
                )}
              </div>
            </div>
          </aside>

          {/* COLONNE DROITE : Liste des RDV du jour avec bouton pour Preparer */}
          <section className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
              <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-orange-200/80">Aujourd'hui</p>
                    <h3 className="mt-2 text-xl font-semibold text-white">RDV du jour</h3>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                    {todaysAppointments.length}
                  </span>
                </div>

                <div className="space-y-3">
                  {todaysAppointments.length ? (
                    todaysAppointments.map((appointment) => (
                      <article
                        key={appointment.id}
                        className="rounded-[1.5rem] border border-white/10 bg-slate-950/60 p-4 transition"
                      >
                        <p className="text-sm font-semibold text-white">{appointment.title}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {appointment.time || 'Heure a definir'}
                        </p>
                        <p className="mt-3 text-xs text-slate-500">{appointmentSubtitle(appointment)}</p>
                        {/* Ce bouton navigue desormais vers la nouvelle page de preparation */}
                        <button
                          type="button"
                          onClick={() => navigate(`/prepare/${appointment.id}`)}
                          className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                        >
                          Preparer le RDV
                        </button>
                      </article>
                    ))
                  ) : (
                    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm leading-6 text-slate-400">
                      Aucun RDV prevu aujourd'hui.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </section>

        </section>
      </main>
    </div>
  );
}

// ==========================================
// Composant de la page de préparation (Prepare)
// ==========================================
function Prepare({ appointments, updatePreparedAppointment }: { appointments: Appointment[]; updatePreparedAppointment: (a: Appointment, msg: string) => Promise<void> }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const preparedAppointment = appointments.find((a) => a.id === id);
  const [formStatus, setFormStatus] = useState<{ message: string; tone: StatusTone }>({
    message: 'Les modifications sont automatiquement enregistrees.',
    tone: 'default',
  });

  const exportSummary = async () => {
    if (!preparedAppointment) return;

    if (!window.meetPrep?.exportPdf) {
      setFormStatus({ message: 'L export PDF natif n est pas disponible.', tone: 'error' });
      return;
    }

    const generatedAt = new Date().toLocaleString('fr-FR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const printableHtml = `
      <!DOCTYPE html>
      <html lang="fr">
        <head>
          <meta charset="UTF-8" />
          <title>Compte-rendu MeetPrep</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; color: #0f172a; line-height: 1.5; }
            h1, h2 { margin-bottom: 12px; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
            .card { border: 1px solid #cbd5e1; border-radius: 16px; padding: 16px; }
            .notes { white-space: pre-wrap; }
          </style>
        </head>
        <body>
          <h1>${preparedAppointment.title}</h1>
          <p>Compte-rendu de rendez-vous client</p>
          <p><strong>Genere le :</strong> ${generatedAt}</p>
          <div class="meta">
            <div class="card"><strong>Date</strong><br />${appointmentLabel(preparedAppointment)}</div>
            <div class="card"><strong>Client</strong><br />${preparedAppointment.fields.client || 'Non renseigne'}</div>
            <div class="card"><strong>Entreprise</strong><br />${preparedAppointment.fields.company || 'Non renseignee'}</div>
          </div>
          <div class="card">
            <h2>Checklist de preparation</h2>
            <ul>
              ${preparedAppointment.preparationChecklist
                .map((item) => `<li>${item.checked ? 'Oui' : 'Non'} - ${item.label}</li>`)
                .join('')}
            </ul>
          </div>
          <div class="card" style="margin-top: 16px;">
            <h2>Contexte et objectif</h2>
            <p>${preparedAppointment.fields.goal || 'Non renseigne'}</p>
          </div>
          <div class="card" style="margin-top: 16px;">
            <h2>Notes live</h2>
            <p class="notes">${preparedAppointment.fields.notes || 'Aucune note saisie.'}</p>
          </div>
        </body>
      </html>
    `;

    const safeTitle = (preparedAppointment.title || 'compte-rendu')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const filename = `${safeTitle || 'compte-rendu'}-${preparedAppointment.date || 'sans-date'}.pdf`;

    setFormStatus({ message: 'Generation du PDF en cours...', tone: 'default' });

    try {
      const result = await window.meetPrep.exportPdf({ filename, html: printableHtml });
      if (!result.success) {
        setFormStatus({ message: result.error || 'Impossible de generer le PDF.', tone: 'error' });
        return;
      }
      setFormStatus({ message: `PDF enregistre dans ${result.filePath}.`, tone: 'success' });
    } catch (error) {
      setFormStatus({ message: error instanceof Error ? error.message : 'Erreur inconnue', tone: 'error' });
    }
  };

  if (!preparedAppointment) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
        <p className="mb-4">Ce rendez-vous n'existe pas ou a été supprimé.</p>
        <button onClick={() => navigate('/')} className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm">
          Retour à l'accueil
        </button>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_28%)]" />
      
      <main className="relative mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 pt-14 pb-8">
        
        {/* En-tête avec bouton retour */}
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center justify-center rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition"
            title="Retour à la liste"
          >
            {/* Simple fleche de retour en SVG */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
          </button>
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">
              Preparation du rendez-vous
            </p>
            <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white">
              {preparedAppointment.title}
            </h2>
            <p className="mt-1 text-sm font-medium text-slate-400">
              {appointmentLabel(preparedAppointment)}
            </p>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur">
          <div className="grid gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Client</p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {preparedAppointment.fields.client || 'Non renseigne'}
                </p>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur">
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Entreprise</p>
                <p className="mt-3 text-lg font-semibold text-white">
                  {preparedAppointment.fields.company || 'Non renseignee'}
                </p>
              </div>
            </div>

            <form className="grid gap-4" onSubmit={(e) => e.preventDefault()}>
              <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Checklist</p>
                    <h3 className="mt-2 text-lg font-semibold text-white">Preparation rapide</h3>
                  </div>
                </div>
                <div className="space-y-3">
                  {preparedAppointment.preparationChecklist.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200"
                    >
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={(event) => {
                          const nextAppointment: Appointment = {
                            ...preparedAppointment,
                            preparationChecklist: preparedAppointment.preparationChecklist.map((entry) =>
                              entry.id === item.id
                                ? { ...entry, checked: event.target.checked }
                                : entry,
                            ),
                          };
                          void updatePreparedAppointment(nextAppointment, 'Checklist mise a jour.');
                        }}
                        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </section>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">Contexte et objectif</span>
                <textarea
                  rows={4}
                  value={preparedAppointment.fields.goal}
                  onChange={(event) => {
                    const nextAppointment: Appointment = {
                      ...preparedAppointment,
                      fields: { ...preparedAppointment.fields, goal: event.target.value },
                    };
                    void updatePreparedAppointment(nextAppointment, 'Contexte mis a jour.');
                  }}
                  placeholder="Quel est le contexte et a quoi doit servir cette reunion ?"
                  className="w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>

              <label>
                <span className="mb-2 block text-sm font-medium text-slate-200">Notes live</span>
                <textarea
                  rows={14}
                  value={preparedAppointment.fields.notes}
                  onChange={(event) => {
                    const nextAppointment: Appointment = {
                      ...preparedAppointment,
                      fields: { ...preparedAppointment.fields, notes: event.target.value },
                    };
                    void updatePreparedAppointment(nextAppointment, 'Notes mises a jour.');
                  }}
                  placeholder="Saisissez les points cles, objections, engagements..."
                  className="min-h-[320px] w-full rounded-[1.75rem] border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                />
              </label>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => exportSummary()}
                  className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                >
                  Generer le PDF du RDV
                </button>
                <span className={statusClassName(formStatus.tone)}>{formStatus.message}</span>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
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
      <Routes>
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
    </HashRouter>
  );
}

const container = document.querySelector<HTMLDivElement>('#app');

if (!container) {
  throw new Error('App container not found');
}

createRoot(container).render(<MainApp />);
