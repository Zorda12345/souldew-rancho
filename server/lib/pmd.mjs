// Fork: sprites de Mundo Misterioso (PMD Collab / SpriteCollab, CC BY-NC 4.0) para el rancho, bajados bajo demanda.
// /rancho/pmd/<número>[/shiny]/<Nombre>-Anim.png | AnimData.xml -> raw de GitHub, con caché en disco.
export const PMD_URL = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite';

/** URL remota y archivo de caché para una ruta del rancho, o null si no es una ruta válida. */
export function pmdUrl(path) {
  const m = path.match(/^\/rancho\/pmd\/(\d{1,4})(\/shiny)?\/([A-Z][A-Za-z]{1,20}-Anim\.png|AnimData\.xml)$/);
  if (!m) return null;
  const id = Number(m[1]);
  if (id < 1 || id > 1025) return null;
  const dex = String(id).padStart(4, '0');
  // en el repositorio, la forma base shiny vive en <dex>/0000/0001/
  return {
    url: `${PMD_URL}/${dex}${m[2] ? '/0000/0001' : ''}/${m[3]}`,
    file: `${id}${m[2] ? '-shiny' : ''}/${m[3]}`,
  };
}
