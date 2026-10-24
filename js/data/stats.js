/* js/data/stats.js — Calculs : statistiques membres, programmes, séances, absences */

/* ---------- computations ---------- */
function sessionYear(dateStr) { return (dateStr || '').slice(0, 4); }
function sessionMonth(dateStr) { return (dateStr || '').slice(0, 7); }
function sessionLieu(session) { return session && (session.lieu || session.label) || ''; }
function sessionTime(value) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}
function sessionHours(session) {
  if (!session) return '';
  const start = sessionTime(session.heureDebut);
  const end = sessionTime(session.heureFin);
  return start || end ? `${start || '—'} – ${end || '—'}` : '';
}
function periodMatches(dateStr, period) {
  if (!period || period === 'toutes') return true;
  if (period.length === 7) return sessionMonth(dateStr) === period;
  return sessionYear(dateStr) === period;
}
function getAvailableMonths(data, progId) {
  const sessions = progId && progId !== 'global' ? data.sessions.filter(s => s.programmeId === progId) : data.sessions;
  const set = new Set(sessions.map(s => sessionMonth(s.date)));
  return Array.from(set).filter(Boolean).sort((a, b) => b.localeCompare(a));
}
const MOIS_FR = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
function monthLabel(ym) { const [y, m] = ym.split('-'); return MOIS_FR[parseInt(m, 10) - 1] + ' ' + y; }
function getAvailableYears(data) {
  const set = new Set(data.sessions.map(s => sessionYear(s.date)));
  return Array.from(set).filter(Boolean).sort((a, b) => b.localeCompare(a));
}
function extraFieldKeys(data) {
  const keys = new Set();
  data.membres.forEach(m => Object.keys(m.extra || {}).forEach(k => keys.add(k)));
  return Array.from(keys);
}
function getMemberContactInfo(membre) {
  if (!membre) return '';
  // Le contact n'est jamais une propriété directe du membre — il vient soit
  // du champ "Contact" saisi à l'ajout d'un AP, soit d'une colonne importée
  // (nom de colonne variable selon le fichier source). On cherche dans les
  // deux, en tolérant plusieurs libellés courants.
  const extra = membre.extra || {};
  const wantedKeys = ['contact', 'telephone', 'téléphone', 'tel', 'phone', 'mobile', 'numero', 'numéro', 'email', 'mail', 'e-mail'];
  const matchKey = Object.keys(extra).find(k => wantedKeys.some(w => k.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(w.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))));
  const value = matchKey ? extra[matchKey] : '';
  return value ? String(value).trim() : '';
}
function memberInProgramme(m, progId) {
  return !!m.ap || !!m.allProgrammes || m.programmeIds.includes(progId);
}
function normaliseCategorie(raw) {
  const value = String(raw || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['pere', 'peres', 'father', 'fathers'].includes(value)) return 'Père';
  if (['mere', 'meres', 'mother', 'mothers'].includes(value)) return 'Mère';
  if (['cadette', 'cadettes'].includes(value)) return 'Cadette';
  if (['cadet', 'cadets'].includes(value)) return 'Cadet';
  if (['femme', 'femmes', 'f', 'w', 'female'].includes(value)) return 'Femme';
  if (['homme', 'hommes', 'h', 'm', 'male'].includes(value)) return 'Homme';
  return '';
}
// Un programme est "prioritaire" pour une catégorie s'il n'a aucune priorité
// définie (comportement par défaut, inchangé) OU si cette catégorie figure
// explicitement dans sa liste. Si le membre n'a pas de catégorie connue,
// on ne peut pas appliquer d'exemption : ses absences comptent normalement.
function isPriorityProgram(programme, categorie) {
  const prio = programme && programme.prioriteCategories;
  if (!prio || !prio.length) return true;
  if (!categorie) return true;
  const categorieNormalisee = normaliseCategorie(categorie);
  return prio.some(c => normaliseCategorie(c) === categorieNormalisee);
}

// Un membre "Ponctuel (AP)" est intégré définitivement à la base dès qu'il a été
// pointé (présent ou absent) à plus de 6 séances réparties sur au moins 3 programmes.
function checkApPromotion(data, membreId) {
  const m = data.membres.find(x => x.id === membreId);
  if (!m || !m.ap) return false;
  const pts = data.pointages.filter(p => p.membreId === membreId);
  const sessionIds = Array.from(new Set(pts.map(p => p.sessionId)));
  const sessions = sessionIds.map(id => data.sessions.find(s => s.id === id)).filter(Boolean);
  const nbProgrammes = new Set(sessions.map(s => s.programmeId)).size;
  if (sessions.length > 6 && nbProgrammes >= 3) {
    m.ap = false;
    return true;
  }
  return false;
}

function memberStats(data, membreId, yearFilter) {
  yearFilter = yearFilter || 'toutes';
  const m = data.membres.find(x => x.id === membreId);
  const parProgramme = [];
  let totalPresent = 0, totalAbsent = 0;
  data.programmes.forEach(p => {
    if (!m || !memberInProgramme(m, p.id)) return;
    let sessions = data.sessions.filter(s => s.programmeId === p.id);
    if (yearFilter !== 'toutes') sessions = sessions.filter(s => periodMatches(s.date, yearFilter));
    const sessionIds = sessions.map(s => s.id);
    let pts = data.pointages.filter(pt => pt.membreId === membreId && sessionIds.includes(pt.sessionId));
    // Une absence sur un programme non prioritaire pour la catégorie du
    // membre n'est pas comptabilisée — comme si le membre n'avait pas été
    // pointé sur cette séance. Une présence compte toujours normalement.
    pts = pts.filter(pt => pt.statut === 'present' || isPriorityProgram(p, m.categorie));
    const present = pts.filter(pt => pt.statut === 'present').length;
    const absent = pts.filter(pt => pt.statut === 'absent').length;
    const total = present + absent;
    totalPresent += present; totalAbsent += absent;
    parProgramme.push({
      programmeId: p.id, nom: p.nom, nbSeancesProgramme: sessions.length,
      present, absent, total, tauxPresence: total ? Math.round((present / total) * 100) : 0,
    });
  });
  const totalAll = totalPresent + totalAbsent;
  return {
    parProgramme,
    overall: { present: totalPresent, absent: totalAbsent, total: totalAll, tauxPresence: totalAll ? Math.round((totalPresent / totalAll) * 100) : 0 },
  };
}

