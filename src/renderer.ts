import './index.css';

// Le renderer correspond a la partie "frontend" de l application Electron:
// il genere l interface, gere les interactions utilisateur
// et delegue les operations desktop au preload / process main.

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

type AppState = {
  appointments: Appointment[];
  draft: AppointmentDraft;
  editingAppointmentId: string | null;
  preparedAppointmentId: string | null;
};

// Toute l application persiste dans localStorage.
// Ici on reste volontairement simple pour montrer une app desktop Electron
// qui stocke ses donnees localement sans base distante.
const storageKey = 'meetprep-appointments';

// Checklist de preparation appliquee a chaque nouveau rendez-vous.
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

// Seed de demonstration injecte au premier lancement si aucun stockage n existe encore.
const createSeedAppointment = (): Appointment => ({
  id: crypto.randomUUID(),
  title: 'Point projet refonte portail voyageurs',
  date: todayIso(),
  time: '10:30',
  fields: {
    client: 'Mohamed Saadi',
    company: 'SNCF',
    goal: 'Faire le point sur l avancement du portail, verifier les attendus fonctionnels et cadrer les prochaines validations.',
    notes:
      'Le client souhaite prioriser la stabilite du parcours mobile. Prevoir un suivi sur les retours utilisateurs et confirmer le calendrier de recette.',
  },
  preparationChecklist: [
    { id: 'approved-project', label: 'Projet approuve', checked: true },
    { id: 'received-mockup', label: 'Maquette recue', checked: true },
    { id: 'sent-contract', label: 'Contrat envoye', checked: false },
  ],
});

// Transforme le brouillon du formulaire de gauche en vrai rendez-vous persiste.
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

// Normalise les donnees lues depuis localStorage pour rester compatible
// avec les evolutions de structure du projet.
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
  preparationChecklist: (() => {
    const defaults = createPreparationChecklist();
    const existing = Array.isArray(appointment.preparationChecklist) ? appointment.preparationChecklist : [];

    return defaults.map((defaultItem) => {
      const savedItem = existing.find((item) => item.id === defaultItem.id);

      return {
        ...defaultItem,
        checked: savedItem ? Boolean(savedItem.checked) : defaultItem.checked,
      };
    });
  })(),
});

const normalizeDraft = (draft: Partial<AppointmentDraft> | undefined): AppointmentDraft => ({
  title: draft?.title ?? '',
  date: draft?.date ?? '',
  time: draft?.time ?? '',
  client: draft?.client ?? '',
  company: draft?.company ?? '',
});

// Recharge l etat sauvegarde de l application.
const parseStoredState = (): AppState | null => {
  const savedState = localStorage.getItem(storageKey);

  if (!savedState) {
    return null;
  }

  try {
    const parsedState = JSON.parse(savedState) as Partial<AppState>;
    const appointments = Array.isArray(parsedState.appointments)
      ? parsedState.appointments.map((appointment) => normalizeAppointment(appointment))
      : [];

    return {
      appointments,
      draft: normalizeDraft(parsedState.draft),
      editingAppointmentId: parsedState.editingAppointmentId ?? null,
      preparedAppointmentId: parsedState.preparedAppointmentId ?? null,
    };
  } catch {
    return null;
  }
};

const parsedState = parseStoredState();
const initialSeedAppointment = createSeedAppointment();
const hasStoredAppointments = Boolean(parsedState?.appointments.length);
const initialAppointments = hasStoredAppointments ? parsedState?.appointments ?? [] : [initialSeedAppointment];

// Etat global unique du renderer.
// Toute l interface est rerendue a partir de cet objet.
const state: AppState = {
  appointments: initialAppointments,
  draft: parsedState?.draft ?? createEmptyDraft(),
  editingAppointmentId: parsedState?.editingAppointmentId ?? null,
  preparedAppointmentId: hasStoredAppointments
    ? parsedState?.preparedAppointmentId ?? null
    : initialSeedAppointment.id,
};

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('App container not found');
}

// Sauvegarde l etat courant a chaque action importante.
const persistState = () => {
  localStorage.setItem(storageKey, JSON.stringify(state));
};

