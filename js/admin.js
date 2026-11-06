/* ============================================================
   STIVEN — admin panel logic (admin.html)
   Auth (sessionStorage + password in localStorage),
   profile editor, works CRUD (video landscape/portrait + designs)
   ============================================================ */
(function () {
  'use strict';

  var AUTH_KEY = 'stiven_admin_auth';
  var PW_KEY = 'stiven_admin_pw';
  var MAX_FILE_BYTES = 3.5 * 1024 * 1024; // keep dataURLs storable

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // pastikan URL selalu punya protokol — kalau user lupa nulis https://
  function normURL(u) {
    u = String(u == null ? '' : u).trim();
    if (!u || u === '#') return u || '#';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
    return u;
  }
  function toast(msg, warn) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.toggle('warn', !!warn);
    t.classList.add('show');
    clearTimeout(window.__t);
    window.__t = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  function decodeDataURL(u) {
    var m = String(u).match(/^data:[^;,]*(;base64)?,([\s\S]*)$/);
    if (!m) return '';
    if (m[1]) {
      var bin = atob(m[2]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      try { return new TextDecoder('utf-8').decode(arr); } catch (e) { return bin; }
    }
    try { return decodeURIComponent(m[2]); } catch (e) { return m[2]; }
  }

  function getPw() {
    try { return window.localStorage.getItem(PW_KEY) || 'STIV3N_artisTECH'; } catch (e) { return 'STIV3N_artisTECH'; }
  }
  function setPw(v) {
    try { window.localStorage.setItem(PW_KEY, v); } catch (e) { /* memory only */ }
  }
  function isAuthed() {
    try { return window.sessionStorage.getItem(AUTH_KEY) === '1'; } catch (e) { return false; }
  }

  /* ---------- login ---------- */
  $('loginForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('pw').value === getPw()) {
      try { window.sessionStorage.setItem(AUTH_KEY, '1'); } catch (err) {}
      showDash();
    } else {
      $('loginError').style.display = 'block';
    }
  });
  $('btnLogout').addEventListener('click', function () {
    try { window.sessionStorage.removeItem(AUTH_KEY); } catch (err) {}
    location.reload();
  });

  function showDash() {
    $('loginView').style.display = 'none';
    $('dashView').style.display = 'block';
    if (SiteData.isCloud && !SiteData.isCloud() && !sessionStorage.getItem('cloudWarn')) {
      sessionStorage.setItem('cloudWarn', '1');
      setTimeout(function () {
        toast('⚠️ Supabase belum dikonfigurasi — perubahan HANYA tersimpan di browser ini. Isi js/supabase-config.js lalu commit → semua perangkat/HP tersinkron otomatis.', true);
      }, 600);
    }
    SiteData.init().then(initDashboard).catch(initDashboard);
  }

  /* ---------- tabs ---------- */
  document.querySelectorAll('.admin-tabs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('.admin-tabs button').forEach(function (x) { x.classList.toggle('active', x === b); });
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + b.getAttribute('data-tab')); });
    });
  });

  /* ============================================================
     PROFILE
     ============================================================ */
  var pendingHero = null, pendingPortrait = null; // dataURLs chosen but not saved yet

  function fillProfileForm(p) {
    $('fName').value = p.name || '';
    $('fRole').value = p.role || '';
    $('fHeadA').value = p.headlineA || '';
    $('fHeadB').value = p.headlineB || '';
    $('fTagline').value = p.tagline || '';
    $('fAboutTitle').value = p.aboutTitle || '';
    $('fWorksTitle').value = p.worksTitle || '';
    $('fCtaTitle').value = p.ctaTitle || '';
    $('fAvail').value = p.availability || '';
    $('fPortraitCap').value = p.portraitCaption || '';
    $('fBio').value = (p.bio || []).join('\n\n');
    $('fLocation').value = p.location || '';
    $('fEmail').value = p.email || '';
    $('fPhone').value = p.phone || '';
    $('fServices').value = (p.services || []).join(', ');
    $('fSocials').value = (p.socials || []).map(function (s) { return s.name + '=' + s.url; }).join(', ');
    $('prevHero').src = p.heroImage || '';
    $('curHero').textContent = 'saat ini: ' + (p.heroImage || '-');
    $('prevPortrait').src = p.portrait || '';
    $('curPortrait').textContent = 'saat ini: ' + (p.portrait || '-');
    pendingHero = null; pendingPortrait = null;
    $('fHeroImg').value = ''; $('fPortrait').value = '';
    renderStatsEditor(p.stats || []);
  }

  function renderStatsEditor(stats) {
    var box = $('statsEditor');
    box.innerHTML = '';
    for (var i = 0; i < 4; i++) {
      var s = stats[i] || { value: '', suffix: '', label: '' };
      var row = document.createElement('div');
      row.className = 'stat-edit-row';
      row.innerHTML = '<input data-k="value" placeholder="6" value="' + esc(s.value) + '" />' +
        '<input data-k="suffix" placeholder="+" value="' + esc(s.suffix) + '" />' +
        '<input data-k="label" placeholder="Years experience" value="' + esc(s.label) + '" />';
      box.appendChild(row);
    }
  }

  function readFileAsDataURL(file) {
    return new Promise(function (resolve, reject) {
      if (file.size > MAX_FILE_BYTES) {
        if (!window.confirm('File ini cukup besar (' + (file.size / 1048576).toFixed(1) + ' MB).\nDisimpan sebagai data mungkin gagal tersimpan di localStorage.\nLanjutkan?')) {
          return reject(new Error('cancelled'));
        }
      }
      var r = new FileReader();
      r.onload = function () { resolve(r.result); };
      r.onerror = function () { reject(new Error('read error')); };
      r.readAsDataURL(file);
    });
  }

  $('fHeroImg').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    readFileAsDataURL(f).then(function (d) { pendingHero = d; $('prevHero').src = d; $('curHero').textContent = 'file baru dipilih (' + (f.size / 1024).toFixed(0) + ' KB) — klik Simpan'; })
      .catch(function () { $('fHeroImg').value = ''; });
  });
  $('fPortrait').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    readFileAsDataURL(f).then(function (d) { pendingPortrait = d; $('prevPortrait').src = d; $('curPortrait').textContent = 'file baru dipilih — klik Simpan'; })
      .catch(function () { $('fPortrait').value = ''; });
  });

  $('profileForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var data = SiteData.get();
    var stats = [];
    $('statsEditor').querySelectorAll('.stat-edit-row').forEach(function (row) {
      var o = {};
      row.querySelectorAll('input').forEach(function (inp) { o[inp.getAttribute('data-k')] = inp.value.trim(); });
      if (o.label || o.value) stats.push(o);
    });
    var socials = $('fSocials').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean).map(function (s) {
      var i = s.indexOf('=');
      if (i > 0) return { name: s.slice(0, i).trim(), url: normURL(s.slice(i + 1).trim()) };
      return { name: s, url: '#' };
    });
    var res = SiteData.update({
      profile: {
        name: $('fName').value.trim(),
        role: $('fRole').value.trim(),
        headlineA: $('fHeadA').value.trim(),
        headlineB: $('fHeadB').value.trim(),
        tagline: $('fTagline').value.trim(),
        aboutTitle: $('fAboutTitle').value.trim(),
        worksTitle: $('fWorksTitle').value.trim(),
        ctaTitle: $('fCtaTitle').value.trim(),
        availability: $('fAvail').value.trim(),
        portraitCaption: $('fPortraitCap').value.trim(),
        bio: $('fBio').value.split(/\n\s*\n/).map(function (s) { return s.trim(); }).filter(Boolean),
        location: $('fLocation').value.trim(),
        email: $('fEmail').value.trim(),
        phone: $('fPhone').value.trim(),
        services: $('fServices').value.split(',').map(function (s) { return s.trim(); }).filter(Boolean),
        socials: socials,
        stats: stats,
        heroImage: pendingHero || data.profile.heroImage,
        portrait: pendingPortrait || data.profile.portrait
      }
    });
    pendingHero = null; pendingPortrait = null;
    toast(res.ok ? (res.persistent ? 'Profil tersimpan ✓' : 'Profil tersimpan (sesi ini saja — localStorage penuh/blokir) ✓') : '⚠ Gagal menyimpan (localStorage penuh?)', !res.ok);
    fillProfileForm(SiteData.get().profile);
  });

  /* ============================================================
     WORKS CRUD
     ============================================================ */
  var RATIOS = {
    video: [['16/9', '16:9 — Landscape'], ['9/16', '9:16 — Portrait (vertikal)'], ['1/1', '1:1 — Square']],
    design: [['16/9', '16:9 — Landscape (banner)'], ['3/2', '3:2'], ['4/3', '4:3'], ['1/1', '1:1 — Square'], ['4/5', '4:5 — Portrait'], ['3/4', '3:4 — Portrait'], ['2/3', '2:3 — Poster'], ['9/16', '9:16 — Story/Reels']],
    webapp: [['16/10', '16:10 — Browser window'], ['16/9', '16:9 — Landscape'], ['4/3', '4:3'], ['1/1', '1:1 — Square']]
  };
  var CATS = {
    video: ['Showreel', 'Commercial', 'Music Video', 'Short Film', 'Social / Reel', 'Motion', 'Other'],
    design: ['Banner', 'Logo', 'Poster', 'Social Media', 'Branding', 'Packaging', 'Other'],
    webapp: ['Web App Demo', 'Interactive', 'Game', 'Tool', 'Experiment', 'Other']
  };

  var editingId = null;
  var pendingFile = null;   // dataURL of main file
  var pendingPoster = null; // dataURL of poster
  var pendingMeta = null;   // {w,h} for auto ratio

  function rebuildSelects() {
    var type = $('wType').value;
    var r = $('wRatio');
    r.innerHTML = RATIOS[type].map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('');
    var c = $('wCategory');
    c.innerHTML = CATS[type].map(function (o) { return '<option>' + o + '</option>'; }).join('');
    $('posterField').style.display = (type === 'video' || type === 'webapp') ? 'block' : 'none';
    $('wFile').setAttribute('accept', type === 'design' ? 'image/*' : type === 'video' ? 'video/*' : '.html,text/html');
  }
  $('wType').addEventListener('change', rebuildSelects);

  function srcMode() {
    return document.querySelector('input[name="srcMode"]:checked').value;
  }
  document.querySelectorAll('input[name="srcMode"]').forEach(function (r) {
    r.addEventListener('change', function () {
      $('wFile').style.display = srcMode() === 'file' ? 'block' : 'none';
      $('wUrl').style.display = srcMode() === 'url' ? 'block' : 'none';
    });
  });

  function closestRatio(w, h) {
    var target = w / h;
    var best = null, bestDiff = Infinity;
    RATIOS.design.concat(RATIOS.video).forEach(function (o) {
      var parts = o[0].split('/');
      var v = parseFloat(parts[0]) / parseFloat(parts[1]);
      var d = Math.abs(v - target);
      if (d < bestDiff) { bestDiff = d; best = o[0]; }
    });
    return best;
  }

  $('wFile').addEventListener('change', function () {
    var f = this.files[0];
    pendingFile = null; pendingMeta = null;
    $('wPreviewWrap').style.display = 'none';
    if (!f) return;
    var isVideo = f.type.startsWith('video');
    var isHtml = f.type === 'text/html' || /\.html?$/i.test(f.name || '');
    if (isHtml) {
      if (f.size > MAX_FILE_BYTES && !window.confirm('File HTML besar (' + (f.size / 1048576).toFixed(1) + ' MB) — kemungkinan tidak tersimpan di localStorage. Lanjutkan?')) { this.value = ''; return; }
      var rr = new FileReader();
      rr.onload = function () {
        pendingFile = 'data:text/html;charset=utf-8,' + encodeURIComponent(rr.result);
        $('wPreviewWrap').style.display = 'block';
        var fr = document.createElement('iframe');
        fr.setAttribute('sandbox', 'allow-scripts');
        fr.style.cssText = 'width:240px;height:150px;border:1px solid var(--line);border-radius:8px;background:#fff';
        fr.srcdoc = rr.result;
        $('wPreview').innerHTML = '';
        $('wPreview').appendChild(fr);
      };
      rr.readAsText(f);
      return;
    }
    readFileAsDataURL(f).then(function (d) {
      pendingFile = d;
      var wrap = $('wPreviewWrap');
      wrap.style.display = 'block';
      if (isVideo) {
        $('wPreview').innerHTML = '<video src="' + d + '" muted preload="metadata" controls style="max-width:240px;max-height:150px;border-radius:8px"></video>';
      } else {
        var img = new Image();
        img.onload = function () {
          pendingMeta = { w: img.naturalWidth, h: img.naturalHeight };
          if ($('wType').value === 'design') {
            var r = closestRatio(img.naturalWidth, img.naturalHeight);
            if (r) $('wRatio').value = r;
          }
        };
        img.src = d;
        $('wPreview').innerHTML = '<img src="' + d + '" alt="preview" />';
      }
    }).catch(function () { $('wFile').value = ''; });
  });

  $('wPoster').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    readFileAsDataURL(f).then(function (d) { pendingPoster = d; toast('Poster dipilih ✓'); }).catch(function () { $('wPoster').value = ''; });
  });

  function resetWorkForm() {
    editingId = null;
    $('workForm').reset();
    rebuildSelects();
    $('wId').value = '';
    $('wFile').value = ''; $('wPoster').value = '';
    pendingFile = null; pendingPoster = null; pendingMeta = null;
    $('wPreviewWrap').style.display = 'none';
    $('workFormTitle').textContent = 'Tambah karya baru';
    $('wSubmit').textContent = 'Tambah karya ✓';
    $('wCancel').style.display = 'none';
    $('wUrl').style.display = 'none';
    $('wFile').style.display = 'block';
  }

  $('wCancel').addEventListener('click', resetWorkForm);

  $('workForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var title = $('wTitle').value.trim();
    if (!title) { toast('⚠ Judul wajib diisi', true); return; }
    var type = $('wType').value;
    var src = srcMode() === 'url' ? normURL($('wUrl').value.trim()) : pendingFile;
    if (!src) { toast('⚠ Pilih file atau isi URL', true); return; }

    var data = SiteData.get();
    var work = {
      id: editingId || ('w' + Date.now()),
      type: type,
      ratio: $('wRatio').value,
      category: $('wCategory').value,
      title: title,
      desc: $('wDesc').value.trim(),
      src: src,
      poster: pendingPoster || (editingId ? (findWork(editingId) || {}).poster || '' : '')
    };
    if (editingId) {
      data.works = data.works.map(function (w) { return w.id === editingId ? work : w; });
    } else {
      data.works.unshift(work);
    }
    // Link TikTok pendek tidak bisa diputar di website, beri tahu sekarang,
    // bukan setelah Bebeb cek di tampilan user dan videonya diam.
    if (type === 'video' && srcMode() === 'url' && /(?:vt|vm)\.tiktok\.com\//i.test(src)) {
      toast('⚠ Link TikTok pendek tidak bisa diputar di website. Pakai link lengkap tiktok.com/@nama/video/ID.', true);
    }
    var res = SiteData.save(data);
    if (!res.ok) {
      toast('⚠ Gagal menyimpan — kemungkinan localStorage penuh. Coba pakai URL.', true);
    } else {
      // Simpan ke Supabase itu async: tunggu hasil nyatanya. Kalau berhasil,
      // postingan dijamin masuk cloud dan muncul di browser lain. Kalau gagal
      // (sudah dicoba ulang sekali di data.js), beri tahu supaya Bebeb simpan
      // ulang, jangan diam saja seperti sebelumnya.
      toast('Menyimpan ke cloud…', false);
      var cp = (SiteData.lastCloudPromise && SiteData.lastCloudPromise()) || null;
      if (cp && cp.then) {
        cp.then(function (ok) {
          if (ok) toast('Karya tersimpan di cloud ✓ — akan muncul di browser lain');
          else toast('⚠ Tersimpan di browser ini saja, Supabase gagal: ' + ((SiteData.lastCloudError && SiteData.lastCloudError()) || 'tidak diketahui') + '. Coba simpan ulang.', true);
        });
      } else {
        setTimeout(function () {
          var err = (SiteData.lastCloudError && SiteData.lastCloudError()) || '';
          if (err) toast('⚠ Tersimpan di browser ini saja, Supabase gagal: ' + err, true);
          else toast('Karya tersimpan ✓');
        }, 2000);
      }
    }
    resetWorkForm();
    renderWorksList();
  });

  var SHARE_BASE = 'https://stivenportfolio.vercel.app'; // GANTI dengan domain Vercel setelah deploy
  function shareURLFor(w) { return window.location.origin + '/share/' + w.id + '.html'; }
  function makeSharePage(w) {
    var ogType = (w.type === 'video' && !/^https?:/i.test(w.src || '')) ? 'video.other' : 'website';
    var vtags = '';
    if (w.type === 'video' && !/^https?:/i.test(w.src || '')) {
      var dims = { '16/9': [1280, 720], '9/16': [720, 1280], '1/1': [1080, 1080] }[w.ratio] || [1280, 720];
      vtags = '\n  <meta property="og:video" content="' + SHARE_BASE + '/' + esc(w.src) + '" />' +
        '\n  <meta property="og:video:secure_url" content="' + SHARE_BASE + '/' + esc(w.src) + '" />' +
        '\n  <meta property="og:video:type" content="video/mp4" />' +
        '\n  <meta property="og:video:width" content="' + dims[0] + '" />' +
        '\n  <meta property="og:video:height" content="' + dims[1] + '" />';
    }
    return '<!DOCTYPE html>\n<html lang="id">\n<head>\n<meta charset="UTF-8" />\n' +
      '<meta name="viewport" content="width=device-width, initial-scale=1" />\n' +
      '<title>' + esc(w.title) + ' — STIVEN Portfolio</title>\n' +
      '<meta name="description" content="' + esc(w.desc || w.title) + '" />\n' +
      '<!-- GANTI ' + SHARE_BASE + ' dengan domain Vercel kamu setelah deploy (wajib agar thumbnail WhatsApp muncul) -->\n' +
      '<meta property="og:type" content="' + ogType + '" />\n' +
      '<meta property="og:site_name" content="STIVEN — Portfolio" />\n' +
      '<meta property="og:title" content="' + esc(w.title) + ' — STIVEN Portfolio" />\n' +
      '<meta property="og:description" content="' + esc((w.desc || '') + ' [' + (w.category || w.type) + ' · ' + (w.ratio || '') + ']') + '" />\n' +
      '<meta property="og:url" content="' + SHARE_BASE + '/share/' + esc(w.id) + '.html" />\n' +
      '<meta property="og:image" content="' + SHARE_BASE + '/assets/og/' + esc(w.id) + '.jpg" />\n' +
      '<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />' + vtags + '\n' +
      '<meta name="twitter:card" content="summary_large_image" />\n' +
      '<meta name="twitter:title" content="' + esc(w.title) + ' — STIVEN Portfolio" />\n' +
      '<meta name="twitter:description" content="' + esc(w.desc || '') + '" />\n' +
      '<meta name="twitter:image" content="' + SHARE_BASE + '/assets/og/' + esc(w.id) + '.jpg" />\n' +
      '<meta name="theme-color" content="#16110c" />\n' +
      '<meta http-equiv="refresh" content="0; url=../work.html?id=' + esc(w.id) + '" />\n' +
      '<script>(function(){var o=location.origin,p="' + SHARE_BASE + '";document.querySelectorAll("meta").forEach(function(m){var c=m.getAttribute("content");if(c&&c.indexOf(p)===0){m.setAttribute("content",c.split(p).join(o));}});})();</' + 'script>\n' +
      '</head>\n<body style="background:#16110c;color:#efe7d8;font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center">\n' +
      '<p>Membuka karya: <a style="color:#f5b04d" href="../work.html?id=' + esc(w.id) + '">' + esc(w.title) + ' →</a></p>\n</body>\n</html>';
  }

  function findWork(id) {
    return SiteData.get().works.find(function (w) { return w.id === id; });
  }

  // Geser urutan karya: tukar posisi dengan tetangga atas/bawah, lalu simpan.
  // Urutan array inilah yang tampil di halaman utama (main.js tidak mengurutkan ulang).
  function moveWork(id, dir) {
    var d = SiteData.get();
    var i = d.works.findIndex(function (w) { return w.id === id; });
    var j = i + dir;
    if (i < 0 || j < 0 || j >= d.works.length) return;
    var t = d.works[i]; d.works[i] = d.works[j]; d.works[j] = t;
    var res = SiteData.save(d);
    renderWorksList();
    if (!res.ok) { toast('⚠ Urutan diubah di browser ini saja, gagal tersimpan', true); return; }
    toast('Menyimpan urutan ke cloud…', false);
    var cp = (SiteData.lastCloudPromise && SiteData.lastCloudPromise()) || null;
    if (cp && cp.then) {
      cp.then(function (ok) {
        if (ok) toast('Urutan karya tersimpan ✓ — tampil di website sesuai urutan baru');
        else toast('⚠ Urutan tersimpan di browser ini saja, Supabase gagal: ' + ((SiteData.lastCloudError && SiteData.lastCloudError()) || 'tidak diketahui') + '. Coba pindahkan lagi.', true);
      });
    }
  }

  function renderWorksList() {
    var data = SiteData.get();
    var list = $('worksList');
    $('worksCount').textContent = '(' + data.works.length + ')';
    if (!data.works.length) {
      list.innerHTML = '<p class="empty-note">Belum ada karya. Tambahkan lewat form di atas.</p>';
      return;
    }
    list.innerHTML = data.works.map(function (w, i) {
      var thumb;
      if (w.type === 'webapp') {
        thumb = w.poster ? '<img src="' + esc(w.poster) + '" alt="" />' : '<div class="thumb-mock">&lt;/&gt;</div>';
      } else if (w.type === 'video') {
        thumb = w.poster ? '<img src="' + esc(w.poster) + '" alt="" />'
          : (/^https?:/i.test(w.src || '') ? '<div class="thumb-mock">▶</div>' : '<video src="' + esc(w.src) + '" muted preload="metadata"></video>');
      } else {
        thumb = '<img src="' + esc(w.src) + '" alt="" />';
      }
      return '<div class="work-row" data-id="' + esc(w.id) + '">' +
        '<div class="thumb">' + thumb + '</div>' +
        '<div class="info"><h4>' + esc(w.title) + '</h4>' +
          '<div class="badges">' +
            '<span class="badge ' + (w.type === 'video' ? 'video' : w.type === 'webapp' ? 'webapp' : '') + '">' + (w.type === 'video' ? '🎬 Video' : w.type === 'webapp' ? '💻 Web App' : '🎨 Desain') + '</span>' +
            '<span class="badge ' + (w.ratio === '9/16' ? 'portrait' : '') + '">' + esc(w.ratio) + '</span>' +
            '<span class="badge">' + esc(w.category || '') + '</span>' +
          '</div></div>' +
        '<div class="ops">' +
          '<button class="btn ghost small act-share" title="Salin link share karya">🔗</button>' +
          '<button class="btn ghost small act-dl" title="Unduh halaman share (OG) untuk karya ini">⬇</button>' +
          '<button class="btn ghost small act-up" title="Pindah ke atas" ' + (i === 0 ? 'disabled' : '') + '>↑</button>' +
          '<button class="btn ghost small act-down" title="Pindah ke bawah" ' + (i === data.works.length - 1 ? 'disabled' : '') + '>↓</button>' +
          '<button class="btn ghost small act-edit">Edit</button>' +
          '<button class="btn danger small act-del">Hapus</button>' +
        '</div></div>';
    }).join('');

    list.querySelectorAll('.work-row').forEach(function (row) {
      var id = row.getAttribute('data-id');
      var wRow = findWork(id);
      row.querySelector('.act-up').addEventListener('click', function () { moveWork(id, -1); });
      row.querySelector('.act-down').addEventListener('click', function () { moveWork(id, 1); });
      row.querySelector('.act-del').addEventListener('click', function () {
        var w = findWork(id);
        if (!w) return;
        if (!window.confirm('Hapus karya "' + w.title + '"?')) return;
        var d = SiteData.get();
        d.works = d.works.filter(function (x) { return x.id !== id; });
        SiteData.save(d);
        if (editingId === id) resetWorkForm();
        renderWorksList();
        toast('Karya dihapus ✓');
      });
      row.querySelector('.act-share').addEventListener('click', function () {
        if (!wRow) return;
        var u = shareURLFor(wRow);
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(u).then(function () { toast('🔗 Link share tersalin: ' + u); });
        else window.prompt('Salin link share:', u);
      });
      row.querySelector('.act-dl').addEventListener('click', function () {
        if (!wRow) return;
        var blob = new Blob([makeSharePage(wRow)], { type: 'text/html' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'share-' + wRow.id + '.html';
        document.body.appendChild(a); a.click(); a.remove();
        toast('⬇ Halaman share diunduh — upload ke folder share/ di repo, lalu ganti domain di dalamnya setelah deploy');
      });
      row.querySelector('.act-edit').addEventListener('click', function () {
        var w = findWork(id);
        if (!w) return;
        editingId = id;
        $('wId').value = id;
        $('wTitle').value = w.title;
        $('wType').value = w.type;
        rebuildSelects();
        $('wRatio').value = w.ratio;
        // set category if exists in options
        var c = $('wCategory');
        var found = false;
        for (var i = 0; i < c.options.length; i++) { if (c.options[i].text === w.category) { c.selectedIndex = i; found = true; break; } }
        if (!found && w.category) {
          var opt = document.createElement('option'); opt.text = w.category; c.appendChild(opt); c.value = w.category;
        }
        $('wDesc').value = w.desc || '';
        pendingFile = null; pendingPoster = null;
        $('wFile').value = ''; $('wPoster').value = '';
        $('wUrl').value = /^https?:/.test(w.src) ? w.src : '';
        document.querySelector('input[name="srcMode"][value="' + (/^https?:/.test(w.src) ? 'url' : 'file') + '"]').checked = true;
        $('wFile').style.display = /^https?:/.test(w.src) ? 'none' : 'block';
        $('wUrl').style.display = /^https?:/.test(w.src) ? 'block' : 'none';
        $('wPreviewWrap').style.display = 'block';
        if (w.type === 'webapp') {
          var fr2 = document.createElement('iframe');
          fr2.setAttribute('sandbox', 'allow-scripts allow-same-origin');
          fr2.style.cssText = 'width:240px;height:150px;border:1px solid var(--line);border-radius:8px;background:#fff';
          if (/^data:/.test(w.src)) { fr2.srcdoc = decodeDataURL(w.src); } else { fr2.src = w.src; }
          $('wPreview').innerHTML = '';
          $('wPreview').appendChild(fr2);
        } else {
          $('wPreview').innerHTML = w.type === 'video'
            ? '<video src="' + esc(w.src) + '" muted preload="metadata" controls style="max-width:240px;max-height:150px;border-radius:8px"></video>'
            : '<img src="' + esc(w.src) + '" alt="preview" />';
        }
        $('workFormTitle').textContent = 'Edit karya: ' + w.title;
        $('wSubmit').textContent = 'Simpan perubahan ✓';
        $('wCancel').style.display = 'inline-block';
        document.querySelector('.admin-tabs button[data-tab="works"]').click();
        $('workForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /* ============================================================
     SETTINGS
     ============================================================ */
  $('pwForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if ($('pwOld').value !== getPw()) { toast('⚠ Password lama salah', true); return; }
    if ($('pwNew').value !== $('pwNew2').value) { toast('⚠ Password baru tidak sama', true); return; }
    if ($('pwNew').value.length < 4) { toast('⚠ Password minimal 4 karakter', true); return; }
    setPw($('pwNew').value);
    $('pwForm').reset();
    toast('Password admin diganti ✓');
  });

  function doReset() {
    if (!window.confirm('Reset SEMUA data website (profil + karya) ke konten default?')) return;
    if (!window.confirm('Yakin? Tindakan ini tidak bisa dibatalkan.')) return;
    SiteData.reset();
    toast('Data direset ke default ✓');
    setTimeout(function () { location.reload(); }, 900);
  }
  $('btnReset').addEventListener('click', doReset);
  $('btnReset2').addEventListener('click', doReset);

  /* ---------- init ---------- */
  function initDashboard() {
    var p = SiteData.get().profile;
    fillProfileForm(p);
    rebuildSelects();
    resetWorkForm();
    renderWorksList();
  }

  if (isAuthed()) showDash();
})();