function programStats(data, progId, yearFilter) {
  yearFilter = yearFilter || 'toutes';
  const programme = data.programmes.find(p => p.id === progId);
  const sessions = data.sessions.filter(s => s.programmeId === progId && periodMatches(s.date, yearFilter));
  const sessionIds = sessions.map(s => s.id);
  let pts = data.pointages.filter(p => sessionIds.includes(p.sessionId));
  pts = pts.filter(p => {
    if (p.statut === 'present') return true;
    const mem = data.membres.find(m => m.id === p.membreId);
    return isPriorityProgram(programme, mem && mem.categorie);
  });
  const present = pts.filter(p => p.statut === 'present').length;
  const total = pts.length;
  const tauxPresence = total ? Math.round((present / total) * 100) : 0;
  const membresInscrits = data.membres.filter(m => !m.ap && memberInProgramme(m, progId));
  const membresPresentsUneFois = new Set(pts.filter(p => p.statut === 'present').map(p => p.membreId));
  const tauxParticipation = membresInscrits.length ? Math.round((membresPresentsUneFois.size / membresInscrits.length) * 100) : 0;
  return { tauxPresence, tauxAbsence: 100 - tauxPresence, tauxParticipation, nbSessions: sessions.length, nbMembres: membresInscrits.length, present, total };
}
// Série d'absences consécutives la plus récente d'un membre sur un programme
// (une présence remet la série à zéro ; une séance non pointée pour ce
// membre est ignorée — elle ne casse ni ne compte dans la série).
function consecutiveAbsenceStreak(data, membreId, progId) {
  const m = data.membres.find(x => x.id === membreId);
  const programme = data.programmes.find(p => p.id === progId);
  const sessions = data.sessions.filter(s => s.programmeId === progId).sort((a, b) => a.date.localeCompare(b.date));
  let streak = 0;
  let lastDate = null;
  sessions.forEach(s => {
    const pt = data.pointages.find(p => p.sessionId === s.id && p.membreId === membreId);
    if (!pt) return;
    if (pt.statut === 'absent') {
      if (!isPriorityProgram(programme, m && m.categorie)) return; // absence non comptabilisée pour ce membre
      streak++; lastDate = s.date;
    }
    else { streak = 0; lastDate = null; }
  });
  return { streak, lastDate };
}
// Répertoire des membres permanents (non "Ponctuel/AP") ayant `seuil` absences
// consécutives ou plus sur au moins un programme.
function absenceWatchlist(data, seuil) {
  seuil = seuil || 3;
  const rows = [];
  data.membres.filter(m => !m.ap).forEach(m => {
    data.programmes.forEach(p => {
      if (!memberInProgramme(m, p.id)) return;
      const { streak, lastDate } = consecutiveAbsenceStreak(data, m.id, p.id);
      if (streak >= seuil) rows.push({ membre: m, programme: p, streak, lastDate });
    });
  });
  rows.sort((a, b) => b.streak - a.streak);
  return rows;
}
function sessionStats(data, sessionId) {
  const session = data.sessions.find(s => s.id === sessionId);
  const programme = session && data.programmes.find(p => p.id === session.programmeId);
  let pts = data.pointages.filter(p => p.sessionId === sessionId);
  pts = pts.filter(p => {
    if (p.statut === 'present') return true;
    const mem = data.membres.find(m => m.id === p.membreId);
    return isPriorityProgram(programme, mem && mem.categorie);
  });
  const present = pts.filter(p => p.statut === 'present').length;
  const total = pts.length;
  return { present, total, tauxPresence: total ? Math.round((present / total) * 100) : 0 };
}
// Statistiques globales, filtrables par programme ('global' = tous) et par année ('toutes' = toutes)
function scopedStats(data, progFilter, yearFilter) {
  yearFilter = yearFilter || 'toutes';
  const membres = (progFilter === 'global' ? data.membres : data.membres.filter(m => memberInProgramme(m, progFilter))).filter(m => !m.ap);
  const nbH = membres.filter(m => m.sexe === 'H').length;
  const nbF = membres.filter(m => m.sexe === 'F').length;
  const total = membres.length;
  let sessions = progFilter === 'global' ? data.sessions : data.sessions.filter(s => s.programmeId === progFilter);
  if (yearFilter !== 'toutes') sessions = sessions.filter(s => periodMatches(s.date, yearFilter));
  const sessionIds = sessions.map(s => s.id);
  const sessionById = new Map(sessions.map(s => [s.id, s]));
  let pts = data.pointages.filter(p => sessionIds.includes(p.sessionId));
  pts = pts.filter(p => {
    if (p.statut === 'present') return true;
    const sess = sessionById.get(p.sessionId);
    const programme = sess && data.programmes.find(pr => pr.id === sess.programmeId);
    const mem = data.membres.find(m => m.id === p.membreId);
    return isPriorityProgram(programme, mem && mem.categorie);
  });
  const present = pts.filter(p => p.statut === 'present').length;
  const tauxPresence = pts.length ? Math.round((present / pts.length) * 100) : 0;
  return { nbH, nbF, total, tauxPresence, tauxAbsence: 100 - tauxPresence };
}
