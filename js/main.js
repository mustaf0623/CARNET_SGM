/* js/main.js — Point d’entrée : démarrage de l’app et initialisation */

/* =========================================================
   CARNET SGM — Registre de présence
   Stockage : IndexedDB (persistant, local à l'appareil)
   ========================================================= */

/* ================= INIT ================= */
async function clearLocalDataCache() {
  for (const key of ['carnet-data', SYNC_STATE_KEY]) {
    try { await idbDelete(key); }
    catch (e) { console.error('Carnet SGM — impossible d’effacer le cache IndexedDB ' + key + ':', e); }
  }
  for (const key of [LOCAL_BACKUP_KEY, SYNC_STATE_BACKUP_KEY]) {
    try { localStorage.removeItem(key); }
    catch (e) { console.error('Carnet SGM — impossible d’effacer la copie locale ' + key + ':', e); }
  }
  Object.keys(snapshotMaps).forEach(table => snapshotMaps[table].clear());
  syncState = { pending: false, snapshots: null };
  if (sbUser) clearCachedAccountAccess(sbUser.id);
  else {
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key && key.startsWith('carnet-account-access-')) localStorage.removeItem(key);
      }
      localStorage.removeItem(LAST_AUTH_ACCOUNT_KEY);
    } catch (e) { console.error('Carnet SGM — impossible d’effacer les rôles mémorisés:', e); }
  }
}

async function startApp() {
  const localData = await loadData();
  let data = localData || emptyData();
  let remoteReady = false;
  if (sb && sbUser) {
    try {
      const account = await fetchCurrentAccount();
      if (!account || !account.role) {
        state.data = emptyData();
        await clearLocalDataCache();
        renderAccountAccessScreen(
          'Compte en attente d’activation',
          'Un administrateur CA doit attribuer un rôle à ce compte avant l’accès aux données.'
        );
        return;
      }
      if (localData && syncState.pending && account.role === 'ca') {
        state.data = localData;
        if (!await pushToSupabase()) throw new Error('synchronisation locale impossible');
      }
      data = await pullFromSupabase();
      state.account = data.account;
      delete data.account;
      await idbSet('carnet-data', data);
      remoteReady = true;
    } catch (e) {
      const cachedAccount = cachedAccountAccess(sbUser.id);
      if (cachedAccount && cachedAccount.role) {
        state.account = cachedAccount;
        if (cachedAccount.role === 'president' && !cachedAccount.scopeGlobal) {
          data = emptyData();
          data.profile.name = cachedAccount.name || '';
          showToast('Hors ligne : les données de votre portée doivent être rechargées après reconnexion');
        } else {
          data = localData || emptyData();
          showToast('Connexion au serveur impossible — les données locales restent disponibles');
        }
      } else {
        state.data = emptyData();
        await clearLocalDataCache();
        renderAccountAccessScreen(
          'Accès indisponible',
          'Impossible de vérifier le rôle du compte. Vérifiez la connexion et réessayez.'
        );
        console.error('Carnet SGM — impossible de vérifier les droits du compte:', e);
        return;
      }
    }
  } else {
    state.account = { role: 'ca', accountAdmin: false, scopeGlobal: true, scopeProgrammeIds: [] };
  }
  state.data = data;
  if (sb && sbUser) {
    updateSnapshotsFromCurrent();
    if (remoteReady || (state.account.role === 'president' && !state.account.scopeGlobal)) {
      await saveSyncState(false);
    }
    try { localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.data)); }
    catch (e) { console.error('Carnet SGM — impossible de mettre à jour la copie locale filtrée:', e); }
    if (state.account.role === 'president' && !state.account.scopeGlobal) {
      try { await idbSet('carnet-data', state.data); }
      catch (e) { console.error('Carnet SGM — impossible de remplacer le cache local par la portée autorisée:', e); }
    }
    subscribeRealtime();
  }
  render();
}

async function showCachedAccountOffline(localData, account) {
  state.account = account;
  if (account.role === 'president' && !account.scopeGlobal) {
    state.data = emptyData();
    state.data.profile.name = account.name || '';
    showToast('Hors ligne : les données de votre portée doivent être rechargées après reconnexion');
    updateSnapshotsFromCurrent();
    await saveSyncState(false);
    try { await idbSet('carnet-data', state.data); }
    catch (e) { console.error('Carnet SGM — impossible d’effacer les données hors portée du cache local:', e); }
    try { localStorage.setItem(LOCAL_BACKUP_KEY, JSON.stringify(state.data)); }
    catch (e) { console.error('Carnet SGM — impossible d’effacer la copie locale hors portée:', e); }
  } else {
    state.data = localData;
    showToast('Session indisponible — les données locales restent disponibles');
  }
  render();
}

