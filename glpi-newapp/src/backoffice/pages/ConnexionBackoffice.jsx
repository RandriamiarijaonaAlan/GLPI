import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  enregistrerAccesBackoffice,
  testerConnexionGlpiLegacy,
  testerConnexionGlpiV2,
} from '../../api/authApi';

const backofficeCode = import.meta.env.VITE_BACKOFFICE_CODE || 'ADMIN2026';

export default function ConnexionBackoffice() {
  const navigate = useNavigate();
  const [code, setCode] = useState(backofficeCode);
  const [erreur, setErreur] = useState('');
  const [testEnCours, setTestEnCours] = useState(false);
  const [resultatsTest, setResultatsTest] = useState([]);

  function gererSoumission(evenement) {
    evenement.preventDefault();

    if (code !== backofficeCode) {
      setErreur('Code incorrect');
      return;
    }

    enregistrerAccesBackoffice();
    navigate('/admin/dashboard');
  }

  async function gererTestConnexion() {
    setErreur('');
    setTestEnCours(true);
    setResultatsTest([]);

    const resultatLegacy = await testerConnexionGlpiLegacy();
    setResultatsTest([resultatLegacy]);

    const resultatV2 = await testerConnexionGlpiV2();
    setResultatsTest([resultatLegacy, resultatV2]);
    setTestEnCours(false);
  }

  return (
    <main className="login-page">
      <h1>Connexion Backoffice</h1>

      <form className="login-form" onSubmit={gererSoumission}>
        <label htmlFor="backoffice-code">Code unique</label>
        <input
          id="backoffice-code"
          type="text"
          value={code}
          onChange={(evenement) => setCode(evenement.target.value)}
        />

        {erreur ? <p className="message-erreur">{erreur}</p> : null}

        <div className="button-row">
          <button type="submit">Entrer dans le backoffice</button>
          <button type="button" onClick={gererTestConnexion} disabled={testEnCours}>
            {testEnCours ? 'Test en cours...' : 'Tester connexion GLPI'}
          </button>
        </div>
      </form>

      {resultatsTest.length > 0 ? (
        <section className="resultats-test" aria-live="polite">
          {resultatsTest.map((resultat) => (
            <article
              className={`resultat-test ${resultat.succes ? 'reussi' : 'echec'}`}
              key={resultat.api}
            >
              <strong>
                API {resultat.api === 'legacy' ? 'legacy' : 'v2'} : {resultat.message}
              </strong>
              {!resultat.succes && resultat.erreur ? <span>{resultat.erreur}</span> : null}
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}
