import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { recupererTousLesElements } from '../../api/assetsApi';
import { afficherValeurGlpi } from '../../utils/affichage';

const filtresInitiaux = {
  nom: '',
  statut: '',
  localisation: '',
  fabricant: '',
  typeElement: '',
  modele: '',
  numeroInventaire: '',
  utilisateur: '',
};

function normaliserValeur(valeur) {
  return String(afficherValeurGlpi(valeur) ?? '').trim().toLowerCase();
}

function normaliserValeurAffichage(valeur) {
  const valeurAffichee = afficherValeurGlpi(valeur);
  const texte = String(valeurAffichee ?? '').trim();

  if (!texte || texte === '0') {
    return '-';
  }

  return texte;
}

function elementCorrespondAuxFiltres(element, filtres) {
  const valeursElement = {
    nom: normaliserValeur(element.name),
    statut: normaliserValeur(element.status),
    localisation: normaliserValeur(element.location),
    fabricant: normaliserValeur(element.manufacturer),
    typeElement: normaliserValeur(`${element.typeAffiche} ${element.itemType} ${element.itemtype}`),
    modele: normaliserValeur(element.model),
    numeroInventaire: normaliserValeur(element.inventoryNumber),
    utilisateur: normaliserValeur(element.user),
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

            <label htmlFor="filtre-fabricant">
              Fabricant
              <input
                id="filtre-fabricant"
                type="search"
                value={filtres.fabricant}
                onChange={(evenement) => mettreAJourFiltre('fabricant', evenement.target.value)}
                placeholder="Fabricant"
              />
            </label>

            <label htmlFor="filtre-type-element">
              Type d’élément
              <input
                id="filtre-type-element"
                type="search"
                value={filtres.typeElement}
                onChange={(evenement) => mettreAJourFiltre('typeElement', evenement.target.value)}
                placeholder="Ordinateur, Imprimante..."
              />
            </label>

            <label htmlFor="filtre-modele">
              Modèle
              <input
                id="filtre-modele"
                type="search"
                value={filtres.modele}
                onChange={(evenement) => mettreAJourFiltre('modele', evenement.target.value)}
                placeholder="Modèle"
              />
            </label>

            <label htmlFor="filtre-numero-inventaire">
              Numéro d’inventaire
              <input
                id="filtre-numero-inventaire"
                type="search"
                value={filtres.numeroInventaire}
                onChange={(evenement) => mettreAJourFiltre('numeroInventaire', evenement.target.value)}
                placeholder="Numéro d’inventaire"
              />
            </label>

            <label htmlFor="filtre-utilisateur">
              Utilisateur
              <input
                id="filtre-utilisateur"
                type="search"
                value={filtres.utilisateur}
                onChange={(evenement) => mettreAJourFiltre('utilisateur', evenement.target.value)}
                placeholder="Utilisateur"
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
                    <th>Statut</th>
                    <th>Localisation</th>
                    <th>Fabricant</th>
                    <th>Type d’élément</th>
                    <th>Modèle</th>
                    <th>Numéro d’inventaire</th>
                    <th>Utilisateur</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {elementsFiltres.map((element) => (
                    <tr key={`${element.itemtype}-${element.id}`}>
                      <td>{element.id}</td>
                      <td>{normaliserValeurAffichage(element.name)}</td>
                      <td>{normaliserValeurAffichage(element.status)}</td>
                      <td>{normaliserValeurAffichage(element.location)}</td>
                      <td>{normaliserValeurAffichage(element.manufacturer)}</td>
                      <td>{normaliserValeurAffichage(element.typeAffiche || element.itemType || element.itemtype)}</td>
                      <td>{normaliserValeurAffichage(element.model)}</td>
                      <td>{normaliserValeurAffichage(element.inventoryNumber)}</td>
                      <td>{normaliserValeurAffichage(element.user)}</td>
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
