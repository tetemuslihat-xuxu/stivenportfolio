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
    setMeta('og:type', w.type === 'video' ? 'video.other' : 'website');
    setMeta('og:image', ogImg);
    setMeta('twitter:card', 'summary_large_image');
    setMeta('twitter:title', w.title + ' — STIVEN Portfolio');
    setMeta('twitter:description', w.desc || '');
    setMeta('twitter:image', ogImg);
    if (w.type === 'video') {
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
      m.innerHTML = '<video src="' + esc(w.src) + '"' + (w.poster ? ' poster="' + esc(w.poster) + '"' : '') +
        ' controls playsinline class="' + (w.ratio === '9/16' ? 'portrait' : '') + '"></video>';
    } else if (w.type === 'webapp') {
      var fr = document.createElement('iframe');
      fr.className = 'lb-frame';
      fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
      if (/^data:/.test(w.src)) fr.srcdoc = decodeDataURL(w.src); else fr.src = w.src;
      m.innerHTML = ''; m.appendChild(fr);
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
