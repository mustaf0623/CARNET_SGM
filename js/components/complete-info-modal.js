/* js/components/complete-info-modal.js — Invitation à compléter les infos d’un membre promu */

// Après une promotion AP → permanent, on propose de compléter les infos du
// membre pour qu'il soit en phase avec la base importée (mêmes champs que
// les autres membres permanents). Traité un membre à la fois (file d'attente).
function renderCompleteInfoModal() {
  const d = state.data;
  const id = state.completeInfoQueue[0];
  const m = d.membres.find(x => x.id === id);
  if (!m) { state.completeInfoQueue.shift(); return ''; }
  const keys = extraFieldKeys(d).filter(k => k !== 'Contact');
  return `
  <div class="onboard-overlay" id="completeInfoOverlay">
    <div class="onboard-card" style="width:min(440px, 92vw);text-align:left;">
      <h2 style="margin:0 0 4px;">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</h2>
      <p style="margin:0 0 16px;font-size:13px;color:var(--ink-faint);">Intégré(e) définitivement à la base des membres permanents. Complétez ses informations pour qu’elles soient en phase avec le reste de la base.</p>
      <div class="extra-info-grid" style="margin-bottom:6px;">
        ${keys.length ? keys.map(k => `<div class="extra-info-item"><label>${escapeHtml(k)}</label><div class="extra-info-row"><input type="text" class="completeInfoInput" data-key="${escapeHtml(k)}" value="${escapeHtml(m.extra && m.extra[k] || '')}"></div></div>`).join('')
        : `<div style="font-size:12.5px;color:var(--ink-faint);grid-column:1/-1;">Aucun champ complémentaire détecté dans la base pour l’instant.</div>`}
      </div>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn btn-primary" id="completeInfoSaveBtn" style="flex:1;justify-content:center;">Enregistrer</button>
        <button class="btn btn-ghost" id="completeInfoSkipBtn" style="flex:1;justify-content:center;">Plus tard</button>
      </div>
    </div>
  </div>`;
}
function attachCompleteInfoModal() {
  const id = state.completeInfoQueue[0];
  const advance = () => { state.completeInfoQueue.shift(); render(); };
  const save = document.getElementById('completeInfoSaveBtn');
  if (save) save.addEventListener('click', async () => {
    const m = state.data.membres.find(x => x.id === id);
    if (m) {
      m.extra = m.extra || {};
      document.querySelectorAll('.completeInfoInput').forEach(inp => {
        const v = inp.value.trim();
        if (v) m.extra[inp.dataset.key] = v;
      });
      await saveData();
    }
    advance();
  });
  const skip = document.getElementById('completeInfoSkipBtn');
  if (skip) skip.addEventListener('click', advance);
}
