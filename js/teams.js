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

  var allTeams = [];
  var busyTeams = new Set();
  var currentFilter = 'all';

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
              busyTeams.add(trimmedName);
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
      renderTeams();
    } catch (err) {
      console.error('Error loading teams:', err);
    }
  }

  function renderTeams() {
    if (!teamsGrid) return;
    teamsGrid.innerHTML = '';
    
    var filteredTeams = allTeams.filter(function(team) {
      if (currentFilter === 'all') return true;
      var isBusy = busyTeams.has(String(team.name).trim());
      if (currentFilter === 'available') return !isBusy;
      if (currentFilter === 'unavailable') return isBusy;
      return true;
    });

    filteredTeams.forEach(function(team) {
      var isBusy = busyTeams.has(String(team.name).trim());
      var card = document.createElement('div');
      card.className = 'team-card';
      
      var statusClass = team.is_active ? 'badge-active' : 'badge-inactive';
      var statusText = team.is_active ? 'Active' : 'Inactive';
      
      var availClass = isBusy ? 'badge-busy' : 'badge-available';
      var availText = isBusy ? 'Not Available' : 'Available';

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

      card.innerHTML = 
        '<div class="team-card-header">' +
          '<h3 class="team-card-title">' + escapeHtml(team.name) + '</h3>' +
        '</div>' +
        '<div class="team-card-badges">' +
          '<span class="team-badge ' + statusClass + '">' + statusText + '</span>' +
          '<span class="team-badge ' + availClass + '">' + availText + '</span>' +
        '</div>' +
        actionsHtml;
      
      teamsGrid.appendChild(card);
    });

    // Bind actions
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

  document.querySelectorAll('.team-filter-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.team-filter-btn').forEach(function(b) { b.classList.remove('is-active'); });
      this.classList.add('is-active');
      currentFilter = this.getAttribute('data-filter');
      renderTeams();
    });
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