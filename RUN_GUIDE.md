# KisanSetu / AgriAdmin — Complete Run Guide

---

## Option A: Run Locally (Full Stack)

### Prerequisites
1. **Python** (3.9 to 3.11) — [python.org](https://www.python.org/downloads/)
2. **Node.js** (v18+) — [nodejs.org](https://nodejs.org/)

### Step 1: Start the Backend (FastAPI)
Open **Terminal 1**:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```
Wait until you see `Application startup complete`. Backend runs at `http://127.0.0.1:8000`.

### Step 2: Start the Frontend (React)
Open **Terminal 2**:
```powershell
cd frontend-react
npm install
npm run dev
```
Frontend runs at `http://localhost:5173`. The Vite proxy automatically routes API calls to the backend.

### Demo Credentials
| Role   | Email                     | Password   |
|--------|---------------------------|------------|
| Farmer | ramesh2@farm.in           | farmer123  |
| Admin  | admin@agriportal.gov.in   | admin123   |

### Troubleshooting
- **502 Bad Gateway?** → Backend is still starting. Wait for `Application startup complete` in Terminal 1.
- **Database error?** → The backend uses SQLite locally (no PostgreSQL needed). DB files are auto-created in `backend/sql/`.

---

## Option B: Deploy Frontend Only on Vercel (Quick Demo)

A standalone `frontend-vercel/` folder is ready for instant Vercel deployment. This shows the full UI without needing the backend running.

### Steps
1. Push `frontend-vercel/` to a GitHub repository (or as a separate repo).
2. Go to [vercel.com](https://vercel.com) → **Add New** → **Project**.
3. Import your GitHub repo.
4. Vercel auto-detects **Vite**. No config needed.
5. Click **Deploy**!

### Later: Connect to Backend on Render
Once your backend is live on Render (e.g., `https://agri-backend.onrender.com`):
1. Go to your Vercel project → **Settings** → **Environment Variables**.
2. Add:
   - Key: `VITE_API_URL`
   - Value: `https://agri-backend.onrender.com`
3. **Redeploy** your project. The frontend will now talk to your live backend!

---

## Project Folder Structure
```
AI_Agri/
├── backend/              ← FastAPI + AI engine (deployed to Render)
├── frontend-react/       ← Full dev frontend (with proxy to localhost backend)
├── frontend-vercel/      ← Standalone frontend (deploy directly to Vercel)
├── deploy_guide.md       ← Cloud deployment guide (Render + Supabase + Vercel)
├── RUN_GUIDE.md          ← This file
└── Dockerfile            ← Backend Docker config for Render
```
