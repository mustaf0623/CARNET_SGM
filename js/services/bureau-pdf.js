/* js/services/bureau-pdf.js — Exports PDF du Bureau : procès-verbal, membres, statistiques */

function splitRichTextSegments(line) {
  const parts = [];
  const pattern = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(line))) {
    if (match.index > lastIndex) parts.push({ text: line.slice(lastIndex, match.index), bold: false });
    parts.push({ text: match[1], bold: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) parts.push({ text: line.slice(lastIndex), bold: false });
  return parts.filter(p => p.text.length);
}
function drawRichPvLine(doc, line, x, y, maxWidth, fontSize, color, pageH, margin) {
  const trimmed = line.trim();
  const headingMatch = trimmed.match(/^(#{1,2})\s+(.*)$/);
  if (headingMatch) {
    const level = headingMatch[1].length;
    const title = headingMatch[2].trim();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(level === 1 ? 13 : 11.5);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(title, maxWidth);
    lines.forEach(textLine => {
      if (y > pageH - margin - 12) { doc.addPage(); y = margin + 8; }
      doc.text(textLine, x, y);
      y += level === 1 ? 7 : 6;
    });
    return y + 2;
  }
  if (!trimmed) return y + 2.5;

  const bulletMatch = trimmed.match(/^[-*]\s+(.*)$/);
  const content = bulletMatch ? `• ${bulletMatch[1]}` : trimmed;
  const segments = splitRichTextSegments(content);
  let lineY = y;
  let currentLineParts = [];
  let currentLineWidth = 0;
  let currentX = x;

  function flushLine() {
    if (!currentLineParts.length) return;
    let cursorX = x;
    currentLineParts.forEach(part => {
      doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.setTextColor(...color);
      doc.text(part.text, cursorX, lineY);
      cursorX += doc.getTextWidth(part.text) + 1.2;
    });
    lineY += 5.4;
    currentLineParts = [];
    currentLineWidth = 0;
    currentX = x;
  }

  segments.forEach(part => {
    doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
    doc.setFontSize(fontSize);
    const width = doc.getTextWidth(part.text);
    if (currentLineParts.length && currentLineWidth + width + 1.2 > maxWidth) {
      flushLine();
      if (lineY > pageH - margin - 12) { doc.addPage(); lineY = margin + 8; }
    }
    currentLineParts.push(part);
    currentLineWidth += width + 1.2;
  });
  flushLine();
  return lineY;
}

// ---- Export PDF : procès-verbal (mise en page soignée façon document officiel) ----
function buildProcesVerbalPdf(r, mandat, membresAssoc, d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const emeraldDk = [11, 122, 85], ink = [28, 42, 32], faint = [132, 146, 127], gold = [196, 137, 15], white = [255, 255, 255];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;

  // Bandeau d'en-tête
  doc.setFillColor(...emeraldDk); doc.rect(0, 0, pageW, 32, 'F');
  doc.setFillColor(...gold); doc.rect(0, 32, pageW, 1.3, 'F');
  try { doc.addImage(PDF_LOGO_PNG, 'PNG', margin - 0.5, 8.5, 12, 12); } catch (e) { /* logo indisponible */ }
  doc.setFont('times', 'bold'); doc.setFontSize(17); doc.setTextColor(...white);
  doc.text('Procès-verbal', margin + 16, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(230, 240, 235);
  doc.text(`Bureau — ${mandat ? mandat.nom : ''}`, margin + 16, 21.5);
  doc.setFontSize(9); doc.setTextColor(230, 240, 235);
  doc.text(`Réunion n°${r.numero}`, pageW - margin, 15, { align: 'right' });
  doc.text(fmtDate(r.date), pageW - margin, 21, { align: 'right' });

  let y = 44;
  doc.setTextColor(...ink);
  if (r.ordreDuJour) {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Ordre du jour', margin, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
    const odjPoints = r.ordreDuJour.split('\n').map(l => l.trim()).filter(Boolean);
    odjPoints.forEach(point => {
      const wrapped = doc.splitTextToSize('•  ' + point, contentW);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 5.4 + 1.2;
    });
    y += 6.5;
  }

  // Liste de présence
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text('Présences', margin, y); y += 6;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  const pointagesMap = new Map((d.bureauPointages || []).filter(p => p.reunionId === r.id).map(p => [p.membreId, p.statut]));
  const presents = membresAssoc.filter(bm => pointagesMap.get(bm.membreId) === 'present').map(bm => `${bm.membre.prenom} ${bm.membre.nom}${bm.poste ? ' (' + bm.poste.nom + ')' : ''}`);
  const absents = membresAssoc.filter(bm => pointagesMap.get(bm.membreId) === 'absent').map(bm => `${bm.membre.prenom} ${bm.membre.nom}${bm.poste ? ' (' + bm.poste.nom + ')' : ''}`);
  const extraPresents = (d.bureauPresenceExtras || []).filter(x => x.reunionId === r.id && x.statut === 'present').map(x => `${x.name}${x.poste ? ' (' + x.poste + ')' : ''}`);
  doc.setTextColor(...ink);
  const presLines = doc.splitTextToSize(`Membres du Bureau présents (${presents.length}) : ${presents.length ? presents.join(', ') + ' ont été présents.' : '—'}`, contentW);
  doc.text(presLines, margin, y); y += presLines.length * 5 + 3;
  if (extraPresents.length) {
    const guestLines = doc.splitTextToSize(`Invités présents (${extraPresents.length}) : ${extraPresents.join(', ')} ont été présents.`, contentW);
    doc.text(guestLines, margin, y); y += guestLines.length * 5 + 3;
  }
  doc.setTextColor(...faint);
  const absLines = doc.splitTextToSize(`Absents (${absents.length}) : ${absents.join(', ') || '—'}`, contentW);
  doc.text(absLines, margin, y); y += absLines.length * 5 + 10;

  // Corps du procès-verbal
  doc.setTextColor(...ink);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5);
  const bodyText = r.pvTexte && r.pvTexte.trim() ? r.pvTexte : (r.pvLien ? `Procès-verbal disponible en fichier joint : ${r.pvLien}` : '(procès-verbal non encore rédigé)');
  const paragraphs = bodyText.split('\n');
  paragraphs.forEach(p => {
    const text = p || ' ';
    if (y > pageH - margin - 16) { doc.addPage(); y = margin + 8; }
    y = drawRichPvLine(doc, text, margin, y, contentW, 10.5, ink, pageH, margin);
  });

  if (r.pvLien && r.pvTexte && r.pvTexte.trim()) {
    if (y > pageH - margin - 16) { doc.addPage(); y = margin; }
    y += 4;
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...faint);
    doc.text(`Document complémentaire : ${r.pvLien}`, margin, y);
  }

  // Pied de page
  const footY = pageH - 12;
  doc.setDrawColor(214, 219, 204); doc.line(margin, footY - 6, pageW - margin, footY - 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...faint);
  doc.text(`Généré le ${fmtDate(todayISO())} à ${nowTime()}`, margin, footY);
  if (state.data.profile.name) doc.text(`Signataire : ${state.data.profile.name}`, pageW - margin, footY, { align: 'right' });

  doc.save(`pv-reunion-${r.numero}-${(mandat ? mandat.nom : '').replace(/\s+/g, '_')}.pdf`);
}

// ---- Export PDF : membres du Bureau par mandat ----
function buildBureauMembersPdf(mandat, d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const emeraldDk = [11, 122, 85], ink = [28, 42, 32], faint = [132, 146, 127], gold = [196, 137, 15], white = [255, 255, 255], track = [242, 245, 234];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;

  doc.setFillColor(...emeraldDk); doc.rect(0, 0, pageW, 32, 'F');
  doc.setFillColor(...gold); doc.rect(0, 32, pageW, 1.3, 'F');
  try { doc.addImage(PDF_LOGO_PNG, 'PNG', margin - 0.5, 8.5, 12, 12); } catch (e) { /* logo indisponible */ }
  doc.setFont('times', 'bold'); doc.setFontSize(17); doc.setTextColor(...white);
  doc.text('Membres du Bureau', margin + 16, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(230, 240, 235);
  doc.text(`Mandat — ${mandat.nom}`, margin + 16, 21.5);
  doc.setFontSize(9); doc.setTextColor(230, 240, 235);
  doc.text(`Généré le ${fmtDate(todayISO())}`, pageW - margin, 18, { align: 'right' });

  const members = bureauMembresForMandat(d, mandat.id);
  let y = 44;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...ink);
  doc.text(`${members.length} membre${members.length > 1 ? 's' : ''} du Bureau`, margin, y);
  y += 8;

  const headers = ['Prénom', 'Nom', 'Poste', 'Contact'];
  const rows = members.map(bm => [
    bm.membre?.prenom || '—',
    bm.membre?.nom || '—',
    bm.poste?.nom || '—',
    getMemberContactInfo(bm.membre) || '—'
  ]);
  const colRatios = [0.22, 0.22, 0.24, 0.32];
  const widths = colRatios.map(r => r * contentW);
  const lineH = 6.5;

  function drawHeaderRow() {
    doc.setFillColor(...emeraldDk); doc.rect(margin, y, contentW, lineH + 2, 'F');
    doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    let x = margin;
    headers.forEach((h, i) => { doc.text(h, x + 3, y + lineH, { maxWidth: widths[i] - 6 }); x += widths[i]; });
    y += lineH + 2;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...ink);
  }

  drawHeaderRow();
  rows.forEach((row, idx) => {
    const wrapped = row.map((cell, i) => doc.splitTextToSize(String(cell), widths[i] - 6));
    const nLines = Math.max(1, ...wrapped.map(cells => cells.length));
    const rowHeight = nLines * lineH * 0.78;
    if (y + rowHeight > pageH - margin) { doc.addPage(); y = margin; drawHeaderRow(); }
    if (idx % 2 === 1) { doc.setFillColor(...track); doc.rect(margin, y, contentW, rowHeight, 'F'); }
    doc.setFontSize(9.2); doc.setTextColor(...ink);
    let x = margin;
    wrapped.forEach((cells, i) => {
      const text = cells[0] || '';
      doc.text(text, x + 3, y + lineH * 0.68, { maxWidth: widths[i] - 6 });
      x += widths[i];
    });
    y += rowHeight;
  });

  doc.save(`membres-bureau-${mandat.nom.replace(/\s+/g, '_')}.pdf`);
}

// ---- Export PDF : statistiques du Bureau ----
function buildBureauStatsPdf(mandat, d) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const emeraldDk = [11, 122, 85], ink = [28, 42, 32], faint = [132, 146, 127], gold = [196, 137, 15], white = [255, 255, 255], track = [242, 245, 234];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;

  doc.setFillColor(...emeraldDk); doc.rect(0, 0, pageW, 32, 'F');
  doc.setFillColor(...gold); doc.rect(0, 32, pageW, 1.3, 'F');
  try { doc.addImage(PDF_LOGO_PNG, 'PNG', margin - 0.5, 8.5, 12, 12); } catch (e) { /* logo indisponible */ }
  doc.setFont('times', 'bold'); doc.setFontSize(17); doc.setTextColor(...white);
  doc.text('Statistiques du Bureau', margin + 16, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(230, 240, 235);
  doc.text(`Mandat — ${mandat.nom}`, margin + 16, 21.5);
  doc.setFontSize(9); doc.setTextColor(230, 240, 235);
  doc.text(`Généré le ${fmtDate(todayISO())}`, pageW - margin, 18, { align: 'right' });

  const g = bureauGlobalStats(d, mandat.id);
  let y = 42;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...ink);
  doc.text(`${g.nbMembres} membre(s) du Bureau · ${g.nbReunions} réunion(s) · taux de présence global : ${g.tauxPresence}%`, margin, y);
  y += 10;

  const headers = ['Membre', 'Poste', 'Présences', 'Absences', 'Taux présence', 'Taux absence'];
  const rows = bureauMembresForMandat(d, mandat.id).map(bm => {
    const s = bureauMemberStats(d, bm.membreId, mandat.id);
    return [`${bm.membre.prenom} ${bm.membre.nom}`, bm.poste ? bm.poste.nom : '—', String(s.present), String(s.absent), s.tauxPresence + '%', s.tauxAbsence + '%'];
  });
  const colRatios = [0.34, 0.28, 0.13, 0.13, 0.12];
  const widths = colRatios.map(r => r * contentW);
  const lineH = 6.5;

  function drawHeaderRow() {
    doc.setFillColor(...emeraldDk); doc.rect(margin, y, contentW, lineH + 2, 'F');
    doc.setTextColor(...white); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    let x = margin;
    headers.forEach((h, i) => { doc.text(h, x + 3, y + lineH, { maxWidth: widths[i] - 6 }); x += widths[i]; });
    y += lineH + 2;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...ink);
  }
  drawHeaderRow();
  rows.forEach((row, idx) => {
    if (y + lineH > pageH - margin) { doc.addPage(); y = margin; drawHeaderRow(); }
    if (idx % 2 === 1) { doc.setFillColor(...track); doc.rect(margin, y, contentW, lineH, 'F'); }
    doc.setFontSize(9.5); doc.setTextColor(...ink);
    let x = margin;
    row.forEach((cell, i) => { doc.text(String(cell), x + 3, y + lineH * 0.68, { maxWidth: widths[i] - 6 }); x += widths[i]; });
    y += lineH;
  });

  doc.save(`stats-bureau-${mandat.nom.replace(/\s+/g, '_')}.pdf`);
}
