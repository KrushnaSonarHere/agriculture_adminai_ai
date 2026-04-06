"""
main.py
───────
KisanSetu — AI Smart Agriculture Administration System
FastAPI Backend Entry Point

Run with:
    uvicorn main:app --reload --port 8000

Development URLs:
    React Dev Server → http://localhost:5173        (npm run dev in frontend-react/)
    API + Docs       → http://127.0.0.1:8000/docs

Production URLs (after `npm run build` in frontend-react/):
    React SPA        → http://127.0.0.1:8000/app
    API              → http://127.0.0.1:8000/{router}
    Legacy Farmer    → http://127.0.0.1:8000/legacy-frontend
    Legacy Admin     → http://127.0.0.1:8000/legacy-admin
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse

from database import engine, Base, farmer_engine, FarmerBase, admin_engine, AdminBase
from routers import auth, farmers, schemes, applications, grievances, documents, ocr
from routers.verification        import router as verification_router
from routers.farmer_registration import router as farmer_v2_router
from routers.notifications       import router as notifications_router

# Import models so tables are known to their respective Base instances
import models          # legacy Agri_tech tables
import farmer_models   # Farmer DB (7 tables)
import admin_models    # Admin DB  (6 tables)

# ── Create all tables ────────────────────────────────────────
Base.metadata.create_all(bind=engine)              # legacy Agri_tech DB
FarmerBase.metadata.create_all(bind=farmer_engine) # agri_farmer_db
AdminBase.metadata.create_all(bind=admin_engine)   # agri_admin_db

# ── Ensure uploads directory exists ─────────────────────────
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# ── FastAPI app ──────────────────────────────────────────────
app = FastAPI(
    title       = "KisanSetu API",
    description = "AI-powered Smart Agriculture Administration System — Backend API",
    version     = "2.0.0",
    docs_url    = "/docs",
    redoc_url   = "/redoc",
)

# ── CORS ─────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins     = ["http://localhost:5173", "http://127.0.0.1:5173", "*"],
    allow_credentials = True,
    allow_methods     = ["*"],
    allow_headers     = ["*"],
)

# ── API Routers ──────────────────────────────────────────────
# Legacy / existing routers
app.include_router(auth.router)
app.include_router(farmers.router)
app.include_router(schemes.router)
app.include_router(applications.router)
app.include_router(grievances.router)
app.include_router(documents.router)
app.include_router(ocr.router)

# New dual-DB verification engine
app.include_router(verification_router)

# New Farmer DB (v2) — full onboarding, applications, documents
app.include_router(farmer_v2_router)

# Notifications — real-time farmer ↔ admin
app.include_router(notifications_router)

# Grievance AI — NLP analysis + STT transcription
from routers.grievance_ai import router as grievance_ai_router
app.include_router(grievance_ai_router)

# AgriBot — farmer chatbot
from routers.agribot import router as agribot_router
app.include_router(agribot_router)



# ── Static: uploaded documents ───────────────────────────────
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ── Static: React SPA (built with `npm run build` in frontend-react/) ──
_BASE      = os.path.dirname(__file__)
REACT_DIST = os.path.abspath(os.path.join(_BASE, "static", "react"))

if os.path.isdir(REACT_DIST):
    app.mount("/app", StaticFiles(directory=REACT_DIST, html=True), name="react")

# ── Legacy fallback: original HTML portals (kept as backup) ──
ADMIN_DIR    = os.path.abspath(os.path.join(_BASE, "..", "admin"))
FRONTEND_DIR = os.path.abspath(os.path.join(_BASE, "..", "frontend"))

if os.path.isdir(ADMIN_DIR):
    app.mount("/legacy-admin",    StaticFiles(directory=ADMIN_DIR,    html=True), name="legacy_admin")

if os.path.isdir(FRONTEND_DIR):
    app.mount("/legacy-frontend", StaticFiles(directory=FRONTEND_DIR, html=True), name="legacy_frontend")


# ── Health & Root ─────────────────────────────────────────────
@app.get("/", tags=["Health"])
def root():
    """Redirect to React SPA if built, else legacy frontend."""
    if os.path.isdir(REACT_DIST):
        return RedirectResponse(url="/app/index.html")
    return RedirectResponse(url="/legacy-frontend/index.html")


@app.get("/health", tags=["Health"])
def health():
    return {
        "status":       "healthy",
        "react_build":  os.path.isdir(REACT_DIST),
        "legacy_admin": os.path.isdir(ADMIN_DIR),
    }
