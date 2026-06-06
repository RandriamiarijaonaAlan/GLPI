import { Link } from 'react-router-dom';

export default function Accueil() {
  return (
    <main className="home-page">
      <h1>GLPI NewApp</h1>
      <div className="choice-grid">
        <Link className="choice-card" to="/admin/login">
          <span>Backoffice</span>
        </Link>
        <Link className="choice-card" to="/front/elements">
          <span>FrontOffice</span>
        </Link>
      </div>
    </main>
  );
}
