/* js/views/import.js — Import Excel/CSV des membres (mapping, aperçu, confirmation) */

function renderImportPreviewTable() {
  const previewRows = state.importRows.slice(0, 8);
  if (!previewRows.length) return '';
  return `<div id="importPreviewTable" style="margin-top:18px;">
    <div style="font-size:11.5px;text-transform:uppercase;color:var(--ink-faint);margin-bottom:8px;">Aperçu des premières lignes</div>
    <div style="overflow:auto;border:1px solid var(--line);border-radius:12px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <thead>
          <tr style="background:var(--card-2);">
            <th style="text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);">#</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);">Prénom</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);">Nom</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);">Sexe</th>
            <th style="text-align:left;padding:8px 10px;border-bottom:1px solid var(--line);">Catégorie</th>
          </tr>
        </thead>
        <tbody>
          ${previewRows.map((row, idx) => {
            const prenom = state.importMapping.prenom ? String(row[state.importMapping.prenom] ?? '').trim() : '';
            const nom = state.importMapping.nom ? String(row[state.importMapping.nom] ?? '').trim() : '';
            const sexe = state.importMapping.sexe ? String(row[state.importMapping.sexe] ?? '').trim() : '';
            const categorie = state.importMapping.categorie ? String(row[state.importMapping.categorie] ?? '').trim() : '';
            return `<tr>
              <td style="padding:8px 10px;border-bottom:1px solid var(--line);">${idx + 2}</td>
              <td style="padding:8px 10px;border-bottom:1px solid var(--line);">${escapeHtml(prenom || '—')}</td>
              <td style="padding:8px 10px;border-bottom:1px solid var(--line);">${escapeHtml(nom || '—')}</td>
              <td style="padding:8px 10px;border-bottom:1px solid var(--line);">${escapeHtml(sexe || '—')}</td>
              <td style="padding:8px 10px;border-bottom:1px solid var(--line);">${escapeHtml(categorie || '—')}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderImportZone() {
  if (state.importStep === 0) {
    return `<div class="drop-zone" id="dropZone">
      ${ICONS.upload}
      <p style="margin:12px 0 4px;font-weight:700;">Cliquez pour ajouter le fichier .xlsx ou .csv des membres</p>
      <p style="margin:0;color:var(--ink-faint);font-size:12.5px;">Vos données sont synchronisées sur tout vos appareils</p>
      <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display:none;">
    </div>`;
  }
  if (state.importStep === 1) {
    const expected = [
      { key: 'prenom', label: 'Prénom' }, { key: 'nom', label: 'Nom' },
      { key: 'sexe', label: 'Sexe' }, { key: 'categorie', label: 'Catégorie' },
    ];
    return `<div>
      <p style="font-size:13px;color:var(--ink-dim);margin-bottom:14px;">${state.importRows.length} lignes détectées. Vérifiez la correspondance des colonnes avant l’import.</p>
      <div class="mapping-row"><strong style="font-size:11.5px;text-transform:uppercase;color:var(--ink-faint);">Champ attendu</strong><strong style="font-size:11.5px;text-transform:uppercase;color:var(--ink-faint);">Colonne du fichier</strong></div>
      ${expected.map(f => `<div class="mapping-row">
        <div>${f.label}</div>
        <select data-field="${f.key}" class="mapSelect">
          <option value="">— Ignorer —</option>
          ${state.importHeaders.map(h => `<option value="${escapeHtml(h)}" ${state.importMapping[f.key] === h ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}
        </select>
      </div>`).join('')}
      ${renderImportPreviewTable()}
      <p style="font-size:11.5px;color:var(--ink-faint);margin-top:6px;">Catégorie attendue : Homme / Femme / Cadet / Cadette / Père / Mère. Sert à définir, par programme, quelles catégories ont ce programme comme prioritaire pour le calcul des absences.</p>
      <p style="font-size:12px;color:var(--ink-faint);line-height:1.6;margin-top:14px;">Une fois importés, ces membres seront pointables dans tous les programmes déjà créés et automatiquement dans ceux que vous créerez plus tard.</p>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn btn-primary" id="confirmImportBtn">Importer</button>
        <button class="btn btn-ghost" id="cancelImportBtn">Annuler</button>
      </div>
    </div>`;
  }
  return '';
}

function guessMapping(headers) {
  const norm = h => h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const map = {};
  const dict = {
    prenom: ['prenom', 'firstname', 'first name'],
    nom: ['nom', 'lastname', 'last name', 'nom de famille'],
    sexe: ['sexe', 'genre', 'gender'],
    categorie: ['categorie', 'category', 'classe'],
  };
  Object.entries(dict).forEach(([key, aliases]) => {
    const found = headers.find(h => aliases.includes(norm(h)));
    if (found) map[key] = found;
  });
  return map;
}
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      if (!rows.length) { showToast('Fichier vide ou illisible'); return; }
      state.importRows = rows;
      state.importHeaders = Object.keys(rows[0]);
      state.importMapping = guessMapping(state.importHeaders);
      state.importStep = 1;
      render();
    } catch (err) { showToast('Impossible de lire ce fichier'); }
  };
  reader.readAsArrayBuffer(file);
}

async function confirmImport() {
  const d = state.data;
  const map = state.importMapping;
  const mappedHeaders = new Set(Object.values(map).filter(Boolean));
  let created = 0;

  state.importRows.forEach(row => {
    const prenom = (map.prenom ? row[map.prenom] : '') || '';
    const nom = (map.nom ? row[map.nom] : '') || '';
    if (!nom && !prenom) return;
    let sexeRaw = (map.sexe ? String(row[map.sexe]) : '').trim().toLowerCase();
    const sexe = ['f', 'femme', 'female', 'w'].includes(sexeRaw) ? 'F' : 'H';
    const categorie = normaliseCategorie(map.categorie ? row[map.categorie] : '');
    const extra = {};
    Object.keys(row).forEach(h => {
      if (mappedHeaders.has(h)) return;
      const v = row[h];
      if (v === undefined || v === null || String(v).trim() === '') return;
      extra[h] = String(v).trim();
    });
    d.membres.push({ id: uid(), nom: String(nom).trim(), prenom: String(prenom).trim(), sexe, categorie, programmeIds: [], allProgrammes: true, extra });
    created++;
  });

  await saveData();
  state.importStep = 0; state.importRows = []; state.importHeaders = []; state.importMapping = {};
  showToast(created + ' membre(s) importé(s) pointables dans tous les programmes');
  render();
}
