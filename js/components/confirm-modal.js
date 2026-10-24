/* js/components/confirm-modal.js — Fenêtre de confirmation personnalisée (remplace confirm()) */

let pendingConfirmAction = null;

function openConfirm(title, message, action, confirmLabel) {
  pendingConfirmAction = action;
  state.confirmTitle = title;
  state.confirmMessage = message;
  state.confirmLabel = confirmLabel || 'Supprimer';
  state.confirmModalOpen = true;
  render();
}
function renderConfirmModal() {
  return `
  <div class="onboard-overlay" id="confirmOverlay">
    <div class="onboard-card">
      <div class="onboard-mark" style="background:linear-gradient(155deg, var(--terracotta), var(--terracotta-dim));box-shadow:0 10px 24px -8px rgba(225,95,30,0.5);">
        <svg viewBox="0 0 24 24" fill="none" stroke="#FFF5EE" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v13a1 1 0 01-1 1H8a1 1 0 01-1-1V7h10z"/></svg>
      </div>
      <h2>${escapeHtml(state.confirmTitle)}</h2>
      <p>${escapeHtml(state.confirmMessage)}</p>
      <button class="btn" id="confirmYesBtn" style="width:100%;justify-content:center;margin-bottom:10px;background:var(--terracotta);border-color:transparent;color:#fff;">${escapeHtml(state.confirmLabel)}</button>
      <button class="btn btn-ghost" id="confirmNoBtn" style="width:100%;justify-content:center;">Annuler</button>
    </div>
  </div>`;
}
function attachConfirmModal() {
  document.getElementById('confirmYesBtn').addEventListener('click', () => {
    const action = pendingConfirmAction;
    state.confirmModalOpen = false;
    pendingConfirmAction = null;
    if (action) action();
  });
  document.getElementById('confirmNoBtn').addEventListener('click', () => { state.confirmModalOpen = false; pendingConfirmAction = null; render(); });
  document.getElementById('confirmOverlay').addEventListener('click', (e) => { if (e.target.id === 'confirmOverlay') { state.confirmModalOpen = false; pendingConfirmAction = null; render(); } });
}
