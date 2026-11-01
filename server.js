require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: origin not allowed'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors());

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
  waitForConnections: true,
  connectionLimit: 5,
  queueLimit: 0
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const isImage = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype);
    const isPdf = file.mimetype === 'application/pdf';
    if (isImage || (req.params.kind === 'resume' && isPdf)) return cb(null, true);
    cb(new Error(req.params.kind === 'resume' ? 'Resume must be a PDF' : 'Only JPG, PNG, WEBP or GIF images are allowed'));
  }
});

function cloudUpload(buffer, kind) {
  return new Promise((resolve, reject) => {
    const opts = {
      folder: kind === 'resume' ? 'portfolio/resume' : 'portfolio',
      resource_type: kind === 'resume' ? 'raw' : 'image',
      ...(kind === 'resume' ? { public_id: `resume-${Date.now()}` } : {})
    };
    const stream = cloudinary.uploader.upload_stream(opts, (err, result) => err ? reject(err) : resolve(result));
    stream.end(buffer);
  });
}

const collections = ['skills', 'projects', 'experience', 'education'];
const jsonValue = value => typeof value === 'string' ? JSON.parse(value) : value;
const toJson = value => JSON.stringify(value ?? {});

async function getProfile() {
  const [rows] = await pool.query('SELECT profile_json FROM portfolio_profile WHERE id=1');
  if (!rows.length) return {};
  return jsonValue(rows[0].profile_json) || {};
}
async function setProfile(profile) {
  await pool.query(`INSERT INTO portfolio_profile (id, profile_json) VALUES (1, ?)
    ON DUPLICATE KEY UPDATE profile_json=VALUES(profile_json)`, [toJson(profile)]);
}
async function getCollection(name) {
  if (!collections.includes(name)) throw new Error('Invalid collection');
  const [rows] = await pool.query(`SELECT item_json FROM portfolio_items WHERE collection_name=? ORDER BY sort_order ASC`, [name]);
  return rows.map(r => jsonValue(r.item_json));
}
async function seedIfEmpty() {
  const seedPath = path.join(__dirname, 'seed-data.json');
  if (!fs.existsSync(seedPath)) return;
  const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
  const [profileRows] = await pool.query('SELECT id FROM portfolio_profile WHERE id=1');
  if (!profileRows.length && seed.profile) await setProfile(seed.profile);
  for (const name of collections) {
    const [countRows] = await pool.query('SELECT COUNT(*) AS n FROM portfolio_items WHERE collection_name=?', [name]);
    if (Number(countRows[0].n) === 0 && Array.isArray(seed[name])) {
      for (let i=0; i<seed[name].length; i++) {
        const item = seed[name][i];
        if (!item.id) item.id = `${name.slice(0,1)}${Date.now()}${i}`;
        await pool.query('INSERT INTO portfolio_items (collection_name,item_id,item_json,sort_order) VALUES (?,?,?,?)', [name, String(item.id), toJson(item), i]);
      }
    }
  }
}
async function initializeDatabase() {
  if (!process.env.DB_HOST || !process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME) {
    throw new Error('Missing TiDB environment variables: DB_HOST, DB_USER, DB_PASSWORD, DB_NAME');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 8) {
    throw new Error('Set ADMIN_USERNAME and ADMIN_PASSWORD (minimum 8 characters)');
  }
  await pool.query(`CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS portfolio_profile (
    id TINYINT PRIMARY KEY, profile_json JSON NOT NULL, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS portfolio_items (
    collection_name VARCHAR(32) NOT NULL, item_id VARCHAR(100) NOT NULL,
    item_json JSON NOT NULL, sort_order INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY(collection_name,item_id), INDEX(collection_name,sort_order)
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS contact_messages (
    id BIGINT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL, message TEXT NOT NULL, read_status BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`);
  const [admins] = await pool.query('SELECT id FROM admins WHERE username=?', [process.env.ADMIN_USERNAME]);
  if (!admins.length) {
    const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
    await pool.query('INSERT INTO admins(username,password_hash) VALUES (?,?)', [process.env.ADMIN_USERNAME, hash]);
    console.log('Initial admin created from environment variables.');
  }
  await seedIfEmpty();
  console.log('TiDB tables initialized.');
}

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.cookies.adminToken;
  if (!token) return res.status(401).json({ error: 'Please log in again' });
  try { req.admin = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Session expired. Please log in again.' }); }
}
function asyncRoute(fn) { return (req, res, next) => Promise.resolve(fn(req,res,next)).catch(next); }

