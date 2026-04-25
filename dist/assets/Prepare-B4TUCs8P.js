import{d as g,u as b,r as f,j as e,a as p}from"./index-B2Wsb4Wr.js";import{s as j}from"./ui-CFu_D7kC.js";function y({appointments:x,updatePreparedAppointment:l}){const{id:h}=g(),o=b(),t=x.find(s=>s.id===h),[c,n]=f.useState({message:"Les modifications sont automatiquement enregistrees.",tone:"default"}),u=async()=>{var m;if(!t)return;if(!((m=window.meetPrep)!=null&&m.exportPdf)){n({message:"L export PDF natif n est pas disponible.",tone:"error"});return}const s=new Date().toLocaleString("fr-FR",{dateStyle:"long",timeStyle:"short"}),a=`
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
          <h1>${t.title}</h1>
          <p>Compte-rendu de rendez-vous client</p>
          <p><strong>Genere le :</strong> ${s}</p>
          <div class="meta">
            <div class="card"><strong>Date</strong><br />${p(t)}</div>
            <div class="card"><strong>Client</strong><br />${t.fields.client||"Non renseigne"}</div>
            <div class="card"><strong>Entreprise</strong><br />${t.fields.company||"Non renseignee"}</div>
          </div>
          <div class="card">
            <h2>Checklist de preparation</h2>
            <ul>
              ${t.preparationChecklist.map(r=>`<li>${r.checked?"Oui":"Non"} - ${r.label}</li>`).join("")}
            </ul>
          </div>
          <div class="card" style="margin-top: 16px;">
            <h2>Contexte et objectif</h2>
            <p>${t.fields.goal||"Non renseigne"}</p>
          </div>
          <div class="card" style="margin-top: 16px;">
            <h2>Notes live</h2>
            <p class="notes">${t.fields.notes||"Aucune note saisie."}</p>
          </div>
        </body>
      </html>
    `,i=`${(t.title||"compte-rendu").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-+|-+$/g,"")||"compte-rendu"}-${t.date||"sans-date"}.pdf`;n({message:"Generation du PDF en cours...",tone:"default"});try{const r=await window.meetPrep.exportPdf({filename:i,html:a});if(!r.success){n({message:r.error||"Impossible de generer le PDF.",tone:"error"});return}n({message:`PDF enregistre dans ${r.filePath}.`,tone:"success"})}catch(r){n({message:r instanceof Error?r.message:"Erreur inconnue",tone:"error"})}};return t?e.jsxs("div",{className:"relative min-h-screen overflow-hidden bg-slate-950 text-slate-100",children:[e.jsx("div",{className:"pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(249,115,22,0.16),_transparent_28%)]"}),e.jsxs("main",{className:"relative mx-auto flex min-h-screen max-w-4xl flex-col gap-8 px-6 pt-14 pb-8",children:[e.jsxs("div",{className:"flex items-center gap-4",children:[e.jsx("button",{onClick:()=>o("/"),className:"flex items-center justify-center rounded-full bg-white/10 p-2 text-white hover:bg-white/20 transition",title:"Retour à la liste",children:e.jsxs("svg",{width:"24",height:"24",viewBox:"0 0 24 24",fill:"none",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round",strokeLinejoin:"round",children:[e.jsx("line",{x1:"19",y1:"12",x2:"5",y2:"12"}),e.jsx("polyline",{points:"12 19 5 12 12 5"})]})}),e.jsxs("div",{children:[e.jsx("p",{className:"text-xs uppercase tracking-[0.24em] text-cyan-200/80",children:"Preparation du rendez-vous"}),e.jsx("h2",{className:"mt-1 text-3xl font-semibold tracking-tight text-white",children:t.title}),e.jsx("p",{className:"mt-1 text-sm font-medium text-slate-400",children:p(t)})]})]}),e.jsx("div",{className:"rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-2xl backdrop-blur",children:e.jsxs("div",{className:"grid gap-4",children:[e.jsxs("div",{className:"grid gap-4 sm:grid-cols-2",children:[e.jsxs("div",{className:"rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur",children:[e.jsx("p",{className:"text-xs uppercase tracking-[0.24em] text-cyan-200/80",children:"Client"}),e.jsx("p",{className:"mt-3 text-lg font-semibold text-white",children:t.fields.client||"Non renseigne"})]}),e.jsxs("div",{className:"rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur",children:[e.jsx("p",{className:"text-xs uppercase tracking-[0.24em] text-cyan-200/80",children:"Entreprise"}),e.jsx("p",{className:"mt-3 text-lg font-semibold text-white",children:t.fields.company||"Non renseignee"})]})]}),e.jsxs("form",{className:"grid gap-4",onSubmit:s=>s.preventDefault(),children:[e.jsxs("section",{className:"rounded-[1.75rem] border border-white/10 bg-slate-900/70 p-5 backdrop-blur",children:[e.jsx("div",{className:"mb-4 flex items-center justify-between",children:e.jsxs("div",{children:[e.jsx("p",{className:"text-xs uppercase tracking-[0.24em] text-cyan-200/80",children:"Checklist"}),e.jsx("h3",{className:"mt-2 text-lg font-semibold text-white",children:"Preparation rapide"})]})}),e.jsx("div",{className:"space-y-3",children:t.preparationChecklist.map(s=>e.jsxs("label",{className:"flex items-start gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200",children:[e.jsx("input",{type:"checkbox",checked:s.checked,onChange:a=>{const d={...t,preparationChecklist:t.preparationChecklist.map(i=>i.id===s.id?{...i,checked:a.target.checked}:i)};l(d,"Checklist mise a jour.")},className:"mt-1 h-4 w-4 rounded border-slate-600 bg-slate-950 text-cyan-400 focus:ring-cyan-400"}),e.jsx("span",{children:s.label})]},s.id))})]}),e.jsxs("label",{children:[e.jsx("span",{className:"mb-2 block text-sm font-medium text-slate-200",children:"Contexte et objectif"}),e.jsx("textarea",{rows:4,value:t.fields.goal,onChange:s=>{const a={...t,fields:{...t.fields,goal:s.target.value}};l(a,"Contexte mis a jour.")},placeholder:"Quel est le contexte et a quoi doit servir cette reunion ?",className:"w-full rounded-3xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"})]}),e.jsxs("label",{children:[e.jsx("span",{className:"mb-2 block text-sm font-medium text-slate-200",children:"Notes live"}),e.jsx("textarea",{rows:14,value:t.fields.notes,onChange:s=>{const a={...t,fields:{...t.fields,notes:s.target.value}};l(a,"Notes mises a jour.")},placeholder:"Saisissez les points cles, objections, engagements...",className:"min-h-[320px] w-full rounded-[1.75rem] border border-white/10 bg-slate-950/80 px-4 py-4 text-sm leading-6 text-white outline-none transition focus:border-cyan-400/70 focus:ring-2 focus:ring-cyan-400/20"})]}),e.jsxs("div",{className:"flex flex-wrap items-center gap-3",children:[e.jsx("button",{type:"button",onClick:()=>u(),className:"inline-flex items-center justify-center rounded-2xl bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300",children:"Generer le PDF du RDV"}),e.jsx("span",{className:j(c.tone),children:c.message})]})]})]})})]})]}):e.jsxs("div",{className:"flex min-h-screen flex-col items-center justify-center bg-slate-950 text-slate-200",children:[e.jsx("p",{className:"mb-4",children:"Ce rendez-vous n'existe pas ou a été supprimé."}),e.jsx("button",{onClick:()=>o("/"),className:"rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm",children:"Retour à l'accueil"})]})}export{y as default};
