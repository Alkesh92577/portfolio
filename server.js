const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SECRET_FILE = path.join(DATA_DIR, '.secret');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------- Secret for JWT (generated once, persisted) ----------
let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (fs.existsSync(SECRET_FILE)) JWT_SECRET = fs.readFileSync(SECRET_FILE, 'utf8');
  else {
    JWT_SECRET = crypto.randomBytes(48).toString('hex');
    fs.writeFileSync(SECRET_FILE, JWT_SECRET, { mode: 0o600 });
  }
}

// ---------- Simple JSON database ----------
const defaultDB = () => ({
  admin: {
    username: process.env.ADMIN_USER || 'admin',
    passwordHash: bcrypt.hashSync(process.env.ADMIN_PASS || 'admin123', 10),
    mustChange: !process.env.ADMIN_PASS
  },
  profile: {
    name: 'Your Name',
    title: 'Full Stack Developer',
    tagline: 'I build fast, accessible and beautiful web experiences.',
    roles: 'Full Stack Developer, Problem Solver, Web Developer',
    about: "I'm a full stack developer who turns ideas into fast, reliable and well-designed web products.\n\nI work across the stack, from responsive interfaces to secure APIs and databases, and I care about clean code, performance and a great user experience.\n\nI'm always learning, always building, and open to new opportunities where I can create real impact.",
    highlights: [
      { icon: '🎨', title: 'Frontend', text: 'Pixel-perfect, responsive interfaces with smooth, purposeful animation.' },
      { icon: '⚙️', title: 'Backend', text: 'Secure REST APIs, authentication and well-structured databases.' },
      { icon: '🚀', title: 'Performance', text: 'Fast load times, clean architecture and maintainable code.' },
      { icon: '🤝', title: 'Collaboration', text: 'Clear communication and delivery on time, every time.' }
    ],
    photo: '',
    resume: '',
    email: 'you@example.com',
    phone: '',
    location: 'India',
    github: '', linkedin: '', twitter: '', website: '',
    available: true,
    stats: [
      { label: 'Years Experience', value: '3+' },
      { label: 'Projects Completed', value: '20+' },
      { label: 'Happy Clients', value: '10+' }
    ]
  },
  skills: [
    { id: 's1', name: 'JavaScript', level: 90, category: 'Frontend' },
    { id: 's2', name: 'React', level: 85, category: 'Frontend' },
    { id: 's3', name: 'Node.js', level: 85, category: 'Backend' },
    { id: 's4', name: 'MongoDB / SQL', level: 80, category: 'Backend' },
    { id: 's5', name: 'Git & GitHub', level: 85, category: 'Tools' }
  ],
  projects: [
    { id: 'p1', title: 'Sample Project One', description: 'Short description of what this project does and the problem it solves.', tech: ['React', 'Node.js', 'MongoDB'], image: '', live: '', repo: '', featured: true },
    { id: 'p2', title: 'Sample Project Two', description: 'Another project. Replace this from the admin panel.', tech: ['HTML', 'CSS', 'JavaScript'], image: '', live: '', repo: '', featured: false }
  ],
  experience: [
    { id: 'e1', role: 'Software Developer', company: 'Company Name', start: '2023', end: 'Present', description: 'What you worked on, technologies used and the impact you made.' }
  ],
  education: [
    { id: 'd1', degree: 'B.Tech in Computer Science', college: 'Your College', school: 'Your University', percentage: '80%', start: '2019', end: '2023' }
  ],
  messages: []
});

let db;
function loadDB() {
  if (!fs.existsSync(DB_FILE)) { db = defaultDB(); saveDB(); }
  else db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  // Migration: upgrade the old placeholder About text to the new professional default
  const fresh = defaultDB().profile;
  if (String(db.profile.about || '').startsWith('Write a short introduction about yourself')) {
    db.profile.about = fresh.about;
    if (!db.profile.highlights) db.profile.highlights = fresh.highlights;
    if (!db.profile.roles) db.profile.roles = fresh.roles;
    saveDB();
  }
}
function saveDB() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}
loadDB();

