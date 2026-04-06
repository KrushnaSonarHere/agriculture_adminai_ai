# KisanSetu / AgriAdmin — Ultimate Hackathon Deployment Guide

For a hackathon presentation, a decoupled strategy is your **absolute best and most professional option**. Vercel is flawless for React interfaces, Render handles Python ML seamlessly, and a free PostgreSQL database ensures nothing gets wiped during judging!

I have already adjusted your `frontend-react/src/api/index.js` to support this setup via a dynamic `VITE_API_URL` variable, and provided the exact `Dockerfile` needed for Render!

---

## 1. Database Setup (Supabase / Neon)
To get a database that actually persists and won't get wiped out by cloud host restarts, set up a **free PostgreSQL Database**:

1. Go to [Supabase.com](https://supabase.com) or [Neon.tech](https://neon.tech) and create a free project.
2. In their dashboard, grab your **Connection String** (URI). 
   *It will look like:* `postgresql://postgres:password@host:5432/postgres`
3. Save this connection string, you will need it for the Backend Render configuration!

---

## 2. Backend Deployment (Render)
Render makes deploying FastAPI apps with ML tools (Tesseract OCR) incredibly simple using Docker. 

1. Ensure the new `Dockerfile` I generated is pushed to your GitHub repository.
2. Go to [Render.com](https://render.com) > **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Settings:
   - **Environment:** Docker
   - **Branch:** main
5. **Environment Variables**: Add these so Render connects to your fresh PostgreSQL instance:
   - `FARMER_DB_HOST` = (Extract from Supabase/Neon URL)
   - `FARMER_DB_PORT` = 5432
   - `FARMER_DB_NAME` = postgres (or your custom name)
   - `FARMER_DB_USER` = (Extract from Supabase/Neon URL)
   - `FARMER_DB_PASSWORD` = (Extract from Supabase/Neon URL)
   - *(Do the same for `ADMIN_DB_` variables, or just use one DB for both)*
6. Click **Create Web Service**. Render will give you a backend URL like `https://agri-backend.onrender.com`.

---

## 3. Frontend Deployment (Vercel)
Vercel is the gold standard for Vite/React and requires zero configuration.

1. Go to [Vercel.com](https://vercel.com) > **Add New** > **Project**.
2. Import your GitHub repository.
3. In the setup screen under **Framework Preset**, Vercel will auto-detect "Vite".
4. **Important - Root Directory:** Since your React app isn't exactly at the top root of your repo, click `Edit` on Root Directory and choose `/frontend-react`.
5. **Environment Variables:**
   - Key: `VITE_API_URL`
   - Value: `https://agri-backend.onrender.com` *(The URL you got from Render step 6)*
6. Click **Deploy**! 

### Why is this the best approach?
- **Speed**: Vercel serves the React app from a global CDN, making the UI load instantly for the judges.
- **Reliability:** Render will easily handle heavy Python dependencies (`tesseract-ocr`) in the background without affecting frontend performance.
- **Persistence:** Supabase/Neon PostgreSQL guarantees that the applications you submit or seed data don't randomly disappear!

## Summary of Changes I made to your project:
1. **`frontend-react/src/api/index.js`**: Adjusted `axios` to intercept `VITE_API_URL` so it automatically maps to your cloud backend when hosted on Vercel.
2. **`Dockerfile`**: Truncated the previous monolithic Dockerfile into a pure backend engine specialized just for Render.
