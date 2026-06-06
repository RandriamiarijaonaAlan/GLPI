export default function CarteElement({ element }) {
  return (
    <article className="carte-element">
      <strong>{element.name || 'Sans nom'}</strong>
      <span>{element.itemtype}</span>
      <small>ID {element.id}</small>
    </article>
  );
}
