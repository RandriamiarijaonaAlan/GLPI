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
  return `${element.itemtype} #${element.id} - ${element.name || 'Sans nom'}`;
}

export default function CreerTicket() {
  const [formulaire, setFormulaire] = useState(formulaireInitial);
  const [elements, setElements] = useState([]);
  const [chargementElements, setChargementElements] = useState(true);
  const [soumission, setSoumission] = useState(false);
  const [messageSucces, setMessageSucces] = useState('');
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    async function chargerElements() {
      setChargementElements(true);
      setErreur('');

      try {
        const donnees = await recupererTousLesElements();
        setElements(donnees);
      } catch (erreurChargement) {
        setErreur(erreurChargement.message);
      } finally {
        setChargementElements(false);
      }
    }

    chargerElements();
  }, []);

  function mettreAJourChamp(champ, valeur) {
    setFormulaire((courant) => ({
      ...courant,
      [champ]: valeur,
    }));
  }

  function gererChangementElements(evenement) {
    const valeursSelectionnees = Array.from(
      evenement.target.selectedOptions,
      (option) => option.value,
    );
    mettreAJourChamp('clesElements', valeursSelectionnees);
  }

  async function gererSoumission(evenement) {
    evenement.preventDefault();
    setSoumission(true);
    setMessageSucces('');
    setErreur('');

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
        throw new Error(`Ticket créé mais ID introuvable: ${JSON.stringify(ticket)}`);
      }

      const elementsSelectionnes = elements.filter((element) =>
        formulaire.clesElements.includes(recupererCleElement(element)),
      );
      await Promise.all(
        elementsSelectionnes.map((element) => lierElementAuTicket(idTicket, element)),
      );

      setMessageSucces(`Ticket #${idTicket} créé avec succès.`);
      setFormulaire(formulaireInitial);
    } catch (erreurSoumission) {
      setErreur(erreurSoumission.message);
    } finally {
      setSoumission(false);
    }
  }

  return (
    <main className="backoffice-page">
      <div className="page-header">
        <h1>Créer un ticket</h1>
      </div>

      <form className="ticket-form" onSubmit={gererSoumission}>
        <label htmlFor="ticket-title">Titre</label>
        <input
          id="ticket-title"
          type="text"
          value={formulaire.titre}
          onChange={(evenement) => mettreAJourChamp('titre', evenement.target.value)}
          required
        />

        <label htmlFor="ticket-description">Description</label>
        <textarea
          id="ticket-description"
          value={formulaire.description}
          onChange={(evenement) => mettreAJourChamp('description', evenement.target.value)}
          required
        />

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

          <label htmlFor="ticket-urgency">
            Urgence
            <select
              id="ticket-urgency"
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

          <label htmlFor="ticket-priority">
            Priorité
            <select
              id="ticket-priority"
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

        <label htmlFor="ticket-elements">Éléments liés</label>
        <select
          id="ticket-elements"
          multiple
          value={formulaire.clesElements}
          onChange={gererChangementElements}
          disabled={chargementElements}
        >
          {elements.map((element) => (
            <option key={recupererCleElement(element)} value={recupererCleElement(element)}>
              {recupererLibelleElement(element)}
            </option>
          ))}
        </select>

        {chargementElements ? <p>Chargement des éléments...</p> : null}
        {messageSucces ? <p className="message-succes">{messageSucces}</p> : null}
        {erreur ? <p className="message-erreur">{erreur}</p> : null}

        <button type="submit" disabled={soumission}>
          {soumission ? 'Création en cours...' : 'Créer le ticket'}
        </button>
      </form>
    </main>
  );
}
