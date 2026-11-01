/* js/views/supervision.js — Analyses descriptives de présence */

function supervisionSessions(data, programmeId, year) {
  return data.sessions
    .filter(session => (programmeId === 'global' || session.programmeId === programmeId)
      && (year === 'toutes' || periodMatches(session.date, year)))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function supervisionPointages(data, session) {
  const programme = data.programmes.find(item => item.id === session.programmeId);
  return data.pointages.filter(pointage => {
    if (pointage.sessionId !== session.id) return false;
    if (pointage.statut === 'present') return true;
    const membre = data.membres.find(item => item.id === pointage.membreId);
    return pointage.statut === 'absent' && isPriorityProgram(programme, membre && membre.categorie);
  });
}

function supervisionRate(rows) {
  const total = rows.reduce((count, row) => count + row.total, 0);
  const present = rows.reduce((count, row) => count + row.present, 0);
  return { present, total, rate: total ? Math.round((present / total) * 100) : 0 };
}

function supervisionBreakdowns(data, sessions) {
  const categories = new Map();
  const places = new Map();
  const programmePlaces = new Map();
  sessions.forEach(session => {
    const place = sessionLieu(session).trim() || 'Lieu non renseigné';
    const placeEntry = places.get(place) || { sessions: 0, present: 0, total: 0 };
    placeEntry.sessions++;
    const programme = data.programmes.find(item => item.id === session.programmeId);
    const programmeName = programme ? programme.nom : 'Programme supprimé';
    const pairKey = session.programmeId + '\u0000' + place;
    const pairEntry = programmePlaces.get(pairKey) || {
      programmeId: session.programmeId, programmeName, place, sessions: 0, present: 0, total: 0,
    };
    pairEntry.sessions++;
    supervisionPointages(data, session).forEach(pointage => {
      if (pointage.statut !== 'present' && pointage.statut !== 'absent') return;
      const membre = data.membres.find(item => item.id === pointage.membreId);
      if (!membre) return;
      const category = normaliseCategorie(membre.categorie) || String(membre.categorie || '').trim() || 'Non définie';
      const categoryEntry = categories.get(category) || { present: 0, total: 0 };
      categoryEntry.total++;
      if (pointage.statut === 'present') categoryEntry.present++;
      categories.set(category, categoryEntry);
      placeEntry.total++;
      pairEntry.total++;
      if (pointage.statut === 'present') {
        placeEntry.present++;
        pairEntry.present++;
      }
    });
    places.set(place, placeEntry);
    programmePlaces.set(pairKey, pairEntry);
  });
  return {
    categories: Array.from(categories, ([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'fr')),
    places: Array.from(places, ([name, values]) => ({ name, ...values }))
      .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name, 'fr')),
    programmePlaces: Array.from(programmePlaces.values())
      .sort((a, b) => a.programmeName.localeCompare(b.programmeName, 'fr') || b.sessions - a.sessions),
  };
}

function supervisionTrend(sessions, data) {
  const byMonth = new Map();
  sessions.forEach(session => {
    const month = sessionMonth(session.date);
    if (!month) return;
    const row = byMonth.get(month) || { month, present: 0, total: 0 };
    const stats = sessionStats(data, session.id);
    row.present += stats.present;
    row.total += stats.total;
    byMonth.set(month, row);
  });
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
    .map(row => ({ ...row, rate: row.total ? Math.round((row.present / row.total) * 100) : 0 }));
}

function supervisionSignal(sessions, data) {
  if (sessions.length < 6) return null;
  const previous = supervisionRate(sessions.slice(-6, -3).map(session => sessionStats(data, session.id)));
  const recent = supervisionRate(sessions.slice(-3).map(session => sessionStats(data, session.id)));
  return { previous, recent, difference: recent.rate - previous.rate };
}

