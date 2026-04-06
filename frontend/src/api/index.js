import axios from 'axios';

// ─── Vercel Deployment ────────────────────────────────────────
// For now (frontend-only demo):  leave VITE_API_URL empty.
// Later (after deploying backend on Render):
//   In Vercel Dashboard → Settings → Environment Variables:
//   VITE_API_URL = https://your-backend.onrender.com
// ──────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export default api;
