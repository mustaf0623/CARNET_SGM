/* js/views/information.js — Informations quotidiennes et rappels */

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function informationWeekDays(weekStart) {
  const start = new Date(`${weekStart}T12:00:00`);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return localDateString(date);
  });
}

function informationForDate(date, kind) {
  return (state.data.informations || []).find(item => item.date === date && item.kind === kind) || null;
}

function informationInRange(fromDate, toDate) {
  return (state.data.informations || [])
    .filter(item => (!fromDate || item.date >= fromDate) && (!toDate || item.date <= toDate))
    .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
}

function informationWeekStart(dateString) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return localDateString(date);
}

function informationPeriods() {
  const dates = (state.data.informations || []).map(item => item.date);
  const years = Array.from(new Set(dates.map(date => date.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  const months = Array.from(new Set(dates.map(date => date.slice(0, 7)))).sort((a, b) => b.localeCompare(a));
  const weeks = Array.from(new Set(dates.map(informationWeekStart))).sort((a, b) => b.localeCompare(a));
  return { years, months, weeks };
}

function informationRangeForPeriod(period) {
  if (!period || period === 'toutes') return { fromDate: '', toDate: '' };
  const [type, value] = period.split(':');
  if (type === 'annee') return { fromDate: `${value}-01-01`, toDate: `${value}-12-31` };
  if (type === 'mois') {
    const [year, month] = value.split('-').map(Number);
    return {
      fromDate: `${value}-01`,
      toDate: localDateString(new Date(year, month, 0)),
    };
  }
  if (type === 'semaine') {
    return { fromDate: value, toDate: informationWeekDays(value)[6] };
  }
  return { fromDate: '', toDate: '' };
}

function informationPeriodOptions(selectedPeriod) {
  const { years, months, weeks } = informationPeriods();
  const weekLabel = weekStart => `Semaine du ${fmtDate(weekStart)} au ${fmtDate(informationWeekDays(weekStart)[6])}`;
  return `<option value="toutes" ${selectedPeriod === 'toutes' ? 'selected' : ''}>Toutes les périodes</option>`
    + (years.length ? `<optgroup label="Par année">${years.map(year => `<option value="annee:${year}" ${selectedPeriod === 'annee:' + year ? 'selected' : ''}>${year}</option>`).join('')}</optgroup>` : '')
    + (months.length ? `<optgroup label="Par mois">${months.map(month => `<option value="mois:${month}" ${selectedPeriod === 'mois:' + month ? 'selected' : ''}>${monthLabel(month)}</option>`).join('')}</optgroup>` : '')
    + (weeks.length ? `<optgroup label="Par semaine">${weeks.map(week => `<option value="semaine:${week}" ${selectedPeriod === 'semaine:' + week ? 'selected' : ''}>${escapeHtml(weekLabel(week))}</option>`).join('')}</optgroup>` : '');
}

function renderInformation() {
  if (!canManageInformation()) return '<div class="card">Accès non autorisé.</div>';
  const weekDays = informationWeekDays(state.informationWeekStart || todayISO());
  const dailyInformation = informationForDate(state.informationDate, 'jour');
  const reminders = (state.data.informations || [])
    .filter(item => item.kind === 'rappel')
    .sort((a, b) => a.date.localeCompare(b.date));
  const editingReminder = reminders.find(item => item.id === state.informationReminderEditId) || null;
  const weekEnd = weekDays[6];

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Communication</div>
        <h1 class="page-title">Information</h1>
        <p class="page-sub">Saisissez les informations par date et gérez les rappels. Les informations sont accessibles au CA dans Rapports.</p>
      </div>
    </div>
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
        <div>
          <h3 class="card-title">Informations de la semaine</h3>
          <div class="card-sub" style="margin:4px 0 0;">Du ${fmtDate(weekDays[0])} au ${fmtDate(weekEnd)}</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button type="button" class="btn btn-ghost btn-sm" id="informationPreviousWeek" aria-label="Semaine précédente">← Précédente</button>
          <button type="button" class="btn btn-ghost btn-sm" id="informationNextWeek" aria-label="Semaine suivante">Suivante →</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:8px;margin:18px 0;">
        ${weekDays.map(date => {
          const item = informationForDate(date, 'jour');
          const dayName = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long' });
          return `<button type="button" class="information-day-btn ${state.informationDate === date ? 'active' : ''}" data-information-day="${date}" style="display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 12px;border:1px solid ${state.informationDate === date ? 'var(--emerald)' : 'var(--line)'};border-radius:12px;background:${state.informationDate === date ? 'var(--emerald-tint)' : 'var(--card-2)'};color:var(--ink);text-align:left;">
            <span style="font-size:11px;color:var(--ink-faint);text-transform:capitalize;">${escapeHtml(dayName)}</span>
            <strong>${fmtDate(date)}</strong>
            <span style="font-size:11px;color:${item ? 'var(--emerald-dim)' : 'var(--ink-faint)'};">${item ? 'Information enregistrée' : 'À compléter'}</span>
          </button>`;
        }).join('')}
      </div>
      <div class="field">
        <label for="dailyInformationTitle">Titre (facultatif)</label>
        <input type="text" id="dailyInformationTitle" maxlength="160" placeholder="Ex. Réunion de coordination" value="${escapeHtml(dailyInformation ? dailyInformation.title : '')}">
      </div>
      <div class="field" style="margin-top:12px;">
        <label for="dailyInformationContent">Informations du ${fmtDate(state.informationDate)}</label>
        <textarea id="dailyInformationContent" rows="7" placeholder="Saisissez les informations concernant cette date…" style="width:100%;padding:12px;font-family:inherit;font-size:13.5px;line-height:1.6;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);">${escapeHtml(dailyInformation ? dailyInformation.content : '')}</textarea>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
        <button type="button" class="btn btn-primary" id="saveDailyInformationBtn">${dailyInformation ? 'Modifier les informations' : 'Enregistrer les informations'}</button>
        ${dailyInformation ? '<button type="button" class="btn btn-ghost btn-sm" id="deleteDailyInformationBtn" style="color:var(--terracotta);">Supprimer cette information</button>' : ''}
      </div>
    </div>
    <div class="card" style="margin-top:18px;">
      <h3 class="card-title">Rappels</h3>
      <p class="card-sub">Ajoutez des rappels datés. Vous pourrez les modifier après leur enregistrement.</p>
      <div class="grid grid-2" style="align-items:start;">
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div class="field">
            <label for="informationReminderDate">Date du rappel</label>
            <input type="date" id="informationReminderDate" value="${escapeHtml(editingReminder ? editingReminder.date : todayISO())}">
          </div>
          <div class="field">
            <label for="informationReminderTitle">Titre</label>
            <input type="text" id="informationReminderTitle" maxlength="160" placeholder="Ex. Envoyer les rapports" value="${escapeHtml(editingReminder ? editingReminder.title : '')}">
          </div>
          <div class="field">
            <label for="informationReminderContent">Détail du rappel</label>
            <textarea id="informationReminderContent" rows="4" placeholder="Décrivez le rappel…" style="width:100%;padding:12px;font-family:inherit;font-size:13.5px;line-height:1.6;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--ink);">${escapeHtml(editingReminder ? editingReminder.content : '')}</textarea>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button type="button" class="btn btn-primary" id="saveInformationReminderBtn">${editingReminder ? 'Enregistrer les modifications' : 'Ajouter le rappel'}</button>
            ${editingReminder ? '<button type="button" class="btn btn-ghost" id="cancelInformationReminderEditBtn">Annuler</button>' : ''}
          </div>
        </div>
        <div class="ledger">
          ${reminders.length ? reminders.map(item => `<div class="ledger-row" style="align-items:flex-start;">
            <div style="flex:1;min-width:0;">
              <div class="prog-name">${escapeHtml(item.title)}</div>
              <div style="font-size:11.5px;color:var(--ink-faint);margin:3px 0 6px;">${fmtDate(item.date)}</div>
              <div style="font-size:12.5px;line-height:1.55;white-space:pre-wrap;">${escapeHtml(item.content)}</div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button type="button" class="btn btn-ghost btn-sm editInformationReminderBtn" data-id="${escapeHtml(item.id)}">Modifier</button>
              <button type="button" class="btn btn-ghost btn-sm deleteInformationReminderBtn" data-id="${escapeHtml(item.id)}" style="color:var(--terracotta);">Supprimer</button>
            </div>
          </div>`).join('') : emptyRow('Aucun rappel enregistré.')}
        </div>
      </div>
    </div>
  `;
}

async function saveInformationRows() {
  return await saveData(isPresidentReadOnly() ? { presidentInformationChange: true } : {});
}

function attachInformationEvents() {
  document.getElementById('informationPreviousWeek')?.addEventListener('click', () => {
    const date = new Date(`${state.informationWeekStart}T12:00:00`);
    date.setDate(date.getDate() - 7);
    state.informationWeekStart = localDateString(date);
    state.informationDate = state.informationWeekStart;
    render();
  });
  document.getElementById('informationNextWeek')?.addEventListener('click', () => {
    const date = new Date(`${state.informationWeekStart}T12:00:00`);
    date.setDate(date.getDate() + 7);
    state.informationWeekStart = localDateString(date);
    state.informationDate = state.informationWeekStart;
    render();
  });
  document.querySelectorAll('[data-information-day]').forEach(button => button.addEventListener('click', () => {
    state.informationDate = button.dataset.informationDay;
    render();
  }));
  document.getElementById('saveDailyInformationBtn')?.addEventListener('click', async () => {
    const content = document.getElementById('dailyInformationContent').value.trim();
    if (!content) { showToast('Saisissez les informations de cette journée'); return; }
    const existing = informationForDate(state.informationDate, 'jour');
    const information = {
      id: existing ? existing.id : `jour-${state.informationDate}`,
      date: state.informationDate,
      kind: 'jour',
      title: document.getElementById('dailyInformationTitle').value.trim(),
      content,
      updatedAt: new Date().toISOString(),
    };
    if (existing) state.data.informations = state.data.informations.map(item => item.id === existing.id ? information : item);
    else state.data.informations.push(information);
    const saved = await saveInformationRows();
    if (!saved) return;
    showToast(existing ? 'Informations modifiées' : 'Informations enregistrées');
    render();
  });
  document.getElementById('deleteDailyInformationBtn')?.addEventListener('click', () => {
    const information = informationForDate(state.informationDate, 'jour');
    if (!information) return;
    openConfirm(
      'Supprimer cette information ?',
      `L’information du ${fmtDate(information.date)} sera définitivement supprimée pour tous les utilisateurs synchronisés. Cette action est irréversible.`,
      async () => {
        state.data.informations = state.data.informations.filter(item => item.id !== information.id);
        const saved = await saveInformationRows();
        if (!saved) return;
        showToast('Information supprimée');
        render();
      },
      'Supprimer définitivement'
    );
  });
  document.getElementById('saveInformationReminderBtn')?.addEventListener('click', async () => {
    const date = document.getElementById('informationReminderDate').value;
    const title = document.getElementById('informationReminderTitle').value.trim();
    const content = document.getElementById('informationReminderContent').value.trim();
    if (!date || !title || !content) { showToast('Renseignez la date, le titre et le détail du rappel'); return; }
    const existing = state.data.informations.find(item => item.id === state.informationReminderEditId && item.kind === 'rappel');
    const reminder = {
      id: existing ? existing.id : uid(), date, kind: 'rappel', title, content,
      updatedAt: new Date().toISOString(),
    };
    if (existing) state.data.informations = state.data.informations.map(item => item.id === existing.id ? reminder : item);
    else state.data.informations.push(reminder);
    const saved = await saveInformationRows();
    if (!saved) return;
    state.informationReminderEditId = null;
    showToast(existing ? 'Rappel modifié' : 'Rappel ajouté');
    render();
  });
  document.querySelectorAll('.editInformationReminderBtn').forEach(button => button.addEventListener('click', () => {
    state.informationReminderEditId = button.dataset.id;
    render();
  }));
  document.querySelectorAll('.deleteInformationReminderBtn').forEach(button => button.addEventListener('click', () => {
    const reminder = state.data.informations.find(item => item.id === button.dataset.id && item.kind === 'rappel');
    if (!reminder) return;
    openConfirm(
      'Supprimer ce rappel ?',
      `Le rappel « ${reminder.title} » du ${fmtDate(reminder.date)} sera définitivement supprimé pour tous les utilisateurs synchronisés. Cette action est irréversible.`,
      async () => {
        state.data.informations = state.data.informations.filter(item => item.id !== reminder.id);
        if (state.informationReminderEditId === reminder.id) state.informationReminderEditId = null;
        const saved = await saveInformationRows();
        if (!saved) return;
        showToast('Rappel supprimé');
        render();
      },
      'Supprimer définitivement'
    );
  }));
  document.getElementById('cancelInformationReminderEditBtn')?.addEventListener('click', () => {
    state.informationReminderEditId = null;
    render();
  });
}
