/* js/services/information-pdf.js — Export PDF des informations et rappels */

function buildInformationReportDoc(fromDate, toDate) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const d = state.data;
  const emeraldDk = [11, 122, 85], ink = [28, 42, 32], faint = [132, 146, 127];
  const gold = [196, 137, 15], white = [255, 255, 255], line = [214, 219, 204];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentW = pageW - margin * 2;
  const entries = informationInRange(fromDate, toDate);
  const dailyEntries = entries.filter(item => item.kind === 'jour');
  const reminders = entries.filter(item => item.kind === 'rappel');
  const rangeLabel = fromDate || toDate
    ? `${fromDate ? fmtDate(fromDate) : 'Depuis le début'} – ${toDate ? fmtDate(toDate) : 'Sans limite'}`
    : 'Toutes les dates';

  doc.setFillColor(...emeraldDk); doc.rect(0, 0, pageW, 34, 'F');
  doc.setFillColor(...gold); doc.rect(0, 34, pageW, 1.4, 'F');
  try { doc.addImage(PDF_LOGO_PNG, 'PNG', margin - 0.5, 9.5, 13, 13); }
  catch (e) {
    doc.setFont('times', 'bold'); doc.setFontSize(15); doc.setTextColor(...white);
    doc.text('C', margin + 6, 18, { align: 'center' });
  }
  doc.setFont('times', 'bold'); doc.setFontSize(19); doc.setTextColor(...white);
  doc.text('Carnet SGM', margin + 17, 15);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(230, 240, 235);
  doc.text('Informations et rappels', margin + 17, 22);
  doc.setFontSize(9); doc.text(rangeLabel, pageW - margin, 15, { align: 'right' });
  doc.text(`Généré le ${fmtDate(todayISO())} à ${nowTime()}`, pageW - margin, 22, { align: 'right' });

  let y = 48;
  const ensureSpace = needed => {
    if (y + needed > pageH - margin - 30) {
      doc.addPage();
      y = 22;
    }
  };
  const drawSectionTitle = title => {
    ensureSpace(14);
    doc.setFont('times', 'bold'); doc.setFontSize(13); doc.setTextColor(...emeraldDk);
    doc.text(title, margin, y);
    y += 8;
  };
  const drawEntries = (items, emptyLabel) => {
    if (!items.length) {
      ensureSpace(8);
      doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...faint);
      doc.text(emptyLabel, margin, y);
      y += 9;
      return;
    }
    items.forEach(item => {
      const titleLines = doc.splitTextToSize(item.title || (item.kind === 'jour' ? 'Information du jour' : 'Rappel'), contentW);
      const bodyLines = doc.splitTextToSize(item.content || '', contentW);
      ensureSpace(9 + titleLines.length * 5 + bodyLines.length * 5 + 6);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...ink);
      doc.text(fmtDate(item.date), margin, y);
      y += 5.5;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...ink);
      doc.text(titleLines, margin, y);
      y += titleLines.length * 5;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...ink);
      bodyLines.forEach(lineText => {
        ensureSpace(6);
        doc.text(lineText, margin, y);
        y += 5;
      });
      y += 4;
      doc.setDrawColor(...line); doc.line(margin, y, pageW - margin, y);
      y += 6;
    });
  };

  drawSectionTitle('Informations par journée');
  drawEntries(dailyEntries, 'Aucune information enregistrée pour cette période.');
  drawSectionTitle('Rappels');
  drawEntries(reminders, 'Aucun rappel enregistré pour cette période.');

  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...line);
    doc.line(margin, pageH - 22, pageW - margin, pageH - 22);
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9.5); doc.setTextColor(...ink);
    doc.text('Signé par Collège des présidents', margin, pageH - 15);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...faint);
    doc.text(`Généré automatiquement par Carnet SGM le ${fmtDate(todayISO())} à ${nowTime()}`, margin, pageH - 10.5);
    doc.text(`Page ${page} / ${totalPages}`, pageW - margin, pageH - 10.5, { align: 'right' });
  }
  const filename = `informations-${fromDate || 'debut'}-${toDate || 'fin'}.pdf`;
  return { doc, filename };
}

function downloadInformationReport(fromDate, toDate) {
  if (!state.account || !['ca', 'president'].includes(state.account.role)) {
    showToast('Accès non autorisé aux informations');
    return;
  }
  if (fromDate && toDate && fromDate > toDate) {
    showToast('La date de début doit précéder la date de fin');
    return;
  }
  const { doc, filename } = buildInformationReportDoc(fromDate, toDate);
  doc.save(filename);
  showToast('Rapport des informations téléchargé');
}
