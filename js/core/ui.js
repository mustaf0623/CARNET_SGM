/* js/core/ui.js — Petits helpers d’interface : toast, carte de stat, ligne vide */

function showToast(msg, icon) {
  const t = document.getElementById('toast');
  t.innerHTML = (icon || '') + '<span>' + msg + '</span>';
  t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

function statCard(label, value, note, cls) {
  return `<div class="card stat-card ${cls}">
    <div class="stat-label">${label}</div>
    <div class="stat-value">${value}</div>
    <div class="stat-note">${note}</div>
  </div>`;
}
function emptyRow(msg) { return `<div class="ledger-row" style="color:var(--ink-faint);font-size:13px;">${msg}</div>`; }
