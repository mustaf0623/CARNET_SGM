/* js/services/export-members.js — Export des membres : feuille Excel et PDF tabulaire */

// Construit une feuille Excel avec des colonnes dimensionnées selon leur
// contenu (au lieu de la largeur fixe minuscule par défaut) et un contenu
// centré, en-tête en gras. Le centrage/gras dépend du moteur Excel utilisé
// pour ouvrir le fichier (Excel/LibreOffice l'appliquent ; certains
// lecteurs en ligne ignorent le style mais gardent toujours les bonnes
// largeurs de colonnes, qui elles s'appliquent partout.
function buildStyledSheet(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const headers = Object.keys(rows[0] || {});
  ws['!cols'] = headers.map(h => {
    const maxLen = Math.max(h.length, ...rows.map(r => String(r[h] ?? '').length));
    return { wch: Math.min(Math.max(maxLen + 3, 12), 42) };
  });
  ws['!rows'] = [{ hpt: 20 }];
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; R++) {
      for (let C = range.s.c; C <= range.e.c; C++) {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) continue;
        cell.s = {
          alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
          font: R === range.s.r ? { bold: true } : {},
        };
      }
    }
  }
  return ws;
}

// Génère un PDF tabulaire (colonnes proportionnelles au contenu, pagination
// automatique, en-tête répété sur chaque page) pour l'export de membres.
function buildExportPdf(rows) {
  const { jsPDF } = window.jspdf;
  const headers = Object.keys(rows[0] || {});
  const landscape = headers.length > 5;
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait' });
  const emeraldDk = [11, 122, 85], ink = [28, 42, 32], white = [255, 255, 255], track = [242, 245, 234], faint = [132, 146, 127];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentW = pageW - margin * 2;
  const cellPad = 1.6;

  // Une valeur trop longue (lien Google Drive, etc.) écraserait toutes les
  // autres colonnes si on dimensionnait uniquement d'après le contenu le
  // plus long. On la raccourcit pour l'affichage PDF (le fichier Excel, lui,
  // garde toujours la valeur complète).
  function truncateForPdf(v) {
    const s = String(v ?? '');
    if (/^https?:\/\//i.test(s)) return s.length > 26 ? s.slice(0, 23) + '…' : s;
    return s.length > 70 ? s.slice(0, 67) + '…' : s;
  }
  const displayRows = rows.map(row => {
    const r = {};
    headers.forEach(h => { r[h] = truncateForPdf(row[h]); });
    return r;
  });

  // Taille de police adaptative selon le nombre de colonnes, pour rester
  // lisible même avec beaucoup de champs importés.
  let fontSize = 8;
  if (headers.length > 8) fontSize = 7;
  if (headers.length > 12) fontSize = 6;
  if (headers.length > 16) fontSize = 5.3;
  const lineH = fontSize * 0.62 + 2.1;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(fontSize);
  const CHAR_W = fontSize * 0.21; // largeur moyenne approx. d'un caractère, en mm
  const minW = Math.max(fontSize * 2.1, 11);
  const maxW = 52;
  const rawWidths = headers.map(h => {
    const maxLen = Math.max(String(h).length, ...displayRows.map(r => r[h].length), 3);
    return Math.min(Math.max(maxLen * CHAR_W, minW), maxW);
  });
  const totalRaw = rawWidths.reduce((a, b) => a + b, 0) || 1;
  const widths = rawWidths.map(w => (w / totalRaw) * contentW);

  let y = margin;
  function drawHeaderRow() {
    doc.setFillColor(...emeraldDk);
    doc.rect(margin, y, contentW, lineH + 2.2, 'F');
    doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(fontSize);
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(String(h), x + cellPad, y + lineH, { maxWidth: widths[i] - cellPad * 2 });
      x += widths[i];
    });
    y += lineH + 2.2;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(fontSize); doc.setTextColor(...ink);
  }

  doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(...ink);
  doc.text('Carnet SGM — Export des membres', margin, y); y += 7;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...faint);
  doc.text(`${rows.length} membre${rows.length > 1 ? 's' : ''} — généré le ${fmtDate(todayISO())} à ${nowTime()}`, margin, y);
  y += 6;
  drawHeaderRow();

  displayRows.forEach((row, idx) => {
    const cellLines = headers.map((h, i) => doc.splitTextToSize(row[h], widths[i] - cellPad * 2));
    const nLines = Math.max(1, ...cellLines.map(l => l.length));
    const rowH = nLines * lineH * 0.82 + 2.2;
    if (y + rowH > pageH - margin) { doc.addPage(); y = margin; drawHeaderRow(); }
    if (idx % 2 === 1) { doc.setFillColor(...track); doc.rect(margin, y, contentW, rowH, 'F'); }
    let x = margin;
    headers.forEach((h, i) => {
      doc.text(cellLines[i], x + cellPad, y + lineH * 0.82, { maxWidth: widths[i] - cellPad * 2 });
      x += widths[i];
    });
    y += rowH;
  });

  doc.save(`carnet-sgm-export-membres-${new Date().toISOString().slice(0, 10)}.pdf`);
}
