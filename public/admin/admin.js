(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Set this to the deployed Render backend URL before publishing on Vercel.
  const API_BASE = (window.PORTFOLIO_API_BASE || 'https://YOUR-RENDER-SERVICE.onrender.com').replace(/\/$/, '');
  let data = null, tab = 'profile', mustChange = false;

  async function api(url, method = 'GET', body) {
    const opt = { method, headers: {} };
    const token = localStorage.getItem('portfolioAdminToken');
    if (token) opt.headers.Authorization = `Bearer ${token}`;
    opt.credentials = 'include';
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    const r = await fetch(`${API_BASE}${url}`, opt);
    const j = await r.json().catch(() => ({}));
    if (r.status === 401 && !url.includes('login')) { showLogin(); throw new Error('Session expired'); }
    if (!r.ok) throw new Error(j.error || 'Request failed');
    if (url.includes('/api/admin/login') && j.token) localStorage.setItem('portfolioAdminToken', j.token);
    if (url.includes('/api/admin/logout')) localStorage.removeItem('portfolioAdminToken');
    return j;
  }
  function toast(msg, err) {
    const t = $('toast'); t.textContent = msg; t.className = 'toast show' + (err ? ' err' : '');
    clearTimeout(toast.t); toast.t = setTimeout(() => t.className = 'toast', 2600);
  }
  const guard = (fn) => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message, true); } };

  // ---------- Auth ----------
  function showLogin() { $('appView').hidden = true; $('loginView').hidden = false; }
  async function boot() {
    try {
      const me = await api('/api/admin/me');
      mustChange = me.mustChange;
      await load();
      $('loginView').hidden = true; $('appView').hidden = false;
      if (mustChange) { tab = 'account'; toast('Please change the default password', true); }
      setTab(tab);
    } catch { showLogin(); }
  }
  $('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); $('loginErr').textContent = '';
    try {
      await api('/api/admin/login', 'POST', Object.fromEntries(new FormData(e.target)));
      e.target.reset(); boot();
    } catch (err) { $('loginErr').textContent = err.message; }
  });
  $('logoutBtn').onclick = async () => { await api('/api/admin/logout', 'POST'); showLogin(); };

  async function load() {
    data = await api('/api/admin/data');
    const n = data.messages.filter(m => !m.read).length;
    $('unread').hidden = !n; $('unread').textContent = n;
  }

  $('tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (b) setTab(b.dataset.tab);
  });
  function setTab(t) {
    tab = t;
    document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === t));
    ({ profile: renderProfile, skills: () => renderList('skills'), projects: () => renderList('projects'),
       experience: () => renderList('experience'), education: () => renderList('education'),
       messages: renderMessages, account: renderAccount })[t]();
  }
  const panel = (html) => $('panel').innerHTML = html;

  // ---------- Upload helper ----------
  async function upload(kind, file, target) {
    const fd = new FormData(); fd.append('file', file);
    const token = localStorage.getItem('portfolioAdminToken');
    const r = await fetch(`${API_BASE}/api/admin/upload/${kind}` + (target ? `?target=${target}` : ''), { method: 'POST', body: fd, credentials: 'include', headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Upload failed');
    return j.url;
  }

  // ---------- Profile ----------
  function renderProfile() {
    const p = data.profile;
    const stats = [...(p.stats || [])]; while (stats.length < 3) stats.push({ label: '', value: '' });
    panel(`
      <div class="panel-head"><div><h2>Profile</h2><p class="muted">Your main details shown on the homepage.</p></div>
        <button class="btn primary" id="saveProfile">Save changes</button></div>

      <div class="card"><div class="upload-row">
        ${p.photo ? `<img class="preview" src="${esc(p.photo)}">` : '<div class="preview"></div>'}
        <div class="stack" style="flex:1">
          <label>Profile photo (PNG/JPG/WEBP, max 8MB)<input type="file" id="photoFile" accept="image/*"></label>
          <label>Resume (PDF)<input type="file" id="resumeFile" accept="application/pdf"> </label>
          ${p.resume ? `<small class="muted">Current resume: <a href="${esc(p.resume)}" target="_blank">view</a></small>` : ''}
        </div></div></div>

      <div class="card stack" id="profileForm">
        <div class="grid2">
          <label>Full name<input name="name" value="${esc(p.name)}"></label>
          <label>Job title<input name="title" value="${esc(p.title)}"></label>
        </div>
        <label>Tagline (hero section)<input name="tagline" value="${esc(p.tagline)}"></label>
        <label>Typing roles in hero (comma separated)<input name="roles" value="${esc(p.roles || p.title)}" placeholder="Full Stack Developer, UI Engineer, Problem Solver"></label>
        <label>About me (blank line = new paragraph; first paragraph is shown larger)<textarea name="about" rows="9">${esc(p.about)}</textarea></label>
        <div class="grid2">
          <label>Email<input name="email" value="${esc(p.email)}"></label>
          <label>Phone<input name="phone" value="${esc(p.phone)}"></label>
          <label>Location<input name="location" value="${esc(p.location)}"></label>
          <label>Website<input name="website" value="${esc(p.website)}" placeholder="https://"></label>
          <label>GitHub<input name="github" value="${esc(p.github)}" placeholder="https://github.com/…"></label>
          <label>LinkedIn<input name="linkedin" value="${esc(p.linkedin)}" placeholder="https://linkedin.com/in/…"></label>
          <label>Twitter / X<input name="twitter" value="${esc(p.twitter)}" placeholder="https://x.com/…"></label>
        </div>
        <label class="check"><input type="checkbox" name="available" ${p.available ? 'checked' : ''}> Show “Available for work” badge</label>
      </div>

      <div class="card"><h4 style="margin-bottom:4px">About highlights</h4>
        <p class="muted" style="margin-bottom:12px">Up to 4 cards shown in the About section. Leave empty to auto-generate from your skills.</p>
        <div class="stack" id="hlForm">
          ${[0, 1, 2, 3].map(i => { const h = (p.highlights || [])[i] || {}; return `<div class="hl-row" style="display:grid;grid-template-columns:70px 1fr 2fr;gap:10px"><input data-k="icon" placeholder="🎨" value="${esc(h.icon || '')}"><input data-k="title" placeholder="Title (e.g. Frontend)" value="${esc(h.title || '')}"><input data-k="text" placeholder="One short line" value="${esc(h.text || '')}"></div>`; }).join('')}
        </div></div>

      <div class="card"><h4 style="margin-bottom:12px">Highlight stats</h4>
        <div class="stack" id="statsForm">
          ${stats.slice(0, 4).map(s => `<div class="grid2"><input placeholder="Value (e.g. 3+)" data-k="value" value="${esc(s.value)}"><input placeholder="Label (e.g. Years Experience)" data-k="label" value="${esc(s.label)}"></div>`).join('')}
        </div></div>`);

    $('photoFile').onchange = guard(async (e) => { if (!e.target.files[0]) return; await upload('image', e.target.files[0], 'photo'); toast('Photo updated'); await load(); renderProfile(); });
    $('resumeFile').onchange = guard(async (e) => { if (!e.target.files[0]) return; await upload('resume', e.target.files[0], 'resume'); toast('Resume uploaded'); await load(); renderProfile(); });
    $('saveProfile').onclick = guard(async () => {
      const body = {};
      document.querySelectorAll('#profileForm [name]').forEach(el => body[el.name] = el.type === 'checkbox' ? el.checked : el.value);
      body.stats = [...document.querySelectorAll('#statsForm .grid2')].map(r => ({ value: r.querySelector('[data-k=value]').value, label: r.querySelector('[data-k=label]').value })).filter(s => s.value || s.label);
      body.highlights = [...document.querySelectorAll('#hlForm .hl-row')].map(r => ({ icon: r.querySelector('[data-k=icon]').value, title: r.querySelector('[data-k=title]').value, text: r.querySelector('[data-k=text]').value })).filter(h => h.title);
      await api('/api/admin/profile', 'PUT', body); await load(); toast('Profile saved ✓');
    });
  }

  // ---------- Collections ----------
  const schema = {
    skills: { title: 'Skills', one: 'skill', fields: [['name', 'Skill name', 'text'], ['category', 'Category (e.g. Frontend)', 'text'], ['level', 'Level (0–100)', 'number']], label: x => x.name, sub: x => `${x.category} · ${x.level}%` },
    projects: { title: 'Projects', one: 'project', fields: [['title', 'Title', 'text'], ['description', 'Description', 'textarea'], ['tech', 'Technologies (comma separated)', 'text'], ['image', 'Image', 'image'], ['live', 'Live URL', 'text'], ['repo', 'Source / GitHub URL', 'text'], ['featured', 'Featured project', 'check']], label: x => x.title, sub: x => x.tech.join(', ') },
    experience: { title: 'Experience', one: 'experience', fields: [['role', 'Role / position', 'text'], ['company', 'Company', 'text'], ['start', 'Start (e.g. 2022)', 'text'], ['end', 'End (e.g. Present)', 'text'], ['description', 'Description', 'textarea']], label: x => x.role, sub: x => `${x.company} · ${x.start} – ${x.end}` },
    education: { title: 'Education', one: 'education', fields: [['degree', 'Degree / course', 'text'], ['college', 'College', 'text'], ['school', 'University / Board', 'text'], ['percentage', 'Percentage / CGPA (e.g. 85% or 8.5 CGPA)', 'text'], ['start', 'Start', 'text'], ['end', 'End', 'text']], label: x => x.degree, sub: x => `${[x.college, x.school].filter(Boolean).join(', ')} · ${x.percentage || '—'} · ${x.start} – ${x.end}` }
  };

  function renderList(name) {
    const s = schema[name], items = data[name];
    panel(`
      <div class="panel-head"><div><h2>${s.title}</h2><p class="muted">${items.length} item(s)</p></div>
        <button class="btn primary" id="addBtn">+ Add ${s.one}</button></div>
      ${items.map((x, i) => `
        <div class="item"><div class="grow"><h4>${esc(s.label(x))} ${x.featured ? '<span class="pill">Featured</span>' : ''}</h4><small>${esc(s.sub(x))}</small></div>
          <div class="actions">
            <button class="btn sm" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn sm" data-down="${i}" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn sm" data-edit="${x.id}">Edit</button>
            <button class="btn sm danger" data-del="${x.id}">Delete</button>
          </div></div>`).join('') || '<p class="muted">Nothing here yet. Click “Add” to create your first one.</p>'}`);
    $('addBtn').onclick = () => openModal(name);
    $('panel').onclick = guard(async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.edit) return openModal(name, items.find(x => x.id === b.dataset.edit));
      if (b.dataset.del) {
        if (!confirm('Delete this item?')) return;
        await api(`/api/admin/${name}/${b.dataset.del}`, 'DELETE'); await load(); toast('Deleted'); return renderList(name);
      }
      const up = b.dataset.up, down = b.dataset.down;
      if (up !== undefined || down !== undefined) {
        const i = +(up ?? down), j = up !== undefined ? i - 1 : i + 1;
        const ids = items.map(x => x.id); [ids[i], ids[j]] = [ids[j], ids[i]];
        await api(`/api/admin/${name}/order/set`, 'PUT', { ids }); await load(); renderList(name);
      }
    });
  }

  function openModal(name, item) {
    const s = schema[name], v = item || {};
    const m = document.createElement('div'); m.className = 'modal';
    m.innerHTML = `<form class="modal-box stack"><h3>${item ? 'Edit' : 'Add'} ${s.one}</h3>
      ${s.fields.map(([k, label, type]) => {
        const val = k === 'tech' ? (v.tech || []).join(', ') : (v[k] ?? '');
        if (type === 'textarea') return `<label>${label}<textarea name="${k}" rows="4">${esc(val)}</textarea></label>`;
        if (type === 'check') return `<label class="check"><input type="checkbox" name="${k}" ${v[k] ? 'checked' : ''}> ${label}</label>`;
        if (type === 'image') return `<label>${label}<input type="hidden" name="${k}" value="${esc(val)}"><input type="file" accept="image/*" data-up="${k}"><small class="muted" data-note="${k}">${val ? 'Current: ' + esc(val) : 'No image'}</small></label>`;
        return `<label>${label}<input name="${k}" type="${type}" value="${esc(val)}" ${k === 'level' ? 'min="0" max="100"' : ''}></label>`;
      }).join('')}
      <div class="actions" style="justify-content:flex-end"><button type="button" class="btn" data-close>Cancel</button><button class="btn primary" type="submit">Save</button></div></form>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m || e.target.dataset.close !== undefined) m.remove(); });
    m.querySelectorAll('input[type=file]').forEach(f => f.onchange = guard(async () => {
      if (!f.files[0]) return;
      const url = await upload('image', f.files[0]);
      m.querySelector(`[name=${f.dataset.up}]`).value = url;
      m.querySelector(`[data-note=${f.dataset.up}]`).textContent = 'Uploaded ✓';
    }));
    m.querySelector('form').onsubmit = guard(async (e) => {
      e.preventDefault();
      const body = {};
      e.target.querySelectorAll('[name]').forEach(el => body[el.name] = el.type === 'checkbox' ? el.checked : el.value);
      if (item) await api(`/api/admin/${name}/${item.id}`, 'PUT', body); else await api(`/api/admin/${name}`, 'POST', body);
      m.remove(); await load(); toast('Saved ✓'); renderList(name);
    });
  }

  // ---------- Messages ----------
  function renderMessages() {
    const ms = data.messages;
    panel(`<div class="panel-head"><div><h2>Messages</h2><p class="muted">Contact form submissions.</p></div></div>
      ${ms.map(m => `<div class="item msg ${m.read ? '' : 'unread'}" style="align-items:flex-start">
        <div class="grow"><h4>${esc(m.name)} <small>&lt;<a href="mailto:${esc(m.email)}">${esc(m.email)}</a>&gt; · ${new Date(m.date).toLocaleString()}</small></h4><p>${esc(m.message)}</p></div>
        <div class="actions">${m.read ? '' : `<button class="btn sm" data-read="${m.id}">Mark read</button>`}<button class="btn sm danger" data-del="${m.id}">Delete</button></div></div>`).join('') || '<p class="muted">No messages yet.</p>'}`);
    $('panel').onclick = guard(async (e) => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.read) await api(`/api/admin/messages/${b.dataset.read}/read`, 'PUT');
      if (b.dataset.del) { if (!confirm('Delete this message?')) return; await api(`/api/admin/messages/${b.dataset.del}`, 'DELETE'); }
      await load(); renderMessages();
    });
  }

  // ---------- Account ----------
  function renderAccount() {
    panel(`<div class="panel-head"><div><h2>Account</h2><p class="muted">Change your admin username and password.</p></div></div>
      ${mustChange ? '<div class="card" style="border-color:#fecaca;background:#fef2f2">⚠ You are using the default password. Please change it now.</div>' : ''}
      <form class="card stack" id="accForm" style="max-width:460px">
        <label>Current password<input type="password" name="currentPassword" required autocomplete="current-password"></label>
        <label>New username (optional)<input name="newUsername" autocomplete="username"></label>
        <label>New password (min 8 characters)<input type="password" name="newPassword" minlength="8" autocomplete="new-password"></label>
        <button class="btn primary" type="submit">Update account</button>
      </form>`);
    $('accForm').onsubmit = guard(async (e) => {
      e.preventDefault();
      const b = Object.fromEntries(new FormData(e.target));
      if (!b.newUsername) delete b.newUsername;
      if (!b.newPassword) delete b.newPassword;
      await api('/api/admin/account', 'POST', b); mustChange = false; e.target.reset(); toast('Account updated ✓');
    });
  }

  boot();
})();