// ---------- App ----------
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Basic in-memory rate limiter
const hits = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const rec = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (rec.length >= max) return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    rec.push(now); hits.set(key, rec);
    next();
  };
}

function auth(req, res, next) {
  try {
    req.user = jwt.verify(req.cookies.token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

const uid = (p) => p + crypto.randomBytes(4).toString('hex');
const str = (v, max = 5000) => String(v ?? '').slice(0, max);

// ---------- Public API ----------
app.get('/api/portfolio', (req, res) => {
  const { profile, skills, projects, experience, education } = db;
  res.json({ profile, skills, projects, experience, education });
});

app.post('/api/contact', rateLimit(5, 60 * 60 * 1000), (req, res) => {
  const name = str(req.body.name, 100).trim();
  const email = str(req.body.email, 150).trim();
  const message = str(req.body.message, 3000).trim();
  if (!name || !/^\S+@\S+\.\S+$/.test(email) || message.length < 5)
    return res.status(400).json({ error: 'Please fill all fields correctly.' });
  db.messages.unshift({ id: uid('m'), name, email, message, date: new Date().toISOString(), read: false });
  saveDB();
  res.json({ ok: true });
});

// ---------- Auth ----------
app.post('/api/admin/login', rateLimit(10, 15 * 60 * 1000), (req, res) => {
  const { username, password } = req.body || {};
  if (username !== db.admin.username || !bcrypt.compareSync(String(password || ''), db.admin.passwordHash))
    return res.status(401).json({ error: 'Invalid username or password' });
  const token = jwt.sign({ u: username }, JWT_SECRET, { expiresIn: '12h' });
  res.cookie('token', token, { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', maxAge: 12 * 3600 * 1000 });
  res.json({ ok: true, mustChange: db.admin.mustChange });
});
app.post('/api/admin/logout', (req, res) => { res.clearCookie('token'); res.json({ ok: true }); });
app.get('/api/admin/me', auth, (req, res) => res.json({ username: db.admin.username, mustChange: db.admin.mustChange }));

app.post('/api/admin/account', auth, (req, res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};
  if (!bcrypt.compareSync(String(currentPassword || ''), db.admin.passwordHash))
    return res.status(400).json({ error: 'Current password is incorrect' });
  if (newUsername) db.admin.username = str(newUsername, 50).trim();
  if (newPassword) {
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    db.admin.passwordHash = bcrypt.hashSync(String(newPassword), 10);
    db.admin.mustChange = false;
  }
  saveDB();
  res.json({ ok: true });
});

// ---------- Admin: profile ----------
app.get('/api/admin/data', auth, (req, res) => {
  const { profile, skills, projects, experience, education, messages } = db;
  res.json({ profile, skills, projects, experience, education, messages });
});

app.put('/api/admin/profile', auth, (req, res) => {
  const b = req.body || {};
  const p = db.profile;
  ['name', 'title', 'tagline', 'roles', 'email', 'phone', 'location', 'github', 'linkedin', 'twitter', 'website'].forEach(k => { if (k in b) p[k] = str(b[k], 300); });
  if (Array.isArray(b.highlights)) p.highlights = b.highlights.slice(0, 4).filter(h => h && h.title).map(h => ({ icon: str(h.icon, 4), title: str(h.title, 50), text: str(h.text, 220) }));
  if ('about' in b) p.about = str(b.about, 5000);
  if ('available' in b) p.available = !!b.available;
  if (Array.isArray(b.stats)) p.stats = b.stats.slice(0, 4).map(s => ({ label: str(s.label, 40), value: str(s.value, 20) }));
  saveDB();
  res.json(p);
});

// ---------- Admin: generic collections ----------
const collections = {
  skills: (b) => ({ name: str(b.name, 60), level: Math.max(0, Math.min(100, parseInt(b.level) || 0)), category: str(b.category, 40) || 'General' }),
  projects: (b) => ({
    title: str(b.title, 100), description: str(b.description, 1000),
    tech: (Array.isArray(b.tech) ? b.tech : String(b.tech || '').split(',')).map(t => str(t, 30).trim()).filter(Boolean).slice(0, 12),
    image: str(b.image, 300), live: str(b.live, 300), repo: str(b.repo, 300), featured: !!b.featured
  }),
  experience: (b) => ({ role: str(b.role, 100), company: str(b.company, 100), start: str(b.start, 20), end: str(b.end, 20), description: str(b.description, 1500) }),
  education: (b) => ({ degree: str(b.degree, 120), college: str(b.college, 150), school: str(b.school, 150), percentage: str(b.percentage, 20), start: str(b.start, 20), end: str(b.end, 20) })
};
const prefix = { skills: 's', projects: 'p', experience: 'e', education: 'd' };

Object.keys(collections).forEach(name => {
  app.post(`/api/admin/${name}`, auth, (req, res) => {
    const item = { id: uid(prefix[name]), ...collections[name](req.body || {}) };
    db[name].push(item); saveDB(); res.json(item);
  });
  app.put(`/api/admin/${name}/:id`, auth, (req, res) => {
    const i = db[name].findIndex(x => x.id === req.params.id);
    if (i < 0) return res.status(404).json({ error: 'Not found' });
    db[name][i] = { id: req.params.id, ...collections[name](req.body || {}) };
    saveDB(); res.json(db[name][i]);
  });
  app.delete(`/api/admin/${name}/:id`, auth, (req, res) => {
    db[name] = db[name].filter(x => x.id !== req.params.id); saveDB(); res.json({ ok: true });
  });
});

// Reorder
app.put('/api/admin/:name/order/set', auth, (req, res) => {
  const name = req.params.name;
  if (!collections[name] || !Array.isArray(req.body.ids)) return res.status(400).json({ error: 'Bad request' });
  const map = new Map(db[name].map(x => [x.id, x]));
  const ordered = req.body.ids.map(id => map.get(id)).filter(Boolean);
  db[name].forEach(x => { if (!ordered.includes(x)) ordered.push(x); });
  db[name] = ordered; saveDB(); res.json({ ok: true });
});

// ---------- Admin: messages ----------
app.put('/api/admin/messages/:id/read', auth, (req, res) => {
  const m = db.messages.find(x => x.id === req.params.id);
  if (m) { m.read = true; saveDB(); }
  res.json({ ok: true });
});
app.delete('/api/admin/messages/:id', auth, (req, res) => {
  db.messages = db.messages.filter(x => x.id !== req.params.id); saveDB(); res.json({ ok: true });
});

// ---------- Uploads ----------
const ALLOWED = { image: ['.png', '.jpg', '.jpeg', '.webp', '.gif'], resume: ['.pdf'] };
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (req, file, cb) => cb(null, Date.now() + '-' + crypto.randomBytes(4).toString('hex') + path.extname(file.originalname).toLowerCase())
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const kind = req.params.kind;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(ALLOWED[kind] && ALLOWED[kind].includes(ext) ? null : new Error('File type not allowed'), true);
  }
});

app.post('/api/admin/upload/:kind', auth, (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No file' });
    const url = '/uploads/' + req.file.filename;
    if (req.query.target === 'photo') db.profile.photo = url;
    if (req.query.target === 'resume') db.profile.resume = url;
    if (req.query.target) saveDB();
    res.json({ url });
  });
});

// ---------- Static ----------
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
app.use('/admin', express.static(path.join(__dirname, 'public', 'admin')));
app.use(express.static(path.join(__dirname, 'public')));

app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Server error' }); });

app.listen(PORT, () => {
  console.log(`\n  Portfolio:   http://localhost:${PORT}`);
  console.log(`  Admin panel: http://localhost:${PORT}/admin`);
  if (db.admin.mustChange) console.log('  Default login -> username: admin | password: admin123 (change it after first login!)\n');
});
