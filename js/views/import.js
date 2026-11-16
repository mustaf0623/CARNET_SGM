/* js/views/import.js — Import Excel/CSV des membres (mapping, aperçu, confirmation) */

const MEMBER_UPDATE_ID_HEADER = 'Identifiant Carnet (ne pas modifier)';
const MEMBER_UPDATE_FIRST_NAME_HEADER = 'Prénom du membre (ne pas modifier)';
const MEMBER_UPDATE_LAST_NAME_HEADER = 'Nom du membre (ne pas modifier)';

function normalizeMemberUpdateHeader(value) {
  return String(value || '').toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, ' ');
}

function normalizeMemberUpdateName(value) {
  return normalizeMemberName(value);
}

function memberUpdateReservedHeaders() {
  return new Set([
    MEMBER_UPDATE_ID_HEADER,
    MEMBER_UPDATE_FIRST_NAME_HEADER,
    MEMBER_UPDATE_LAST_NAME_HEADER,
  ].map(normalizeMemberUpdateHeader));
}

function validateMemberUpdateRows(headers, rows, members) {
  const errors = [];
  const normalizedHeaders = headers.map(normalizeMemberUpdateHeader);
  if (normalizedHeaders.some(header => !header)) errors.push('Le fichier contient un en-tête vide.');
  const duplicateHeaders = normalizedHeaders.filter((header, index) =>
    header && normalizedHeaders.indexOf(header) !== index
  );
  if (duplicateHeaders.length) errors.push('Le fichier contient des en-têtes en double.');

  const idIndex = headers.indexOf(MEMBER_UPDATE_ID_HEADER);
  const firstNameIndex = headers.indexOf(MEMBER_UPDATE_FIRST_NAME_HEADER);
  const lastNameIndex = headers.indexOf(MEMBER_UPDATE_LAST_NAME_HEADER);
  if (idIndex < 0 || firstNameIndex < 0 || lastNameIndex < 0) {
    errors.push('Les colonnes d’identifiant, de prénom et de nom sont absentes ou modifiées.');
  }
  const reserved = memberUpdateReservedHeaders();
  const fieldHeaders = headers.filter(header => !reserved.has(normalizeMemberUpdateHeader(header)));
  const unsafeHeaders = new Set(['__proto__', 'prototype', 'constructor']);
  if (fieldHeaders.some(header => unsafeHeaders.has(normalizeMemberUpdateHeader(header)))) {
    errors.push('Le fichier contient un nom de colonne réservé et ne peut pas être importé.');
  }
  if (!fieldHeaders.length) errors.push('Aucune colonne d’information à mettre à jour ou à ajouter.');

  const memberById = new Map(members.map(member => [String(member.id), member]));
  const seenIds = new Set();
  const updates = [];
  rows.forEach((row, rowIndex) => {
    if (row.every(value => String(value ?? '').trim() === '')) return;
    const rowNumber = rowIndex + 2;
    const id = idIndex < 0 ? '' : String(row[idIndex] ?? '').trim();
    if (!id) {
      errors.push(`Ligne ${rowNumber} : identifiant manquant.`);
      return;
    }
    if (seenIds.has(id)) {
      errors.push(`Ligne ${rowNumber} : identifiant en double (${id}).`);
      return;
    }
    seenIds.add(id);
    const member = memberById.get(id);
    if (!member) {
      errors.push(`Ligne ${rowNumber} : identifiant inconnu (${id}).`);
      return;
    }
    const firstName = String(row[firstNameIndex] ?? '').trim();
    const lastName = String(row[lastNameIndex] ?? '').trim();
    if (normalizeMemberUpdateName(firstName) !== normalizeMemberUpdateName(member.prenom)
      || normalizeMemberUpdateName(lastName) !== normalizeMemberUpdateName(member.nom)) {
      errors.push(`Ligne ${rowNumber} : le nom ne correspond pas à l’identifiant (${id}).`);
      return;
    }
    updates.push({ member, row });
  });

  if (!updates.length && !errors.length) errors.push('Aucune ligne de membre à mettre à jour.');
  return { errors, fieldHeaders, updates };
}

function mergeMemberUpdateExtra(member, row, headers, fieldHeaders) {
  const extra = { ...(member.extra || {}) };
  fieldHeaders.forEach(header => {
    const columnIndex = headers.indexOf(header);
    const rawValue = row[columnIndex];
    const value = rawValue == null ? '' : String(rawValue).trim();
    if (value !== '' || !Object.prototype.hasOwnProperty.call(extra, header)) {
      extra[header] = value;
    }
  });
  return extra;
}

