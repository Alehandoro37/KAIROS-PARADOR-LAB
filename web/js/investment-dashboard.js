/* KAIROS PARADOR — Operational Intelligence Layer V1 / investment-dashboard
 * CONCEPTUAL operational/commercial dashboard for the public Logos Parador landing.
 * Vanilla JS, no frameworks, no backend, no analytics, no payments. Reads the
 * conceptual business layer (data/business/*.json) and renders illustrative indices.
 *
 * ⚠️ ALL figures are CONCEPTUAL / ILLUSTRATIVE — NOT financial advice, NOT investment
 * solicitation, NOT measured data. Nothing here is a revenue or financial projection. */
(() => {
  const DATA = '../data/business/';
  const $ = (id) => document.getElementById(id);
  const LEVEL = (v) => (v >= 2.6 ? 'Alta' : v >= 1.8 ? 'Media' : 'Baja');
  const state = { model: null, phases: null, econ: null, active: new Set() };

  async function load() {
    try {
      const [model, phases, econ] = await Promise.all([
        fetch(DATA + 'operational-model.json').then(r => r.json()),
        fetch(DATA + 'phases.json').then(r => r.json()),
        fetch(DATA + 'experience-economy.json').then(r => r.json())
      ]);
      state.model = model; state.phases = phases; state.econ = econ;
      state.active = new Set(model.verticals.map(v => v.id));
      renderVerticals(); renderPhases(); renderPillars(); bindExport(); recompute();
    } catch (e) {
      const host = $('oiContent');
      if (host) host.innerHTML = `<p class="oi-note">No se pudo cargar la capa conceptual (${e.message}). ` +
        `Esta vista requiere el build externo (rutas relativas a <code>../data/business/</code>).</p>`;
    }
  }

  // ---- verticals (toggles) ---------------------------------------------------
  function renderVerticals() {
    const host = $('oiVerticals'); if (!host) return;
    host.innerHTML = state.model.verticals.map(v =>
      `<button class="oi-vert" data-id="${v.id}" aria-pressed="true">
         <span class="dot"></span>${v.label}
         <small>${v.visitorAppeal} · mix ${v.mixWeight}%</small>
       </button>`).join('');
    host.querySelectorAll('.oi-vert').forEach(b => b.addEventListener('click', () => {
      const id = b.dataset.id;
      if (state.active.has(id)) state.active.delete(id); else state.active.add(id);
      b.setAttribute('aria-pressed', state.active.has(id) ? 'true' : 'false');
      recompute();
    }));
  }

  // ---- conceptual indices ----------------------------------------------------
  function computeIndices() {
    const act = state.model.verticals.filter(v => state.active.has(v.id));
    if (!act.length) return { flow: 0, stay: 0, density: 0, level: '—', mix: 0 };
    const wsum = act.reduce((s, v) => s + v.mixWeight, 0) || 1;
    const flow = Math.round(act.reduce((s, v) => s + v.metrics.visitorFlow * v.mixWeight, 0) / wsum);
    const stay = act.reduce((s, v) => s + v.metrics.stayHours * v.mixWeight, 0) / wsum;
    const density = act.reduce((s, v) => s + v.metrics.experienceDensity, 0) / act.length;
    return { flow, stay: Math.round(stay * 10) / 10, density, level: LEVEL(density), mix: wsum };
  }
  function gauge(label, valueText, pct, hint) {
    return `<div class="oi-gauge"><div class="oi-grow"><b>${label}</b><span>${valueText}</span></div>
      <div class="oi-bar"><i style="width:${Math.max(3, Math.min(100, pct))}%"></i></div>
      <small>${hint}</small></div>`;
  }
  function recompute() {
    const host = $('oiIndices'); if (!host) return;
    const i = computeIndices();
    host.innerHTML =
      gauge('Visitor flow', `${i.flow} <em>/100 conceptual</em>`, i.flow, 'Afluencia relativa ilustrativa — no es un aforo.') +
      gauge('Stay duration', `~${i.stay} h <em>conceptual</em>`, Math.min(100, (i.stay / 12) * 100), 'Permanencia ilustrativa ponderada.') +
      gauge('Experience density', `${i.level} <em>conceptual</em>`, (i.density / 3) * 100, 'Riqueza de experiencias simultáneas.');
    renderCards();
  }

  // ---- opportunity cards -----------------------------------------------------
  function renderCards() {
    const host = $('oiCards'); if (!host) return;
    host.innerHTML = state.model.verticals.map(v => {
      const on = state.active.has(v.id);
      return `<article class="oi-card${on ? '' : ' off'}">
        <h4>${v.label}</h4>
        <p>${v.role}</p>
        <div class="oi-meta"><span>Appeal: <b>${v.visitorAppeal}</b></span><span>Mix: <b>${v.mixWeight}%</b></span></div>
      </article>`;
    }).join('');
  }

  // ---- phases timeline -------------------------------------------------------
  function renderPhases() {
    const host = $('oiPhases'); if (!host) return;
    host.innerHTML = state.phases.phases.map(p =>
      `<div class="oi-phase"><div class="oi-phead"><b>${p.label}</b><span>${p.state}</span></div>
         <div class="oi-bar"><i style="width:${p.progress}%"></i></div>
         <small>${p.scope.join(' · ')} — avance conceptual ${p.progress}%</small></div>`).join('');
  }

  // ---- experience-economy pillars -------------------------------------------
  function renderPillars() {
    const host = $('oiPillars'); if (!host) return;
    host.innerHTML = state.econ.pillars.map(p =>
      `<div class="oi-pill"><b>${p.label}</b><span>${p.essence}</span></div>`).join('');
  }

  // ---- export (conceptual JSON snapshot only; no PDF, no backend) ------------
  function bindExport() {
    const btn = $('oiExport'); if (!btn) return;
    btn.addEventListener('click', () => {
      const i = computeIndices();
      const snap = {
        schema: 'kairos.operational-snapshot/v1',
        status: 'CONCEPTUAL — ilustrativo. NO es asesoría financiera ni solicitud de inversión.',
        generatedAt: new Date().toISOString(),
        activeVerticals: [...state.active],
        conceptualIndices: { visitorFlow: i.flow, stayDurationHours: i.stay, experienceDensity: i.level },
        phases: state.phases.phases.map(p => ({ id: p.id, label: p.label, conceptualProgress: p.progress, state: p.state })),
        pillars: state.econ.pillars.map(p => p.id),
        disclaimer: 'Conceptual operational visualization — not financial advice or investment solicitation.',
        conceptual_only: true
      };
      const blob = new Blob([JSON.stringify(snap, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = 'logos-parador-operational-snapshot.json'; a.click();
      URL.revokeObjectURL(a.href);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
