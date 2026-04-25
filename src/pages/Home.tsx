import { FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Appointment,
  AppointmentDraft,
  appointmentLabel,
  appointmentSubtitle,
  createEmptyDraft,
  todayIso,
} from '../shared/appointments';
import { StatusTone, statusClassName } from '../shared/ui';

export default function Home({
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
