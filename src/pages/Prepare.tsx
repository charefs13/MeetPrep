import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Appointment, appointmentLabel } from '../shared/appointments';
import { StatusTone, statusClassName } from '../shared/ui';

export default function Prepare({ appointments, updatePreparedAppointment }: { appointments: Appointment[]; updatePreparedAppointment: (a: Appointment, msg: string) => Promise<void> }) {
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
