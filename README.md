# ignasicorney.github.io

Web personal d'Ignasi Corney Oller, publicat amb GitHub Pages (Jekyll).

## Editar el web

L'editor és a https://ignasicorney.github.io/editor/ (no surt a Google). Demana una clau de GitHub del compte ignasicorney amb permís «Contents: Read and write» sobre aquest repositori. Hi pots:

- editar el text de cada secció (negreta, cursiva, subratllat, enllaços, títols, llistes, cites);
- pujar, baixar, afegir o treure blocs de text, imatges, carrussels i vídeos;
- pujar imatges noves o canviar-les (es redueixen soles) i triar-ne posició, mida i cantonades;
- escriure, editar i esborrar entrades del blog.

Les pàgines són fetes de blocs `<!-- bloc:tipus {…} -->` … `<!-- /bloc -->`. L'HTML de cada bloc el generen `editor/editor.js` i `_eines/blocs.py`, que han de fer el mateix.

## Imatges

- `assets/img/originals/`: originals rescatats de Wix tal com hi eren.
- `assets/img/web/` i `assets/img/mini/`: versions reduïdes per al web.
- Les galeries es defineixen a `_data/galeries.yml`.
