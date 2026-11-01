# My Portfolio (with Admin Panel)

Professional developer portfolio + secure admin panel. Backend: Node.js + Express. Data is stored in `data/db.json` (no database setup needed).

## Run locally

```bash
npm install
npm start
```

- Portfolio: http://localhost:3000
- Admin panel: http://localhost:3000/admin

**Default login:** username `admin`, password `admin123`.
Login karte hi **Account** tab mein jaakar password turant change karein.

## Custom admin credentials (optional)

Pehli baar start karne se pehle environment variables set karein:

```bash
ADMIN_USER=myname ADMIN_PASS=MyStrongPass123 npm start
```

## What you can manage from /admin

- Profile: name, title, tagline, about, photo, resume (PDF), contact info, social links, stats, "Available for work" badge
- Skills, Projects (with image upload), Experience, Education: add / edit / delete / reorder
- Messages from the contact form
- Admin username and password

## Deploying

Kisi bhi Node.js hosting par chalega (Render, Railway, VPS, etc.).

- `PORT` aur `NODE_ENV=production` set karein (production mein cookie `secure` ho jaati hai, isliye HTTPS zaroori hai).
- `data/` aur `uploads/` folders **persistent storage** par rakhein, warna redeploy par data ud jayega.
- Backup ke liye bas `data/db.json` aur `uploads/` copy kar lein.

## Security included

Hashed password (bcrypt), httpOnly JWT cookie, login/contact rate-limiting, upload type + size limits, input sanitising on both server and frontend.
