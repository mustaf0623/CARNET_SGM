/* js/data/bureau-stats.js — Calculs spécifiques au module Bureau */

/* ================= BUREAU ================= */
function activeBureauMandat(d) {
  if (state.bureauMandatId) {
    const m = d.bureauMandats.find(x => x.id === state.bureauMandatId);
    if (m) return m;
  }
  return d.bureauMandats.find(m => m.actif) || d.bureauMandats[0] || null;
}
function bureauMembresForMandat(d, mandatId) {
  return d.bureauMembres.filter(bm => bm.mandatId === mandatId).map(bm => ({
    ...bm,
    membre: d.membres.find(m => m.id === bm.membreId),
    poste: d.bureauPostes.find(p => p.id === bm.posteId),
  })).filter(x => x.membre);
}
function bureauExtraPresencesForReunion(d, reunionId) {
  return (d.bureauPresenceExtras || []).filter(x => x.reunionId === reunionId);
}
function bureauPresenceParticipants(d, reunionId, mandatId) {
  const membres = bureauMembresForMandat(d, mandatId);
  const pointagesMap = new Map((d.bureauPointages || []).filter(p => p.reunionId === reunionId).map(p => [p.membreId, p.statut]));
  const presents = membres.filter(bm => pointagesMap.get(bm.membreId) === 'present').map(bm => `${bm.membre.prenom} ${bm.membre.nom}${bm.poste ? ' (' + bm.poste.nom + ')' : ''}`);
  const extraPresents = bureauExtraPresencesForReunion(d, reunionId).filter(x => x.statut === 'present').map(x => `${x.name}${x.poste ? ' (' + x.poste + ')' : ''}`);
  return { presents: [...presents, ...extraPresents], presentCount: presents.length + extraPresents.length };
}
function nextReunionNumero(d, mandatId) {
  const nums = d.bureauReunions.filter(r => r.mandatId === mandatId).map(r => r.numero || 0);
  return (nums.length ? Math.max(...nums) : 0) + 1;
}
function bureauMemberStats(d, membreId, mandatId) {
  const reunionIds = d.bureauReunions.filter(r => r.mandatId === mandatId).map(r => r.id);
  const pts = (d.bureauPointages || []).filter(p => p.membreId === membreId && reunionIds.includes(p.reunionId));
  const present = pts.filter(p => p.statut === 'present').length;
  const absent = pts.filter(p => p.statut === 'absent').length;
  const total = present + absent;
  const tauxPresence = total ? Math.round((present / total) * 100) : 0;
  return { present, absent, total, tauxPresence, tauxAbsence: total ? 100 - tauxPresence : 0 };
}
function bureauGlobalStats(d, mandatId) {
  const membres = bureauMembresForMandat(d, mandatId);
  const membreIds = new Set(membres.map(bm => bm.membreId));
  const reunions = d.bureauReunions.filter(r => r.mandatId === mandatId);
  const reunionIds = reunions.map(r => r.id);
  const pts = (d.bureauPointages || []).filter(p => reunionIds.includes(p.reunionId) && membreIds.has(p.membreId));
  const present = pts.filter(p => p.statut === 'present').length;
  const absent = pts.filter(p => p.statut === 'absent').length;
  const total = present + absent;
  const tauxPresence = total ? Math.round((present / total) * 100) : 0;
  return { nbMembres: membres.length, nbReunions: reunions.length, present, absent, total, tauxPresence, tauxAbsence: total ? 100 - tauxPresence : 0 };
}