// Petit helper pour injecter des valeurs utilisateur dans du HTML
// sans casser le rendu ni introduire de contenu interprete.
const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const todayIso = () => new Date().toISOString().slice(0, 10);

// Le rendez-vous actuellement ouvert dans la colonne de preparation.
const preparedAppointment = () =>
  state.appointments.find((appointment) => appointment.id === state.preparedAppointmentId) ?? null;

// Cette vue ne montre que les rendez-vous planifies aujourd hui.
const todaysAppointments = () => state.appointments.filter((appointment) => appointment.date === todayIso());

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

const renderAppointments = () =>
  state.appointments
    .map((appointment) => {
      const isPrepared = appointment.id === state.preparedAppointmentId;

      return `
        <article class="${isPrepared ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-slate-950/70'} rounded-[1.5rem] border p-4 transition">
          <div>
            <p class="text-sm font-semibold text-white">${escapeHtml(appointment.title || 'Rendez-vous sans titre')}</p>
            <p class="mt-1 text-xs text-slate-400">${escapeHtml(appointmentLabel(appointment))}</p>
            <p class="mt-2 text-xs text-slate-500">${escapeHtml(appointmentSubtitle(appointment))}</p>
          </div>

          <div class="mt-4 flex gap-2">
            <button type="button" data-appointment-edit="${appointment.id}" class="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/10">
              Modifier
            </button>
            <button type="button" data-appointment-delete="${appointment.id}" class="rounded-xl border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-xs font-medium text-rose-200 transition hover:bg-rose-400/20">
              Supprimer
            </button>
          </div>
        </article>
      `;
    })
    .join('');

// Colonne de droite: si aucun RDV n est selectionne pour preparation,
// on affiche un etat vide explicite.
const renderPreparationPanel = () => {
  const appointment = preparedAppointment();

  if (!appointment) {
    return `
      <div class="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-6 text-sm leading-6 text-slate-400">
        Selectionnez un RDV du jour puis cliquez sur "Preparer le RDV" pour afficher le contexte, prendre des notes et generer le PDF.
      </div>
    `;
  }

  return `
    <div class="grid gap-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div class="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur">
          <p class="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Client</p>
          <p class="mt-3 text-lg font-semibold text-white">${escapeHtml(appointment.fields.client || 'Non renseigne')}</p>
        </div>
        <div class="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur">
          <p class="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Entreprise</p>
          <p class="mt-3 text-lg font-semibold text-white">${escapeHtml(appointment.fields.company || 'Non renseignee')}</p>
        </div>
      </div>

      <form id="meeting-form" class="grid gap-4">
        <section class="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur">
          <div class="mb-4 flex items-center justify-between">
            <div>
              <p class="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Checklist</p>
              <h3 class="mt-2 text-lg font-semibold text-white">Preparation rapide</h3>
            </div>
          </div>
          <div class="space-y-3">
            ${appointment.preparationChecklist
              .map(
                (item) => `
                  <label class="flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
                    <input
                      type="checkbox"
                      data-preparation-check="${item.id}"
                      class="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"
                      ${item.checked ? 'checked' : ''}
                    />
                    <span>${escapeHtml(item.label)}</span>
                  </label>
                `,
              )
              .join('')}
          </div>
        </section>
        <label>
          <span class="mb-2 block text-sm font-medium text-slate-200">Contexte et objectif</span>
          <textarea id="goal" name="goal" rows="4" placeholder="Quel est le contexte et a quoi doit servir cette reunion ?" class="w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20">${escapeHtml(appointment.fields.goal)}</textarea>
        </label>
        <label>
          <span class="mb-2 block text-sm font-medium text-slate-200">Notes live</span>
          <textarea id="notes" name="notes" rows="14" placeholder="Saisissez les points cles, objections, engagements et prochaines actions..." class="min-h-[320px] w-full rounded-[1.75rem] border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20">${escapeHtml(appointment.fields.notes)}</textarea>
        </label>
        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
            Enregistrer la preparation
          </button>
          <button id="export-button" type="button" class="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:border-orange-300/50 hover:bg-orange-400/10">
            Generer le PDF du RDV
          </button>
          <span id="form-status" class="text-sm text-slate-400">Chaque rendez-vous conserve ses propres notes et son propre PDF.</span>
        </div>
      </form>
    </div>
  `;
};

