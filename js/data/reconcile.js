/* js/data/reconcile.js — Réconciliation après reconnexion (push local puis pull serveur) */

// Appelée quand une session valide (re)devient disponible pendant que l'app
// tourne déjà avec des données locales — pousse les changements faits hors
// ligne, puis récupère ce que les autres appareils ont pu modifier entretemps.
let reconciling = false;
async function reconcileSync(manual) {
  if (!sb || reconciling) { if (manual) showToast('Synchronisation déjà en cours'); return; }
  if (!sbUser) {
    // On retente de récupérer une session avant d'abandonner — utile après
    // une reconnexion réseau où le jeton vient tout juste d'être rafraîchi.
    // (délai borné : voir getSupabaseUser dans data/sync.js)
    sbUser = await getSupabaseUser();
  }
  if (!sbUser || !state.data) {
    if (manual) showToast('Pas de session active — reconnectez-vous');
    return;
  }
  reconciling = true;
  const btn = document.getElementById('syncBtn');
  if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
  try {
    await pushToSupabase();
    const remote = await pullFromSupabase();
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
    if (!state.data.profile.name && remote.profile.name) state.data.profile.name = remote.profile.name;
    updateSnapshotsFromCurrent();
    await idbSet('carnet-data', state.data);
    subscribeRealtime();
    showToast(manual ? 'Données synchronisées ✓' : 'Reconnecté — données synchronisées');
    render();
  } catch (e) {
    console.error('Carnet SGM — échec reconcileSync:', e);
    if (manual) showToast('Échec : ' + (e && e.message ? e.message : 'connexion impossible'));
  } finally {
    reconciling = false;
    if (btn) { btn.classList.remove('spinning'); btn.disabled = false; }
  }
}