function renderSupervision() {
  const d = state.data;
  const allowedProgrammes = d.programmes.filter(programme => accountCanReadProgramme(programme.id));
  const globalAllowed = !isPresidentReadOnly() || !!state.account.scopeGlobal || !!state.account.scopeProgrammeIds.length;
  const defaultProgramme = globalAllowed ? 'global' : (allowedProgrammes[0] ? allowedProgrammes[0].id : 'global');
  if (state.supervisionProgFilter !== 'global' && !accountCanReadProgramme(state.supervisionProgFilter)) {
    state.supervisionProgFilter = defaultProgramme;
  }
  if (!globalAllowed && state.supervisionProgFilter === 'global') state.supervisionProgFilter = defaultProgramme;
  const programmeId = state.supervisionProgFilter;
  const year = state.supervisionYearFilter || 'toutes';
  const sessions = supervisionSessions(d, programmeId, year);
  const overall = supervisionRate(sessions.map(session => sessionStats(d, session.id)));
  const breakdowns = supervisionBreakdowns(d, sessions);
  const trend = supervisionTrend(sessions, d);
  const signal = supervisionSignal(sessions, d);
  const latestTrend = trend.slice(-12);
  const years = getAvailableYears({ ...d, sessions });
  const globalLabel = isPresidentReadOnly() && !state.account.scopeGlobal ? 'Tous les programmes autorisés' : 'Tous les programmes';
  const programmeOptions = (globalAllowed
    ? [`<option value="global" ${programmeId === 'global' ? 'selected' : ''}>${globalLabel}</option>`]
    : []).concat(allowedProgrammes.map(programme =>
      `<option value="${programme.id}" ${programmeId === programme.id ? 'selected' : ''}>${escapeHtml(programme.nom)}</option>`
    )).join('');
  const yearOptions = [`<option value="toutes" ${year === 'toutes' ? 'selected' : ''}>Toutes les années</option>`]
    .concat(years.map(item => `<option value="${item}" ${year === item ? 'selected' : ''}>${item}</option>`)).join('');
  const categoryRows = breakdowns.categories.map(category => {
    const rate = category.total ? Math.round((category.present / category.total) * 100) : 0;
    return `<div class="ledger-row">
      <div class="prog-name">${escapeHtml(category.name)}</div>
      <div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:${rate}%"></div></div>
      <div class="prog-pct">${rate}%</div>
      <div class="supervision-meta">${category.present}/${category.total}</div>
    </div>`;
  }).join('');
  const placeRows = breakdowns.places.map(place => {
    const rate = place.total ? Math.round((place.present / place.total) * 100) : 0;
    const frequency = sessions.length ? Math.round((place.sessions / sessions.length) * 100) : 0;
    return `<tr><td>${escapeHtml(place.name)}</td><td>${place.sessions}</td><td>${frequency}%</td><td>${rate}%</td></tr>`;
  }).join('');
  const programmePlaceRows = breakdowns.programmePlaces.map(row => {
    const rate = row.total ? Math.round((row.present / row.total) * 100) : 0;
    return `<tr><td>${escapeHtml(row.programmeName)}</td><td>${escapeHtml(row.place)}</td><td>${row.sessions}</td><td>${rate}%</td></tr>`;
  }).join('');
  const signalText = !signal
    ? 'Au moins six séances sont nécessaires pour comparer les trois dernières aux trois précédentes.'
    : signal.difference > 5
      ? `Hausse du taux de présence de ${signal.difference} points sur les trois dernières séances (${signal.recent.rate}% contre ${signal.previous.rate}%).`
      : signal.difference < -5
        ? `Baisse du taux de présence de ${Math.abs(signal.difference)} points sur les trois dernières séances (${signal.recent.rate}% contre ${signal.previous.rate}%).`
        : `Taux globalement stable sur les trois dernières séances (${signal.recent.rate}% contre ${signal.previous.rate}%).`;

  return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Analyse des données</div>
        <h1 class="page-title">Supervision</h1>
        <p class="page-sub">Tendances, catégories et lieux de présence. Les comparaisons décrivent les données observées et n’impliquent pas de lien de causalité.</p>
      </div>
      <div class="supervision-filters">
        <div class="field"><label>Programme</label><select id="supervisionProgramme">${programmeOptions}</select></div>
        <div class="field"><label>Année</label><select id="supervisionYear">${yearOptions}</select></div>
      </div>
    </div>
    <div class="grid grid-4" style="margin-bottom:18px;">
      ${statCard('Taux de présence', overall.rate + '%', `${overall.present} présences sur ${overall.total} pointages`, 'stat-emerald')}
      ${statCard('Séances analysées', sessions.length, year === 'toutes' ? 'toutes années' : year, 'stat-gold')}
      ${statCard('Lieux observés', breakdowns.places.length, 'lieux distincts', 'stat-emerald')}
      ${statCard('Catégories observées', breakdowns.categories.length, 'catégories de membres', 'stat-gold')}
    </div>
    <div class="grid grid-2">
      <div class="card">
        <h3 class="card-title">Évolution mensuelle</h3>
        <div class="card-sub">Taux de présence calculé à partir des pointages pris en compte</div>
        <div class="ledger">${latestTrend.length ? latestTrend.map(row => `<div class="ledger-row">
          <div class="prog-name">${escapeHtml(monthLabel(row.month))}</div>
          <div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:${row.rate}%"></div></div>
          <div class="prog-pct">${row.rate}%</div>
          <div class="supervision-meta">${row.total} pointages</div>
        </div>`).join('') : emptyRow('Aucune donnée de présence pour cette portée.')}</div>
      </div>
      <div class="card">
        <h3 class="card-title">Signaux d’évolution</h3>
        <div class="card-sub">Comparaison descriptive des trois dernières séances avec les trois précédentes</div>
        <p class="supervision-signal ${signal && signal.difference < -5 ? 'is-down' : signal && signal.difference > 5 ? 'is-up' : ''}">${escapeHtml(signalText)}</p>
      </div>
      <div class="card">
        <h3 class="card-title">Taux de présence par catégorie</h3>
        <div class="card-sub">Présences rapportées aux pointages de chaque catégorie</div>
        <div class="ledger">${categoryRows || emptyRow('Aucune donnée de catégorie pour cette portée.')}</div>
      </div>
      <div class="card">
        <h3 class="card-title">Fréquence et taux par lieu</h3>
        <div class="card-sub">Nombre de séances et part des séances tenues dans chaque lieu</div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Lieu</th><th>Séances</th><th>Fréquence</th><th>Présence</th></tr></thead>
          <tbody>${placeRows || '<tr><td colspan="4">Aucun lieu renseigné.</td></tr>'}</tbody>
        </table></div>
      </div>
      <div class="card" style="grid-column:1/-1;">
        <h3 class="card-title">Comparaison programme / lieu</h3>
        <div class="card-sub">Taux de présence observé par combinaison programme et lieu — comparaison descriptive</div>
        <div class="table-wrap"><table class="data-table">
          <thead><tr><th>Programme</th><th>Lieu</th><th>Séances</th><th>Présence</th></tr></thead>
          <tbody>${programmePlaceRows || '<tr><td colspan="4">Aucune combinaison programme/lieu disponible.</td></tr>'}</tbody>
        </table></div>
      </div>
    </div>`;
}

function attachSupervisionEvents() {
  const programmeSelect = document.getElementById('supervisionProgramme');
  if (programmeSelect) programmeSelect.addEventListener('change', event => {
    const programmeId = event.target.value;
    if (programmeId !== 'global' && !accountCanReadProgramme(programmeId)) {
      showToast('Ce programme ne fait pas partie des accès attribués à votre compte');
      render();
      return;
    }
    state.supervisionProgFilter = programmeId;
    render();
  });
  const yearSelect = document.getElementById('supervisionYear');
  if (yearSelect) yearSelect.addEventListener('change', event => {
    state.supervisionYearFilter = event.target.value;
    render();
  });
}
