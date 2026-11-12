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
  const selectedSessionLieu = selectedSession ? sessionAttendanceLieu(selectedSession) : '';
  const canMarkAttendance = !!selectedSession && (!!selectedSession.heureDebut || legacySession);
  const canSaveAttendance = !!selectedSession && (!!selectedSession.heureFin || legacySession) && !!selectedSessionLieu.trim();

  let currentPointages = {};
  if (state.pointageSessionId !== 'new') {
    d.pointages.filter(p => p.sessionId === state.pointageSessionId).forEach(p => currentPointages[p.membreId] = p);
  }
  const programmeSessionIds = new Set(d.sessions
    .filter(session => session.programmeId === state.pointageProgId && session.id !== state.pointageSessionId)
    .map(session => session.id));
  const presencesParMembre = new Map();
  d.pointages.forEach(pointage => {
    if (programmeSessionIds.has(pointage.sessionId) && pointage.statut === 'present') {
      presencesParMembre.set(pointage.membreId, (presencesParMembre.get(pointage.membreId) || 0) + 1);
    }
  });
  const membres = d.membres
    .filter(m => memberInProgramme(m, state.pointageProgId))
    .sort((a, b) => {
      const priorityDifference = Number(isPriorityProgram(prog, b.categorie)) - Number(isPriorityProgram(prog, a.categorie));
      if (priorityDifference) return priorityDifference;
      const attendanceDifference = (presencesParMembre.get(b.id) || 0) - (presencesParMembre.get(a.id) || 0);
      if (attendanceDifference) return attendanceDifference;
      return `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr', { sensitivity: 'base' });
    });
  
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
      <div class="pointage-list-header">
        <h3 class="card-title">${escapeHtml(prog.nom)}</h3>
        <label class="pointage-search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></svg>
          <input type="text" id="memberSearch" placeholder="Rechercher un membre ou une catégorie" aria-label="Rechercher un membre ou une catégorie">
        </label>
      </div>
      ${selectedSession ? `<div class="card-sub" id="sessionSummary" style="margin-bottom:12px;">
        Lieu : ${escapeHtml(selectedSessionLieu || 'Non renseigné')}
        ${sessionHours(selectedSession) ? ' · Horaires : ' + escapeHtml(sessionHours(selectedSession)) : ''}
      </div>` : ''}
      <div id="sessionStatus" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">
        ${!selectedSession
          ? `<div class="field"><label for="startSessionTime">Heure de début</label><input type="time" id="startSessionTime"></div>
             <button class="btn btn-primary" id="startSessionBtn">${ICONS.mark} Marquer l’heure de début</button>
             <span style="font-size:12px;color:var(--ink-faint);">Le pointage sera déverrouillé au démarrage du programme.</span>`
          : selectedSession.heureDebut && !selectedSession.heureFin
            ? `<div class="field"><label for="endSessionTime">Heure de fin</label><input type="time" id="endSessionTime"></div>
               <button class="btn btn-primary" id="endSessionBtn">${ICONS.mark} Marquer l’heure de fin</button>
               <span style="font-size:12px;color:var(--ink-faint);">Marquez l’heure de fin et renseignez le lieu pour enregistrer le pointage.</span>`
            : legacySession
              ? `<span style="font-size:12px;color:var(--ink-faint);">Ancienne séance — horaires non renseignés.</span>`
              : selectedSession.heureFin
                ? `<span style="font-size:12px;color:var(--ink-faint);">Programme terminé : ${escapeHtml(sessionHours(selectedSession))}</span>`
                : ''}
      </div>
      ${selectedSession && !selectedSessionLieu ? `<div class="field" style="max-width:320px;margin-bottom:14px;">
        <label for="sessionVenueInput">Lieu</label>
        <input type="text" id="sessionVenueInput" placeholder="Saisissez le lieu du programme" value="${escapeHtml(state.pointageLieu || '')}">
      </div>` : ''}
      <div class="card-sub" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span>${membres.length} membre${membres.length > 1 ? 's' : ''} inscrit${membres.length > 1 ? 's' : ''}</span>
        <label style="display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ink-dim);font-weight:600;cursor:pointer;">
          <input type="checkbox" id="fastModeToggle" ${state.pointageFastMode ? 'checked' : ''} style="width:15px;height:15px;accent-color:var(--emerald);">
          Pointage rapide — tout le monde est absent par défaut, cochez les présents
        </label>
      </div>
      <div id="memberList">
        ${membres.length ? membres.map(m => {
          const pointage = currentPointages[m.id];
          return memberRow(m, pointage ? pointage.statut : undefined, state.pointageFastMode, !canMarkAttendance, !!(pointage && pointage.retard));
        }).join('') : emptyRow('Aucun membre inscrit à ce programme.')}
        ${membres.length ? '<div id="memberSearchEmpty" class="pointage-search-empty" hidden>Aucun membre ou catégorie ne correspond à cette recherche.</div>' : ''}
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
function memberRow(m, statut, fastMode, disabled, retard = false) {
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
  const sex = m.sexe === 'H' ? 'Homme' : 'Femme';
  const category = m.categorie && normaliseCategorie(m.categorie) !== normaliseCategorie(sex) ? m.categorie : '';
  const searchText = [m.prenom, m.nom, m.categorie, sex, m.ap ? 'AP ponctuel' : ''].filter(Boolean).join(' ');
  return `<div class="member-row" data-membre="${m.id}" data-search="${escapeHtml(searchText)}" data-retard="${retard ? 'true' : 'false'}">
    <div class="member-avatar">${initials(m.nom, m.prenom)}</div>
    <div class="member-info">
      <button type="button" class="member-name-link" data-id="${m.id}" style="background:none;border:none;padding:0;font-size:13.5px;font-weight:700;color:var(--ink);cursor:pointer;text-decoration:underline;text-decoration-color:var(--line-strong);text-align:left;">${escapeHtml(m.prenom)} ${escapeHtml(m.nom)}</button>${m.ap ? ` <span class="pill" style="background:var(--gold-tint);border-color:var(--gold);color:var(--gold);font-size:10px;">AP</span>` : ''}${retard ? ' <span class="member-late-badge pill" style="background:var(--terracotta-tint);border-color:var(--terracotta);color:var(--terracotta);font-size:10px;">Retard</span>' : ''}
      <div class="member-meta">${sex}${category ? ' · ' + escapeHtml(category) : ''}</div>
    </div>
    ${statusHtml}
  </div>`;
}
function attendanceFingerprint(programmeId, date, lieu, presentMemberIds) {
  const encoder = new TextEncoder();
  const encodeField = value => {
    const text = String(value || '');
    return encoder.encode(text).length + ':' + text;
  };
  return encodeField(programmeId) + encodeField(date) + encodeField(lieu)
    + Array.from(new Set(presentMemberIds)).sort().map(encodeField).join('');
}
function sessionAttendanceLieu(session) {
  const lieu = String(session.lieu || '').trim();
  const label = String(session.label || '').trim();
  if (lieu && !(lieu.toLowerCase() === 'séance' && label.toLowerCase() === 'séance')) return lieu;
  return label.toLowerCase() === 'séance' ? '' : label;
}
function sessionTimestampForTime(date, time) {
  if (!date || !time) return '';
  const timestamp = new Date(`${date}T${time}`);
  return Number.isNaN(timestamp.getTime()) ? '' : timestamp.toISOString();
}
function isLateForSession(sessionId) {
  const session = state.data.sessions.find(item => item.id === sessionId);
  if (!session || !session.heureDebut || session.heureFin) return false;
  const startedAt = Date.parse(session.heureDebut);
  return Number.isFinite(startedAt) && Date.now() - startedAt >= 15 * 60 * 1000;
}
function updateMemberLateBadge(row, isLate) {
  const existingBadge = row.querySelector('.member-late-badge');
  if (!isLate) {
    existingBadge?.remove();
    return;
  }
  if (existingBadge) return;
  const badge = document.createElement('span');
  badge.className = 'member-late-badge pill';
  badge.textContent = 'Retard';
  badge.style.cssText = 'background:var(--terracotta-tint);border-color:var(--terracotta);color:var(--terracotta);font-size:10px;';
  row.querySelector('.member-name-link')?.insertAdjacentElement('afterend', badge);
}
function normalisePointageSearch(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function attachPointageEvents() {
  const d = state.data;
  const progSel = document.getElementById('progSelect');
  if (progSel) progSel.addEventListener('change', e => { state.pointageProgId = e.target.value; state.pointageSessionId = 'new'; state.pointageLieu = ''; render(); });
  const sessSel = document.getElementById('sessionSelect');
  if (sessSel) sessSel.addEventListener('change', e => {
    state.pointageSessionId = e.target.value;
    const session = d.sessions.find(item => item.id === e.target.value);
    state.pointageLieu = session ? sessionAttendanceLieu(session) : '';
    render();
  });
  const fastToggle = document.getElementById('fastModeToggle');
  if (fastToggle) fastToggle.addEventListener('change', e => { state.pointageFastMode = e.target.checked; render(); });
  const memberSearch = document.getElementById('memberSearch');
  if (memberSearch) memberSearch.addEventListener('input', () => {
    const query = normalisePointageSearch(memberSearch.value);
    const rows = document.querySelectorAll('#memberList .member-row');
    let visibleCount = 0;
    rows.forEach(row => {
      const matches = normalisePointageSearch(row.dataset.search).includes(query);
      row.hidden = !matches;
      if (matches) visibleCount++;
    });
    const emptyMessage = document.getElementById('memberSearchEmpty');
    if (emptyMessage) emptyMessage.hidden = visibleCount > 0;
  });
  const dateInput = document.getElementById('sessionDate');
  if (dateInput) dateInput.addEventListener('change', e => state.pointageDate = e.target.value);
  const lieuInput = document.getElementById('sessionLieu');
  if (lieuInput) lieuInput.addEventListener('input', e => state.pointageLieu = e.target.value);
  const sessionVenueInput = document.getElementById('sessionVenueInput');
  if (sessionVenueInput) sessionVenueInput.addEventListener('input', e => {
    state.pointageLieu = e.target.value;
    const session = d.sessions.find(item => item.id === state.pointageSessionId);
    const saveBtn = document.getElementById('saveSession');
    const canFinish = !!session && (!!session.heureFin || (!session.heureDebut && !session.heureFin));
    if (saveBtn) saveBtn.disabled = !canFinish || !e.target.value.trim();
    const summary = document.getElementById('sessionSummary');
    if (summary && session) {
      summary.textContent = 'Lieu : ' + (e.target.value.trim() || 'Non renseigné')
        + (sessionHours(session) ? ' · Horaires : ' + sessionHours(session) : '');
    }
  });
  const startSessionBtn = document.getElementById('startSessionBtn');
  if (startSessionBtn) startSessionBtn.addEventListener('click', async () => {
    if (state.pointageSessionId !== 'new') return;
    const lieu = (document.getElementById('sessionLieu')?.value || '').trim();
    const date = document.getElementById('sessionDate')?.value || '';
    if (!date) { showToast('Veuillez choisir la date du programme'); return; }
    const heureDebut = sessionTimestampForTime(date, document.getElementById('startSessionTime')?.value || '');
    if (!heureDebut) { showToast('Veuillez saisir l’heure de début du programme'); return; }
    startSessionBtn.disabled = true;
    const session = {
      id: uid(), programmeId: state.pointageProgId, date,
      label: lieu || 'Séance', lieu, heureDebut, heureFin: '',
    };
    d.sessions.push(session);
    state.pointageSessionId = session.id;
    state.pointageLieu = lieu;
    await saveData();
    showToast('Heure de début enregistrée — pointage déverrouillé');
    render();
  });
  const endSessionBtn = document.getElementById('endSessionBtn');
  if (endSessionBtn) endSessionBtn.addEventListener('click', async () => {
    const session = d.sessions.find(s => s.id === state.pointageSessionId);
    if (!session || !session.heureDebut || session.heureFin) return;
    const heureFin = sessionTimestampForTime(session.date, document.getElementById('endSessionTime')?.value || '');
    if (!heureFin) { showToast('Veuillez saisir l’heure de fin du programme'); return; }
    const lieu = (document.getElementById('sessionVenueInput')?.value || sessionAttendanceLieu(session)).trim();
    if (lieu) {
      session.lieu = lieu;
      session.label = lieu;
    }
    session.heureFin = heureFin;
    await saveData();
    const hasLieu = !!sessionAttendanceLieu(session).trim();
    showToast(hasLieu
      ? 'Heure de fin enregistrée — pointage prêt à enregistrer'
      : 'Heure de fin enregistrée — renseignez le lieu pour enregistrer le pointage');
    const summary = document.getElementById('sessionSummary');
    if (summary) {
      const hours = sessionHours(session);
      summary.textContent = 'Lieu : ' + (sessionAttendanceLieu(session) || 'Non renseigné')
        + (hours ? ' · Horaires : ' + hours : '');
    }
    const status = document.getElementById('sessionStatus');
    if (status) {
      status.innerHTML = `<span style="font-size:12px;color:var(--ink-faint);">Programme terminé : ${escapeHtml(sessionHours(session))}</span>`;
    }
    const saveBtn = document.getElementById('saveSession');
    if (saveBtn) saveBtn.disabled = !hasLieu;
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
      const isLate = btn.dataset.statut === 'present' && isLateForSession(state.pointageSessionId);
      row.querySelectorAll('.status-btn').forEach(b => {
        b.classList.remove('active'); b.querySelector('.stamp')?.remove();
        if (onlyOneBtn) b.textContent = 'Absent';
      });
      if (onlyOneBtn && wasActive) {
        row.dataset.retard = 'false';
        row.querySelector('.member-late-badge')?.remove();
        return;
      }
      btn.classList.add('active');
      if (btn.dataset.statut === 'present') {
        row.dataset.retard = String(isLate);
        btn.textContent = '✓ Présent';
        const s = document.createElement('span'); s.className = 'stamp'; s.innerHTML = ICONS.stamp;
        btn.appendChild(s);
        updateMemberLateBadge(row, isLate);
      } else {
        row.dataset.retard = 'false';
        row.querySelector('.member-late-badge')?.remove();
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
    const lieu = (document.getElementById('sessionVenueInput')?.value || sessionAttendanceLieu(session)).trim();
    if (!lieu) {
      showToast('Saisissez le lieu du programme avant d’enregistrer le pointage');
      return;
    }
    session.lieu = lieu;
    session.label = lieu;
    const rows = document.querySelectorAll('#memberList .member-row');
    let marked = 0;
    let apTouched = [];
    const pointagesToSave = d.pointages.filter(p => p.sessionId !== sessionId);
    rows.forEach(row => {
      const membreId = row.dataset.membre;
      const active = row.querySelector('.status-btn.active');
      let statut;
      if (active) statut = active.dataset.statut;
      else if (state.pointageFastMode) statut = 'absent';
      else return;
      pointagesToSave.push({
        id: uid(), sessionId, membreId, statut,
        retard: statut === 'present' && row.dataset.retard === 'true',
      });
      marked++;
      const membre = d.membres.find(m => m.id === membreId);
      if (membre && membre.ap) apTouched.push(membre);
    });
    const fingerprint = attendanceFingerprint(
      session.programmeId,
      session.date,
      sessionAttendanceLieu(session),
      pointagesToSave.filter(p => p.sessionId === sessionId && p.statut === 'present').map(p => p.membreId)
    );
    const duplicateSession = d.sessions.find(other => {
      if (other.id === sessionId || other.programmeId !== session.programmeId
        || other.date !== session.date || sessionAttendanceLieu(other) !== sessionAttendanceLieu(session)) return false;
      const otherFingerprint = attendanceFingerprint(
        other.programmeId,
        other.date,
        sessionAttendanceLieu(other),
        d.pointages.filter(p => p.sessionId === other.id && p.statut === 'present').map(p => p.membreId)
      );
      return otherFingerprint === fingerprint;
    });
    if (duplicateSession) {
      if (!d.pointages.some(pointage => pointage.sessionId === sessionId)) {
        state.pointageDate = session.date;
        state.pointageLieu = sessionAttendanceLieu(session);
        state.pointageSessionId = 'new';
        d.sessions = d.sessions.filter(item => item.id !== sessionId);
        await saveData();
        render();
      }
      showToast('Cette séance a déjà été pointée par un autre utilisateur. Votre pointage n’a pas été enregistré ; supprimez-le s’il apparaît encore.');
      return;
    }
    d.pointages = pointagesToSave;
    session.attendanceFingerprint = fingerprint;
    const syncResult = await saveData({ waitForSync: true });
    if (syncResult === 'duplicate-attendance') {
      render();
      return;
    }
    const promoted = apTouched.filter(m => checkApPromotion(d, m.id));
    if (promoted.length) {
      state.completeInfoQueue = (state.completeInfoQueue || []).concat(promoted.map(m => m.id));
      await saveData();
    }
    state.pointageSessionId = sessionId;
    if (syncResult === false && sb && sbUser) {
      showToast('Pointage enregistré localement — synchronisation en attente');
    } else {
      showToast(marked
        ? 'Pointage enregistré (' + marked + ' membres)' + (promoted.length ? ' — ' + promoted.map(m => m.prenom + ' ' + m.nom).join(', ') + ' intégré(s) définitivement à la base' : '')
        : 'Aucun statut sélectionné');
    }
    render();
  });
}
