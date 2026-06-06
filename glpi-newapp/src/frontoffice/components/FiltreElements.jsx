export default function FiltreElements({ valeur, onChanger }) {
  return (
    <label className="filtre-elements" htmlFor="filtre-elements">
      Rechercher un élément
      <input
        id="filtre-elements"
        type="search"
        value={valeur}
        onChange={(evenement) => onChanger(evenement.target.value)}
        placeholder="Nom, type ou ID"
      />
    </label>
  );
}
