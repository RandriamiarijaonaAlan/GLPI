import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { chargerUrlImageDocument, recupererDocumentsParElement, recupererTousLesElements } from '../../api/assetsApi';
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
  const texte = String(afficherValeurGlpi(valeur) ?? '').trim();
  return !texte || texte === '0' ? '-' : texte;
}

function elementCorrespondAuxFiltres(element, filtres) {
  const valeursElement = {
    nom: normaliserValeur(element.nom ?? element.name),
    statut: normaliserValeur(element.statut ?? element.status),
    localisation: normaliserValeur(element.localisation ?? element.location),
    fabricant: normaliserValeur(element.fabricant ?? element.manufacturer),
    typeElement: normaliserValeur(`${element.typeElement ?? element.typeAffiche} ${element.itemType} ${element.itemtype}`),
    modele: normaliserValeur(element.modele ?? element.model),
    numeroInventaire: normaliserValeur(element.numeroInventaire ?? element.inventoryNumber),
    utilisateur: normaliserValeur(element.utilisateur ?? element.user),
  };
  return Object.entries(filtres).every(([champ, valeur]) => {
    const recherche = normaliserValeur(valeur);
    return !recherche || valeursElement[champ].includes(recherche);
  });
}

// Retourne la clé de classe CSS selon le libellé du statut
function classeStatut(statut) {
  const s = String(statut).toLowerCase();
  if (s.includes('production')) return 'statut-production';
  if (s.includes('maintenance')) return 'statut-maintenance';
  if (s.includes('panne')) return 'statut-panne';
  if (s.includes('stock')) return 'statut-stock';
  return 'statut-defaut';
}

// Cherche l'id document lié à un élément dans la map, en tenant compte du cas Glpi\Socket
function obtenirIdDocumentPourElement(mapDocuments, element) {
  const cle = `${element.itemtype}#${element.id}`;
  if (mapDocuments.has(cle)) return mapDocuments.get(cle);
  // Socket est enregistré comme Glpi\Socket dans la table Document_Item
  const cleGlpi = `Glpi\\${element.itemtype}#${element.id}`;
  if (mapDocuments.has(cleGlpi)) return mapDocuments.get(cleGlpi);
  return null;
}

// Charge et affiche l'image d'un document GLPI en tant que blob URL
function ImageCarte({ idDocument }) {
  const [urlBlob, definirUrlBlob] = useState(null);
  const [chargement, definirChargement] = useState(!!idDocument);

  useEffect(() => {
    if (!idDocument) {
      definirChargement(false);
      return;
    }
    let urlCree = null;
    chargerUrlImageDocument(idDocument).then((url) => {
      urlCree = url;
      definirUrlBlob(url);
      definirChargement(false);
    });
    return () => {
      if (urlCree) URL.revokeObjectURL(urlCree);
    };
  }, [idDocument]);

  if (chargement) {
    return <div className="carte-element-image carte-element-image--chargement" aria-hidden="true" />;
  }

  if (!urlBlob) {
    return (
      <div className="carte-element-image carte-element-image--vide" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <rect x="3" y="5" width="18" height="15" rx="2" />
          <circle cx="12" cy="12" r="3" />
          <path d="M9 5V3h6v2" />
        </svg>
      </div>
    );
  }

  return <img src={urlBlob} alt="" className="carte-element-image carte-element-image--photo" />;
}

// Affiche une carte pour un élément du parc
function CarteElement({ element, idDocument, onCreerTicket }) {
  const nom = normaliserValeurAffichage(element.nom ?? element.name);
  const statut = normaliserValeurAffichage(element.statut ?? element.status);
  const localisation = normaliserValeurAffichage(element.localisation ?? element.location);
  const fabricant = normaliserValeurAffichage(element.fabricant ?? element.manufacturer);
  const typeAffiche = normaliserValeurAffichage(
    element.typeElement ?? element.typeAffiche ?? element.itemType ?? element.itemtype,
  );
  const modele = normaliserValeurAffichage(element.modele ?? element.model);
  const numeroInventaire = normaliserValeurAffichage(element.numeroInventaire ?? element.inventoryNumber);
  const utilisateur = normaliserValeurAffichage(element.utilisateur ?? element.user);

  const ligneMatériel = [fabricant, modele].filter((v) => v !== '-').join(' · ');

  return (
    <article className="carte-element-fiche">
      <ImageCarte idDocument={idDocument} />

      <div className="carte-element-fiche__corps">
        <div className="carte-element-fiche__entete">
          <span className="carte-element-fiche__nom">{nom}</span>
          <span className="carte-element-fiche__badge">{typeAffiche}</span>
        </div>

        <div className="carte-element-fiche__infos">
          {statut !== '-' && (
            <span className={`carte-element-fiche__statut ${classeStatut(statut)}`}>{statut}</span>
          )}
          {localisation !== '-' && (
            <span className="carte-element-fiche__info-ligne">
              <span className="carte-element-fiche__info-libelle">Localisation :</span>
              {localisation}
            </span>
          )}
          {ligneMatériel && (
            <span className="carte-element-fiche__info-ligne">
              <span className="carte-element-fiche__info-libelle">Matériel :</span>
              {ligneMatériel}
            </span>
          )}
          {numeroInventaire !== '-' && (
            <span className="carte-element-fiche__info-ligne">
              <span className="carte-element-fiche__info-libelle">N° inv. :</span>
              {numeroInventaire}
            </span>
          )}
          {utilisateur !== '-' && (
            <span className="carte-element-fiche__info-ligne">
              <span className="carte-element-fiche__info-libelle">Utilisateur :</span>
              {utilisateur}
            </span>
          )}
        </div>
      </div>

      <div className="carte-element-fiche__action">
        <button type="button" onClick={onCreerTicket}>
          Créer un ticket
        </button>
      </div>
    </article>
  );
}

