import { useEffect, useState } from 'react';
import { recupererTousLesElements } from '../../api/assetsApi';
import { creerCoutTicket, creerTicket, convertirNombreFormulaire, lierElementAuTicket } from '../../api/ticketsApi';
import { afficherValeurGlpi } from '../../utils/affichage';

const formulaireInitial = {
  titre: '',
  description: '',
  type: '1',
  urgence: '3',
  priorite: '3',
  clesElements: [],
  dureeSecondes: '',
  coutTemps: '',
  coutFixe: '',
};

function recupererCleElement(element) {
  return `${element.itemtype}:${element.id}`;
}

function recupererLibelleElement(element) {
  const typeElement = afficherValeurGlpi(element.typeAffiche || element.itemtype);
  const nomElement = afficherValeurGlpi(element.name);
  return `${typeElement} #${element.id} - ${nomElement === '-' ? 'Sans nom' : nomElement}`;
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

function champCoutRenseigne(formulaire) {
  return Boolean(
    String(formulaire.dureeSecondes ?? '').trim() ||
      String(formulaire.coutTemps ?? '').trim() ||
      String(formulaire.coutFixe ?? '').trim(),
  );
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

  async function creerTicketAvecElementsEtCout() {
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

    await Promise.all(elementsSelectionnes.map((element) => lierElementAuTicket(idTicket, element)));

    let coutAjoute = false;

    if (champCoutRenseigne(formulaire)) {
      try {
        await creerCoutTicket(idTicket, {
          dureeSecondes: convertirNombreFormulaire(formulaire.dureeSecondes),
          coutTemps: convertirNombreFormulaire(formulaire.coutTemps),
          coutFixe: convertirNombreFormulaire(formulaire.coutFixe),
        });
        coutAjoute = true;
      } catch {
        definirMessageSucces('Ticket créé, mais le coût n’a pas pu être ajouté.');
        definirErreur('');
        return;
      }
    }

    definirMessageSucces(coutAjoute ? 'Ticket créé avec coût associé' : `Ticket #${idTicket} créé avec succès.`);
    reinitialiserFormulaire();
  }

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    definirSoumission(true);
    definirMessageSucces('');
    definirErreur('');

    try {
      await creerTicketAvecElementsEtCout();
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

        <section className="coût-durée-ticket" aria-labelledby="titre-cout-ticket">
          <h2 id="titre-cout-ticket">Coût / durée d’intervention (optionnel)</h2>

          <div className="form-grid">
            <label htmlFor="ticket-duree-secondes">
              Durée en secondes
              <input
                id="ticket-duree-secondes"
                type="number"
                min="0"
                step="1"
                value={formulaire.dureeSecondes}
                onChange={(evenement) => mettreAJourChamp('dureeSecondes', evenement.target.value)}
                placeholder="0"
              />
            </label>

            <label htmlFor="ticket-cout-temps">
              Coût temps
              <input
                id="ticket-cout-temps"
                type="number"
                min="0"
                step="0.01"
                value={formulaire.coutTemps}
                onChange={(evenement) => mettreAJourChamp('coutTemps', evenement.target.value)}
                placeholder="0"
              />
            </label>

            <label htmlFor="ticket-cout-fixe">
              Coût fixe
              <input
                id="ticket-cout-fixe"
                type="number"
                min="0"
                step="0.01"
                value={formulaire.coutFixe}
                onChange={(evenement) => mettreAJourChamp('coutFixe', evenement.target.value)}
                placeholder="0"
              />
            </label>
          </div>
        </section>

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
