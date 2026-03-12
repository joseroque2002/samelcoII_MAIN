document.addEventListener('DOMContentLoaded', function () {
  // Check if user is logged in
  var userName = localStorage.getItem('userName');
  if (!userName) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('user-name').textContent = userName;
  var cfg = window.SAMELCO_SUPABASE || {};

  // Get problem locations from localStorage (set by dashboard or previous visits)
  var problemLocations = [];
  try {
    var stored = localStorage.getItem('problemLocations');
    if (stored) {
      problemLocations = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error parsing problem locations:', e);
  }

  var pendingAssignments = {};
  function loadPendingAssignments() {
    try {
      var storedPA = localStorage.getItem('pendingAssignments');
      if (storedPA) {
        pendingAssignments = JSON.parse(storedPA) || {};
      } else {
        pendingAssignments = {};
      }
    } catch (e) {
      pendingAssignments = {};
    }
  }
  loadPendingAssignments();

  var hiddenPins = {};
  try { hiddenPins = JSON.parse(localStorage.getItem('hiddenPins') || '{}') || {}; } catch(e){ hiddenPins = {}; }
  var restoredBarangays = {};
  try { restoredBarangays = JSON.parse(localStorage.getItem('restoredBarangays') || '{}') || {}; } catch(e){ restoredBarangays = {}; }
  function normalizeBarangayName(s) {
    if (!s) return '';
    var x = String(s).toLowerCase();
    x = x.replace(/brgy\.?\s*/g, 'barangay ');
    x = x.replace(/barangay\s+/g, '');
    x = x.replace(/\./g, '');
    x = x.replace(/^no\s*(\d+)$/i, 'poblacion $1');
    x = x.replace(/\s+/g, ' ').trim();
    return x;
  }
  function getPinKey(mName, bName) {
    return (String(mName||'').toLowerCase() + '|' + normalizeBarangayName(bName||''));
  }
  function isPinHidden(mName, bName) {
    return !!hiddenPins[getPinKey(mName, bName)];
  }
  function isBarangayRestored(mName, bName) {
    var bucket = restoredBarangays[mName] || {};
    return !!bucket[normalizeBarangayName(bName)];
  }
  var muniDataset = Array.isArray(window.SAMELCO_MUNICIPALITIES) ? window.SAMELCO_MUNICIPALITIES : [];
  var excludedSet = (function(){
    var arr = ['calbayog city','tarangnan','almagro','santo niño','santo niÃ±o','tagapul-an','santa margarita','gandara','pagsanghan','matuguinao','san jorge'];
    var o = {}; arr.forEach(function(s){ o[s] = true; }); return o;
  })();
  function isExcludedMunicipality(n) {
    if (!n) return false;
    return !!excludedSet[String(n).toLowerCase()];
  }
  function normalizeMunicipalityKey(name) {
    if (!name) return '';
    var x = String(name).toLowerCase();
    x = x.replace(/\(wright\)/g, '');
    x = x.replace(/\bcity\b/g, '');
    x = x.replace(/\s+/g, ' ').trim();
    return x;
  }
  function resolveMunicipalityName(name) {
    if (!name) return '';
    var key = normalizeMunicipalityKey(name);
    if (!key) return '';
    var hit = muniDataset.find(function(m){
      return normalizeMunicipalityKey(m.name) === key;
    });
    return hit ? hit.name : String(name);
  }
  function findMunicipalityNameFromText(txt) {
    if (!txt) return '';
    var s = String(txt);
    var parts = s.split(',').map(function(p){ return p.trim(); }).filter(Boolean);
    for (var i = parts.length - 1; i >= 0; i--) {
      var tokenKey = normalizeMunicipalityKey(parts[i]);
      if (!tokenKey) continue;
      var exact = muniDataset.find(function(m){
        return normalizeMunicipalityKey(m.name) === tokenKey;
      });
      if (exact) return exact.name;
      var near = muniDataset.find(function(m){
        var mKey = normalizeMunicipalityKey(m.name);
        return tokenKey.indexOf(mKey) !== -1 || mKey.indexOf(tokenKey) !== -1;
      });
      if (near) return near.name;
    }
    var lower = s.toLowerCase();
    var ranked = muniDataset.slice().sort(function(a, b){
      return String(b.name || '').length - String(a.name || '').length;
    });
    var hit = ranked.find(function(m){
      var n = String(m.name||'').toLowerCase();
      var core = normalizeMunicipalityKey(m.name);
      return lower.indexOf(n) !== -1 || (core && lower.indexOf(core) !== -1);
    });
    return hit ? hit.name : '';
  }
  function parseBarangayFromLocationText(txt) {
    if (!txt) return '';
    var s = String(txt);
    var direct = s.match(/(?:Brgy\.?|Barangay)\s*[^,]+/i);
    if (direct && direct[0]) return direct[0].trim();
    var pob = s.match(/\bPoblacion\s*\d+\b/i);
    if (pob && pob[0]) return pob[0].trim();
    var parts = s.split(',').map(function(p){ return p.trim(); });
    var hit = parts.find(function(p){ return /^(?:Brgy\.?|Barangay)\b/i.test(p); });
    if (hit) return hit;
    hit = parts.find(function(p){ return /\bPoblacion\b/i.test(p); });
    return hit || '';
  }

  async function setReportStatusById(reportId, nextStatus) {
    if (!cfg.url || !cfg.anonKey || !cfg.reportsTable) {
      throw new Error('Missing Supabase config');
    }
    var isResolved = String(nextStatus).toLowerCase() === 'resolved';
    var normalized = isResolved ? 'resolved' : 'pending';
    var patchBody = isResolved
      ? { status: 'resolved', resolved_at: new Date().toISOString() }
      : { status: 'pending', resolved_at: null };
    var rpcMissing = false;
    try {
      var rpcRes = await fetch(cfg.url + '/rest/v1/rpc/set_report_status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.anonKey,
          Authorization: 'Bearer ' + cfg.anonKey
        },
        body: JSON.stringify({
          p_report_id: Number(reportId),
          p_status: normalized,
          p_team_name: null
        })
      });
      if (rpcRes.ok) return;
      var rpcText = '';
      try { rpcText = (await rpcRes.text()) || ''; } catch (_) {}
      if (rpcRes.status !== 404) {
        throw new Error('Failed to update status (RPC HTTP ' + rpcRes.status + ')' + (rpcText ? ': ' + rpcText : ''));
      }
      rpcMissing = true;
    } catch (err) {
      if (!rpcMissing) throw err;
    }
    var res = await fetch(cfg.url + '/rest/v1/' + cfg.reportsTable + '?id=eq.' + encodeURIComponent(reportId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + cfg.anonKey,
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patchBody)
    });
    if (!res.ok) {
      if (rpcMissing && (res.status === 401 || res.status === 403)) {
        throw new Error('Missing set_report_status RPC in Supabase. Run sql/migrations/20260311_set_report_status_function.sql.');
      }
      throw new Error('Failed to update status: HTTP ' + res.status);
    }
  }

  function toQueueNumber(value) {
    var n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  function isDbPendingRow(r) {
    return String((r && r.status) || 'pending').toLowerCase() === 'pending';
  }

  // Listen for storage changes from other tabs/pages (like dashboard)
  window.addEventListener('storage', function (e) {
    if (e.key === 'pendingAssignments') {
      loadPendingAssignments();
      updateAssignedInTable();
    }
  });

  // Update records table with restored-service status
  function updateRecordsWithProblems() {
    const tableRows = document.querySelectorAll('.records-table-row');
    tableRows.forEach(function (row) {
      const restoredCell = row.querySelector('.col-restored');
      const isNewFlag = row.getAttribute('data-is-new') === 'true';
      const dbStatus = (row.getAttribute('data-status-db') || 'pending').toLowerCase();
      const assignedTeam = (row.getAttribute('data-assigned-team') || '').trim();

      if (restoredCell) {
        if (dbStatus === 'resolved') {
          restoredCell.textContent = 'Resolved';
          restoredCell.className = 'col-restored status-restored';
          row.setAttribute('data-restored', 'true');
          return;
        }

        // New rule: unresolved + unassigned => New Compliance (red).
        // Once assigned, it becomes Pending.
        var isNew = !assignedTeam && isNewFlag;
        restoredCell.textContent = isNew ? 'New Compliance' : 'Pending';
        restoredCell.className = isNew ? 'col-restored status-new' : 'col-restored status-pending';
        row.setAttribute('data-restored', 'false');
      }
    });
    if (typeof updateCounts === 'function') updateCounts();
  }
  function updateAssignedInTable() {
    const tableRows = document.querySelectorAll('.records-table-row');
    tableRows.forEach(function(row){
      var cell = row.querySelector('.col-assigned');
      var team = (row.getAttribute('data-assigned-team') || '').trim();
      if (cell) cell.textContent = team || '';
    });
  }

  // Load consumer records from Supabase and populate table
  async function fetchAllReports() {
    var pageSize = 1000;
    var offset = 0;
    var out = [];
    var selectCols = [
      'id',
      'full_name',
      'contact',
      'location_text',
      'issue_type',
      'description',
      'latitude',
      'longitude',
      'source',
      'created_at',
      'municipality',
      'barangay',
      'status',
      'resolved_at',
      'is_urgent',
      'queue_number',
      'assigned_team'
    ].join(',');
    while (true) {
      var queueUrl = cfg.url + '/rest/v1/' + cfg.reportsTable + '?select=' + encodeURIComponent(selectCols) + '&order=queue_number.asc.nullslast&order=created_at.asc&limit=' + pageSize + '&offset=' + offset;
      var fallbackUrl = cfg.url + '/rest/v1/' + cfg.reportsTable + '?select=' + encodeURIComponent(selectCols) + '&order=created_at.asc&limit=' + pageSize + '&offset=' + offset;
      var headers = {
        apikey: cfg.anonKey,
        Authorization: 'Bearer ' + cfg.anonKey,
        Prefer: 'count=exact'
      };
      var res = await fetch(queueUrl, { headers: headers });
      if (!res.ok) res = await fetch(fallbackUrl, { headers: headers });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) break;
      out = out.concat(rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return out;
  }

  async function loadConsumerRecords() {
    if (!cfg.url || !cfg.anonKey || !cfg.reportsTable) return;
    try {
      var loadingEl = document.getElementById('records-loading');
      if (loadingEl) loadingEl.style.display = 'block';
      var rows = await fetchAllReports();
      var totalEl = document.getElementById('total-reports-count');
      if (totalEl) totalEl.textContent = String(Array.isArray(rows) ? rows.length : 0);
      if (Array.isArray(rows)) {
        // Keep raw DB results intact; only enrich with derived municipality/barangay fields.
        rows = rows.map(function(r){
          var m = r.municipality || findMunicipalityNameFromText(r.location_text || r.location || r.address || '');
          var b = r.barangay || parseBarangayFromLocationText(r.location_text || r.location || r.address || '');
          return Object.assign({}, r, { municipality: m, barangay: b });
        });
      }
      // sync problem locations based on the same rows fetched
      if (Array.isArray(rows)) {
        var problems = rows.filter(function(r){
          return String(r.status || 'pending').toLowerCase() !== 'resolved';
        }).map(function(r) {
          // use location_text if available
          var address = r.location_text || '';
          if (!address) {
            var parts = [];
            if (r.municipality) parts.push(r.municipality);
            if (r.barangay) parts.push(r.barangay);
            if (r.location || r.street) parts.push(r.location || r.street);
            address = parts.join(', ');
          }
          return {
            name: address || r.municipality || r.location || '',
            issue: r.issue || r.issue_type || '' ,
            barangay: r.barangay || '',
            rawAddress: address
          };
        });
        localStorage.setItem('problemLocations', JSON.stringify(problems));
        problemLocations = problems; // update current variable so later logic sees it
      }
      populateTable(rows);
    } catch (err) {
      console.warn('Failed to load consumer records:', err);
    }
    finally {
      var loadingEl2 = document.getElementById('records-loading');
      if (loadingEl2) loadingEl2.style.display = 'none';
    }
  }

  function populateTable(rows) {
    const table = document.getElementById('consumer-records-table');
    if (!table) return;
    // remove any existing data rows
    table.querySelectorAll('.records-table-row').forEach(r => r.remove());
    if (!rows || !rows.length) {
      var empty = document.createElement('div');
      empty.className = 'records-table-row';
      empty.innerHTML = '<span colspan="6" style="text-align:center;">No records found</span>';
      table.appendChild(empty);
      return;
    }
    var newCount = 0;
    var pendingCount = 0;
    var muniSet = new Set();
    rows.forEach(function(r, idx) {
      var id = r.id || (idx + 1);
      var date = r.created_at ? r.created_at.split('T')[0] : '';
      var queueNumber = toQueueNumber(r.queue_number);
      var contact = r.contact || r.phone || '';
      var name = r.full_name || r.name || '';
      var address = r.location_text || r.location || '';
      var municipality = resolveMunicipalityName(r.municipality || '');
      
      // if municipality is missing, try to extract it from address
      if (!municipality && address) {
        // comprehensive check for Samar municipalities - Must match dashboard names exactly
        const samarMuns = [
          'Almagro', 'Basey', 'Calbayog City', 'Calbiga', 'Catbalogan City', 'Daram', 'Gandara', 
          'Hinabangan', 'Jiabong', 'Marabut', 'Matuguinao', 'Motiong', 'Pagsanghan', 
          'Paranas (Wright)', 'Pinabacdao', 'San Jorge', 'San Jose de Buan', 
          'San Sebastian', 'Santa Margarita', 'Santa Rita', 'Santo Niño', 
          'Tagapul-an', 'Talalora', 'Tarangnan', 'Villareal', 'Zumarraga'
        ];
        municipality = findMunicipalityNameFromText(address) || municipality;
      }

      if (!address) {
        var parts = [];
        if (r.municipality) parts.push(r.municipality);
        if (r.barangay) parts.push(r.barangay);
        if (r.street) parts.push(r.street);
        address = parts.join(', ');
      }
      var assignedTeam = String(r.assigned_team || '').trim();
      var dbStatus = String(r.status || 'pending').toLowerCase();
      var isNew = !assignedTeam && dbStatus !== 'resolved';
      muniSet.add(municipality || '');
      var statusText = r.issue_type || r.issue || '';
      var row = document.createElement('div');
      row.className = 'records-table-row';
      row.setAttribute('data-status', statusText);
      row.setAttribute('data-date', date);
      row.setAttribute('data-id', String(id));
      row.setAttribute('data-queue', queueNumber ? String(queueNumber) : '');
      row.setAttribute('data-municipality', municipality);
      row.setAttribute('data-is-new', isNew ? 'true' : 'false');
      row.setAttribute('data-status-db', dbStatus);
      row.setAttribute('data-assigned-team', assignedTeam || '');
      row.innerHTML = '<span class="col-queue">' + (queueNumber ? ('#' + queueNumber) : '-') + '</span>' +
                      '<span class="col-date">' + date + '</span>' +
                      '<span class="col-contact">' + contact + '</span>' +
                      '<span class="col-name">' + name + '</span>' +
                      '<span class="col-address">' + address + '</span>' +
                      '<span class="col-status">' + statusText + '</span>' +
                      '<span class="col-assigned">' + (assignedTeam || '') + '</span>' +
                      '<span class="col-restored status-pending">Pending</span>';
      
      // Add click listener for restoration toggle
      const restoredCell = row.querySelector('.col-restored');
      restoredCell.addEventListener('click', async function(e) {
        e.stopPropagation();
        var reportId = row.getAttribute('data-id');
        if (!reportId) return;
        var currentDbStatus = (row.getAttribute('data-status-db') || 'pending').toLowerCase();
        var nextDbStatus = currentDbStatus === 'resolved' ? 'pending' : 'resolved';
        try {
          await setReportStatusById(reportId, nextDbStatus);
          row.setAttribute('data-status-db', nextDbStatus);
          updateRecordsWithProblems();
          applyFilters();
          updateCounts();
        } catch (err) {
          console.error(err);
          var msg = String((err && err.message) || '');
          if (/set_report_status/i.test(msg)) {
            alert('Status update RPC is missing in Supabase. Run sql/migrations/20260311_set_report_status_function.sql.');
          } else {
            alert('Failed to update status. Check Supabase UPDATE policy for reports table.');
          }
        }
      });

      row.addEventListener('click', function() {
        var barangay = r.barangay || parseBarangayFromLocationText(address);
        openRecordModal({
          id: id,
          queueNumber: queueNumber,
          date: date,
          contact: contact,
          name: name,
          address: address,
          issue: statusText,
          municipality: municipality,
          barangay: barangay,
          isNew: isNew
        });
      });

      table.appendChild(row);
      var isRestoredNow = String(r.status || 'pending').toLowerCase() === 'resolved';
      if (!isRestoredNow) {
        if (isNew) newCount += 1; else pendingCount += 1;
      }
    });
    // if filters are already defined, apply them to the newly added rows
    if (typeof applyFilters === 'function') {
      applyFilters();
    }
    // refresh statuses based on problems/restored locations
    updateRecordsWithProblems();
    updateAssignedInTable();
    updateCounts(newCount, pendingCount);
    populateMunicipalityFilter(Array.from(muniSet).filter(Boolean));
  }

  // unified filter function
  function applyFilters() {
    const filterInput = document.getElementById('records-filter');
    const statusFilter = document.getElementById('status-filter');
    const dateFilter = document.getElementById('records-date');
    const monthFilter = document.getElementById('records-month');
    const recordsTable = document.getElementById('consumer-records-table');
    const munFilter = document.getElementById('mun-filter');
    const assignedFilter = document.getElementById('assigned-filter');
    
    if (!recordsTable) return;

    const tableRows = recordsTable.querySelectorAll('.records-table-row');
    const textValue = filterInput ? filterInput.value.toLowerCase().trim() : '';
    const statusValue = statusFilter ? statusFilter.value : 'all';
    const dateValue = dateFilter ? dateFilter.value : '';
    const monthValue = monthFilter ? monthFilter.value : '';
    const munValue = munFilter ? munFilter.value : 'all';
    const assignedValue = assignedFilter ? assignedFilter.value : 'all';

    let visibleCount = 0;
    tableRows.forEach(row => {
      let show = true;
      
      // text match
      if (textValue) {
        const rowText = row.textContent.toLowerCase();
        if (!rowText.includes(textValue)) show = false;
      }

      // date match
      if (show && dateValue) {
        const rowDate = row.getAttribute('data-date');
        if (rowDate !== dateValue) show = false;
      }
      // month match (YYYY-MM)
      if (show && monthValue) {
        const rowDate = row.getAttribute('data-date') || '';
        if (!rowDate.startsWith(monthValue)) show = false;
      }

      // status match
      if (show && statusValue !== 'all') {
        const isRestored = row.getAttribute('data-restored') === 'true';
        if (statusValue === 'restored') {
          if (!isRestored) show = false;
        } else if (statusValue === 'problems') {
          if (isRestored) show = false;
        }
      }

      if (show && munValue && munValue !== 'all') {
        const rowMun = row.getAttribute('data-municipality') || '';
        if (rowMun !== munValue) show = false;
      }

      if (show && quickFilter !== 'all') {
        const isRestored = row.getAttribute('data-restored') === 'true';
        if (isRestored) show = false;
        const isNew = row.getAttribute('data-is-new') === 'true';
        if (quickFilter === 'new' && !isNew) show = false;
        if (quickFilter === 'pending' && isNew) show = false;
      }

      // assignment filter
      if (show && assignedValue !== 'all') {
        const assignedTeam = row.getAttribute('data-assigned-team') || '';
        if (assignedValue === 'assigned' && !assignedTeam) show = false;
        if (assignedValue === 'unassigned' && assignedTeam) show = false;
      }

      row.style.display = show ? 'grid' : 'none';
      if (show) visibleCount++;
    });
    var countEl = document.getElementById('records-visible-count');
    if (countEl) countEl.textContent = String(visibleCount);
    var emptyEl = document.getElementById('records-empty');
    if (emptyEl) emptyEl.style.display = visibleCount === 0 ? 'block' : 'none';
  }

  // Run the update and load records after DOM is ready
  updateRecordsWithProblems();
  // then fetch the latest reports to replace the table
  loadConsumerRecords();

  document.getElementById('records-filter').addEventListener('input', applyFilters);
  document.getElementById('records-date').addEventListener('change', applyFilters);
  var mEl = document.getElementById('records-month'); if (mEl) mEl.addEventListener('change', applyFilters);
  document.getElementById('status-filter').addEventListener('change', applyFilters);
  var aEl = document.getElementById('assigned-filter'); if (aEl) aEl.addEventListener('change', applyFilters);
  var clearBtn = document.getElementById('clear-filters-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', function(){
      var f1 = document.getElementById('records-filter'); if (f1) f1.value = '';
      var f2 = document.getElementById('records-date'); if (f2) f2.value = '';
      var f3 = document.getElementById('records-month'); if (f3) f3.value = '';
      var f4 = document.getElementById('status-filter'); if (f4) f4.value = 'all';
      var f5 = document.getElementById('mun-filter'); if (f5) f5.value = 'all';
      var f6 = document.getElementById('assigned-filter'); if (f6) f6.value = 'all';
      quickFilter = 'all';
      applyFilters();
    });
  }

  // periodically refresh records so new submissions show up automatically
  setInterval(function() {
    loadConsumerRecords();
  }, 30000); // refresh every 30 seconds (adjust as needed)

  // Instant sync when actions happen in Dashboard (other tab/window)
  window.addEventListener('storage', function(ev){
    if (!ev) return;
    if (ev.key === 'pendingAssignments' || ev.key === 'hiddenPins') {
      try {
        if (ev.key === 'pendingAssignments') {
          loadPendingAssignments();
        }
      } catch(_) {}
      updateRecordsWithProblems();
      updateAssignedInTable();
      if (typeof applyFilters === 'function') applyFilters();
      if (typeof updateCounts === 'function') updateCounts();
    }
  });
  document.getElementById('logout-btn').addEventListener('click', function() {
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
  });

  // branches button dropdown (same behavior across pages)
  var branchesBtn = document.getElementById('branches-btn');
  var branchDropdown = document.getElementById('branch-dropdown');
  if (branchesBtn && branchDropdown) {
    branchesBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      branchDropdown.classList.toggle('is-open');
    });
    document.addEventListener('click', function() {
      branchDropdown.classList.remove('is-open');
    });
    branchDropdown.addEventListener('click', function(e) { e.stopPropagation(); });

    branchDropdown.querySelectorAll('.branch-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var branch = this.getAttribute('data-branch');
        localStorage.setItem('selectedBranch', branch);
        window.location.href = 'records.html';
      });
    });
  }

  // Three-dots menu
  var navDotsBtn = document.getElementById('nav-dots-btn');
  var navDotsDropdown = document.getElementById('nav-dots-dropdown');
  if (navDotsBtn && navDotsDropdown) {
    navDotsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var isOpen = navDotsDropdown.classList.toggle('is-open');
      navDotsBtn.setAttribute('aria-expanded', isOpen);
    });
    document.addEventListener('click', function() {
      navDotsDropdown.classList.remove('is-open');
      navDotsBtn.setAttribute('aria-expanded', 'false');
    });
    navDotsDropdown.addEventListener('click', function(e) { e.stopPropagation(); });
    navDotsDropdown.querySelectorAll('.nav-dots-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = this.getAttribute('data-action');
        navDotsDropdown.classList.remove('is-open');
        if (action === 'home') window.location.href = 'dashboard.html';
        else if (action === 'records') { /* already here */ }
        else if (action === 'analytics') window.location.href = 'analytics.html';
        else if (action === 'branches') window.location.href = 'branches.html';
        else if (action === 'about') window.location.href = 'about.html';
        else if (action === 'contact') window.location.href = 'contact.html';
        else if (action === 'etc') window.location.href = 'about.html';
      });
    });
  }

  // Filter and Export functionality
  const filterInput = document.getElementById('records-filter');
  const statusFilter = document.getElementById('status-filter');
  const exportBtn = document.getElementById('export-excel-btn');
  const recordsTable = document.getElementById('consumer-records-table');
  const resetRestoredBtn = document.getElementById('reset-restored-btn');

  // if user selected a branch previously, pre-populate filter and clear storage
  var selectedBranch = localStorage.getItem('selectedBranch');
  if (selectedBranch && filterInput) {
    filterInput.value = selectedBranch;
    localStorage.removeItem('selectedBranch');
  }

  // check url query params for location/issue filter (from dashboard marker clicks)
  var searchParams = new URLSearchParams(window.location.search);
  function decodeParam(val) {
    if (!val) return '';
    return String(val).replace(/\+/g, ' ');
  }
  var locParam = decodeParam(searchParams.get('location'));
  var issueParam = decodeParam(searchParams.get('issue'));
  if (locParam && filterInput) {
    filterInput.value = locParam + (issueParam ? ' ' + issueParam : '');
  }
  if (issueParam && statusFilter) {
    // if an issue was specified, show problems only and include text in filter
    statusFilter.value = 'problems';
  }

  if (filterInput && recordsTable) {
    filterInput.addEventListener('input', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);

    // apply initial filter (including branch) if one is set
    applyFilters();
  }

  // export button logic separated from filtering
  if (exportBtn && recordsTable) {
    exportBtn.addEventListener('click', function() {
      const rows = recordsTable.querySelectorAll('.records-table-header, .records-table-row');
      let csvContent = [];

      rows.forEach(row => {
        if (row.style.display === 'none') return; // Skip filtered out rows
        const rowData = [];
        row.querySelectorAll('span').forEach(cell => {
          let cellText = cell.innerText.replace(/"/g, '""'); // Escape double quotes
          rowData.push(`"${cellText}"`);
        });
        csvContent.push(rowData.join(","));
      });

      const blob = new Blob([csvContent.join("\r\n")], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      // Build filename from active filters for quick context
      var parts = ['consumer_records'];
      var mv = (document.getElementById('mun-filter')||{}).value || 'all';
      var sv = (document.getElementById('status-filter')||{}).value || 'all';
      var av = (document.getElementById('assigned-filter')||{}).value || 'all';
      var dv = (document.getElementById('records-date')||{}).value || '';
      var mmv = (document.getElementById('records-month')||{}).value || '';
      function clean(s){ return String(s).toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-_]/g,''); }
      if (mv && mv!=='all') parts.push(clean(mv));
      if (sv && sv!=='all') parts.push(clean(sv));
      if (av && av!=='all') parts.push('assign-'+clean(av));
      if (dv) parts.push(dv);
      if (mmv) parts.push(mmv);
      link.setAttribute("download", parts.join('_') + ".csv");
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  var quickFilter = 'all';
  function updateCounts(prefNew, prefPending) {
    var newEl = document.getElementById('badge-new-count');
    var pendEl = document.getElementById('badge-pending-count');
    if (!newEl || !pendEl) return;
    if (typeof prefNew === 'number' && typeof prefPending === 'number') {
      newEl.textContent = String(prefNew);
      pendEl.textContent = String(prefPending);
      return;
    }
    var rows = document.querySelectorAll('.records-table-row');
    var n = 0, p = 0;
    rows.forEach(function(row){
      var isRestored = row.getAttribute('data-restored') === 'true';
      if (isRestored) return;
      var isNew = row.getAttribute('data-is-new') === 'true';
      if (isNew) n++; else p++;
    });
    newEl.textContent = String(n);
    pendEl.textContent = String(p);
  }

  function populateMunicipalityFilter(list) {
    var sel = document.getElementById('mun-filter');
    if (!sel) return;
    var existing = Array.from(sel.options).map(function(o){ return o.value; });
    list.forEach(function(m){
      if (!m || existing.includes(m)) return;
      if (isExcludedMunicipality(m)) return;
      var opt = document.createElement('option');
      opt.value = m;
      opt.textContent = m;
      sel.appendChild(opt);
    });
  }

  var munSel = document.getElementById('mun-filter');
  if (munSel) munSel.addEventListener('change', applyFilters);
  var badgeNew = document.getElementById('badge-new');
  var badgePending = document.getElementById('badge-pending');
  if (badgeNew) badgeNew.addEventListener('click', function(){ quickFilter = (quickFilter === 'new') ? 'all' : 'new'; applyFilters(); });
  if (badgePending) badgePending.addEventListener('click', function(){ quickFilter = (quickFilter === 'pending') ? 'all' : 'pending'; applyFilters(); });

  var recModal = document.getElementById('record-modal');
  var closeRec = document.getElementById('close-record-modal');
  var recList = document.getElementById('modal-info-list');
  var copyBtn = document.getElementById('copy-address-btn');
  var viewMapBtn = document.getElementById('view-in-map-btn');
  var lastAddress = '';
  var lastMapTarget = null;
  function openRecordModal(info) {
    if (!recModal || !recList) return;
    recList.innerHTML = '';
    var data = [
      ['Queue No.', info.queueNumber ? ('#' + info.queueNumber) : 'Not assigned'],
      ['Date', info.date || ''],
      ['Account No.', info.contact || ''],
      ['Name', info.name || ''],
      ['Municipality', info.municipality || ''],
      ['Address', info.address || ''],
      ['Issue', info.issue || ''],
      ['New', info.isNew ? 'Yes' : 'No']
    ];
    data.forEach(function(kv){
      var li = document.createElement('li');
      li.textContent = kv[0] + ': ' + kv[1];
      recList.appendChild(li);
    });
    lastAddress = info.address || '';
    lastMapTarget = {
      reportId: info.id || '',
      municipality: info.municipality || '',
      barangay: info.barangay || '',
      address: info.address || '',
      issue: info.issue || ''
    };
    recModal.style.display = 'block';
  }
  if (closeRec) closeRec.addEventListener('click', function(){ recModal.style.display = 'none'; });
  if (recModal) recModal.addEventListener('click', function(e){ if (e.target === recModal) recModal.style.display = 'none'; });
  if (copyBtn) copyBtn.addEventListener('click', function(){ if (lastAddress && navigator.clipboard) navigator.clipboard.writeText(lastAddress); });
  if (viewMapBtn) {
    viewMapBtn.addEventListener('click', function(){
      var t = lastMapTarget || {};
      var sp = new URLSearchParams();
      if (t.reportId) sp.set('report_id', String(t.reportId));
      if (t.municipality) sp.set('municipality', t.municipality);
      if (t.barangay) sp.set('barangay', t.barangay);
      if (!t.municipality && t.address) sp.set('location', t.address);
      if (t.issue) sp.set('issue', t.issue);
      sp.set('alarm', '1');
      window.location.href = 'dashboard.html?' + sp.toString();
    });
  }

  if (resetRestoredBtn) {
    resetRestoredBtn.addEventListener('click', function() {
      localStorage.setItem('restoredLocations', JSON.stringify([]));
      localStorage.setItem('restoredBarangays', JSON.stringify({}));
      updateRecordsWithProblems();
      loadConsumerRecords();
      updateCounts();
    });
  }
});