export default function ListeElements() {
  const navigation = useNavigate();
  const [elements, definirElements] = useState([]);
  const [mapDocuments, definirMapDocuments] = useState(new Map());
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
      const [donnees, docs] = await Promise.all([
        recupererTousLesElements(),
        recupererDocumentsParElement(),
      ]);
      definirElements(donnees);
      definirMapDocuments(docs);
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
    definirFiltres((filtresCourants) => ({ ...filtresCourants, [champ]: valeur }));
  }

  function reinitialiserFiltres() {
    definirFiltres(filtresInitiaux);
  }

  function creerTicketPourElement(element) {
    sessionStorage.setItem('element_selectionne_ticket', JSON.stringify(element));
    navigation('/front/create-ticket');
  }

  return (
    <main className="backoffice-page elements-page">
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
                onChange={(e) => mettreAJourFiltre('nom', e.target.value)}
                placeholder="Nom"
              />
            </label>
            <label htmlFor="filtre-statut">
              Statut
              <input
                id="filtre-statut"
                type="search"
                value={filtres.statut}
                onChange={(e) => mettreAJourFiltre('statut', e.target.value)}
                placeholder="Statut"
              />
            </label>
            <label htmlFor="filtre-localisation">
              Localisation
              <input
                id="filtre-localisation"
                type="search"
                value={filtres.localisation}
                onChange={(e) => mettreAJourFiltre('localisation', e.target.value)}
                placeholder="Localisation"
              />
            </label>
            <label htmlFor="filtre-fabricant">
              Fabricant
              <input
                id="filtre-fabricant"
                type="search"
                value={filtres.fabricant}
                onChange={(e) => mettreAJourFiltre('fabricant', e.target.value)}
                placeholder="Fabricant"
              />
            </label>
            <label htmlFor="filtre-type-element">
              Type d'élément
              <input
                id="filtre-type-element"
                type="search"
                value={filtres.typeElement}
                onChange={(e) => mettreAJourFiltre('typeElement', e.target.value)}
                placeholder="Ordinateur, Imprimante..."
              />
            </label>
            <label htmlFor="filtre-modele">
              Modèle
              <input
                id="filtre-modele"
                type="search"
                value={filtres.modele}
                onChange={(e) => mettreAJourFiltre('modele', e.target.value)}
                placeholder="Modèle"
              />
            </label>
            <label htmlFor="filtre-numero-inventaire">
              N° d'inventaire
              <input
                id="filtre-numero-inventaire"
                type="search"
                value={filtres.numeroInventaire}
                onChange={(e) => mettreAJourFiltre('numeroInventaire', e.target.value)}
                placeholder="N° d'inventaire"
              />
            </label>
            <label htmlFor="filtre-utilisateur">
              Utilisateur
              <input
                id="filtre-utilisateur"
                type="search"
                value={filtres.utilisateur}
                onChange={(e) => mettreAJourFiltre('utilisateur', e.target.value)}
                placeholder="Utilisateur"
              />
            </label>
            <div className="actions-filtres">
              <button type="button" onClick={reinitialiserFiltres}>
                Réinitialiser
              </button>
            </div>
          </section>

          <p className="elements-compteur">
            {elementsFiltres.length} élément{elementsFiltres.length !== 1 ? 's' : ''}
            {elements.length !== elementsFiltres.length ? ` sur ${elements.length}` : ''}
          </p>

          {elementsFiltres.length === 0 ? <p>Aucun élément trouvé.</p> : null}

          {elementsFiltres.length > 0 ? (
            <div className="grille-cartes-elements">
              {elementsFiltres.map((element) => (
                <CarteElement
                  key={`${element.itemtype}-${element.id}`}
                  element={element}
                  idDocument={obtenirIdDocumentPourElement(mapDocuments, element)}
                  onCreerTicket={() => creerTicketPourElement(element)}
                />
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
