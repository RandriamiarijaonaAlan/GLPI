import { NavLink } from 'react-router-dom';

const liensFrontoffice = [
  ['Elements', '/front/elements'],
  ['Creer ticket', '/front/create-ticket'],
  ['Kanban tickets', '/front/kanban'],
  ['Accueil', '/'],
];

export default function SidebarFrontoffice() {
  return (
    <aside className="sidebar-frontoffice">
      <div className="marque-frontoffice">
        <strong>FrontOffice</strong>
        <span>GLPI NewAPP</span>
      </div>

      <nav className="navigation-frontoffice" aria-label="Navigation frontoffice">
        {liensFrontoffice.map(([libelle, chemin]) => (
          <NavLink
            className={({ isActive: estActif }) =>
              estActif ? 'lien-frontoffice actif' : 'lien-frontoffice'
            }
            key={chemin}
            to={chemin}
          >
            {libelle}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
