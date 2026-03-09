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
    // localStorage.removeItem('userRole');
    window.location.href = 'index.html';
  }

  var logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function() {
      logout();
    });
  }

  function getUserRole() {
    try { return localStorage.getItem('userRole') || 'viewer'; } catch(e){ return 'viewer'; }
  }
  function canManage() {
    return getUserRole() === 'admin';
  }
  var supabaseCfg = window.SAMELCO_SUPABASE || {};

  async function setReportStatusById(reportId, nextStatus) {
    if (!supabaseCfg.url || !supabaseCfg.anonKey || !supabaseCfg.reportsTable) {
      throw new Error('Missing Supabase config');
    }
    var normalized = String(nextStatus || '').toLowerCase();
    if (normalized !== 'resolved' && normalized !== 'pending' && normalized !== 'ontheway') {
      normalized = 'pending';
    }
    var patchBody = (normalized === 'resolved')
      ? { status: 'resolved', resolved_at: new Date().toISOString() }
      : { status: normalized, resolved_at: null };
    var res = await fetch(supabaseCfg.url + '/rest/v1/' + supabaseCfg.reportsTable + '?id=eq.' + encodeURIComponent(reportId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseCfg.anonKey,
        Authorization: 'Bearer ' + supabaseCfg.anonKey,
        Prefer: 'return=representation'
      },
      body: JSON.stringify(patchBody)
    });
    if (!res.ok) {
      var responseText = '';
      try { responseText = (await res.text()) || ''; } catch (_) {}
      throw new Error('Failed to update report status (HTTP ' + res.status + ')' + (responseText ? ': ' + responseText : ''));
    }
  }

  function buildStatusUpdateErrorMessage(err) {
    var msg = (err && err.message) ? String(err.message) : '';
    if (!msg) return 'Failed to update status for this report entry.';
    if (/Missing Supabase config/i.test(msg)) {
      return 'Cannot update status because Supabase config is missing on this page.';
    }
    if (/HTTP 401|HTTP 403/i.test(msg)) {
      return 'Status update was denied (401/403). Check Supabase RLS policy and API key permissions.';
    }
    if (/HTTP 404/i.test(msg)) {
      return 'Status update failed because the report record was not found (404).';
    }
    return 'Failed to update status: ' + msg;
  }

  function readAuditLogs() {
    try { return JSON.parse(localStorage.getItem('auditLogs') || '[]'); } catch(e){ return []; }
  }
  function renderAuditLogs() {
    var list = document.getElementById('audit-logs-list');
    var empty = document.getElementById('audit-logs-empty');
    if (!list || !empty) return;
    var logs = readAuditLogs().slice().reverse().slice(0, 100);
    list.innerHTML = '';
    if (!logs.length) {
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    logs.forEach(function(l){
      var li = document.createElement('li');
      var when = l.ts ? new Date(l.ts).toLocaleString() : '';
      var who = l.who || 'User';
      var desc = l.summary || (l.type || '') + ' ' + JSON.stringify(l.data || {});
      li.textContent = when + ' | ' + who + ' | ' + desc;
      list.appendChild(li);
    });
  }
  var toggleAuditBtn = document.getElementById('toggle-audit-btn');
  if (toggleAuditBtn) {
    toggleAuditBtn.addEventListener('click', function(){
      var box = document.getElementById('audit-logs');
      if (!box) return;
      var show = box.style.display === 'none' || box.style.display === '';
      box.style.display = show ? 'block' : 'none';
      if (show) renderAuditLogs();
    });
  }

  // Branches button (top of nav) â€“ show dropdown with choices
  var branchesBtn = document.getElementById('branches-btn');
  var branchDropdown = document.getElementById('branch-dropdown');
  if (branchesBtn && branchDropdown) {
    branchesBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      var open = branchDropdown.classList.toggle('is-open');
    });
    document.addEventListener('click', function() {
      branchDropdown.classList.remove('is-open');
    });
    branchDropdown.addEventListener('click', function(e) { e.stopPropagation(); });

    // branch selection
    branchDropdown.querySelectorAll('.branch-option').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var branch = this.getAttribute('data-branch');
        localStorage.setItem('selectedBranch', branch);
        window.location.href = 'records.html';
      });
    });
  }

  // Three-dots menu toggle
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
    navDotsDropdown.addEventListener('click', function(e) {
      e.stopPropagation();
    });
    navDotsDropdown.querySelectorAll('.nav-dots-item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var action = this.getAttribute('data-action');
        navDotsDropdown.classList.remove('is-open');
        if (action === 'home') {
          window.location.href = 'dashboard.html';
        } else if (action === 'records') {
          window.location.href = 'records.html';
        } else if (action === 'analytics') {
          window.location.href = 'analytics.html';
        } else if (action === 'branches') {
          window.location.href = 'branches.html';
        } else if (action === 'etc') {
          window.location.href = 'about.html';
        } else if (action === 'contact') {
          window.location.href = 'contact.html';
        }
        else if (action === 'logout') {
          logout();
        }
      });
    });
  }

  // Municipalities data - All municipalities and cities in Samar province (26 total)
  var municipalities = [
    { name: 'Almagro', lat: 11.9167, lng: 124.2833, barangays: ['Bacjao', 'Biasong I', 'Biasong II', 'Costa Rica', 'Costa Rica II', 'Guin-ansan', 'Imelda', 'Kerikite', 'Lunang I', 'Lunang II', 'Mabuhay', 'Magsaysay', 'Malobago', 'Marasbaras', 'Panjobjoban I', 'Panjobjoban II', 'Poblacion', 'RoÃ±o', 'San Isidro', 'San Jose', 'Talahid', 'Tonga-tonga', 'Veloso'] },
    { name: 'Basey', lat: 11.2833, lng: 125.0667, barangays: ['Amandayehan', 'Anglit', 'Bacubac', 'Balante', 'Baloog', 'Basiao', 'Baybay', 'Binongtu-an', 'Buenavista', 'Bulao', 'Burgos', 'Buscada', 'Cambayan', 'Can-abay', 'Cancaiyas', 'Canmanila', 'Catadman', 'Cogon', 'Del Pilar', 'Dolongan', 'Guintigui-an', 'Guirang', 'Iba', 'Inuntan', 'Lawa-an', 'Loog', 'Loyo', 'Mabini', 'Magallanes', 'Manlilinab', 'May-it', 'Mercado', 'Mongabong', 'New San Agustin', 'Nouvelas Occidental', 'Old San Agustin', 'Palaypay', 'Panugmonon', 'Pelit', 'Roxas', 'Salvacion', 'San Antonio', 'San Fernando', 'Sawa', 'Serum', 'Sugca', 'Sugponon', 'Sulod', 'Tinaogan', 'Tingib', 'Villa Aurora'] },
    { name: 'Calbayog City', lat: 12.0672, lng: 124.5972, barangays: ['Acedillo', 'Aguit-itan', 'Alibaba', 'Amampacang', 'Anislag', 'Awang East', 'Awang West', 'Ba-ay', 'Bagacay', 'Bagong Lipunan', 'Baja', 'Balud', 'Bante', 'Bantian', 'Basud', 'Bayo', 'Begaho', 'Binaliw', 'Bontay', 'Buenavista', 'Bugtong', 'Cabacungan', 'Cabatuan', 'Cabicahan', 'Cabugawan', 'Cacaransan', 'Cag-anahaw', 'Cag-anibong', 'Cag-olango', 'Cagbanayacao', 'Cagbayang', 'Cagbilwang', 'Cagboborac', 'Caglanipao Sur', 'Cagmanipes Norte', 'Cagmanipes Sur', 'Cagnipa', 'Cagsalaosao', 'Cahumpan', 'Calocnayan', 'Cangomaod', 'Canhumadac', 'Capacuhan', 'Capoocan', 'Carayman', 'Carmen', 'Catabunan', 'Caybago', 'Central', 'Cogon', 'Dagum', 'Danao I', 'Danao II', 'Dawo', 'De Victoria', 'Dinabongan', 'Dinagan', 'Dinawacan', 'Esperanza', 'Gamay', 'Gadgaran', 'Gasdo', 'Geraga-an', 'Guimbaoyan Norte', 'Guimbaoyan Sur', 'Guin-on', 'Hamorawon', 'Helino', 'Hibabngan', 'Hibatang', 'Higasaan', 'Himalandrog', 'Hugon Rosales', 'Jacinto', 'Jimautan', 'Jose A. RoÃ±o', 'Kalilihan', 'Kilikili', 'La Paz', 'Langoyon', 'Lapaan', 'Libertad', 'Limarayon', 'Longsob', 'Lonoy', 'Looc', 'Mabini I', 'Mabini II', 'Macatingog', 'Mag-ubay', 'Maguino-o', 'Malaga', 'Malajog', 'Malayog', 'Malopalo', 'Mancol', 'Mantaong', 'Manuel Barral, Sr.', 'Marcatubig', 'Matobato', 'Mawacat', 'Maybog', 'Maysalong', 'Migara', 'Nabang', 'Naga', 'Naguma', 'Navarro', 'Nijaga', 'Oboob', 'Obrero', 'Olera', 'Oquendo', 'OsmeÃ±a', 'Pagbalican', 'Palanas', 'Palanogan', 'Panlayahan', 'Panonongan', 'Panoypoy', 'Patong', 'Payahan', 'PeÃ±a', 'Pilar', 'Pinamorotan', 'Quezon', 'Rawis', 'Rizal I', 'Rizal II', 'Roxas I', 'Roxas II', 'Saljag', 'Salvacion', 'San Antonio', 'San Isidro', 'San Joaquin', 'San Jose', 'San Policarpio', 'San Rufino', 'Saputan', 'Sigo', 'Sinantan', 'Sinidman Occidental', 'Sinidman Oriental', 'Tabawan', 'Talahiban', 'Tanval', 'Tapa-e', 'Tarabucan', 'Tigbe', 'Tinambacan Norte', 'Tinambacan Sur', 'Tinaplacan', 'Tomaliguez', 'Trinidad', 'Victory', 'Villahermosa'] },
    { name: 'Calbiga', lat: 11.6167, lng: 125.0167, barangays: ['Antol', 'Bacyaran', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Barangay 5', 'Barangay 6', 'Barangay 7', 'Barobaybay', 'Beri', 'Binanggaran', 'Borong', 'Bulao', 'Buluan', 'Caamlongan', 'Calayaan', 'Calingonan', 'Canbagtic', 'Canticum', 'Daligan', 'Guinbanga', 'Hindang', 'Hubasan', 'Literon', 'Lubang', 'Macaalan', 'Mahangcao', 'Malabal', 'Minata', 'Otoc', 'Panayuran', 'Pasigay', 'Patong', 'Polangi', 'Rawis', 'San Ignacio', 'San Mauricio', 'Sinalangtan', 'Timbangan', 'Tinago'] },
    { name: 'Catbalogan City', lat: 11.7792, lng: 124.8842, barangays: ['Albalate', 'Bagongon', 'Bangon', 'Basiao', 'Buluan', 'Bunuanan', 'Cabugawan', 'Cagudalo', 'Cagusipan', 'Cagutian', 'Cagutsan', 'Canhawan Gote', 'Canlapwas', 'Cawayan', 'Cinco', 'Darahuway Daco', 'Darahuway Gote', 'Estaka', 'Guindaponan', 'Guinsorongan', 'Ibol', 'Iguid', 'Lagundi', 'Libas', 'Lobo', 'Manguehay', 'Maulong', 'Mercedes', 'Mombon', 'MuÃ±oz', 'New Mahayag', 'Old Mahayag', 'Palanyogon', 'Pangdan', 'Payao', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5', 'Poblacion 6', 'Poblacion 7', 'Poblacion 8', 'Poblacion 9', 'Poblacion 10', 'Poblacion 11', 'Poblacion 12', 'Poblacion 13', 'Pupua', 'Rama', 'San Andres', 'San Pablo', 'San Roque', 'San Vicente', 'Silanga', 'Socorro', 'Totoringon'] },
    { name: 'Daram', lat: 11.6333, lng: 124.7833, barangays: ['Arawane', 'Astorga', 'Bachao', 'Baclayan', 'Bagacay', 'Bayog', 'Betaug', 'Birawan', 'Bono-anon', 'Buenavista', 'Burgos', 'Cabac', 'Cabil-isan', 'Cabiton-an', 'Cabugao', 'Cagboboto', 'Calawan-an', 'Cambuhay', 'Campelipa', 'Candugue', 'Canloloy', 'Cansaganay', 'Casab-ahan', 'Guindapunan', 'Guintampilan', 'Iquiran', 'Jacopon', 'Losa', 'Lucob-lucob', 'Mabini', 'Macalpe', 'Mandoyucan', 'Marupangdan', 'Mayabay', 'Mongolbongol', 'Nipa', 'Parasan', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Pondang', 'Poso', 'Real', 'Rizal', 'San Antonio', 'San Jose', 'San Miguel', 'San Roque', 'San Vicente', 'Saugan', 'So-ong', 'Sua', 'Sugod', 'Talisay', 'Tugas', 'Ubo', 'Valles-Bello', 'Yangta'] },
    { name: 'Gandara', lat: 12.0167, lng: 124.8167, barangays: ['Adela Heights', 'Arong', 'Balocawe', 'Bangahon', 'Beslig', 'Buao', 'Bunyagan', 'Burabod I', 'Burabod II', 'Calirocan', 'Canhumawid', 'Caparangasan', 'Caranas', 'Carmona', 'Casab-ahan', 'Casandig', 'Catorse de Agosto', 'Caugbusan', 'Concepcion', 'Diaz', 'Dumalo-ong', 'Elcano', 'Gerali', 'Gereganan', 'Giaboc', 'Hampton', 'Hetebac', 'Himamaloto', 'Hinayagan', 'Hinugacan', 'Hiparayan', 'Jasminez', 'Lungib', 'Mabuhay', 'Macugo', 'Malayog', 'Marcos', 'Minda', 'Nacube', 'Nalihugan', 'Napalisan', 'Natimonan', 'Ngoso', 'Palambrag', 'Palanas', 'Pizarro', 'PiÃ±aplata', 'Pologon', 'Purog', 'Rawis', 'Rizal', 'Samoyao', 'San Agustin', 'San Antonio', 'San Enrique', 'San Francisco', 'San Isidro', 'San Jose', 'San Miguel', 'San Pelayo', 'San Ramon', 'Santa Elena', 'Santo NiÃ±o', 'Senibaran', 'Sidmon', 'Tagnao', 'Tambongan', 'Tawiran', 'Tigbawon'] },
    { name: 'Hinabangan', lat: 11.6833, lng: 125.0833, barangays: ['Bagacay', 'Binobucalan', 'Bucalan', 'Cabalagnan', 'Cabang', 'Canano', 'Concord', 'Consolabao', 'Dalosdoson', 'Fatima', 'Lim-ao', 'Malihao', 'Mugdo', 'OsmeÃ±a', 'Poblacion 1', 'Poblacion 2', 'Rawis', 'San Jose', 'San Rafael', 'Tabay', 'Yabon'] },
    { name: 'Jiabong', lat: 11.7667, lng: 124.9500, barangays: ['Barangay No. 1', 'Barangay No. 2', 'Barangay No. 3', 'Barangay No. 4', 'Barangay No. 5', 'Barangay No. 6', 'Barangay No. 7', 'Barangay No. 8', 'Bawang', 'Bugho', 'Camarobo-an', 'Candayao', 'Cantongtong', 'Casapa', 'Catalina', 'Cristina', 'Dogongan', 'Garcia', 'Hinaga', 'Jia-an', 'Jidanao', 'Lulugayan', 'Macabetas', 'Malino', 'Malobago', 'Mercedes', 'Nagbac', 'Parina', 'Salvacion', 'San Andres', 'San Fernando', 'San Miguel', 'Tagbayaon', 'Victory'] },
    { name: 'Marabut', lat: 11.1167, lng: 125.2167, barangays: ['Amambucale', 'Amantillo', 'Binukyahan', 'Caluwayan', 'Canyoyo', 'Catato Poblacion', 'Ferreras', 'Legaspi', 'Lipata', 'Logero', 'Mabuhay', 'Malobago', 'Odoc', 'OsmeÃ±a', 'Panan-awan', 'Pinalanga', 'Pinamitinan', 'RoÃ±o', 'San Roque', 'Santa Rita', 'Santo NiÃ±o Poblacion', 'Tagalag', 'Tinabanan', 'Veloso'] },
    { name: 'Matuguinao', lat: 12.1333, lng: 124.8833, barangays: ['Angyap', 'Bag-otan', 'Barruz', 'Camonoan', 'Carolina', 'Deit', 'Del Rosario', 'Inubod', 'Libertad', 'Ligaya', 'Mabuligon Poblacion', 'Maduroto Poblacion', 'Mahanud', 'Mahayag', 'Nagpapacao', 'Rizal', 'Salvacion', 'San Isidro', 'San Roque', 'Santa Cruz'] },
    { name: 'Motiong', lat: 11.7833, lng: 125.0000, barangays: ['Angyap', 'Barayong', 'Bayog', 'Beri', 'Bonga', 'Calantawan', 'Calapi', 'Caluyahan', 'Canatuan', 'Candomacol', 'Canvais', 'Capaysagan', 'Caranas', 'Caulayanan', 'Hinica-an', 'Inalad', 'Linonoban', 'Malobago', 'Malonoy', 'Mararangsi', 'Maypange', 'New Minarog', 'Oyandic', 'Pamamasan', 'Poblacion I', 'Poblacion I-A', 'Pusongan', 'San Andres', 'Santo NiÃ±o', 'Sarao'] },
    { name: 'Pagsanghan', lat: 11.9667, lng: 124.7167, barangays: ['Bangon', 'Buenos Aires', 'Calanyugan', 'Caloloma', 'Cambaye', 'Canlapwas', 'Libertad', 'PaÃ±ge', 'San Luis', 'Santo NiÃ±o', 'Viejo', 'Villahermosa Occidental', 'Villahermosa Oriental'] },
    { name: 'Paranas (Wright)', lat: 11.8500, lng: 125.1167, barangays: ['Anagasi', 'Apolonia', 'Bagsa', 'Balbagan', 'Bato', 'Buray', 'Cantaguic', 'Cantao-an', 'Cantato', 'Casandig I', 'Casandig II', 'Cawayan', 'Concepcion', 'Jose RoÃ±o', 'Lawaan I', 'Lawaan II', 'Lipata', 'Lokilokon', 'Mangcal', 'Maylobe', 'Minarog', 'Nawi', 'Pabanog', 'Paco', 'Pagsa-ogan', 'Pagsanjan', 'Patag', 'Pequit', 'Poblacion 1', 'Poblacion 2', 'Poblacion 3', 'Poblacion 4', 'Poblacion 5', 'Poblacion 6', 'Salay', 'San Isidro', 'Santo NiÃ±o', 'Sulopan', 'Tabucan', 'Tapul', 'Tenani', 'Tigbawon', 'Tula', 'Tutubigan'] },
    { name: 'Pinabacdao', lat: 11.6167, lng: 124.9833, barangays: ['Bangon', 'Barangay I', 'Barangay II', 'Botoc', 'Bugho', 'Calampong', 'Canlobo', 'Catigawan', 'Dolores', 'Lale', 'Lawaan', 'Laygayon', 'Layo', 'Loctob', 'Madalunot', 'Magdawat', 'Mambog', 'Manaing', 'Nabong', 'Obayan', 'Pahug', 'Parasanon', 'Pelaon', 'San Isidro'] },
    { name: 'San Jorge', lat: 11.3000, lng: 125.0833, barangays: ['Anquiana', 'Aurora', 'Bay-ang', 'Blanca Aurora', 'Buenavista I', 'Buenavista II', 'Bulao', 'Bungliw', 'Cabugao', 'Cag-olo-olo', 'Calundan', 'Cantaguic', 'Canyaki', 'Cogtoto-og', 'Erenas', 'Gayondato', 'Guadalupe', 'Guindapunan', 'Hernandez', 'Himay', 'Janipon', 'La Paz', 'Libertad', 'Lincoro', 'Mabuhay', 'Mancol', 'Matalud', 'Mobo-ob', 'Mombon', 'Puhagan', 'Quezon', 'Ranera', 'Rawis', 'Rosalim', 'San Isidro', 'San Jorge I', 'San Jorge II', 'San Juan', 'Sapinit', 'Sinit-an', 'Tomogbong'] },
    { name: 'San Jose de Buan', lat: 12.0500, lng: 125.0333, barangays: ['Aguingayan', 'Babaclayon', 'Barangay 1', 'Barangay 2', 'Barangay 3', 'Barangay 4', 'Can-aponte', 'Cataydongan', 'Gusa', 'Hagbay', 'Hibaca-an', 'Hiduroma', 'Hilumot', 'San Nicolas'] },
    { name: 'San Sebastian', lat: 11.7000, lng: 125.0167, barangays: ['Balogo', 'Bontod', 'Cabaywa', 'Camanhagay', 'Campiyak', 'Canduyucan', 'Dolores', 'Hita-asan I', 'Hita-asan II', 'Inobongan', 'Poblacion Barangay 1', 'Poblacion Barangay 2', 'Poblacion Barangay 3', 'Poblacion Barangay 4'] },
    { name: 'Santa Margarita', lat: 12.0378, lng: 124.6584, barangays: ['Agrupacion', 'Arapison', 'Avelino', 'Bahay', 'Balud', 'Bana-ao', 'Burabod', 'Cagsumje', 'Cautod (Poblacion)', 'Camperito', 'Campeig', 'Can-ipulan', 'Canmoros', 'Cinco', 'Curry', 'Gajo', 'Hindang', 'Ilo', 'Imelda', 'Inoraguiao', 'Jolacao', 'Lambao', 'Mabuhay', 'Mahayag', 'Matayonas', 'Monbon (Poblacion)', 'Nabulo', 'Napuro I', 'Napuro II', 'Palale', 'Panabatan', 'Panaruan', 'Roxas', 'Salvacion', 'Solsogon', 'Sundara'] },
    { name: 'Santa Rita', lat: 11.4500, lng: 124.9333, barangays: ['Alegria', 'Anibongan', 'Aslum', 'Bagolibas', 'Binanalan', 'Bokinggan Poblacion', 'Bougainvilla Poblacion', 'Cabacungan', 'Cabunga-an', 'Camayse', 'Cansadong', 'Caticugan', 'Dampigan', 'Guinbalot-an', 'Gumamela Poblacion', 'Hinangudtan', 'Igang-igang', 'La Paz', 'Lupig', 'Magsaysay', 'Maligaya', 'New Manunca', 'Old Manunca', 'Pagsulhogon', 'Rosal Poblacion', 'Salvacion', 'San Eduardo', 'San Isidro', 'San Juan', 'San Pascual', 'San Pedro', 'San Roque', 'Santa Elena', 'Santan Poblacion', 'Tagacay', 'Tominamos', 'Tulay', 'Union'] },
    { name: 'Santo NiÃ±o', lat: 11.9833, lng: 124.4667, barangays: ['Balatguti', 'Baras', 'Basud', 'Buenavista', 'Cabunga-an', 'Corocawayan', 'Ilijan', 'Ilo', 'Lobelobe', 'Pinanangnan', 'Sevilla', 'Takut', 'Villahermosa'] },
    { name: 'Tagapul-an', lat: 11.9500, lng: 124.8333, barangays: ['Baguiw', 'Balocawe', 'Guinbarucan', 'Labangbaybay', 'Luna', 'Mataluto', 'Nipa', 'Pantalan', 'Pulangbato', 'San Jose', 'San Vicente', 'Suarez', 'Sugod', 'Trinidad'] },
    { name: 'Talalora', lat: 11.5333, lng: 124.8333, barangays: ['Bo. Independencia', 'Malaguining', 'Mallorga', 'Navatas Daku', 'Navatas Guti', 'Placer', 'Poblacion Barangay 1', 'Poblacion Barangay 2', 'San Juan', 'Tatabunan', 'Victory'] },
    { name: 'Tarangnan', lat: 11.9000, lng: 124.7500, barangays: ['Alcazar', 'Awang', 'Bahay', 'Balonga-as', 'Balugo', 'Bangon Gote', 'Baras', 'Binalayan', 'Bisitahan', 'Bonga', 'Cabunga-an', 'Cagtutulo', 'Cambatutay Nuevo', 'Cambatutay Viejo', 'Canunghan', 'Catan-agan', 'Dapdap', 'Gallego', 'Imelda Poblacion', 'Lahong', 'Libucan Dacu', 'Libucan Gote', 'Lucerdoni', 'Majacob', 'Mancares', 'Marabut', 'Oeste-A', 'Oeste-B', 'Pajo', 'Palencia', 'Poblacion A', 'Poblacion B', 'Poblacion C', 'Poblacion D', 'Poblacion E', 'San Vicente', 'Santa Cruz', 'Sugod', 'Talinga', 'Tigdaranao', 'Tizon'] },
    { name: 'Villareal', lat: 11.5667, lng: 124.9333, barangays: ['Banquil', 'Bino-ongan', 'Burabod', 'Cambaguio', 'Canmucat', 'Central', 'Conant', 'Guintarcan', 'Himyangan', 'Igot', 'Inarumbacan', 'Inasudlan', 'Lam-awan', 'Lamingao', 'Lawa-an', 'Macopa', 'Mahayag', 'Malonoy', 'Mercado', 'Miramar', 'Nagcaduha', 'Pacao', 'Pacoyoy', 'Pangpang', 'Patag', 'Plaridel', 'Polangi', 'San Andres', 'San Fernando', 'San Rafael', 'San Roque', 'Santa Rosa', 'Santo NiÃ±o', 'Soledad', 'Tayud', 'Tomabe', 'Ulayan', 'Villarosa Poblacion'] },
    { name: 'Zumarraga', lat: 11.6333, lng: 124.8500, barangays: ['Alegria', 'Arteche', 'Bioso', 'Boblaran', 'Botaera', 'Buntay', 'Camayse', 'Canwarak', 'Ibarra', 'Lumalantang', 'Macalunod', 'Maga-an', 'Maputi', 'Marapilit', 'Monbon', 'Mualbual', 'Pangdan', 'Poblacion 1', 'Poblacion 2', 'Poro', 'San Isidro', 'Sugod', 'Talib', 'Tinaugan', 'Tubigan'] }
  ];
  // Prefer shared data if available (single source of truth across pages)
  if (Array.isArray(window.SAMELCO_MUNICIPALITIES) && window.SAMELCO_MUNICIPALITIES.length) {
    municipalities = window.SAMELCO_MUNICIPALITIES;
  }
  var _excludedMunicipalitySet = (function(){
    var arr = ['calbayog city','tarangnan','almagro','santo niño','santo niÃ±o','tagapul-an','santa margarita','gandara','pagsanghan','matuguinao','san jorge'];
    var o = {};
    arr.forEach(function(s){ o[s] = true; });
    return o;
  })();
  function isExcludedMunicipality(n) {
    if (!n) return false;
    var x = String(n).toLowerCase();
    return !!_excludedMunicipalitySet[x];
  }
  municipalities = municipalities.filter(function(m) {
    if (Number(m.lat) === 11.9833 && Number(m.lng) === 124.4667) return false;
    return !isExcludedMunicipality(m.name);
  });

  // Add all municipalities above to the right side panel
  var sidebarList = document.getElementById('municipalities-sidebar-list');
  if (sidebarList) {
    municipalities.forEach(function(m) {
      var item = document.createElement('div');
      item.className = 'sidebar-municipality-item';
      item.setAttribute('data-name', m.name || '');
      var barangayCount = Array.isArray(m.barangays) ? m.barangays.length : m.barangays;
      var header = document.createElement('div');
      header.innerHTML = '<h4>' + m.name + ' <span class="issue-badge new" style="display:none;"></span> <span class="issue-badge pending" style="display:none;"></span></h4><p>' + barangayCount + ' Barangays</p>';
      item.appendChild(header);
      var bList = document.createElement('div');
      bList.className = 'sidebar-barangays';
      bList.style.display = 'none';
      if (Array.isArray(m.barangays)) {
        m.barangays.forEach(function(b) {
          var bItem = document.createElement('div');
          bItem.className = 'barangay-item-sidebar';
          bItem.textContent = b;
          bList.appendChild(bItem);
        });
      }
      item.appendChild(bList);
      item.addEventListener('click', function() {
        bList.style.display = (bList.style.display === 'none') ? 'block' : 'none';
        if (window.map) window.map.setView([m.lat, m.lng], 11);
        var mk = municipalityMarkersIndex[(m.name || '').toLowerCase()];
        if (mk) mk.openPopup();
      });
      item.setAttribute('data-name', m.name);
      sidebarList.appendChild(item);
    });
  }

  // Initialize Map - Focused on Samar
  var map = L.map('map', {
    center: [11.7, 124.9],
    zoom: 10,
    minZoom: 9,
    maxZoom: 13,
    zoomControl: true,
    scrollWheelZoom: true,
    maxBounds: [[10.5, 124.0], [12.5, 125.5]]
  });

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: 'Â© OpenStreetMap contributors',
    maxZoom: 18
  }).addTo(map);

  var customIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div class="marker-pin"></div>',
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });

  // New Compliance (red)
  var newIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div class="marker-pin marker-pin-new"></div>',
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });

  // Pending (orange)
  var pendingIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div class="marker-pin marker-pin-pending"></div>',
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });

  var restoredIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div class="marker-pin marker-pin-restored"></div>',
    iconSize: [30, 42],
    iconAnchor: [15, 42]
  });

  var municipalityMarkersLayer = L.layerGroup().addTo(map);
  var reportMarkersLayer = L.layerGroup().addTo(map);
  var routeLayer = L.layerGroup().addTo(map);
  var municipalityMarkersIndex = {};
  var reportMarkersIndex = {};
  var reportMarkersById = {};
  var adminLocation = null;
  var adminMarker = null;
  var activeRouteLine = null;
  var _forceAlarmFromUrl = false;

  function setAdminLocation(lat, lng) {
    if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;
    adminLocation = { lat: Number(lat), lng: Number(lng) };
    if (adminMarker) {
      adminMarker.setLatLng([adminLocation.lat, adminLocation.lng]);
      return;
    }
    adminMarker = L.circleMarker([adminLocation.lat, adminLocation.lng], {
      radius: 7,
      color: '#0f172a',
      fillColor: '#2563eb',
      fillOpacity: 0.95,
      weight: 2
    }).addTo(routeLayer);
    adminMarker.bindPopup('<strong>Your Location</strong>');
  }

  function captureAdminLocationOnce() {
    return new Promise(function(resolve, reject) {
      if (adminLocation) {
        resolve(adminLocation);
        return;
      }
      if (!navigator.geolocation) {
        reject(new Error('Geolocation unavailable'));
        return;
      }
      navigator.geolocation.getCurrentPosition(function(pos) {
        setAdminLocation(pos.coords.latitude, pos.coords.longitude);
        resolve(adminLocation);
      }, function(err) {
        reject(err || new Error('Unable to get current location'));
      }, { enableHighAccuracy: true, timeout: 12000 });
    });
  }

  function clearRouteLine() {
    if (activeRouteLine && map) {
      map.removeLayer(activeRouteLine);
      activeRouteLine = null;
    }
  }

  function bindPopupAction(container, selector, handler) {
    if (!container) return;
    var els = container.querySelectorAll(selector);
    if (!els || !els.length) return;
    els.forEach(function(el) {
      if (!el || el._popupActionBound) return;
      el._popupActionBound = true;
      var fired = false;
      function stopOnly(ev) {
        if (!ev) return;
        if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
      }
      function runHandler(ev) {
        if (!ev) return;
        if (typeof ev.preventDefault === 'function') ev.preventDefault();
        if (typeof ev.stopPropagation === 'function') ev.stopPropagation();
        if (fired) return;
        fired = true;
        try { handler(ev); } finally { setTimeout(function(){ fired = false; }, 100); }
      }
      // Capture phase makes this reliable even when Leaflet/map handlers are active.
      el.addEventListener('click', runHandler, true);
      el.addEventListener('pointerup', runHandler, true);
      el.addEventListener('touchend', runHandler, true);
      el.addEventListener('mousedown', stopOnly, true);
      el.addEventListener('mouseup', stopOnly, true);
      el.addEventListener('touchstart', stopOnly, true);
      el.addEventListener('pointerdown', stopOnly, true);
    });
  }

  async function drawRouteFromAdminTo(destLat, destLng) {
    var dLat = Number(destLat);
    var dLng = Number(destLng);
    if (!Number.isFinite(dLat) || !Number.isFinite(dLng)) {
      alert('Destination coordinates are not available for this report.');
      return;
    }
    if (!adminLocation) {
      try {
        await captureAdminLocationOnce();
      } catch (_) {
        // Fallback: use current map center if geolocation is blocked.
        if (map && typeof map.getCenter === 'function') {
          var c = map.getCenter();
          if (c && Number.isFinite(Number(c.lat)) && Number.isFinite(Number(c.lng))) {
            setAdminLocation(Number(c.lat), Number(c.lng));
          }
        }
        if (!adminLocation) {
          alert('Unable to get your current location. Please allow location access.');
          return;
        }
      }
    }
    if (!adminLocation) return;

    clearRouteLine();
    var fallbackPoints = [[adminLocation.lat, adminLocation.lng], [dLat, dLng]];
    try {
      var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' +
        encodeURIComponent(String(adminLocation.lng) + ',' + String(adminLocation.lat) + ';' + String(dLng) + ',' + String(dLat)) +
        '?overview=full&geometries=geojson';
      var res = await fetch(osrmUrl, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) throw new Error('OSRM HTTP ' + res.status);
      var payload = await res.json();
      var coords = payload && payload.routes && payload.routes[0] && payload.routes[0].geometry && payload.routes[0].geometry.coordinates;
      if (!Array.isArray(coords) || !coords.length) throw new Error('Route geometry unavailable');
      var routePoints = coords.map(function(c) { return [Number(c[1]), Number(c[0])]; });
      activeRouteLine = L.polyline(routePoints, { color: '#2563eb', weight: 5, opacity: 0.9 }).addTo(map);
      map.fitBounds(activeRouteLine.getBounds(), { padding: [30, 30] });
      return;
    } catch (_) {
      activeRouteLine = L.polyline(fallbackPoints, { color: '#2563eb', weight: 4, opacity: 0.8, dashArray: '8,6' }).addTo(map);
      map.fitBounds(activeRouteLine.getBounds(), { padding: [30, 30] });
    }
  }

  // Deep-link target opening support
  var _pendingOpenTarget = null;
  function setPendingTargetFromUrl() {
    try {
      var sp = new URLSearchParams(window.location.search);
      _forceAlarmFromUrl = sp.get('alarm') === '1';
      var reportId = sp.get('report_id') || sp.get('reportId') || sp.get('id') || '';
      var rawLoc = sp.get('location') || '';
      var mName = sp.get('mun') || sp.get('municipality') || sp.get('m') || '';
      var bName = sp.get('brgy') || sp.get('barangay') || sp.get('b') || '';
      if (reportId) {
        _pendingOpenTarget = { reportId: String(reportId) };
        return;
      }
      if (!mName && rawLoc) {
        var found = findMunicipalityByLocationText(rawLoc);
        if (found) mName = found.name;
        // try to extract barangay token
        var pb = parseBarangayFromLocationText(rawLoc);
        if (pb) bName = pb;
      }
      if (!mName) return;
      var key = (mName || '').toLowerCase() + '|' + normalizeBarangayName(bName || '');
      _pendingOpenTarget = { key: key };
    } catch (e) {}
  }
  setPendingTargetFromUrl();
  captureAdminLocationOnce().catch(function(){});

  // Alerts setup
  var alertsEnabled = localStorage.getItem('alertsEnabled') === '1';
  var alarmEl = document.getElementById('alarm-audio');
  var alarmPerm = document.getElementById('alarm-permission');
  var enableAlertsBtn = document.getElementById('enable-alerts-btn');
  function initAlarmSource() {
    if (!alarmEl) return;
    var candidates = ['../assest/audio/alarm.mp3', '../assets/audio/alarm.mp3'];
    var i = 0;
    function tryNext() {
      if (i >= candidates.length) return;
      var src = candidates[i++];
      var onError = function() {
        alarmEl.removeEventListener('error', onError);
        tryNext();
      };
      alarmEl.addEventListener('error', onError, { once: true });
      alarmEl.src = src;
      try { alarmEl.load(); } catch (e) {}
    }
    tryNext();
  }
  initAlarmSource();
  if (enableAlertsBtn) {
    enableAlertsBtn.addEventListener('click', function() {
      alertsEnabled = true;
      localStorage.setItem('alertsEnabled', '1');
      if (alarmPerm) alarmPerm.style.display = 'none';
      // prime audio by a user gesture
      if (alarmEl && alarmEl.pause) {
        try { alarmEl.currentTime = 0; alarmEl.play().then(function(){ alarmEl.pause(); }); } catch(e){}
      }
    });
  }
  function showEnableBanner() {
    if (alarmPerm && !alertsEnabled) alarmPerm.style.display = 'flex';
  }
  function simpleBeep(times) {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var duration = 0.15;
      var t = ctx.currentTime;
      for (var i=0;i<(times||1);i++) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(880, t + i*0.25);
        g.gain.setValueAtTime(0.001, t + i*0.25);
        g.gain.exponentialRampToValueAtTime(0.3, t + i*0.25 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i*0.25 + duration);
        o.connect(g).connect(ctx.destination);
        o.start(t + i*0.25);
        o.stop(t + i*0.25 + duration);
      }
    } catch(e){}
  }
  var lastNewCount = -1;
  var alarmInitialized = false;
  function triggerAlarmIfActive(rows) {
    if (!Array.isArray(rows)) return;
    var counts = { new: 0, pending: 0 };
    rows.forEach(function(r){
      var n = r.name || 'Unknown';
      if (isResolvedRow(r)) return;
      var b = resolveBarangayForReport(r) || r.barangay || '';
      if (!isDbPendingRow(r) && isBarangayRestored(n, b)) return;
      var assignedTeam = getAssignedTeam(n);
      if (assignedTeam) counts.pending += 1;
      else if (isNewComplianceRow(r)) counts.new += 1;
      else counts.pending += 1;
    });
    var newCount = counts.new;
    if (!alarmInitialized) {
      alarmInitialized = true;
      lastNewCount = newCount;
      return;
    }
    if (newCount <= lastNewCount) {
      lastNewCount = newCount; // update downward silently
      return;
    }
    lastNewCount = newCount;
    if (!alertsEnabled) { showEnableBanner(); return; }
    var played = false;
    if (alarmEl && typeof alarmEl.play === 'function') {
      try {
        alarmEl.currentTime = 0;
        alarmEl.play();
        played = true;
      } catch (e) {
        played = false;
      }
    }
    if (!played) {
      simpleBeep(3);
      showEnableBanner();
    }
  }
  function playAlarmNowFromLink() {
    var played = false;
    if (alarmEl && typeof alarmEl.play === 'function') {
      try {
        alarmEl.currentTime = 0;
        alarmEl.play();
        played = true;
      } catch (e) {
        played = false;
      }
    }
    if (!played) {
      simpleBeep(3);
      showEnableBanner();
    }
  }

  // Deprecated municipality-wide restore state. Kept only for backward compatibility.
  var restoredLocations = [];
  var pendingAssignments = {};
  try {
    var storedPA = localStorage.getItem('pendingAssignments');
    if (storedPA) pendingAssignments = JSON.parse(storedPA) || {};
  } catch (e) {}
  function getAssignedTeam(name) {
    return pendingAssignments[(name || '').toLowerCase()] || '';
  }
  function normalizeAssignedTeam(team) {
    return String(team || '').trim();
  }
  function setAssignedTeam(name, team) {
    if (!name) return;
    var normalizedTeam = normalizeAssignedTeam(team);
    var key = (name || '').toLowerCase();
    if (normalizedTeam) pendingAssignments[key] = normalizedTeam; else delete pendingAssignments[key];
    localStorage.setItem('pendingAssignments', JSON.stringify(pendingAssignments));
    try {
      var who = localStorage.getItem('userName') || 'User';
      var arr = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      arr.push({ ts: new Date().toISOString(), who: who, type: 'assign', data: { municipality: name, team: normalizedTeam }, summary: 'Assigned ' + (normalizedTeam||'') + ' to ' + (name||'') });
      if (arr.length > 500) arr = arr.slice(arr.length - 500);
      localStorage.setItem('auditLogs', JSON.stringify(arr));
    } catch(e){}
  }
  var restoredBarangays = {};
  try {
    var storedRB = localStorage.getItem('restoredBarangays');
    if (storedRB) {
      restoredBarangays = JSON.parse(storedRB) || {};
    }
  } catch (e) {}
  function isBarangayRestored(mName, bName) {
    if (!mName || !bName) return false;
    var bucket = restoredBarangays[mName] || {};
    return !!bucket[normalizeBarangayName(bName)];
  }
  function markBarangayRestored(mName, bName) {
    if (!mName || !bName) return;
    var norm = normalizeBarangayName(bName);
    if (!restoredBarangays[mName]) restoredBarangays[mName] = {};
    restoredBarangays[mName][norm] = true;
    localStorage.setItem('restoredBarangays', JSON.stringify(restoredBarangays));
    try {
      var who = localStorage.getItem('userName') || 'User';
      var arr = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      arr.push({ ts: new Date().toISOString(), who: who, type: 'restore_barangay', data: { municipality: mName, barangay: bName }, summary: 'Marked ' + mName + ' – ' + bName + ' as Restored' });
      if (arr.length > 500) arr = arr.slice(arr.length - 500);
      localStorage.setItem('auditLogs', JSON.stringify(arr));
    } catch(e){}
  }
  var hiddenPins = {};
  try {
    var hp = localStorage.getItem('hiddenPins');
    if (hp) hiddenPins = JSON.parse(hp) || {};
  } catch(e){}
  function getPinKey(mName, bName) {
    return (String(mName||'').toLowerCase() + '|' + normalizeBarangayName(bName||''));
  }
  function getReportPinKey(reportId) {
    return 'id:' + String(reportId || '');
  }
  function isPinHidden(mName, bName, reportId) {
    if (reportId != null && String(reportId || '') !== '') {
      return !!hiddenPins[getReportPinKey(reportId)];
    }
    return !!hiddenPins[getPinKey(mName, bName)];
  }
  function hidePin(mName, bName, reportId) {
    var key = (reportId != null && String(reportId || '') !== '')
      ? getReportPinKey(reportId)
      : getPinKey(mName, bName);
    hiddenPins[key] = true;
    localStorage.setItem('hiddenPins', JSON.stringify(hiddenPins));
    try {
      var who = localStorage.getItem('userName') || 'User';
      var arr = JSON.parse(localStorage.getItem('auditLogs') || '[]');
      arr.push({ ts: new Date().toISOString(), who: who, type: 'hide_pin', data: { municipality: mName, barangay: bName }, summary: 'Hid pin ' + mName + ' – ' + bName });
      if (arr.length > 500) arr = arr.slice(arr.length - 500);
      localStorage.setItem('auditLogs', JSON.stringify(arr));
    } catch(e){}
  }

  function isNew(createdAt) {
    if (!createdAt) return false;
    var t = Date.parse(createdAt);
    if (isNaN(t)) return false;
    var THRESHOLD_HOURS = 24;
    return (Date.now() - t) <= THRESHOLD_HOURS * 3600 * 1000;
  }
  var newestUnresolvedId = '';
  function refreshNewestUnresolvedFlag(rows) {
    newestUnresolvedId = '';
    if (!Array.isArray(rows)) return;
    var newestTs = -Infinity;
    rows.forEach(function(r) {
      if (!r || isResolvedRow(r)) return;
      var mName = r.name || '';
      var b = resolveBarangayForReport(r) || r.barangay || '';
      if (isPinHidden(mName, b, r.id)) return;
      if (!isDbPendingRow(r) && isBarangayRestored(mName, b)) return;
      var t = Date.parse(r.createdAt || '');
      if (!isFinite(t)) t = -Infinity;
      var rid = String(r.id || '');
      var curId = String(newestUnresolvedId || '');
      if (t > newestTs || (t === newestTs && rid > curId)) {
        newestTs = t;
        newestUnresolvedId = rid;
      }
    });
    rows.forEach(function(r) {
      r._isNewestUnresolved = String(r.id || '') === String(newestUnresolvedId || '');
    });
  }
  function isNewComplianceRow(r) {
    if (!r || isResolvedRow(r)) return false;
    return !getAssignedTeam(r.name || '');
  }
  function isUrgentRow(r) {
    if (!r) return false;
    if (r.isUrgent === true || r.is_urgent === true) return true;
    var raw = r.isUrgent;
    if (raw == null) raw = r.is_urgent;
    if (raw != null) {
      var v = String(raw).toLowerCase();
      if (v === 'true' || v === '1' || v === 'yes') return true;
    }
    return String((r && r.status) || '').toLowerCase() === 'urgent';
  }
  function isResolvedRow(r) {
    return getStatusKey(r) === 'resolved';
  }
  function isOnTheWayRow(r) {
    return getStatusKey(r) === 'ontheway';
  }
  function isDbPendingRow(r) {
    return getStatusKey(r) === 'pending';
  }
  function getStatusKey(r) {
    var s = String((r && r.status) || 'pending').toLowerCase();
    if (s === 'resolved') return 'resolved';
    if (s === 'ontheway' || s === 'on the way' || s === 'on_the_way') return 'ontheway';
    return 'pending';
  }
  function isOverdueRow(r) {
    if (!r || !r.createdAt) return false;
    if (isResolvedRow(r)) return false;
    var t = Date.parse(r.createdAt);
    if (isNaN(t)) return false;
    var older = (Date.now() - t) > 24 * 3600 * 1000;
    if (!older) return false;
    var b = resolveBarangayForReport(r) || r.barangay || '';
    if (!isDbPendingRow(r) && isBarangayRestored(r.name || '', b)) return false;
    var assignedTeam = getAssignedTeam(r.name || '');
    return !assignedTeam;
  }

  function renderMunicipalityMarkers(locations) {
    refreshNewestUnresolvedFlag(locations);
    municipalityMarkersLayer.clearLayers();
    municipalities.forEach(function(m) {
      var muniReports = locations.filter(function(p) { return p.name === m.name; });
      // exclude barangays marked as restored
      var visibleReports = muniReports.filter(function(r) {
        var b = resolveBarangayForReport(r) || r.barangay || '';
        if (isPinHidden(m.name, b, r.id)) return false;
        if (!isDbPendingRow(r) && !isResolvedRow(r) && isBarangayRestored(m.name, b)) return false;
        return true;
      });
      var unresolvedReports = visibleReports.filter(function(r){ return !isResolvedRow(r); });
      var hasProblem = unresolvedReports.length > 0;
      var isParanas = /paranas/i.test(m.name);
      var hasOnTheWay = unresolvedReports.some(function(r){ return isOnTheWayRow(r); });
      var isRestored = !hasProblem && visibleReports.length > 0;
      var icon;
      if (hasProblem) {
        if (isParanas) icon = restoredIcon;
        else if (isRestored) icon = restoredIcon;
        else if (hasOnTheWay) icon = pendingIcon;
        else icon = newIcon;
      } else {
        icon = (isParanas || isRestored) ? restoredIcon : customIcon;
      }
      var marker = L.marker([m.lat, m.lng], { icon: icon }).addTo(municipalityMarkersLayer);
      municipalityMarkersIndex[(m.name || '').toLowerCase()] = marker;
      if (hasProblem) {
        var problem = unresolvedReports[0] || {};
        var problemStatus = getStatusKey(problem);
        var statusText = isRestored ? 'Resolved' : (problemStatus === 'ontheway' ? 'On The Way' : 'Pending');
        var statusColor = isRestored ? 'green' : (problemStatus === 'ontheway' ? '#f97316' : '#dc2626');
        var slaBadge = '';
        try {
          var anyOverdue = visibleReports.some(function(rr){ return isOverdueRow(rr); });
          if (anyOverdue && !isRestored) {
            slaBadge = ' <span style="display:inline-block; margin-left:6px; background:#b91c1c; color:#fff; padding:2px 6px; border-radius:10px;">>24h Overdue</span>';
          }
        } catch(e){}
        var statusLine = '<div class="map-popup-status" style="color:' + statusColor + ';">Status: ' + statusText + '</div>' + (slaBadge ? ('<div class="map-popup-note">' + slaBadge + '</div>') : '');
        var teamSel = canManage() ? '<label class="map-popup-label">Team: <select class="team-select map-popup-select"><option value="">Select team</option><option>Line Crew A</option><option>Line Crew B</option><option>Maintenance</option><option>Inspection</option></select></label>' : '';
        var assigned = getAssignedTeam(m.name);
        var manageAssign = canManage() && !isRestored ? '<button type="button" class="pending-assign map-popup-btn map-popup-btn-warning">Set Pending</button>' : '';
        var problemLocation = getReportLocationText(problem);
        var routeHref = buildRouteHref(problem);
        var routeLine = (isOnTheWayRow(problem) && !isRestored)
          ? ('<button type="button" class="show-route-map map-popup-btn map-popup-btn-primary">Show Route on Map</button>' +
            (routeHref ? '<a href="' + routeHref + '" target="_blank" rel="noopener noreferrer" class="map-popup-btn map-popup-btn-ghost open-route">Open in Google Maps</a>' : ''))
          : '';
        var resolveRowClass = isRestored ? 'map-popup-btn-warning' : 'map-popup-btn-success';
        var resolveRow = canManage() ? ('<button type="button" class="resolve-toggle-row map-popup-btn ' + resolveRowClass + '">' + (isRestored ? 'Mark as Pending' : 'Mark as Resolved') + '</button>') : '';
        var hideRow = canManage() ? '<button type="button" class="hide-pin map-popup-btn map-popup-btn-danger">Hide this pin</button>' : '';
        marker.bindPopup(
          '<div class="map-popup">' +
            '<div class="map-popup-title">' + m.name + '</div>' +
            '<div class="map-popup-sub">' + (problem.barangay || 'Location not set') + '</div>' +
            '<div class="map-popup-issue">' + (problem.issue || 'Reported issue') + '</div>' +
            statusLine +
            (problemLocation ? ('<div class="map-popup-meta">Location: ' + problemLocation + '</div>') : '') +
            (assigned ? '<div class="map-popup-meta">Assigned: ' + assigned + '</div>' : '') +
            (isRestored ? '' : (teamSel + manageAssign)) +
            resolveRow +
            '<div class="map-popup-actions">' + routeLine + '<button type="button" class="view-records map-popup-btn map-popup-btn-primary">View in Records</button>' + hideRow + '</div>' +
          '</div>'
        );
      marker.on('popupopen', function(e) {
        var container = e.popup.getElement();
        if (container && typeof L !== 'undefined' && L.DomEvent) {
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
        }
        var teamSelectEl = container.querySelector('.team-select');
        var list = document.getElementById('municipalities-sidebar-list');
        if (list) {
          var it = list.querySelector('.sidebar-municipality-item[data-name="' + m.name + '"]');
          if (it) {
            // Do not auto-open barangays; only scroll to municipality header
            it.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
        }
        if (teamSelectEl) {
          var assignedTeam = getAssignedTeam(m.name);
          if (assignedTeam) teamSelectEl.value = assignedTeam;
        }
        if (container && container.getAttribute('data-popup-actions-bound') !== '1') {
          container.setAttribute('data-popup-actions-bound', '1');
          var lastFireTs = 0;
          var onAction = async function(ev) {
            var tgt = ev && ev.target && ev.target.closest ? ev.target.closest('button, a') : null;
            if (!tgt || !container.contains(tgt)) return;
            if (!tgt.classList.contains('pending-assign') &&
                !tgt.classList.contains('show-route-map') &&
                !tgt.classList.contains('resolve-toggle-row') &&
                !tgt.classList.contains('hide-pin') &&
                !tgt.classList.contains('view-records')) {
              return;
            }
            var nowTs = Date.now();
            if (nowTs - lastFireTs < 120) return;
            lastFireTs = nowTs;
            ev.preventDefault();
            ev.stopPropagation();

            if (tgt.classList.contains('pending-assign')) {
              if (!canManage() || !teamSelectEl) return;
              var t = teamSelectEl.value || '';
              if (!t) {
                t = 'Line Crew A';
                teamSelectEl.value = t;
              }
              setAssignedTeam(m.name, t);
              if (problem && problem.id) {
                try { await setReportStatusById(problem.id, 'ontheway'); } catch (err) {
                  console.error(err);
                  alert(buildStatusUpdateErrorMessage(err));
                  return;
                }
              }
              clearRouteLine();
              drawRouteFromAdminTo(Number(problem.latitude || m.lat), Number(problem.longitude || m.lng));
              if (window._dashboardLocations) {
                renderMunicipalityMarkers(window._dashboardLocations);
                renderReportMarkers(window._dashboardLocations);
                updateSidebarBadges(window._dashboardLocations);
                updateBarangayHighlights(window._dashboardLocations);
                rebuildActiveNotifications(window._dashboardLocations);
              }
              return;
            }
            if (tgt.classList.contains('show-route-map')) {
              drawRouteFromAdminTo(Number(problem.latitude || m.lat), Number(problem.longitude || m.lng));
              return;
            }
            if (tgt.classList.contains('resolve-toggle-row')) {
              if (!canManage() || !problem || !problem.id) return;
              try {
                var nextStatus = isResolvedRow(problem) ? 'pending' : 'resolved';
                await setReportStatusById(problem.id, nextStatus);
                if (String(nextStatus).toLowerCase() === 'resolved') clearRouteLine();
                loadReportsFromSupabase();
              } catch (err) {
                console.error(err);
                alert(buildStatusUpdateErrorMessage(err));
              }
              return;
            }
            if (tgt.classList.contains('hide-pin')) {
              if (!canManage()) return;
              hidePin(m.name || '', problem.barangay || '', problem.id || '');
              if (window._dashboardLocations) {
                renderMunicipalityMarkers(window._dashboardLocations);
                renderReportMarkers(window._dashboardLocations);
                updateSidebarBadges(window._dashboardLocations);
                updateBarangayHighlights(window._dashboardLocations);
                applyIssuesFilter();
                rebuildActiveNotifications(window._dashboardLocations);
              }
              return;
            }
            if (tgt.classList.contains('view-records')) {
              var params = new URLSearchParams();
              params.set('location', m.name + (problem.barangay ? ' ' + problem.barangay : ''));
              params.set('issue', problem.issue || '');
              window.location.href = 'records.html?' + params.toString();
            }
          };
          container.addEventListener('click', onAction, true);
          container.addEventListener('pointerup', onAction, true);
          container.addEventListener('touchend', onAction, true);
        }
      });
      }
    });
  }

  function normalizeMunicipalityKey(name) {
    if (!name) return '';
    var x = String(name).toLowerCase();
    x = x.replace(/\(wright\)/g, '');
    x = x.replace(/\bcity\b/g, '');
    x = x.replace(/\s+/g, ' ').trim();
    return x;
  }
  function getMunicipalityByName(name) {
    if (!name) return null;
    var key = normalizeMunicipalityKey(name);
    if (!key) return null;
    return municipalities.find(function(m){
      return normalizeMunicipalityKey(m.name) === key;
    }) || null;
  }
  function findMunicipalityByLocationText(locationText) {
    if (!locationText) return null;
    var text = String(locationText);
    var parts = text.split(',').map(function(p){ return p.trim(); }).filter(Boolean);
    // Prefer the trailing address parts, where municipality usually appears.
    for (var i = parts.length - 1; i >= 0; i--) {
      var token = parts[i];
      var tokenKey = normalizeMunicipalityKey(token);
      if (!tokenKey) continue;
      var exact = municipalities.find(function(m){
        return normalizeMunicipalityKey(m.name) === tokenKey;
      });
      if (exact) return exact;
      var near = municipalities.find(function(m){
        var mKey = normalizeMunicipalityKey(m.name);
        return tokenKey.indexOf(mKey) !== -1 || mKey.indexOf(tokenKey) !== -1;
      });
      if (near) return near;
    }
    var lower = text.toLowerCase();
    var ranked = municipalities.slice().sort(function(a, b){
      return String(b.name || '').length - String(a.name || '').length;
    });
    var found = ranked.find(function(m) {
      var full = String(m.name || '').toLowerCase();
      var core = normalizeMunicipalityKey(m.name);
      return lower.indexOf(full) !== -1 || (core && lower.indexOf(core) !== -1);
    });
    return found || null;
  }
  function distanceKm(aLat, aLng, bLat, bLng) {
    function toRad(x){ return x * Math.PI / 180; }
    var R = 6371;
    var dLat = toRad(bLat - aLat);
    var dLon = toRad(bLng - aLng);
    var lat1 = toRad(aLat);
    var lat2 = toRad(bLat);
    var a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.sin(dLon/2)*Math.sin(dLon/2)*Math.cos(lat1)*Math.cos(lat2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  function parseBarangayFromLocationText(txt) {
    if (!txt) return '';
    var s = String(txt);
    var direct = s.match(/(?:Brgy\.?|Barangay)\s*[^,]+/i);
    if (direct && direct[0]) return direct[0].trim();
    var parts = s.split(',').map(function(p){ return p.trim(); });
    var hit = parts.find(function(p){ return /^(?:Brgy\.?|Barangay)\b/i.test(p); });
    if (hit) return hit;
    // fallback: look for token ending with 'Poblacion' or similar
    hit = parts.find(function(p){ return /\bPoblacion\b/i.test(p); });
    return hit || '';
  }

  function getReportLocationText(r) {
    if (!r) return '';
    var txt = String(r.location_text || r.location || r.address || '').trim();
    if (txt) return txt;
    var parts = [];
    if (r.barangay) parts.push(r.barangay);
    if (r.name) parts.push(r.name);
    return parts.join(', ');
  }

  function buildRouteHref(rLike) {
    if (!rLike) return '';
    var lat = Number(rLike.latitude);
    var lng = Number(rLike.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(String(lat) + ',' + String(lng)) + '&travelmode=driving';
    }
    var q = getReportLocationText(rLike);
    if (!q) return '';
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  function normalizeReportRow(row) {
    var locationText = row.location_text || row.location || row.address || '';
    var namedMunicipality = getMunicipalityByName(row.municipality || '');
    var matchedMunicipality = (namedMunicipality && namedMunicipality.name) || (findMunicipalityByLocationText(locationText) || {}).name || row.municipality || 'Unknown';
    var barangayField = row.barangay || parseBarangayFromLocationText(locationText) || '';
    var idVal = row.id || row.report_id || row._id || '';
    var uid = String(idVal || (String(row.created_at || row.createdAt || '') + '|' + matchedMunicipality + '|' + (barangayField || '') + '|' + (row.issue_type || row.issue || '')));
    return {
      id: uid,
      name: matchedMunicipality,
      issue: row.issue_type || row.issue || row.problem_type || 'Reported issue',
      barangay: barangayField || 'Not specified',
      location_text: locationText,
      fullName: row.full_name || row.name || 'Unknown reporter',
      contact: row.contact || row.phone || '',
      description: row.description || '',
      latitude: Number(row.latitude || row.lat || NaN),
      longitude: Number(row.longitude || row.lng || row.long || NaN),
      queueNumber: Number(row.queue_number || row.queueNumber || NaN),
      createdAt: row.created_at || row.createdAt || row.created || '',
      status: row.status || 'pending',
      isUrgent: isUrgentRow(row)
    };
  }

  // Notifications
  var notifBtn = document.getElementById('notif-btn');
  var notifDropdown = document.getElementById('notif-dropdown');
  var notifBadge = document.getElementById('notif-badge');
  var notifList = document.getElementById('notif-list');
  var notifEmpty = document.getElementById('notif-empty');
  var notifBranchSel = document.getElementById('notif-branch-filter');
  var notifMuniSel = document.getElementById('notif-muni-filter');
  var notifBranchPills = document.getElementById('notif-branch-pills');
  // populate municipalities into notif muni filter
  if (notifMuniSel && Array.isArray(municipalities)) {
    var existing = Array.from(notifMuniSel.options).map(function(o){ return o.value; });
    municipalities.forEach(function(m){
      if (!m || existing.includes(m.name)) return;
      var opt = document.createElement('option');
      opt.value = m.name;
      opt.textContent = m.name;
      notifMuniSel.appendChild(opt);
    });
  }
  // branch inference
  var BRANCH_NAMES = ['Paranas', 'Catbalogan', 'Villareal', 'Basey'];
  var BRANCH_CENTERS = {};
  BRANCH_CENTERS['Paranas'] = getMunicipalityByName('Paranas (Wright)') || getMunicipalityByName('Paranas');
  BRANCH_CENTERS['Catbalogan'] = getMunicipalityByName('Catbalogan City') || getMunicipalityByName('Catbalogan');
  BRANCH_CENTERS['Villareal'] = getMunicipalityByName('Villareal');
  BRANCH_CENTERS['Basey'] = getMunicipalityByName('Basey');
  function distanceApprox(a, b) {
    var Rlat = (a.lat - b.lat), Rlng = (a.lng - b.lng) * Math.cos(a.lat * Math.PI/180);
    return Math.sqrt(Rlat*Rlat + Rlng*Rlng);
  }
  function inferBranch(muniName) {
    var muni = getMunicipalityByName(muniName) || findMunicipalityByLocationText(muniName);
    if (!muni) return 'Others';
    var best = 'Others', bestD = Infinity;
    BRANCH_NAMES.forEach(function(bn){
      var c = BRANCH_CENTERS[bn];
      if (c && typeof c.lat === 'number' && typeof c.lng === 'number') {
        var d = distanceApprox(muni, c);
        if (d < bestD) { bestD = d; best = bn; }
      }
    });
    return best;
  }
  // persist filters
  var savedBranch = localStorage.getItem('notifBranchFilter') || '';
  var savedMuni = localStorage.getItem('notifMuniFilter') || '';
  if (notifBranchSel) notifBranchSel.value = savedBranch;
  if (notifMuniSel) notifMuniSel.value = savedMuni;
  if (notifBranchSel) notifBranchSel.addEventListener('change', function(){
    localStorage.setItem('notifBranchFilter', this.value || '');
    // re-render using last cache if available
    if (window._lastNewRows) updateNotifications(window._lastNewRows);
  });
  if (notifMuniSel) notifMuniSel.addEventListener('change', function(){
    localStorage.setItem('notifMuniFilter', this.value || '');
    if (window._lastNewRows) updateNotifications(window._lastNewRows);
  });
  if (notifBranchPills) {
    notifBranchPills.addEventListener('click', function(e){
      var btn = e.target.closest('.pill');
      if (!btn) return;
      var val = btn.getAttribute('data-branch') || '';
      if (notifBranchSel) notifBranchSel.value = val;
      localStorage.setItem('notifBranchFilter', val);
      Array.from(notifBranchPills.querySelectorAll('.pill')).forEach(function(p){ p.classList.remove('is-active'); });
      btn.classList.add('is-active');
      if (window._lastNewRows) updateNotifications(window._lastNewRows);
    });
    // initialize active state
    var initBtn = notifBranchPills.querySelector('.pill[data-branch="' + (savedBranch || '') + '"]') || notifBranchPills.querySelector('.pill[data-branch=""]');
    if (initBtn) {
      Array.from(notifBranchPills.querySelectorAll('.pill')).forEach(function(p){ p.classList.remove('is-active'); });
      initBtn.classList.add('is-active');
    }
  }
  function toggleNotif(open) {
    if (!notifDropdown || !notifBtn) return;
    var isOpen = typeof open === 'boolean' ? open : !notifDropdown.classList.contains('is-open');
    notifDropdown.classList.toggle('is-open', isOpen);
    notifBtn.setAttribute('aria-expanded', String(isOpen));
  }
  if (notifBtn) {
    notifBtn.addEventListener('click', function(e){ e.stopPropagation(); toggleNotif(); });
    document.addEventListener('click', function(){ toggleNotif(false); });
  }
  function getActiveNotifIds() {
    try {
      var raw = localStorage.getItem('activeNotifIds');
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) { return []; }
  }
  function setActiveNotifIds(ids) {
    try { localStorage.setItem('activeNotifIds', JSON.stringify(Array.from(new Set(ids)).slice(-2000))); } catch(e){}
  }
  function rebuildActiveNotifications(rows) {
    if (!Array.isArray(rows)) rows = [];
    var eligible = rows.filter(function(r){
      var n = r.name || 'Unknown';
      if (isResolvedRow(r)) return false;
      var b = resolveBarangayForReport(r) || r.barangay || '';
      if (!isDbPendingRow(r) && isBarangayRestored(n, b)) return false;
      if (isPinHidden(n, b, r.id)) return false;
      return isNewComplianceRow(r);
    });
    var idToRow = {};
    eligible.forEach(function(r){ idToRow[String(r.id)] = r; });
    var ids = getActiveNotifIds();
    var next = [];
    // keep existing ids that are still eligible
    ids.forEach(function(id){ if (idToRow[String(id)]) next.push(String(id)); });
    // add any new eligible ids
    eligible.forEach(function(r){ var id = String(r.id); if (next.indexOf(id) === -1) next.push(id); });
    setActiveNotifIds(next);
    var activeRows = next.map(function(id){ return idToRow[id]; }).filter(Boolean);
    updateNotifications(activeRows);
  }
  function formatTimeAgo(ts) {
    var t = new Date(ts).getTime();
    if (!isFinite(t)) return '';
    var d = Math.max(0, Date.now() - t);
    var mins = Math.floor(d/60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.floor(mins/60);
    if (hrs < 24) return hrs + 'h ago';
    var days = Math.floor(hrs/24);
    return days + 'd ago';
  }
  function updateNotifications(newRows) {
    if (!notifList || !notifBadge || !notifEmpty) return;
    window._lastNewRows = Array.isArray(newRows) ? newRows.slice() : [];
    // compute counts for branch pills
    if (notifBranchPills) {
      var branchCounts = { 'Paranas':0, 'Catbalogan':0, 'Villareal':0, 'Basey':0 };
      window._lastNewRows.forEach(function(r){
        var b = inferBranch(r.name);
        if (branchCounts.hasOwnProperty(b)) branchCounts[b] += 1;
      });
      var total = window._lastNewRows.length;
      var mapText = function(name){ return name + ' (' + (branchCounts[name]||0) + ')'; };
      var allBtn = notifBranchPills.querySelector('.pill[data-branch=""]');
      if (allBtn) allBtn.textContent = 'All (' + total + ')';
      ['Paranas','Catbalogan','Villareal','Basey'].forEach(function(bn){
        var btn = notifBranchPills.querySelector('.pill[data-branch="' + bn + '"]');
        if (btn) btn.textContent = mapText(bn);
      });
    }
    var branchFilter = (notifBranchSel && notifBranchSel.value) ? String(notifBranchSel.value) : '';
    var muniFilter = (notifMuniSel && notifMuniSel.value) ? String(notifMuniSel.value) : '';
    var items = window._lastNewRows.filter(function(r){
      var pass = true;
      if (branchFilter) {
        pass = pass && (inferBranch(r.name) === branchFilter);
      }
      if (muniFilter) {
        pass = pass && (r.name === muniFilter);
      }
      return pass;
    }).slice().reverse();
    notifList.innerHTML = '';
    if (!items.length) {
      notifEmpty.innerHTML = '<div class="empty-card"><div class="empty-emoji">🎉</div><div class="empty-title">No new reports</div><div class="empty-sub">You’re all caught up. Enjoy the calm.</div></div>';
      notifEmpty.style.display = 'block';
      if (notifBadge) notifBadge.style.display = 'none';
      return;
    }
    notifEmpty.style.display = 'none';
    var sumEl = document.getElementById('notif-summary');
    if (sumEl) {
      var total = window._lastNewRows.length;
      var txt = (items.length === total) ? (items.length + ' new') : (items.length + ' of ' + total + ' new');
      sumEl.textContent = txt;
    }
    items.slice(0, 30).forEach(function(r){
      var brgy = resolveBarangayForReport(r) || r.barangay || '';
      var time = formatTimeAgo(r.createdAt);
      var br = inferBranch(r.name);
      var div = document.createElement('div');
      div.className = 'notif-item';
      var brCls = 'branch-' + String(br || 'others').toLowerCase();
      div.classList.add(brCls);
      var leftCol = document.createElement('div');
      leftCol.className = 'notif-left';
      var title = document.createElement('div');
      title.className = 'notif-item-title';
      var dot = document.createElement('span');
      dot.className = 'notif-dot';
      title.appendChild(dot);
      var titleText = document.createTextNode(r.name + ' · ' + brgy);
      title.appendChild(titleText);
      var mini = document.createElement('span');
      mini.className = 'notif-branch-mini';
      mini.textContent = br;
      title.appendChild(mini);
      var issuePill = document.createElement('span');
      issuePill.className = 'notif-issue-pill';
      issuePill.textContent = r.issue;
      var sub = document.createElement('div');
      sub.className = 'notif-item-sub';
      sub.textContent = 'Reporter: ' + r.fullName;
      leftCol.appendChild(title);
      leftCol.appendChild(issuePill);
      leftCol.appendChild(sub);
      var rightCol = document.createElement('div');
      rightCol.className = 'notif-right';
      var timeEl = document.createElement('div');
      timeEl.className = 'notif-item-time';
      timeEl.textContent = time;
      var qBadge = document.createElement('span');
      qBadge.className = 'notif-queue-badge';
      var qVal = Number.isFinite(Number(r.queueNumber)) && Number(r.queueNumber) > 0
        ? Number(r.queueNumber)
        : ((window._queueOrderById && window._queueOrderById[r.id]) ? window._queueOrderById[r.id] : null);
      if (qVal) qBadge.textContent = String(qVal);
      var viewBtn = document.createElement('button');
      viewBtn.type = 'button';
      viewBtn.className = 'notif-view-btn';
      viewBtn.textContent = 'View';
      viewBtn.addEventListener('click', function(ev){
        ev.preventDefault();
        var mk = reportMarkersById[String(r.id)];
        if (!mk) {
          var key = (r.name || '').toLowerCase() + '|' + normalizeBarangayName(brgy);
          mk = reportMarkersIndex[key];
        }
        if (window.map) {
          if (mk) {
            var ll = mk.getLatLng();
            window.map.setView(ll, 13);
            mk.openPopup();
            // keep notifications persistent and keep panel open
          } else {
            var muni = municipalities.find(function(mm){ return (mm.name||'').toLowerCase() === (r.name||'').toLowerCase(); });
            if (muni && Number.isFinite(Number(muni.lat)) && Number.isFinite(Number(muni.lng))) {
              var baseLat = Number(muni.lat), baseLng = Number(muni.lng);
              window.map.setView([baseLat, baseLng], 12);
              // keep notifications persistent and keep panel open
            }
          }
        }
      });
      rightCol.appendChild(qBadge);
      if (isOverdueRow(r)) {
        var sla = document.createElement('span');
        sla.className = 'notif-sla-badge';
        sla.textContent = '>24h';
        rightCol.appendChild(sla);
      }
      rightCol.appendChild(timeEl);
      rightCol.appendChild(viewBtn);
      div.appendChild(leftCol);
      div.appendChild(rightCol);
      div.addEventListener('click', function(ev){
        ev.preventDefault();
        var mk = reportMarkersById[String(r.id)];
        if (!mk) {
          var key = (r.name || '').toLowerCase() + '|' + normalizeBarangayName(brgy);
          mk = reportMarkersIndex[key];
        }
        if (window.map) {
          if (mk) {
            var ll = mk.getLatLng();
            window.map.setView(ll, 13);
            mk.openPopup();
          } else {
            var muni = municipalities.find(function(mm){ return (mm.name||'').toLowerCase() === (r.name||'').toLowerCase(); });
            if (muni && Number.isFinite(Number(muni.lat)) && Number.isFinite(Number(muni.lng))) {
              var baseLat = Number(muni.lat), baseLng = Number(muni.lng);
              window.map.setView([baseLat, baseLng], 12);
            }
          }
        }
      });
      notifList.appendChild(div);
    });
    var totalForBadge = window._lastNewRows ? window._lastNewRows.length : items.length;
    notifBadge.textContent = String(totalForBadge);
    notifBadge.style.display = totalForBadge > 0 ? 'inline-flex' : 'none';
  }

  function renderReportMarkers(rows) {
    refreshNewestUnresolvedFlag(rows);
    reportMarkersLayer.clearLayers();
    reportMarkersIndex = {};
    reportMarkersById = {};
    rows.forEach(function(r) {
      var rb = resolveBarangayForReport(r) || r.barangay || '';
      if (isPinHidden(r.name || '', rb, r.id)) return;
      var isParanasRow = /paranas/i.test(r.name || '');
      var muniExact = municipalities.find(function(mm){ return (mm.name||'').toLowerCase() === (r.name||'').toLowerCase(); });
      if (!isParanasRow && muniExact && /paranas/i.test(muniExact.name)) isParanasRow = true;
      var rb = rb;
      if (!isDbPendingRow(r) && !isResolvedRow(r) && isBarangayRestored(r.name || '', rb)) return;
      var lat = Number(r.latitude);
      var lng = Number(r.longitude);
      // Fallback: if no precise GPS, place near municipality center with deterministic offset per barangay
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        var muni = municipalities.find(function(mm){ return (mm.name||'').toLowerCase() === (r.name||'').toLowerCase(); });
        if (!muni) return; // cannot place without a municipality center
        var baseLat = Number(muni.lat), baseLng = Number(muni.lng);
        if (!Number.isFinite(baseLat) || !Number.isFinite(baseLng)) return;
        var key = (r.barangay || r.name || 'x') + '|' + (r.createdAt || '');
        var h = 0;
        for (var i=0;i<key.length;i++){ h = (h*31 + key.charCodeAt(i)) >>> 0; }
        var angle = (h % 360) * (Math.PI/180);
        var ring = (h % 3) + 1; // 1..3 rings
        var radiusDeg = 0.005 * ring; // ~0.5km, 1km, 1.5km (approx)
        // simple equirectangular offset
        lat = baseLat + radiusDeg * Math.cos(angle);
        lng = baseLng + (radiusDeg * Math.sin(angle)) / Math.cos(baseLat * Math.PI/180);
      }
      var isRestored = isResolvedRow(r);
      var statusKey = getStatusKey(r);
      var assignedTeam = getAssignedTeam(r.name);
      var iconForRow = isRestored ? restoredIcon : (statusKey === 'ontheway' ? pendingIcon : newIcon);
      if (isParanasRow) iconForRow = restoredIcon;
      var marker = L.marker([lat, lng], { icon: iconForRow }).addTo(reportMarkersLayer);
      var idxKey = (r.name || '').toLowerCase() + '|' + normalizeBarangayName(rb);
      reportMarkersIndex[idxKey] = marker;
      reportMarkersById[String(r.id)] = marker;
      // determine restored status for this municipality name
      var statusText = isRestored ? 'Resolved' : (statusKey === 'ontheway' ? 'On The Way' : 'Pending');
      var statusColor = isRestored ? 'green' : (statusKey === 'ontheway' ? '#f97316' : '#dc2626');
      var slaBadge2 = '';
      try {
        if (isOverdueRow(r) && !isRestored) {
          slaBadge2 = ' <span style="display:inline-block; margin-left:6px; background:#b91c1c; color:#fff; padding:2px 6px; border-radius:10px;">>24h Overdue</span>';
        }
      } catch(e){}
      var statusLine = '<br><span style="color:' + statusColor + ';">Status: ' + statusText + '</span>' + slaBadge2;
      var queueBadgeLine = '';
      if (statusKey === 'pending' && isNewComplianceRow(r)) {
        try {
          var qVal = (Number.isFinite(Number(r.queueNumber)) && Number(r.queueNumber) > 0)
            ? Number(r.queueNumber)
            : ((window._queueOrderById && window._queueOrderById[r.id]) || null);
          if (qVal) {
            queueBadgeLine = ' <span style="display:inline-block; margin-left:6px; color:#1a1512; background:#fde68a; border:1px solid #fcd34d; padding:2px 6px; border-radius:10px; font-weight:700;">#' + qVal + '</span>';
          }
        } catch(e){}
      }
      var teamSelRow = (isRestored || !canManage()) ? '' : '<label class="map-popup-label">Team: <select class="team-select map-popup-select"><option value=\"\">Select team</option><option>Line Crew A</option><option>Line Crew B</option><option>Maintenance</option><option>Inspection</option></select></label><button type=\"button\" class=\"pending-assign map-popup-btn map-popup-btn-warning\">Set Pending</button>';
      var resolveToggleClass = isRestored ? 'map-popup-btn-warning' : 'map-popup-btn-success';
      var resolveToggleRow = canManage() ? ('<button type="button" class="resolve-toggle-row map-popup-btn ' + resolveToggleClass + '">' + (isRestored ? 'Mark as Pending' : 'Mark as Resolved') + '</button>') : '';
      var assignedRow = assignedTeam;
      var locationLine = getReportLocationText(r);
      var coordsLine = (Number.isFinite(lat) && Number.isFinite(lng)) ? ('<br><small>Coordinates: ' + lat.toFixed(6) + ', ' + lng.toFixed(6) + '</small>') : '';
      var routeHref2 = buildRouteHref({ latitude: lat, longitude: lng, location_text: locationLine, name: r.name, barangay: rb });
      var routeLink2 = (statusKey === 'ontheway' && !isRestored)
        ? ('<button type="button" class="show-route-map map-popup-btn map-popup-btn-primary">Show Route on Map</button>' +
          (routeHref2 ? '<a href="' + routeHref2 + '" target="_blank" rel="noopener noreferrer" class="open-route map-popup-btn map-popup-btn-ghost">Open in Google Maps</a>' : ''))
        : '';
      marker.bindPopup(
        '<div class="map-popup">' +
          '<div class="map-popup-title">' + r.name + '</div>' +
          '<div class="map-popup-sub">' + (rb || r.barangay || '') + '</div>' +
          '<div class="map-popup-issue">' + r.issue + queueBadgeLine + '</div>' +
          '<div class="map-popup-status" style="color:' + statusColor + ';">Status: ' + statusText + '</div>' +
          (slaBadge2 ? ('<div class="map-popup-note">' + slaBadge2 + '</div>') : '') +
          (locationLine ? '<div class="map-popup-meta">Location: ' + locationLine + '</div>' : '') +
          (coordsLine ? ('<div class="map-popup-meta">' + coordsLine.replace('<br><small>', '').replace('</small>', '') + '</div>') : '') +
          (assignedRow ? '<div class="map-popup-meta">Assigned: ' + assignedRow + '</div>' : '') +
          teamSelRow + resolveToggleRow +
          '<div class="map-popup-actions">' + routeLink2 + '<button type="button" class="view-records map-popup-btn map-popup-btn-primary">View in Records</button>' + (canManage() ? '<button type="button" class="hide-pin map-popup-btn map-popup-btn-danger">Hide this pin</button>' : '') + '</div>' +
          '<div class="map-popup-meta">Reporter: ' + r.fullName + (r.contact ? ' (' + r.contact + ')' : '') + '</div>' +
        '</div>'
      );
      // clicking the red (hazard) marker should take user to the report page
      marker.on('click', function() {
        if (window.map) window.map.setView([lat, lng], 13);
        marker.openPopup();
      });
      marker.on('popupopen', function(e) {
        var container = e.popup.getElement();
        if (container && typeof L !== 'undefined' && L.DomEvent) {
          L.DomEvent.disableClickPropagation(container);
          L.DomEvent.disableScrollPropagation(container);
        }
        var teamSelectEl = container.querySelector('.team-select');
        if (teamSelectEl) {
          var assignedTeam = getAssignedTeam(r.name);
          if (assignedTeam) teamSelectEl.value = assignedTeam;
        }
        if (container && container.getAttribute('data-popup-actions-bound') !== '1') {
          container.setAttribute('data-popup-actions-bound', '1');
          var lastFireTs = 0;
          var onAction = async function(ev) {
            var tgt = ev && ev.target && ev.target.closest ? ev.target.closest('button, a') : null;
            if (!tgt || !container.contains(tgt)) return;
            if (!tgt.classList.contains('pending-assign') &&
                !tgt.classList.contains('show-route-map') &&
                !tgt.classList.contains('resolve-toggle-row') &&
                !tgt.classList.contains('hide-pin') &&
                !tgt.classList.contains('view-records')) {
              return;
            }
            var nowTs = Date.now();
            if (nowTs - lastFireTs < 120) return;
            lastFireTs = nowTs;
            ev.preventDefault();
            ev.stopPropagation();

            if (tgt.classList.contains('pending-assign')) {
              if (!canManage() || !teamSelectEl) return;
              var t = teamSelectEl.value || '';
              if (!t) {
                t = 'Line Crew A';
                teamSelectEl.value = t;
              }
              setAssignedTeam(r.name, t);
              try { await setReportStatusById(r.id, 'ontheway'); } catch (err) {
                console.error(err);
                alert(buildStatusUpdateErrorMessage(err));
                return;
              }
              clearRouteLine();
              drawRouteFromAdminTo(lat, lng);
              if (window._dashboardLocations) {
                renderMunicipalityMarkers(window._dashboardLocations);
                renderReportMarkers(window._dashboardLocations);
                rebuildActiveNotifications(window._dashboardLocations);
              }
              return;
            }
            if (tgt.classList.contains('hide-pin')) {
              if (!canManage()) return;
              hidePin(r.name || '', rb || '', r.id || '');
              try {
                var arr = JSON.parse(localStorage.getItem('auditLogs') || '[]');
                var who = localStorage.getItem('userName') || 'User';
                arr.push({ ts: new Date().toISOString(), who: who, type: 'hide_pin', data: { municipality: r.name, barangay: rb }, summary: 'Hid pin ' + (r.name||'') + ' – ' + (rb||'') });
                if (arr.length > 500) arr = arr.slice(arr.length - 500);
                localStorage.setItem('auditLogs', JSON.stringify(arr));
              } catch(e){}
              if (window._dashboardLocations) {
                renderMunicipalityMarkers(window._dashboardLocations);
                renderReportMarkers(window._dashboardLocations);
                updateSidebarBadges(window._dashboardLocations);
                updateBarangayHighlights(window._dashboardLocations);
                applyIssuesFilter();
                rebuildActiveNotifications(window._dashboardLocations);
              }
              return;
            }
            if (tgt.classList.contains('show-route-map')) {
              drawRouteFromAdminTo(lat, lng);
              return;
            }
            if (tgt.classList.contains('view-records')) {
              var params = new URLSearchParams();
              if (r.name) params.set('location', r.name + (r.barangay ? ' ' + r.barangay : ''));
              if (r.issue) params.set('issue', r.issue);
              window.location.href = 'records.html?' + params.toString();
              return;
            }
            if (tgt.classList.contains('resolve-toggle-row')) {
              if (!canManage()) return;
              try {
                var nextStatus = isResolvedRow(r) ? 'pending' : 'resolved';
                await setReportStatusById(r.id, nextStatus);
                if (String(nextStatus).toLowerCase() === 'resolved') clearRouteLine();
                loadReportsFromSupabase();
              } catch (err) {
                console.error(err);
                alert(buildStatusUpdateErrorMessage(err));
              }
            }
          };
          container.addEventListener('click', onAction, true);
          container.addEventListener('pointerup', onAction, true);
          container.addEventListener('touchend', onAction, true);
        }
      });
    });
    // If a deep-link target exists, try to open it now
    if (_pendingOpenTarget && (_pendingOpenTarget.reportId || _pendingOpenTarget.key)) {
      var mk = null;
      if (_pendingOpenTarget.reportId) {
        mk = reportMarkersById[String(_pendingOpenTarget.reportId)] || null;
      }
      if (!mk && _pendingOpenTarget.key) {
        mk = reportMarkersIndex[_pendingOpenTarget.key];
      }
      if (window.map) {
        if (mk) {
          var ll = mk.getLatLng();
          window.map.setView(ll, 13);
          mk.openPopup();
        } else if (_pendingOpenTarget.key) {
          // fallback: use municipality center with small offset
          var parts = _pendingOpenTarget.key.split('|');
          var mName = parts[0] || '';
          var bName = parts[1] || '';
          var muni = municipalities.find(function(mm){ return (mm.name||'').toLowerCase() === mName; });
          if (muni && Number.isFinite(Number(muni.lat)) && Number.isFinite(Number(muni.lng))) {
            var baseLat = Number(muni.lat), baseLng = Number(muni.lng);
            var k = String(bName||'') + '|' + String(mName||'');
            var h = 0; for (var i=0;i<k.length;i++){ h = (h*31 + k.charCodeAt(i)) >>> 0; }
            var ang = (h % 360) * (Math.PI/180);
            var rad = 0.01;
            var lat = baseLat + rad * Math.cos(ang);
            var lng = baseLng + (rad * Math.sin(ang)) / Math.cos(baseLat * Math.PI/180);
            window.map.setView([lat, lng], 13);
            L.popup()
              .setLatLng([lat, lng])
              .setContent('<strong>' + (muni.name || mName) + '</strong><br>' + bName)
              .openOn(window.map);
          }
        }
      }
      _pendingOpenTarget = null;
    }
  }

  async function fetchAllReports(cfg) {
    var pageSize = 1000;
    var offset = 0;
    var out = [];
    while (true) {
      var url = cfg.url + '/rest/v1/' + cfg.reportsTable + '?select=*&order=created_at.desc&limit=' + pageSize + '&offset=' + offset;
      var res = await fetch(url, {
        headers: {
          apikey: cfg.anonKey,
          Authorization: 'Bearer ' + cfg.anonKey
        }
      });
      if (!res.ok) throw new Error('Supabase fetch failed: ' + res.status);
      var rows = await res.json();
      if (!Array.isArray(rows) || !rows.length) break;
      out = out.concat(rows);
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return out;
  }

  async function loadReportsFromSupabase() {
    var cfg = window.SAMELCO_SUPABASE || {};
    if (!cfg.url || !cfg.anonKey || !cfg.reportsTable) return;
    try {
      var rows = await fetchAllReports(cfg);

      // Update the count of total reports (red pins)
      var totalReports = Array.isArray(rows) ? rows.length : 0;
      var countEl = document.getElementById('total-reports-count');
      if (countEl) {
        countEl.textContent = totalReports;
      }

      if (!Array.isArray(rows) || !rows.length) {
        return [];
      }

      var normalized = rows.map(normalizeReportRow);
      // rebuild persistent notifications based on current unassigned issues
      localStorage.setItem('problemLocations', JSON.stringify(normalized.filter(function(n){
        return !isResolvedRow(n);
      }).map(function(n) {
        return { name: n.name, issue: n.issue, barangay: n.barangay };
      })));

      // cache for use when user toggles restored status
      window._dashboardLocations = normalized;
      renderMunicipalityMarkers(normalized);
      // compute queue numbers and update sidebar first
      updateBarangayHighlights(normalized);
      // then render markers so popups can show numbers
      renderReportMarkers(normalized);
      updateSidebarBadges(normalized);
      applyIssuesFilter();
      rebuildActiveNotifications(normalized);
      triggerAlarmIfActive(normalized);
      if (_forceAlarmFromUrl) {
        _forceAlarmFromUrl = false;
        playAlarmNowFromLink();
      }
      return normalized;
    } catch (err) {
      console.warn('Unable to load reports from Supabase:', err.message || err);
      return [];
    }
  }

  localStorage.setItem('problemLocations', JSON.stringify([]));
  renderMunicipalityMarkers([]);
  window.map = map;
  loadReportsFromSupabase();
  setInterval(function(){ loadReportsFromSupabase(); }, 30000);

  function updateSidebarBadges(rows) {
    var list = document.getElementById('municipalities-sidebar-list');
    if (!list) return;
    var byNameNew = {};
    var byNamePending = {};
    rows.forEach(function(r) {
      var n = r.name || 'Unknown';
      if (isResolvedRow(r)) return;
      var bCand = resolveBarangayForReport(r) || r.barangay || '';
      if (!isDbPendingRow(r) && isBarangayRestored(n, bCand)) return;
      if (!byNameNew[n]) byNameNew[n] = 0;
      if (!byNamePending[n]) byNamePending[n] = 0;
      var assignedTeam = getAssignedTeam(n);
      if (assignedTeam) byNamePending[n] += 1;
      else if (isNewComplianceRow(r)) byNameNew[n] += 1;
      else byNamePending[n] += 1;
    });
    var totalNew = 0, totalPending = 0;
    list.querySelectorAll('.sidebar-municipality-item').forEach(function(it) {
      var name = it.getAttribute('data-name');
      var newBadge = it.querySelector('.issue-badge.new');
      var pendingBadge = it.querySelector('.issue-badge.pending');
      var nCount = byNameNew[name] || 0;
      var pCount = byNamePending[name] || 0;
      it.classList.toggle('has-issue', (nCount + pCount) > 0);
      if (newBadge) {
        if (nCount > 0) {
          newBadge.style.display = 'inline-block';
          newBadge.textContent = 'New Compliance ' + nCount;
          totalNew += nCount;
        } else {
          newBadge.style.display = 'none';
          newBadge.textContent = '';
        }
      }
      if (pendingBadge) {
        if (pCount > 0) {
          pendingBadge.style.display = 'inline-block';
          pendingBadge.textContent = 'Pending ' + pCount;
          totalPending += pCount;
        } else {
          pendingBadge.style.display = 'none';
          pendingBadge.textContent = '';
        }
      }
    });
    var sumEl = document.getElementById('issues-summary');
    if (sumEl) {
      var parts = [];
      if (totalNew) parts.push('New Compliance ' + totalNew);
      if (totalPending) parts.push('Pending ' + totalPending);
      sumEl.textContent = parts.join(' · ');
    }
  }

  function normalizeBarangayName(s) {
    if (!s) return '';
    var x = String(s).toLowerCase();
    x = x.replace(/brgy\.?\s*/g, 'barangay ');
    x = x.replace(/barangay\s+/g, '');
    x = x.replace(/\./g, '');
    // Map numeric barangay labels like "no 1" to "poblacion 1"
    x = x.replace(/^no\s*(\d+)$/i, 'poblacion $1');
    x = x.replace(/\s+/g, ' ').trim();
    return x;
  }

  function resolveBarangayForReport(r) {
    var mName = r.name || '';
    var m = municipalities.find(function(mm){ return (mm.name||'').toLowerCase() === mName.toLowerCase(); });
    if (!m || !Array.isArray(m.barangays)) return '';
    // Build normalized set for municipality barangays
    var normSet = {};
    m.barangays.forEach(function(b){ normSet[normalizeBarangayName(b)] = b; });
    // Collect candidates from report
    var candidates = [];
    if (r.barangay) candidates.push(r.barangay);
    if (r.location_text) candidates.push(r.location_text);
    if (r.address) candidates.push(r.address);
    // Add direct parse from location text
    if (r.location_text) {
      var parsed = parseBarangayFromLocationText(r.location_text);
      if (parsed) candidates.unshift(parsed);
      // also try comma-separated tokens
      r.location_text.split(',').forEach(function(tok){ candidates.push(tok.trim()); });
    }
    // Try to match any candidate to municipality barangays
    for (var i=0;i<candidates.length;i++){
      var norm = normalizeBarangayName(candidates[i]);
      if (norm && normSet[norm]) return normSet[norm];
    }
    return '';
  }

  function updateBarangayHighlights(rows) {
    var list = document.getElementById('municipalities-sidebar-list');
    if (!list) return;
    // Build queue numbers for "New" items: global and per-municipality (earliest first)
    var orderById = {};
    var orderByMunicipality = {};
    var orderByBrgy = {};
    try {
      var newRows = [];
      rows.forEach(function(r){
        var m = r.name || 'Unknown';
        if (isResolvedRow(r)) return;
        var b = resolveBarangayForReport(r) || r.barangay || '';
        if (!isDbPendingRow(r) && isBarangayRestored(m, b)) return;
        var assignedTeam = getAssignedTeam(m);
        if (isNewComplianceRow(r)) newRows.push(r);
      });
      var sortedAll = newRows.slice().sort(function(a,b){
        var ta = new Date(a.createdAt).getTime(); if (!isFinite(ta)) ta = Number.MAX_SAFE_INTEGER;
        var tb = new Date(b.createdAt).getTime(); if (!isFinite(tb)) tb = Number.MAX_SAFE_INTEGER;
        if (ta !== tb) return ta - tb;
        var ia = String(a.id||''); var ib = String(b.id||''); return ia.localeCompare(ib);
      });
      for (var i=0;i<sortedAll.length;i++){ orderById[sortedAll[i].id] = i+1; }
      var muniGroups = {};
      newRows.forEach(function(r){
        var m = (r.name || 'Unknown');
        var key = m.toLowerCase();
        if (!muniGroups[key]) muniGroups[key] = [];
        muniGroups[key].push(r);
      });
      Object.keys(muniGroups).forEach(function(k){
        var arr = muniGroups[k].slice().sort(function(a,b){
          var ta = new Date(a.createdAt).getTime(); if (!isFinite(ta)) ta = Number.MAX_SAFE_INTEGER;
          var tb = new Date(b.createdAt).getTime(); if (!isFinite(tb)) tb = Number.MAX_SAFE_INTEGER;
          if (ta !== tb) return ta - tb;
          var ia = String(a.id||''); var ib = String(b.id||''); return ia.localeCompare(ib);
        });
        orderByMunicipality[k] = {};
        for (var i=0;i<arr.length;i++){ orderByMunicipality[k][arr[i].id] = i+1; }
      });
      newRows.forEach(function(r){
        var b = resolveBarangayForReport(r) || r.barangay || '';
        var key = (r.name || '').toLowerCase() + '|' + normalizeBarangayName(b);
        var q = orderById[r.id]; // use global queue for unique numbering across all municipalities
        if (q) {
          if (!orderByBrgy[key] || q < orderByBrgy[key]) orderByBrgy[key] = q;
        }
      });
    } catch(e){}
    window._queueOrderByBrgy = orderByBrgy;
    window._queueOrderById = orderById;
    window._queueOrderByMunicipality = orderByMunicipality;
    var newByMunicipality = {};
    var pendingByMunicipality = {};
    rows.forEach(function(r) {
      var m = r.name || 'Unknown';
      if (isResolvedRow(r)) return;
      var b = resolveBarangayForReport(r) || r.barangay || '';
      if (!isDbPendingRow(r) && isBarangayRestored(m, b)) return;
      var assignedTeam = getAssignedTeam(m);
      var statusIsNew = isNewComplianceRow(r);
      if (statusIsNew) {
        if (!newByMunicipality[m]) newByMunicipality[m] = new Set();
        newByMunicipality[m].add(normalizeBarangayName(b));
      } else {
        if (!pendingByMunicipality[m]) pendingByMunicipality[m] = new Set();
        pendingByMunicipality[m].add(normalizeBarangayName(b));
      }
    });
    list.querySelectorAll('.sidebar-municipality-item').forEach(function(it) {
      var mName = it.getAttribute('data-name');
      var setNew = newByMunicipality[mName] || new Set();
      var setPending = pendingByMunicipality[mName] || new Set();
      var anyMarked = false;
      var firstMarked = null;
      it.querySelectorAll('.barangay-item-sidebar').forEach(function(bItem) {
        var currentText = bItem.childNodes.length ? bItem.childNodes[0].textContent : bItem.textContent || '';
        var rawName = currentText;
        var label = normalizeBarangayName(currentText);
        var isNewMark = setNew.has(label);
        var isPendingMark = !isNewMark && setPending.has(label);
        bItem.classList.toggle('barangay-new', isNewMark);
        bItem.classList.toggle('barangay-pending', isPendingMark);
        var statusBadge = bItem.querySelector('.status-badge');
        if (statusBadge) statusBadge.remove();
        var assignChip = bItem.querySelector('.assignment-chip');
        if (assignChip) assignChip.remove();
        var existingBtn = bItem.querySelector('.restore-one-btn');
        if (isNewMark) {
          var badge = document.createElement('span');
          badge.className = 'issue-badge new status-badge';
          var qKey = (mName || '').toLowerCase() + '|' + label;
          var qVal = orderByBrgy[qKey];
          badge.textContent = qVal ? ('New #' + qVal) : 'New';
          bItem.appendChild(badge);
          if (!existingBtn) {
            var a = document.createElement('a');
            a.className = 'restore-one-btn';
            a.href = '#';
            a.textContent = 'Mark as Restored';
            a.style.cssText = 'margin-left:auto; font-size:0.75rem; color:#065f46; text-decoration:none;';
            a.addEventListener('click', function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              markBarangayRestored(mName, rawName);
              bItem.classList.remove('barangay-new');
              a.remove();
              if (window._dashboardLocations) {
                renderMunicipalityMarkers(window._dashboardLocations);
                renderReportMarkers(window._dashboardLocations);
                updateBarangayHighlights(window._dashboardLocations);
                updateSidebarBadges(window._dashboardLocations);
                applyIssuesFilter();
                rebuildActiveNotifications(window._dashboardLocations);
                triggerAlarmIfActive(window._dashboardLocations);
              } else {
                updateSidebarBadges(rows);
                applyIssuesFilter();
              }
            });
            bItem.appendChild(a);
          }
        } else if (isPendingMark) {
          var badgeP = document.createElement('span');
          badgeP.className = 'issue-badge pending status-badge';
          badgeP.textContent = 'Pending';
          bItem.appendChild(badgeP);
          // Show assignment team beside Pending
          var teamNow = getAssignedTeam(mName) || '';
          var chip = document.createElement('span');
          chip.className = 'assignment-chip';
          chip.textContent = 'Assigned: ' + (teamNow || 'Unassigned');
          chip.style.cssText = 'margin-left:8px; font-size:0.72rem; color:#1f2937; background:#e5e7eb; border:1px solid #d1d5db; padding:1px 6px; border-radius:10px;';
          bItem.appendChild(chip);
          if (!existingBtn) {
            var ap = document.createElement('a');
            ap.className = 'restore-one-btn';
            ap.href = '#';
            ap.textContent = 'Mark as Restored';
            ap.style.cssText = 'margin-left:auto; font-size:0.75rem; color:#065f46; text-decoration:none;';
            ap.addEventListener('click', function(ev) {
              ev.preventDefault();
              ev.stopPropagation();
              markBarangayRestored(mName, rawName);
              bItem.classList.remove('barangay-pending');
              ap.remove();
              if (window._dashboardLocations) {
                renderMunicipalityMarkers(window._dashboardLocations);
                renderReportMarkers(window._dashboardLocations);
                updateBarangayHighlights(window._dashboardLocations);
                updateSidebarBadges(window._dashboardLocations);
                applyIssuesFilter();
                rebuildActiveNotifications(window._dashboardLocations);
                triggerAlarmIfActive(window._dashboardLocations);
              } else {
                updateSidebarBadges(rows);
                applyIssuesFilter();
              }
            });
            bItem.appendChild(ap);
          }
        } else {
          if (existingBtn) existingBtn.remove();
        }
        if ((isNewMark || isPendingMark) && !bItem.getAttribute('data-click-bound')) {
          bItem.setAttribute('data-click-bound', '1');
          bItem.style.cursor = 'pointer';
          bItem.addEventListener('click', function(ev) {
            ev.stopPropagation();
            var key = (mName || '').toLowerCase() + '|' + label;
            var mk = reportMarkersIndex[key];
              if (window.map) {
                if (mk) {
                  var ll = mk.getLatLng();
                  window.map.setView(ll, 13);
                  mk.openPopup();
                } else {
                  // Fallback: position near municipality center using deterministic offset from barangay label
                  var muni = municipalities.find(function(mm){ return (mm.name||'').toLowerCase() === (mName||'').toLowerCase(); });
                  if (muni && Number.isFinite(Number(muni.lat)) && Number.isFinite(Number(muni.lng))) {
                    var baseLat = Number(muni.lat), baseLng = Number(muni.lng);
                    var k = String(label||'') + '|' + String(mName||'');
                    var h = 0; for (var i=0;i<k.length;i++){ h = (h*31 + k.charCodeAt(i)) >>> 0; }
                    var ang = (h % 360) * (Math.PI/180);
                    var rad = 0.01; // ~1km
                    var lat = baseLat + rad * Math.cos(ang);
                    var lng = baseLng + (rad * Math.sin(ang)) / Math.cos(baseLat * Math.PI/180);
                    window.map.setView([lat, lng], 13);
                    L.popup()
                      .setLatLng([lat, lng])
                      .setContent('<strong>' + mName + '</strong><br>' + rawName + '<br><small>No precise marker found</small>')
                      .openOn(window.map);
                  }
                }
              }
              try {
                var sp = new URLSearchParams(window.location.search);
                sp.set('municipality', mName);
                sp.set('barangay', rawName);
                history.replaceState(null, '', window.location.pathname + '?' + sp.toString());
              } catch (e) {}
          });
        }
        if (!firstMarked && (isNewMark || isPendingMark)) firstMarked = bItem;
        if (isNewMark || isPendingMark) anyMarked = true;
      });
      // Keep barangay lists collapsed by default; do not auto-open even if marked
    });
  }

  function applyIssuesFilter() {
    var cb = document.getElementById('issues-only-toggle');
    var list = document.getElementById('municipalities-sidebar-list');
    if (!list || !cb) return;
    var rows = window._dashboardLocations || [];
    var byNameCounts = {};
    rows.forEach(function(r) {
      var n = r.name || 'Unknown';
      if (isResolvedRow(r)) return;
      var bCand = resolveBarangayForReport(r) || r.barangay || '';
      if (!isDbPendingRow(r) && isBarangayRestored(n, bCand)) return;
      if (!byNameCounts[n]) byNameCounts[n] = 0;
      byNameCounts[n] += 1;
    });
    list.querySelectorAll('.sidebar-municipality-item').forEach(function(it) {
      var name = it.getAttribute('data-name');
      var count = byNameCounts[name] || 0;
      var show = !cb.checked || count > 0;
      it.style.display = show ? '' : 'none';
    });
  }

  var issuesToggle = document.getElementById('issues-only-toggle');
  if (issuesToggle) {
    issuesToggle.addEventListener('change', function() {
      applyIssuesFilter();
    });
  }

  // Populate municipalities grid
  var municipalitiesList = document.getElementById('municipalities-list');
  if (municipalitiesList) {
    municipalities.forEach(function(m) {
      var card = document.createElement('div');
      card.className = 'municipality-card';
      var barangayCount = Array.isArray(m.barangays) ? m.barangays.length : m.barangays;
      card.innerHTML = '<h3>' + m.name + '</h3><p>' + barangayCount + ' Barangays</p><div class="barangay-list" style="display:none;"></div>';
      
      card.addEventListener('click', function() {
        var barangayList = this.querySelector('.barangay-list');
        var isOpen = barangayList.style.display === 'block';
        
        // Close all other cards
        document.querySelectorAll('.barangay-list').forEach(function(list) {
          list.style.display = 'none';
        });
        
        if (!isOpen && Array.isArray(m.barangays)) {
          barangayList.innerHTML = '<ul>' + m.barangays.map(function(b) { return '<li>' + b + '</li>'; }).join('') + '</ul>';
          barangayList.style.display = 'block';
        }
      });
      
      municipalitiesList.appendChild(card);
    });
  }
});
