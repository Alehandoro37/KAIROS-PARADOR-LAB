/* KAIROS PARADOR LAB — landing
   1) Scrollspy: marca la "estación" activa en el riel.
   2) Costs: carga la estructura desde /data/costs.json (sin inventar valores). */

(function () {
  // ---------- scrollspy ----------
  const links = Array.from(document.querySelectorAll('.rail nav a'));
  const sections = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const byId = new Map(links.map(a => [a.getAttribute('href').slice(1), a]));
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          links.forEach(a => a.classList.remove('active'));
          const link = byId.get(e.target.id);
          if (link) link.classList.add('active');
        }
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    sections.forEach(s => obs.observe(s));
  }

  // ---------- costs ----------
  const tbody = document.querySelector('#costsTable tbody');
  if (!tbody) return;

  const fmt = v =>
    v === null || v === undefined
      ? '<span class="pend">pendiente de cotización</span>'
      : Number(v).toLocaleString('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

  fetch('../data/costs.json')
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(data => {
      tbody.innerHTML = '';
      (data.phases || []).forEach(phase => {
        (phase.items || []).forEach((item, i) => {
          const tr = document.createElement('tr');
          tr.innerHTML =
            `<td>${i === 0 ? phase.id : ''}</td>` +
            `<td>${item.label}</td>` +
            `<td class="num">${fmt(item.value_cop)}</td>`;
          tbody.appendChild(tr);
        });
      });
      if (!tbody.children.length) {
        tbody.innerHTML = '<tr><td colspan="3" class="pend">Sin capítulos definidos en costs.json</td></tr>';
      }
    })
    .catch(() => {
      tbody.innerHTML =
        '<tr><td colspan="3" class="pend" style="font-family:var(--body)">' +
        'No se pudo cargar /data/costs.json. Si abriste el archivo directamente, ' +
        'usa un servidor local (python3 -m http.server) o GitHub Pages.</td></tr>';
    });
})();
