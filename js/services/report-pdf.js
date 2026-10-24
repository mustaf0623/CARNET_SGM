/* js/services/report-pdf.js — Rapports PDF de présence (global, programme, séance) */

function buildReportDoc(scope, yearFilter, sessionId) {
  yearFilter = yearFilter || 'toutes';
  const d = state.data;
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const emerald = [15, 158, 110], emeraldDk = [11, 122, 85], ink = [28, 42, 32], faint = [132, 146, 127],
        terracotta = [225, 95, 30], gold = [196, 137, 15], track = [232, 232, 224], white = [255, 255, 255];
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = pageW - margin * 2;
  const scopeLabel = scope === 'global' ? 'Tous les programmes' : ((d.programmes.find(p => p.id === scope) || {}).nom || '');

  // ---------- Bandeau d'en-tête ----------
  doc.setFillColor(...emeraldDk);
  doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(...gold);
  doc.rect(0, 34, pageW, 1.4, 'F');
  // Monogramme (logo de l'app)
  try {
    doc.addImage(PDF_LOGO_PNG, 'PNG', margin - 0.5, 9.5, 13, 13);
  } catch (e) {
    doc.setFillColor(...white);
    doc.circle(margin + 6, 16, 6.5, 'F');
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(...emeraldDk);
    doc.text('C', margin + 6, 18.7, { align: 'center' });
  }
  // Titre
  doc.setFont('times', 'bold'); doc.setFontSize(19); doc.setTextColor(...white);
  doc.text('Carnet SGM', margin + 17, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(230, 240, 235);
  doc.text('Rapport de présence', margin + 17, 21.5);
  // Méta à droite
  doc.setFontSize(9); doc.setTextColor(230, 240, 235);
  const session = sessionId && sessionId !== 'toutes' ? d.sessions.find(s => s.id === sessionId) : null;
  doc.text(scopeLabel, pageW - margin, 13, { align: 'right' });
  if (session) {
    doc.text('Lieu : ' + sessionLieu(session), pageW - margin, 18.5, { align: 'right' });
    doc.text(fmtDate(session.date) + '  ·  généré le ' + fmtDate(todayISO()) + ' à ' + nowTime(), pageW - margin, 23.5, { align: 'right' });
  } else {
    const periodLabel = yearFilter === 'toutes' ? '' : (yearFilter.length === 7 ? monthLabel(yearFilter) : 'Année ' + yearFilter) + '  ·  ';
    doc.text(periodLabel + fmtDate(todayISO()) + ' à ' + nowTime(), pageW - margin, 18.5, { align: 'right' });
  }

  let y = 48;

  // ============ RAPPORT D'UNE SÉANCE PRÉCISE ============
  if (session) {
    const programme = d.programmes.find(p => p.id === session.programmeId);
    const pointagesSession = d.pointages.filter(p => p.sessionId === session.id);
    const membresSession = d.membres.filter(m =>
      memberInProgramme(m, session.programmeId) &&
      isPriorityProgram(programme, m.categorie) &&
      pointagesSession.some(p => p.membreId === m.id && (p.statut === 'present' || p.statut === 'absent'))
    );
    const statutOf = (membreId) => { const pt = pointagesSession.find(p => p.membreId === membreId); return pt ? pt.statut : null; };
    const present = pointagesSession.filter(p => p.statut === 'present').length;
    const absent = pointagesSession.filter(p => p.statut === 'absent').length;
    const total = present + absent;
    const taux = total ? Math.round((present / total) * 100) : 0;

    doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...ink);
    doc.text('Lieu : ' + sessionLieu(session), margin, y);
    y += 6;
    if (sessionHours(session)) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...faint);
      doc.text('Horaires : ' + sessionHours(session), margin, y);
      y += 5;
    }

    const cardGap = 5;
    const cardW = (contentW - cardGap * 2) / 3;
    const cardH = 22;
    const cards = [
      { label: 'Présents', value: String(present), color: emerald },
      { label: 'Absents', value: String(absent), color: terracotta },
      { label: 'Taux de présence', value: taux + '%', color: emerald },
    ];
    cards.forEach((c, i) => {
      const cx = margin + i * (cardW + cardGap);
      doc.setFillColor(247, 247, 242);
      doc.roundedRect(cx, y, cardW, cardH, 2.4, 2.4, 'F');
      doc.setFillColor(...c.color);
      doc.roundedRect(cx, y, 2.2, cardH, 1.1, 1.1, 'F');
      doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(...c.color);
      doc.text(c.value, cx + 6, y + 12);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...faint);
      doc.text(c.label, cx + 6, y + 17.5);
    });
    y += cardH + 12;

    doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...ink);
    doc.text('Liste de présence', margin, y);
    y += 9;

    const ensureSpace2 = (needed) => { if (y + needed > 280) { doc.addPage(); y = 22; } };
    membresSession.sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom)).forEach((m, i) => {
      ensureSpace2(9);
      const statut = statutOf(m.id);
      if (i % 2 === 0) { doc.setFillColor(247, 247, 242); doc.rect(margin, y - 5.5, contentW, 8, 'F'); }
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...ink);
      doc.text(m.prenom + ' ' + m.nom, margin + 3, y);
      const label = statut === 'present' ? 'Présent' : 'Absent';
      const color = statut === 'present' ? emerald : statut === 'absent' ? terracotta : faint;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...color);
      doc.text(label, pageW - margin - 3, y, { align: 'right' });
      y += 8;
    });
    if (!membresSession.length) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...faint);
      doc.text('Aucun membre prioritaire pointé pour cette séance.', margin, y);
      y += 8;
    }

    const totalPagesSess = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPagesSess; i++) {
      doc.setPage(i);
      const pageH = doc.internal.pageSize.getHeight();
      doc.setDrawColor(...track);
      doc.line(margin, pageH - 22, pageW - margin, pageH - 22);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(...ink);
      doc.text('Signé par ' + d.profile.name + ' — Commission Administrative', margin, pageH - 15);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...faint);
      doc.text('Généré automatiquement par Carnet SGM le ' + fmtDate(todayISO()) + ' à ' + nowTime(), margin, pageH - 10.5);
      doc.text('Page ' + i + ' / ' + totalPagesSess, pageW - margin, pageH - 10.5, { align: 'right' });
    }

    const filenameSess = 'pointage-' + scopeLabel.toLowerCase().replace(/\s+/g, '-') + '-' + session.date + '.pdf';
    return { doc, filename: filenameSess };
  }

  const progsInScope = scope === 'global' ? d.programmes : d.programmes.filter(p => p.id === scope);
  const membresInScope = (scope === 'global' ? d.membres : d.membres.filter(m => memberInProgramme(m, scope))).filter(m => !m.ap);
  const nbH = membresInScope.filter(m => m.sexe === 'H').length;
  const nbF = membresInScope.filter(m => m.sexe === 'F').length;
  const globalPts = (scope === 'global' ? d.sessions : d.sessions.filter(s => s.programmeId === scope))
    .filter(s => periodMatches(s.date, yearFilter))
    .map(s => s.id);
  const ptsInScope = d.pointages.filter(p => globalPts.includes(p.sessionId));
  const presentCount = ptsInScope.filter(p => p.statut === 'present').length;
  const tauxGlobal = ptsInScope.length ? Math.round((presentCount / ptsInScope.length) * 100) : 0;

  // ---------- Cartes "Effectifs" ----------
  doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...ink);
  doc.text('Effectifs', margin, y);
  y += 6;

  const cardGap = 5;
  const cardW = (contentW - cardGap * 2) / 3;
  const cardH = 22;
  const cards = [
    { label: 'Membres inscrits', value: String(membresInScope.length), color: gold },
    { label: 'Hommes / Femmes', value: nbH + ' / ' + nbF, color: emerald },
    { label: 'Taux de présence', value: tauxGlobal + '%', color: emerald },
  ];
  cards.forEach((c, i) => {
    const cx = margin + i * (cardW + cardGap);
    doc.setFillColor(247, 247, 242);
    doc.roundedRect(cx, y, cardW, cardH, 2.4, 2.4, 'F');
    doc.setFillColor(...c.color);
    doc.roundedRect(cx, y, 2.2, cardH, 1.1, 1.1, 'F');
    doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(...c.color);
    doc.text(c.value, cx + 6, y + 12);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...faint);
    doc.text(c.label, cx + 6, y + 17.5);
  });
  y += cardH + 12;

  // ---------- Statistiques par programme ----------
  doc.setFont('times', 'bold'); doc.setFontSize(12.5); doc.setTextColor(...ink);
  doc.text('Statistiques par programme', margin, y);
  y += 3;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...faint);
  doc.setFillColor(...emerald); doc.circle(margin + 1, y + 5.3, 1.1, 'F');
  doc.text('Présence', margin + 4, y + 6.2);
  doc.setFillColor(...terracotta); doc.circle(margin + 26, y + 5.3, 1.1, 'F');
  doc.text('Absence', margin + 29, y + 6.2);
  y += 12;

  const ensureSpace = (needed) => { if (y + needed > 280) { doc.addPage(); y = 22; } };

  progsInScope.forEach(p => {
    const s = programStats(d, p.id, yearFilter);
    ensureSpace(22);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ink);
    doc.text(p.nom, margin, y);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...emeraldDk);
    doc.text(s.tauxPresence + '%', pageW - margin, y, { align: 'right' });
    y += 3.5;

    const barW = contentW;
    const barH = 3.4;
    doc.setFillColor(...track);
    doc.roundedRect(margin, y, barW, barH, 1.7, 1.7, 'F');
    if (s.tauxPresence > 0) {
      doc.setFillColor(...emerald);
      doc.roundedRect(margin, y, Math.max(barW * s.tauxPresence / 100, barH), barH, 1.7, 1.7, 'F');
    }
    y += barH + 4.5;

    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...faint);
    doc.text(s.nbMembres + ' membre' + (s.nbMembres > 1 ? 's' : '') + '   ·   ' + s.nbSessions + ' séance' + (s.nbSessions > 1 ? 's' : '') + '   ·   participation ' + s.tauxParticipation + '%', margin, y);
    y += 9;
  });

  if (!progsInScope.length) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...faint);
    doc.text('Aucun programme dans cette portée.', margin, y);
    y += 10;
  }

  // ---------- Pied de page : signature + numérotation ----------
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pageH = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...track);
    doc.line(margin, pageH - 22, pageW - margin, pageH - 22);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(...ink);
    doc.text('Signé par ' + d.profile.name + ' — Commission Administrative', margin, pageH - 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...faint);
    doc.text('Généré automatiquement par Carnet SGM le ' + fmtDate(todayISO()) + ' à ' + nowTime(), margin, pageH - 10.5);
    doc.text('Page ' + i + ' / ' + totalPages, pageW - margin, pageH - 10.5, { align: 'right' });
  }

  const filename = 'rapport-' + (scope === 'global' ? 'global' : scopeLabel.toLowerCase().replace(/\s+/g, '-')) + (yearFilter !== 'toutes' ? '-' + yearFilter : '') + '-' + todayISO() + '.pdf';
  return { doc, filename };
}

function downloadPdf(scope, yearFilter, sessionId) {
  const { doc, filename } = buildReportDoc(scope, yearFilter, sessionId);
  doc.save(filename);
  showToast('Rapport PDF téléchargé');
}
