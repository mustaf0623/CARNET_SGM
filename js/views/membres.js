/* js/views/membres.js — Onglet Membres (liste, ajout, filtres, export) */

/* ================= MEMBRES ================= */
function normalizeExportSearch(value) {
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim();
}

function membersInMembreScope(members, readOnly, account, programmes) {
  if (!readOnly || account.scopeGlobal) return members;
  return members.filter(member =>
    programmes.some(programme => memberInProgramme(member, programme.id))
  );
}

function filterMembreDirectory(members, programmes) {
  const query = normalizeExportSearch(state.membreSearch || '').split(/\s+/).filter(Boolean);
  const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
  const filtered = members.filter(member => {
    const category = normaliseCategorie(member.categorie)
      || String(member.categorie || '').trim()
      || 'Non définie';
    const status = memberActivityStatus(member);
    const programmeNames = member.ap || member.allProgrammes
      ? 'Tous les programmes'
      : (member.programmeIds || []).map(id => (programmes.find(programme => programme.id === id) || {}).nom).filter(Boolean).join(' ');
    const activityLabels = {
      actif: 'Actif', moyen: 'Moyen', pasDuTout: 'Pas du tout', nonRenseigne: 'Non renseigné',
    };
    const searchable = normalizeExportSearch([
      member.prenom, member.nom, member.sexe === 'H' ? 'Homme' : 'Femme',
      category, member.ap ? 'Ponctuel AP' : 'Permanent', activityLabels[status],
      programmeNames, ...Object.entries(member.extra || {}).flat(),
    ].join(' '));
    return query.every(term => searchable.includes(term));
  });
  const byName = (a, b) => collator.compare(`${a.nom || ''} ${a.prenom || ''}`, `${b.nom || ''} ${b.prenom || ''}`);
  return filtered.sort((a, b) => {
    if (state.membreSort === 'categorie') {
      return collator.compare(
        String(normaliseCategorie(a.categorie) || a.categorie || 'Non définie'),
        String(normaliseCategorie(b.categorie) || b.categorie || 'Non définie')
      ) || byName(a, b);
    }
    if (state.membreSort === 'activite') {
      const order = { actif: 0, moyen: 1, pasDuTout: 2, nonRenseigne: 3 };
      return order[memberActivityStatus(a)] - order[memberActivityStatus(b)] || byName(a, b);
    }
    return byName(a, b);
  });
}

// Compte + tableau de l'annuaire filtré — factorisé pour être réutilisé à la
// fois au rendu initial et lors d'un rafraîchissement léger (sans tout
// reconstruire la page, pour ne pas perdre l'état des cases à cocher).
function renderDirectoryMembersBlock(filteredDirectoryMembers, directoryMembers, allowedProgrammes, readOnly) {
  const countLine = `<div class="card-sub">${filteredDirectoryMembers.length} membre(s) affiché(s) sur ${directoryMembers.length} de la portée${directoryMembers.some(m => m.ap) ? ' · ' + directoryMembers.filter(m => m.ap).length + ' membre(s) ponctuel(s) (AP)' : ''}</div>`;
  const activityLabels = { actif: 'Actif', moyen: 'Moyen', pasDuTout: 'Pas du tout', nonRenseigne: 'Non renseigné' };
  let table;
  if (!directoryMembers.length) table = emptyRow('Aucun membre dans cette portée autorisée.');
  else if (!filteredDirectoryMembers.length) table = emptyRow('Aucun membre ne correspond à ces critères.');
  else table = `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nom</th><th>Sexe</th><th>Catégorie</th><th>Activité</th><th>Programmes</th>${readOnly ? '' : '<th></th>'}</tr></thead><tbody>
        ${filteredDirectoryMembers.map(m => {
          const memberProgrammes = allowedProgrammes.filter(programme =>
            m.ap || m.allProgrammes || (m.programmeIds || []).includes(programme.id)
          );
          const programmeLabels = m.ap || m.allProgrammes
            ? `<span class="pill">${readOnly && !state.account.scopeGlobal ? 'Tous les programmes autorisés' : 'Tous les programmes'}</span>`
            : memberProgrammes.map(programme => `<span class="pill">${escapeHtml(programme.nom)}</span>`).join('');
          return `<tr><td><button type="button" class="member-name-link" data-id="${m.id}" style="background:none;border:none;padding:0;color:var(--ink);font-weight:700;cursor:pointer;text-decoration:underline;text-decoration-color:var(--line-strong);">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</button>${m.ap ? ` <span class="pill" style="background:var(--gold-tint);border-color:var(--gold);color:var(--gold);">AP</span>` : ''}${m.extra && Object.keys(m.extra).length ? ` <span class="pill" style="background:var(--gold-tint);border-color:var(--gold);color:var(--gold);font-size:10px;" title="Informations importées disponibles">i</span>` : ''}</td><td>${m.sexe === 'H' ? 'Homme' : 'Femme'}</td><td>${escapeHtml(normaliseCategorie(m.categorie) || m.categorie || 'Non définie')}</td><td>${activityLabels[memberActivityStatus(m)]}</td><td>${programmeLabels || '—'}</td>${readOnly ? '' : `<td><button class="edit-name-btn delete-membre-btn" data-id="${m.id}" style="color:var(--terracotta);">supprimer</button></td>`}</tr>`;
        }).join('')}
      </tbody></table></div>`;
  return countLine + table;
}

