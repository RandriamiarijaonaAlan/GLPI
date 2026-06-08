import { Outlet } from 'react-router-dom';
import SidebarBackoffice from './SidebarBackoffice';

export default function LayoutBackoffice() {
  return (
    <div className="layout-backoffice">
      <SidebarBackoffice />

      <div className="zone-backoffice">
        <header className="entete-backoffice">
          <h1>Backoffice GLPI NewAPP</h1>
        </header>

        <div className="contenu-backoffice">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
