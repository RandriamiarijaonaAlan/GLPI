import { useEffect, useState } from 'react';
import { recupererTousLesElements } from '../../api/assetsApi';
import CarteElement from '../components/CarteElement';
import FiltreElements from '../components/FiltreElements';

export default function ListeElements() {
  const [elements, setElements] = useState([]);
  const [filtre, setFiltre] = useState('');
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState('');

  const elementsFiltres = elements.filter((element) => {
    const recherche = filtre.trim().toLowerCase();

    if (!recherche) {
      return true;
    }

    return [element.id, element.itemtype, element.name]
      .filter(Boolean)
      .some((valeur) => String(valeur).toLowerCase().includes(recherche));
  });

  async function chargerElements() {
    setChargement(true);
    setErreur('');

    try {
      const donnees = await recupererTousLesElements();
      setElements(donnees);
    } catch (erreurChargement) {
      setErreur(erreurChargement.message);
    } finally {
      setChargement(false);
    }
  }

  useEffect(() => {
    chargerElements();
  }, []);

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <h1>Éléments GLPI</h1>
        <button type="button" onClick={chargerElements} disabled={chargement}>
          Actualiser
        </button>
      </div>

      {erreur ? <p className="message-erreur">{erreur}</p> : null}
      {chargement ? <p>Chargement des éléments...</p> : null}

      {!chargement && !erreur ? <FiltreElements valeur={filtre} onChanger={setFiltre} /> : null}

      {!chargement && !erreur ? (
        <section className="grille-elements">
          {elementsFiltres.map((element) => (
            <CarteElement element={element} key={`${element.itemtype}-${element.id}`} />
          ))}
        </section>
      ) : null}

      {!chargement && !erreur ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Nom</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {elementsFiltres.map((element) => (
                <tr key={`${element.itemtype}-${element.id}`}>
                  <td>{element.id}</td>
                  <td>{element.itemtype}</td>
                  <td>{element.name || '-'}</td>
                  <td>{element.states_id || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {!chargement && !erreur && elementsFiltres.length === 0 ? <p>Aucun élément trouvé.</p> : null}
    </main>
  );
}
