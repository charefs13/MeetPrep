import './index.css';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

// Le renderer est maintenant une vraie application React.
// L objectif de cette version est de rester pedagogique:
// on garde un seul fichier principal pour que la logique reste facile a suivre.

declare global {
  interface Window {
    meetPrep?: {
      exportPdf: (payload: { filename: string; html: string }) => Promise<{
        success: boolean;
        filePath?: string;
        error?: string;
      }>;
    };
  }
}

type FormFields = {
  client: string;
  company: string;
  goal: string;
  notes: string;
};

type PreparationItem = {
  id: string;
  label: string;
  checked: boolean;
};

type Appointment = {
  id: string;
  title: string;
  date: string;
  time: string;
  fields: FormFields;
  preparationChecklist: PreparationItem[];
};

type AppointmentDraft = {
  title: string;
  date: string;
  time: string;
  client: string;
  company: string;
};

type StoredState = {
  appointments: Appointment[];
  draft: AppointmentDraft;
  editingAppointmentId: string | null;
  preparedAppointmentId: string | null;
};

type StatusTone = 'default' | 'success' | 'error';

const storageKey = 'meetprep-appointments';

const createPreparationChecklist = (): PreparationItem[] => [
  { id: 'approved-project', label: 'Projet approuve', checked: false },
  { id: 'received-mockup', label: 'Maquette recue', checked: false },
  { id: 'sent-contract', label: 'Contrat envoye', checked: false },
];

const createEmptyFields = (): FormFields => ({
  client: '',
  company: '',
  goal: '',
  notes: '',
});

const createEmptyDraft = (): AppointmentDraft => ({
  title: '',
  date: '',
  time: '',
  client: '',
  company: '',
});

const todayIso = () => new Date().toISOString().slice(0, 10);

const createSeedAppointment = (): Appointment => ({
  id: crypto.randomUUID(),
  title: 'Point projet refonte portail voyageurs',
  date: todayIso(),
  time: '10:30',
  fields: {
    client: 'Mohamed Saadi',
    company: 'SNCF',
    goal:
      'Faire le point sur l avancement du portail, verifier les attendus fonctionnels et cadrer les prochaines validations.',
    notes:
      'Le client souhaite prioriser la stabilite du parcours mobile. Prevoir un suivi sur les retours utilisateurs et confirmer le calendrier de recette.',
  },
  preparationChecklist: [
    { id: 'approved-project', label: 'Projet approuve', checked: true },
    { id: 'received-mockup', label: 'Maquette recue', checked: true },
    { id: 'sent-contract', label: 'Contrat envoye', checked: false },
  ],
});

const createAppointmentFromDraft = (draft: AppointmentDraft): Appointment => ({
  id: crypto.randomUUID(),
  title: draft.title.trim() || 'Nouveau rendez-vous',
  date: draft.date,
  time: draft.time,
  fields: {
    ...createEmptyFields(),
    client: draft.client,
    company: draft.company,
  },
  preparationChecklist: createPreparationChecklist(),
});

// Cette normalisation permet de relire d anciens objets sauvegardes
// meme si la structure a evolue.
const normalizeAppointment = (appointment: Partial<Appointment>): Appointment => ({
  id: appointment.id ?? crypto.randomUUID(),
  title: appointment.title ?? 'Nouveau rendez-vous',
  date: appointment.date ?? '',
  time: appointment.time ?? '',
  fields: {
    client: appointment.fields?.client ?? '',
    company: appointment.fields?.company ?? '',
    goal: appointment.fields?.goal ?? '',
    notes: appointment.fields?.notes ?? '',
  },
  preparationChecklist: createPreparationChecklist().map((defaultItem) => {
    const existing = Array.isArray(appointment.preparationChecklist)
      ? appointment.preparationChecklist.find((item) => item.id === defaultItem.id)
      : undefined;

    return {
      ...defaultItem,
      checked: existing ? Boolean(existing.checked) : defaultItem.checked,
    };
  }),
});

const normalizeDraft = (draft?: Partial<AppointmentDraft>): AppointmentDraft => ({
  title: draft?.title ?? '',
  date: draft?.date ?? '',
  time: draft?.time ?? '',
  client: draft?.client ?? '',
  company: draft?.company ?? '',
});

