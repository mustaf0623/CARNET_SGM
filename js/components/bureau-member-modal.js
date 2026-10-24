/* js/components/bureau-member-modal.js — Fiche de statistiques d’un membre du Bureau */

// Fiche de statistiques personnelles d'un membre AU SEIN DU BUREAU
// uniquement (mandat courant) — n'a aucun rapport avec ses stats de
// présence sur les programmes, qui restent dans leur propre fiche.
function renderBureauMemberDetailModal() {
  const d = state.data;
  const mandat = activeBureauMandat(d);
  const membreId = state.bureauMemberDetailMembreId;
  const membre = d.membres.find(m => m.id === membreId);
  if (!membre || !mandat) { state.bureauMemberDetailMembreId = null; return ''; }
  const bm = d.bureauMembres.find(x => x.membreId === membreId && x.mandatId === mandat.id);
  const poste = bm ? d.bureauPostes.find(p => p.id === bm.posteId) : null;
  const stats = bureauMemberStats(d, membreId, mandat.id);
  const reunions = d.bureauReunions.filter(r => r.mandatId === mandat.id).sort((a, b) => a.numero - b.numero);
  const pointagesMap = new Map(d.bureauPointages.filter(p => p.membreId === membreId).map(p => [p.reunionId, p.statut]));
  return `
  <div class="onboard-overlay" id="bureauMemberDetailOverlay">
    <button id="bureauMemberDetailCloseFixedBtn" title="Fermer" style="position:fixed;top:16px;right:16px;z-index:200;width:36px;height:36px;border-radius:50%;border:1px solid rgba(237,241,229,0.3);background:rgba(18,35,24,0.75);backdrop-filter:blur(4px);color:#fff;font-size:18px;line-height:1;cursor:pointer;">×</button>
    <div class="onboard-card" style="width:min(460px, 92vw);text-align:left;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
        <div class="avatar" style="width:44px;height:44px;font-size:16px;">${initials(membre.nom, membre.prenom)}</div>
        <div>
          <h2 style="margin:0;">${escapeHtml(membre.prenom)} ${escapeHtml(membre.nom)}</h2>
          <div style="font-size:12.5px;color:var(--ink-faint);">${escapeHtml(poste ? poste.nom : 'Poste non défini')} · Bureau — ${escapeHtml(mandat.nom)}</div>
        </div>
      </div>
      <div class="card-sub" style="margin:10px 0 14px;">Statistiques propres au Bureau pour ce mandat uniquement — indépendantes de ses présences sur les autres programmes.</div>
      <div class="grid grid-4" style="margin-bottom:16px;">
        ${statCard('Présences', stats.present, '', 'stat-emerald')}
        ${statCard('Absences', stats.absent, '', 'stat-terracotta')}
        ${statCard('Taux prés.', stats.tauxPresence + '%', '', 'stat-emerald')}
        ${statCard('Taux abs.', stats.tauxAbsence + '%', '', 'stat-terracotta')}
      </div>
      <div class="card-title" style="font-size:14px;margin-bottom:8px;">Détail par réunion</div>
      <div class="ledger" style="max-height:min(260px, 40vh);overflow-y:auto;">
        ${reunions.map(r => {
          const st = pointagesMap.get(r.id);
          const statLabel = st === 'present' ? 'Présent' : (st === 'absent' ? 'Absent' : 'non pointé');
          const statStyle = st === 'present' ? 'background:var(--emerald-tint);border-color:var(--emerald);color:var(--emerald-dim);' : (st === 'absent' ? 'background:var(--terracotta-tint);border-color:var(--terracotta);color:var(--terracotta-dim);' : 'color:var(--ink-faint);');
          return `<div class="ledger-row"><div style="flex:1;">Réunion n°${r.numero} — ${fmtDate(r.date)}</div><span class="pill" style="${statStyle}">${statLabel}</span></div>`;
        }).join('') || emptyRow('Aucune réunion pour ce mandat.')}
      </div>
      <button class="btn btn-ghost" id="bureauMemberDetailCloseBtn" style="width:100%;justify-content:center;margin-top:16px;">Fermer</button>
    </div>
  </div>`;
}
function attachBureauMemberDetailModal() {
  const close = () => { state.bureauMemberDetailMembreId = null; render(); };
  document.getElementById('bureauMemberDetailCloseBtn')?.addEventListener('click', close);
  document.getElementById('bureauMemberDetailCloseFixedBtn')?.addEventListener('click', close);
  document.getElementById('bureauMemberDetailOverlay')?.addEventListener('click', (e) => { if (e.target.id === 'bureauMemberDetailOverlay') close(); });
}
