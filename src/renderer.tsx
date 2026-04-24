import './index.css';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

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

function App() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [draft, setDraft] = useState<AppointmentDraft>(createEmptyDraft());
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);
  const [preparedAppointmentId, setPreparedAppointmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [appointmentStatus, setAppointmentStatus] = useState<{ message: string; tone: StatusTone }>({
    message: 'Remplissez les champs puis ajoutez un nouveau rendez-vous.',
    tone: 'default',
  });
  const [formStatus, setFormStatus] = useState<{ message: string; tone: StatusTone }>({
    message: 'Chaque rendez-vous conserve ses propres notes et son propre PDF.',
    tone: 'default',
  });

  const preparedAppointment = useMemo(
    () => appointments.find((appointment) => appointment.id === preparedAppointmentId) ?? null,
    [appointments, preparedAppointmentId],
  );

  const todaysAppointments = useMemo(
    () => appointments.filter((appointment) => appointment.date === todayIso()),
    [appointments],
  );

  const refreshAppointments = async () => {
    if (!window.meetPrep?.listAppointments) {
      setAppointmentStatus({
        message: 'La couche SQLite n est pas disponible.',
        tone: 'error',
      });
      return;
    }

    const rows = await window.meetPrep.listAppointments();
    setAppointments(rows);
    setPreparedAppointmentId((currentPreparedId) => {
      if (currentPreparedId && rows.some((appointment) => appointment.id === currentPreparedId)) {
        return currentPreparedId;
      }

      return rows.find((appointment) => appointment.date === todayIso())?.id ?? rows[0]?.id ?? null;
    });
  };

  // Premier chargement: le renderer demande les rendez-vous a SQLite.
  useEffect(() => {
    void (async () => {
      try {
        await refreshAppointments();
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const isEditing = Boolean(editingAppointmentId);

  const saveAppointmentFromDraft = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!window.meetPrep?.saveAppointment) {
      setAppointmentStatus({ message: 'Le module SQLite est indisponible.', tone: 'error' });
      return;
    }

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
      message: isEditing ? 'Rendez-vous mis a jour.' : 'Nouveau rendez-vous ajoute.',
      tone: 'success',
    });

    if (!isEditing) {
      const createdAppointment = rows[0];
      if (createdAppointment) {
        setPreparedAppointmentId((currentPreparedId) => currentPreparedId ?? createdAppointment.id);
      }
    }
  };

  const startEditingAppointment = (appointmentId: string) => {
    const appointment = appointments.find((entry) => entry.id === appointmentId);

    if (!appointment) {
      return;
    }

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

  const deleteAppointment = async (appointmentId: string) => {
    if (!window.meetPrep?.deleteAppointment) {
      setAppointmentStatus({ message: 'Le module SQLite est indisponible.', tone: 'error' });
      return;
    }

    const rows = await window.meetPrep.deleteAppointment(appointmentId);
    setAppointments(rows);

    if (preparedAppointmentId === appointmentId) {
      setPreparedAppointmentId(rows.find((appointment) => appointment.date === todayIso())?.id ?? rows[0]?.id ?? null);
    }

    if (editingAppointmentId === appointmentId) {
      setEditingAppointmentId(null);
      setDraft(createEmptyDraft());
    }
  };

  const prepareAppointment = (appointmentId: string) => {
    setPreparedAppointmentId(appointmentId);
    setFormStatus({
      message: 'RDV charge pour prise de notes et preparation.',
      tone: 'success',
    });
  };

  const savePreparation = async (nextAppointment: Appointment, successMessage: string) => {
    if (!window.meetPrep?.savePreparation) {
      setFormStatus({ message: 'Le module SQLite est indisponible.', tone: 'error' });
      return;
    }

    const rows = await window.meetPrep.savePreparation({
      id: nextAppointment.id,
      goal: nextAppointment.fields.goal,
      notes: nextAppointment.fields.notes,
      preparationChecklist: nextAppointment.preparationChecklist,
    });

    setAppointments(rows);
    setFormStatus({ message: successMessage, tone: 'success' });
  };

  const savePreparationForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!preparedAppointment) {
      return;
    }

    await savePreparation(preparedAppointment, 'Preparation du rendez-vous enregistree.');
  };

  const updatePreparedAppointment = async (nextAppointment: Appointment, statusMessage: string) => {
    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) => (appointment.id === nextAppointment.id ? nextAppointment : appointment)),
    );
    await savePreparation(nextAppointment, statusMessage);
  };

  const exportSummary = async () => {
    if (!preparedAppointment) {
      setFormStatus({
        message: 'Selectionnez d abord un RDV du jour via "Preparer le RDV".',
        tone: 'error',
      });
      return;
    }

    if (!window.meetPrep?.exportPdf) {
      setFormStatus({
        message: 'L export PDF natif n est pas disponible.',
        tone: 'error',
      });
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
            <div class="card"><strong>Statut</strong><br />Notes et preparation enregistrees</div>
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
      const result = await window.meetPrep.exportPdf({
        filename,
        html: printableHtml,
      });

      if (!result.success) {
        setFormStatus({
          message: result.error || 'Impossible de generer le PDF.',
          tone: 'error',
        });
        return;
      }

      setFormStatus({
        message: `PDF enregistre dans ${result.filePath}.`,
        tone: 'success',
      });
    } catch (error) {
      setFormStatus({
        message: error instanceof Error ? error.message : 'Erreur inconnue pendant la generation du PDF.',
        tone: 'error',
      });
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_28%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 pt-14 pb-8 lg:px-10">
        <section className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <aside className="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">MeetPrep Assistant</p>
                <h1 className="mt-2 text-3xl font-semibold text-white">Rendez-vous</h1>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Le formulaire ci-dessous sert a creer ou modifier un RDV sans toucher a la zone
                  de preparation.
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
                <h2 className="text-lg font-semibold text-white">Mes rendez-vous</h2>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                  {appointments.length}
                </span>
              </div>
              <div className="space-y-3">
                {appointments.length ? (
                  appointments.map((appointment) => {
                    const isPrepared = appointment.id === preparedAppointmentId;

                    return (
                      <article
                        key={appointment.id}
                        className={`rounded-[1.5rem] border p-4 transition ${
                          isPrepared
                            ? 'border-cyan-400/60 bg-cyan-400/10'
                            : 'border-white/10 bg-slate-950/70'
                        }`}
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
                    );
                  })
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">
                    Aucun rendez-vous enregistre.
                  </div>
                )}
              </div>
            </div>
          </aside>

          <section className="grid gap-6">
            <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
              <div className="mb-8 flex flex-col gap-6">
                <div className="max-w-2xl">
                  <p className="mb-3 inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                    Preparation du rendez-vous
                  </p>
                  <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                    {preparedAppointment?.title || 'RDV a preparer'}
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                    La preparation ne change que lorsque vous choisissez un RDV du jour a preparer.
                  </p>
                  <p className="mt-4 text-sm font-medium text-slate-400">
                    {preparedAppointment ? appointmentLabel(preparedAppointment) : 'Aucun RDV selectionne'}
                  </p>
                </div>
              </div>

              <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <section className="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-orange-200/80">Aujourd hui</p>
                      <h3 className="mt-2 text-xl font-semibold text-white">RDV du jour</h3>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
                      {todaysAppointments.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {todaysAppointments.length ? (
                      todaysAppointments.map((appointment) => {
                        const isPrepared = appointment.id === preparedAppointmentId;

                        return (
                          <article
                            key={appointment.id}
                            className={`rounded-[1.5rem] border p-4 transition ${
                              isPrepared
                                ? 'border-cyan-400/60 bg-cyan-400/10'
                                : 'border-white/10 bg-slate-950/60'
                            }`}
                          >
                            <p className="text-sm font-semibold text-white">{appointment.title}</p>
                            <p className="mt-1 text-xs text-slate-400">
                              {appointment.time || 'Heure a definir'}
                            </p>
                            <p className="mt-3 text-xs text-slate-500">{appointmentSubtitle(appointment)}</p>
                            <button
                              type="button"
                              onClick={() => prepareAppointment(appointment.id)}
                              className="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
                            >
                              Preparer le RDV
                            </button>
                          </article>
                        );
                      })
                    ) : (
                      <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm leading-6 text-slate-400">
                        Aucun RDV prevu aujourd hui.
                      </div>
                    )}
                  </div>
                </section>

                {preparedAppointment ? (
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

                    <form className="grid gap-4" onSubmit={savePreparationForm}>
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
                                  void updatePreparedAppointment(
                                    nextAppointment,
                                    'Checklist de preparation mise a jour.',
                                  );
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
                            void updatePreparedAppointment(
                              nextAppointment,
                              'Brouillon du rendez-vous mis a jour automatiquement.',
                            );
                          }}
                          placeholder="Quel est le contexte et a quoi doit servir cette reunion ?"
                          className="w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
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
                            void updatePreparedAppointment(
                              nextAppointment,
                              'Brouillon du rendez-vous mis a jour automatiquement.',
                            );
                          }}
                          placeholder="Saisissez les points cles, objections, engagements et prochaines actions..."
                          className="min-h-[320px] w-full rounded-[1.75rem] border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"
                        />
                      </label>

                      <div className="flex flex-wrap items-center gap-3">
                        <button
                          type="submit"
                          className="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
                        >
                          Enregistrer la preparation
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void exportSummary();
                          }}
                          className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-orange-300/50 hover:bg-orange-400/10"
                        >
                          Generer le PDF du RDV
                        </button>
                        <span className={statusClassName(formStatus.tone)}>{formStatus.message}</span>
                      </div>
                    </form>
                  </div>
                ) : (
                  <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm leading-6 text-slate-400">
                    Selectionnez un RDV du jour puis cliquez sur "Preparer le RDV" pour afficher le
                    contexte, prendre des notes et generer le PDF.
                  </div>
                )}
              </section>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

const container = document.querySelector<HTMLDivElement>('#app');

if (!container) {
  throw new Error('App container not found');
}

createRoot(container).render(<App />);
