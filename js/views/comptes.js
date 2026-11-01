/* js/views/comptes.js — Gestion des comptes et des rôles */

function renderComptes() {
  if (!canManageAccounts()) return '';
  if (state.userAccountsLoading) {
    return `<div class="page-head"><div><div class="eyebrow">Administration</div><h1 class="page-title">Comptes</h1></div></div><div class="card">Chargement des comptes…</div>`;
  }
  const accountRows = state.userAccounts.map(account => {
    const self = account.id === state.account.id;
    const assigned = new Set(account.scopeProgrammeIds || []);
    const scopeOptions = state.data.programmes.map(programme =>
      `<label class="account-program-option"><input type="checkbox" class="account-program" value="${escapeHtml(programme.id)}" ${assigned.has(programme.id) ? 'checked' : ''}>${escapeHtml(programme.nom)}</label>`
    ).join('');
    return `<form class="card account-row" data-account-id="${escapeHtml(account.id)}">
      <div class="account-row-head">
        <div>
          <strong>${escapeHtml(account.email || 'Adresse inconnue')}</strong>
          <div class="card-sub">${self ? 'Votre compte' : 'Compte utilisateur'}</div>
        </div>
        ${self ? '<span class="pill">Administrateur connecté</span>' : ''}
      </div>
      <div class="field"><label>Nom affiché sur les rapports</label><input class="account-name" type="text" value="${escapeHtml(account.name || '')}" ${self ? 'disabled' : ''}></div>
      <div class="account-access-fields">
        <div class="field"><label>Rôle</label>
          <select class="account-role" ${self ? 'disabled' : ''}>
            <option value="" ${!account.role ? 'selected' : ''}>En attente d’attribution</option>
            <option value="ca" ${account.role === 'ca' ? 'selected' : ''}>CA — accès complet</option>
            <option value="president" ${account.role === 'president' ? 'selected' : ''}>Président — consultation</option>
          </select>
        </div>
        <label class="account-admin-toggle"><input class="account-admin" type="checkbox" ${account.accountAdmin ? 'checked' : ''} ${self || account.role !== 'ca' ? 'disabled' : ''}> Gestionnaire des comptes</label>
      </div>
      <fieldset class="account-scope" ${account.role !== 'president' ? 'disabled' : ''}>
        <legend>Portée de consultation du président</legend>
        <label class="account-global-scope"><input class="account-global" type="checkbox" ${account.scopeGlobal ? 'checked' : ''}> Autoriser la portée globale (tous les programmes)</label>
        <div class="account-program-list">${scopeOptions || '<span>Aucun programme disponible.</span>'}</div>
      </fieldset>
      <button class="btn btn-primary btn-sm account-save" type="submit" ${self ? 'disabled' : ''}>Enregistrer les accès</button>
    </form>`;
  }).join('');
  const emptyMessage = state.accountManagementError
    ? `<div class="card" role="alert">${escapeHtml(state.accountManagementError)}</div>`
    : state.userAccountsLoaded && !state.userAccounts.length
      ? `<div class="card">Aucun compte trouvé. Les nouveaux utilisateurs doivent d’abord créer leur compte depuis l’écran de connexion.</div>`
      : '';
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Administration</div>
        <h1 class="page-title">Comptes et accès</h1>
        <p class="page-sub">Les nouveaux comptes créés par inscription restent bloqués jusqu’à l’attribution d’un rôle. Les présidents ne voient que la portée qui leur est attribuée.</p>
      </div>
      <button class="btn btn-ghost" id="refreshAccountsBtn">Actualiser</button>
    </div>
    ${emptyMessage}
    <div class="account-list">${accountRows}</div>
  `;
}

async function loadManagedAccounts() {
  if (!canManageAccounts() || !sb) return;
  state.userAccountsLoading = true;
  state.accountManagementError = '';
  render();
  const { data, error } = await sb.from('profiles')
    .select('id,email,name,role,account_admin,scope_global,scope_program_ids')
    .order('email');
  state.userAccountsLoading = false;
  if (error) {
    state.accountManagementError = 'Impossible de charger les comptes : ' + error.message;
    state.userAccountsLoaded = true;
    console.error('Carnet SGM — impossible de charger les comptes:', error);
    render();
    return;
  }
  state.userAccounts = (data || []).map(profile => ({
    id: profile.id,
    email: profile.email || '',
    name: profile.name || '',
    role: profile.role || null,
    accountAdmin: !!profile.account_admin,
    scopeGlobal: !!profile.scope_global,
    scopeProgrammeIds: Array.isArray(profile.scope_program_ids) ? profile.scope_program_ids : [],
  }));
  state.userAccountsLoaded = true;
  render();
}

function attachComptesEvents() {
  const refreshButton = document.getElementById('refreshAccountsBtn');
  if (refreshButton) refreshButton.addEventListener('click', loadManagedAccounts);
  if (!state.userAccountsLoaded && !state.userAccountsLoading) {
    loadManagedAccounts();
    return;
  }
  document.querySelectorAll('.account-row').forEach(form => form.addEventListener('submit', async event => {
    event.preventDefault();
    const account = state.userAccounts.find(item => item.id === form.dataset.accountId);
    if (!account || account.id === state.account.id) return;
    const role = form.querySelector('.account-role').value || null;
    const scopeGlobal = form.querySelector('.account-global').checked;
    const scopeProgrammeIds = Array.from(form.querySelectorAll('.account-program:checked')).map(input => input.value);
    if (role === 'president' && !scopeGlobal && !scopeProgrammeIds.length) {
      showToast('Attribuez au moins un programme ou activez la portée globale');
      return;
    }
    const saveButton = form.querySelector('.account-save');
    saveButton.disabled = true;
    try {
      const { error } = await sb.rpc('admin_update_account_access', {
        target_user_id: account.id,
        target_name: form.querySelector('.account-name').value.trim(),
        target_role: role,
        target_account_admin: role === 'ca' && form.querySelector('.account-admin').checked,
        target_scope_global: scopeGlobal,
        target_scope_program_ids: scopeProgrammeIds,
      });
      if (error) throw error;
      showToast('Accès utilisateur mis à jour');
      await loadManagedAccounts();
    } catch (error) {
      showToast('Impossible de modifier ce compte : ' + error.message);
      console.error('Carnet SGM — échec de mise à jour des accès:', error);
      saveButton.disabled = false;
    }
  }));
  document.querySelectorAll('.account-role').forEach(select => select.addEventListener('change', () => {
    const form = select.closest('.account-row');
    const scope = form.querySelector('.account-scope');
    scope.disabled = select.value !== 'president';
    const adminToggle = form.querySelector('.account-admin');
    adminToggle.disabled = select.value !== 'ca';
    if (select.value !== 'ca') adminToggle.checked = false;
  }));
  document.querySelectorAll('.account-global').forEach(toggle => toggle.addEventListener('change', () => {
    const options = toggle.closest('.account-scope').querySelectorAll('.account-program');
    options.forEach(option => { option.disabled = toggle.checked; });
  }));
}
