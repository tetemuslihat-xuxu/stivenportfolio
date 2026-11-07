/* ============================================================
   STIVEN — public site logic (index.html)
   ============================================================ */
(function () {
  'use strict';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // {{...}} -> italic serif accent (Fluxora headline trick)
  function accent(s) {
    return String(s || '').split(/(\{\{[^}]*\}\})/).map(function (p) {
      if (p.length > 4 && p.slice(0, 2) === '{{' && p.slice(-2) === '}}') {
        return '<em class="serif">' + esc(p.slice(2, -2)) + '</em>';
      }
      return esc(p);
    }).join('');
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

  function normURL(u) {
    u = String(u == null ? '' : u).trim();
    if (!u || u === '#') return u || '#';
    if (/^https?:\/\//i.test(u)) return u;
    if (/^(www\.)?[\w-]+(\.[\w-]+)+(\/|$)/.test(u)) return 'https://' + u;
    return u;
  }
  function isExtSrc(s) { return /^https?:\/\//i.test(String(s || '')); }
  function embedURL(u) {
    var m;
    if ((m = String(u).match(/(?:youtube\.com\/(?:watch\?[^#]*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i))) return 'https://www.youtube.com/embed/' + m[1] + '?autoplay=1&rel=0';
    if ((m = String(u).match(/vimeo\.com\/(?:video\/)?(\d+)/i))) return 'https://player.vimeo.com/video/' + m[1] + '?autoplay=1';
    if ((m = String(u).match(/(?:www\.|m\.)?tiktok\.com\/@[\w.-]+\/video\/(\d+)/i))) return 'https://www.tiktok.com/embed/v2/' + m[1];
    if ((m = String(u).match(/(?:www\.|m\.)?tiktok\.com\/video\/(\d+)/i))) return 'https://www.tiktok.com/embed/v2/' + m[1];
    if ((m = String(u).match(/instagram\.com\/(p|reel|reels|tv)\/([\w-]+)/i))) return 'https://www.instagram.com/' + m[1] + '/' + m[2] + '/embed';
    if ((m = String(u).match(/(?:x\.com|twitter\.com)\/[\w-]+\/status\/(\d+)/i))) return 'https://platform.twitter.com/embed/Tweet.html?id=' + m[1];
    if (/facebook\.com\/.*\/videos\/\d+/i.test(String(u))) return 'https://www.facebook.com/plugins/video.php?href=' + encodeURIComponent(u) + '&show_text=false';
    return null;
  }
  // Link TikTok pendek (vt.tiktok.com / vm.tiktok.com) tidak membawa ID video,
  // jadi tidak bisa diubah jadi embed di browser. Jangan di-iframe sebagai
  // halaman TikTok biasa, karena halaman itu menolak di-frame dan tampil putih.
  function isTikTokShortLink(u) {
    return /(?:vt|vm)\.tiktok\.com\//i.test(String(u || ''));
  }
  // Video TikTok lengkap (tiktok.com/@user/video/ID atau /video/ID).
  // Iframe /embed/v2/ DITOLAK TikTok sendiri (overload-protect), dan embed.js
  // legacy tidak membentuk iframe untuk Kasbiku/Konto di tes live. Yang
  // dipakai sekarang: iframe player/v1 langsung (lihat tiktokPlayerHTML).
  function isTikTokVideo(u) {
    return /(?:www\.|m\.)?tiktok\.com\/(?:@[\w.-]+\/video\/\d+|video\/\d+)/i.test(String(u || ''));
  }
  function tiktokVideoId(u) {
    var m = String(u || '').match(/tiktok\.com\/(?:@[\w.-]+\/video\/|video\/)(\d+)/i);
    return m ? m[1] : '';
  }
  // Pemutar resmi TikTok lewat iframe player/v1 LANGSUNG (endpoint resmi,
  // terverifikasi memutar Car, Kasbiku, dan Konto di tes 8 Nov 2026 — ketiganya
  // onPlayerReady tanpa error). embed.js JANGAN dipakai lagi: ia legacy, dan
  // di tes live ia tidak membentuk iframe untuk Kasbiku/Konto. Pemutar
  // berkomunikasi lewat postMessage (x-tiktok-player): onPlayerReady berarti
  // berhasil, onPlayerError berarti gagal definitif. Ukuran tetap 325x578,
  // autoplay butuh muted=1 + allow="autoplay".
  function tiktokPlayerHTML(w) {
    var id = tiktokVideoId(w.src);
    return '<div class="lb-tiktok"><iframe title="TikTok video" src="https://www.tiktok.com/player/v1/' + esc(id) + '?autoplay=1&muted=1&description=1&music_info=1" width="325" height="578" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
  }
  // Kalau pemutar player/v1 gagal (onPlayerError, atau TikTok tidak menjawab
  // sama sekali — mis. CDN diblokir), kembalikan ke poster + tombol supaya
  // tidak ada kotak kosong — video tetap bisa dibuka di TikTok.
  function tiktokEmbedFallbackHTML(w) {
    return '<div class="lb-embed-fallback">' +
      (w.poster ? '<img src="' + esc(w.poster) + '" alt="' + esc(w.title) + '" />' : '') +
      '<p>Video ini ada di TikTok. Tonton langsung di TikTok lewat tombol di bawah.</p></div>';
  }
  function isPortraitEmbed(w, eu) {
    return w.ratio === '9/16' || /tiktok\.com\/embed/i.test(String(eu || '')) || /instagram\.com\/.*\/embed/i.test(String(eu || ''));
  }

  function main() {
  var data = SiteData.get();
  var p = data.profile;
  var works = data.works.slice();

  /* ---------------- render profile ---------------- */
  document.getElementById('logo').innerHTML = esc(p.name) + '<sup>®</sup>';
  document.title = p.name + ' — ' + p.role;
  document.getElementById('heroImg').src = p.heroImage || 'assets/hero.jpg';
  document.getElementById('headlineA').textContent = p.headlineA || '';
  document.getElementById('headlineB').innerHTML = accent(p.headlineB || '');
  document.getElementById('tagline').textContent = p.tagline || '';
  document.getElementById('avail').textContent = p.availability || '';
  document.getElementById('aboutTitle').innerHTML = accent(p.aboutTitle || 'About');
  document.getElementById('worksTitle').innerHTML = accent(p.worksTitle || 'Works');
  document.getElementById('ctaTitle').innerHTML = accent(p.ctaTitle || "Let's work {{together}}");
  document.getElementById('portraitImg').src = p.portrait || 'assets/portrait.jpg';
  document.getElementById('portraitCap').textContent = p.portraitCaption || (p.name + ' — ' + p.role + ', ' + (p.location || ''));
  document.getElementById('mailLink').textContent = p.email;
  document.getElementById('mailLink').href = 'mailto:' + p.email;

  // hero stats ("proof stacked underneath")
  document.getElementById('heroStats').innerHTML = (p.stats || []).map(function (s) {
    return '<div class="hstat"><div class="num">' + esc(s.value) + '<b>' + esc(s.suffix || '') + '</b></div><div class="lbl">' + esc(s.label) + '</div></div>';
  }).join('');

  // bio
  document.getElementById('bio').innerHTML = (p.bio || []).map(function (para, i) {
    var html = esc(para);
    if (i === 0) {
      var m = para.match(/^I'm ([^—,\s]+)/);
      if (m) html = "I'm <strong>" + esc(m[1]) + '</strong>' + esc(para.slice(m[0].length));
    }
    return '<p>' + html + '</p>';
  }).join('');

  // info list
  document.getElementById('infoList').innerHTML = [
    ['Name', p.name], ['Role', p.role], ['Based in', p.location],
    ['Email', p.email], ['Phone / WA', p.phone], ['Status', p.availability]
  ].filter(function (r) { return r[1]; }).map(function (r) {
    return '<div class="row"><span class="k">' + esc(r[0]) + '</span><span class="v">' + esc(r[1]) + '</span></div>';
  }).join('');

  // chips
  document.getElementById('chips').innerHTML = (p.services || []).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');

  // socials
  function socialsHTML() {
    return (p.socials || []).map(function (s) { return '<a href="' + esc(normURL(s.url)) + '" target="_blank" rel="noopener">' + esc(s.name) + ' ↗</a>'; }).join('');
  }
  document.getElementById('socials').innerHTML = socialsHTML();
  document.getElementById('footSocials').innerHTML = socialsHTML();
  function siteShareButtons() {
    var url = encodeURIComponent(window.location.href);
    var text = encodeURIComponent('MY NAME IS STIVEN — Portfolio (video, desain & web app)');
    return '<span>Bagikan website:</span>' +
      '<a class="s-btn" title="WhatsApp" target="_blank" rel="noopener" href="https://wa.me/?text=' + text + '%20' + url + '">WA</a>' +
      '<a class="s-btn" title="Telegram" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + url + '&text=' + text + '">TG</a>' +
      '<a class="s-btn" title="X / Twitter" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + text + '&url=' + url + '">𝕏</a>' +
      '<a class="s-btn" title="Facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + url + '">f</a>' +
      '<a class="s-btn" title="LinkedIn" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + url + '">in</a>' +
      '<button class="s-btn" data-copy="' + esc(window.location.href) + '" title="Salin link">⧉</button>';
  }
  document.getElementById('siteShare').innerHTML = siteShareButtons();

  // marquee
  var items = ['Video', 'Web App', 'Graphic Design', 'Motion', 'Branding', 'Logo', 'Banner', 'Poster', 'Social Content', 'Landscape 16:9', 'Portrait 9:16'];
  var seq = items.map(function (t) { return '<span>' + esc(t) + ' ✦</span>'; }).join('');
  document.getElementById('marqueeTrack').innerHTML = seq + seq;

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------------- share helpers (TOP LEVEL of main) ---------------- */
  function shareURL(w) { return window.location.origin + '/share/' + w.id + '.html'; }
  function shareWork(id) {
    var w = works.find(function (x) { return x.id === id; });
    if (!w) return;
    var url = shareURL(w);
    if (navigator.share) { navigator.share({ title: w.title, text: w.title + ' — STIVEN Portfolio', url: url }).catch(function () {}); }
    else if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(url).then(function () { showToast('🔗 Link share karya tersalin ✓'); }, function () { window.prompt('Salin link share:', url); }); }
    else { window.prompt('Salin link share:', url); }
  }
  function shareButtonsHTML(w) {
    var url = encodeURIComponent(shareURL(w));
    var text = encodeURIComponent(w.title + ' — STIVEN Portfolio');
    return '<div class="share-row"><span>Bagikan:</span>' +
      '<a class="s-btn" title="WhatsApp" target="_blank" rel="noopener" href="https://wa.me/?text=' + text + '%20' + url + '">WA</a>' +
      '<a class="s-btn" title="Telegram" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + url + '&text=' + text + '">TG</a>' +
      '<a class="s-btn" title="X / Twitter" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + text + '&url=' + url + '">𝕏</a>' +
      '<a class="s-btn" title="Facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + url + '">f</a>' +
      '<a class="s-btn" title="LinkedIn" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + url + '">in</a>' +
      '<button class="s-btn" data-copy="' + esc(shareURL(w)) + '" title="Salin link">⧉</button></div>';
  }
  // copy-link delegate (works for footer + lightbox + work page buttons)
  document.addEventListener('click', function (e) {
    var b = e.target.closest('.s-btn[data-copy]');
    if (!b) return;
    var u = b.getAttribute('data-copy');
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(u).then(function () { showToast('🔗 Link tersalin ✓'); }); }
  });

  /* ---------------- render works ---------------- */
  var grid = document.getElementById('worksGrid');
  var filter = 'all';
  var visible = works.slice();

  document.getElementById('countAll').textContent = works.length;
  document.getElementById('countVideo').textContent = works.filter(function (w) { return w.type === 'video'; }).length;
  document.getElementById('countDesign').textContent = works.filter(function (w) { return w.type === 'design'; }).length;
  document.getElementById('countWebapp').textContent = works.filter(function (w) { return w.type === 'webapp'; }).length;

  function mediaHTML(w) {
    if (w.type === 'webapp') {
      if (w.poster) return '<img src="' + esc(w.poster) + '" alt="' + esc(w.title) + '" loading="lazy" />';
      return '<div class="browser-mock"><div class="chrome"><i></i><i></i><i></i></div><div class="bm-body">&lt;/&gt;</div></div>';
    }
    if (w.type === 'video') {
      if (isExtSrc(w.src)) {
        if (w.poster) return '<img src="' + esc(w.poster) + '" alt="' + esc(w.title) + '" loading="lazy" />';
        return '<div class="browser-mock"><div class="chrome"><i></i><i></i><i></i></div><div class="bm-body">▶</div></div>';
      }
      var posterAttr = w.poster ? ' poster="' + esc(w.poster) + '"' : '';
      return '<video src="' + esc(w.src) + '"' + posterAttr + ' muted preload="metadata" playsinline></video>';
    }
    return '<img src="' + esc(w.src) + '" alt="' + esc(w.title) + '" loading="lazy" />';
  }

  function renderWorks() {
    visible = works.filter(function (w) { return filter === 'all' || w.type === filter; });
    grid.innerHTML = visible.map(function (w, i) {
      var isVid = w.type === 'video';
      var isWeb = w.type === 'webapp';
      var playable = isVid || isWeb;
      return '' +
      '<article class="card reveal' + (playable ? ' is-playable' : '') + '" data-idx="' + i + '" style="--r:' + esc(w.ratio || '4/3') + '">' +
        '<div class="media">' +
          '<span class="ratio-badge">' + esc(w.ratio || '') + (isVid ? ' ▶' : isWeb ? ' 🌐 LIVE' : '') + '</span>' +
          mediaHTML(w) +
          (playable ? '<span class="play"><svg viewBox="0 0 24 24"><path d="M6 4l14 8-14 8z"/></svg></span>' : '') +
        '</div>' +
        '<div class="meta"><h3>' + esc(w.title) + '</h3><span class="cat">' + esc(w.category || w.type) + '</span><button class="share-btn" data-share="' + esc(w.id) + '" title="Bagikan karya ini">⤴</button></div>' +
        (w.desc ? '<p class="desc">' + esc(w.desc) + '</p>' : '') +
      '</article>';
    }).join('');
    // observe new cards
    grid.querySelectorAll('.reveal').forEach(function (el) { revealIO.observe(el); });
    // bind clicks
    grid.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('click', function (e) {
        var sb = e.target.closest('.share-btn');
        if (sb) { e.stopPropagation(); shareWork(sb.getAttribute('data-share')); return; }
        var idx = parseInt(card.getAttribute('data-idx'), 10);
        var w = visible[idx];
        // Karya portfolio yang hanya jadi pengantar (mis. USSHOP Studio):
        // klik langsung buka website aslinya di tab baru, tanpa lightbox/iframe.
        if (w && w.newTab) { window.open(normURL(w.src), '_blank', 'noopener'); return; }
        openLightbox(idx);
      });
    });
  }

  document.getElementById('filters').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (!btn) return;
    filter = btn.getAttribute('data-filter');
    document.querySelectorAll('#filters button').forEach(function (b) { b.classList.toggle('active', b === btn); });
    renderWorks();
  });

  /* ---------------- lightbox ---------------- */
  var lb = document.getElementById('lightbox');
  var lbStage = document.getElementById('lbStage');
  var lbCaption = document.getElementById('lbCaption');
  var lbCount = document.getElementById('lbCount');
  var lbIndex = 0;

  // Pemutar TikTok player/v1 (lihat tiktokPlayerHTML): satu iframe per karya,
  // berkomunikasi lewat postMessage. Satu listener untuk seluruh halaman.
  var ttFrame = null, ttReady = false, ttTimer = null;
  function ttClear() { if (ttTimer) { clearTimeout(ttTimer); ttTimer = null; } ttFrame = null; ttReady = false; }
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d['x-tiktok-player'] || !ttFrame) return;
    if (e.source !== ttFrame.contentWindow) return;
    if (d.type === 'onPlayerReady') {
      ttReady = true;
      if (ttTimer) { clearTimeout(ttTimer); ttTimer = null; }
    } else if (d.type === 'onPlayerError') {
      if (ttTimer) { clearTimeout(ttTimer); ttTimer = null; }
      // Gagal definitif — tampilkan poster + tombol.
      if (lb.classList.contains('open') && lbStage.querySelector('.lb-tiktok')) {
        lbStage.innerHTML = tiktokEmbedFallbackHTML(visible[lbIndex]);
      }
    }
  });

  // ATURAN TERKUNCI — jaminan anti-potong untuk SEMUA postingan, hari ini
  // dan ke depan. Penyebab yang terbukti dari perbandingan Bebeb: Janji
  // Manis (deskripsi 4 baris) terpotong, RUSH (deskripsi 2 baris) aman —
  // bedanya hanya tinggi caption. Makin panjang deskripsi, makin tinggi
  // caption, makin besar total isi, dan kalau totalnya melewati layar,
  // pemusatan lama mendorong frame ke atas sampai terpotong. Karena itu
  // frame diukur ulang setiap kali dibuka: ukur tinggi caption yang
  // sebenarnya, lalu kecilkan frame secukupnya supaya total isi selalu
  // muat di layar dengan jarak di atas. Ini tidak tergantung versi CSS
  // yang dimuat browser, karena ukuran frame diatur langsung dari JS.
  function fitLightboxFrame() {
    var media = lbStage.querySelector('iframe, video, img');
    if (!media || !lb.classList.contains('open')) return;
    // Pemutar resmi TikTok mengatur ukurannya sendiri (325x580) — jangan
    // dipaksa kecil oleh hitungan frame; lightbox bisa di-scroll.
    if (lbStage.querySelector('.lb-tiktok')) return;
    var V = lb.clientHeight;
    if (!(V > 0)) return;
    var capH = lbCaption.offsetHeight || 0;
    // 22 = jarak stage-caption, 70 = pengaman (padding 3vh x2 + jarak atas).
    var maxStageH = Math.max(160, V - capH - 22 - 70);
    var curH = media.offsetHeight || 0;
    if (curH > maxStageH) {
      if (media.tagName === 'IFRAME') {
        var ar = curH > 0 ? (media.offsetWidth || 0) / curH : 16 / 9;
        if (!(ar > 0)) ar = 16 / 9;
        media.style.width = Math.round(maxStageH * ar) + 'px';
        media.style.height = maxStageH + 'px';
      } else {
        media.style.maxHeight = maxStageH + 'px';
      }
    }
  }
  function openLightbox(i) {
    if (!visible.length) return;
    lbIndex = (i + visible.length) % visible.length;
    var w = visible[lbIndex];
    ttClear(); // bersihkan timer/frame TikTok karya sebelumnya
    lbStage.style.maxHeight = ''; // reset; cabang TikTok yang mengaturnya ke 'none'
    if (w.type === 'webapp') {
      var fr = document.createElement('iframe');
      fr.className = 'lb-frame';
      fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
      if (/^data:/.test(w.src)) { fr.srcdoc = decodeDataURL(w.src); } else { fr.src = normURL(w.src); }
      lbStage.innerHTML = '';
      lbStage.appendChild(fr);
    } else if (w.type === 'video') {
      if (isExtSrc(w.src)) {
        var eu = embedURL(w.src);
        // Pemutar resmi TikTok lewat iframe player/v1 langsung (endpoint resmi,
        // terverifikasi memutar Car, Kasbiku, dan Konto di tes 8 Nov 2026 —
        // ketiganya onPlayerReady tanpa error; embed.js TIDAK dipakai lagi).
        // Tombol "Tonton di TikTok" di caption tetap ada (jalur ke akun Bebeb).
        // Stage dilepas dari max-height supaya pemutar 325x578 tidak terpotong.
        if (isTikTokVideo(w.src)) {
          lbStage.style.maxHeight = 'none';
          lbStage.innerHTML = tiktokPlayerHTML(w);
          ttFrame = lbStage.querySelector('iframe');
          // Cadangan: kalau TikTok tidak menjawab sama sekali dalam 10 detik
          // (tidak ada onPlayerReady dan tidak ada onPlayerError — mis. CDN
          // diblokir), tampilkan poster + tombol. Pemutar yang sudah siap
          // tidak pernah dibunuh oleh timer ini.
          (function (wid) {
            ttTimer = setTimeout(function () {
              if (!ttReady && lb.classList.contains('open') && visible[lbIndex] && visible[lbIndex].id === wid && lbStage.querySelector('.lb-tiktok')) {
                lbStage.innerHTML = tiktokEmbedFallbackHTML(visible[lbIndex]);
              }
            }, 10000);
          })(w.id);
        } else if (!eu && isTikTokShortLink(w.src)) {
          lbStage.innerHTML = '<div class="lb-embed-fallback">' +
            (w.poster ? '<img src="' + esc(w.poster) + '" alt="' + esc(w.title) + '" />' : '') +
            '<p>Video ini memakai link TikTok pendek, jadi tidak bisa diputar di dalam website. Buka di TikTok lewat tombol di bawah.</p></div>';
        } else {
          var embedSrc = eu || normURL(w.src);
          if (isPortraitEmbed(w, embedSrc)) {
            lbStage.innerHTML = '<iframe class="lb-frame lb-portrait" src="' + esc(embedSrc) + '" scrolling="no" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen style="background:#000;overflow:hidden"></iframe>';
          } else {
            // Frame embed landscape mengikuti rasio karya (mis. 16/9), supaya
            // kotaknya pas dengan video: tidak ada hitam berlebih atas-bawah
            // dan bagian atas frame tidak menempel ke tepi layar. Berlaku
            // untuk semua embed landscape ke depan (YouTube, Vimeo, dsb).
            var rp = String(w.ratio || '16/9').split('/');
            var rn = parseFloat(rp[0]) || 16, rd = parseFloat(rp[1]) || 9;
            var ar = rn / rd; if (!(ar > 0)) ar = 16 / 9;
            lbStage.innerHTML = '<iframe class="lb-frame" src="' + esc(embedSrc) + '" scrolling="no" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen style="background:#000;overflow:hidden;width:min(94vw, calc((100vh - 300px) * ' + ar.toFixed(4) + '), 1150px);aspect-ratio:' + rn + ' / ' + rd + ';height:auto"></iframe>';
          }
        }
      } else {
        lbStage.innerHTML = '<video src="' + esc(w.src) + '"' + (w.poster ? ' poster="' + esc(w.poster) + '"' : '') +
          ' controls autoplay playsinline class="' + (w.ratio === '9/16' ? 'portrait' : '') + '"></video>';
      }
    } else {
      lbStage.innerHTML = '<img src="' + esc(w.src) + '" alt="' + esc(w.title) + '" />';
    }
    lbCaption.innerHTML = '<span class="cat">' + esc(w.category || w.type) + ' · ' + esc(w.ratio || '') + '</span><h3>' + esc(w.title) + '</h3>' + (w.desc ? '<p>' + esc(w.desc) + '</p>' : '');
    // Link ini dulu disisipkan SEBELUM lbCaption.innerHTML di atas, jadi
    // langsung terhapus lagi. Sekarang disisipkan setelahnya, supaya muncul.
    if (w.type === 'video' && isExtSrc(w.src)) {
      var openLabel = (isTikTokVideo(w.src) || isTikTokShortLink(w.src)) ? 'Tonton di TikTok ↗' : 'Buka di platform asli ↗';
      lbCaption.insertAdjacentHTML('beforeend', '<div style="margin-top:14px"><a class="lb-open" href="' + esc(normURL(w.src)) + '" target="_blank" rel="noopener">' + openLabel + '</a></div>');
    }
    if (w.type === 'webapp') {
      var isData = /^data:/.test(w.src);
      var href = isData ? '#' : w.src;
      lbCaption.insertAdjacentHTML('beforeend', '<div style="margin-top:14px"><a class="lb-open" href="' + esc(href) + '" target="_blank" rel="noopener">Open demo in new tab ↗</a></div>');
      if (isData) {
        var blob = new Blob([decodeDataURL(w.src)], { type: 'text/html' });
        var a = lbCaption.querySelector('.lb-open');
        a.href = URL.createObjectURL(blob);
      }
    }
    lbCaption.insertAdjacentHTML('beforeend', shareButtonsHTML(w));
    lbCount.textContent = (lbIndex + 1) + ' / ' + visible.length;
    // Paksa layout lightbox dari JS (inline style) supaya bagian atas frame
    // tidak pernah terpotong, walau file CSS yang dimuat browser masih versi
    // lama: lebar frame sudah terbukti ikut JS terbaru, jadi aturan ini pun
    // ikut versi terbaru. margin auto di stage/caption memusatkan isi kalau
    // muat, dan menempel ke tepi atas (bisa di-scroll) kalau isi lebih tinggi.
    lb.style.justifyContent = 'flex-start';
    lbStage.style.marginTop = 'auto';
    lbCaption.style.marginBottom = 'auto';
    lb.scrollTop = 0; // selalu mulai dari atas — posisi scroll lightbox sebelumnya tidak boleh terbawa
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    fitLightboxFrame();
  }
  function closeLightbox() {
    lb.classList.remove('open');
    ttClear();
    var f = lbStage.querySelector('iframe');
    if (f) { try { f.src = 'about:blank'; } catch (e) {} } // hentikan pemutar sebelum dilepas
    lbStage.innerHTML = '';
    lbStage.style.maxHeight = '';
    document.body.style.overflow = '';
  }
  function step(d) { openLightbox(lbIndex + d); }

  document.getElementById('lbClose').addEventListener('click', closeLightbox);
  window.addEventListener('resize', function () { if (lb.classList.contains('open')) fitLightboxFrame(); });
  document.getElementById('lbPrev').addEventListener('click', function () { step(-1); });
  document.getElementById('lbNext').addEventListener('click', function () { step(1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLightbox(); });
  document.addEventListener('keydown', function (e) {
    if (!lb.classList.contains('open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  /* ---------------- nav + hero parallax + reveal ---------------- */
  var nav = document.getElementById('nav');
  var heroBg = document.getElementById('heroBg');
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    nav.classList.toggle('scrolled', y > 60);
    if (y < window.innerHeight) {
      heroBg.style.transform = 'translateY(' + y * 0.28 + 'px) scale(1.06)';
    }
  }, { passive: true });

  var revealIO = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (en.isIntersecting) { en.target.classList.add('visible'); revealIO.unobserve(en.target); }
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach(function (el) { revealIO.observe(el); });

  renderWorks();

  /* ---------------- toast helper (shared) ---------------- */
  window.showToast = function (msg, warn) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.toggle('warn', !!warn);
    t.classList.add('show');
    clearTimeout(window.__toastT);
    window.__toastT = setTimeout(function () { t.classList.remove('show'); }, 3200);
  };
  }

  SiteData.init().then(main).catch(main);
})();
