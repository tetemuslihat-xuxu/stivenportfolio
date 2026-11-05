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
      { id: 'w8', type: 'design', ratio: '1/1', category: 'Branding', title: 'Stiven Studio — Identity', desc: 'Stationery & identity presentation for the studio.', src: 'assets/designs/branding.jpg', poster: '' },
      { id: 'w9', type: 'webapp', ratio: '16/10', category: 'Web App Demo', title: 'Color Lab — Palette Generator', desc: 'Interactive web app: click GENERATE for a palette, click a swatch to copy its hex. Try the live demo!', src: 'assets/demo-app.html', poster: '' }
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

  function cloudSave(data) {
    var c = supaClient();
    if (c) {
      try {
        c.from('site_data').upsert({ id: 1, data: data, updated_at: new Date().toISOString() })
          .then(function () {}, function () {});
      } catch (e) { /* abaikan */ }
    }
  }

  // dipanggil saat halaman dibuka: kalau Supabase terkonfigurasi,
  // data diambil dari cloud lalu disalin ke cache lokal
  function doInit() {
    var c = supaClient();
    if (!c) return Promise.resolve(false);
    return c.from('site_data').select('data').eq('id', 1).maybeSingle().then(function (res) {
      if (res && res.data && res.data.data) {
        mem = res.data.data;
        try { window.localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {}
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
    }).catch(function () { return false; });
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
    seed: function () { return JSON.parse(JSON.stringify(seed)); }
  };
})();
