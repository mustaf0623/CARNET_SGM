/* js/pwa/service-worker.js — Enregistrement du Service Worker et bandeau de mise à jour */

/* ================= SERVICE WORKER ================= */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      const notifyUpdate = () => {
        if (document.getElementById('swUpdateBanner')) return;
        const banner = document.createElement('div');
        banner.id = 'swUpdateBanner';
        banner.style.cssText = 'position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:9999;background:var(--ink);color:var(--paper);padding:11px 12px 11px 16px;border-radius:999px;display:flex;align-items:center;gap:10px;font-size:12.5px;font-weight:600;box-shadow:0 8px 24px rgba(0,0,0,0.25);';
        banner.innerHTML = '<span>Nouvelle version disponible</span><button id="swUpdateReloadBtn" style="background:var(--paper);color:var(--ink);border:none;border-radius:999px;padding:6px 13px;font-weight:700;cursor:pointer;font-size:12.5px;">Recharger</button>';
        document.body.appendChild(banner);
        document.getElementById('swUpdateReloadBtn').addEventListener('click', () => window.location.reload());
      };
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdate();
          }
        });
      });
      // Mobile ne revérifie pas toujours spontanément le sw.js : on force la
      // vérification à chaque retour au premier plan, et périodiquement.
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registration.update().catch(() => {});
      });
      setInterval(() => registration.update().catch(() => {}), 60 * 60 * 1000);
    } catch (err) { /* pas grave hors ligne au premier chargement */ }
  });
}
