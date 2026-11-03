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
    return (p.socials || []).map(function (s) { return '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + ' ↗</a>'; }).join('');
  }
  document.getElementById('socials').innerHTML = socialsHTML();
  document.getElementById('footSocials').innerHTML = socialsHTML();

  // marquee
  var items = ['Video', 'Web App', 'Graphic Design', 'Motion', 'Branding', 'Logo', 'Banner', 'Poster', 'Social Content', 'Landscape 16:9', 'Portrait 9:16'];
  var seq = items.map(function (t) { return '<span>' + esc(t) + ' ✦</span>'; }).join('');
  document.getElementById('marqueeTrack').innerHTML = seq + seq;

  document.getElementById('year').textContent = new Date().getFullYear();

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
        '<div class="meta"><h3>' + esc(w.title) + '</h3><span class="cat">' + esc(w.category || w.type) + '</span></div>' +
        (w.desc ? '<p class="desc">' + esc(w.desc) + '</p>' : '') +
      '</article>';
    }).join('');
    // observe new cards
    grid.querySelectorAll('.reveal').forEach(function (el) { revealIO.observe(el); });
    // bind clicks
    grid.querySelectorAll('.card').forEach(function (card) {
      card.addEventListener('click', function () {
        openLightbox(parseInt(card.getAttribute('data-idx'), 10));
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

  function openLightbox(i) {
    if (!visible.length) return;
    lbIndex = (i + visible.length) % visible.length;
    var w = visible[lbIndex];
    if (w.type === 'webapp') {
      var fr = document.createElement('iframe');
      fr.className = 'lb-frame';
      fr.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms allow-popups allow-modals');
      if (/^data:/.test(w.src)) { fr.srcdoc = decodeDataURL(w.src); } else { fr.src = w.src; }
      lbStage.innerHTML = '';
      lbStage.appendChild(fr);
    } else if (w.type === 'video') {
      lbStage.innerHTML = '<video src="' + esc(w.src) + '"' + (w.poster ? ' poster="' + esc(w.poster) + '"' : '') +
        ' controls autoplay playsinline class="' + (w.ratio === '9/16' ? 'portrait' : '') + '"></video>';
    } else {
      lbStage.innerHTML = '<img src="' + esc(w.src) + '" alt="' + esc(w.title) + '" />';
    }
    lbCaption.innerHTML = '<span class="cat">' + esc(w.category || w.type) + ' · ' + esc(w.ratio || '') + '</span><h3>' + esc(w.title) + '</h3>' + (w.desc ? '<p>' + esc(w.desc) + '</p>' : '');
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
    lbCount.textContent = (lbIndex + 1) + ' / ' + visible.length;
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    lb.classList.remove('open');
    lbStage.innerHTML = '';
    document.body.style.overflow = '';
  }
  function step(d) { openLightbox(lbIndex + d); }

  document.getElementById('lbClose').addEventListener('click', closeLightbox);
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
