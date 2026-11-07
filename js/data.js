/* ============================================================
   STIVEN — data layer
   Seed content + localStorage persistence (with safe fallback)
   ============================================================ */
window.SiteData = (function () {
  'use strict';

  var KEY = 'stiven_site_v3'; // v3: tambah tipe karya web app + demo

  var seed = {
    profile: {
      name: 'STIVEN',
      role: 'Visual Designer & Videographer',
      headlineA: 'MY NAME IS STIVEN',
      headlineB: '{{And This is My World}}',
      portraitCaption: 'A. STIVEN R.',
      aboutTitle: 'The human behind {{the lens}}',
      worksTitle: 'Selected {{works}}',
      ctaTitle: "LET'S WORK {{together}}",
      tagline: 'Design, film & motion — crafted in Jayapura, Papua, Indonesia.',
      bio: [
        "I'm Stiven — a visual designer and videographer based in Jayapura, Papua. I turn ideas into moving images and bold graphics that people remember.",
        'From brand identities and logos to banners, posters and social content — plus landscape and vertical video — every piece is made with care, from the first sketch to the final frame.',
        "When I'm not behind the camera or the design tool, I'm out exploring Papua, drinking strong kopi, and hunting for the next story worth telling."
      ],
      location: 'Jayapura, Papua — Indonesia',
      email: 'hello@stiven.dev',
      phone: '+62 812-3456-7890',
      availability: 'Available for freelance',
      heroImage: 'assets/hero.jpg',
      portrait: 'assets/portrait.jpg',
      services: ['Video & Film', 'Graphic Design', 'Motion', 'Branding', 'Logo', 'Banner', 'Social Content'],
      stats: [
        { value: '6', suffix: '+', label: 'Years experience' },
        { value: '48', suffix: '+', label: 'Projects delivered' },
        { value: '12', suffix: '', label: 'Awards & features' },
        { value: '20', suffix: '+', label: 'Happy clients' }
      ],
      socials: [
        { name: 'Instagram', url: '#' },
        { name: 'YouTube', url: '#' },
        { name: 'TikTok', url: '#' },
        { name: 'Behance', url: '#' }
      ]
    },
    works: [
      { id: 'w1', type: 'video', ratio: '16/9', category: 'Showreel', title: 'Showreel 2026', desc: 'A year of motion in 60 seconds — landscape cut.', src: 'assets/videos/reel-landscape.mp4', poster: 'assets/videos/reel-landscape-poster.jpg' },
      { id: 'w2', type: 'design', ratio: '16/9', category: 'Banner', title: 'Amberfest — Event Banner', desc: 'Main stage banner for the Amberfest music festival.', src: 'assets/designs/banner-event.jpg', poster: '' },
      { id: 'w3', type: 'video', ratio: '9/16', category: 'Social', title: 'Vertical Teaser', desc: 'Portrait 9:16 teaser made for TikTok / Reels / Shorts.', src: 'assets/videos/teaser-portrait.mp4', poster: 'assets/videos/teaser-portrait-poster.jpg' },
      { id: 'w4', type: 'design', ratio: '1/1', category: 'Logo', title: 'Kopi Lokal — Logo', desc: 'Minimal amber mark for a local coffee brand.', src: 'assets/designs/logo-coffee.jpg', poster: '' },
      { id: 'w5', type: 'video', ratio: '16/9', category: 'Commercial', title: 'Kopi Lokal — Brand Film', desc: '16:9 landscape brand film for a coffee company.', src: 'assets/videos/brandfilm-landscape.mp4', poster: 'assets/videos/brandfilm-landscape-poster.jpg' },
      { id: 'w6', type: 'design', ratio: '2/3', category: 'Poster', title: 'Suara Timur — Poster', desc: 'Festival poster, bold grotesk type on amber grain.', src: 'assets/designs/poster-festival.jpg', poster: '' },
      { id: 'w7', type: 'design', ratio: '1/1', category: 'Social Media', title: 'New Drop — Social Post', desc: 'Square launch post for a streetwear drop.', src: 'assets/designs/social-post.jpg', poster: '' },
      { id: 'w8', type: 'design', ratio: '1/1', category: 'Branding', title: 'Stiven Studio — Identity', desc: 'Stationery & identity presentation for the studio.', src: 'assets/designs/branding.jpg', poster: '' }
      // RULE (7 Nov 2026): karya yang sudah dihapus pemiliknya TIDAK BOLEH
      // muncul lagi di mana pun — tidak di seed ini, tidak di data cloud,
      // tidak di localStorage, dan file-nya (poster/share/og) dihapus dari repo.
      // Color Lab (w9) dihapus dari seed ini karena pemiliknya sengaja menghapusnya.
    ]
  };

  var mem = null; // in-memory fallback when localStorage is unavailable (e.g. sandboxed iframe)

  function supaClient() {
    if (window.SUPABASE_URL && window.SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
      if (!window.__supa) window.__supa = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      return window.__supa;
    }
    return null;
  }

  var lastCloudError = '';
  var lastCloudSavedAt = 0;
  var lastCloudPromise = null;
  // PENGAMAN ANTI-HILANG (7 Nov 2026, mandat ambil alih penuh): simpan Admin
  // dulu menulis SELURUH baris cloud dari snapshot browser itu saja — browser
  // lama yang datanya belum lengkap ikut menghapus karya yang ditambahkan di
  // tempat lain (Color Lab hilang 3x, MONEY POLITIC hilang, rasio Car kembali).
  // Sekarang, SEBELUM upsert, data cloud terbaru dibaca dulu dan DIGABUNG:
  // karya yang hanya ada di cloud ikut tersimpan (tidak ada yang hilang),
  // karya yang sengaja dihapus tetap hilang berkat daftar tombstone
  // (deletedWorkIds) — daftar itu disimpan di dalam baris data sendiri,
  // jadi berlaku di semua browser. Kalau baca cloud gagal (jaringan),
  // simpan tetap jalan seperti dulu (upsert data lokal) supaya tidak
  // memblokir Bebeb.
  var lastCloudMerged = 0;
  function lastCloudMergedCount() { return lastCloudMerged; }
  function mergeData(local, cloud) {
    var tomb = {};
    (local.deletedWorkIds || []).forEach(function (id) { tomb[id] = true; });
    (cloud.deletedWorkIds || []).forEach(function (id) { tomb[id] = true; });
    var seen = {};
    var works = [];
    (local.works || []).forEach(function (w) {
      if (w && w.id && !tomb[w.id] && !seen[w.id]) { seen[w.id] = true; works.push(w); }
    });
    var added = 0;
    (cloud.works || []).forEach(function (w) {
      if (w && w.id && !tomb[w.id] && !seen[w.id]) { seen[w.id] = true; works.push(w); added++; }
    });
    var out = {};
    Object.keys(local).forEach(function (k) { out[k] = local[k]; });
    out.works = works;
    out.deletedWorkIds = Object.keys(tomb);
    return { data: out, added: added };
  }
  // Simpan ke cloud dan KEMBALIKAN promise-nya, supaya Admin bisa menunggu
  // hasil nyatanya, bukan cuma menganggap tersimpan. Kalau gagal (mis.
  // jaringan putus sesaat), coba sekali lagi setelah 1,2 detik.
  function cloudSave(data) {
    var c = supaClient();
    lastCloudMerged = 0;
    if (!c) { lastCloudError = 'Supabase belum dikonfigurasi'; lastCloudPromise = Promise.resolve(false); return lastCloudPromise; }
    function attempt(payload, left) {
      var p;
      try {
        p = c.from('site_data').upsert({ id: 1, data: payload, updated_at: new Date().toISOString() });
      } catch (e) {
        lastCloudError = e && e.message ? e.message : String(e);
        lastCloudPromise = Promise.resolve(false);
        return lastCloudPromise;
      }
      return p.then(function (res) {
        if (res && res.error) {
          if (left > 0) {
            return new Promise(function (resolve) { setTimeout(function () { resolve(attempt(payload, left - 1)); }, 1200); });
          }
          lastCloudError = res.error.message || String(res.error);
          if (window.console && console.error) console.error('Supabase save gagal:', res.error);
          return false;
        }
        lastCloudError = '';
        lastCloudSavedAt = Date.now();
        // Snapshot lokal ikut diperbarui dengan hasil gabungan, supaya
        // browser ini tidak lagi menyimpan dari data yang belum lengkap.
        try { window.localStorage.setItem(KEY, JSON.stringify(payload)); } catch (e) {}
        return true;
      }, function (err) {
        if (left > 0) {
          return new Promise(function (resolve) { setTimeout(function () { resolve(attempt(payload, left - 1)); }, 1200); });
        }
        lastCloudError = (err && err.message) || String(err);
        if (window.console && console.error) console.error('Supabase save gagal:', err);
        return false;
      });
    }
    function fetchAndSave(left) {
      var q;
      try {
        q = c.from('site_data').select('data').eq('id', 1).maybeSingle();
      } catch (e) {
        return attempt(data, 1);
      }
      // Batasi tunggu baca cloud 10 detik: kalau lelet, jangan gantung
      // simpan — lanjut upsert data lokal seperti dulu.
      var timed = new Promise(function (resolve) {
        var done = false;
        var t = setTimeout(function () { if (!done) { done = true; resolve(null); } }, 10000);
        q.then(function (res) { if (!done) { done = true; clearTimeout(t); resolve(res); } },
               function () { if (!done) { done = true; clearTimeout(t); resolve(null); } });
      });
      return timed.then(function (res) {
        if (res && !res.error && res.data && res.data.data && res.data.data.works) {
          var m = mergeData(data, res.data.data);
          lastCloudMerged = m.added;
          return attempt(m.data, 1);
        }
        if (res && res.error && left > 0) {
          return new Promise(function (resolve) { setTimeout(function () { resolve(fetchAndSave(left - 1)); }, 1200); });
        }
        return attempt(data, 1);
      });
    }
    lastCloudPromise = fetchAndSave(1);
    return lastCloudPromise;
  }
  function lastCloudError() { return lastCloudError; }
  function lastCloudPromise() { return lastCloudPromise; }
  function cloudSavedAt() { return lastCloudSavedAt; }

  // dipanggil saat halaman dibuka: kalau Supabase terkonfigurasi,
  // data diambil dari cloud lalu disalin ke cache lokal.
  // Kalau muat cloud gagal (mis. jaringan putus sesaat), coba sekali lagi
  // setelah 1,5 detik, supaya browser lain tidak langsung jatuh ke data
  // contoh hanya karena satu kali gagal muat.
  function doInit() {
    var c = supaClient();
    if (!c) return Promise.resolve(false);
    function loadOnce() {
      return c.from('site_data').select('data').eq('id', 1).maybeSingle();
    }
    function handle(res) {
      if (res && res.error) {
        lastCloudError = res.error.message || String(res.error);
        if (window.console && console.error) console.error('Supabase load gagal:', res.error);
        return false;
      }
      if (res && res.data && res.data.data) {
        mem = res.data.data;
        try { window.localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {}
        lastCloudError = '';
        return true;
      }
      // cloud masih kosong → kalau ada data lokal (dari sebelum Supabase aktif), migrasikan ke cloud
      try {
        var raw = window.localStorage.getItem(KEY);
        if (raw) {
          var local = JSON.parse(raw);
          if (local && local.profile && local.works) {
            mem = local;
            cloudSave(local);
            return true;
          }
        }
      } catch (e) {}
      return false;
    }
    return loadOnce().then(function (res) {
      if (res && res.error) {
        return new Promise(function (resolve) {
          setTimeout(function () { loadOnce().then(function (res2) { resolve(handle(res2)); }).catch(function () { resolve(false); }); }, 1500);
        });
      }
      return handle(res);
    }).catch(function () {
      return new Promise(function (resolve) {
        setTimeout(function () { loadOnce().then(function (res2) { resolve(handle(res2)); }).catch(function () { resolve(false); }); }, 1500);
      });
    });
  }

  // tunggu library supabase (lokal/CDN) siap, maks 3 detik, baru inisialisasi cloud
  function init() {
    var tries = 0;
    return new Promise(function (resolve) {
      (function wait() {
        if (supaClient() || !isCloud() || tries++ > 30) resolve(doInit());
        else setTimeout(wait, 100);
      })();
    });
  }

  function isCloud() { return !!(window.SUPABASE_URL && window.SUPABASE_ANON_KEY); }

  function load() {
    try {
      var raw = window.localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* blocked */ }
    return mem;
  }

  function save(data) {
    mem = data;
    cloudSave(data);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(data));
      return { ok: true, persistent: true };
    } catch (e) {
      return { ok: false, persistent: false };
    }
  }

  function reset() {
    mem = null;
    try { window.localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    var c = supaClient();
    if (c) { try { c.from('site_data').delete().eq('id', 1).then(function () {}, function () {}); } catch (e) {} }
  }

  function get() {
    var d = load();
    if (!d || !d.profile || !d.works) return JSON.parse(JSON.stringify(seed));
    return d;
  }

  function update(patch) {
    var d = get();
    if (patch.profile) d.profile = Object.assign({}, d.profile, patch.profile);
    if (patch.works) d.works = patch.works;
    return save(d);
  }

  return {
    isCloud: isCloud,
    init: init,
    get: get,
    save: save,
    update: update,
    reset: reset,
    lastCloudError: lastCloudError,
    lastCloudPromise: lastCloudPromise,
    lastCloudMergedCount: lastCloudMergedCount,
    cloudSavedAt: cloudSavedAt,
    seed: function () { return JSON.parse(JSON.stringify(seed)); }
  };
})();
