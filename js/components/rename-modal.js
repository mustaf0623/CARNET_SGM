/* js/components/rename-modal.js — Changement du nom du signataire */

function renderRenameModal() {
  return `
  <div class="onboard-overlay" id="renameOverlay">
    <div class="onboard-card">
      <div class="onboard-mark">${ICONS.mark}</div>
      <h2>Changer le signataire</h2>
      <p>Ce nom apparaîtra sur les prochains rapports générés.</p>
      <input type="text" id="renameInput" placeholder="Nom complet" value="${escapeHtml(state.data.profile.name)}" autofocus />
      <button class="btn btn-primary" id="renameSaveBtn" style="width:100%;justify-content:center;margin-bottom:10px;">Enregistrer</button>
      <button class="btn btn-ghost" id="renameCancelBtn" style="width:100%;justify-content:center;">Annuler</button>
    </div>
  </div>`;
}
function attachRenameModal() {
  const save = async () => {
    const v = document.getElementById('renameInput').value.trim();
    if (!v) { showToast('Merci de renseigner un nom'); return; }
    state.data.profile.name = v;
    state.renameModalOpen = false;
    await saveData();
    render();
  };
  document.getElementById('renameSaveBtn').addEventListener('click', save);
  document.getElementById('renameInput').addEventListener('keydown', e => { if (e.key === 'Enter') save(); });
  document.getElementById('renameCancelBtn').addEventListener('click', () => { state.renameModalOpen = false; render(); });
  document.getElementById('renameOverlay').addEventListener('click', (e) => { if (e.target.id === 'renameOverlay') { state.renameModalOpen = false; render(); } });
}

function renameSignataire() {
  state.renameModalOpen = true;
  render();
}
