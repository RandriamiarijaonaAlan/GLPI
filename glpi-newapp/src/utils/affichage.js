export function afficherValeurGlpi(valeur) {
  if (valeur === null || valeur === undefined) {
    return '-';
  }

  if (Array.isArray(valeur)) {
    return valeur.map((element) => afficherValeurGlpi(element)).join(', ');
  }

  if (typeof valeur === 'string' || typeof valeur === 'number') {
    return valeur;
  }

  if (typeof valeur === 'object' && 'name' in valeur) {
    return valeur.name;
  }

  // GLPI peut retourner certains champs enrichis sous forme d'objet.
  if (typeof valeur === 'object') {
    return JSON.stringify(valeur);
  }

  return String(valeur);
}
