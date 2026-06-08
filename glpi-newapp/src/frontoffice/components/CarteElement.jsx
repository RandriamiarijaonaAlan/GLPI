import { afficherValeurGlpi } from '../../utils/affichage';

export default function CarteElement({ element }) {
  return (
    <article className="carte-element">
      <strong>{afficherValeurGlpi(element.name) || 'Sans nom'}</strong>
      <span>{afficherValeurGlpi(element.itemtype)}</span>
      <small>ID {element.id}</small>
    </article>
  );
}
