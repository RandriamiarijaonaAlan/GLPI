import { Navigate, Outlet } from 'react-router-dom';
import { aAccesBackoffice } from '../../api/authApi';

export default function RouteProtegeeBackoffice() {
  if (!aAccesBackoffice()) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
