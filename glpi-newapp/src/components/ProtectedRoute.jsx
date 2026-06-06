import { Navigate, Outlet } from 'react-router-dom';

export default function ProtectedRoute() {
  const isAuthenticated = Boolean(localStorage.getItem('admin_token'));

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
