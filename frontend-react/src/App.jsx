import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute, AdminRoute } from './context/ProtectedRoutes';
import { NotifProvider } from './context/NotifContext';

// Public pages
import Home           from './pages/Home';
import Login          from './pages/Login';
import Register       from './pages/Register';
import AdminRegister  from './pages/AdminRegister';

// Farmer pages (protected)
import Dashboard    from './pages/Dashboard';
import Schemes      from './pages/Schemes';
import SchemeDetail from './pages/SchemeDetail';
import Apply        from './pages/Apply';
import Applications from './pages/Applications';
import Profile      from './pages/Profile';
import Grievance    from './pages/Grievance';
import Documents    from './pages/Documents';
import Subsidies    from './pages/Subsidies';
import Insurance    from './pages/Insurance';
import Reports          from './pages/Reports';

// Admin pages (admin-only)
import AdminDashboard       from './pages/admin/AdminDashboard';
import AdminApplications    from './pages/admin/AdminApplications';
import DocumentVerification from './pages/admin/DocumentVerification';
import AiDecisions          from './pages/admin/AiDecisions';

import Farmers              from './pages/admin/Farmers';

import Grievances           from './pages/admin/Grievances';
import Escalated            from './pages/admin/Escalated';
import AdminReports         from './pages/admin/AdminReports';
import VerificationPanel    from './pages/admin/VerificationPanel';

export default function App() {
  return (
    <AuthProvider>
      <NotifProvider>
        <Routes>
        {/* Public */}
        <Route path="/"               element={<Home />} />
        <Route path="/login"          element={<Login />} />
        <Route path="/register"       element={<Register />} />
        <Route path="/admin/register" element={<AdminRegister />} />

        {/* Farmer (Protected) */}
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard"          element={<Dashboard />} />
          <Route path="/schemes"            element={<Schemes />} />
          <Route path="/schemes/:id"        element={<SchemeDetail />} />
          <Route path="/apply"              element={<Apply />} />
          <Route path="/applications"       element={<Applications />} />
          <Route path="/profile"            element={<Profile />} />
          <Route path="/grievance"          element={<Grievance />} />
          <Route path="/documents"          element={<Documents />} />
          <Route path="/subsidies"          element={<Subsidies />} />
          <Route path="/insurance"          element={<Insurance />} />
          <Route path="/reports"            element={<Reports />} />
        </Route>

        {/* Admin (Admin-only) */}
        <Route element={<AdminRoute />}>
          <Route path="/admin"             element={<AdminDashboard />} />
          <Route path="/admin/applications"element={<AdminApplications />} />
          <Route path="/admin/documents"   element={<DocumentVerification />} />
          <Route path="/admin/ai"          element={<AiDecisions />} />

          <Route path="/admin/farmers"     element={<Farmers />} />

          <Route path="/admin/grievances"  element={<Grievances />} />
          <Route path="/admin/escalated"   element={<Escalated />} />
          <Route path="/admin/reports"     element={<AdminReports />} />
          <Route path="/admin/verify/:applicationId" element={<VerificationPanel />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </NotifProvider>
    </AuthProvider>
  );
}
