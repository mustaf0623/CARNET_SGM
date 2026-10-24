/* js/views/pointage.js — Onglet Pointage */

/* ================= POINTAGE ================= */
function renderPointage() {
  const d = state.data;
  if (!d.programmes.length) return `<div class="page-head"><div><div class="eyebrow">Registre</div><h1 class="page-title">Pointage</h1></div></div>
    <div class="card empty-state">${ICONS.pointage}<h3 style="color:var(--ink);margin:0 0 6px;">Aucun programme</h3><p>Créez d’abord un programme dans l’onglet Membres.</p></div>`;
  if (!state.pointageProgId) state.pointageProgId = d.programmes[0].id;
  const prog = d.programmes.find(p => p.id === state.pointageProgId);
  const pastSessions = d.sessions.filter(s => s.programmeId === state.pointageProgId).sort((a, b) => b.date.localeCompare(a.date));
  const selectedSession = state.pointageSessionId === 'new'
    ? null
    : d.sessions.find(s => s.id === state.pointageSessionId);
  const legacySession = !!selectedSession && !selectedSession.heureDebut && !selectedSession.heureFin;
  const canMarkAttendance = !!selectedSession && (!!selectedSession.heureDebut || legacySession);
  const canSaveAttendance = !!selectedSession && (!!selectedSession.heureFin || legacySession);

  let currentPointages = {};
  if (state.pointageSessionId !== 'new') {
    d.pointages.filter(p => p.sessionId === state.pointageSessionId).forEach(p => currentPointages[p.membreId] = p.statut);
  }
  let membres = d.membres.filter(m => memberInProgramme(m, state.pointageProgId));

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Registre</div>
        <h1 class="page-title">Pointage</h1>
        <p class="page-sub">Marquez la présence ou l’absence pour une séance d’un programme.</p>
      </div>
    </div>
    <div class="pointage-controls">
      <div class="field">
        <label>Programme</label>
        <select id="progSelect">${d.programmes.map(p => `<option value="${p.id}" ${p.id === state.pointageProgId ? 'selected' : ''}>${escapeHtml(p.nom)}</option>`).join('')}</select>
      </div>
      <div class="field">
        <label>Période</label>
        <select id="sessionSelect">
          <option value="new" ${state.pointageSessionId === 'new' ? 'selected' : ''}>+ Nouvelle période</option>
          ${sessionOptionsByYear(pastSessions, state.pointageSessionId)}
        </select>
      </div>
      ${!selectedSession ? `
      <div class="field"><label>Date</label><input type="date" id="sessionDate" value="${state.pointageDate}"></div>
      <div class="field"><label>Lieu</label><input type="text" id="sessionLieu" placeholder="Lieu du programme" value="${escapeHtml(state.pointageLieu)}"></div>
      ` : ''}
    </div>
    <div class="card">
      <h3 class="card-title">${escapeHtml(prog.nom)}</h3>
      ${selectedSession ? `<div class="card-sub" style="margin-bottom:12px;">
        Lieu : ${escapeHtml(sessionLieu(selectedSession) || 'Non renseigné')}
        ${sessionHours(selectedSession) ? ' · Horaires : ' + escapeHtml(sessionHours(selectedSession)) : ''}
      </div>` : ''}
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">
        ${!selectedSession
          ? `<button class="btn btn-primary" id="startSessionBtn">${ICONS.mark} Marquer l’heure de début</button>
             <span style="font-size:12px;color:var(--ink-faint);">Le pointage sera déverrouillé au démarrage du programme.</span>`
          : selectedSession.heureDebut && !selectedSession.heureFin
            ? `<button class="btn btn-primary" id="endSessionBtn">${ICONS.mark} Marquer l’heure de fin</button>
               <span style="font-size:12px;color:var(--ink-faint);">Le pointage est ouvert. Marquez l’heure de fin pour pouvoir l’enregistrer.</span>`
            : legacySession
              ? `<span style="font-size:12px;color:var(--ink-faint);">Ancienne séance, horaires non renseignés.</span>`
              : selectedSession.heureFin
                ? `<span style="font-size:12px;color:var(--ink-faint);">Programme terminé : ${escapeHtml(sessionHours(selectedSession))}</span>`
                : ''}
      </div>
      <div class="card-sub" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span>${membres.length} membre${membres.length > 1 ? 's' : ''} inscrit${membres.length > 1 ? 's' : ''}</span>
        <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink-dim);font-weight:600;cursor:pointer;">
          <input type="checkbox" id="fastModeToggle" ${state.pointageFastMode ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--emerald);">
          Pointage rapide tout le monde est absent par défaut, cochez les présents
        </label>
      </div>
      <div id="memberList">
        ${membres.length ? membres.map(m => memberRow(m, currentPointages[m.id], state.pointageFastMode, !canMarkAttendance)).join('') : emptyRow('Aucun membre inscrit à ce programme.')}
      </div>
      ${membres.length ? `<div style="margin-top:20px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;">
        ${selectedSession ? `<button class="btn btn-ghost" id="deleteSessionBtn" style="color:var(--terracotta);border-color:var(--terracotta-tint);">Supprimer cette séance</button>` : '<span></span>'}
        <button class="btn btn-primary" id="saveSession" ${canSaveAttendance ? '' : 'disabled'}>${ICONS.mark} Enregistrer le pointage</button>
      </div>` : ''}
    </div>
  `;
}
function sessionOptionsByYear(sessions, selectedId) {
  const byYear = {};
  sessions.forEach(s => { const y = sessionYear(s.date); (byYear[y] = byYear[y] || []).push(s); });
  return Object.keys(byYear).sort((a, b) => b.localeCompare(a)).map(y =>
    `<optgroup label="${y}">${byYear[y].map(s => `<option value="${s.id}" ${s.id === selectedId ? 'selected' : ''}>${fmtDate(s.date)} — ${escapeHtml(sessionLieu(s))}</option>`).join('')}</optgroup>`
  ).join('');
}
function memberRow(m, statut, fastMode, disabled) {
  // En mode rapide, un membre pas encore pointé pour cette séance démarre
  // "absent" par défaut : il suffit de cocher les présents. Un statut déjà
  // enregistré (present/absent) est toujours
  // respecté tel quel.
  const effectiveStatut = fastMode && statut === undefined ? 'absent' : statut;
  const statusHtml = fastMode
    ? `<div class="status-toggle">
      <button class="status-btn present ${effectiveStatut === 'present' ? 'active' : ''}" data-statut="present" style="min-width:110px;" ${disabled ? 'disabled' : ''}>${effectiveStatut === 'present' ? '✓ Présent' : 'Absent'}</button>
    </div>`
    : `<div class="status-toggle">
      <button class="status-btn present ${statut === 'present' ? 'active' : ''}" data-statut="present" ${disabled ? 'disabled' : ''}>Présent</button>
      <button class="status-btn absent ${statut === 'absent' ? 'active' : ''}" data-statut="absent" ${disabled ? 'disabled' : ''}>Absent</button>
    </div>`;
  return `<div class="member-row" data-membre="${m.id}">
    <div class="member-avatar">${initials(m.nom, m.prenom)}</div>
    <div class="member-info">
      <button type="button" class="member-name-link" data-id="${m.id}" style="background:none;border:none;padding:0;font-size:13.5px;font-weight:700;color:var(--ink);cursor:pointer;text-decoration:underline;text-decoration-color:var(--line-strong);text-align:left;">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</button>${m.ap ? ` <span class="pill" style="background:var(--gold-tint);border-color:var(--gold);color:var(--gold);font-size:10px;">AP</span>` : ''}
      <div class="member-meta">${m.sexe === 'H' ? 'Homme' : 'Femme'}</div>
    </div>
    ${statusHtml}
  </div>`;
}
function attachPointageEvents() {
  const d = state.data;
  const progSel = document.getElementById('progSelect');
  if (progSel) progSel.addEventListener('change', e => { state.pointageProgId = e.target.value; state.pointageSessionId = 'new'; state.pointageLieu = ''; render(); });
  const sessSel = document.getElementById('sessionSelect');
  if (sessSel) sessSel.addEventListener('change', e => { state.pointageSessionId = e.target.value; if (e.target.value === 'new') state.pointageLieu = ''; render(); });
  const fastToggle = document.getElementById('fastModeToggle');
  if (fastToggle) fastToggle.addEventListener('change', e => { state.pointageFastMode = e.target.checked; render(); });
  const dateInput = document.getElementById('sessionDate');
  if (dateInput) dateInput.addEventListener('change', e => state.pointageDate = e.target.value);
  const lieuInput = document.getElementById('sessionLieu');
  if (lieuInput) lieuInput.addEventListener('input', e => state.pointageLieu = e.target.value);
  const startSessionBtn = document.getElementById('startSessionBtn');
  if (startSessionBtn) startSessionBtn.addEventListener('click', async () => {
    if (state.pointageSessionId !== 'new') return;
    startSessionBtn.disabled = true;
    const lieu = (document.getElementById('sessionLieu')?.value || '').trim();
    const date = document.getElementById('sessionDate')?.value || '';
    if (!date) { showToast('Veuillez choisir la date du programme'); return; }
    const session = {
      id: uid(), programmeId: state.pointageProgId, date,
      label: lieu || 'Séance', lieu, heureDebut: new Date().toISOString(), heureFin: '',
    };
    d.sessions.push(session);
    state.pointageSessionId = session.id;
    state.pointageLieu = lieu;
    await saveData();
    showToast('Heure de début enregistrée pointage déverrouillé');
    render();
  });
  const endSessionBtn = document.getElementById('endSessionBtn');
  if (endSessionBtn) endSessionBtn.addEventListener('click', async () => {
    const session = d.sessions.find(s => s.id === state.pointageSessionId);
    if (!session || !session.heureDebut || session.heureFin) return;
    session.heureFin = new Date().toISOString();
    await saveData();
    showToast('Heure de fin enregistrée pointage prêt à enregistrer');
    render();
  });
  const deleteSessBtn = document.getElementById('deleteSessionBtn');
  if (deleteSessBtn) deleteSessBtn.addEventListener('click', () => {
    const sess = d.sessions.find(s => s.id === state.pointageSessionId);
    openConfirm(
      'Supprimer cette séance ?',
      'Le pointage enregistré pour « ' + (sess ? sessionLieu(sess) : 'cette séance') + ' » sera définitivement supprimé.',
      async () => {
        d.pointages = d.pointages.filter(p => p.sessionId !== state.pointageSessionId);
        d.sessions = d.sessions.filter(s => s.id !== state.pointageSessionId);
        await saveData();
        state.pointageSessionId = 'new';
        showToast('Séance supprimée');
        render();
      }
    );
  });

  document.querySelectorAll('.member-name-link').forEach(btn => btn.addEventListener('click', () => {
    state.memberDetailId = btn.dataset.id;
    render();
  }));

  document.querySelectorAll('.status-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const row = btn.closest('.member-row');
      if (btn.disabled) return;
      const wasActive = btn.classList.contains('active');
      const onlyOneBtn = row.querySelectorAll('.status-btn').length === 1;
      row.querySelectorAll('.status-btn').forEach(b => {
        b.classList.remove('active'); b.querySelector('.stamp')?.remove();
        if (onlyOneBtn) b.textContent = 'Absent';
      });
      if (onlyOneBtn && wasActive) return; // re-clic sur "Présent" déjà actif : il redevient absent
      btn.classList.add('active');
      if (btn.dataset.statut === 'present') {
        btn.textContent = '✓ Présent';
        const s = document.createElement('span'); s.className = 'stamp'; s.innerHTML = ICONS.stamp;
        btn.appendChild(s);
      }
    });
  });

  const saveBtn = document.getElementById('saveSession');
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    let sessionId = state.pointageSessionId;
    const session = d.sessions.find(s => s.id === sessionId);
    if (!session) {
      showToast('Marquez d’abord l’heure de début du programme');
      return;
    }
    if (session.heureDebut && !session.heureFin) {
      showToast('Marquez l’heure de fin du programme avant d’enregistrer');
      return;
    }
    const rows = document.querySelectorAll('#memberList .member-row');
    let marked = 0;
    let apTouched = [];
    rows.forEach(row => {
      const membreId = row.dataset.membre;
      const active = row.querySelector('.status-btn.active');
      let statut;
      if (active) statut = active.dataset.statut;
      else if (state.pointageFastMode) statut = 'absent';
      else return;
      d.pointages = d.pointages.filter(p => !(p.sessionId === sessionId && p.membreId === membreId));
      d.pointages.push({ id: uid(), sessionId, membreId, statut });
      marked++;
      const membre = d.membres.find(m => m.id === membreId);
      if (membre && membre.ap) apTouched.push(membre);
    });
    const promoted = apTouched.filter(m => checkApPromotion(d, m.id));
    if (promoted.length) state.completeInfoQueue = (state.completeInfoQueue || []).concat(promoted.map(m => m.id));
    await saveData();
    state.pointageSessionId = sessionId;
    showToast(marked
      ? 'Pointage enregistré (' + marked + ' membres)' + (promoted.length ? ' — ' + promoted.map(m => m.prenom + ' ' + m.nom).join(', ') + ' intégré(s) définitivement à la base' : '')
      : 'Aucun statut sélectionné');
    render();
  });
}