function renderMembres() {
  const d = state.data;
  const readOnly = isPresidentReadOnly();
  const allowedProgrammes = d.programmes.filter(programme => accountCanReadProgramme(programme.id));
  const directoryMembers = membersInMembreScope(d.membres, readOnly, state.account, allowedProgrammes);
  const exportCategories = Array.from(new Set(d.membres.map(member =>
    normaliseCategorie(member.categorie) || String(member.categorie || '').trim() || 'Non définie'
  ))).sort((a, b) => a.localeCompare(b, 'fr'));
  const directoryCategories = Array.from(new Set(directoryMembers.map(member =>
    normaliseCategorie(member.categorie) || String(member.categorie || '').trim() || 'Non définie'
  ))).sort((a, b) => a.localeCompare(b, 'fr'));
  const filteredDirectoryMembers = filterMembreDirectory(directoryMembers, allowedProgrammes);
  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Base de données</div>
        <h1 class="page-title">Membres &amp; programmes</h1>
        <p class="page-sub">${readOnly ? 'Consultez et recherchez les membres de votre portée autorisée par nom, catégorie, activité, type ou programme.' : 'Gérez vos programmes, ajoutez des membres un par un ou importez un fichier Excel existant.'}</p>
      </div>
    </div>
    <div class="grid grid-2" style="align-items:start;">
      <div class="card">
        <h3 class="card-title">Programmes</h3>
        <div class="card-sub">${allowedProgrammes.length} programme${allowedProgrammes.length > 1 ? 's' : ''}${readOnly ? ' autorisé(s)' : ''}</div>
        <div class="ledger">${allowedProgrammes.map(p => {
          const prio = p.prioriteCategories || [];
          const cats = ['Homme', 'Femme', 'Cadet', 'Cadette', 'Père', 'Mère'];
          return `<div class="ledger-row" style="flex-direction:column;align-items:stretch;gap:8px;">
            <div style="display:flex;align-items:center;gap:14px;">
              <div class="prog-name" style="flex:1;">${escapeHtml(p.nom)}</div>
              <div style="color:var(--ink-faint);font-size:12px;" class="mono">${directoryMembers.filter(m => memberInProgramme(m, p.id)).length} membres</div>
              ${readOnly ? '' : `<button class="edit-name-btn delete-prog-btn" data-id="${p.id}" style="color:var(--terracotta);">supprimer</button>`}
            </div>
            ${readOnly ? '' : `<div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;font-size:11.5px;color:var(--ink-faint);">
              <span>Prioritaire pour :</span>
              ${cats.map(c => `<label style="display:flex;align-items:center;gap:4px;cursor:pointer;"><input type="checkbox" class="progPrioCheckbox" data-prog="${p.id}" data-cat="${c}" ${prio.includes(c) ? 'checked' : ''}>${c}</label>`).join('')}
              ${!prio.length ? `<span style="font-style:italic;">— aucune coché : absences comptées pour tous, comme avant —</span>` : ''}
            </div>`}
          </div>`;
        }).join('') || emptyRow('Aucun programme pour l’instant.')}</div>
        ${readOnly ? '' : `<div style="display:flex;gap:8px;margin-top:16px;">
          <input type="text" id="newProgName" placeholder="Nom du nouveau programme" style="flex:1;">
          <button class="btn btn-primary btn-sm" id="addProgBtn">${ICONS.plus} Ajouter</button>
        </div>`}
      </div>
      ${readOnly ? '' : `<div class="card">
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
            if (!keys.length) return `<div style="font-size:11.5px;color:var(--ink-faint);">Aucun champ détecté pour l’instant importez d’abord un fichier pour que ces champs apparaissent ici.</div>`;
            return `<div class="extra-info-grid" style="max-height:min(260px, 40vh);">${keys.map(k => `<div class="extra-info-item"><label>${escapeHtml(k)}</label><div class="extra-info-row"><input type="text" class="newMembreExtraInput" data-key="${escapeHtml(k)}"></div></div>`).join('')}</div>`;
          })()}
        </div>
        <div class="field" style="margin-bottom:14px;display:none;" id="newMembreContactAP">
          <label>Contact</label>
          <input type="text" id="newMembreContact" placeholder="Téléphone ou email" style="width:100%;">
        </div>
        <button class="btn btn-primary" id="addMembreBtn" style="width:100%;justify-content:center;">${ICONS.plus} Ajouter le membre</button>
      </div>`}
    </div>

    ${readOnly ? '' : `<div class="card" style="margin-top:16px;">
      <h3 class="card-title">Importer un fichier Excel</h3>
      <div class="card-sub">Les en-têtes déjà présentes dans votre fichier seront reconnues et associées automatiquement</div>
      ${renderImportZone()}
    </div>`}

    ${readOnly ? '' : `<div class="card" style="margin-top:16px;">
      <h3 class="card-title">Mettre à jour les informations en lot</h3>
      <div class="card-sub">Exportez la liste complète des membres, complétez ou ajoutez des colonnes, puis réimportez le fichier pour mettre à jour leurs fiches sans créer de doublons.</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
        <button class="btn btn-primary btn-sm" id="exportMemberUpdateBtn" type="button">Exporter le fichier de mise à jour</button>
        <button class="btn btn-ghost btn-sm" id="selectMemberUpdateFileBtn" type="button">Réimporter le fichier complété</button>
        <input type="file" id="memberUpdateFileInput" accept=".xlsx,.xls" style="display:none;">
      </div>
      <div class="card-sub" style="margin-top:8px;">La colonne d’identifiant est masquée. Ne modifiez pas les noms : ils vérifient la correspondance. Une cellule vide conserve la valeur actuelle. Les nouveaux en-têtes sont ajoutés comme informations complémentaires.</div>
    </div>`}

    <div class="card" style="margin-top:16px;">
      <h3 class="card-title">${readOnly ? 'Membres de la portée autorisée' : 'Tous les membres'}</h3>
      <div class="card-sub">Combinez la recherche et plusieurs critères à la fois (par ex. deux catégories ET un programme ET un statut) pour une recherche croisée.</div>
      <div class="grid grid-2" style="margin:12px 0 14px;gap:10px;">
        <div class="field" style="grid-column:1/-1;">
          <label for="membreSearch">Recherche (noms, programmes et informations complémentaires)</label>
          <input type="search" id="membreSearch" placeholder="Ex. prénom nom, catégorie, statut ou valeur importée" value="${escapeHtml(state.membreSearch || '')}" style="width:100%;">
        </div>
        <div class="field">
          <label for="membreSort">Trier par</label>
          <select id="membreSort">
            <option value="nom" ${state.membreSort === 'nom' ? 'selected' : ''}>Nom puis prénom</option>
            <option value="categorie" ${state.membreSort === 'categorie' ? 'selected' : ''}>Catégorie puis nom</option>
            <option value="activite" ${state.membreSort === 'activite' ? 'selected' : ''}>Statut d'activité puis nom</option>
          </select>
        </div>
        <div style="display:flex;align-items:end;"><button type="button" class="btn btn-ghost btn-sm" id="resetMembreFilters">Effacer les filtres</button></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Catégorie</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreCatFilterCb" data-dir-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreCatFilterCb" data-dir-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            ${directoryCategories.map(category => `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreCatFilterCb" value="${escapeHtml(category)}" checked>${escapeHtml(category)}</label>`).join('') || '<span style="color:var(--ink-faint);">Aucune catégorie pour l\u2019instant.</span>'}
          </div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Type</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreTypeFilterCb" data-dir-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreTypeFilterCb" data-dir-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreTypeFilterCb" value="permanent" checked>Permanent</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreTypeFilterCb" value="ap" checked>Ponctuel (AP)</label>
          </div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Statut d'activité</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreActivityFilterCb" data-dir-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreActivityFilterCb" data-dir-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreActivityFilterCb" value="actif" checked>Actif</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreActivityFilterCb" value="moyen" checked>Moyen</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreActivityFilterCb" value="pasDuTout" checked>Pas du tout</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreActivityFilterCb" value="nonRenseigne" checked>Non renseigné</label>
          </div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Programme</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreProgFilterCb" data-dir-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-dir-check-group="membreProgFilterCb" data-dir-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            ${allowedProgrammes.map(programme => `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="membreProgFilterCb" value="${programme.id}" checked>${escapeHtml(programme.nom)}</label>`).join('') || '<span style="color:var(--ink-faint);">Aucun programme pour l\u2019instant.</span>'}
          </div>
        </div>
      </div>
      <div id="membreDirectoryResults">${renderDirectoryMembersBlock(filteredDirectoryMembers, directoryMembers, allowedProgrammes, readOnly)}</div>
    </div>

    ${readOnly ? '' : `<div class="card" style="margin-top:16px;">
      <h3 class="card-title">Exporter la base</h3>

      <div class="card-sub">Combinez la recherche et les filtres, choisissez les colonnes, puis exportez les membres correspondants.</div>

      <div class="field" style="margin-top:14px;">
        <label for="exportSearch">Recherche dans la base</label>
        <input type="search" id="exportSearch" placeholder="Nom, prénom, programme ou information complémentaire…" style="width:100%;">
      </div>
      <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-top:10px;">
        <div class="field">
          <label for="exportSort">Trier les résultats</label>
          <select id="exportSort">
            <option value="nom">Nom puis prénom</option>
            <option value="categorie">Catégorie puis nom</option>
            <option value="activite">Statut d’activité puis nom</option>
          </select>
        </div>
        <strong id="exportPreviewCount" aria-live="polite" style="font-size:13px;color:var(--emerald-dim);padding-bottom:8px;"></strong>
      </div>

      <div class="card-sub" style="margin-top:14px;font-weight:700;color:var(--ink-dim);">Colonnes</div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportColCheckbox" data-export-check-action="all">Tout sélectionner</button>
        <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportColCheckbox" data-export-check-action="none">Tout désélectionner</button>
      </div>
      <div class="extra-info-grid" style="margin-top:8px;max-height:none;">
        ${[{ key: '__prenom', label: 'Prénom' }, { key: '__nom', label: 'Nom' }, { key: '__sexe', label: 'Sexe' }, { key: '__categorie', label: 'Catégorie' }, { key: '__type', label: 'Type (Permanent/AP)' }, { key: '__programmes', label: 'Programmes' }]
          .map(f => `<label style="display:flex;align-items:center;gap:6px;background:var(--card-2);border:1px solid var(--line);border-radius:10px;padding:8px 9px;font-size:12px;cursor:pointer;"><input type="checkbox" class="exportColCheckbox" value="${escapeHtml(f.key)}" checked>${escapeHtml(f.label)}</label>`).join('')}
      </div>

      <div class="card-sub" style="margin-top:16px;font-weight:700;color:var(--ink-dim);">Filtrer qui exporter</div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:8px;">
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Catégorie</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportCatFilter" data-export-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportCatFilter" data-export-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            ${exportCategories.map(category => `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportCatFilter" value="${escapeHtml(category)}" checked>${escapeHtml(category)}</label>`).join('')}
          </div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Type</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportTypeFilter" data-export-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportTypeFilter" data-export-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportTypeFilter" value="permanent" checked>Permanent</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportTypeFilter" value="ap" checked>Ponctuel (AP)</label>
          </div>
          <div style="font-size:11px;color:var(--ink-faint);margin-top:6px;">Si des membres AP sont inclus, leur contact est automatiquement récupéré dans l’export.</div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Programmes</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportProgFilter" data-export-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportProgFilter" data-export-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportProgFilter" value="tous" id="exportProgAll" checked>Tous les programmes</label>
            ${d.programmes.map(p => `<label style="display:flex;align-items:center;gap:5px;cursor:pointer;opacity:0.5;" class="exportProgOne"><input type="checkbox" class="exportProgFilter" value="${p.id}" disabled>${escapeHtml(p.nom)}</label>`).join('')}
          </div>
        </div>
        <div style="border:1px solid var(--line);border-radius:10px;padding:9px 12px;">
          <div style="font-size:12.5px;font-weight:700;margin-bottom:7px;">Statut d’activité</div>
          <div style="display:flex;gap:8px;margin-bottom:8px;">
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportActivityFilter" data-export-check-action="all">Tout</button>
            <button type="button" class="btn btn-ghost btn-sm" data-export-check-group="exportActivityFilter" data-export-check-action="none">Aucun</button>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:12px;font-size:12px;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportActivityFilter" value="actif" checked>Actif</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportActivityFilter" value="moyen" checked>Moyen</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportActivityFilter" value="pasDuTout" checked>Pas du tout</label>
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" class="exportActivityFilter" value="nonRenseigne" checked>Non renseigné</label>
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
      <div class="card-sub" style="margin-top:8px;">Le fichier Excel contient la liste filtrée et un onglet « Synthèse » des effectifs par catégorie et statut d’activité.</div>
    </div>`}


    ${readOnly ? '' : `<div class="card" style="margin-top:16px;border-color:var(--terracotta-tint);">
      <h3 class="card-title" style="color:var(--terracotta-dim);">Zone sensible</h3>
      <div class="card-sub">Réinitialise entièrement l’application : programmes, membres, séances, pointages et Bureau (mandats, réunions, procès-verbaux). Votre nom de signataire est conservé.</div>
      <button class="btn" id="resetAllBtn" style="background:var(--terracotta);border-color:transparent;color:#fff;">Réinitialiser toutes les données</button>
      <div class="card-sub" style="margin-top:16px;">Supprime tous les membres (permanents et ponctuels) et leurs pointages associés; retour à zéro membre, comme s’il n’y avait jamais eu d’import. Les programmes et les séances restent intacts.</div>
      <button class="btn btn-ghost" id="clearImportedDataBtn" style="border-color:var(--terracotta);color:var(--terracotta-dim);">Supprimer tous les membres</button>
    </div>`}
  `;
}

function attachMembresEvents() {
  const d = state.data;
  const readOnly = isPresidentReadOnly();
  const allowedProgrammes = d.programmes.filter(programme => accountCanReadProgramme(programme.id));
  const directoryMembers = membersInMembreScope(d.membres, readOnly, state.account, allowedProgrammes);

  // Recherche croisée (plusieurs catégories/types/statuts/programmes à la fois) :
  // les cases cochées sont lues directement dans le DOM à chaque filtrage, et
  // seul le bloc résultats (#membreDirectoryResults) est remplacé — jamais la
  // page entière — pour ne jamais perdre une sélection de cases en cours de
  // frappe ou de clic (contrairement à render(), qui reconstruit tout depuis
  // state et remettrait chaque case à son état coché par défaut).
  function getFilteredDirectoryMembers() {
    const catChecked = Array.from(document.querySelectorAll('.membreCatFilterCb:checked')).map(cb => cb.value);
    const typeChecked = Array.from(document.querySelectorAll('.membreTypeFilterCb:checked')).map(cb => cb.value);
    const activityChecked = Array.from(document.querySelectorAll('.membreActivityFilterCb:checked')).map(cb => cb.value);
    const progChecked = Array.from(document.querySelectorAll('.membreProgFilterCb:checked')).map(cb => cb.value);
    const base = directoryMembers.filter(member => {
      const category = normaliseCategorie(member.categorie) || String(member.categorie || '').trim() || 'Non définie';
      if (!catChecked.includes(category)) return false;
      if (!typeChecked.includes(member.ap ? 'ap' : 'permanent')) return false;
      if (!activityChecked.includes(memberActivityStatus(member))) return false;
      if (!progChecked.some(pid => memberInProgramme(member, pid))) return false;
      return true;
    });
    return filterMembreDirectory(base, allowedProgrammes);
  }

  function refreshDirectoryResults() {
    const container = document.getElementById('membreDirectoryResults');
    if (!container) return;
    const filtered = getFilteredDirectoryMembers();
    container.innerHTML = renderDirectoryMembersBlock(filtered, directoryMembers, allowedProgrammes, readOnly);
    attachDirectoryResultHandlers();
  }

  function attachDirectoryResultHandlers() {
    document.querySelectorAll('#membreDirectoryResults .member-name-link').forEach(btn => btn.addEventListener('click', () => {
      state.memberDetailId = btn.dataset.id;
      render();
    }));
    document.querySelectorAll('#membreDirectoryResults .delete-membre-btn').forEach(btn => btn.addEventListener('click', () => {
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
  }

  const membreSearch = document.getElementById('membreSearch');
  if (membreSearch) membreSearch.addEventListener('input', e => {
    state.membreSearch = e.target.value;
    refreshDirectoryResults();
  });
  const membreSortSelect = document.getElementById('membreSort');
  if (membreSortSelect) membreSortSelect.addEventListener('change', e => {
    state.membreSort = e.target.value;
    refreshDirectoryResults();
  });
  document.querySelectorAll('.membreCatFilterCb, .membreTypeFilterCb, .membreActivityFilterCb, .membreProgFilterCb')
    .forEach(checkbox => checkbox.addEventListener('change', refreshDirectoryResults));
  document.querySelectorAll('[data-dir-check-group]').forEach(button => button.addEventListener('click', () => {
    const selectAll = button.dataset.dirCheckAction === 'all';
    document.querySelectorAll(`.${button.dataset.dirCheckGroup}`).forEach(checkbox => { checkbox.checked = selectAll; });
    refreshDirectoryResults();
  }));
  const resetDirectoryFilters = document.getElementById('resetMembreFilters');
  if (resetDirectoryFilters) resetDirectoryFilters.addEventListener('click', () => {
    state.membreSearch = '';
    state.membreSort = 'nom';
    if (membreSearch) membreSearch.value = '';
    if (membreSortSelect) membreSortSelect.value = 'nom';
    document.querySelectorAll('.membreCatFilterCb, .membreTypeFilterCb, .membreActivityFilterCb, .membreProgFilterCb')
      .forEach(checkbox => { checkbox.checked = true; });
    refreshDirectoryResults();
  });
  attachDirectoryResultHandlers();

  // \"Tous les programmes\" et la sélection individuelle sont mutuellement
  // exclusifs : cocher \"tous\" désactive/décoche le détail, et cocher un
  // programme précis décoche \"tous\" pour permettre la sélection.
  const progAllCb = document.getElementById('exportProgAll');
  const progOneCbs = () => Array.from(document.querySelectorAll('.exportProgOne input.exportProgFilter'));
  const setProgrammeFilters = (enabled, clearSelection = false) => {
    progOneCbs().forEach(cb => {
      cb.disabled = enabled;
      cb.closest('.exportProgOne').style.opacity = enabled ? '0.5' : '1';
      if (enabled || clearSelection) cb.checked = false;
    });
  };
  const refreshExportPreview = () => {
    const preview = document.getElementById('exportPreviewCount');
    if (preview) {
      const count = getFilteredExportMembers().length;
      preview.textContent = `${count} membre${count > 1 ? 's' : ''} correspondant${count > 1 ? 's' : ''}`;
    }
  };
  if (progAllCb) progAllCb.addEventListener('change', () => {
    setProgrammeFilters(progAllCb.checked);
    refreshExportPreview();
  });
  progOneCbs().forEach(cb => cb.addEventListener('change', () => {
    if (cb.checked && progAllCb) { progAllCb.checked = false; setProgrammeFilters(false); }
    refreshExportPreview();
  }));

  function getFilteredExportMembers() {
    const catChecked = Array.from(document.querySelectorAll('.exportCatFilter:checked')).map(cb => cb.value);
    const typeChecked = Array.from(document.querySelectorAll('.exportTypeFilter:checked')).map(cb => cb.value);
    const activityChecked = Array.from(document.querySelectorAll('.exportActivityFilter:checked')).map(cb => cb.value);
    const progAll = document.getElementById('exportProgAll')?.checked;
    const progChecked = Array.from(document.querySelectorAll('.exportProgFilter:checked')).map(cb => cb.value).filter(v => v !== 'tous');
    const query = normalizeExportSearch(document.getElementById('exportSearch')?.value || '')
      .split(/\s+/).filter(Boolean);
    const programmeNames = member => member.ap || member.allProgrammes
      ? 'Tous les programmes'
      : (member.programmeIds || []).map(pid => (d.programmes.find(p => p.id === pid) || {}).nom).filter(Boolean).join(' ');
    const filtered = d.membres.filter(member => {
      const category = normaliseCategorie(member.categorie)
        || String(member.categorie || '').trim()
        || 'Non définie';
      if (!catChecked.includes(category)) return false;
      if (!typeChecked.includes(member.ap ? 'ap' : 'permanent')) return false;
      if (!activityChecked.includes(memberActivityStatus(member))) return false;
      if (!progAll && !progChecked.some(pid => memberInProgramme(member, pid))) return false;
      const searchable = normalizeExportSearch([
        member.prenom, member.nom, member.sexe, category,
        member.ap ? 'Ponctuel AP' : 'Permanent', programmeNames(member),
        ...Object.entries(member.extra || {}).flat(),
      ].join(' '));
      if (!query.every(term => searchable.includes(term))) return false;
      return true;
    });
    const collator = new Intl.Collator('fr', { sensitivity: 'base', numeric: true });
    const sortBy = document.getElementById('exportSort')?.value || 'nom';
    const byName = (a, b) => collator.compare(`${a.nom || ''} ${a.prenom || ''}`, `${b.nom || ''} ${b.prenom || ''}`);
    return filtered.sort((a, b) => {
      if (sortBy === 'categorie') {
        return collator.compare(
          String(normaliseCategorie(a.categorie) || a.categorie || 'Non définie'),
          String(normaliseCategorie(b.categorie) || b.categorie || 'Non définie')
        ) || byName(a, b);
      }
      if (sortBy === 'activite') {
        const order = { actif: 0, moyen: 1, pasDuTout: 2, nonRenseigne: 3 };
        return order[memberActivityStatus(a)] - order[memberActivityStatus(b)] || byName(a, b);
      }
      return byName(a, b);
    });
  }

  function buildExportRows(members) {
    const checked = Array.from(document.querySelectorAll('.exportColCheckbox:checked')).map(cb => cb.value);
    if (!checked.length) { showToast('Sélectionnez au moins une colonne'); return null; }
    if (!members.length) { showToast('Aucun membre ne correspond à ces filtres'); return null; }
    // Si des membres AP font partie de l’export, leur contact est
    // systématiquement récupéré, même si la colonne n’a pas été cochée.
    const hasAp = members.some(m => m.ap);
    const cols = checked.slice();
    if (hasAp && extraFieldKeys(d).includes('Contact') && !cols.includes('Contact')) cols.push('Contact');
    const rows = members.map(m => {
      const row = {};
      cols.forEach(key => {
        if (key === '__prenom') row['Prénom'] = m.prenom;
        else if (key === '__nom') row['Nom'] = m.nom;
        else if (key === '__sexe') row['Sexe'] = m.sexe === 'H' ? 'Homme' : 'Femme';
        else if (key === '__categorie') row['Catégorie'] = m.categorie || '';
        else if (key === '__type') row['Type'] = m.ap ? 'Ponctuel (AP)' : 'Permanent';
        else if (key === '__programmes') row['Programmes'] = m.ap || m.allProgrammes ? 'Tous les programmes' : (m.programmeIds || []).map(pid => (d.programmes.find(p => p.id === pid) || {}).nom).filter(Boolean).join(', ');
        else row[key] = (m.extra && m.extra[key]) || '';
      });
      return row;
    });
    return rows;
  }

  document.querySelectorAll('[data-export-check-group]').forEach(button => button.addEventListener('click', () => {
    const group = button.dataset.exportCheckGroup;
    const selectAll = button.dataset.exportCheckAction === 'all';
    if (group === 'exportProgFilter') {
      if (progAllCb) progAllCb.checked = selectAll;
      setProgrammeFilters(selectAll, !selectAll);
    } else {
      document.querySelectorAll(`.${group}`).forEach(checkbox => { checkbox.checked = selectAll; });
    }
    refreshExportPreview();
  }));
  ['exportSearch', 'exportSort'].forEach(id => {
    const input = document.getElementById(id);
    if (input) input.addEventListener('input', refreshExportPreview);
    if (input && id === 'exportSort') input.addEventListener('change', refreshExportPreview);
  });
  document.querySelectorAll('.exportCatFilter, .exportTypeFilter, .exportActivityFilter, .exportColCheckbox')
    .forEach(checkbox => checkbox.addEventListener('change', refreshExportPreview));
  refreshExportPreview();

  const exportXlsxBtn = document.getElementById('exportXlsxBtn');
  if (exportXlsxBtn) exportXlsxBtn.addEventListener('click', () => {
    const members = getFilteredExportMembers();
    const rows = buildExportRows(members);
    if (!rows) return;
    const ws = buildStyledSheet(rows);
    const summary = buildActivitySummarySheet(members);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Membres');
    XLSX.utils.book_append_sheet(wb, summary, 'Synthèse');
    XLSX.writeFile(wb, `carnet-sgm-export-membres-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Export Excel généré');
  });

  const exportMemberUpdateBtn = document.getElementById('exportMemberUpdateBtn');
  if (exportMemberUpdateBtn) exportMemberUpdateBtn.addEventListener('click', exportMemberUpdateWorkbook);
  const selectMemberUpdateFileBtn = document.getElementById('selectMemberUpdateFileBtn');
  const memberUpdateFileInput = document.getElementById('memberUpdateFileInput');
  if (selectMemberUpdateFileBtn && memberUpdateFileInput) {
    selectMemberUpdateFileBtn.addEventListener('click', () => {
      memberUpdateFileInput.value = '';
      memberUpdateFileInput.click();
    });
    memberUpdateFileInput.addEventListener('change', event => {
      handleMemberUpdateFile(event.target.files[0]);
    });
  }

  const exportPdfBtn = document.getElementById('exportPdfBtn');
  if (exportPdfBtn) exportPdfBtn.addEventListener('click', () => {
    const rows = buildExportRows(getFilteredExportMembers());
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
    await saveData(); showToast(ap ? 'Membre ponctuel ajouté (AP)' : 'Membre ajouté et pointable dans tous les programmes'); render();
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
