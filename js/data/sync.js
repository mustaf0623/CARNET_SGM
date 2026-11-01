/* js/data/sync.js — Synchronisation Supabase : snapshots, pull/push, temps réel */

let sb = null;
let sbUser = null;
const snapshotMaps = {
  programmes: new Map(), membres: new Map(), sessions: new Map(), pointages: new Map(),
  bureauMandats: new Map(), bureauPostes: new Map(), bureauMembres: new Map(), bureauReunions: new Map(), bureauPointages: new Map(), bureauPresenceExtras: new Map(),
};
const LOCAL_BACKUP_KEY = 'carnet-data-backup';
const SYNC_STATE_KEY = 'carnet-sync-state';
const SYNC_STATE_BACKUP_KEY = 'carnet-sync-state-backup';
const LAST_AUTH_ACCOUNT_KEY = 'carnet-last-auth-account-id';
let syncState = { pending: false, snapshots: null };

function accountFromProfile(profile, user) {
  if (!profile) return null;
  return {
    id: user.id,
    email: profile.email || user.email || '',
    name: profile.name || '',
    role: profile.role || null,
    accountAdmin: !!profile.account_admin,
    scopeGlobal: !!profile.scope_global,
    scopeProgrammeIds: Array.isArray(profile.scope_program_ids) ? profile.scope_program_ids : [],
  };
}
function cacheAccountAccess(account) {
  if (!account || !account.role) return;
  try {
    localStorage.setItem('carnet-account-access-' + account.id, JSON.stringify(account));
    localStorage.setItem(LAST_AUTH_ACCOUNT_KEY, account.id);
  }
  catch (e) { console.error('Carnet SGM — impossible de mémoriser le rôle pour le mode hors ligne:', e); }
}
function cachedAccountAccess(userId) {
  try {
    const saved = localStorage.getItem('carnet-account-access-' + userId);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    console.error('Carnet SGM — impossible de lire le rôle mémorisé:', e);
    return null;
  }
}
function cachedLastAccountAccess() {
  try {
    const userId = localStorage.getItem(LAST_AUTH_ACCOUNT_KEY);
    if (userId) {
      const account = cachedAccountAccess(userId);
      return account && account.id === userId && ['ca', 'president'].includes(account.role) ? account : null;
    }

    // Older installs cached roles without recording which account was last active.
    const prefix = 'carnet-account-access-';
    const cachedAccounts = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || !key.startsWith(prefix)) continue;
      const accountId = key.slice(prefix.length);
      const account = cachedAccountAccess(accountId);
      if (account && account.id === accountId && ['ca', 'president'].includes(account.role)) {
        cachedAccounts.push(account);
      }
    }
    if (cachedAccounts.length !== 1) return null;
    localStorage.setItem(LAST_AUTH_ACCOUNT_KEY, cachedAccounts[0].id);
    return cachedAccounts[0];
  } catch (e) {
    console.error('Carnet SGM — impossible de retrouver le compte hors ligne:', e);
    return null;
  }
}
function clearCachedAccountAccess(userId) {
  try {
    localStorage.removeItem('carnet-account-access-' + userId);
    if (localStorage.getItem(LAST_AUTH_ACCOUNT_KEY) === userId) {
      localStorage.removeItem(LAST_AUTH_ACCOUNT_KEY);
    }
  }
  catch (e) { console.error('Carnet SGM — impossible d’effacer le rôle mémorisé:', e); }
}
async function fetchCurrentAccount() {
  if (!sb || !sbUser) return null;
  const { data, error } = await sb.from('profiles')
    .select('id,email,name,role,account_admin,scope_global,scope_program_ids')
    .eq('id', sbUser.id)
    .maybeSingle();
  if (error) throw error;
  const account = accountFromProfile(data, sbUser);
  state.account = account;
  if (account && account.role) cacheAccountAccess(account);
  else clearCachedAccountAccess(sbUser.id);
  return account;
}