// Public API consumed by the Vercel-hosted portfolio
app.get('/api/portfolio', asyncRoute(async (req,res) => {
  const profile = await getProfile();
  const [skills, projects, experience, education] = await Promise.all(collections.map(getCollection));
  res.json({ profile, skills, projects, experience, education });
}));
app.post('/api/contact', asyncRoute(async (req,res) => {
  const { name, email, message } = req.body || {};
  if (!name?.trim() || !email?.trim() || !message?.trim()) return res.status(400).json({ error: 'Name, email and message are required.' });
  if (name.length > 255 || email.length > 255 || message.length > 10000) return res.status(400).json({ error: 'Message is too long.' });
  await pool.query('INSERT INTO contact_messages(name,email,message) VALUES (?,?,?)', [name.trim(), email.trim(), message.trim()]);
  res.status(201).json({ message: 'Message sent successfully' });
}));

// Admin authentication. The frontend sends the JWT in Authorization: Bearer.
app.post('/api/admin/login', asyncRoute(async (req,res) => {
  const { username, password } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM admins WHERE username=?', [String(username || '').trim()]);
  if (!rows.length || !(await bcrypt.compare(String(password || ''), rows[0].password_hash))) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const admin = rows[0];
  const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: '12h' });
  res.json({ token, admin: { username: admin.username }, mustChange: false });
}));
app.get('/api/admin/me', auth, (req,res) => res.json({ username: req.admin.username, mustChange: false }));
app.post('/api/admin/logout', (req,res) => { res.clearCookie('adminToken'); res.json({ message: 'Logged out' }); });
app.get('/api/admin/data', auth, asyncRoute(async (req,res) => {
  const [profile, skills, projects, experience, education, messages] = await Promise.all([
    getProfile(), ...collections.map(getCollection),
    pool.query('SELECT id,name,email,message,read_status,created_at FROM contact_messages ORDER BY created_at DESC')
  ]);
  res.json({ profile, skills, projects, experience, education,
    messages: messages[0].map(m => ({ id: String(m.id), name:m.name, email:m.email, message:m.message, read:!!m.read_status, date:m.created_at })) });
}));
app.put('/api/admin/profile', auth, asyncRoute(async (req,res) => {
  const current = await getProfile();
  await setProfile({ ...current, ...req.body });
  res.json({ message: 'Profile saved' });
}));

// Uploads go directly from backend memory to Cloudinary; Render disk is not used.
app.post('/api/admin/upload/:kind', auth, upload.single('file'), asyncRoute(async (req,res) => {
  const kind = req.params.kind;
  if (!['image','resume'].includes(kind)) return res.status(400).json({ error: 'Unsupported upload type' });
  if (!req.file) return res.status(400).json({ error: 'Choose a file first' });
  const result = await cloudUpload(req.file.buffer, kind);
  const url = result.secure_url;
  if (req.query.target === 'photo' || req.query.target === 'resume') {
    const profile = await getProfile();
    profile[req.query.target] = url;
    await setProfile(profile);
  }
  res.json({ url, public_id: result.public_id });
}));

