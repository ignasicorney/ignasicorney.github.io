# Generador de pàgines per blocs. Ha de fer el mateix HTML que editor/editor.js.
import json, html

def esc(s): return html.escape(str(s or ''), quote=True)

def bloc(tipus, dades, cos):
    d = '' if dades is None else ' ' + json.dumps(dades, ensure_ascii=False)
    return f'<!-- bloc:{tipus}{d} -->\n{cos}\n<!-- /bloc -->'

def text(h): return bloc('text', None, '<div class="text">\n' + h.strip() + '\n</div>')

def imatges(llista, pos='centre', rodo=False):
    d = {'pos': pos, 'rodo': rodo, 'imatges': llista}
    figs = []
    for i in llista:
        web = f"/assets/img/web/{i['f']}.jpg"
        alt = i.get('alt') or i.get('peu') or ''
        if i.get('enllac'):
            a = f'<a href="{esc(i["enllac"])}">'
        else:
            a = f'<a href="{web}" data-original="/assets/img/originals/{i["f"]}.{i["ext"]}" data-peu="{esc(i.get("peu") or alt)}">'
        cap = f'<figcaption>{esc(i["peu"])}</figcaption>' if i.get('peu') else ''
        figs.append(f'<figure style="width:{int(i.get("amplada") or 600)}px">{a}<img src="{web}" alt="{esc(alt)}" loading="lazy"></a>{cap}</figure>')
    cls = f'imatges pos-{pos}' + (' rodo' if rodo else '')
    return bloc('imatges', d, f'<div class="{cls}">' + ''.join(figs) + '</div>')

def carrussel(nom, tipus, titol):
    return bloc('carrussel', {'nom': nom, 'tipus': tipus, 'titol': titol},
                '{% include carrussel.html nom="' + nom + '" tipus="' + tipus + '" titol="' + esc(titol) + '" %}')

def video(id, titol):
    return bloc('video', {'id': id, 'titol': titol}, '{% include video.html id="' + id + '" titol="' + esc(titol) + '" %}')

def pagina(titol, desc, blocs):
    return f'---\nlayout: default\ntitle: {json.dumps(titol, ensure_ascii=False)}\ndescription: {json.dumps(desc, ensure_ascii=False)}\n---\n' + '\n\n'.join(blocs) + '\n'