// Carte listant les rendez-vous du jour avec l action "Preparer le RDV".
const renderTodayAppointments = () => {
  const appointments = todaysAppointments();

  if (!appointments.length) {
    return `
      <div class="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm leading-6 text-slate-400">
        Aucun RDV prevu aujourd hui.
      </div>
    `;
  }

  return appointments
    .map((appointment) => {
      const isPrepared = appointment.id === state.preparedAppointmentId;

      return `
        <article class="${isPrepared ? 'border-cyan-400/60 bg-cyan-400/10' : 'border-white/10 bg-slate-950/60'} rounded-[1.5rem] border p-4 transition">
          <p class="text-sm font-semibold text-white">${escapeHtml(appointment.title || 'Rendez-vous sans titre')}</p>
          <p class="mt-1 text-xs text-slate-400">${escapeHtml(appointment.time || 'Heure a definir')}</p>
          <p class="mt-3 text-xs text-slate-500">${escapeHtml(appointmentSubtitle(appointment))}</p>
          <button
            type="button"
            data-prepare-appointment="${appointment.id}"
            class="mt-4 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 transition hover:border-cyan-400/40 hover:bg-cyan-400/10"
          >
            Preparer le RDV
          </button>
        </article>
      `;
    })
    .join('');
};

// Point d entree du rendu UI.
// L interface complete est regeneree a partir de l etat courant.
const render = () => {
  const appointment = preparedAppointment();
  const todaysCount = todaysAppointments().length;
  const isEditing = Boolean(state.editingAppointmentId);
  const formTitle = isEditing ? 'Modifier le RDV' : 'Ajouter un RDV';
  const formButtonLabel = isEditing ? 'Enregistrer les modifications' : 'Ajouter un RDV';

  app.innerHTML = `
    <div class="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_28%)]"></div>
      <div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/10 to-transparent"></div>

      <main class="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-6 pt-14 pb-8 lg:px-10">
        <section class="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
          <aside class="rounded-[2rem] border border-white/10 bg-slate-900/70 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-xs uppercase tracking-[0.24em] text-cyan-200/80">MeetPrep Assistant</p>
                <h1 class="mt-2 text-3xl font-semibold text-white">Rendez-vous</h1>
                <p class="mt-3 text-sm leading-6 text-slate-300">
                  Le formulaire ci-dessous sert a creer ou modifier un RDV sans toucher a la zone de preparation.
                </p>
              </div>
            </div>

            <form id="appointment-form" class="mt-6 grid gap-4 sm:grid-cols-2">
              <div class="sm:col-span-2">
                <p class="text-sm font-semibold text-white">${formTitle}</p>
              </div>
              <label class="sm:col-span-2">
                <span class="mb-2 block text-sm font-medium text-slate-200">Titre</span>
                <input id="appointment-title" value="${escapeHtml(state.draft.title)}" placeholder="Titre du RDV" class="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20" />
              </label>
              <label>
                <span class="mb-2 block text-sm font-medium text-slate-200">Date</span>
                <input id="appointment-date" type="date" value="${escapeHtml(state.draft.date)}" class="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20" />
              </label>
              <label>
                <span class="mb-2 block text-sm font-medium text-slate-200">Heure</span>
                <input id="appointment-time" type="time" value="${escapeHtml(state.draft.time)}" class="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20" />
              </label>
              <label>
                <span class="mb-2 block text-sm font-medium text-slate-200">Nom du client</span>
                <input id="client" name="client" value="${escapeHtml(state.draft.client)}" placeholder="John Doe" class="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20" />
              </label>
              <label>
                <span class="mb-2 block text-sm font-medium text-slate-200">Entreprise</span>
                <input id="company" name="company" value="${escapeHtml(state.draft.company)}" placeholder="Nom de l'entreprise" class="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20" />
              </label>
              <div class="sm:col-span-2">
                <span id="appointment-status" class="text-sm text-slate-400">
                  ${isEditing ? 'Mode modification actif. Enregistrez pour mettre a jour ce RDV.' : 'Remplissez les champs puis ajoutez un nouveau rendez-vous.'}
                </span>
              </div>
              <div class="sm:col-span-2 mt-2 flex gap-3">
                <button id="save-appointment" type="submit" class="flex-1 rounded-2xl bg-cyan-400 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                  ${formButtonLabel}
                </button>
                ${
                  isEditing
                    ? `
                <button id="cancel-edit" type="button" class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10">
                  Annuler
                </button>
                `
                    : ''
                }
              </div>
            </form>

            <div class="mt-8">
              <div class="mb-4 flex items-center justify-between">
                <h2 class="text-lg font-semibold text-white">Mes rendez-vous</h2>
                <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">${state.appointments.length}</span>
              </div>
              <div class="space-y-3">
                ${state.appointments.length ? renderAppointments() : '<div class="rounded-[1.75rem] border border-dashed border-white/10 bg-slate-950/40 p-5 text-sm text-slate-400">Aucun rendez-vous enregistre.</div>'}
              </div>
            </div>
          </aside>

          <section class="grid gap-6">
            <div class="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl shadow-cyan-950/30 backdrop-blur">
              <div class="mb-8 flex flex-col gap-6">
                <div class="max-w-2xl">
                  <p class="mb-3 inline-flex w-fit items-center rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-cyan-200">
                    Preparation du rendez-vous
                  </p>
                  <h2 class="text-4xl font-semibold tracking-tight text-white sm:text-5xl">${escapeHtml(appointment?.title || 'RDV a preparer')}</h2>
                  <p class="mt-4 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
                    La preparation ne change que lorsque vous choisissez un RDV du jour a preparer.
                  </p>
                  <p class="mt-4 text-sm font-medium text-slate-400">${escapeHtml(appointment ? appointmentLabel(appointment) : 'Aucun RDV selectionne')}</p>
                </div>
              </div>

              <section class="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
                <section class="rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 shadow-xl shadow-slate-950/30">
                  <div class="mb-4 flex items-center justify-between">
                    <div>
                      <p class="text-xs uppercase tracking-[0.24em] text-orange-200/80">Aujourd hui</p>
                      <h3 class="mt-2 text-xl font-semibold text-white">RDV du jour</h3>
                    </div>
                    <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">${todaysCount}</span>
                  </div>
                  <div class="space-y-3">
                    ${renderTodayAppointments()}
                  </div>
                </section>

                ${renderPreparationPanel()}
              </section>
            </div>
          </section>
        </section>
      </main>
    </div>
  `;

  bindEvents();
};

