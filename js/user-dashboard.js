document.addEventListener('DOMContentLoaded', function () {
  function getStoredName() {
    var session = null;
    try {
      session = JSON.parse(localStorage.getItem('customerSession') || 'null');
    } catch (e) {
      session = null;
    }
    return localStorage.getItem('userName') || (session && session.full_name) || localStorage.getItem('signupName') || '';
  }

  function normalizeStatus(raw) {
    var status = String(raw || 'pending').toLowerCase();
    if (status !== 'resolved' && status !== 'ontheway') return 'pending';
    return status;
  }

  function formatStatus(status) {
    if (status === 'ontheway') return 'On the Way';
    if (status === 'resolved') return 'Resolved';
    return 'Pending';
  }

  function formatTimestamp(value) {
    if (!value) return 'Just now';
    var parsed = new Date(value);
    if (isNaN(parsed.getTime())) return 'Just now';
    return parsed.toLocaleString();
  }

  function setText(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function renderLatestReport(explicitData) {
    var data = explicitData;
    if (!data) {
      try {
        data = JSON.parse(localStorage.getItem('latestUserReport') || 'null');
      } catch (e) {
        data = null;
      }
    }

    var emptyEl = document.getElementById('latest-report-empty');
    var cardEl = document.getElementById('latest-report-card');
    var statusEl = document.getElementById('latest-report-status');

    if (!data) {
      if (emptyEl) emptyEl.hidden = false;
      if (cardEl) cardEl.hidden = true;
      if (statusEl) {
        statusEl.textContent = 'Pending';
        statusEl.className = 'user-status-pill is-pending';
      }
      return;
    }

    var normalizedStatus = normalizeStatus(data.status);
    if (emptyEl) emptyEl.hidden = true;
    if (cardEl) cardEl.hidden = false;
    if (statusEl) {
      statusEl.textContent = formatStatus(normalizedStatus);
      statusEl.className = 'user-status-pill is-' + normalizedStatus;
    }

    setText('latest-report-queue', data.queueNumber ? ('#' + data.queueNumber) : 'Processing');
    setText('latest-report-issue', data.issueType || 'Not specified');
    setText('latest-report-location', data.locationText || [data.barangay, data.municipality].filter(Boolean).join(', ') || 'No location saved');
    setText('latest-report-time', formatTimestamp(data.createdAt));
  }

  var displayName = getStoredName() || 'Guest';
  setText('user-dashboard-name', displayName);

  var reportNameEl = document.getElementById('report-name');
  if (reportNameEl && !reportNameEl.value && displayName !== 'Guest') {
    reportNameEl.value = displayName;
  }

  var logoutBtn = document.getElementById('user-dashboard-logout');
  if (logoutBtn) {
    logoutBtn.hidden = !localStorage.getItem('userName');
    logoutBtn.addEventListener('click', function () {
      localStorage.removeItem('userName');
      localStorage.removeItem('userRole');
      localStorage.removeItem('customerSession');
      window.location.href = 'index.html';
    });
  }

  window.addEventListener('storage', function (event) {
    if (event.key === 'latestUserReport') renderLatestReport();
  });

  window.addEventListener('samelco:report-submitted', function (event) {
    renderLatestReport(event.detail || null);
    if (reportNameEl && !reportNameEl.value && displayName !== 'Guest') {
      reportNameEl.value = displayName;
    }
  });

  renderLatestReport();
});
