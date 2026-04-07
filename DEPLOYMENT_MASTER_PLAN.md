# 🚀 KisanSetu AI Agri: Deployment Master Plan

This plan breaks down the exact steps we will take to push your entire application to the internet. We will tackle this in **4 Phases** so it is easy and bulletproof.

---

## 🛠️ Phase 1: Database Setup (The Cloud Storage)
*Goal: Get a live, permanent PostgreSQL database running on the internet.*
1. Create a free account on [Render.com](https://render.com).
2. Create a new **Free PostgreSQL** database (named `agri-db`).
3. Copy the **Internal Database URL** and **External Database URL** that Render provides.
4. Update your local `backend/.env` file to include `DATABASE_URL=your_external_url_here`. 

---

## 🌎 Phase 2: Backend Deployment (The AI Server)
*Goal: Take your Python FastAPI backend and host it on Render so it can run 24/7.*
1. Push all your current code changes up to your GitHub repository.
2. In Render, create a new **Web Service**.
3. Connect your GitHub repository.
4. Set the **Root Directory** to `backend`.
5. Set the Start Command to: `uvicorn main:app --host 0.0.0.0 --port 10000`
6. Put the **Internal Database URL** from Phase 1 into the environment variables.
7. Click deploy and wait until Render says the API is **LIVE**.

---

## 🌱 Phase 3: Remote Data Seeding (Cloud Injection)
*Goal: Populate the empty live cloud database with your Excel data so the demo works.*
1. On your local laptop (VS Code), ensure `backend/.env` is holding your live Render `DATABASE_URL`.
2. Run your setup scripts locally to construct the cloud tables:
   * `python backend/setup_databases.py` (or whatever your DB initialization script is).
3. Run your seeding scripts locally:
   * `python seed_admin_demo.py`
   * `python load_schemes.py`
4. The local scripts will securely beam your `.xlsx` test data directly into the Render server!

---

## 🎨 Phase 4: Frontend Deployment (The Web Interface)
*Goal: Deploy the React UI to Vercel and connect it to your new live backend.*
1. Go to [Vercel.com](https://vercel.com) and create a New Project.
2. Connect your GitHub repository.
3. Set the **Root Directory** to `frontend-react`.
4. Add the Environment Variable `VITE_API_URL` and paste your live Render Backend URL (e.g., `https://agri-backend.onrender.com`).
5. Click **Deploy**. Vercel will build the React site.
6. Once finished, you will receive a magical `your-project.vercel.app` link. 

**Done! The project is fully live and globally accessible.**