// Helper visuel reutilise pour informer l utilisateur.
const setStatus = (selector: string, message: string, tone: 'default' | 'error' | 'success' = 'default') => {
  const status = document.querySelector<HTMLSpanElement>(selector);

  if (!status) {
    return;
  }

  status.textContent = message;
  status.className =
    tone === 'error'
      ? 'text-sm text-rose-300'
      : tone === 'success'
        ? 'text-sm text-emerald-300'
        : 'text-sm text-slate-400';
};

// Recopie le formulaire d ajout / edition dans le brouillon de l etat.
const syncDraftFromDom = () => {
  state.draft = {
    title: document.querySelector<HTMLInputElement>('#appointment-title')?.value ?? '',
    date: document.querySelector<HTMLInputElement>('#appointment-date')?.value ?? '',
    time: document.querySelector<HTMLInputElement>('#appointment-time')?.value ?? '',
    client: document.querySelector<HTMLInputElement>('#client')?.value ?? '',
    company: document.querySelector<HTMLInputElement>('#company')?.value ?? '',
  };
};

// Reinitialise le formulaire de gauche apres ajout ou annulation.
const resetDraft = () => {
  state.draft = createEmptyDraft();
  state.editingAppointmentId = null;
};

// Charge un rendez-vous existant dans le formulaire de gauche.
const startEditingAppointment = (appointmentId: string) => {
  const appointment = state.appointments.find((entry) => entry.id === appointmentId);

  if (!appointment) {
    return;
  }

  state.draft = {
    title: appointment.title,
    date: appointment.date,
    time: appointment.time,
    client: appointment.fields.client,
    company: appointment.fields.company,
  };
  state.editingAppointmentId = appointment.id;
  persistState();
  render();
  setStatus('#appointment-status', 'Le RDV est charge dans le formulaire de gauche.', 'success');
};

