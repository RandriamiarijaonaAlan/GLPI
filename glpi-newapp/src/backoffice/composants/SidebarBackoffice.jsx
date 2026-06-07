import { NavLink, useNavigate } from 'react-router-dom';
import { supprimerAccesBackoffice } from '../../api/authApi';

const liensBackoffice = [
  ['Tableau de bord', '/admin/dashboard'],
  ['Tickets', '/admin/tickets'],
  ['Import fichiers', '/admin/import'],
  ['Réinitialisation', '/admin/reset'],
  ['FrontOffice éléments', '/front/elements'],
  ['Créer ticket FrontOffice', '/front/create-ticket'],
];

export default function SidebarBackoffice() {
  const navigation = useNavigate();

  function gererDeconnexion() {
    supprimerAccesBackoffice();
    navigation('/admin/login');
  }

  return (
    <aside className="sidebar-backoffice">
      <div className="marque-backoffice">
        <strong>Backoffice</strong>
        <span>GLPI NewAPP</span>
      </div>

      <nav className="navigation-backoffice" aria-label="Navigation backoffice">
        {liensBackoffice.map(([libelle, chemin]) => (
          <NavLink
            className={({ isActive: estActif }) =>
              estActif ? 'lien-backoffice actif' : 'lien-backoffice'
            }
            key={chemin}
            to={chemin}
          >
            {libelle}
          </NavLink>
        ))}
      </nav>

      <button className="bouton-deconnexion" type="button" onClick={gererDeconnexion}>
        Déconnexion
      </button>
    </aside>
  );
}