function exportMemberUpdateWorkbook() {
  const members = state.data.membres;
  if (!members.length) {
    showToast('Aucun membre à exporter');
    return;
  }
  const reserved = memberUpdateReservedHeaders();
  const extraKeys = extraFieldKeys(state.data);
  const unsafeHeaders = new Set(['__proto__', 'prototype', 'constructor']);
  const normalizedKeys = extraKeys.map(normalizeMemberUpdateHeader);
  const collisions = extraKeys.filter((key, index) =>
    !key.trim()
    || key !== key.trim()
    || reserved.has(normalizedKeys[index])
    || unsafeHeaders.has(normalizedKeys[index])
    || normalizedKeys.indexOf(normalizedKeys[index]) !== index
  );
  if (collisions.length) {
    showToast('Renommez les champs complémentaires vides, en double ou réservés au fichier de mise à jour');
    return;
  }

  const sortedMembers = members.slice().sort((a, b) =>
    new Intl.Collator('fr', { sensitivity: 'base', numeric: true })
      .compare(`${a.nom || ''} ${a.prenom || ''}`, `${b.nom || ''} ${b.prenom || ''}`)
  );
  const rows = sortedMembers.map(member => {
    const row = {
      [MEMBER_UPDATE_ID_HEADER]: String(member.id),
      [MEMBER_UPDATE_FIRST_NAME_HEADER]: member.prenom || '',
      [MEMBER_UPDATE_LAST_NAME_HEADER]: member.nom || '',
    };
    extraKeys.forEach(key => {
      row[key] = member.extra && member.extra[key] != null ? String(member.extra[key]) : '';
    });
    return row;
  });
  try {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = Object.keys(rows[0]).map((header, index) => ({
      wch: index === 0 ? 1 : Math.min(Math.max(header.length + 3, 14), 42),
      hidden: index === 0,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Mise à jour');
    XLSX.writeFile(workbook, `carnet-sgm-mise-a-jour-membres-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Fichier de mise à jour généré');
  } catch (error) {
    console.error('Carnet SGM — impossible de générer le fichier de mise à jour:', error);
    showToast('Impossible de générer le fichier Excel de mise à jour');
  }
}

function readMemberUpdateFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const workbook = XLSX.read(event.target.result, { type: 'array' });
        const sheetName = workbook.SheetNames.includes('Mise à jour')
          ? 'Mise à jour'
          : workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error('Aucune feuille trouvée dans le fichier.');
        const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
        if (!matrix.length) throw new Error('La feuille est vide.');
        const headers = matrix[0].map(value => String(value ?? '').trim());
        const rows = matrix.slice(1).map(row => headers.map((header, index) => {
          const value = row[index];
          return isBirthDateHeader(header) ? formatImportedBirthDate(value) : value;
        }));
        resolve({ headers, rows });
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = () => reject(reader.error || new Error('Lecture du fichier impossible.'));
    reader.readAsArrayBuffer(file);
  });
}

async function handleMemberUpdateFile(file) {
  if (!file) return;
  if (isPresidentReadOnly()) {
    showToast('Votre compte est en lecture seule');
    return;
  }
  try {
    const { headers, rows } = await readMemberUpdateFile(file);
    const validation = validateMemberUpdateRows(headers, rows, state.data.membres);
    if (validation.errors.length) {
      showToast(validation.errors.slice(0, 2).join(' '));
      if (validation.errors.length > 2) {
        console.error('Carnet SGM — erreurs de validation du fichier de mise à jour:', validation.errors);
      }
      return;
    }

    const fieldList = validation.fieldHeaders.join(', ');
    openConfirm(
      'Confirmer la mise à jour des membres ?',
      `${validation.updates.length} membre(s) reconnu(s). Informations concernées : ${fieldList}. Les cellules vides conserveront les valeurs déjà enregistrées. Aucun nouveau membre ne sera créé.`,
      async () => {
        if (isPresidentReadOnly()) {
          showToast('Votre compte est en lecture seule');
          return;
        }
        validation.updates.forEach(({ member, row }) => {
          member.extra = mergeMemberUpdateExtra(member, row, headers, validation.fieldHeaders);
        });
        if (!await saveData()) return;
        showToast(`${validation.updates.length} membre(s) mis à jour`);
        render();
      },
      'Appliquer les mises à jour'
    );
  } catch (error) {
    console.error('Carnet SGM — impossible de lire le fichier de mise à jour:', error);
    showToast('Impossible de lire ce fichier Excel');
  }
}

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
      <p style="margin:12px 0 4px;font-weight:700;">Cliquez pour importer le fichier .xlsx ou .csv des membres de la section</p>
      <p style="margin:0;color:var(--ink-faint);font-size:12.5px;">Vos données restent synchronisées sur tout vos appareils</p>
      <input type="file" id="fileInput" accept=".xlsx,.xls,.csv" style="display:none;">
    </div>`;
  }
  if (state.importStep === 1) {
    const expected = [
      { key: 'prenom', label: 'Prénom' }, { key: 'nom', label: 'Nom' },
      { key: 'sexe', label: 'Sexe' }, { key: 'categorie', label: 'Catégorie' },
    ];
    return `<div>
      <p style="font-size:13px;color:var(--ink-dim);margin-bottom:14px;">${state.importRows.length} lignes détectées. Vérifiez la correspondance des colonnes avant l’import. Prénom, nom, sexe et catégorie sont obligatoires et doivent être associés à des colonnes distinctes.</p>
      <div class="mapping-row"><strong style="font-size:11.5px;text-transform:uppercase;color:var(--ink-faint);">Champ attendu</strong><strong style="font-size:11.5px;text-transform:uppercase;color:var(--ink-faint);">Colonne du fichier</strong></div>
      ${expected.map(f => `<div class="mapping-row">
        <div>${f.label}</div>
        <select data-field="${f.key}" class="mapSelect">
          <option value="">— Ignorer —</option>
          ${state.importHeaders.map(h => `<option value="${escapeHtml(h)}" ${state.importMapping[f.key] === h ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}
        </select>
      </div>`).join('')}
      ${renderImportPreviewTable()}
      <p style="font-size:11.5px;color:var(--ink-faint);margin-top:6px;">Sexe attendu : Homme ou Femme (la casse est ignorée). Catégorie attendue : Homme / Femme / Cadet / Cadette / Père / Mère. La casse et les accents ne sont pas pris en compte.</p>
      <p style="font-size:11.5px;color:var(--ink-faint);margin-top:6px;">La catégorie sert à définir, par programme, quelles catégories ont ce programme comme prioritaire pour le calcul des absences.</p>
      <p style="font-size:12px;color:var(--ink-faint);line-height:1.6;margin-top:14px;">Les autres colonnes du fichier sont conservées pour chaque membre, même si certaines cellules sont vides. Vous pourrez compléter ces informations plus tard depuis la fiche du membre. Une fois importés, ces membres seront pointables dans tous les programmes déjà créés — et automatiquement dans ceux que vous créerez plus tard.</p>
      <div style="display:flex;gap:10px;margin-top:14px;">
        <button class="btn btn-primary" id="confirmImportBtn">Importer</button>
        <button class="btn btn-ghost" id="cancelImportBtn">Annuler</button>
      </div>
    </div>`;
  }
  if (state.importStep === 2) return renderImportDuplicateReview();
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
function isBirthDateHeader(header) {
  const normalized = String(header || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return /naissance|birth|birthday|\bdob\b|ne(?:e)?(?:\s*\(e\))?\s*le/.test(normalized);
}
function formatImportedBirthDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return [String(value.getDate()).padStart(2, '0'), String(value.getMonth() + 1).padStart(2, '0'), value.getFullYear()].join('/');
  }
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > 2958465) return value;
  const date = XLSX.SSF.parse_date_code(value);
  if (!date) return value;
  return [String(date.d).padStart(2, '0'), String(date.m).padStart(2, '0'), date.y].join('/');
}
function importedMemberNames(row, map) {
  return {
    prenom: String((map.prenom ? row[map.prenom] : '') || '').trim(),
    nom: String((map.nom ? row[map.nom] : '') || '').trim(),
  };
}
function importedMemberSex(raw) {
  const value = normalizeMemberName(raw);
  if (value === 'femme') return 'F';
  if (value === 'homme') return 'H';
  return '';
}
function importedMemberCategory(raw) {
  const value = normalizeMemberName(raw);
  const category = ['Homme', 'Femme', 'Cadet', 'Cadette', 'Père', 'Mère']
    .find(option => normalizeMemberName(option) === value);
  return category || '';
}
function validateMemberImportRequirements(rows, map) {
  const errors = [];
  if (!map.prenom) errors.push('Associez la colonne Prénom.');
  if (!map.nom) errors.push('Associez la colonne Nom.');
  if (!map.sexe) errors.push('Associez la colonne Sexe.');
  if (!map.categorie) errors.push('Associez la colonne Catégorie.');
  const mappedRequiredFields = ['prenom', 'nom', 'sexe', 'categorie']
    .map(field => map[field]).filter(Boolean);
  if (new Set(mappedRequiredFields).size !== mappedRequiredFields.length) {
    errors.push('Associez chaque champ obligatoire à une colonne différente.');
  }
  rows.forEach((row, rowIndex) => {
    const { prenom, nom } = importedMemberNames(row, map);
    if (!prenom && !nom) return;
    const rowNumber = rowIndex + 2;
    if (!prenom || !nom) errors.push(`Ligne ${rowNumber} : prénom et nom sont obligatoires.`);
    if (map.sexe && !importedMemberSex(row[map.sexe])) {
      errors.push(`Ligne ${rowNumber} : sexe absent ou non reconnu.`);
    }
    if (map.categorie && !importedMemberCategory(row[map.categorie])) {
      errors.push(`Ligne ${rowNumber} : catégorie absente ou non reconnue.`);
    }
  });
  return errors;
}
function importedMemberFromRow(row, map, mappedHeaders) {
  const { prenom, nom } = importedMemberNames(row, map);
  if (!prenom && !nom) return null;
  const extra = {};
  Object.keys(row).forEach(header => {
    if (mappedHeaders.has(header)) return;
    const value = row[header];
    extra[header] = value === undefined || value === null ? '' : String(value).trim();
  });
  return {
    prenom,
    nom,
    sexe: importedMemberSex(map.sexe ? row[map.sexe] : ''),
    categorie: importedMemberCategory(map.categorie ? row[map.categorie] : ''),
    extra,
  };
}
function findImportDuplicateRows(rows, map, members) {
  const mappedHeaders = new Set(Object.values(map).filter(Boolean));
  const candidates = members.map(member => ({ type: 'existing', member }));
  const duplicates = [];
  rows.forEach((row, rowIndex) => {
    const member = importedMemberFromRow(row, map, mappedHeaders);
    if (!member) return;
    const matches = candidates.map(candidate => {
      const match = compareMemberForDuplicate(candidate.member, member);
      return match ? { ...candidate, ...match } : null;
    }).filter(Boolean);
    if (matches.length) {
      duplicates.push({
        rowIndex,
        prenom: member.prenom,
        nom: member.nom,
        matches,
        hardDuplicate: matches.some(match => match.type === 'existing' && match.strongDuplicate),
        conditionalDuplicate: matches.some(match => match.type === 'file' && match.strongDuplicate),
      });
    }
    candidates.push({ type: 'file', rowIndex, member });
  });
  return duplicates;
}
function renderImportDuplicateReview() {
  const duplicates = findImportDuplicateRows(state.importRows, state.importMapping, state.data.membres);
  const requiresReview = duplicates.some(duplicate => !duplicate.hardDuplicate);
  const matchLabel = match => {
    const member = match.member;
    const source = match.type === 'existing' ? 'Base existante' : `Ligne ${match.rowIndex + 2} du fichier`;
    const details = `${member.sexe === 'H' ? 'Homme' : 'Femme'}, ${member.categorie || 'catégorie non définie'}, ${member.ap ? 'ponctuel (AP)' : 'permanent'}`;
    const matchingFields = match.matchedExtraFields.length
      ? `<div style="font-size:11.5px;color:var(--terracotta-dim);margin-top:3px;">Informations identiques : ${match.matchedExtraFields.map(field => `${escapeHtml(field.key)} (${escapeHtml(field.value)})`).join(', ')}</div>`
      : '';
    return `<li>${escapeHtml(source)} — ${escapeHtml(member.prenom)} ${escapeHtml(member.nom)} (${escapeHtml(details)})${matchingFields}</li>`;
  };
  return `<div>
    <p style="font-size:13px;color:var(--ink-dim);margin-bottom:14px;">Un doublon est bloqué si le nom ressemble, que le sexe et la catégorie correspondent et qu’au moins une information complémentaire non vide correspond dans le même champ. Les autres ressemblances nécessitent votre décision.</p>
    <div style="display:grid;gap:12px;max-height:50vh;overflow:auto;">
      ${duplicates.map(duplicate => `<div class="card import-duplicate-review-row" data-row-index="${duplicate.rowIndex}" data-hard-duplicate="${duplicate.hardDuplicate}" style="padding:12px;">
        <strong>Ligne ${duplicate.rowIndex + 2} : ${escapeHtml(duplicate.prenom)} ${escapeHtml(duplicate.nom)}</strong>
        <div style="font-size:12px;color:var(--ink-faint);margin:7px 0 10px;">Correspondances possibles :
          <ul style="margin:5px 0 0;padding-left:20px;">${duplicate.matches.map(matchLabel).join('')}</ul>
        </div>
        ${duplicate.hardDuplicate
          ? '<p style="font-size:12px;color:var(--terracotta-dim);font-weight:700;">Ajout bloqué : nom, sexe, catégorie et information complémentaire correspondent à la fiche existante.</p>'
          : `${duplicate.conditionalDuplicate
            ? '<p style="font-size:12px;color:var(--terracotta-dim);">Si la ligne correspondante est importée, cette ligne sera bloquée car les critères de nom, sexe, catégorie et information complémentaire correspondent.</p>'
            : ''}
            <label style="display:block;font-size:12.5px;margin:6px 0;"><input type="radio" class="importDuplicateDecision" name="importDuplicate${duplicate.rowIndex}" data-row-index="${duplicate.rowIndex}" value="duplicate"> Même personne — ignorer cette ligne</label>
            <label style="display:block;font-size:12.5px;"><input type="radio" class="importDuplicateDecision" name="importDuplicate${duplicate.rowIndex}" data-row-index="${duplicate.rowIndex}" value="homonym"> Homonyme — importer cette ligne</label>`}
      </div>`).join('')}
    </div>
    <div style="display:flex;gap:10px;margin-top:14px;">
      <button class="btn btn-primary" id="confirmImportDuplicatesBtn" ${requiresReview ? 'disabled' : ''}>Confirmer l’import</button>
      <button class="btn btn-ghost" id="backToImportMappingBtn">Retour</button>
    </div>
  </div>`;
}
function handleFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const wb = XLSX.read(ev.target.result, { type: 'array' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }).map(row => {
        Object.keys(row).forEach(header => {
          if (isBirthDateHeader(header)) row[header] = formatImportedBirthDate(row[header]);
        });
        return row;
      });
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
  const requirementErrors = validateMemberImportRequirements(state.importRows, map);
  if (requirementErrors.length) {
    showToast(`Import impossible : ${requirementErrors[0]}`);
    return;
  }
  const duplicates = findImportDuplicateRows(state.importRows, map, d.membres);
  if (state.importStep === 1 && duplicates.length) {
    state.importStep = 2;
    render();
    return;
  }
  const skippedRows = new Set();
  if (state.importStep === 2) {
    duplicates.filter(duplicate => duplicate.hardDuplicate)
      .forEach(duplicate => skippedRows.add(duplicate.rowIndex));
    const decisions = new Map(Array.from(document.querySelectorAll('.importDuplicateDecision:checked'))
      .map(input => [Number(input.dataset.rowIndex), input.value]));
    const reviewableDuplicates = duplicates.filter(duplicate => !duplicate.hardDuplicate);
    if (decisions.size !== reviewableDuplicates.length) {
      showToast('Examinez chaque correspondance avant de confirmer l’import');
      return;
    }
    decisions.forEach((decision, rowIndex) => {
      if (decision === 'duplicate') skippedRows.add(rowIndex);
    });
  }
  const mappedHeaders = new Set(Object.values(map).filter(Boolean));
  let created = 0;
  const blockedRows = new Set();

  state.importRows.forEach((row, rowIndex) => {
    if (skippedRows.has(rowIndex)) return;
    const member = importedMemberFromRow(row, map, mappedHeaders);
    if (!member) return;
    const confirmedDuplicate = findSimilarMembers(d.membres, member)
      .find(match => match.strongDuplicate);
    if (confirmedDuplicate) {
      blockedRows.add(rowIndex);
      return;
    }
    d.membres.push({ id: uid(), nom: member.nom, prenom: member.prenom, sexe: member.sexe, categorie: member.categorie, programmeIds: [], allProgrammes: true, extra: member.extra });
    created++;
  });

  await saveData();
  state.importStep = 0; state.importRows = []; state.importHeaders = []; state.importMapping = {};
  const skippedCount = skippedRows.size + blockedRows.size;
  showToast(skippedCount
    ? `${created} membre(s) importé(s), ${skippedCount} doublon(s) ignoré(s)`
    : created + ' membre(s) importé(s) — pointables dans tous les programmes');
  render();
}
