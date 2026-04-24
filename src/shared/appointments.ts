// Types partages entre le renderer React et le process main Electron.
// Cela permet de garder un modele de donnees coherent des deux cotes.

export type FormFields = {
  client: string;
  company: string;
  goal: string;
  notes: string;
};

export type PreparationItem = {
  id: string;
  label: string;
  checked: boolean;
};

export type Appointment = {
  id: string;
  title: string;
  date: string;
  time: string;
  fields: FormFields;
  preparationChecklist: PreparationItem[];
};

export type AppointmentDraft = {
  title: string;
  date: string;
  time: string;
  client: string;
  company: string;
};

export type AppointmentUpsert = {
  id?: string;
  title: string;
  date: string;
  time: string;
  client: string;
  company: string;
};

export type AppointmentPreparationUpdate = {
  id: string;
  goal: string;
  notes: string;
  preparationChecklist: PreparationItem[];
};

export const createPreparationChecklist = (): PreparationItem[] => [
  { id: 'approved-project', label: 'Projet approuve', checked: false },
  { id: 'received-mockup', label: 'Maquette recue', checked: false },
  { id: 'sent-contract', label: 'Contrat envoye', checked: false },
];

export const createEmptyFields = (): FormFields => ({
  client: '',
  company: '',
  goal: '',
  notes: '',
});

export const createEmptyDraft = (): AppointmentDraft => ({
  title: '',
  date: '',
  time: '',
  client: '',
  company: '',
});

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const createSeedAppointment = (): Appointment => ({
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

export const normalizeAppointment = (appointment: Partial<Appointment>): Appointment => ({
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

export const createAppointmentFromDraft = (draft: AppointmentDraft): Appointment => ({
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

export const appointmentLabel = (appointment: Appointment) => {
  const datePart = appointment.date || 'Date a definir';
  const timePart = appointment.time ? ` a ${appointment.time}` : '';
  return `${datePart}${timePart}`;
};

export const appointmentSubtitle = (appointment: Appointment) => {
  const client = appointment.fields.client || 'Client non renseigne';
  const company = appointment.fields.company ? ` • ${appointment.fields.company}` : '';
  return `${client}${company}`;
};
