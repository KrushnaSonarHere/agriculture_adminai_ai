import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AgriBot from '../components/farmer/AgriBot';

// Redirects to /login if not authenticated
// Also renders the floating AgriBot widget on every farmer page
export function PrivateRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <>
      <Outlet />
      <AgriBot />
    </>
  );
}

// Redirects to /login if not admin
export function AdminRoute() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