// Selon le contexte, ce submit cree un nouveau RDV ou modifie un RDV existant.
const saveAppointmentFromDraft = () => {
  syncDraftFromDom();

  if (state.editingAppointmentId) {
    const appointment = state.appointments.find((entry) => entry.id === state.editingAppointmentId);

    if (appointment) {
      appointment.title = state.draft.title.trim() || 'Nouveau rendez-vous';
      appointment.date = state.draft.date;
      appointment.time = state.draft.time;
      appointment.fields.client = state.draft.client;
      appointment.fields.company = state.draft.company;
    }

    resetDraft();
    persistState();
    render();
    setStatus('#appointment-status', 'Rendez-vous mis a jour.', 'success');
    return;
  }

  const appointment = createAppointmentFromDraft(state.draft);
  state.appointments.unshift(appointment);
  resetDraft();
  persistState();
  render();
  setStatus('#appointment-status', 'Nouveau rendez-vous ajoute.', 'success');
};

// La suppression nettoie aussi les references UI courantes
// si le RDV supprime etait en cours d edition ou de preparation.
const deleteAppointment = (appointmentId: string) => {
  state.appointments = state.appointments.filter((appointment) => appointment.id !== appointmentId);

  if (state.preparedAppointmentId === appointmentId) {
    state.preparedAppointmentId = null;
  }

  if (state.editingAppointmentId === appointmentId) {
    resetDraft();
  }

  persistState();
  render();
};

// Ouvre un rendez-vous dans la zone de preparation a droite.
const prepareAppointment = (appointmentId: string) => {
  state.preparedAppointmentId = appointmentId;
  persistState();
  render();
  setStatus('#form-status', 'RDV charge pour prise de notes et preparation.', 'success');
};

// La preparation se sauvegarde independamment du formulaire de gauche:
// contexte, notes et checklist sont propres au RDV prepare.
const savePreparationFromDom = () => {
  const appointment = preparedAppointment();

  if (!appointment) {
    return false;
  }

  appointment.fields.goal = document.querySelector<HTMLTextAreaElement>('#goal')?.value ?? '';
  appointment.fields.notes = document.querySelector<HTMLTextAreaElement>('#notes')?.value ?? '';
  const checks = Array.from(document.querySelectorAll<HTMLInputElement>('[data-preparation-check]'));
  for (const check of checks) {
    const item = appointment.preparationChecklist.find((entry) => entry.id === check.dataset.preparationCheck);

    if (item) {
      item.checked = check.checked;
    }
  }
  persistState();
  return true;
};

