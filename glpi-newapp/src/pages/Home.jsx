import { Link } from 'react-router-dom';

export default function Home() {
  return (
    <main className="home-page">
      <h1>GLPI NewApp</h1>
      <div className="choice-grid">
        <Link className="choice-card" to="/admin/login">
          <span>Backoffice</span>
        </Link>
        <Link className="choice-card" to="/front/elements">
          <span>Frontoffice</span>
        </Link>
      </div>
    </main>
  );
}