document.getElementById('syncBtn').addEventListener('click', () => reconcileSync(true));

(async function init() {
  const minSplash = new Promise(res => setTimeout(res, 1250));
  const localData = await loadData(); // toujours essayé en premier, indépendamment de Supabase
  // La liste des actions locales pas encore envoyées (snapshots de la
  // dernière synchro connue) doit être restaurée dès maintenant, quel que
  // soit le chemin suivi ensuite — sinon les suppressions faites hors ligne
  // ne peuvent plus être détectées lors de la prochaine synchro.
  syncState = await loadSyncState() || (localData ? { pending: true, snapshots: null } : syncState);
  if (syncState.snapshots) restoreSnapshots(syncState.snapshots);
  const shouldForceAuthOnFirstLaunch = !localData && supabaseConfigured();

  if (supabaseConfigured() && window.supabase) {
    const syncBtnEl = document.getElementById('syncBtn');
    if (syncBtnEl) syncBtnEl.style.display = 'inline-flex';
    try {
      // Créer le client est instantané (aucun appel réseau) ; c'est l'appel
      // qui suit juste après, getSession(), qui peut traîner hors-ligne —
      // d'où le découpage ci-dessous : on ne l'attend plus ici.
      sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      sb.auth.onAuthStateChange((event, session) => {
        const newUser = session ? session.user : null;
        if (state.account && newUser && state.account.id !== newUser.id) state.account = null;
        sbUser = newUser;
      });
      // En cas de perte de réseau au moment précis du chargement, on retente
      // dès que la connexion revient plutôt que d'attendre indéfiniment.
      window.addEventListener('online', async () => {
        if (!sb) return;
        const newUser = await getSupabaseUser();
        if (newUser && (!sbUser || sbUser.id !== newUser.id)) {
          state.account = null;
          sbUser = newUser;
          if (state.data) await startApp();
        }
      });
    } catch (e) {
      sb = null;
      console.error('Carnet SGM — impossible de configurer la connexion Supabase:', e);
    }
  }

  await minSplash;
  document.getElementById('splash').classList.add('hide');

  if (localData) {
    if (supabaseConfigured()) {
      if (!sb) {
        renderAccountAccessScreen(
          'Connexion requise',
          'Impossible de vérifier les droits du compte. Réessayez lorsque la connexion sera disponible.'
        );
        return;
      }
      sbUser = await getSupabaseUser();
      if (!sbUser) {
        const cachedAccount = cachedLastAccountAccess();
        if (cachedAccount) await showCachedAccountOffline(localData, cachedAccount);
        else {
          await clearLocalDataCache();
          renderAuthScreen();
        }
        return;
      }
      await startApp();
      return;
    }
    // Des données existent déjà sur cet appareil : on entre dans l'app
    // immédiatement, connecté ou non — SANS attendre Supabase, dont la
    // vérification de session (getSupabaseUser) peut être lente hors-ligne
    // (Wi-Fi connecté mais sans Internet réel : l'échec réseau met parfois
    // plusieurs dizaines de secondes à être constaté). C'est le bug qui
    // rendait l'ouverture très lente hors-ligne : on attendait cette
    // vérification avant même d'afficher l'app.
    state.account = { role: 'ca', accountAdmin: false, scopeGlobal: true, scopeProgrammeIds: [] };
    state.data = localData;
    render();
    // Important : on NE marque PAS ces données comme déjà synchronisées ici.
    // Tant qu'on n'a pas confirmé avec le serveur ce qui y est déjà, on doit
    // considérer que tout le contenu local (y compris des saisies faites
    // hors ligne) peut avoir besoin d'être envoyé. reconcileSync() s'en
    // charge : il pousse d'abord ces données, puis récupère l'état serveur.
    // Elle tourne ici en tâche de fond, après le rendu, jamais avant.
    if (sb) {
      getSupabaseUser().then((user) => {
        sbUser = user;
        if (sbUser) reconcileSync();
      });
    }
    return;
  }

  // Aucune donnée locale (tout premier lancement sur cet appareil) : il faut
  // bien savoir si une session existe avant de choisir entre écran de
  // connexion et chargement des données — mais avec un délai borné
  // (getSupabaseUser), pour ne jamais rester bloqué indéfiniment.
  if (sb) sbUser = await getSupabaseUser();
  if (shouldForceAuthOnFirstLaunch || (sb && !sbUser)) {
    renderAuthScreen();
    return;
  }
  await startApp();
})();
