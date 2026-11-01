(() => {
  const $ = (id) => document.getElementById(id);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = (u) => (/^(https?:\/\/|\/|mailto:|tel:)/i.test(u || '') ? u : '');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canHover = matchMedia('(hover: hover)').matches;

  /* ---------------- Theme / nav / menu ---------------- */
  const root = document.documentElement;
  root.dataset.theme = localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
  $('themeBtn').onclick = () => {
    root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', root.dataset.theme);
  };
  $('menuBtn').onclick = () => $('links').classList.toggle('open');
  $('links').addEventListener('click', (e) => { if (e.target.closest('a')) $('links').classList.remove('open'); });

  /* ---------------- Scroll effects ---------------- */
  const nav = $('nav'), progress = $('progress'), toTop = $('toTop');
  const sections = ['about', 'skills', 'projects', 'experience', 'contact'].map(id => $(id));
  let lastY = 0, ticking = false;
  function onScroll() {
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    progress.style.width = (h > 0 ? (y / h) * 100 : 0) + '%';
    nav.classList.toggle('scrolled', y > 10);
    nav.classList.toggle('hide', y > lastY + 4 && y > 400 && !$('links').classList.contains('open'));
    if (y < lastY - 4) nav.classList.remove('hide');
    lastY = y;
    toTop.classList.toggle('show', y > 700);
    let cur = '';
    sections.forEach(s => { if (s && s.getBoundingClientRect().top < innerHeight * 0.4) cur = s.id; });
    $$('#links a[data-sec]').forEach(a => a.classList.toggle('active', a.dataset.sec === cur));
    $$('.timeline').forEach(t => {
      const r = t.getBoundingClientRect();
      const p = Math.max(0, Math.min(1, (innerHeight * 0.6 - r.top) / r.height));
      t.style.setProperty('--fill', (p * 100).toFixed(1) + '%');
    });
    ticking = false;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  toTop.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  onScroll();

  /* cursor glow */
  const glow = $('cursorGlow');
  if (canHover && !reduced) {
    let gx = innerWidth / 2, gy = innerHeight / 2, tx = gx, ty = gy;
    addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; }, { passive: true });
    (function loop() { gx += (tx - gx) * .12; gy += (ty - gy) * .12; glow.style.transform = `translate(${gx}px,${gy}px)`; requestAnimationFrame(loop); })();
  }

  /* ---------------- Particle network background ---------------- */
  (function particles() {
    const cv = $('bgCanvas'); if (!cv || reduced) return;
    const ctx = cv.getContext('2d');
    let W, H, pts = [], mouse = { x: -999, y: -999 }, running = true;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    function size() {
      W = cv.width = innerWidth * dpr; H = cv.height = innerHeight * dpr;
      const n = Math.min(90, Math.floor((innerWidth * innerHeight) / 22000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .35 * dpr, vy: (Math.random() - .5) * .35 * dpr, r: (Math.random() * 1.4 + .6) * dpr }));
    }
    size(); addEventListener('resize', size);
    addEventListener('mousemove', (e) => { mouse.x = e.clientX * dpr; mouse.y = e.clientY * dpr; }, { passive: true });
    document.addEventListener('visibilitychange', () => { running = !document.hidden; if (running) draw(); });
    function draw() {
      if (!running) return;
      ctx.clearRect(0, 0, W, H);
      const link = 140 * dpr;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if (dm < 160 * dpr) { p.x += (p.x - mouse.x) * .004; p.y += (p.y - mouse.y) * .004; }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283); ctx.fillStyle = 'rgba(129,140,248,.8)'; ctx.fill();
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], d = Math.hypot(p.x - q.x, p.y - q.y);
          if (d < link) { ctx.strokeStyle = `rgba(99,102,241,${(1 - d / link) * .35})`; ctx.lineWidth = dpr * .7; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
        }
        if (dm < 190 * dpr) { ctx.strokeStyle = `rgba(34,211,238,${(1 - dm / (190 * dpr)) * .5})`; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); }
      }
      requestAnimationFrame(draw);
    }
    draw();
  })();

  /* ---------------- Helpers ---------------- */
  function socialLinks(p) {
    const items = [['GitHub', p.github], ['LinkedIn', p.linkedin], ['Twitter', p.twitter], ['Website', p.website]].filter(([, u]) => safeUrl(u));
    if (p.email) items.push(['Email', 'mailto:' + p.email]);
    return items.map(([n, u]) => `<a href="${esc(safeUrl(u))}" target="_blank" rel="noopener noreferrer">${n}</a>`).join('');
  }

  function splitLetters(el, text) {
    el.innerHTML = [...text].map((c, i) => c === ' ' ? ' ' : `<span class="ch" style="--i:${i}">${esc(c)}</span>`).join('');
    el.setAttribute('aria-label', text);
  }

  function typeRoles(el, roles) {
    roles = roles.filter(Boolean);
    if (!roles.length) return;
    if (reduced) { el.textContent = roles[0]; return; }
    let r = 0, c = 0, del = false;
    (function tick() {
      const word = roles[r];
      el.textContent = word.slice(0, c);
      let wait = del ? 40 : 85;
      if (!del && c === word.length) { if (roles.length === 1) return; wait = 1800; del = true; }
      else if (del && c === 0) { del = false; r = (r + 1) % roles.length; wait = 350; }
      else c += del ? -1 : 1;
      setTimeout(tick, wait);
    })();
  }

  function counter(el, value) {
    const m = String(value).match(/^(\D*)(\d+(?:\.\d+)?)(.*)$/);
    if (!m || reduced) { el.textContent = value; return; }
    const [, pre, num, suf] = m, target = parseFloat(num), dec = (num.split('.')[1] || '').length;
    const t0 = performance.now(), dur = 1600;
    (function step(t) {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 4);
      el.textContent = pre + (target * e).toFixed(dec) + suf;
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  }

  const ICONS = { frontend: '🎨', backend: '⚙️', database: '🗄️', tools: '🛠️', devops: '🚀', design: '✏️', mobile: '📱', languages: '💻', cloud: '☁️' };

  /* ---------------- Render ---------------- */
  function render(d) {
    const p = d.profile;
    document.title = `${p.name} — ${p.title}`;
    document.querySelector('meta[name=description]').content = p.tagline || p.title;
    $('logo').textContent = p.name;
    $('preLogo').textContent = (p.name || 'P').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
    splitLetters($('heroName'), p.name);
    const roles = (p.roles ? String(p.roles).split(',') : String(p.title).split(/[|/]/)).map(s => s.trim());
    typeRoles($('typed'), roles.length ? roles : [p.title]);
    $('heroTagline').textContent = p.tagline;
    $('availBadge').hidden = !p.available;

    if (p.photo) {
      ['photo', 'aboutPhoto'].forEach(id => { $(id).src = p.photo; $(id).hidden = false; });
      $('photoFallback').hidden = true; $('aboutPhotoFallback').hidden = true;
    }
    if (p.resume) { ['resumeBtn', 'aboutResume'].forEach(id => { $(id).href = p.resume; $(id).hidden = false; }); }
    $('heroSocials').innerHTML = socialLinks(p);
    $('footerSocials').innerHTML = socialLinks(p);
    $('footerText').textContent = `© ${new Date().getFullYear()} ${p.name}. All rights reserved.`;

    // Floating tech badges (top skills)
    const top = [...d.skills].sort((a, b) => b.level - a.level).slice(0, 4);
    $('floatBadges').innerHTML = top.map(s => `<span>${esc(s.name)}</span>`).join('');

    // Stats
    $('stats').innerHTML = (p.stats || []).filter(s => s.value).map(s => `<div class="stat reveal"><b data-count="${esc(s.value)}">0</b><span>${esc(s.label)}</span></div>`).join('');

    // Marquee
    const words = [...new Set([...d.skills.map(s => s.name), ...d.projects.flatMap(x => x.tech)])];
    if (words.length) {
      let list = [...words]; while (list.length < 8) list = list.concat(words);
      const html = list.map(w => `<span>${esc(w)}</span>`).join('');
      $('marqueeTrack').innerHTML = html + html;
    } else $('marquee').hidden = true;

    // About
    $('aboutName').textContent = p.name;
    $('aboutRole').textContent = p.title;
    const paras = String(p.about || '').split(/\n\s*\n|\n/).map(s => s.trim()).filter(Boolean);
    $('aboutText').innerHTML = paras.map(t => `<p>${esc(t)}</p>`).join('');
    const info = [['📍', 'Location', p.location], ['✉️', 'Email', p.email], ['📞', 'Phone', p.phone]].filter(([, , v]) => v);
    const infoHtml = (arr) => arr.map(([i, k, v]) => `<li><i>${i}</i><div><small>${k}</small>${esc(v)}</div></li>`).join('');
    $('aboutInfo').innerHTML = infoHtml(info);
    $('contactInfo').innerHTML = infoHtml(info);

    let hl = Array.isArray(p.highlights) ? p.highlights.filter(h => h && h.title) : [];
    if (!hl.length) {
      const groups = {};
      d.skills.forEach(s => (groups[s.category] ||= []).push(s));
      hl = Object.entries(groups).slice(0, 4).map(([g, list]) => ({
        icon: ICONS[g.toLowerCase()] || '⚡', title: g,
        text: 'Working with ' + list.sort((a, b) => b.level - a.level).slice(0, 4).map(s => s.name).join(', ') + '.'
      }));
    }
    $('highlights').innerHTML = hl.slice(0, 4).map(h => `<div class="hl reveal"><div class="ico">${esc(h.icon || '✦')}</div><h5>${esc(h.title)}</h5><p>${esc(h.text)}</p></div>`).join('');

    // Skills
    const groups = {};
    d.skills.forEach(s => (groups[s.category] ||= []).push(s));
    $('skillsGrid').innerHTML = Object.entries(groups).map(([g, list]) => `
      <div class="skill-group reveal"><h4>${esc(g)}</h4>
      ${list.map(s => `<div class="skill"><div class="skill-top"><span>${esc(s.name)}</span><span>${s.level}%</span></div><div class="bar"><i data-w="${s.level}"></i></div></div>`).join('')}
      </div>`).join('') || '<p class="muted">No skills added yet.</p>';

    // Projects + filters
    const projs = [...d.projects].sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    $('projectsGrid').innerHTML = projs.map(pr => `
      <article class="project reveal" data-tech="${esc(pr.tech.join('|').toLowerCase())}">
        <div class="thumb">${pr.image ? `<img src="${esc(pr.image)}" alt="${esc(pr.title)}" loading="lazy">` : '💻'}${pr.featured ? '<span class="star">★ Featured</span>' : ''}</div>
        <div class="project-body">
          <h4>${esc(pr.title)}</h4>
          <p>${esc(pr.description)}</p>
          <div class="tags">${pr.tech.map(t => `<span>${esc(t)}</span>`).join('')}</div>
          <div class="project-links">
            ${safeUrl(pr.live) ? `<a href="${esc(pr.live)}" target="_blank" rel="noopener noreferrer">Live demo ↗</a>` : ''}
            ${safeUrl(pr.repo) ? `<a href="${esc(pr.repo)}" target="_blank" rel="noopener noreferrer">Source ↗</a>` : ''}
          </div>
        </div>
      </article>`).join('') || '<p class="muted">No projects added yet.</p>';

    const techs = [...new Set(projs.flatMap(x => x.tech))].slice(0, 7);
    $('filters').innerHTML = techs.length > 1 ? ['All', ...techs].map((t, i) => `<button class="chip ${i ? '' : 'active'}" data-f="${esc(t.toLowerCase())}">${esc(t)}</button>`).join('') : '';
    $('filters').onclick = (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      $$('.chip').forEach(c => c.classList.toggle('active', c === b));
      const f = b.dataset.f;
      $$('.project').forEach(card => {
        const show = f === 'all' || card.dataset.tech.split('|').includes(f);
        card.classList.toggle('gone', !show);
        if (show) { card.classList.remove('in'); void card.offsetWidth; card.classList.add('in'); }
      });
    };

    // Timelines
    const tl = (arr, a, b) => arr.map(x => `
      <div class="t-item reveal from-left"><span class="t-date">${esc(x.start)} — ${esc(x.end)}</span>
      <h4>${esc(x[a])}</h4><div class="t-sub">${esc(x[b])}</div>${x.description ? `<p>${esc(x.description)}</p>` : ''}</div>`).join('') || '<p class="muted">Nothing here yet.</p>';
    $('expTimeline').innerHTML = tl(d.experience, 'role', 'company');
    $('eduTimeline').innerHTML = d.education.map(x => `
      <div class="t-item reveal from-left"><span class="t-date">${esc(x.start)} — ${esc(x.end)}</span>
      <h4>${esc(x.degree)}</h4>
      ${x.college ? `<div class="t-sub">🏫 ${esc(x.college)}</div>` : ''}
      ${x.school ? `<div class="t-sub">${esc(x.school)}</div>` : ''}
      ${x.percentage ? `<span class="score">🎯 ${esc(x.percentage)}</span>` : ''}</div>`).join('') || '<p class="muted">Nothing here yet.</p>';

    // Stagger delays
    ['stats', 'highlights', 'skillsGrid', 'projectsGrid', 'expTimeline', 'eduTimeline'].forEach(id => {
      [...$(id).children].forEach((el, i) => el.style.setProperty('--d', (i % 4) * 0.1 + 's'));
    });

    initObservers();
    initTilt();
    onScroll();
  }

  /* ---------------- Reveal / counters / bars ---------------- */
  function initObservers() {
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      el.classList.add('in');
      $$('.bar i', el).forEach(i => i.style.width = i.dataset.w + '%');
      $$('[data-count]', el).forEach(c => counter(c, c.dataset.count));
      io.unobserve(el);
    }), { threshold: .15, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal').forEach(el => io.observe(el));
  }

  /* ---------------- Tilt + magnetic ---------------- */
  function initTilt() {
    if (!canHover || reduced) return;
    const photo = $('tiltPhoto');
    const hero = $('home');
    hero.addEventListener('mousemove', (e) => {
      const r = photo.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      photo.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 18}deg)`;
    });
    hero.addEventListener('mouseleave', () => photo.style.transform = '');

    $$('.project').forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const r = card.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
        card.style.transform = `translateY(-8px) rotateY(${x * 9}deg) rotateX(${-y * 9}deg)`;
      });
      card.addEventListener('mouseleave', () => card.style.transform = '');
    });

    $$('.magnetic').forEach(b => {
      b.addEventListener('mousemove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * .22}px,${(e.clientY - r.top - r.height / 2) * .35 - 3}px)`;
      });
      b.addEventListener('mouseleave', () => b.style.transform = '');
    });
  }

  /* ---------------- Boot ---------------- */
  let done = false;
  function reveal() {
    if (done) return; done = true;
    document.body.classList.remove('loading');
    document.body.classList.add('ready');
  }
  const minWait = new Promise(r => setTimeout(r, reduced ? 0 : 1100));
  fetch('/api/portfolio').then(r => r.json()).then(render)
    .catch(() => { $('heroName').textContent = 'Unable to load portfolio'; })
    .then(() => minWait).then(reveal);
  setTimeout(reveal, 4000);

  /* ---------------- Contact form ---------------- */
  $('contactForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, st = $('formStatus');
    st.className = 'form-status'; st.textContent = 'Sending…';
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(f))) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || 'Failed');
      st.className = 'form-status ok'; st.textContent = 'Thanks! Your message has been sent.'; f.reset();
    } catch (err) { st.className = 'form-status err'; st.textContent = err.message; }
  });
})();
