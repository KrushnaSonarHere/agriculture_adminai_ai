import axios from 'axios';

// In dev: Vite proxies these if target is not set
// In prod (Vercel): We inject the Render backend URL via VITE_API_URL
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: { 'Content-Type': 'application/json' },
});

export default api;