for (const name of collections) {
  app.post(`/api/admin/${name}`, auth, asyncRoute(async (req,res) => {
    const item = { ...req.body, id: req.body.id || `${name[0]}${Date.now().toString(36)}${Math.random().toString(36).slice(2,8)}` };
    if (name === 'projects') item.tech = Array.isArray(item.tech) ? item.tech : String(item.tech || '').split(',').map(s=>s.trim()).filter(Boolean);
    const existing = await getCollection(name);
    await pool.query('INSERT INTO portfolio_items(collection_name,item_id,item_json,sort_order) VALUES (?,?,?,?)', [name,String(item.id),toJson(item),existing.length]);
    res.status(201).json(item);
  }));
  app.put(`/api/admin/${name}/:id`, auth, asyncRoute(async (req,res) => {
    const [rows] = await pool.query('SELECT item_json FROM portfolio_items WHERE collection_name=? AND item_id=?', [name,req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    const prev = jsonValue(rows[0].item_json);
    const item = { ...prev, ...req.body, id: prev.id };
    if (name === 'projects') item.tech = Array.isArray(item.tech) ? item.tech : String(item.tech || '').split(',').map(s=>s.trim()).filter(Boolean);
    await pool.query('UPDATE portfolio_items SET item_json=? WHERE collection_name=? AND item_id=?', [toJson(item),name,req.params.id]);
    res.json(item);
  }));
  app.delete(`/api/admin/${name}/:id`, auth, asyncRoute(async (req,res) => {
    const [rows] = await pool.query('SELECT item_json FROM portfolio_items WHERE collection_name=? AND item_id=?', [name,req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Item not found' });
    const item = jsonValue(rows[0].item_json);
    if (name === 'projects' && item.imagePublicId) await cloudinary.uploader.destroy(item.imagePublicId).catch(()=>{});
    await pool.query('DELETE FROM portfolio_items WHERE collection_name=? AND item_id=?', [name,req.params.id]);
    res.json({ message: 'Deleted' });
  }));
  app.put(`/api/admin/${name}/order/set`, auth, asyncRoute(async (req,res) => {
    const ids = req.body.ids || [];
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (let i=0;i<ids.length;i++) await conn.query('UPDATE portfolio_items SET sort_order=? WHERE collection_name=? AND item_id=?',[i,name,String(ids[i])]);
      await conn.commit(); res.json({ message: 'Order updated' });
    } catch(e) { await conn.rollback(); throw e; }
    finally { conn.release(); }
  }));
}

app.put('/api/admin/messages/:id/read', auth, asyncRoute(async (req,res) => {
  await pool.query('UPDATE contact_messages SET read_status=TRUE WHERE id=?',[req.params.id]);
  res.json({ message: 'Marked read' });
}));
app.delete('/api/admin/messages/:id', auth, asyncRoute(async (req,res) => {
  await pool.query('DELETE FROM contact_messages WHERE id=?',[req.params.id]);
  res.json({ message: 'Deleted' });
}));
app.post('/api/admin/account', auth, asyncRoute(async (req,res) => {
  const { currentPassword, newUsername, newPassword } = req.body || {};
  const [rows] = await pool.query('SELECT * FROM admins WHERE id=?',[req.admin.id]);
  if (!rows.length || !(await bcrypt.compare(String(currentPassword || ''),rows[0].password_hash))) return res.status(401).json({ error: 'Current password is incorrect' });
  if (newPassword && newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const username = String(newUsername || rows[0].username).trim();
  const hash = newPassword ? await bcrypt.hash(newPassword,12) : rows[0].password_hash;
  await pool.query('UPDATE admins SET username=?,password_hash=? WHERE id=?',[username,hash,req.admin.id]);
  res.json({ message: 'Account updated' });
}));

app.get('/api/health', asyncRoute(async (req,res) => {
  await pool.query('SELECT 1');
  res.json({ status:'ok', database:'connected', imageStorage:'Cloudinary' });
}));
app.get('/', (req,res) => res.json({ service:'Portfolio API', status:'running' }));
app.use((err,req,res,next) => {
  console.error('API error:', err.message);
  const status = err.message?.startsWith('CORS:') ? 403 : (err.name === 'MulterError' ? 400 : 500);
  res.status(status).json({ error: status === 500 ? 'Server error. Check Render logs.' : err.message });
});

const PORT = process.env.PORT || 10000;
initializeDatabase().then(() => app.listen(PORT, '0.0.0.0', () => console.log(`Portfolio API listening on ${PORT}`)))
  .catch(err => { console.error('Startup failed:',err.message); process.exit(1); });
