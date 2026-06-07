import { useEffect, useState } from 'react';
import { recupererTousLesElements } from '../../api/assetsApi';
import { creerTicket, lierElementAuTicket } from '../../api/ticketsApi';

const formulaireInitial = {
  titre: '',
  description: '',
  type: '1',
  urgence: '3',
  priorite: '3',
  clesElements: [],
};

function recupererCleElement(element) {
  return `${element.itemtype}:${element.id}`;
}

function recupererLibelleElement(element) {
  const typeElement = element.typeAffiche || element.itemtype;
  return `${typeElement} #${element.id} - ${element.name || 'Sans nom'}`;
}

function recupererElementSelectionneTicket() {
  const valeurStockee = sessionStorage.getItem('element_selectionne_ticket');

  if (!valeurStockee) {
    return null;
  }

  try {
    return JSON.parse(valeurStockee);
  } catch {
    sessionStorage.removeItem('element_selectionne_ticket');
    return null;
  }
}

function completerElementsAvecSelection(elements, elementSelectionne) {
  if (!elementSelectionne) {
    return elements;
  }

  const cleSelectionnee = recupererCleElement(elementSelectionne);
  const selectionDejaPresente = elements.some(
    (element) => recupererCleElement(element) === cleSelectionnee,
  );

  return selectionDejaPresente ? elements : [elementSelectionne, ...elements];
}

export default function CreationTicket() {
  const [formulaire, definirFormulaire] = useState(formulaireInitial);
  const [elements, definirElements] = useState([]);
  const [chargementElements, definirChargementElements] = useState(true);
  const [soumission, definirSoumission] = useState(false);
  const [messageSucces, definirMessageSucces] = useState('');
  const [erreur, definirErreur] = useState('');

  useEffect(() => {
    async function chargerElements() {
      definirChargementElements(true);
      definirErreur('');

      try {
        const elementSelectionne = recupererElementSelectionneTicket();
        const donnees = await recupererTousLesElements();
        const elementsComplets = completerElementsAvecSelection(donnees, elementSelectionne);

        definirElements(elementsComplets);

        if (elementSelectionne) {
          definirFormulaire((formulaireCourant) => ({
            ...formulaireCourant,
            clesElements: [recupererCleElement(elementSelectionne)],
          }));
        }
      } catch (erreurChargement) {
        definirErreur(`Impossible de charger les éléments GLPI : ${erreurChargement.message}`);
      } finally {
        definirChargementElements(false);
      }
    }

    chargerElements();
  }, []);

  function mettreAJourChamp(champ, valeur) {
    definirFormulaire((formulaireCourant) => ({
      ...formulaireCourant,
      [champ]: valeur,
    }));
  }

  function basculerElement(element, coche) {
    const cleElement = recupererCleElement(element);

    definirFormulaire((formulaireCourant) => {
      const clesElements = coche
        ? [...new Set([...formulaireCourant.clesElements, cleElement])]
        : formulaireCourant.clesElements.filter((cleCourante) => cleCourante !== cleElement);

      return {
        ...formulaireCourant,
        clesElements,
      };
    });
  }

  function reinitialiserFormulaire() {
    definirFormulaire(formulaireInitial);
    sessionStorage.removeItem('element_selectionne_ticket');
  }

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    definirSoumission(true);
    definirMessageSucces('');
    definirErreur('');

    try {
      const ticket = await creerTicket({
        titre: formulaire.titre,
        description: formulaire.description,
        type: Number(formulaire.type),
        urgence: Number(formulaire.urgence),
        priorite: Number(formulaire.priorite),
      });
      const idTicket = ticket.id;

      if (!idTicket) {
        throw new Error(`Ticket créé mais ID introuvable : ${JSON.stringify(ticket)}`);
      }

      const elementsSelectionnes = elements.filter((element) =>
        formulaire.clesElements.includes(recupererCleElement(element)),
      );

      await Promise.all(
        elementsSelectionnes.map((element) => lierElementAuTicket(idTicket, element)),
      );

      definirMessageSucces(`Ticket #${idTicket} créé avec succès.`);
      reinitialiserFormulaire();
    } catch (erreurSoumission) {
      definirErreur(`Impossible de créer le ticket : ${erreurSoumission.message}`);
    } finally {
      definirSoumission(false);
    }
  }

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <div>
          <h1>Créer un ticket</h1>
          <p>Associez un ou plusieurs éléments GLPI à votre demande.</p>
        </div>
      </div>

      <form className="ticket-form" onSubmit={gererSoumission}>
        <label htmlFor="ticket-titre">
          Titre
          <input
            id="ticket-titre"
            type="text"
            value={formulaire.titre}
            onChange={(evenement) => mettreAJourChamp('titre', evenement.target.value)}
            required
          />
        </label>

        <label htmlFor="ticket-description">
          Description
          <textarea
            id="ticket-description"
            value={formulaire.description}
            onChange={(evenement) => mettreAJourChamp('description', evenement.target.value)}
            required
          />
        </label>

        <div className="form-grid">
          <label htmlFor="ticket-type">
            Type
            <select
              id="ticket-type"
              value={formulaire.type}
              onChange={(evenement) => mettreAJourChamp('type', evenement.target.value)}
            >
              <option value="1">Incident</option>
              <option value="2">Demande</option>
            </select>
          </label>

          <label htmlFor="ticket-urgence">
            Urgence
            <select
              id="ticket-urgence"
              value={formulaire.urgence}
              onChange={(evenement) => mettreAJourChamp('urgence', evenement.target.value)}
            >
              <option value="1">Très basse</option>
              <option value="2">Basse</option>
              <option value="3">Moyenne</option>
              <option value="4">Haute</option>
              <option value="5">Très haute</option>
            </select>
          </label>

          <label htmlFor="ticket-priorite">
            Priorité
            <select
              id="ticket-priorite"
              value={formulaire.priorite}
              onChange={(evenement) => mettreAJourChamp('priorite', evenement.target.value)}
            >
              <option value="1">Très basse</option>
              <option value="2">Basse</option>
              <option value="3">Moyenne</option>
              <option value="4">Haute</option>
              <option value="5">Très haute</option>
            </select>
          </label>
        </div>

        <section className="selection-elements-ticket" aria-labelledby="titre-elements-ticket">
          <div className="entete-selection-elements">
            <h2 id="titre-elements-ticket">Éléments liés</h2>
            <span>{formulaire.clesElements.length} sélectionné(s)</span>
          </div>

          {chargementElements ? <p>Chargement des éléments...</p> : null}

          {!chargementElements && elements.length === 0 ? <p>Aucun élément GLPI disponible.</p> : null}

          {!chargementElements && elements.length > 0 ? (
            <div className="liste-elements-ticket">
              {elements.map((element) => {
                const cleElement = recupererCleElement(element);

                return (
                  <label className="ligne-element-ticket" key={cleElement}>
                    <input
                      type="checkbox"
                      checked={formulaire.clesElements.includes(cleElement)}
                      onChange={(evenement) => basculerElement(element, evenement.target.checked)}
                    />
                    <span>{recupererLibelleElement(element)}</span>
                  </label>
                );
              })}
            </div>
          ) : null}
        </section>

        {messageSucces ? <p className="message-succes">{messageSucces}</p> : null}
        {erreur ? <p className="message-erreur">{erreur}</p> : null}

        <button type="submit" disabled={soumission || chargementElements}>
          {soumission ? 'Création en cours...' : 'Créer le ticket'}
        </button>
      </form>
    </main>
  );
}