const parseStoredState = (): StoredState => {
  const savedState = localStorage.getItem(storageKey);

  if (!savedState) {
    const seed = createSeedAppointment();
    return {
      appointments: [seed],
      draft: createEmptyDraft(),
      editingAppointmentId: null,
      preparedAppointmentId: seed.id,
    };
  }

  try {
    const parsed = JSON.parse(savedState) as Partial<StoredState>;
    const appointments = Array.isArray(parsed.appointments)
      ? parsed.appointments.map((appointment) => normalizeAppointment(appointment))
      : [];

    if (!appointments.length) {
      const seed = createSeedAppointment();
      return {
        appointments: [seed],
        draft: normalizeDraft(parsed.draft),
        editingAppointmentId: parsed.editingAppointmentId ?? null,
        preparedAppointmentId: seed.id,
      };
    }

    return {
      appointments,
      draft: normalizeDraft(parsed.draft),
      editingAppointmentId: parsed.editingAppointmentId ?? null,
      preparedAppointmentId: parsed.preparedAppointmentId ?? null,
    };
  } catch {
    const seed = createSeedAppointment();
    return {
      appointments: [seed],
      draft: createEmptyDraft(),
      editingAppointmentId: null,
      preparedAppointmentId: seed.id,
    };
  }
};

const appointmentLabel = (appointment: Appointment) => {
  const datePart = appointment.date || 'Date a definir';
  const timePart = appointment.time ? ` a ${appointment.time}` : '';
  return `${datePart}${timePart}`;
};

const appointmentSubtitle = (appointment: Appointment) => {
  const client = appointment.fields.client || 'Client non renseigne';
  const company = appointment.fields.company ? ` • ${appointment.fields.company}` : '';
  return `${client}${company}`;
};

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
  // Tout l etat de l application vit dans des hooks React.
  const initialState = useMemo(() => parseStoredState(), []);
  const [appointments, setAppointments] = useState<Appointment[]>(initialState.appointments);
  const [draft, setDraft] = useState<AppointmentDraft>(initialState.draft);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(initialState.editingAppointmentId);
  const [preparedAppointmentId, setPreparedAppointmentId] = useState<string | null>(initialState.preparedAppointmentId);
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

  // Toute modification importante est persistee localement.
  useEffect(() => {
    const nextState: StoredState = {
      appointments,
      draft,
      editingAppointmentId,
      preparedAppointmentId,
    };

    localStorage.setItem(storageKey, JSON.stringify(nextState));
  }, [appointments, draft, editingAppointmentId, preparedAppointmentId]);

  const isEditing = Boolean(editingAppointmentId);

  const saveAppointmentFromDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (editingAppointmentId) {
      setAppointments((currentAppointments) =>
        currentAppointments.map((appointment) =>
          appointment.id === editingAppointmentId
            ? {
                ...appointment,
                title: draft.title.trim() || 'Nouveau rendez-vous',
                date: draft.date,
                time: draft.time,
                fields: {
                  ...appointment.fields,
                  client: draft.client,
                  company: draft.company,
                },
              }
            : appointment,
        ),
      );
      setDraft(createEmptyDraft());
      setEditingAppointmentId(null);
      setAppointmentStatus({ message: 'Rendez-vous mis a jour.', tone: 'success' });
      return;
    }

    setAppointments((currentAppointments) => [createAppointmentFromDraft(draft), ...currentAppointments]);
    setDraft(createEmptyDraft());
    setAppointmentStatus({ message: 'Nouveau rendez-vous ajoute.', tone: 'success' });
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

  const deleteAppointment = (appointmentId: string) => {
    setAppointments((currentAppointments) =>
      currentAppointments.filter((appointment) => appointment.id !== appointmentId),
    );

    if (preparedAppointmentId === appointmentId) {
      setPreparedAppointmentId(null);
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

  const updatePreparedAppointment = (updater: (appointment: Appointment) => Appointment) => {
    if (!preparedAppointmentId) {
      return;
    }

    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.id === preparedAppointmentId ? updater(appointment) : appointment,
      ),
    );
  };

  const savePreparation = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormStatus({
      message: 'Preparation du rendez-vous enregistree.',
      tone: 'success',
    });
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
                  id="appointment-title"
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
                            onClick={() => deleteAppointment(appointment.id)}
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

                    <form className="grid gap-4" onSubmit={savePreparation}>
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
                                  updatePreparedAppointment((appointment) => ({
                                    ...appointment,
                                    preparationChecklist: appointment.preparationChecklist.map((entry) =>
                                      entry.id === item.id
                                        ? { ...entry, checked: event.target.checked }
                                        : entry,
                                    ),
                                  }));
                                  setFormStatus({
                                    message: 'Checklist de preparation mise a jour.',
                                    tone: 'success',
                                  });
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
                            updatePreparedAppointment((appointment) => ({
                              ...appointment,
                              fields: { ...appointment.fields, goal: event.target.value },
                            }));
                            setFormStatus({
                              message: 'Brouillon du rendez-vous mis a jour automatiquement.',
                              tone: 'default',
                            });
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
                            updatePreparedAppointment((appointment) => ({
                              ...appointment,
                              fields: { ...appointment.fields, notes: event.target.value },
                            }));
                            setFormStatus({
                              message: 'Brouillon du rendez-vous mis a jour automatiquement.',
                              tone: 'default',
                            });
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
                          id="export-button"
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

// React prend maintenant la main sur le rendu de toute l interface.
createRoot(container).render(<App />);
