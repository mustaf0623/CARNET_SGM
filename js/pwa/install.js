/* js/pwa/install.js — Invite d’installation PWA (Android/desktop et iOS) */

/* ================= INSTALLATION PWA ================= */
let deferredInstallPrompt = null;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

function showInstallBtn() {
  if (isStandalone) return;
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'inline-flex';
}
function hideInstallBtn() {
  const btn = document.getElementById('installBtn');
  if (btn) btn.style.display = 'none';
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  showInstallBtn();
});
window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  hideInstallBtn();
  showToast('Application installée ✓');
});

function renderIOSInstallModal() {
  return `
  <div class="onboard-overlay" id="iosInstallOverlay">
    <div class="onboard-card">
      <div class="onboard-mark">${ICONS.mark}</div>
      <h2>Installer Carnet SGM</h2>
      <p>Appuyez sur l’icône <strong>Partager</strong> en bas de Safari (le carré avec une flèche), puis sur <strong>« Sur l’écran d’accueil »</strong>.</p>
      <button class="btn btn-primary" id="iosInstallCloseBtn" style="width:100%;justify-content:center;">Compris</button>
    </div>
  </div>`;
}
function attachIOSInstallModal() {
  document.getElementById('iosInstallCloseBtn').addEventListener('click', () => {
    document.getElementById('iosInstallOverlay').remove();
  });
}

document.getElementById('installBtn').addEventListener('click', async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    hideInstallBtn();
    if (choice.outcome !== 'accepted') showInstallBtn();
  } else if (isIOS) {
    document.getElementById('app').insertAdjacentHTML('afterend', renderIOSInstallModal());
    attachIOSInstallModal();
  }
});

if (isIOS && !isStandalone) showInstallBtn();