// Genere le HTML du compte-rendu puis demande au process main
// d en faire un vrai PDF sur le disque.
const exportSummary = async () => {
  const hasSaved = savePreparationFromDom();
  const appointment = preparedAppointment();

  if (!hasSaved || !appointment) {
    setStatus('#form-status', 'Selectionnez d abord un RDV du jour via "Preparer le RDV".', 'error');
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
        <h1>${escapeHtml(appointment.title || 'MeetPrep Assistant')}</h1>
        <p>Compte-rendu de rendez-vous client</p>
        <p><strong>Genere le :</strong> ${escapeHtml(generatedAt)}</p>
        <div class="meta">
          <div class="card"><strong>Date</strong><br />${escapeHtml(appointmentLabel(appointment))}</div>
          <div class="card"><strong>Client</strong><br />${escapeHtml(appointment.fields.client || 'Non renseigne')}</div>
          <div class="card"><strong>Entreprise</strong><br />${escapeHtml(appointment.fields.company || 'Non renseignee')}</div>
          <div class="card"><strong>Statut</strong><br />Notes et preparation enregistrees</div>
        </div>
        <div class="card">
          <h2>Checklist de preparation</h2>
          <ul>
            ${appointment.preparationChecklist
              .map((item) => `<li>${item.checked ? 'Oui' : 'Non'} - ${escapeHtml(item.label)}</li>`)
              .join('')}
          </ul>
        </div>
        <div class="card" style="margin-top: 16px;">
          <h2>Contexte et objectif</h2>
          <p>${escapeHtml(appointment.fields.goal || 'Non renseigne')}</p>
        </div>
        <div class="card" style="margin-top: 16px;">
          <h2>Notes live</h2>
          <p class="notes">${escapeHtml(appointment.fields.notes || 'Aucune note saisie.')}</p>
        </div>
      </body>
    </html>
  `;

  const safeTitle = (appointment.title || 'compte-rendu')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const filename = `${safeTitle || 'compte-rendu'}-${appointment.date || 'sans-date'}.pdf`;

  if (!window.meetPrep?.exportPdf) {
    setStatus('#form-status', 'L export PDF natif n est pas disponible.', 'error');
    return;
  }

  setStatus('#form-status', 'Generation du PDF en cours...');

  try {
    const result = await window.meetPrep.exportPdf({
      filename,
      html: printableHtml,
    });

    if (!result.success) {
      setStatus('#form-status', result.error || 'Impossible de generer le PDF.', 'error');
      return;
    }

    setStatus('#form-status', `PDF enregistre dans ${result.filePath}.`, 'success');
  } catch (error) {
    setStatus(
      '#form-status',
      error instanceof Error ? error.message : 'Erreur inconnue pendant la generation du PDF.',
      'error',
    );
  }
};

// Tous les listeners DOM sont rattaches apres chaque render.
// Comme l interface est regeneree, il faut rebinder les evenements a chaque fois.
function bindEvents() {
  const appointmentForm = document.querySelector<HTMLFormElement>('#appointment-form');
  const cancelEditButton = document.querySelector<HTMLButtonElement>('#cancel-edit');
  const draftInputs = Array.from(document.querySelectorAll<HTMLInputElement>('#appointment-title, #appointment-date, #appointment-time, #client, #company'));
  const appointmentEditButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-appointment-edit]'));
  const appointmentDeleteButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-appointment-delete]'));
  const prepareButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-prepare-appointment]'));
  const preparationForm = document.querySelector<HTMLFormElement>('#meeting-form');
  const preparationInputs = Array.from(document.querySelectorAll<HTMLTextAreaElement>('#goal, #notes'));
  const preparationChecks = Array.from(document.querySelectorAll<HTMLInputElement>('[data-preparation-check]'));
  const exportButton = document.querySelector<HTMLButtonElement>('#export-button');

  appointmentForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    saveAppointmentFromDraft();
  });

  cancelEditButton?.addEventListener('click', () => {
    resetDraft();
    persistState();
    render();
    setStatus('#appointment-status', 'Modification annulee. Le formulaire est reinitialise.', 'success');
  });

  for (const input of draftInputs) {
    input.addEventListener('input', () => {
      syncDraftFromDom();
      persistState();
    });
  }

  for (const button of appointmentEditButtons) {
    button.addEventListener('click', () => {
      const appointmentId = button.dataset.appointmentEdit;

      if (appointmentId) {
        startEditingAppointment(appointmentId);
      }
    });
  }

  for (const button of appointmentDeleteButtons) {
    button.addEventListener('click', () => {
      const appointmentId = button.dataset.appointmentDelete;

      if (appointmentId) {
        deleteAppointment(appointmentId);
      }
    });
  }

  for (const button of prepareButtons) {
    button.addEventListener('click', () => {
      const appointmentId = button.dataset.prepareAppointment;

      if (appointmentId) {
        prepareAppointment(appointmentId);
      }
    });
  }

  preparationForm?.addEventListener('submit', (event) => {
    event.preventDefault();

    if (!savePreparationFromDom()) {
      return;
    }

    setStatus('#form-status', 'Preparation du rendez-vous enregistree.', 'success');
  });

  for (const input of preparationInputs) {
    input.addEventListener('input', () => {
      if (!savePreparationFromDom()) {
        return;
      }

      setStatus('#form-status', 'Brouillon du rendez-vous mis a jour automatiquement.');
    });
  }

  for (const check of preparationChecks) {
    check.addEventListener('change', () => {
      if (!savePreparationFromDom()) {
        return;
      }

      setStatus('#form-status', 'Checklist de preparation mise a jour.');
    });
  }

  exportButton?.addEventListener('click', exportSummary);
}

// Premier chargement de l application.
persistState();
render();
