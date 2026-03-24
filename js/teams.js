document.addEventListener('DOMContentLoaded', function () {
  // Check if user is logged in
  var userName = localStorage.getItem('userName');
  if (!userName) {
    window.location.href = 'index.html';
    return;
  }

  // Display user name
  document.getElementById('user-name').textContent = userName;

  // Logout functionality
  function logout() {
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
  }

  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }

  var supabaseCfg = window.SAMELCO_SUPABASE || {};
  var teamsGrid = document.getElementById('teams-grid');
  var addTeamBtn = document.getElementById('add-team-btn');
  var teamModal = document.getElementById('team-modal');
  var cancelTeamBtn = document.getElementById('cancel-team-btn');
  var saveTeamBtn = document.getElementById('save-team-btn');
  var newTeamNameInput = document.getElementById('new-team-name');

  // Team Descriptions Data
  var teamInfoData = {
    'Customer Service / Member Services': {
      icon: '📞',
      subtitle: 'First point of contact',
      handles: [
        'General complaints',
        'Billing concerns',
        'Service requests'
      ],
      note: 'They will forward your concern to the right technical team.'
    },
    'Technical / Engineering Department': {
      icon: '⚡',
      subtitle: 'System engineering & planning',
      handles: [
        'Power outages',
        'Line problems (broken wires, leaning poles)',
        'Transformer issues'
      ],
      note: 'This team usually dispatches linemen to fix the problem.'
    },
    'Operations / Line Crew (Emergency Team)': {
      icon: '🚨',
      subtitle: '24/7 Emergency response',
      handles: [
        'Sudden blackout',
        'Fallen electric posts',
        'Live wires (very dangerous ⚠️)'
      ],
      note: 'Available 24/7 in most cases.'
    },
    'Maintenance Team': {
      icon: '💡',
      subtitle: 'Preventive & scheduled work',
      handles: [
        'Scheduled repairs',
        'Preventive maintenance',
        'Vegetation clearing (trees touching wires)'
      ]
    },
    'Inspection': {
      icon: '🔍',
      subtitle: 'Compliance & monitoring',
      handles: [
        'Service connection inspection',
        'Meter testing',
        'Compliance audits'
      ]
    }
  };

  var infoModal = document.getElementById('info-modal');
  var closeInfoBtn = document.getElementById('close-info-btn');

  var missionModal = document.getElementById('mission-modal');
  var closeMissionBtn = document.getElementById('close-mission-btn');
  var missionList = document.getElementById('mission-list');

  var personnelModal = document.getElementById('personnel-modal');
  var managePersonnelBtn = document.getElementById('manage-personnel-btn');
  var closePersonnelBtn = document.getElementById('close-personnel-btn');
  var savePersonnelBtn = document.getElementById('save-personnel-btn');
  var newPersonnelInput = document.getElementById('new-personnel-name');
  var personnelListEl = document.getElementById('personnel-list');
  var personnelDatalist = document.getElementById('personnel-datalist');

  var allTeams = [];
  var allPersonnel = [];
  var busyTeams = new Map(); // Store team name -> mission count
  var currentFilter = 'all';
  var searchQuery = '';

  var elSearch = document.getElementById('team-search');
  var elTotal = document.getElementById('total-teams-count');
  var elAvailable = document.getElementById('available-teams-count');
  var elBusy = document.getElementById('busy-teams-count');

  function getUserRole() {
    try { return localStorage.getItem('userRole') || 'viewer'; } catch(e){ return 'viewer'; }
  }
  function canManage() {
    return getUserRole() === 'admin';
  }

  // Hide management controls if not admin
  if (!canManage()) {
    if (addTeamBtn) addTeamBtn.style.display = 'none';
  }

  async function loadData() {
    await fetchBusyTeams();
    await loadTeams();
    await loadPersonnel();
  }

  async function loadPersonnel() {
    if (!supabaseCfg.url || !supabaseCfg.anonKey) return;
    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/personnel?select=*&order=full_name.asc', {
        headers: {
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        }
      });
      if (!res.ok) return;
      allPersonnel = await res.json();
      updatePersonnelUI();
    } catch (err) {
      console.error('Error loading personnel:', err);
    }
  }

  function updatePersonnelUI() {
    if (personnelListEl) {
      personnelListEl.innerHTML = '';
      allPersonnel.forEach(function(p) {
        var item = document.createElement('div');
        item.className = 'personnel-item';
        item.innerHTML = 
          '<span class="personnel-name">' + escapeHtml(p.full_name) + '</span>' +
          '<button type="button" class="delete-personnel-btn" data-id="' + p.id + '" title="Remove Member">🗑️</button>';
        
        item.querySelector('.delete-personnel-btn').addEventListener('click', function() {
          if (confirm('Are you sure you want to remove ' + p.full_name + '?')) {
            deletePersonnel(p.id);
          }
        });
        personnelListEl.appendChild(item);
      });
    }

    if (personnelDatalist) {
      personnelDatalist.innerHTML = '';
      allPersonnel.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.full_name;
        personnelDatalist.appendChild(opt);
      });
    }
  }

  async function savePersonnel() {
    var name = newPersonnelInput.value.trim();
    if (!name) return;

    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/personnel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        },
        body: JSON.stringify({ full_name: name })
      });
      if (res.ok) {
        newPersonnelInput.value = '';
        await loadPersonnel();
      } else {
        alert('Failed to save personnel');
      }
    } catch (err) {
      alert('Error saving personnel');
    }
  }

  async function deletePersonnel(id) {
    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/personnel?id=eq.' + id, {
        method: 'DELETE',
        headers: {
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        }
      });
      if (res.ok) {
        await loadPersonnel();
      } else {
        alert('Failed to delete personnel');
      }
    } catch (err) {
      alert('Error deleting personnel');
    }
  }

  async function fetchBusyTeams() {
    if (!supabaseCfg.url || !supabaseCfg.anonKey || !supabaseCfg.reportsTable) return;
    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/' + supabaseCfg.reportsTable + '?select=assigned_team&status=neq.resolved', {
        headers: {
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        }
      });
      if (!res.ok) return;
      var rows = await res.json();
      busyTeams.clear();
      (rows || []).forEach(function(r) {
        if (r.assigned_team) {
          String(r.assigned_team).split(',').forEach(function(teamName) {
            var trimmedName = teamName.trim();
            if (trimmedName) {
              busyTeams.set(trimmedName, (busyTeams.get(trimmedName) || 0) + 1);
            }
          });
        }
      });
    } catch (err) {
      console.error('Error fetching busy teams:', err);
    }
  }

  async function loadTeams() {
    if (!supabaseCfg.url || !supabaseCfg.anonKey) return;
    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/teams?select=*&order=name.asc', {
        headers: {
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        }
      });
      if (!res.ok) return;
      allTeams = await res.json();
      updateStats();
      renderTeams();
    } catch (err) {
      console.error('Error loading teams:', err);
    }
  }

  function updateStats() {
    var total = allTeams.length;
    var busyCount = 0;
    var availableCount = 0;

    allTeams.forEach(function(team) {
      if (busyTeams.has(String(team.name).trim())) busyCount++;
      else availableCount++;
    });

    if (elTotal) elTotal.textContent = total;
    if (elAvailable) elAvailable.textContent = availableCount;
    if (elBusy) elBusy.textContent = busyCount;
  }

  function renderTeams() {
    if (!teamsGrid) return;
    teamsGrid.innerHTML = '';
    
    var filteredTeams = allTeams.filter(function(team) {
      var nameMatch = !searchQuery || team.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!nameMatch) return false;

      if (currentFilter === 'all') return true;
      var isBusy = busyTeams.has(String(team.name).trim());
      if (currentFilter === 'available') return !isBusy;
      if (currentFilter === 'unavailable') return isBusy;
      return true;
    });

    if (filteredTeams.length === 0) {
      teamsGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 3rem; color: #64748b; background: rgba(255,255,255,0.5); border-radius: 20px;">No teams found matching your criteria.</div>';
      return;
    }

    filteredTeams.forEach(function(team) {
      var missionCount = busyTeams.get(String(team.name).trim()) || 0;
      var isBusy = missionCount > 0;
      var card = document.createElement('div');
      card.className = 'team-card' + (isBusy ? ' is-busy' : '');
      
      var statusClass = team.is_active ? 'badge-active' : 'badge-inactive';
      var statusText = team.is_active ? 'Active' : 'Inactive';
      
      var availClass = isBusy ? 'badge-busy' : 'badge-available';
      var availText = isBusy ? 'On Mission' : 'Available';

      var actionsHtml = '';
      if (canManage()) {
        actionsHtml = 
          '<div class="team-card-actions">' +
            '<button type="button" class="team-btn team-btn-toggle toggle-status-btn" data-id="' + team.id + '" data-active="' + team.is_active + '">' +
              (team.is_active ? 'Deactivate' : 'Activate') +
            '</button>' +
            '<button type="button" class="team-btn team-btn-delete delete-team-btn" data-id="' + team.id + '">Delete</button>' +
          '</div>';
      }

      var info = teamInfoData[team.name] || { icon: '👥' };

      card.innerHTML = 
        '<div class="team-card-header">' +
          '<div style="display:flex; justify-content: space-between; align-items: flex-start; width: 100%;">' +
            '<div>' +
              '<div style="font-size: 2rem; margin-bottom: 0.5rem;">' + info.icon + '</div>' +
              '<h3 class="team-card-title">' + escapeHtml(team.name) + '</h3>' +
            '</div>' +
            '<button type="button" class="team-info-btn" data-name="' + escapeHtml(team.name) + '" title="View Team Responsibilities">ℹ️</button>' +
          '</div>' +
        '</div>' +
        '<div class="team-card-badges">' +
          '<span class="team-badge ' + statusClass + '">' + statusText + '</span>' +
          '<span class="team-badge ' + availClass + '">' + availText + '</span>' +
        '</div>' +
        (isBusy ? '<div class="team-assignment-info"><span class="mission-count">' + missionCount + '</span> Active mission' + (missionCount > 1 ? 's' : '') + '</div>' : '<div class="team-assignment-info">No active missions</div>') +
        actionsHtml;
      
      teamsGrid.appendChild(card);
    });

    // Bind actions
    document.querySelectorAll('.team-assignment-info').forEach(function(el) {
      if (el.querySelector('.mission-count')) {
        el.addEventListener('click', function() {
          var teamName = this.closest('.team-card').querySelector('.team-card-title').textContent;
          showActiveMissions(teamName);
        });
      }
    });

    document.querySelectorAll('.team-info-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        showTeamInfo(btn.getAttribute('data-name'));
      });
    });

    document.querySelectorAll('.toggle-status-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        toggleTeamStatus(btn.getAttribute('data-id'), btn.getAttribute('data-active') === 'true');
      });
    });

    document.querySelectorAll('.delete-team-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        if (confirm('Are you sure you want to delete this team?')) {
          deleteTeam(btn.getAttribute('data-id'));
        }
      });
    });
  }

  if (elSearch) {
    elSearch.addEventListener('input', function() {
      searchQuery = this.value.trim();
      renderTeams();
    });
  }

  document.querySelectorAll('.team-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.team-filter-btn').forEach(function(b) { b.classList.remove('is-active'); });
      this.classList.add('is-active');
      currentFilter = this.getAttribute('data-filter');
      renderTeams();
    });
  });

  function showTeamInfo(teamName) {
    if (!infoModal) return;
    var info = teamInfoData[teamName];
    if (!info) {
      alert('Detailed info for this team is not yet available.');
      return;
    }

    var titleEl = document.getElementById('info-title');
    var subEl = document.getElementById('info-subtitle');
    var listEl = document.getElementById('info-handles-list');
    var noteEl = document.getElementById('info-note');

    if (titleEl) titleEl.textContent = (info.icon || '') + ' ' + teamName;
    if (subEl) subEl.textContent = info.subtitle || '';
    
    if (listEl) {
      listEl.innerHTML = '';
      (info.handles || []).forEach(function(h) {
        var li = document.createElement('li');
        li.textContent = h;
        listEl.appendChild(li);
      });
    }

    if (noteEl) {
      noteEl.textContent = info.note || '';
      noteEl.style.display = info.note ? 'block' : 'none';
    }

    infoModal.style.display = 'block';
  }

  if (closeInfoBtn) {
    closeInfoBtn.addEventListener('click', function() {
      infoModal.style.display = 'none';
    });
  }

  async function showActiveMissions(teamName) {
    if (!missionModal || !missionList) return;
    missionList.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;">Loading missions...</div>';
    missionModal.style.display = 'block';
    
    document.getElementById('mission-modal-title').textContent = teamName;
    document.getElementById('mission-modal-subtitle').textContent = 'Managing active missions';

    try {
      // Fetch active reports for this team
      var res = await fetch(supabaseCfg.url + '/rest/v1/' + supabaseCfg.reportsTable + '?select=*&status=neq.resolved&assigned_team=ilike.*' + encodeURIComponent(teamName) + '*', {
        headers: {
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        }
      });
      if (!res.ok) throw new Error('Failed to fetch missions');
      var missions = await res.json();
      
      missionList.innerHTML = '';
      if (missions.length === 0) {
        missionList.innerHTML = '<div style="text-align:center; padding:2rem; color:#64748b;">No active missions found for this team.</div>';
        return;
      }

      missions.forEach(function(m) {
        var item = document.createElement('div');
        item.className = 'mission-item';
        
        var personnel = m.assigned_personnel || ''; // New field or use existing
         var assignedHtml = personnel ? '<div class="mission-assigned-to">👤 Assigned: <strong>' + escapeHtml(personnel) + '</strong></div>' : '<div class="mission-assigned-to">⚠️ No one assigned yet</div>';

         item.innerHTML = 
            '<div class="mission-item-header">' +
              '<div>' +
                '<span class="mission-queue">#' + (m.queue_number || m.id) + '</span>' +
                '<div class="mission-issue">' + escapeHtml(m.issue_type) + '</div>' +
              '<div>' + assignedHtml + '</div>' +
              '</div>' +
              '<span class="team-badge badge-active" style="font-size:0.7rem;">' + escapeHtml(m.status) + '</span>' +
            '</div>' +
            '<div class="mission-location">📍 ' + escapeHtml(m.municipality) + ', ' + escapeHtml(m.barangay) + '</div>' +
            '<div class="mission-assign-wrap">' +
              '<input type="text" class="mission-assign-input" list="personnel-datalist" placeholder="Select or type member..." value="' + escapeHtml(personnel) + '">' +
              '<button type="button" class="mission-save-btn" data-id="' + m.id + '">Assign</button>' +
            '</div>';
        
        missionList.appendChild(item);
      });

      // Bind save buttons
      missionList.querySelectorAll('.mission-save-btn').forEach(function(btn) {
        btn.addEventListener('click', async function() {
          var reportId = btn.getAttribute('data-id');
          var input = btn.closest('.mission-item').querySelector('.mission-assign-input');
          var name = input.value.trim();
          
          btn.disabled = true;
          btn.textContent = 'Saving...';
          
          try {
            var updateRes = await fetch(supabaseCfg.url + '/rest/v1/' + supabaseCfg.reportsTable + '?id=eq.' + reportId, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                apikey: supabaseCfg.anonKey,
                Authorization: 'Bearer ' + supabaseCfg.anonKey,
                'Prefer': 'return=representation'
              },
              // We'll try to update 'assigned_personnel'. If it fails, the user might need to add it.
              // As a fallback, maybe the user just wants to update the 'assigned_team' itself?
              // Let's try 'assigned_personnel' first as it's cleaner.
              body: JSON.stringify({ assigned_personnel: name })
            });
            
            if (updateRes.ok) {
              btn.textContent = 'Saved!';
              btn.style.background = '#059669';
              setTimeout(function() {
                btn.textContent = 'Assign';
                btn.style.background = '#8b2a2a';
                btn.disabled = false;
              }, 2000);
            } else {
              // Fallback: If assigned_personnel column doesn't exist, maybe update assigned_team
              // For now, let's just show an error if it fails.
              var err = await updateRes.json();
              console.error('Save failed:', err);
              alert('Error: Make sure "assigned_personnel" column exists in reports table.');
              btn.textContent = 'Error';
              btn.disabled = false;
            }
          } catch (err) {
            console.error('Save error:', err);
            alert('Failed to save assignment.');
            btn.textContent = 'Assign';
            btn.disabled = false;
          }
        });
      });

    } catch (err) {
      console.error('Fetch error:', err);
      missionList.innerHTML = '<div style="text-align:center; padding:2rem; color:#ef4444;">Failed to load missions.</div>';
    }
  }

  if (closeMissionBtn) {
    closeMissionBtn.addEventListener('click', function() {
      missionModal.style.display = 'none';
    });
  }

  // Close modals when clicking outside
  window.addEventListener('click', function(event) {
    if (event.target === teamModal) {
      teamModal.style.display = 'none';
    }
    if (event.target === infoModal) {
      infoModal.style.display = 'none';
    }
    if (event.target === missionModal) {
      missionModal.style.display = 'none';
    }
    if (event.target === personnelModal) {
      personnelModal.style.display = 'none';
    }
  });

  async function toggleTeamStatus(id, currentActive) {
    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/teams?id=eq.' + id, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        },
        body: JSON.stringify({ is_active: !currentActive })
      });
      if (res.ok) {
        await loadData();
      } else {
        var err = await res.json();
        console.error('Toggle failed:', err);
        alert('Failed to update team status: ' + (err.message || 'Unknown error'));
      }
    } catch (err) {
      console.error('Toggle error:', err);
      alert('Failed to update team status');
    }
  }

  async function deleteTeam(id) {
    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/teams?id=eq.' + id, {
        method: 'DELETE',
        headers: {
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey
        }
      });
      if (res.ok) {
        await loadData();
      } else {
        var err = await res.json();
        console.error('Delete failed:', err);
        if (err.code === '23503') {
          alert('Cannot delete team because it is referenced in reports. Deactivate it instead.');
        } else {
          alert('Failed to delete team: ' + (err.message || 'Unknown error'));
        }
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete team');
    }
  }

  async function saveNewTeam() {
    var name = newTeamNameInput.value.trim();
    if (!name) {
      alert('Please enter a team name');
      return;
    }

    try {
      var res = await fetch(supabaseCfg.url + '/rest/v1/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseCfg.anonKey,
          Authorization: 'Bearer ' + supabaseCfg.anonKey,
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({ name: name, is_active: true })
      });
      if (res.ok) {
        newTeamNameInput.value = '';
        teamModal.style.display = 'none';
        loadData();
      } else {
        var err = await res.json();
        if (err.code === '23505') alert('A team with this name already exists.');
        else alert('Failed to save team');
      }
    } catch (err) {
      alert('Failed to save team');
    }
  }

  if (addTeamBtn) {
    addTeamBtn.addEventListener('click', function() {
      teamModal.style.display = 'block';
    });
  }

  if (cancelTeamBtn) {
    cancelTeamBtn.addEventListener('click', function() {
      teamModal.style.display = 'none';
    });
  }

  if (saveTeamBtn) {
    saveTeamBtn.addEventListener('click', saveNewTeam);
  }

  if (managePersonnelBtn) {
    managePersonnelBtn.addEventListener('click', function() {
      personnelModal.style.display = 'block';
    });
  }

  if (closePersonnelBtn) {
    closePersonnelBtn.addEventListener('click', function() {
      personnelModal.style.display = 'none';
    });
  }

  if (savePersonnelBtn) {
    savePersonnelBtn.addEventListener('click', savePersonnel);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  loadData();
});