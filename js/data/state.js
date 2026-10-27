/* js/data/state.js — État global de l’app, chargement / sauvegarde / réinitialisation */

function emptyData() {
  return {
    profile: { name: '' }, programmes: [], membres: [], sessions: [], pointages: [],
    bureauMandats: [], bureauPostes: [], bureauMembres: [], bureauReunions: [], bureauPointages: [], bureauPresenceExtras: [],
  };
}

let state = {
  data: null,
  tab: 'dashboard',
  absenceThreshold: 3,
  bureauView: 'reunions',
  bureauMandatId: null,
  bureauReunionId: null,
  bureauMemberDetailMembreId: null,
  bureauReunionSearch: '',
  dashProgFilter: 'global',
  dashYearFilter: 'toutes',
  pointageProgId: null,
  pointageSessionId: 'new',
  pointageDate: todayISO(),
  pointageLieu: '',
  pointageFastMode: true,
  importStep: 0,
  importRows: [],
  importHeaders: [],
  importMapping: {},
  renameModalOpen: false,
  confirmModalOpen: false,
  confirmTitle: '',
  confirmMessage: '',
  confirmLabel: 'Confirmer',
  memberDetailId: null,
  completeInfoQueue: [],
  reportScope: 'global',
  reportSessionId: 'toutes',
};

function ensureBureauFields(data) {
  if (!data) return data;
  if (!Array.isArray(data.bureauMandats)) data.bureauMandats = [];
  if (!Array.isArray(data.bureauPostes)) data.bureauPostes = [];
  if (!Array.isArray(data.bureauMembres)) data.bureauMembres = [];
  if (!Array.isArray(data.bureauReunions)) data.bureauReunions = [];
  if (!Array.isArray(data.bureauPointages)) data.bureauPointages = [];
  if (!Array.isArray(data.bureauPresenceExtras)) data.bureauPresenceExtras = [];
  return data;
}
async function loadData() {
  try { const v = await idbGet('carnet-data'); if (v) return ensureBureauFields(v); } catch (e) { /* premier lancement */ }
  try { const backup = localStorage.getItem(LOCAL_BACKUP_KEY); return backup ? ensureBureauFields(JSON.parse(backup)) : null; } catch (e) { /* noop */ }
  return null;
}
async function saveData(options = {}) {
  // Copie synchrone avant toute attente : elle reste disponible même si l'app se ferme maintenant.
  try { localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.data)); } catch (e) { /* stockage indisponible */ }
  await saveSyncState(true);
  try { localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.data)); } catch (e) { /* stockage indisponible */ }
  try { await idbSet('carnet-data', state.data); }
  catch (e) { showToast('Échec de la sauvegarde locale'); }
  if (sb && sbUser) {
    if (options.waitForSync) return await pushToSupabase();
    pushToSupabase();
  }
  return true;
}

async function resetAppData() {
  const keepName = state.data?.profile?.name || '';
  state.data = emptyData();
  state.data.profile.name = keepName;
  state.tab = 'dashboard';
  state.dashProgFilter = 'global';
  state.dashYearFilter = 'toutes';
  state.pointageProgId = null;
  state.pointageSessionId = 'new';
  state.pointageDate = todayISO();
  state.pointageLieu = '';
  state.pointageFastMode = true;
  state.importStep = 0;
  state.importRows = [];
  state.importHeaders = [];
  state.importMapping = {};
  state.renameModalOpen = false;
  state.confirmModalOpen = false;
  state.memberDetailId = null;
  state.reportScope = 'global';
  state.reportSessionId = 'toutes';
  pendingConfirmAction = null;
  snapshotMaps.programmes = new Map();
  snapshotMaps.membres = new Map();
  snapshotMaps.sessions = new Map();
  snapshotMaps.pointages = new Map();

  try { await idbDelete('carnet-data'); } catch (e) { /* noop */ }
  try { await idbDelete(SYNC_STATE_KEY); } catch (e) { /* noop */ }
  try { await idbSet('carnet-data', state.data); } catch (e) { /* noop */ }
  try { localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.data)); } catch (e) { /* noop */ }
  try { localStorage.removeItem(SYNC_STATE_BACKUP_KEY); } catch (e) { /* noop */ }

  render();
  showToast('Données locales réinitialisées');
}
