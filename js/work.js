/* ============================================================
   STIVEN — work.html?id=xxx  : halaman detail 1 karya
   + update meta OG sesuai karya + tombol share semua sosmed
   ============================================================ */
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
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
  // Satu listener postMessage untuk pemutar TikTok di halaman ini.
  var ttFrameW = null, ttReadyW = false, ttTimerW = null, ttWorkW = null;
  window.addEventListener('message', function (e) {
    var d = e.data;
    if (!d || !d['x-tiktok-player'] || !ttFrameW) return;
    if (e.source !== ttFrameW.contentWindow) return;
    if (d.type === 'onPlayerReady') {
      ttReadyW = true;
      if (ttTimerW) { clearTimeout(ttTimerW); ttTimerW = null; }
    } else if (d.type === 'onPlayerError') {
      if (ttTimerW) { clearTimeout(ttTimerW); ttTimerW = null; }
      var mm = $('wMedia');
      if (mm && mm.querySelector('.lb-tiktok') && ttWorkW) {
        mm.innerHTML = tiktokEmbedFallbackHTML(ttWorkW) +
          '<p style="text-align:center;margin-top:14px"><a class="lb-open" href="' + esc(normURL(ttWorkW.src)) + '" target="_blank" rel="noopener">Tonton di TikTok ↗</a></p>';
      }
    }
  });
  function tiktokEmbedFallbackHTML(w) {
    return '<div class="lb-embed-fallback">' +
      (w.poster ? '<img src="' + esc(w.poster) + '" alt="' + esc(w.title) + '" />' : '') +
      '<p>Video ini ada di TikTok. Tonton langsung di TikTok lewat tombol di bawah.</p></div>';
  }
  function isPortraitEmbed(w, eu) {
    return w.ratio === '9/16' || /tiktok\.com\/embed/i.test(String(eu || '')) || /instagram\.com\/.*\/embed/i.test(String(eu || ''));
  }
  function shareURL(w) { return window.location.origin + '/share/' + w.id + '.html'; }

  function setMeta(prop, content) {
    var m = document.querySelector('meta[property="' + prop + '"]') || document.querySelector('meta[name="' + prop + '"]');
    if (!m) {
      m = document.createElement('meta');
      if (prop.indexOf('og:') === 0) m.setAttribute('property', prop); else m.setAttribute('name', prop);
      document.head.appendChild(m);
    }
    m.setAttribute('content', content);
  }

  function shareButtons(w) {
    var url = encodeURIComponent(shareURL(w));
    var text = encodeURIComponent(w.title + ' — STIVEN Portfolio');
    return '<span>Bagikan:</span>' +
      '<a class="s-btn" title="WhatsApp" target="_blank" rel="noopener" href="https://wa.me/?text=' + text + '%20' + url + '">WA</a>' +
      '<a class="s-btn" title="Telegram" target="_blank" rel="noopener" href="https://t.me/share/url?url=' + url + '&text=' + text + '">TG</a>' +
      '<a class="s-btn" title="X / Twitter" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + text + '&url=' + url + '">𝕏</a>' +
      '<a class="s-btn" title="Facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + url + '">f</a>' +
      '<a class="s-btn" title="LinkedIn" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + url + '">in</a>' +
      '<button class="s-btn" data-copy="' + esc(shareURL(w)) + '" title="Salin link">⧉</button>';
  }

  function render(w) {
    var ogImg = window.location.origin + '/assets/og/' + w.id + '.jpg';
    document.title = w.title + ' — STIVEN Portfolio';
    setMeta('og:title', w.title + ' — STIVEN Portfolio');
    setMeta('og:description', (w.desc || '') + ' [' + (w.category || w.type) + ' · ' + (w.ratio || '') + ']');
    setMeta('og:url', shareURL(w));
    setMeta('og:type', (w.type === 'video' && !isExtSrc(w.src)) ? 'video.other' : 'website');
    setMeta('og:image', ogImg);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', w.title + ' — STIVEN Portfolio');
    setMeta('twitter:description', w.desc || '');
    setMeta('twitter:image', ogImg);
    if (w.type === 'video' && !isExtSrc(w.src)) {
      setMeta('og:video', window.location.origin + '/' + w.src);
      setMeta('og:video:secure_url', window.location.origin + '/' + w.src);
      setMeta('og:video:type', 'video/mp4');
    }

    $('wCat').textContent = (w.category || w.type) + (w.ratio ? ' · ' + w.ratio : '');
    $('wTitle').textContent = w.title;
    $('wBadges').innerHTML =
      '<span class="badge ' + (w.type === 'video' ? 'video' : w.type === 'webapp' ? 'webapp' : '') + '">' +
        (w.type === 'video' ? '🎬 Video' : w.type === 'webapp' ? '💻 Web App' : '🎨 Desain') + '</span>' +
      '<span class="badge">' + esc(w.ratio || '') + '</span>' +
      '<span class="badge">' + esc(w.category || '') + '</span>';
    $('wDesc').textContent = w.desc || '';
    $('wShare').innerHTML = shareButtons(w);

    var m = $('wMedia');
    if (w.type === 'video') {
      if (isExtSrc(w.src)) {
        var eu = embedURL(w.src);
        // Embed RESMI TikTok lewat iframe player/v1 langsung (terverifikasi
        // memutar Car, Kasbiku, dan Konto di tes 8 Nov 2026). Tombol
        // "Tonton di TikTok" tetap ada di bawah (jalur ke akun Bebeb).
        if (isTikTokVideo(w.src)) {
          m.innerHTML = tiktokPlayerHTML(w) +
            '<p style="text-align:center;margin-top:14px"><a class="lb-open" href="' + esc(normURL(w.src)) + '" target="_blank" rel="noopener">Tonton di TikTok ↗</a></p>';
          ttFrameW = m.querySelector('iframe');
          ttReadyW = false;
          ttWorkW = w;
          if (ttTimerW) clearTimeout(ttTimerW);
          // Cadangan: kalau TikTok tidak menjawab sama sekali dalam 10 detik
          // (tidak ada onPlayerReady dan tidak ada onPlayerError — mis. CDN
          // diblokir), tampilkan poster + tombol. Pemutar yang sudah siap
          // tidak pernah dibunuh oleh timer ini.
          ttTimerW = setTimeout(function () {
            if (!ttReadyW && m.querySelector('.lb-tiktok')) {
              m.innerHTML = tiktokEmbedFallbackHTML(w) +
                '<p style="text-align:center;margin-top:14px"><a class="lb-open" href="' + esc(normURL(w.src)) + '" target="_blank" rel="noopener">Tonton di TikTok ↗</a></p>';
            }
          }, 10000);
        } else if (!eu && isTikTokShortLink(w.src)) {
          m.innerHTML = '<div class="lb-embed-fallback">' +
            (w.poster ? '<img src="' + esc(w.poster) + '" alt="' + esc(w.title) + '" />' : '') +
            '<p>Video ini memakai link TikTok pendek, jadi tidak bisa diputar di dalam website. Buka di TikTok lewat tombol di bawah.</p></div>' +
            '<p style="text-align:center;margin-top:14px"><a class="lb-open" href="' + esc(normURL(w.src)) + '" target="_blank" rel="noopener">Tonton di TikTok ↗</a></p>';
        } else {
          var embedSrc = eu || normURL(w.src);
          if (isPortraitEmbed(w, embedSrc)) {
            m.innerHTML = '<iframe class="lb-frame lb-portrait" src="' + esc(embedSrc) + '" scrolling="no" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen style="background:#000;overflow:hidden"></iframe>' +
              '<p style="text-align:center;margin-top:14px"><a class="lb-open" href="' + esc(normURL(w.src)) + '" target="_blank" rel="noopener">Buka di platform asli ↗</a></p>';
          } else {
            // Frame embed landscape mengikuti rasio karya (mis. 16/9), supaya
            // kotaknya pas dengan video: tidak ada hitam berlebih atas-bawah
            // dan bagian atas frame tidak menempel ke tepi layar.
            var rp2 = String(w.ratio || '16/9').split('/');
            var rn2 = parseFloat(rp2[0]) || 16, rd2 = parseFloat(rp2[1]) || 9;
            var ar2 = rn2 / rd2; if (!(ar2 > 0)) ar2 = 16 / 9;
            m.innerHTML = '<iframe class="lb-frame" src="' + esc(embedSrc) + '" scrolling="no" sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-presentation" allow="autoplay; fullscreen; encrypted-media; picture-in-picture" allowfullscreen style="background:#000;overflow:hidden;width:min(94vw, calc((100vh - 300px) * ' + ar2.toFixed(4) + '), 1150px);aspect-ratio:' + rn2 + ' / ' + rd2 + ';height:auto"></iframe>' +
              '<p style="text-align:center;margin-top:14px"><a class="lb-open" href="' + esc(normURL(w.src)) + '" target="_blank" rel="noopener">Buka di platform asli ↗</a></p>';
          }
        }
      } else {
        m.innerHTML = '<video src="' + esc(w.src) + '"' + (w.poster ? ' poster="' + esc(w.poster) + '"' : '') +
          ' controls playsinline class="' + (w.ratio === '9/16' ? 'portrait' : '') + '"></video>';
      }
    } else if (w.type === 'webapp') {
      if (w.newTab) {
        // Karya pengantar saja: tampilkan poster + tombol ke website asli,
        // tanpa menanam website itu di dalam halaman ini.
        m.innerHTML = (w.poster ? '<img src="' + esc(w.poster) + '" alt="' + esc(w.title) + '" />' : '') +
          '<p style="text-align:center;margin-top:16px"><a class="lb-open" href="' + esc(normURL(w.src)) + '" target="_blank" rel="noopener">Buka ' + esc(w.title) + ' ↗</a></p>';
      } else {
        var fr = document.createElement('iframe');
        fr.className = 'lb-frame';
        fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
        if (/^data:/.test(w.src)) fr.srcdoc = decodeDataURL(w.src); else fr.src = normURL(w.src);
        m.innerHTML = ''; m.appendChild(fr);
      }
    } else {
      m.innerHTML = '<img src="' + esc(w.src) + '" alt="' + esc(w.title) + '" />';
    }
  }

  document.addEventListener('click', function (e) {
    var b = e.target.closest('.s-btn[data-copy]');
    if (!b) return;
    var u = b.getAttribute('data-copy');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(u).then(function () { alert('Link tersalin ✓\n' + u); });
    } else { window.prompt('Salin link:', u); }
  });

  SiteData.init().then(function () {
    var id = new URLSearchParams(window.location.search).get('id');
    var data = SiteData.get();
    var w = data.works.find(function (x) { return x.id === id; }) || data.works[0];
    render(w);
  }).catch(function () {
    render(SiteData.get().works[0]);
  });
})();
