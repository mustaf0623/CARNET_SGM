/* js/views/bureau.js — Module Bureau : mandats, postes, membres, réunions, PV, stats */

const BUREAU_VIEW_LABELS = { reunions: 'Réunions', membres: 'Membres du Bureau', postes: 'Postes', stats: 'Statistiques', mandats: 'Mandats' };

function renderBureau() {
  const d = state.data;
  const mandat = activeBureauMandat(d);
  const subnav = d.bureauMandats.length ? `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0;">
      ${Object.keys(BUREAU_VIEW_LABELS).map(v => `<button class="bureau-subtab-btn ${state.bureauView === v && !state.bureauReunionId ? 'active' : ''}" data-bview="${v}">${BUREAU_VIEW_LABELS[v]}</button>`).join('')}
    </div>` : '';
  const mandatSelector = d.bureauMandats.length ? `
    <select id="bureauMandatSelect" style="min-width:200px;">
      ${d.bureauMandats.map(m => `<option value="${m.id}" ${mandat && mandat.id === m.id ? 'selected' : ''}>${escapeHtml(m.nom)}${m.actif ? ' (actif)' : ''}</option>`).join('')}
    </select>` : '';

  let body;
  if (!d.bureauMandats.length) body = renderBureauMandats(d, mandat);
  else if (state.bureauReunionId) body = renderBureauReunionDetail(d, mandat);
  else if (state.bureauView === 'membres') body = renderBureauMembres(d, mandat);
  else if (state.bureauView === 'postes') body = renderBureauPostes(d);
  else if (state.bureauView === 'stats') body = renderBureauStats(d, mandat);
  else if (state.bureauView === 'mandats') body = renderBureauMandats(d, mandat);
  else body = renderBureauReunions(d, mandat);

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Bureau</div>
        <h1 class="page-title">Gestion du Bureau</h1>
        <p class="page-sub">Membres du Bureau, réunions numérotées, procès-verbaux et statistiques de présence, par mandat.</p>
      </div>
      ${mandatSelector}
    </div>
    ${subnav}
    ${body}
  `;
}

function renderBureauMandats(d, mandat) {
  return `
    <div class="card">
      <h3 class="card-title">Mandats</h3>
      <div class="card-sub">Un mandat regroupe une composition du Bureau sur une période donnée (ex : « 2025-2026 »). Réunions, procès-verbaux et statistiques sont propres à chaque mandat.</div>
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <input type="text" id="newMandatName" placeholder="Nom du mandat (ex : 2025-2026)" style="flex:1;min-width:160px;">
        <input type="date" id="newMandatDebut" title="Date de début">
        <input type="date" id="newMandatFin" title="Date de fin (optionnel)">
        <button class="btn btn-primary" id="addMandatBtn">Créer</button>
      </div>
      <div class="ledger" style="margin-top:14px;">
        ${d.bureauMandats.map(m => `<div class="ledger-row" style="flex-wrap:wrap;gap:10px;">
          <div class="prog-name" style="flex:1;min-width:120px;">${escapeHtml(m.nom)}${m.actif ? ` <span class="pill" style="background:var(--emerald-tint);border-color:var(--emerald);color:var(--emerald-dim);">actif</span>` : ''}</div>
          <div style="font-size:11.5px;color:var(--ink-faint);">${m.dateDebut ? fmtDate(m.dateDebut) : '—'}${m.dateFin ? ' → ' + fmtDate(m.dateFin) : ''}</div>
          ${!m.actif ? `<button class="edit-name-btn set-active-mandat-btn" data-id="${m.id}">définir actif</button>` : ''}
          <button class="edit-name-btn delete-mandat-btn" data-id="${m.id}" style="color:var(--terracotta);">supprimer</button>
        </div>`).join('') || emptyRow('Aucun mandat pour l’instant créez le premier ci-dessus pour commencer.')}
      </div>
    </div>
  `;
}

function renderBureauPostes(d) {
  return `
    <div class="card">
      <h3 class="card-title">Postes du Bureau</h3>
      <div class="card-sub">Définissez les postes (Président, Secrétaire, Trésorier...) que vous pourrez ensuite attribuer aux membres.</div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <input type="text" id="newPosteName" placeholder="Nom du poste" style="flex:1;">
        <button class="btn btn-primary" id="addPosteBtn">Ajouter</button>
      </div>
      <div class="ledger" style="margin-top:14px;">
        ${d.bureauPostes.map(p => `<div class="ledger-row"><div class="prog-name" style="flex:1;">${escapeHtml(p.nom)}</div><button class="edit-name-btn delete-poste-btn" data-id="${p.id}" style="color:var(--terracotta);">supprimer</button></div>`).join('') || emptyRow('Aucun poste défini pour l’instant.')}
      </div>
    </div>
  `;
}

function renderBureauMembres(d, mandat) {
  if (!mandat) return emptyRow('Créez d’abord un mandat dans l’onglet « Mandats ».');
  const assigned = bureauMembresForMandat(d, mandat.id);
  const assignedIds = new Set(assigned.map(a => a.membreId));
  const eligible = d.membres.filter(m => !m.ap && !assignedIds.has(m.id));
  return `
    <div class="card">
      <h3 class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <span>Membres du Bureau — ${escapeHtml(mandat.nom)}</span>
        <button class="btn btn-ghost btn-sm" id="exportBureauMembersBtn">Exporter en PDF</button>
      </h3>
      <div class="card-sub">Seuls les membres de la section peuvent faire partie du Bureau.</div>
      ${!d.bureauPostes.length ? `<div style="font-size:11.5px;color:var(--terracotta-dim);margin-top:8px;">Définissez d’abord au moins un poste dans l’onglet « Postes ».</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
        <select id="newBureauMembreSelect" style="flex:1;min-width:160px;">
          <option value="">Choisir un membre permanent…</option>
          ${eligible.map(m => `<option value="${m.id}">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</option>`).join('')}
        </select>
        <select id="newBureauPosteSelect" style="min-width:160px;">
          <option value="">Choisir un poste…</option>
          ${d.bureauPostes.map(p => `<option value="${p.id}">${escapeHtml(p.nom)}</option>`).join('')}
        </select>
        <button class="btn btn-primary" id="addBureauMembreBtn">Ajouter au Bureau</button>
      </div>
      <div class="ledger" style="margin-top:14px;">
        ${assigned.map(a => `<div class="ledger-row">
          <div class="prog-name" style="flex:1;">${escapeHtml(a.membre.prenom)} ${escapeHtml(a.membre.nom)}</div>
          <span class="pill">${escapeHtml(a.poste ? a.poste.nom : 'Poste supprimé')}</span>
          <button class="edit-name-btn delete-bureau-membre-btn" data-id="${a.id}" style="color:var(--terracotta);">retirer</button>
        </div>`).join('') || emptyRow('Aucun membre du Bureau pour ce mandat.')}
      </div>
    </div>
  `;
}

function renderBureauReunions(d, mandat) {
  if (!mandat) return emptyRow('Créez d’abord un mandat dans l’onglet « Mandats ».');
  const allReunions = d.bureauReunions.filter(r => r.mandatId === mandat.id).sort((a, b) => b.numero - a.numero);
  const q = (state.bureauReunionSearch || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const reunions = q ? allReunions.filter(r =>
    norm('reunion n' + r.numero + ' ' + r.numero).includes(q) ||
    norm(fmtDate(r.date)).includes(q) ||
    norm(r.date).includes(q) ||
    norm(r.ordreDuJour).includes(q)
  ) : allReunions;
  const hasMembres = bureauMembresForMandat(d, mandat.id).length > 0;
  return `
    <div class="card">
      <h3 class="card-title">Réunions ${escapeHtml(mandat.nom)}</h3>
      ${!hasMembres ? `<div class="card-sub" style="color:var(--terracotta-dim);">Ajoutez d’abord des membres au Bureau (onglet « Membres du Bureau ») pour pouvoir créer une réunion.</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center;">
        <input type="date" id="newReunionDate" value="${todayISO()}">
        <button class="btn btn-primary" id="addReunionBtn" ${hasMembres ? '' : 'disabled'}>Nouvelle réunion (n°${nextReunionNumero(d, mandat.id)})</button>
      </div>
      <div style="font-size:11px;color:var(--ink-faint);margin-top:6px;">L’ordre du jour et le pointage se renseignent juste après, à l’ouverture de la réunion.</div>
      ${allReunions.length > 5 ? `<div style="margin-top:14px;"><input type="text" id="bureauReunionSearch" placeholder="Rechercher une réunion (numéro, date, ordre du jour...)" value="${escapeHtml(state.bureauReunionSearch || '')}" style="width:100%;"></div>` : ''}
      <div class="ledger" style="margin-top:14px;">
        ${(allReunions.length && !reunions.length) ? emptyRow('Aucune réunion ne correspond à cette recherche.') : reunions.map(r => {
          const pts = (d.bureauPointages || []).filter(p => p.reunionId === r.id);
          const extraPresents = (d.bureauPresenceExtras || []).filter(x => x.reunionId === r.id && x.statut === 'present').length;
          const present = pts.filter(p => p.statut === 'present').length + extraPresents;
          const odjLines = (r.ordreDuJour || '').split('\n').map(l => l.trim()).filter(Boolean);
          const odjPreview = odjLines.length ? odjLines[0] + (odjLines.length > 1 ? ` (+${odjLines.length - 1} autre${odjLines.length > 2 ? 's' : ''} point${odjLines.length > 2 ? 's' : ''})` : '') : '';
          return `<div class="ledger-row" style="cursor:pointer;" data-open-reunion="${r.id}">
            <div style="flex:1;">
              <div class="prog-name">Réunion n°${r.numero}${odjPreview ? ' — ' + escapeHtml(odjPreview) : ''}</div>
              <div style="font-size:11.5px;color:var(--ink-faint);">${fmtDate(r.date)} · ${present} présent(s) / ${pts.length + extraPresents} pointé(s)${r.pvTexte || r.pvLien ? ' · PV disponible' : ''}</div>
            </div>
            <button class="edit-name-btn delete-reunion-btn" data-id="${r.id}" style="color:var(--terracotta);">supprimer</button>
          </div>`;
        }).join('') || emptyRow('Aucune réunion pour ce mandat.')}
      </div>
    </div>
  `;
}

function renderBureauReunionDetail(d, mandat) {
  const r = d.bureauReunions.find(x => x.id === state.bureauReunionId);
  if (!r) { state.bureauReunionId = null; return renderBureauReunions(d, mandat); }
  const membres = bureauMembresForMandat(d, r.mandatId);
  const pointagesMap = new Map((d.bureauPointages || []).filter(p => p.reunionId === r.id).map(p => [p.membreId, p.statut]));
  const extraPresences = bureauExtraPresencesForReunion(d, r.id);
  return `
    <div class="card">
      <button class="btn btn-ghost btn-sm" id="backToReunionsBtn">← Retour aux réunions</button>
      <h3 class="card-title" style="margin-top:12px;">Réunion n°${r.numero}</h3>
      <div class="field" style="margin-top:12px;max-width:220px;"><label>Date</label><input type="date" id="reunionDateInput" value="${r.date}"></div>
      <div class="field" style="margin-top:10px;">
        <label>Ordre du jour</label>
        <textarea id="reunionOdjInput" placeholder="Un point par ligne…" style="width:100%;min-height:110px;padding:10px 12px;font-family:inherit;font-size:13.5px;line-height:1.7;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);">${escapeHtml(r.ordreDuJour || '')}</textarea>
        <div style="font-size:11px;color:var(--ink-faint);margin-top:4px;">Chaque ligne devient un point distinct de l’ordre du jour, y compris dans le PDF.</div>
      </div>
      <button class="btn btn-ghost btn-sm" id="saveReunionInfoBtn" style="margin-top:6px;">Enregistrer la date / l’ordre du jour</button>

      <div class="card-title" style="font-size:14px;margin:20px 0 8px;">Pointage des membres du Bureau</div>
      <div id="bureauMemberList">
        ${membres.map(bm => memberRow(bm.membre, pointagesMap.get(bm.membreId), true)).join('') || emptyRow('Aucun membre du Bureau à pointer pour ce mandat.')}
      </div>
      <button class="btn btn-primary" id="saveReunionPointageBtn" style="margin-top:10px;">Enregistrer le pointage</button>

      <div style="margin-top:18px;padding:12px;border:1px dashed var(--line);border-radius:12px;background:var(--card-2);">
        <div class="card-title" style="font-size:13px;margin:0 0 4px;">Invités présents (hors Bureau officiel)</div>
        <div class="card-sub" style="margin-bottom:8px;">Personnes présentes à la réunion qui ne font pas partie du bureau. N’entrent jamais dans les statistiques du Bureau.</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <input type="text" id="extraPresentName" placeholder="Nom de l’invité" style="flex:1;min-width:180px;">
          <input type="text" id="extraPresentPoste" placeholder="Fonction / motif (optionnel)" style="min-width:150px;">
          <button class="btn btn-ghost btn-sm" id="addExtraPresentBtn">Ajouter</button>
        </div>
        <div id="extraPresentList" style="margin-top:8px;display:flex;flex-direction:column;gap:6px;">
          ${extraPresences.length ? extraPresences.map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--card);">
              <span>${escapeHtml(item.name || '')}${item.poste ? ' · ' + escapeHtml(item.poste) : ''}</span>
              <button type="button" class="btn btn-ghost btn-sm delete-extra-present-btn" data-id="${item.id}">Retirer</button>
            </div>
          `).join('') : '<div style="font-size:12px;color:var(--ink-faint);">Aucun invité ajouté pour cette réunion.</div>'}
        </div>
      </div>

      <div class="card-title" style="font-size:14px;margin:22px 0 8px;">Procès-verbal</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
        <button type="button" class="btn btn-ghost btn-sm" id="pvBoldBtn">Gras</button>
        <button type="button" class="btn btn-ghost btn-sm" id="pvTitleBtn">Titre</button>
        <button type="button" class="btn btn-ghost btn-sm" id="pvSubtitleBtn">Sous-titre</button>
        <button type="button" class="btn btn-ghost btn-sm" id="pvBulletBtn">Liste</button>
      </div>
      <textarea id="reunionPvTexte" placeholder="Rédigez le procès-verbal ici…" style="width:100%;min-height:220px;padding:12px;font-family:inherit;font-size:13.5px;line-height:1.6;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);">${escapeHtml(r.pvTexte || '')}</textarea>
      <div style="font-size:11.5px;color:var(--ink-faint);margin-top:8px;">Sélectionnez du texte puis cliquez « Gras » pour le mettre en gras. « Titre »/« Sous-titre »/« Liste » s’appliquent automatiquement en début de ligne.</div>
      <div class="field" style="margin-top:10px;"><label>Ou lien vers un fichier déjà rédigé (Drive, PDF, Word...)</label><input type="text" id="reunionPvLien" placeholder="https://drive.google.com/…" value="${escapeHtml(r.pvLien || '')}" style="width:100%;"></div>
      <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="savePvBtn">Enregistrer le procès-verbal</button>
        <button class="btn btn-ghost" id="exportPvBtn">Exporter le PV en PDF</button>
      </div>
    </div>
  `;
}

function renderBureauStats(d, mandat) {
  if (!mandat) return emptyRow('Créez d’abord un mandat dans l’onglet « Mandats ».');
  const g = bureauGlobalStats(d, mandat.id);
  const rows = bureauMembresForMandat(d, mandat.id).map(bm => ({ bm, stats: bureauMemberStats(d, bm.membreId, mandat.id) }));
  return `
    <div class="grid grid-4" style="margin-bottom:18px;">
      ${statCard('Membres du Bureau', g.nbMembres, '', 'stat-emerald')}
      ${statCard('Réunions', g.nbReunions, '', 'stat-gold')}
      ${statCard('Taux de présence', g.tauxPresence + '%', 'membres officiels', 'stat-emerald')}
      ${statCard('Taux d’absence', g.tauxAbsence + '%', 'membres officiels', 'stat-terracotta')}
    </div>
    <div class="card">
      <h3 class="card-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
        <span>Statistiques par membre ${escapeHtml(mandat.nom)}</span>
        <button class="btn btn-ghost btn-sm" id="exportBureauStatsBtn">Exporter en PDF</button>
      </h3>
      <div class="ledger">
        ${rows.map(({ bm, stats }) => `<div class="ledger-row">
          <div style="flex:1;">
            <button type="button" class="member-name-link bureau-stats-member-link" data-id="${bm.membreId}" style="background:none;border:none;padding:0;font-size:13.5px;font-weight:700;color:var(--ink);cursor:pointer;text-decoration:underline;text-decoration-color:var(--line-strong);text-align:left;">${escapeHtml(bm.membre.prenom)} ${escapeHtml(bm.membre.nom)}</button>
            <div style="font-size:11.5px;color:var(--ink-faint);">${escapeHtml(bm.poste ? bm.poste.nom : '—')} · ${stats.present} présence(s) · ${stats.absent} absence(s)</div>
          </div>
          <span class="pill" style="background:var(--emerald-tint);border-color:var(--emerald);color:var(--emerald-dim);font-weight:700;">Prés. ${stats.tauxPresence}% · Abs. ${stats.tauxAbsence}%</span>
        </div>`).join('') || emptyRow('Aucun membre du Bureau pour ce mandat.')}
      </div>
    </div>
  `;
}

function attachBureauEvents() {
  const d = state.data;

  const mandatSel = document.getElementById('bureauMandatSelect');
  if (mandatSel) mandatSel.addEventListener('change', e => { state.bureauMandatId = e.target.value; state.bureauReunionId = null; render(); });

  document.querySelectorAll('.bureau-subtab-btn[data-bview]').forEach(btn => btn.addEventListener('click', () => {
    state.bureauView = btn.dataset.bview; state.bureauReunionId = null; render();
  }));

  document.querySelectorAll('.bureau-stats-member-link').forEach(btn => btn.addEventListener('click', () => {
    state.bureauMemberDetailMembreId = btn.dataset.id; render();
  }));

  const bureauReunionSearch = document.getElementById('bureauReunionSearch');
  if (bureauReunionSearch) bureauReunionSearch.addEventListener('input', e => {
    state.bureauReunionSearch = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const again = document.getElementById('bureauReunionSearch');
    if (again) { again.focus(); again.setSelectionRange(pos, pos); }
  });

  // ---- Mandats ----
  const addMandatBtn = document.getElementById('addMandatBtn');
  if (addMandatBtn) addMandatBtn.addEventListener('click', async () => {
    const nom = document.getElementById('newMandatName').value.trim();
    if (!nom) { showToast('Indiquez un nom de mandat'); return; }
    const dateDebut = document.getElementById('newMandatDebut').value || '';
    const dateFin = document.getElementById('newMandatFin').value || '';
    const isFirst = !d.bureauMandats.length;
    const mandat = { id: uid(), nom, dateDebut, dateFin, actif: isFirst };
    d.bureauMandats.push(mandat);
    state.bureauMandatId = mandat.id;
    await saveData();
    showToast('Mandat créé'); render();
  });
  document.querySelectorAll('.set-active-mandat-btn').forEach(btn => btn.addEventListener('click', async () => {
    d.bureauMandats.forEach(m => { m.actif = m.id === btn.dataset.id; });
    state.bureauMandatId = btn.dataset.id;
    await saveData(); showToast('Mandat actif mis à jour'); render();
  }));
  document.querySelectorAll('.delete-mandat-btn').forEach(btn => btn.addEventListener('click', () => {
    const mandat = d.bureauMandats.find(m => m.id === btn.dataset.id);
    openConfirm(
      'Supprimer ce mandat ?',
      `Le mandat « ${mandat ? mandat.nom : ''} », ses membres du Bureau, ses réunions et procès-verbaux seront définitivement supprimés.`,
      async () => {
        const id = btn.dataset.id;
        const reunionIds = new Set(d.bureauReunions.filter(r => r.mandatId === id).map(r => r.id));
        d.bureauPointages = d.bureauPointages.filter(p => !reunionIds.has(p.reunionId));
        d.bureauReunions = d.bureauReunions.filter(r => r.mandatId !== id);
        d.bureauMembres = d.bureauMembres.filter(m => m.mandatId !== id);
        d.bureauMandats = d.bureauMandats.filter(m => m.id !== id);
        if (state.bureauMandatId === id) state.bureauMandatId = null;
        await saveData(); showToast('Mandat supprimé'); render();
      },
      'Supprimer'
    );
  }));

  // ---- Postes ----
  const addPosteBtn = document.getElementById('addPosteBtn');
  if (addPosteBtn) addPosteBtn.addEventListener('click', async () => {
    const nom = document.getElementById('newPosteName').value.trim();
    if (!nom) { showToast('Indiquez un nom de poste'); return; }
    d.bureauPostes.push({ id: uid(), nom });
    await saveData(); showToast('Poste ajouté'); render();
  });
  document.querySelectorAll('.delete-poste-btn').forEach(btn => btn.addEventListener('click', () => {
    openConfirm('Supprimer ce poste ?', 'Les membres qui l’occupaient resteront dans le Bureau mais sans poste assigné.', async () => {
      d.bureauPostes = d.bureauPostes.filter(p => p.id !== btn.dataset.id);
      await saveData(); showToast('Poste supprimé'); render();
    }, 'Supprimer');
  }));

  // ---- Membres du Bureau ----
  const addBureauMembreBtn = document.getElementById('addBureauMembreBtn');
  if (addBureauMembreBtn) addBureauMembreBtn.addEventListener('click', async () => {
    const membreId = document.getElementById('newBureauMembreSelect').value;
    const posteId = document.getElementById('newBureauPosteSelect').value;
    if (!membreId || !posteId) { showToast('Choisissez un membre et un poste'); return; }
    const mandat = activeBureauMandat(d);
    if (!mandat) return;
    d.bureauMembres.push({ id: uid(), mandatId: mandat.id, membreId, posteId });
    await saveData(); showToast('Membre ajouté au Bureau'); render();
  });
  document.querySelectorAll('.delete-bureau-membre-btn').forEach(btn => btn.addEventListener('click', () => {
    openConfirm('Retirer ce membre du Bureau ?', 'Ses pointages de réunions passées pour ce mandat resteront visibles dans l’historique.', async () => {
      d.bureauMembres = d.bureauMembres.filter(m => m.id !== btn.dataset.id);
      await saveData(); showToast('Membre retiré du Bureau'); render();
    }, 'Retirer');
  }));

  // ---- Réunions ----
  const addReunionBtn = document.getElementById('addReunionBtn');
  if (addReunionBtn) addReunionBtn.addEventListener('click', async () => {
    const mandat = activeBureauMandat(d);
    if (!mandat) return;
    const date = document.getElementById('newReunionDate').value || todayISO();
    const ordreDuJour = '';
    const numero = nextReunionNumero(d, mandat.id);
    const reunion = { id: uid(), mandatId: mandat.id, numero, date, ordreDuJour, pvTexte: '', pvLien: '' };
    d.bureauReunions.push(reunion);
    await saveData();
    state.bureauReunionId = reunion.id;
    showToast('Réunion n°' + numero + ' créée');
    render();
  });
  document.querySelectorAll('[data-open-reunion]').forEach(row => row.addEventListener('click', e => {
    if (e.target.closest('.delete-reunion-btn')) return;
    state.bureauReunionId = row.dataset.openReunion;
    render();
  }));
  document.querySelectorAll('.delete-reunion-btn').forEach(btn => btn.addEventListener('click', e => {
    e.stopPropagation();
    openConfirm('Supprimer cette réunion ?', 'Le pointage et le procès-verbal associés seront définitivement supprimés.', async () => {
      const id = btn.dataset.id;
      d.bureauPointages = d.bureauPointages.filter(p => p.reunionId !== id);
      d.bureauReunions = d.bureauReunions.filter(r => r.id !== id);
      await saveData(); showToast('Réunion supprimée'); render();
    }, 'Supprimer');
  }));

  // ---- Détail réunion : pointage + PV ----
  const backBtn = document.getElementById('backToReunionsBtn');
  if (backBtn) backBtn.addEventListener('click', () => { state.bureauReunionId = null; render(); });

  document.querySelectorAll('#bureauMemberList .member-name-link').forEach(btn => btn.addEventListener('click', () => {
    state.bureauMemberDetailMembreId = btn.dataset.id; render();
  }));
  document.querySelectorAll('#bureauMemberList .status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.member-row');
      const wasActive = btn.classList.contains('active');
      const onlyOneBtn = row.querySelectorAll('.status-btn').length === 1;
      row.querySelectorAll('.status-btn').forEach(b => {
        b.classList.remove('active'); b.querySelector('.stamp')?.remove();
        if (onlyOneBtn) b.textContent = 'Absent';
      });
      if (onlyOneBtn && wasActive) return;
      btn.classList.add('active');
      if (btn.dataset.statut === 'present') {
        btn.textContent = '✓ Présent';
        const s = document.createElement('span'); s.className = 'stamp'; s.innerHTML = ICONS.stamp;
        btn.appendChild(s);
      }
    });
  });

  const saveReunionInfoBtn = document.getElementById('saveReunionInfoBtn');
  if (saveReunionInfoBtn) saveReunionInfoBtn.addEventListener('click', async () => {
    const r = d.bureauReunions.find(x => x.id === state.bureauReunionId);
    if (!r) return;
    r.date = document.getElementById('reunionDateInput').value || r.date;
    r.ordreDuJour = document.getElementById('reunionOdjInput').value.trim();
    await saveData(); showToast('Réunion mise à jour'); render();
  });

  const saveReunionPointageBtn = document.getElementById('saveReunionPointageBtn');
  if (saveReunionPointageBtn) saveReunionPointageBtn.addEventListener('click', async () => {
    const reunionId = state.bureauReunionId;
    const rows = document.querySelectorAll('#bureauMemberList .member-row');
    let marked = 0;
    rows.forEach(row => {
      const membreId = row.dataset.membre;
      const active = row.querySelector('.status-btn.active');
      const statut = active ? active.dataset.statut : 'absent'; // pointage rapide uniquement ici : tout présent, décochez les absents
      d.bureauPointages = d.bureauPointages.filter(p => !(p.reunionId === reunionId && p.membreId === membreId));
      d.bureauPointages.push({ id: uid(), reunionId, membreId, statut });
      marked++;
    });
    await saveData();
    showToast('Pointage enregistré (' + marked + ' membres)');
    render();
  });

  const pvTextarea = document.getElementById('reunionPvTexte');
  const addExtraPresentBtn = document.getElementById('addExtraPresentBtn');
  if (addExtraPresentBtn) addExtraPresentBtn.addEventListener('click', async () => {
    const name = document.getElementById('extraPresentName').value.trim();
    if (!name) { showToast('Indiquez un nom pour le présent supplémentaire'); return; }
    const reunionId = state.bureauReunionId;
    if (!reunionId) return;
    d.bureauPresenceExtras = d.bureauPresenceExtras || [];
    d.bureauPresenceExtras.push({ id: uid(), reunionId, name, poste: document.getElementById('extraPresentPoste').value.trim(), statut: 'present' });
    await saveData();
    document.getElementById('extraPresentName').value = '';
    document.getElementById('extraPresentPoste').value = '';
    showToast('Présent supplémentaire ajouté');
    render();
  });
  document.querySelectorAll('.delete-extra-present-btn').forEach(btn => btn.addEventListener('click', async () => {
    const id = btn.dataset.id;
    if (!id) return;
    d.bureauPresenceExtras = (d.bureauPresenceExtras || []).filter(x => x.id !== id);
    await saveData(); showToast('Présent supplémentaire retiré'); render();
  }));

  const applyPvFormat = (prefix, suffix = '', blockLevel = false) => {
    if (!pvTextarea) return;
    const start = pvTextarea.selectionStart;
    const end = pvTextarea.selectionEnd;
    const value = pvTextarea.value;
    const selected = value.slice(start, end) || 'texte';
    // Un titre/sous-titre/puce n'est reconnu qu'en tout début de ligne : si
    // le curseur n'y est pas déjà, on insère un saut de ligne avant.
    let insertPrefix = prefix;
    if (blockLevel && start > 0 && value[start - 1] !== '\n') insertPrefix = '\n' + prefix;
    const insert = `${insertPrefix}${selected}${suffix}`;
    pvTextarea.setRangeText(insert, start, end, 'end');
    pvTextarea.focus();
  };

  const pvBoldBtn = document.getElementById('pvBoldBtn');
  if (pvBoldBtn) pvBoldBtn.addEventListener('click', () => applyPvFormat('**', '**'));
  const pvTitleBtn = document.getElementById('pvTitleBtn');
  if (pvTitleBtn) pvTitleBtn.addEventListener('click', () => applyPvFormat('# ', '', true));
  const pvSubtitleBtn = document.getElementById('pvSubtitleBtn');
  if (pvSubtitleBtn) pvSubtitleBtn.addEventListener('click', () => applyPvFormat('## ', '', true));
  const pvBulletBtn = document.getElementById('pvBulletBtn');
  if (pvBulletBtn) pvBulletBtn.addEventListener('click', () => applyPvFormat('- ', '', true));

  const savePvBtn = document.getElementById('savePvBtn');
  if (savePvBtn) savePvBtn.addEventListener('click', async () => {
    const r = d.bureauReunions.find(x => x.id === state.bureauReunionId);
    if (!r) return;
    r.pvTexte = pvTextarea ? pvTextarea.value : '';
    r.pvLien = document.getElementById('reunionPvLien').value.trim();
    await saveData(); showToast('Procès-verbal enregistré'); render();
  });

  const exportPvBtn = document.getElementById('exportPvBtn');
  if (exportPvBtn) exportPvBtn.addEventListener('click', () => {
    const r = d.bureauReunions.find(x => x.id === state.bureauReunionId);
    const mandat = d.bureauMandats.find(m => m.id === r.mandatId);
    const membres = bureauMembresForMandat(d, r.mandatId);
    buildProcesVerbalPdf(r, mandat, membres, d);
    showToast('Procès-verbal PDF généré');
  });

  const exportMembersBtn = document.getElementById('exportBureauMembersBtn');
  if (exportMembersBtn) exportMembersBtn.addEventListener('click', () => {
    const mandat = activeBureauMandat(d);
    if (!mandat) return;
    buildBureauMembersPdf(mandat, d);
    showToast('Liste des membres du Bureau exportée en PDF');
  });

  const exportStatsBtn = document.getElementById('exportBureauStatsBtn');
  if (exportStatsBtn) exportStatsBtn.addEventListener('click', () => {
    const mandat = activeBureauMandat(d);
    if (!mandat) return;
    buildBureauStatsPdf(mandat, d);
    showToast('Statistiques PDF générées');
  });
}
