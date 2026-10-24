/* js/views/membres.js — Onglet Membres (liste, ajout, filtres, export) */

/* ================= MEMBRES ================= */
function renderMembres() {
  const d = state.data;
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Base de données</div>
        <h1 class="page-title">Membres &amp; programmes</h1>
        <p class="page-sub">Gérez vos programmes, ajoutez des membres un par un ou importez un fichier Excel existant.</p>
      </div>
    </div>
    <div class="grid grid-2" style="align-items:start;">
      <div class="card">
        <h3 class="card-title">Programmes</h3>
        <div class="card-sub">${d.programmes.length} programme${d.programmes.length > 1 ? 's' : ''}</div>
        <div class="ledger">${d.programmes.map(p => {
          const prio = p.prioriteCategories || [];
          const cats = ['Homme', 'Femme', 'Cadet', 'Cadette', 'Père', 'Mère'];
          return `<div class="ledger-row" style="flex-direction:column;align-items:stretch;gap:8px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <div class="prog-name" style="flex:1;">${escapeHtml(p.nom)}</div>
              <div style="color:var(--ink-faint);font-size:12px;" class="mono">${d.membres.filter(m => memberInProgramme(m, p.id)).length} membres</div>
              <button class="edit-name-btn delete-prog-btn" data-id="${p.id}" style="color:var(--terracotta);">supprimer</button>
            </div>
            <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--ink-faint);">
              <span>Prioritaire pour :</span>
              ${cats.map(c => `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" class="progPrioCheckbox" data-prog="${p.id}" data-cat="${c}" ${prio.includes(c) ? 'checked' : ''}>${c}</label>`).join('')}
              ${!prio.length ? `<span style="font-style:italic;">— aucune coché : absences comptées pour tous, comme avant —</span>` : ''}
            </div>
          </div>`;
        }).join('') || emptyRow('Aucun programme pour l’instant.')}</div>
        <div style="display:flex;gap:8px;margin-top:16px;">
          <input type="text" id="newProgName" placeholder="Nom du nouveau programme" style="flex:1;">
          <button class="btn btn-primary btn-sm" id="addProgBtn">${ICONS.plus} Ajouter</button>
        </div>
      </div>
      <div class="card">
        <h3 class="card-title">Ajouter un membre</h3>
        <div class="card-sub">Saisie manuelle</div>
        <div class="field" style="margin-bottom:10px;"><label>Prénom</label><input type="text" id="newPrenom" style="width:100%;"></div>
        <div class="field" style="margin-bottom:10px;"><label>Nom</label><input type="text" id="newNom" style="width:100%;"></div>
        <div class="field" style="margin-bottom:10px;">
          <label>Sexe</label>
          <select id="newSexe" style="width:100%;"><option value="H">Homme</option><option value="F">Femme</option></select>
        </div>
        <div class="field" style="margin-bottom:10px;">
          <label>Catégorie</label>
          <select id="newCategorie" style="width:100%;">
            <option value="">Non définie</option>
            <option value="Homme">Homme</option>
            <option value="Femme">Femme</option>
            <option value="Cadet">Cadet</option>
            <option value="Cadette">Cadette</option>
            <option value="Père">Père</option>
            <option value="Mère">Mère</option>
          </select>
          <div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">Détermine, avec les priorités définies par programme, si une absence de ce membre est comptabilisée.</div>
        </div>
        <div class="field" style="margin-bottom:14px;">
          <label>Type de membre</label>
          <div class="status-toggle" id="newMembreType">
            <button type="button" class="status-btn present active" data-ap="0" style="flex:1;">Permanent</button>
            <button type="button" class="status-btn absent" data-ap="1" style="flex:1;">Ponctuel (AP)</button>
          </div>
          <div style="font-size:11.5px;color:var(--ink-faint);margin-top:6px;line-height:1.5;" id="newMembreTypeHint">Automatiquement pointable dans tous les programmes déjà créés et ceux à venir.</div>
        </div>
        <div class="field" style="margin-bottom:14px;" id="newMembreExtraPermanent">
          <label>Informations complémentaires (base importée)</label>
          ${(() => {
            const keys = extraFieldKeys(d);
            if (!keys.length) return `<div style="font-size:11.5px;color:var(--ink-faint);">Aucun champ détecté pour l’instant — importez d’abord un fichier pour que ces champs apparaissent ici.</div>`;
            return `<div class="extra-info-grid" style="max-height:min(260px, 40vh);">${keys.map(k => `<div class="extra-info-item"><label>${escapeHtml(k)}</label><div class="extra-info-row"><input type="text" class="newMembreExtraInput" data-key="${escapeHtml(k)}"></div></div>`).join('')}</div>`;
          })()}
        </div>
        <div class="field" style="margin-bottom:14px;display:none;" id="newMembreContactAP">
          <label>Contact</label>
          <input type="text" id="newMembreContact" placeholder="Téléphone ou email" style="width:100%;">
        </div>
        <button class="btn btn-primary" id="addMembreBtn" style="width:100%;justify-content:center;">${ICONS.plus} Ajouter le membre</button>
      </div>
    </div>

    <div class="card" style="margin-top:16px;">
      <h3 class="card-title">Importer un fichier Excel</h3>
      <div class="card-sub">Les en-têtes déjà présentes dans votre fichier seront reconnues et associées automatiquement</div>
      ${renderImportZone()}
    </div>

    <div class="card" style="margin-top:16px;">
      <h3 class="card-title">Tous les membres</h3>
      <div class="card-sub">${d.membres.length} au total${d.membres.some(m => m.ap) ? ' · ' + d.membres.filter(m => m.ap).length + ' membre(s) ponctuel(s) (AP)' : ''}</div>
      <div style="margin:12px 0 14px;">
        <input type="text" id="membreSearch" placeholder="Rechercher un membre (nom, prénom...)" value="${escapeHtml(state.membreSearch || '')}" style="width:100%;">
      </div>
      ${(() => {
        const q = (state.membreSearch || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        const filtered = q ? d.membres.filter(m => {
          if (norm(`${m.prenom} ${m.nom}`).includes(q)) return true;
          return Object.values(m.extra || {}).some(v => norm(v).includes(q));
        }) : d.membres;
        if (!d.membres.length) return emptyRow('Aucun membre pour l’instant.');
        if (!filtered.length) return emptyRow('Aucun membre ne correspond à cette recherche.');
        return `<table class="data-table"><thead><tr><th>Nom</th><th>Sexe</th><th>Programmes</th><th></th></tr></thead><tbody>
        ${filtered.map(m => `<tr><td><button class="member-name-link" data-id="${m.id}" style="background:none;border:none;padding:0;color:var(--ink);font-weight:700;cursor:pointer;text-decoration:underline;text-decoration-color:var(--line-strong);">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</button>${m.ap ? ` <span class="pill" style="background:var(--gold-tint);border-color:var(--gold);color:var(--gold);">AP</span>` : ''}${m.extra && Object.keys(m.extra).length ? ` <span class="pill" style="background:var(--gold-tint);border-color:var(--gold);color:var(--gold);font-size:10px;" title="Informations importées disponibles">i</span>` : ''}</td><td>${m.sexe === 'H' ? 'Homme' : 'Femme'}</td><td>${m.ap || m.allProgrammes ? `<span class="pill" style="background:var(--emerald-tint);border-color:var(--emerald);color:var(--emerald-dim);">Tous les programmes</span>` : m.programmeIds.map(pid => `<span class="pill">${escapeHtml((d.programmes.find(p => p.id === pid) || {}).nom || '—')}</span>`).join('')}</td><td><button class="edit-name-btn delete-membre-btn" data-id="${m.id}" style="color:var(--terracotta);">supprimer</button></td></tr>`).join('')}
      </tbody></table>`;
      })()}
    </div>

    <div class="card" style="margin-top:16px;">
      <h3 class="card-title">Exporter la base</h3>
      <div class="card-sub">Choisissez les colonnes à inclure, affinez les filtres si besoin, puis exportez.</div>

      <div class="card-sub" style="margin-top:14px;font-weight:700;color:var(--ink-dim);">Colonnes</div>
      <div class="extra-info-grid" style="margin-top:8px;max-height:none;">
        ${[{ key: '__prenom', label: 'Prénom' }, { key: '__nom', label: 'Nom' }, { key: '__sexe', label: 'Sexe' }, { key: '__categorie', label: 'Catégorie' }, { key: '__type', label: 'Type (Permanent/AP)' }, { key: '__programmes', label: 'Programmes' }]
          .map(f => `<label style="display:flex;align-items:center;gap:6px;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:8px 9px;font-size:12px;cursor:pointer;"><input type="checkbox" class="exportColCheckbox" value="${escapeHtml(f.key)}" checked>${escapeHtml(f.label)}</label>`).join('')}
      </div>

      <div class="card-sub" style="margin-top:16px;font-weight:700;color:var(--ink-dim);">Filtrer qui exporter</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Catégorie</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            ${['Homme', 'Femme', 'Cadet', 'Cadette', 'Père', 'Mère'].map(c => `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportCatFilter" value="${c}" checked>${c}</label>`).join('')}
          </div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Type</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportTypeFilter" value="permanent" checked>Permanent</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportTypeFilter" value="ap" checked>Ponctuel (AP)</label>
          </div>
          <div style="font-size:11px;color:var(--ink-faint);margin-top:6px;">Si des membres AP sont inclus, leur contact est automatiquement récupéré dans l’export.</div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Programmes</div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportProgFilter" value="tous" id="exportProgAll" checked>Tous les programmes</label>
            ${d.programmes.map(p => `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;opacity:0.5;" class="exportProgOne"><input type="checkbox" class="exportProgFilter" value="${p.id}" disabled>${escapeHtml(p.nom)}</label>`).join('')}
          </div>
        </div>
      </div>

      ${extraFieldKeys(d).length ? `
        <div class="card-sub" style="margin-top:16px;font-weight:700;color:var(--ink-dim);">Informations importées</div>
        <div class="extra-info-grid" style="margin-top:8px;max-height:min(240px, 40vh);">
          ${extraFieldKeys(d).map(k => `<label style="display:flex;align-items:center;gap:6px;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:8px 9px;font-size:12px;cursor:pointer;"><input type="checkbox" class="exportColCheckbox" value="${escapeHtml(k)}" checked>${escapeHtml(k)}</label>`).join('')}
        </div>
      ` : ''}

      <div style="display:flex;gap:10px;margin-top:16px;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" id="exportXlsxBtn">Exporter en Excel (.xlsx)</button>
        <button class="btn btn-ghost btn-sm" id="exportPdfBtn">Exporter en PDF</button>
      </div>
    </div>


    <div class="card" style="margin-top:16px;border-color:var(--terracotta-tint);">
      <h3 class="card-title" style="color:var(--terracotta-dim);">Zone sensible</h3>
      <div class="card-sub">Réinitialise entièrement l’application : programmes, membres, séances, pointages et Bureau (mandats, réunions, procès-verbaux). Votre nom de signataire est conservé.</div>
      <button class="btn" id="resetAllBtn" style="background:var(--terracotta);border-color:transparent;color:#fff;">Réinitialiser toutes les données</button>
      <div class="card-sub" style="margin-top:16px;">Supprime tous les membres (permanents et ponctuels) et leurs pointages associés — retour à zéro membre, comme s’il n’y avait jamais eu d’import. Les programmes et les séances restent intacts.</div>
      <button class="btn btn-ghost" id="clearImportedDataBtn" style="border-color:var(--terracotta);color:var(--terracotta-dim);">Supprimer tous les membres</button>
    </div>
  `;
}

function attachMembresEvents() {
  const d = state.data;
  const membreSearch = document.getElementById('membreSearch');
  if (membreSearch) membreSearch.addEventListener('input', e => {
    state.membreSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const again = document.getElementById('membreSearch');
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  });

  // "Tous les programmes" et la sélection individuelle sont mutuellement
  // exclusifs : cocher "tous" désactive/décoche le détail, et cocher un
  // programme précis décoche "tous" pour permettre la sélection.
  const progAllCb = document.getElementById('exportProgAll');
  const progOneCbs = () => Array.from(document.querySelectorAll('.exportProgOne input.exportProgFilter'));
  if (progAllCb) progAllCb.addEventListener('change', () => {
    progOneCbs().forEach(cb => {
      cb.disabled = progAllCb.checked;
      cb.closest('.exportProgOne').style.opacity = progAllCb.checked ? '0.5' : '1';
      if (progAllCb.checked) cb.checked = false;
    });
  });
  progOneCbs().forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked && progAllCb) { progAllCb.checked = false; progOneCbs().forEach(c => { c.disabled = false; c.closest('.exportProgOne').style.opacity = '1'; }); }
  }));

  // Construit les lignes filtrées + colonnes choisies, communes aux deux formats.
  function buildExportRows() {
    const checked = Array.from(document.querySelectorAll('.exportColCheckbox:checked')).map(cb => cb.value);
    if (!checked.length) { showToast('Sélectionnez au moins une colonne'); return null; }
    const catChecked = Array.from(document.querySelectorAll('.exportCatFilter:checked')).map(cb => cb.value);
    const typeChecked = Array.from(document.querySelectorAll('.exportTypeFilter:checked')).map(cb => cb.value);
    const progAll = document.getElementById('exportProgAll')?.checked;
    const progChecked = Array.from(document.querySelectorAll('.exportProgFilter:checked')).map(cb => cb.value).filter(v => v !== 'tous');
    if (!typeChecked.length) { showToast('Sélectionnez au moins un type (Permanent ou AP)'); return null; }
    if (!progAll && !progChecked.length) { showToast('Sélectionnez au moins un programme, ou « Tous les programmes »'); return null; }
    const catFilterActive = catChecked.length < 6;
    const filtered = d.membres.filter(m => {
      if (catFilterActive && !catChecked.includes(m.categorie)) return false;
      if (!typeChecked.includes(m.ap ? 'ap' : 'permanent')) return false;
      if (!progAll && !progChecked.some(pid => memberInProgramme(m, pid))) return false;
      return true;
    });
    if (!filtered.length) { showToast('Aucun membre ne correspond à ces filtres'); return null; }
    // Si des membres AP font partie de l’export, leur contact est
    // systématiquement récupéré, même si la colonne n’a pas été cochée.
    const hasAp = filtered.some(m => m.ap);
    const cols = checked.slice();
    if (hasAp && extraFieldKeys(d).includes('Contact') && !cols.includes('Contact')) cols.push('Contact');
    const rows = filtered.map(m => {
      const row = {};
      cols.forEach(key => {
        if (key === '__prenom') row['Prénom'] = m.prenom;
        else if (key === '__nom') row['Nom'] = m.nom;
        else if (key === '__sexe') row['Sexe'] = m.sexe === 'H' ? 'Homme' : 'Femme';
        else if (key === '__categorie') row['Catégorie'] = m.categorie || '';
        else if (key === '__type') row['Type'] = m.ap ? 'Ponctuel (AP)' : 'Permanent';
        else if (key === '__programmes') row['Programmes'] = m.ap || m.allProgrammes ? 'Tous les programmes' : m.programmeIds.map(pid => (d.programmes.find(p => p.id === pid) || {}).nom).filter(Boolean).join(', ');
        else row[key] = (m.extra && m.extra[key]) || '';
      });
      return row;
    });
    return rows;
  }

  const exportXlsxBtn = document.getElementById('exportXlsxBtn');
  if (exportXlsxBtn) exportXlsxBtn.addEventListener('click', () => {
    const rows = buildExportRows();
    if (!rows) return;
    const ws = buildStyledSheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membres');
    XLSX.writeFile(wb, `carnet-sgm-export-membres-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Export Excel généré');
  });

  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => {
    const rows = buildExportRows();
    if (!rows) return;
    buildExportPdf(rows);
    showToast('Export PDF généré');
  });

  const addProg = document.getElementById('addProgBtn');
  if (addProg) addProg.addEventListener('click', async () => {
    const input = document.getElementById('newProgName');
    const name = input.value.trim();
    if (!name) { showToast('Merci de saisir un nom de programme'); return; }
    d.programmes.push({ id: uid(), nom: name });
    await saveData(); showToast('Programme ajouté'); render();
  });

  document.querySelectorAll('#newMembreType .status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#newMembreType .status-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const isAp = btn.dataset.ap === '1';
      const hint = document.getElementById('newMembreTypeHint');
      hint.textContent = isAp
        ? 'Pointable dans tous les programmes et compté à part des effectifs permanents. Intégré définitivement à la base après plus de 6 séances réparties sur au moins 3 programmes.'
        : 'Automatiquement pointable dans tous les programmes déjà créés et ceux à venir.';
      const extraPermanent = document.getElementById('newMembreExtraPermanent');
      const contactAP = document.getElementById('newMembreContactAP');
      if (extraPermanent) extraPermanent.style.display = isAp ? 'none' : '';
      if (contactAP) contactAP.style.display = isAp ? '' : 'none';
    });
  });
  const addMembre = document.getElementById('addMembreBtn');
  if (addMembre) addMembre.addEventListener('click', async () => {
    const prenom = document.getElementById('newPrenom').value.trim();
    const nom = document.getElementById('newNom').value.trim();
    const sexe = document.getElementById('newSexe').value;
    const categorie = document.getElementById('newCategorie').value;
    if (!nom || !prenom) { showToast('Nom et prénom requis'); return; }
    const apBtn = document.querySelector('#newMembreType .status-btn.active');
    const ap = !!(apBtn && apBtn.dataset.ap === '1');
    const extra = {};
    if (ap) {
      const contact = document.getElementById('newMembreContact')?.value.trim();
      if (contact) extra['Contact'] = contact;
    } else {
      document.querySelectorAll('.newMembreExtraInput').forEach(inp => {
        const v = inp.value.trim();
        if (v) extra[inp.dataset.key] = v;
      });
    }
    const membre = ap
      ? { id: uid(), nom, prenom, sexe, categorie, programmeIds: [], allProgrammes: true, ap: true, extra }
      : { id: uid(), nom, prenom, sexe, categorie, programmeIds: [], allProgrammes: true, ap: false, extra };
    d.membres.push(membre);
    await saveData(); showToast(ap ? 'Membre ponctuel ajouté (AP)' : 'Membre ajouté — pointable dans tous les programmes'); render();
  });

  const dz = document.getElementById('dropZone');
  const fileInput = document.getElementById('fileInput');
  if (dz) dz.addEventListener('click', () => fileInput.click());
  if (fileInput) fileInput.addEventListener('change', handleFile);

  const mapSelects = document.querySelectorAll('.mapSelect');
  mapSelects.forEach(sel => sel.addEventListener('change', e => {
    state.importMapping[e.target.dataset.field] = e.target.value;
    const previewContainer = document.getElementById('importPreviewTable');
    if (previewContainer) {
      previewContainer.outerHTML = renderImportPreviewTable();
    }
  }));
  const confirmBtn = document.getElementById('confirmImportBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', confirmImport);
  const cancelBtn = document.getElementById('cancelImportBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { state.importStep = 0; render(); });

  const emptyGo = document.getElementById('emptyGoMembres');
  if (emptyGo) emptyGo.addEventListener('click', () => { state.tab = 'membres'; render(); });

  document.querySelectorAll('.progPrioCheckbox').forEach(cb => cb.addEventListener('change', async () => {
    const prog = d.programmes.find(p => p.id === cb.dataset.prog);
    if (!prog) return;
    const set = new Set(prog.prioriteCategories || []);
    if (cb.checked) set.add(cb.dataset.cat); else set.delete(cb.dataset.cat);
    prog.prioriteCategories = Array.from(set);
    await saveData();
    render();
  }));

  document.querySelectorAll('.delete-prog-btn').forEach(btn => btn.addEventListener('click', () => {
    const prog = d.programmes.find(p => p.id === btn.dataset.id);
    openConfirm(
      'Supprimer ce programme ?',
      '« ' + (prog ? prog.nom : '') + ' » ainsi que toutes ses séances et pointages seront supprimés. Les membres eux-mêmes seront conservés.',
      async () => {
        const sessionIds = d.sessions.filter(s => s.programmeId === btn.dataset.id).map(s => s.id);
        d.sessions = d.sessions.filter(s => s.programmeId !== btn.dataset.id);
        d.pointages = d.pointages.filter(p => !sessionIds.includes(p.sessionId));
        d.membres.forEach(m => { m.programmeIds = m.programmeIds.filter(pid => pid !== btn.dataset.id); });
        d.programmes = d.programmes.filter(p => p.id !== btn.dataset.id);
        await saveData(); showToast('Programme supprimé'); render();
      }
    );
  }));

  document.querySelectorAll('.member-name-link').forEach(btn => btn.addEventListener('click', () => {
    state.memberDetailId = btn.dataset.id;
    render();
  }));

  document.querySelectorAll('.delete-membre-btn').forEach(btn => btn.addEventListener('click', () => {
    const m = d.membres.find(m => m.id === btn.dataset.id);
    openConfirm(
      'Supprimer ce membre ?',
      (m ? m.prenom + ' ' + m.nom : 'Ce membre') + ' sera retiré, avec tout son historique de pointage.',
      async () => {
        d.pointages = d.pointages.filter(p => p.membreId !== btn.dataset.id);
        d.membres = d.membres.filter(m => m.id !== btn.dataset.id);
        await saveData(); showToast('Membre supprimé'); render();
      }
    );
  }));

  const resetBtn = document.getElementById('resetAllBtn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    openConfirm(
      'Réinitialiser toutes les données ?',
      'Programmes, membres, séances et pointages seront définitivement supprimés sur cet appareil. Cette action est irréversible et n’affecte pas les données partagées sur les autres appareils.',
      async () => {
        await resetAppData();
      },
      'Réinitialiser'
    );
  });

  const clearImportedBtn = document.getElementById('clearImportedDataBtn');
  if (clearImportedBtn) clearImportedBtn.addEventListener('click', () => {
    const count = d.membres.length;
    if (!count) { showToast('Aucun membre à supprimer'); return; }
    openConfirm(
      'Supprimer tous les membres ?',
      `${count} membre${count > 1 ? 's' : ''} et tous les pointages associés seront définitivement supprimés, sur tous les appareils synchronisés. Les programmes et les séances restent intacts. Cette action est irréversible.`,
      async () => {
        const membreIds = new Set(d.membres.map(m => m.id));
        d.pointages = d.pointages.filter(p => !membreIds.has(p.membreId));
        d.membres = [];
        await saveData();
        showToast('Tous les membres ont été supprimés');
      },
      'Supprimer'
    );
  });
}
