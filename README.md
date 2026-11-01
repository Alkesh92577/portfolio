# Portfolio deployment (Vercel + Render + TiDB + Cloudinary)

## Architecture
- **Vercel:** static frontend (`public/`)
- **Render:** Express API (`server.js`)
- **TiDB Cloud:** MySQL-compatible persistent database
- **Cloudinary:** persistent uploaded images and PDF resume

## 1. Create the TiDB database
1. In TiDB Cloud, open your SQL Editor for the instance.
2. Run:
   ```sql
   CREATE DATABASE IF NOT EXISTS portfolio;
   ```
3. In **Connect**, select database `portfolio` (not `sys`). Copy the host, port, username, and create/generate a password.

## 2. Deploy the backend to Render
1. Push this project to a **new/clean GitHub repository**. Do not push `.env`, `data/.secret`, `data/db.json`, `node_modules`, or the old `.git` history.
2. Render → **New** → **Web Service** → select the repository.
3. Root Directory: blank if `server.js` is in repository root.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Add every variable from `.env.example` in Render → **Environment**. Set:
   - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME=portfolio`
   - `ADMIN_USERNAME`, `ADMIN_PASSWORD`
   - `JWT_SECRET` (random 32+ characters)
   - `FRONTEND_URL` (exact Vercel production URL; comma-separated additional domains if needed)
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
7. Deploy. Test `https://YOUR-RENDER-URL.onrender.com/api/health`. Expected JSON: `status: ok`, `database: connected`.

On first successful startup, the API creates its tables and seeds the public portfolio data from `seed-data.json`. The admin user is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables.

## 3. Point the Vercel frontend to Render
1. Open `public/app.js` and `public/admin/admin.js`.
2. In both files replace `https://YOUR-RENDER-SERVICE.onrender.com` with your actual Render URL (no trailing slash).
3. Push to GitHub and redeploy Vercel.
4. Confirm Render's `FRONTEND_URL` exactly matches the deployed Vercel domain, e.g. `https://portfolio-name.vercel.app`.

## 4. Test
- Public site loads portfolio from `GET /api/portfolio`.
- Contact form writes to TiDB (`POST /api/contact`).
- Admin login uses `ADMIN_USERNAME` and `ADMIN_PASSWORD`.
- Admin edits/profile, skills, projects, experience, education, messages, and account are saved in TiDB.
- Image and resume uploads go to Cloudinary; Render's temporary filesystem is not used.

## Security
- Never commit `.env` or credentials.
- Use a strong unique admin password and JWT secret.
- Since credentials appeared in a shared archive/screenshots, rotate TiDB password, Cloudinary API secret/key, admin password, and JWT secret before deployment.
- Restrict `FRONTEND_URL` to your actual Vercel domain(s).
