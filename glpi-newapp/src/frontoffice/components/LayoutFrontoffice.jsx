import { Outlet } from 'react-router-dom';
import SidebarFrontoffice from './SidebarFrontoffice';

export default function LayoutFrontoffice() {
  return (
    <div className="layout-frontoffice">
      <SidebarFrontoffice />

      <div className="zone-frontoffice">
        <header className="entete-frontoffice">
          <h1>FrontOffice GLPI NewAPP</h1>
        </header>

        <div className="contenu-frontoffice">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
