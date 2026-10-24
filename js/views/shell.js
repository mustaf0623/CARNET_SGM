/* js/views/shell.js — Rendu racine, coque (sidebar/onglets) et routeur d’onglets */

/* ---------- render root ---------- */
function render() {
  const app = document.getElementById('app');
  if (!state.data) { app.innerHTML = ''; return; }
  if (!state.data.profile.name) { app.innerHTML = renderOnboarding(); attachOnboarding(); return; }

  app.innerHTML = `
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">${ICONS.mark}</div>
        <div>
          <div class="brand-name">Carnet SGM</div>
          <div class="brand-sub">Registre de présence</div>
        </div>
      </div>
      <nav class="tabs">
        ${tabBtn('dashboard', ICONS.dashboard, 'Tableau de bord')}
        ${tabBtn('pointage', ICONS.pointage, 'Pointage')}
        ${tabBtn('membres', ICONS.membres, 'Membres')}
        ${tabBtn('rapports', ICONS.rapports, 'Rapports')}
        ${tabBtn('bureau', ICONS.bureau, 'Bureau')}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-org">Commission Administrative</div>
        <div class="user-chip">
          <div class="avatar">${(state.data.profile.name || '?').trim()[0]?.toUpperCase() || '?'}</div>
          <div>
            <div class="user-name">${escapeHtml(state.data.profile.name)}</div>
            <div class="user-role">Signataire des rapports</div>
          </div>
          <button class="edit-name-btn" id="editNameBtn">modifier</button>
        </div>
        <button class="edit-name-btn signOutBtn" id="signOutBtn" style="margin-top:8px;">${sb && sbUser ? 'se déconnecter' : 'se connecter'}</button>
      </div>
    </aside>
    <main><div class="view" id="view">${renderTab()}</div></main>
  `;
  if (state.renameModalOpen) app.innerHTML += renderRenameModal();
  if (state.confirmModalOpen) app.innerHTML += renderConfirmModal();
  if (state.memberDetailId) app.innerHTML += renderMemberDetailModal();
  if (state.completeInfoQueue && state.completeInfoQueue.length) app.innerHTML += renderCompleteInfoModal();
  if (state.bureauMemberDetailMembreId) app.innerHTML += renderBureauMemberDetailModal();
  attachShellEvents();
  attachTabEvents();
  if (state.renameModalOpen) attachRenameModal();
  if (state.confirmModalOpen) attachConfirmModal();
  if (state.memberDetailId) attachMemberDetailModal();
  if (state.completeInfoQueue && state.completeInfoQueue.length) attachCompleteInfoModal();
  if (state.bureauMemberDetailMembreId) attachBureauMemberDetailModal();
}

function tabBtn(id, icon, label) {
  return `<button class="tab-btn ${state.tab === id ? 'active' : ''}" data-tab="${id}">${icon}<span>${label}</span></button>`;
}

function attachShellEvents() {
  document.querySelectorAll('nav.tabs .tab-btn').forEach(b => b.addEventListener('click', () => {
    state.tab = b.dataset.tab;
    if (state.tab === 'pointage' && !state.pointageProgId && state.data.programmes[0]) state.pointageProgId = state.data.programmes[0].id;
    render();
  }));
  const editBtn = document.getElementById('editNameBtn');
  if (editBtn) editBtn.addEventListener('click', renameSignataire);
  const signOutBtn = document.getElementById('signOutBtn');
  if (signOutBtn) signOutBtn.addEventListener('click', () => {
    if (sb && sbUser) {
      signOutSupabase();
    } else {
      renderAuthScreen();
    }
  });
}

/* ================= TAB ROUTER ================= */
function renderTab() {
  if (state.tab === 'dashboard') return renderDashboard();
  if (state.tab === 'pointage') return renderPointage();
  if (state.tab === 'membres') return renderMembres();
  if (state.tab === 'rapports') return renderRapports();
  if (state.tab === 'bureau') return renderBureau();
  return '';
}
function attachTabEvents() {
  if (state.tab === 'dashboard') attachDashboardEvents();
  if (state.tab === 'pointage') attachPointageEvents();
  if (state.tab === 'membres') attachMembresEvents();
  if (state.tab === 'rapports') attachRapportsEvents();
  if (state.tab === 'bureau') attachBureauEvents();
}