// Attend au plus `ms` millisecondes une promesse ; passé ce délai, se résout
// avec `fallback` plutôt que de rester bloquée. Utile pour les appels réseau
// (Supabase) qui, en Wi-Fi connecté mais sans Internet réel, peuvent mettre
// très longtemps à échouer plutôt que d'échouer tout de suite.
function withTimeout(promise, ms, fallback) {
  return Promise.race([
    promise,
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

// Récupère l'utilisateur de la session Supabase courante, sans jamais
// bloquer plus de 4s — au-delà, on considère qu'il n'y a pas de session
// disponible pour l'instant (la synchro se fera plus tard : bouton Sync,
// retour en ligne, etc.) plutôt que de faire attendre l'utilisateur.
async function getSupabaseUser() {
  if (!sb) return null;
  try {
    const result = await withTimeout(sb.auth.getSession(), 4000, { data: { session: null } });
    return result.data.session ? result.data.session.user : null;
  } catch (e) { return null; }
}

function serialiseSnapshots() {
  return Object.fromEntries(Object.entries(snapshotMaps).map(([table, map]) => [table, Array.from(map.entries())]));
}
function restoreSnapshots(snapshots) {
  if (!snapshots) return;
  Object.keys(snapshotMaps).forEach(table => { snapshotMaps[table] = new Map(snapshots[table] || []); });
}
async function loadSyncState() {
  try { const saved = await idbGet(SYNC_STATE_KEY); if (saved) return saved; } catch (e) { /* copie de secours ci-dessous */ }
  try { const backup = localStorage.getItem(SYNC_STATE_BACKUP_KEY); return backup ? JSON.parse(backup) : null; } catch (e) { return null; }
}
async function saveSyncState(pending) {
  syncState = { pending: !!pending, snapshots: serialiseSnapshots() };
  try { localStorage.setItem(SYNC_STATE_BACKUP_KEY, JSON.stringify(syncState)); } catch (e) { /* stockage indisponible */ }
  try { await idbSet(SYNC_STATE_KEY, syncState); } catch (e) { /* la copie locale reste disponible */ }
}

function updateSnapshotsFromCurrent() {
  snapshotMaps.programmes = new Map(state.data.programmes.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.membres = new Map(state.data.membres.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.sessions = new Map(state.data.sessions.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.pointages = new Map(state.data.pointages.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.bureauMandats = new Map(state.data.bureauMandats.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.bureauPostes = new Map(state.data.bureauPostes.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.bureauMembres = new Map(state.data.bureauMembres.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.bureauReunions = new Map(state.data.bureauReunions.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.bureauPointages = new Map(state.data.bureauPointages.map(r => [r.id, JSON.stringify(r)]));
  snapshotMaps.bureauPresenceExtras = new Map((state.data.bureauPresenceExtras || []).map(r => [r.id, JSON.stringify(r)]));
}

async function pullFromSupabase() {
  const [progRes, memRes, sessRes, ptRes, profRes, bMandatRes, bPosteRes, bMembreRes, bReunionRes, bPointageRes, bExtraRes] = await Promise.all([
    sb.from('programmes').select('*'),
    sb.from('membres').select('*'),
    sb.from('sessions').select('*'),
    sb.from('pointages').select('*'),
    sb.from('profiles').select('*').eq('id', sbUser.id).maybeSingle(),
    sb.from('bureau_mandats').select('*'),
    sb.from('bureau_postes').select('*'),
    sb.from('bureau_membres').select('*'),
    sb.from('bureau_reunions').select('*'),
    sb.from('bureau_pointages').select('*'),
    sb.from('bureau_presence_extras').select('*'),
  ]);
  const queryError = [progRes, memRes, sessRes, ptRes, profRes, bMandatRes, bPosteRes, bMembreRes, bReunionRes, bPointageRes, bExtraRes]
    .find(result => result.error);
  if (queryError) throw queryError.error;
  const programmes = (progRes.data || []).map(r => ({ id: r.id, nom: r.nom, prioriteCategories: r.priorite_categories || [] }));
  const membres = (memRes.data || []).map(r => ({ id: r.id, nom: r.nom, prenom: r.prenom, sexe: r.sexe, categorie: r.categorie || '', programmeIds: r.programme_ids || [], allProgrammes: !!r.all_programmes, ap: !!r.ap, extra: r.extra || {} }));
  const sessions = (sessRes.data || []).map(r => ({
    id: r.id, programmeId: r.programme_id, date: r.date, label: r.label,
    lieu: r.lieu || r.label || '', heureDebut: r.heure_debut || '', heureFin: r.heure_fin || '',
    attendanceFingerprint: r.attendance_fingerprint || '',
  }));
  const pointages = (ptRes.data || []).map(r => ({ id: r.id, sessionId: r.session_id, membreId: r.membre_id, statut: r.statut }));
  const name = (profRes.data && profRes.data.name) || '';
  const account = accountFromProfile(profRes.data, sbUser);
  if (account && account.role) cacheAccountAccess(account);
  else clearCachedAccountAccess(sbUser.id);
  const bureauMandats = (bMandatRes.data || []).map(r => ({ id: r.id, nom: r.nom, dateDebut: r.date_debut || '', dateFin: r.date_fin || '', actif: !!r.actif }));
  const bureauPostes = (bPosteRes.data || []).map(r => ({ id: r.id, nom: r.nom }));
  const bureauMembres = (bMembreRes.data || []).map(r => ({ id: r.id, mandatId: r.mandat_id, membreId: r.membre_id, posteId: r.poste_id }));
  const bureauReunions = (bReunionRes.data || []).map(r => ({
    id: r.id, mandatId: r.mandat_id, numero: r.numero, date: r.date,
    ordreDuJour: r.ordre_du_jour || '', pvTexte: r.pv_texte || '', pvLien: r.pv_lien || '',
    heureDebut: r.heure_debut || '', heureFin: r.heure_fin || '',
    presidentSeanceMembreId: r.president_seance_membre_id || '',
  }));
  const bureauPointages = (bPointageRes.data || []).map(r => ({ id: r.id, reunionId: r.reunion_id, membreId: r.membre_id, statut: r.statut }));
  const bureauPresenceExtras = (bExtraRes.data || []).map(r => ({ id: r.id, reunionId: r.reunion_id, name: r.name, poste: r.poste || '', statut: r.statut || 'present' }));
  return { profile: { name }, account, programmes, membres, sessions, pointages, bureauMandats, bureauPostes, bureauMembres, bureauReunions, bureauPointages, bureauPresenceExtras };
}

async function syncTable(tableName, rows, toRemote, prevMap) {
  const currMap = new Map(rows.map(r => [r.id, JSON.stringify(r)]));
  const toUpsert = [];
  currMap.forEach((json, id) => { if (prevMap.get(id) !== json) toUpsert.push(JSON.parse(json)); });
  const toDelete = [];
  prevMap.forEach((_, id) => { if (!currMap.has(id)) toDelete.push(id); });
  if (toUpsert.length) { const { error } = await sb.from(tableName).upsert(toUpsert.map(toRemote)); if (error) throw error; }
  if (toDelete.length) { const { error } = await sb.from(tableName).delete().in('id', toDelete); if (error) throw error; }
  return currMap;
}

let syncing = false;
let syncQueued = false;
async function rejectDuplicateAttendance() {
  const candidates = state.data.sessions.filter(session => session.attendanceFingerprint
    && snapshotMaps.sessions.get(session.id) !== JSON.stringify(session));
  if (!candidates.length) return false;
  const fingerprints = Array.from(new Set(candidates.map(session => session.attendanceFingerprint)));
  const { data, error } = await sb.from('sessions')
    .select('id, attendance_fingerprint')
    .in('attendance_fingerprint', fingerprints);
  if (error) throw error;
  const remoteFingerprints = new Set((data || []).map(session => session.attendance_fingerprint));
  const rejected = candidates.filter(session => remoteFingerprints.has(session.attendanceFingerprint)
    && !(data || []).some(remote => remote.attendance_fingerprint === session.attendanceFingerprint && remote.id === session.id));
  if (!rejected.length) return false;

  rejected.forEach(session => {
    const previousSession = snapshotMaps.sessions.get(session.id);
    if (previousSession) {
      const restored = JSON.parse(previousSession);
      const previousPointages = Array.from(snapshotMaps.pointages.values())
        .map(json => JSON.parse(json))
        .filter(pointage => pointage.sessionId === session.id);
      if (!restored.attendanceFingerprint && !previousPointages.length) {
        state.data.sessions = state.data.sessions.filter(item => item.id !== session.id);
        state.data.pointages = state.data.pointages.filter(pointage => pointage.sessionId !== session.id);
        syncQueued = true;
      } else {
        state.data.sessions = state.data.sessions.map(item => item.id === session.id ? restored : item);
        state.data.pointages = state.data.pointages.filter(pointage => pointage.sessionId !== session.id)
          .concat(previousPointages);
      }
    } else {
      state.data.sessions = state.data.sessions.filter(item => item.id !== session.id);
      state.data.pointages = state.data.pointages.filter(pointage => pointage.sessionId !== session.id);
    }
    if (state.pointageSessionId === session.id) {
      state.pointageSessionId = 'new';
      state.pointageDate = session.date;
      state.pointageLieu = session.lieu || '';
    }
  });
  try { localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.data)); } catch (e) {
    console.error('Carnet SGM — impossible de sauvegarder localement le rejet du doublon:', e);
  }
  try { await idbSet('carnet-data', state.data); } catch (e) {
    console.error('Carnet SGM — impossible de sauvegarder localement le rejet du doublon:', e);
  }
  await saveSyncState(true);
  if (state.tab === 'pointage') render();
  showToast('Un autre utilisateur a déjà pointé cette séance. Le pointage a été rejeté ; supprimez-le s’il apparaît encore.');
  return true;
}

async function pushToSupabase() {
  if (!sb || !sbUser) return false;
  if (!state.account || state.account.role !== 'ca') return false;
  if (syncing) { syncQueued = true; return false; }
  syncing = true;
  try {
    snapshotMaps.programmes = await syncTable('programmes', state.data.programmes, p => ({ id: p.id, nom: p.nom, priorite_categories: p.prioriteCategories || [] }), snapshotMaps.programmes);
    snapshotMaps.membres = await syncTable('membres', state.data.membres, m => ({ id: m.id, nom: m.nom, prenom: m.prenom, sexe: m.sexe, categorie: m.categorie || '', programme_ids: m.programmeIds || [], all_programmes: !!m.allProgrammes, ap: !!m.ap, extra: m.extra || {} }), snapshotMaps.membres);
    snapshotMaps.sessions = await syncTable('sessions', state.data.sessions, s => ({
      id: s.id, programme_id: s.programmeId, date: s.date,
      label: s.label || s.lieu || 'Séance', lieu: s.lieu || s.label || '',
      heure_debut: s.heureDebut || null, heure_fin: s.heureFin || null,
      attendance_fingerprint: s.attendanceFingerprint || null,
    }), snapshotMaps.sessions);
    snapshotMaps.pointages = await syncTable('pointages', state.data.pointages, p => ({ id: p.id, session_id: p.sessionId, membre_id: p.membreId, statut: p.statut }), snapshotMaps.pointages);
    snapshotMaps.bureauMandats = await syncTable('bureau_mandats', state.data.bureauMandats, m => ({ id: m.id, nom: m.nom, date_debut: m.dateDebut || null, date_fin: m.dateFin || null, actif: !!m.actif }), snapshotMaps.bureauMandats);
    snapshotMaps.bureauPostes = await syncTable('bureau_postes', state.data.bureauPostes, p => ({ id: p.id, nom: p.nom }), snapshotMaps.bureauPostes);
    snapshotMaps.bureauMembres = await syncTable('bureau_membres', state.data.bureauMembres, m => ({ id: m.id, mandat_id: m.mandatId, membre_id: m.membreId, poste_id: m.posteId }), snapshotMaps.bureauMembres);
    snapshotMaps.bureauReunions = await syncTable('bureau_reunions', state.data.bureauReunions, r => ({
      id: r.id, mandat_id: r.mandatId, numero: r.numero, date: r.date,
      ordre_du_jour: r.ordreDuJour || '', pv_texte: r.pvTexte || '', pv_lien: r.pvLien || '',
      heure_debut: r.heureDebut || null, heure_fin: r.heureFin || null,
      president_seance_membre_id: r.presidentSeanceMembreId || null,
    }), snapshotMaps.bureauReunions);
    snapshotMaps.bureauPointages = await syncTable('bureau_pointages', state.data.bureauPointages, p => ({ id: p.id, reunion_id: p.reunionId, membre_id: p.membreId, statut: p.statut }), snapshotMaps.bureauPointages);
    snapshotMaps.bureauPresenceExtras = await syncTable('bureau_presence_extras', state.data.bureauPresenceExtras || [], x => ({ id: x.id, reunion_id: x.reunionId, name: x.name, poste: x.poste || '', statut: x.statut || 'present' }), snapshotMaps.bureauPresenceExtras);
    const { error: profileError } = await sb.from('profiles').upsert({ id: sbUser.id, name: state.data.profile.name });
    if (profileError) throw profileError;
    await saveSyncState(false);
    return true;
  } catch (e) {
    console.error('Carnet SGM — échec pushToSupabase:', e);
    if (e && e.code === '23505' && String(e.message || '').includes('sessions_attendance_fingerprint_key')) {
      try {
        if (await rejectDuplicateAttendance()) return 'duplicate-attendance';
      } catch (rejectionError) {
        console.error('Carnet SGM — impossible de restaurer le pointage rejeté:', rejectionError);
      }
    }
    showToast('Échec de synchronisation : ' + (e && e.message ? e.message : 'erreur inconnue'));
    return false;
  } finally {
    syncing = false;
    // Une sauvegarde a eu lieu pendant cet envoi : on relance immédiatement
    // pour ne jamais laisser un changement local sans tentative d'envoi.
    if (syncQueued) { syncQueued = false; pushToSupabase(); }
  }
}

let remoteChangeTimer = null;
function handleRemoteChange() {
  clearTimeout(remoteChangeTimer);
  remoteChangeTimer = setTimeout(async () => {
    try {
      // On envoie d'abord tout changement local en attente : sans ça, un
      // rafraîchissement déclenché par le changement d'un autre appareil
      // pourrait écraser une saisie locale pas encore synchronisée.
      await pushToSupabase();
      const remote = await pullFromSupabase();
      state.account = remote.account;
      state.data.profile = remote.profile;
      state.data.programmes = remote.programmes;
      state.data.membres = remote.membres;
      state.data.sessions = remote.sessions;
      state.data.pointages = remote.pointages;
      state.data.bureauMandats = remote.bureauMandats;
      state.data.bureauPostes = remote.bureauPostes;
      state.data.bureauMembres = remote.bureauMembres;
      state.data.bureauReunions = remote.bureauReunions;
      state.data.bureauPointages = remote.bureauPointages;
      state.data.bureauPresenceExtras = remote.bureauPresenceExtras;
      updateSnapshotsFromCurrent();
      await idbSet('carnet-data', state.data);
      try { localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.data)); }
      catch (e) { console.error('Carnet SGM — impossible de mettre à jour la copie locale filtrée:', e); }
      await saveSyncState(false);
      showToast('Données mises à jour depuis un autre appareil');
      render();
    } catch (e) {
      console.error('Carnet SGM — impossible de recharger les droits et les données distantes:', e);
    }
  }, 900);
}
let realtimeChannel = null;
function subscribeRealtime() 
{
  if (!sb || !sbUser) return;
  if (realtimeChannel) return;
  realtimeChannel= sb
  .channel('carnet-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: 'id=eq.' + sbUser.id }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'programmes' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'membres' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pointages' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_mandats' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_postes' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_membres' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_reunions' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_pointages' }, handleRemoteChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bureau_presence_extras' }, handleRemoteChange)
    .subscribe();
}
