/* js/views/shell.js — Rendu racine, coque (sidebar/onglets) et routeur d’onglets */

/* ---------- render root ---------- */
function render() {
  const app = document.getElementById('app');
  if (!state.data) { app.innerHTML = ''; return; }
  if (sb && sbUser && (!state.account || !state.account.role)) {
    renderAccountAccessScreen(
      'Accès en attente',
      'Un administrateur CA doit attribuer un rôle à ce compte avant l’accès aux données.'
    );
    return;
  }
  if (!accountCanAccessTab(state.tab)) state.tab = 'dashboard';
  if (!state.data.profile.name) {
    if (isPresidentReadOnly()) {
      renderAccountAccessScreen(
        'Profil incomplet',
        'Un administrateur CA doit renseigner le nom de ce compte avant sa première consultation.'
      );
      return;
    }
    app.innerHTML = renderOnboarding();
    attachOnboarding();
    return;
  }

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
        ${accountCanAccessTab('dashboard') ? tabBtn('dashboard', ICONS.dashboard, 'Tableau de bord') : ''}
        ${accountCanAccessTab('pointage') ? tabBtn('pointage', ICONS.pointage, 'Pointage') : ''}
        ${accountCanAccessTab('membres') ? tabBtn('membres', ICONS.membres, 'Membres') : ''}
        ${accountCanAccessTab('rapports') ? tabBtn('rapports', ICONS.rapports, 'Rapports') : ''}
        ${accountCanAccessTab('supervision') ? tabBtn('supervision', ICONS.supervision, 'Supervision') : ''}
        ${accountCanAccessTab('bureau') ? tabBtn('bureau', ICONS.bureau, 'Bureau') : ''}
        ${canManageAccounts() ? tabBtn('comptes', ICONS.comptes, 'Comptes') : ''}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-org">${isPresidentReadOnly() ? 'Collège des présidents' : 'Commission Administrative'}</div>
        <div class="user-chip">
          <div class="avatar">${(state.data.profile.name || '?').trim()[0]?.toUpperCase() || '?'}</div>
          <div>
            <div class="user-name">${escapeHtml(state.data.profile.name)}</div>
            <div class="user-role">${state.account && state.account.role === 'president' ? 'Président — consultation' : 'Conseil d’Administration'}</div>
          </div>
          ${isPresidentReadOnly() ? '' : '<button class="edit-name-btn" id="editNameBtn">modifier</button>'}
        </div>
        <button class="edit-name-btn signOutBtn" id="signOutBtn" style="margin-top:8px;">${sb && sbUser ? 'se déconnecter' : 'se connecter'}</button>
      </div>
    </aside>
    <main>
      <div class="view" id="view">${renderTab()}</div>
    </main>
  `;
  if (state.renameModalOpen && !isPresidentReadOnly()) app.innerHTML += renderRenameModal();
  if (state.confirmModalOpen) app.innerHTML += renderConfirmModal();
  if (state.memberDetailId && accountCanAccessTab('membres')) app.innerHTML += renderMemberDetailModal();
  if (!isPresidentReadOnly() && state.completeInfoQueue && state.completeInfoQueue.length) app.innerHTML += renderCompleteInfoModal();
  if (state.bureauMemberDetailMembreId) app.innerHTML += renderBureauMemberDetailModal();
  attachShellEvents();
  attachTabEvents();
  if (state.renameModalOpen && !isPresidentReadOnly()) attachRenameModal();
  if (state.confirmModalOpen) attachConfirmModal();
  if (state.memberDetailId && accountCanAccessTab('membres')) attachMemberDetailModal();
  if (!isPresidentReadOnly() && state.completeInfoQueue && state.completeInfoQueue.length) attachCompleteInfoModal();
  if (state.bureauMemberDetailMembreId) attachBureauMemberDetailModal();
  if (isPresidentReadOnly()) applyReadOnlyUi();
}

function tabBtn(id, icon, label) {
  return `<button class="tab-btn ${state.tab === id ? 'active' : ''}" data-tab="${id}">${icon}<span>${label}</span></button>`;
}

function applyReadOnlyUi() {
  const allowedButtons = [
    '#genPdfBtn',
    '.bureau-subtab-btn',
    '#backToReunionsBtn',
    '.member-name-link',
    '#memberDetailCloseBtn',
    '#memberDetailCloseFixedBtn',
    '#resetMembreFilters',
    '#bureauMemberDetailCloseBtn',
    '#bureauMemberDetailCloseFixedBtn',
  ];
  document.querySelectorAll('main button').forEach(button => {
    if (!allowedButtons.some(selector => button.matches(selector))) button.hidden = true;
  });
  const allowedControls = [
    '#progSelect', '#sessionSelect', '#memberSearch',
    '#dashFilter', '#dashYearFilter', '#reportScope', '#reportSession', '#reportYear',
    '#watchlistProgramme', '#absenceThreshold', '#memberDetailYear', '#membreSearch',
    '#membreCategoryFilter', '#membreActivityFilter', '#membreTypeFilter',
    '#membreProgrammeFilter', '#membreSort',
    '#bureauMandatSelect', '#bureauReunionSearch',
    '#supervisionProgramme', '#supervisionYear', '#supervisionLieuA', '#supervisionLieuB',
  ];
  document.querySelectorAll('main input, main select, main textarea').forEach(control => {
    if (!allowedControls.some(selector => control.matches(selector))) {
      const label = control.closest('label');
      const field = control.closest('.field');
      if (label) label.hidden = true;
      else if (field) field.hidden = true;
      else control.hidden = true;
    }
  });
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
  if (!accountCanAccessTab(state.tab)) return '';
  if (state.tab === 'dashboard') return renderDashboard();
  if (state.tab === 'pointage') return renderPointage();
  if (state.tab === 'membres') return renderMembres();
  if (state.tab === 'rapports') return renderRapports();
  if (state.tab === 'supervision') return renderSupervision();
  if (state.tab === 'comptes' && canManageAccounts()) return renderComptes();
  if (state.tab === 'bureau') return renderBureau();
  return '';
}
function attachTabEvents() {
  if (!accountCanAccessTab(state.tab)) return;
  if (state.tab === 'dashboard') attachDashboardEvents();
  if (state.tab === 'pointage') attachPointageEvents();
  if (state.tab === 'membres') attachMembresEvents();
  if (state.tab === 'rapports') attachRapportsEvents();
  if (state.tab === 'supervision') attachSupervisionEvents();
  if (state.tab === 'comptes' && canManageAccounts()) attachComptesEvents();
  if (state.tab === 'bureau') attachBureauEvents();
}
