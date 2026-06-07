import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recupererTousLesElements } from '../../api/assetsApi';

const filtresInitiaux = {
  nom: '',
  type: '',
  statut: '',
  numeroSerie: '',
  localisation: '',
};

function normaliserValeur(valeur) {
  return String(valeur ?? '').trim().toLowerCase();
}

function recupererLibelleChamp(valeur) {
  if (valeur === null || valeur === undefined || valeur === '') {
    return '-';
  }

  if (typeof valeur === 'object') {
    return valeur.name || valeur.completename || valeur.id || '-';
  }

  return valeur;
}

function recupererStatut(element) {
  return recupererLibelleChamp(element.states_id);
}

function recupererLocalisation(element) {
  return recupererLibelleChamp(element.locations_id);
}

function elementCorrespondAuxFiltres(element, filtres) {
  const valeursElement = {
    nom: normaliserValeur(element.name),
    type: normaliserValeur(`${element.typeAffiche} ${element.itemtype}`),
    statut: normaliserValeur(recupererStatut(element)),
    numeroSerie: normaliserValeur(element.serial),
    localisation: normaliserValeur(recupererLocalisation(element)),
  };

  return Object.entries(filtres).every(([champ, valeur]) => {
    const recherche = normaliserValeur(valeur);
    return !recherche || valeursElement[champ].includes(recherche);
  });
}

export default function ListeElements() {
  const navigation = useNavigate();
  const [elements, definirElements] = useState([]);
  const [filtres, definirFiltres] = useState(filtresInitiaux);
  const [chargement, definirChargement] = useState(true);
  const [erreur, definirErreur] = useState('');

  const elementsFiltres = useMemo(
    () => elements.filter((element) => elementCorrespondAuxFiltres(element, filtres)),
    [elements, filtres],
  );

  async function chargerElements() {
    definirChargement(true);
    definirErreur('');

    try {
      const donnees = await recupererTousLesElements();
      definirElements(donnees);
    } catch (erreurChargement) {
      definirErreur(erreurChargement.message);
    } finally {
      definirChargement(false);
    }
  }

  useEffect(() => {
    chargerElements();
  }, []);

  function mettreAJourFiltre(champ, valeur) {
    definirFiltres((filtresCourants) => ({
      ...filtresCourants,
      [champ]: valeur,
    }));
  }

  function reinitialiserFiltres() {
    definirFiltres(filtresInitiaux);
  }

  function creerTicketPourElement(element) {
    // La page de création de ticket récupère cet élément pour préremplir le contexte.
    sessionStorage.setItem('element_selectionne_ticket', JSON.stringify(element));
    navigation('/front/create-ticket');
  }

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Éléments GLPI</h1>
          <p>Recherche multicritère sur les éléments chargés depuis GLPI.</p>
        </div>
        <button type="button" onClick={chargerElements} disabled={chargement}>
          Actualiser
        </button>
      </div>

      {erreur ? <p className="message-erreur">{erreur}</p> : null}
      {chargement ? <p>Chargement des éléments...</p> : null}

      {!chargement && !erreur ? (
        <>
          <section className="filtres-elements" aria-label="Filtres des éléments GLPI">
            <label htmlFor="filtre-nom">
              Nom
              <input
                id="filtre-nom"
                type="search"
                value={filtres.nom}
                onChange={(evenement) => mettreAJourFiltre('nom', evenement.target.value)}
                placeholder="Nom"
              />
            </label>

            <label htmlFor="filtre-type">
              Type
              <input
                id="filtre-type"
                type="search"
                value={filtres.type}
                onChange={(evenement) => mettreAJourFiltre('type', evenement.target.value)}
                placeholder="Ordinateur, Printer..."
              />
            </label>

            <label htmlFor="filtre-statut">
              Statut
              <input
                id="filtre-statut"
                type="search"
                value={filtres.statut}
                onChange={(evenement) => mettreAJourFiltre('statut', evenement.target.value)}
                placeholder="Statut"
              />
            </label>

            <label htmlFor="filtre-numero-serie">
              Numéro de série
              <input
                id="filtre-numero-serie"
                type="search"
                value={filtres.numeroSerie}
                onChange={(evenement) => mettreAJourFiltre('numeroSerie', evenement.target.value)}
                placeholder="Numéro de série"
              />
            </label>

            <label htmlFor="filtre-localisation">
              Localisation
              <input
                id="filtre-localisation"
                type="search"
                value={filtres.localisation}
                onChange={(evenement) => mettreAJourFiltre('localisation', evenement.target.value)}
                placeholder="Localisation"
              />
            </label>

            <div className="actions-filtres">
              <button type="button" onClick={reinitialiserFiltres}>
                Réinitialiser les filtres
              </button>
            </div>
          </section>

          {elementsFiltres.length === 0 ? <p>Aucun élément trouvé.</p> : null}

          {elementsFiltres.length > 0 ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Nom</th>
                    <th>Type</th>
                    <th>Statut</th>
                    <th>Numéro de série</th>
                    <th>Localisation</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elementsFiltres.map((element) => (
                    <tr key={`${element.itemtype}-${element.id}`}>
                      <td>{element.id}</td>
                      <td>{element.name || '-'}</td>
                      <td>{element.typeAffiche || element.itemtype}</td>
                      <td>{recupererStatut(element)}</td>
                      <td>{element.serial || '-'}</td>
                      <td>{recupererLocalisation(element)}</td>
                      <td>
                        <button type="button" onClick={() => creerTicketPourElement(element)}>
                          Créer un ticket
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
