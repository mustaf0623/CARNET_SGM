/* js/components/member-detail-modal.js — Fiche détaillée d’un membre */

function renderMemberDetailModal() {
  const d = state.data;
  const m = d.membres.find(x => x.id === state.memberDetailId);
  if (!m) return '';
  const yearFilter = state.dashYearFilter || 'toutes';
  const years = getAvailableYears(d);
  const yearOptions = [`<option value="toutes" ${yearFilter === 'toutes' ? 'selected' : ''}>Toutes années</option>`].concat(
    years.map(y => `<option value="${y}" ${yearFilter === y ? 'selected' : ''}>${y}</option>`)
  ).join('');
  const stats = memberStats(d, m.id, yearFilter);
  const categories = ['Homme', 'Femme', 'Cadet', 'Cadette', 'Père', 'Mère'];
  if (m.categorie && !categories.includes(m.categorie)) categories.push(m.categorie);
  return `
  <div class="onboard-overlay" id="memberDetailOverlay">
    <button id="memberDetailCloseFixedBtn" title="Fermer" style="position:fixed;top:16px;right:16px;z-index:200;width:36px;height:36px;border-radius:50%;border:1px solid rgba(237,241,229,0.3);background:rgba(18,35,24,0.75);backdrop-filter:blur(4px);color:#fff;font-size:18px;line-height:1;cursor:pointer;">×</button>
    <div class="onboard-card" style="width:min(480px, 92vw);text-align:left;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        <div class="avatar" style="width:44px;height:44px;font-size:16px;">${initials(m.nom, m.prenom)}</div>
        <div>
          <h2 style="margin:0;">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</h2>
          <div style="font-size:12.5px;color:var(--ink-faint);">${m.sexe === 'H' ? 'Homme' : 'Femme'}${m.categorie ? ' · Catégorie : ' + escapeHtml(m.categorie) : ''}${m.allProgrammes ? ' · Tous les programmes' : ''}</div>
        </div>
        <select id="memberDetailYear" style="margin-left:auto;min-width:130px;">${yearOptions}</select>
      </div>
      <div class="field" style="display:flex;align-items:end;gap:8px;margin:12px 0;">
        <div style="flex:1;">
          <label for="memberDetailCategory">Catégorie du membre</label>
          <select id="memberDetailCategory" style="width:100%;">
            <option value="" ${!m.categorie ? 'selected' : ''}>Non définie</option>
            ${categories.map(category => `<option value="${escapeHtml(category)}" ${category === m.categorie ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary btn-sm" id="memberDetailCategorySaveBtn" type="button">Enregistrer</button>
      </div>
      <div class="grid grid-4" style="margin:16px 0;gap:10px;">
        ${statCard('Séances', stats.overall.total, 'pointées', 'stat-gold')}
        ${statCard('Présences', stats.overall.present, '', 'stat-emerald')}
        ${statCard('Absences', stats.overall.absent, '', 'stat-terracotta')}
        ${statCard('Taux', stats.overall.tauxPresence + '%', 'présence globale', 'stat-emerald')}
      </div>
      <div class="card-title" style="font-size:14px;margin-bottom:8px;">Détail par programme</div>
      <div class="ledger" style="max-height:260px;overflow-y:auto;">
        ${stats.parProgramme.length ? stats.parProgramme.map(s => `
          <div class="ledger-row">
            <div class="prog-name">${escapeHtml(s.nom)}</div>
            <div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:${s.tauxPresence}%"></div></div>
            <div class="prog-pct">${s.tauxPresence}%</div>
          </div>
          <div style="font-size:11.5px;color:var(--ink-faint);margin:-8px 0 4px 0;padding-left:2px;">${s.present} présence${s.present > 1 ? 's' : ''} · ${s.absent} absence${s.absent > 1 ? 's' : ''} · ${s.nbSeancesProgramme} séance${s.nbSeancesProgramme > 1 ? 's' : ''} au programme</div>
        `).join('') : emptyRow('Aucun programme pour ce membre.')}
      </div>
      <div class="card-title" style="font-size:14px;margin:16px 0 8px;display:flex;align-items:center;justify-content:space-between;">
        <span>Informations importées</span>
        <button class="btn btn-ghost btn-sm" id="extraInfoAddFieldBtn" type="button">+ champ</button>
      </div>
      <div class="extra-info-grid" id="extraInfoGrid">
        ${Object.entries(m.extra || {}).map(([k, v]) => `<div class="extra-info-item" data-key="${escapeHtml(k)}">
          <label>${escapeHtml(k)}</label>
          <div class="extra-info-row">
            <input type="text" class="extraInfoValueInput" value="${escapeHtml(String(v))}">
            <button type="button" class="extra-info-remove" title="Supprimer ce champ">×</button>
          </div>
        </div>`).join('') || `<div style="font-size:12px;color:var(--ink-faint);grid-column:1/-1;">Aucune information importée pour ce membre.</div>`}
      </div>
      <button class="btn btn-primary btn-sm" id="extraInfoSaveBtn" type="button" style="width:100%;justify-content:center;margin-top:10px;">Enregistrer ces informations</button>
      <button class="btn btn-ghost" id="memberDetailCloseBtn" style="width:100%;justify-content:center;margin-top:16px;">Fermer</button>
    </div>
  </div>`;
}
function attachMemberDetailModal() {
  document.getElementById('memberDetailCloseBtn')?.addEventListener('click', () => { state.memberDetailId = null; render(); });
  document.getElementById('memberDetailCloseFixedBtn')?.addEventListener('click', () => { state.memberDetailId = null; render(); });
  document.getElementById('memberDetailOverlay')?.addEventListener('click', (e) => { if (e.target.id === 'memberDetailOverlay') { state.memberDetailId = null; render(); } });
  const yearSel = document.getElementById('memberDetailYear');
  if (yearSel) yearSel.addEventListener('change', e => { state.dashYearFilter = e.target.value; render(); });

  const categorySaveBtn = document.getElementById('memberDetailCategorySaveBtn');
  if (categorySaveBtn) categorySaveBtn.addEventListener('click', async () => {
    const m = state.data.membres.find(x => x.id === state.memberDetailId);
    const categorySelect = document.getElementById('memberDetailCategory');
    if (!m || !categorySelect) return;
    const previousCategory = m.categorie || '';
    const nextCategory = categorySelect.value;
    if (previousCategory === nextCategory) {
      showToast('La catégorie n’a pas changé');
      return;
    }
    const affectedPrograms = state.data.programmes.filter(programme =>
      memberInProgramme(m, programme.id)
      && isPriorityProgram(programme, previousCategory) !== isPriorityProgram(programme, nextCategory)
    );
    const impact = affectedPrograms.length
      ? 'Les absences passées et futures seront désormais comptées différemment dans les programmes suivants : '
        + affectedPrograms.map(programme => programme.nom).join(', ')
        + '. Les statistiques et rapports seront recalculés.'
      : 'Aucun programme actuellement associé à ce membre ne définit de priorité par catégorie : ce changement ne modifie donc pas le calcul actuel des absences.';
    openConfirm(
      'Confirmer le changement de catégorie ?',
      impact + ' Aucun pointage ne sera modifié ou supprimé.',
      async () => {
        m.categorie = nextCategory;
        await saveData();
        showToast('Catégorie du membre mise à jour');
        render();
      },
      'Confirmer le changement'
    );
  });

  const grid = document.getElementById('extraInfoGrid');
  if (grid) grid.addEventListener('click', e => {
    const removeBtn = e.target.closest('.extra-info-remove');
    if (removeBtn) removeBtn.closest('.extra-info-item')?.remove();
  });
  const addFieldBtn = document.getElementById('extraInfoAddFieldBtn');
  if (addFieldBtn) addFieldBtn.addEventListener('click', () => {
    const placeholder = grid.querySelector('div[style*="grid-column"]');
    if (placeholder) placeholder.remove();
    const item = document.createElement('div');
    item.className = 'extra-info-item';
    item.dataset.key = '';
    item.innerHTML = `<input type="text" class="extraInfoKeyInput" placeholder="Nom du champ" style="font-size:10.5px;font-weight:700;padding:4px 6px;margin-bottom:3px;border:1px solid var(--line);border-radius:6px;background:var(--card);color:var(--ink-faint);width:100%;box-sizing:border-box;"><div class="extra-info-row"><input type="text" class="extraInfoValueInput" placeholder="Valeur"><button type="button" class="extra-info-remove" title="Supprimer ce champ">×</button></div>`;
    grid.prepend(item);
    item.querySelector('.extraInfoKeyInput').focus();
  });
  const saveBtn = document.getElementById('extraInfoSaveBtn');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const m = state.data.membres.find(x => x.id === state.memberDetailId);
    if (!m) return;
    const extra = {};
    grid.querySelectorAll('.extra-info-item').forEach(item => {
      const keyInput = item.querySelector('.extraInfoKeyInput');
      const key = keyInput ? keyInput.value.trim() : item.dataset.key;
      const v = item.querySelector('.extraInfoValueInput').value.trim();
      if (key) extra[key] = v;
    });
    m.extra = extra;
    await saveData();
    showToast('Informations enregistrées');
    render();
  });
}
