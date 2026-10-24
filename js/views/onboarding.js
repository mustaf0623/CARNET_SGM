/* js/views/onboarding.js — Écran de première utilisation (nom du signataire) */

/* ================= ONBOARDING ================= */
function renderOnboarding() {
  return `
  <div class="onboard-overlay">
    <div class="onboard-card">
      <div class="onboard-mark">${ICONS.mark}</div>
      <h2>Bienvenue dans Carnet SGM</h2>
      <p>Comment devons-nous vous appeler ? Ce nom apparaîtra comme signataire sur vos rapports générés. Vous pourrez le modifier à tout moment.</p>
      <input type="text" id="onboardName" placeholder="Votre nom complet" autofocus />
      <button class="btn btn-primary" id="onboardBtn" style="width:100%;justify-content:center;">Commencer</button>
    </div>
  </div>`;
}
function attachOnboarding() {
  const go = async () => {
    const v = document.getElementById('onboardName').value.trim();
    if (!v) { showToast('Merci de renseigner un nom'); return; }
    state.data.profile.name = v;
    await saveData();
    render();
  };
  document.getElementById('onboardBtn').addEventListener('click', go);
  document.getElementById('onboardName').addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
}
