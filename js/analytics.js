document.addEventListener('DOMContentLoaded', function () {
  var userName = localStorage.getItem('userName');
  if (!userName) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('user-name').textContent = userName;

  document.getElementById('logout-btn').addEventListener('click', function() {
    localStorage.removeItem('userName');
    window.location.href = 'index.html';
  });

  // notifications bell (lightweight version)
  var notifBtn = document.getElementById('notif-btn');
  var notifDropdown = document.getElementById('notif-dropdown');
  var notifBadge = document.getElementById('notif-badge');
  var notifList = document.getElementById('notif-list');
  var notifEmpty = document.getElementById('notif-empty');
  function toggleNotif(open) {
    if (!notifDropdown || !notifBtn) return;
    var isOpen = typeof open === 'boolean' ? open : !notifDropdown.classList.contains('is-open');
    notifDropdown.classList.toggle('is-open', isOpen);
    notifBtn.setAttribute('aria-expanded', String(isOpen));
  }
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', function(e){ e.stopPropagation(); toggleNotif(); });
    notifDropdown.addEventListener('click', function(e){ e.stopPropagation(); });
    document.addEventListener('click', function(){ toggleNotif(false); });
  }

  // branches button dropdown
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

  var navDotsBtn = document.getElementById('nav-dots-btn');
  var navDotsDropdown = document.getElementById('nav-dots-dropdown');
  if (navDotsBtn && navDotsDropdown) {
    navDotsBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      navDotsDropdown.classList.toggle('is-open');
      navDotsBtn.setAttribute('aria-expanded', navDotsDropdown.classList.contains('is-open'));
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
        else if (action === 'records') window.location.href = 'records.html';
        else if (action === 'analytics') window.location.href = 'analytics.html';
        else if (action === 'about') window.location.href = 'about.html';
        else if (action === 'contact') window.location.href = 'contact.html';
      });
    });
  }

  // Get problem locations from localStorage (set by dashboard or other pages)
  var problemLocations = [];
  try {
    var stored = localStorage.getItem('problemLocations');
    if (stored) {
      problemLocations = JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error parsing problem locations:', e);
  }

  // municipality helpers (shared data comes from municipalities-data.js)
  var MUNICIPALITIES = Array.isArray(window.SAMELCO_MUNICIPALITIES) ? window.SAMELCO_MUNICIPALITIES : [];
  function findMunicipalityByName(name) {
    if (!name) return null;
    var lower = String(name).toLowerCase();
    return MUNICIPALITIES.find(function(m){ return (m.name||'').toLowerCase() === lower; }) || null;
  }
  function findMunicipalityByLocationText(text) {
    if (!text) return null;
    var s = String(text).toLowerCase();
    var hit = MUNICIPALITIES.find(function(m){ return s.indexOf((m.name||'').toLowerCase()) !== -1; });
    return hit || null;
  }
  function distanceApprox(a, b) {
    var Rlat = (a.lat - b.lat), Rlng = (a.lng - b.lng) * Math.cos(a.lat * Math.PI/180);
    return Math.sqrt(Rlat*Rlat + Rlng*Rlng);
  }
  var MUNICIPALITY_COUNTS = {};
  var BARANGAY_COUNTS = {};

  // helper to recompute branch counters and update cards
  function computeBranchProblems() {
    MUNICIPALITY_COUNTS = {};
    BARANGAY_COUNTS = {};
    problemLocations.forEach(function(problem) {
      var muni = (problem.municipality || problem.name || '').trim();
      var brgy = (problem.barangay || '').trim();
      if (muni) {
        MUNICIPALITY_COUNTS[muni] = (MUNICIPALITY_COUNTS[muni] || 0) + 1;
      }
      if (muni && brgy) {
        var key = muni + ' — ' + brgy;
        BARANGAY_COUNTS[key] = (BARANGAY_COUNTS[key] || 0) + 1;
      }
    });

    // Update summary cards
    var activeProblemsEl = document.getElementById('active-problems-count');
    if (activeProblemsEl) {
      activeProblemsEl.textContent = problemLocations.length;
    }
    if (notifBadge) {
      var totalNew = problemLocations.length;
      notifBadge.textContent = String(totalNew);
      notifBadge.style.display = totalNew > 0 ? 'inline-flex' : 'none';
      var sumEl = document.getElementById('notif-summary');
      if (sumEl) sumEl.textContent = totalNew + ' new';
      if (notifList && notifEmpty) {
        notifList.innerHTML = '';
        if (totalNew === 0) {
          notifEmpty.style.display = 'block';
        } else {
          notifEmpty.style.display = 'none';
          problemLocations.slice(-20).reverse().forEach(function(p){
            var item = document.createElement('div');
            item.className = 'notif-item';
            var left = document.createElement('div');
            left.className = 'notif-left';
            var title = document.createElement('div'); title.className = 'notif-item-title'; title.textContent = p.municipality || p.name || 'Unknown';
            var sub = document.createElement('div'); sub.className = 'notif-item-sub'; sub.textContent = p.barangay ? ('Barangay: ' + p.barangay) : (p.issue || '');
            left.appendChild(title); left.appendChild(sub);
            var right = document.createElement('div'); right.className = 'notif-right';
            var time = document.createElement('div'); time.className = 'notif-item-time'; time.textContent = '';
            right.appendChild(time);
            item.appendChild(left); item.appendChild(right);
            notifList.appendChild(item);
          });
        }
      }
    }
    // total records becomes same as problems length for now
    var totalRecordsEl = document.getElementById('total-records-count');
    if (totalRecordsEl) {
      totalRecordsEl.textContent = problemLocations.length;
    }
    // restored services count from local storage (municipality- and barangay-level)
    var restoredCount = 0;
    try {
      var rLoc = localStorage.getItem('restoredLocations');
      if (rLoc) {
        var arr = JSON.parse(rLoc) || [];
        if (Array.isArray(arr)) restoredCount += arr.length;
      }
    } catch (e) {}
    try {
      var rB = localStorage.getItem('restoredBarangays');
      if (rB) {
        var obj = JSON.parse(rB) || {};
        if (obj && typeof obj === 'object') {
          Object.keys(obj).forEach(function(m) {
            var bucket = obj[m] || {};
            restoredCount += Object.keys(bucket).length;
          });
        }
      }
    } catch (e) {}
    var restoredEl = document.getElementById('restored-services-count');
    if (restoredEl) {
      restoredEl.textContent = restoredCount;
    }
  }

  // function responsible for drawing or updating charts
  var muniBarChart, barangayBarChart, trendChart;
  function drawCharts() {
    computeBranchProblems();

    var muniEntries = Object.entries(MUNICIPALITY_COUNTS).sort(function(a, b){ return b[1] - a[1]; });
    var barangayEntries = Object.entries(BARANGAY_COUNTS).sort(function(a, b){ return b[1] - a[1]; });

    var topSelect = document.getElementById('analytics-topn');
    var topN = topSelect ? parseInt(topSelect.value, 10) || 5 : 5;
    muniEntries = muniEntries.slice(0, topN);
    barangayEntries = barangayEntries.slice(0, topN);

    // municipalities vertical bar
    const muniCanvas = document.getElementById('municipalities-bar-chart');
    if (muniCanvas && typeof Chart !== 'undefined') {
      const muniCtx = muniCanvas.getContext('2d');
      Chart.register(ChartDataLabels);
      if (muniBarChart) muniBarChart.destroy();
      muniBarChart = new Chart(muniCtx, {
        type: 'bar',
        data: {
          labels: muniEntries.map(function(e){ return e[0]; }),
          datasets: [{
            label: 'Active Issues',
            data: muniEntries.map(function(e){ return e[1]; }),
            backgroundColor: 'rgba(173, 3, 3, 0.85)',
            borderColor: '#8f0000',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            datalabels: {
              color: '#ffffff',
              font: { weight: 'bold', size: 14, family: "'Outfit', sans-serif" },
              formatter: function(value, context) {
                return value;
              }
            }
          },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#0c0c0c', font: { family: "'Outfit', sans-serif" } } },
            x: { ticks: { color: '#000', font: { family: "'Outfit', sans-serif", size: 11 } } }
          }
        }
      });
    }

    // barangays horizontal bar
    const barangayCanvas = document.getElementById('barangays-horizontal-chart');
    if (barangayCanvas && typeof Chart !== 'undefined') {
      const brgyCtx = barangayCanvas.getContext('2d');
      if (barangayBarChart) barangayBarChart.destroy();
      barangayBarChart = new Chart(brgyCtx, {
        type: 'bar',
        data: {
          labels: barangayEntries.map(function(e){ return e[0]; }),
          datasets: [{
            label: 'Active Issues',
            data: barangayEntries.map(function(e){ return e[1]; }),
            backgroundColor: 'rgba(255, 208, 0, 0.9)',
            borderColor: '#daa520',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          indexAxis: 'y',
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { color: '#0c0c0c', font: { family: "'Outfit', sans-serif" } } },
            x: { ticks: { color: '#000', font: { family: "'Outfit', sans-serif" } } }
          }
        }
      });
    }

    // trend chart still static for now
    const trendChartCanvas = document.getElementById('issues-trend-chart');
    if (trendChartCanvas && typeof Chart !== 'undefined') {
      const trendCtx = trendChartCanvas.getContext('2d');
      if (trendChart) trendChart.destroy();
      trendChart = new Chart(trendCtx, {
        data: {
          labels: ['Feb 12', 'Feb 13', 'Feb 14', 'Feb 15', 'Feb 16', 'Feb 17', 'Feb 18'],
          datasets: [
            { label: 'Paranas', data: [2,2,1,3,2,2,1], borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.1)', tension: 0.3, fill: true },
            { label: 'Catbalogan', data: [1,2,2,2,3,4,1], borderColor: '#dc2626', backgroundColor: 'rgba(220, 38, 38, 0.1)', tension: 0.3, fill: true },
            { label: 'Villareal', data: [1,1,0,1,1,2,1], borderColor: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', tension: 0.3, fill: true },
            { label: 'Basey', data: [1,3,1,4,2,4,1], borderColor: '#f59e0b', backgroundColor: 'rgba(245, 158, 11, 0.1)', tension: 0.3, fill: true }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: { legend: { position: 'top', labels: { color: '#070707', font: { family: "'Outfit', sans-serif", size: 12 } } } },
          scales: {
            y: { beginAtZero: true, max: 5, grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#0c0c0c', font: { family: "'Outfit', sans-serif" } } },
            x: { grid: { color: 'rgba(255, 255, 255, 0.1)' }, ticks: { color: '#000', font: { family: "'Outfit', sans-serif" } } }
          }
        }
      });
    }
  }

  // load analytic data from Supabase if credentials available
  async function loadAnalyticsData() {
    var cfg = window.SAMELCO_SUPABASE || {};
    if (!cfg.url || !cfg.anonKey || !cfg.reportsTable) return;
    try {
      var res = await fetch(cfg.url + '/rest/v1/' + cfg.reportsTable + '?select=*&limit=500', {
        headers: { apikey: cfg.anonKey, Authorization: 'Bearer ' + cfg.anonKey }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      var rows = await res.json();
      if (Array.isArray(rows)) {
        var problems = rows.map(function(r) {
          var locTxt = r.location_text || r.location || r.address || r.municipality || '';
          var found = findMunicipalityByName(r.municipality) || findMunicipalityByLocationText(locTxt);
          var muniName = found ? found.name : (r.municipality || '');
          var brgyName = r.barangay || r.barangay_name || '';
          return { name: muniName, municipality: muniName, barangay: brgyName, issue: r.issue || r.issue_type || '', status: r.status || r.issue_status || '' , created_at: r.created_at || r.inserted_at || ''};
        }).filter(function(p){ return p.name && p.name.length; });
        localStorage.setItem('problemLocations', JSON.stringify(problems));
        problemLocations = problems;
      }
      computeBranchProblems();
      drawCharts();
    } catch (err) {
      console.warn('Failed to load analytics data:', err);
    }
  }

  // initial draw based on whatever is in local storage
  computeBranchProblems();
  drawCharts();
  // then refresh from Supabase
  loadAnalyticsData();

  var topSelectEl = document.getElementById('analytics-topn');
  var rangeEl = document.getElementById('analytics-range');
  var statusEl = document.getElementById('analytics-status');
  [topSelectEl, rangeEl, statusEl].forEach(function(el){
    if (el) el.addEventListener('change', function(){ drawCharts(); });
  });
  document.getElementById('export-municipalities-png') && document.getElementById('export-municipalities-png').addEventListener('click', function(){
    var c = document.getElementById('municipalities-bar-chart');
    if (!c) return;
    var url = c.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url;
    a.download = 'municipalities.png';
    a.click();
  });
  document.getElementById('export-barangays-png') && document.getElementById('export-barangays-png').addEventListener('click', function(){
    var c = document.getElementById('barangays-horizontal-chart');
    if (!c) return;
    var url = c.toDataURL('image/png');
    var a = document.createElement('a');
    a.href = url;
    a.download = 'barangays.png';
    a.click();
  });
  document.getElementById('export-analytics-csv') && document.getElementById('export-analytics-csv').addEventListener('click', function(){
    computeBranchProblems();
    var rows = [['Municipality','Count']];
    Object.keys(MUNICIPALITY_COUNTS).forEach(function(k){ rows.push([k, String(MUNICIPALITY_COUNTS[k])]); });
    var csv = rows.map(function(r){ return r.join(','); }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'analytics.csv';
    a.click();
    URL.revokeObjectURL(url);
  });

  // reflect changes when other tabs/pages update restoration flags
  window.addEventListener('storage', function(e) {
    if (e.key === 'restoredLocations' || e.key === 'restoredBarangays' || e.key === 'problemLocations') {
      try {
        var stored = localStorage.getItem('problemLocations');
        if (stored) problemLocations = JSON.parse(stored) || [];
      } catch (e) {}
      computeBranchProblems();
      drawCharts();
    }
  });


});
