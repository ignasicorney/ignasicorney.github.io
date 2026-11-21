#!/usr/bin/env python3
"""Recursos per a l'aula — extreu els articles de l'Agenda Latinoamericana / Llatinoamericana.

Llicència dels continguts (segons la mateixa Agenda): «propietat del Poble llatinoamericà,
que dona permís per copiar, citar, reproduir i difondre lliurement i no comercialment».

Sortida (a tauler/aula/):
  index.json            fitxes de tots els textos (sense el text sencer)
  textos/AAAA-ll.json   text sencer de cada article, per any i llengua
  estat.json            fonts processades i resum
"""
import collections, datetime, hashlib, json, os, re, sys, time, unicodedata
from urllib.parse import urljoin, urlparse

import fitz  # PyMuPDF
import requests
from bs4 import BeautifulSoup

SORTIDA = sys.argv[1] if len(sys.argv) > 1 else "tauler/aula"
CAU = "/tmp/aula_pdf"
LLAVORS = [
    "https://www.latinoamericana.org/digital/",
    "https://agendalatinoamericana.red/material/",
    "https://llatinoamericana.org/",
]
SEGUIR = {"agendalatinoamericana.red", "llatinoamericana.org", "www.llatinoamericana.org"}
EXCLOU_URL = re.compile(r"/(English|Italia|EnFrancais)/|/ITA\d|italia|brasil|english|francais|mondiale|latino-americana|portugu|socis|premi_|cartel|mapa_peters_pintar", re.I)
UA = {"User-Agent": "Mozilla/5.0 (Bitacola aula; us educatiu no comercial)"}

ses = requests.Session()
ses.headers.update(UA)


def baixa(url, binari=False):
    for i in range(3):
        try:
            r = ses.get(url, timeout=60)
            if r.status_code == 200:
                return r.content if binari else r.text
            print(f"  {r.status_code} {url}")
            return None
        except Exception as e:
            print(f"  error {url}: {e}")
            time.sleep(3 * (i + 1))
    return None


def cerca_pdfs():
    pdfs, vist, cua = {}, set(), [(u, 0) for u in LLAVORS]
    while cua and len(vist) < 120:
        url, prof = cua.pop(0)
        if url in vist:
            continue
        vist.add(url)
        html = baixa(url)
        if not html:
            continue
        for a in BeautifulSoup(html, "html.parser").find_all("a", href=True):
            h = urljoin(url, a["href"].strip()).split("#")[0]
            dom = urlparse(h).netloc.lower()
            if h.lower().endswith(".pdf"):
                if not EXCLOU_URL.search(h):
                    pdfs.setdefault(h, (a.get_text(" ", strip=True) or "")[:200])
            elif prof < 2 and dom in SEGUIR and dom == urlparse(url).netloc.lower():
                cua.append((h, prof + 1))
    return pdfs


def any_de(url, etiqueta):
    """Any de l'edició; 0 = reculls, antologies i materials sense any."""
    nom = requests.utils.unquote(urlparse(url).path.rsplit("/", 1)[-1]).lower()
    if re.search(r"antolog|recull", nom):
        return 0
    for t in (nom, etiqueta):
        m = re.search(r"(?<!\d)(199[2-9]|20[0-3]\d)(?!\d)", requests.utils.unquote(t))
        if m:
            return int(m.group(1))
    return 0


# ---------- llengua ----------
CA = set("els les amb per però més també això aquest aquesta són això seva seus perquè d'una nostra nostre fins molt hi ha totes tots".split())
ES = set("los las con por pero más también esto este esta son su sus porque una nuestra nuestro hasta muy hay todas todos del".split())
PT = set("não uma são também nós você muito pelo pela isso esta essa como mais".split())
EN = set("the and of to is that with for are this from".split())
IT = set("della delle degli che sono gli nel nella alla anche questo questa perché non è più loro".split())
FR = set("les des est une dans pour qui sont nous avec cette leur aux".split())


def llengua(text):
    p = re.findall(r"[a-zà-ÿ']+", text.lower())
    if len(p) < 40:
        return None
    c = collections.Counter(p)
    ca, es, pt, en, it, fr = (sum(c[w] for w in s) for s in (CA, ES, PT, EN, IT, FR))
    ca += 3 * text.count("l·l") + c["i"] * 0.5
    es += c["y"] * 0.5
    millor = max((ca, "ca"), (es, "es"), (pt, "pt"), (en, "en"), (it, "it"), (fr, "fr"))
    return millor[1] if millor[0] > 0 else None


# ---------- temes ----------
TEMES = {
    "Drets humans": r"derechos humanos|drets humans|dignidad|dignitat|tortura|desaparecid|desapareg",
    "Democràcia i ciutadania": r"democr[aà]c|ciudadan|ciutadan|participaci[oó]n|participaci[oó]|eleccion|eleccions|vot[oa]r?\b|pol[ií]tica",
    "Ecologia i planeta": r"ecolog|medio ambiente|medi ambient|clim[aà]tic|cambio clim|canvi clim|amazon|agua\b|aigua|natura|planeta|biodivers",
    "Gènere i feminisme": r"mujer|dona\b|dones|g[eè]nere?\b|feminis|patriarca|machis|masclis",
    "Migracions": r"migra|refugiad|refugiat|exili|fronter",
    "Pau i no-violència": r"\bpaz\b|\bpau\b|no.?violen|guerra|armas|armes|militar",
    "Economia i justícia social": r"pobreza|pobresa|desigualtat|desigualdad|deuda|deute|capitalis|neoliberal|mercado|mercat|trabaj|treball",
    "Pobles indígenes": r"ind[ií]gena|originari|afrodescend|negr[oa]s\b|racis",
    "Educació": r"educaci|escuela|escola|maestr|mestre|alfabetiz|pedagog",
    "Comunicació i mitjans": r"comunicaci|medios de|mitjans|periodis|internet|digital|redes sociales|xarxes",
    "Espiritualitat i religió": r"\bdios\b|\bdéu\b|iglesia|església|jes[uú]s|teolog|espiritual|religi",
    "Memòria i història": r"memoria|memòria|historia|història|colonia|conquista|dictadura",
}
TEMES_RE = {k: re.compile(v, re.I) for k, v in TEMES.items()}


def temes(text):
    r = []
    for k, rx in TEMES_RE.items():
        n = len(rx.findall(text))
        if n >= 4:
            r.append((n, k))
    return [k for _, k in sorted(r, reverse=True)[:3]]


ARG = re.compile(r"\b(debemos|hay que|creo que|considero|por (lo )?tanto|sin embargo|es necesario|no podemos|deber[ií]amos|en definitiva|propongo|es urgente|hem de|cal\b|caldria|crec que|per tant|tanmateix|és necessari|no podem|proposo|és urgent|hauríem)\b", re.I)
NARR_ES = re.compile(r"\b(\w{3,}(aron|ieron|aba|aban|ábamos)|fue|fueron|era|eran|había|habían|dijo|llegó|vivía)\b", re.I)
NARR_CA = re.compile(r"\bva(ren|m|u)? \w+(ar|er|ir|re)\b")


def tipus(titol, par, text, ll):
    t = titol.lower()
    if re.search(r"poema|poes[ií]a|po[eè]tic|salmo|\bsalm\b|oraci[oó]n|pregària|credo|cántico|càntic|canci[oó]n|cançó|himno|\bhimne", t):
        return "Poesia"
    mitj = len(text.split()) / max(1, len(par))
    if len(par) >= 8 and mitj < 18:
        return "Poesia"
    if re.search(r"\bentrevista\b", t) or text.count("?") >= 8 and re.search(r"[—–-]\s*¿", text):
        return "Entrevista"
    if re.search(r"^carta\b|\bcarta (a|al|abierta|oberta)\b", t):
        return "Carta"
    if re.search(r"cuento|\bconte\b|relato|\brelat\b|f[áa]bula|faula|parábola|paràbola|leyenda|llegenda", t):
        return "Narració"
    n = max(1, len(text.split())) / 1000
    narr = len((NARR_CA if ll == "ca" else NARR_ES).findall(text)) / n
    arg = len(ARG.findall(text)) / n
    if narr >= 14 and narr > arg * 2:
        return "Narració"
    if arg >= 3:
        return "Argumentatiu"
    return "Expositiu"


CURSOS = ["1r ESO", "2n ESO", "3r ESO", "4t ESO", "1r Batx.", "2n Batx."]


def sil·labes(w):
    return max(1, len(re.findall(r"[aeiouáéíóúàèòïüy]+", w.lower())))


def llegibilitat(text):
    """Índex de Fernández Huerta (més alt = més fàcil), vàlid per al castellà i orientatiu per al català."""
    paraules = re.findall(r"[A-Za-zÀ-ÿ·']+", text)
    if not paraules:
        return 0
    frases = max(1, len(re.findall(r"[.!?…]+(\s|$)", text)))
    p = 100 * sum(sil·labes(w) for w in paraules) / len(paraules)
    f = 100 * frases / len(paraules)
    return 206.84 - 0.60 * p - 1.02 * f


def dificultat(paraules, text):
    """Mesures de dificultat: paraules per frase, síl·labes per paraula, % de paraules llargues i llargada."""
    w = re.findall(r"[A-Za-zÀ-ÿ·']+", text)
    if not w:
        return [0, 0, 0, 0]
    frases = max(1, len(re.findall(r"[.!?…]+(\s|$)", text)))
    sil = [sil·labes(x) for x in w]
    return [len(w) / frases, sum(sil) / len(w), sum(1 for x in sil if x >= 4) / len(w), paraules]


# proporció de textos per curs (de més fàcil a més difícil): els textos de l'Agenda són d'adults
QUOTES = [0.10, 0.15, 0.20, 0.20, 0.20, 0.15]


def assigna_cursos(index):
    for ll in ("ca", "es"):
        g = [x for x in index if x["l"] == ll]
        if not g:
            continue
        rangs = []
        for k, pes in ((0, 1.0), (1, 1.0), (2, 1.0), (3, 0.5)):
            ordre = sorted(range(len(g)), key=lambda i: g[i]["_d"][k])
            r = [0] * len(g)
            for pos, i in enumerate(ordre):
                r[i] = pos / max(1, len(g) - 1) * pes
            rangs.append(r)
        punt = [sum(r[i] for r in rangs) for i in range(len(g))]
        ordre = sorted(range(len(g)), key=lambda i: punt[i])
        lim, acum = [], 0
        for q in QUOTES:
            acum += q
            lim.append(acum * len(g))
        for pos, i in enumerate(ordre):
            g[i]["n"] = CURSOS[next(c for c, l in enumerate(lim) if pos < l or c == 5)]
    for x in index:
        x.pop("_d", None)


# ---------- extracció ----------
DIES = re.compile(r"\b(lunes|martes|miércoles|jueves|viernes|sábado|domingo|dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge|lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica|segunda-feira|terça-feira|sexta-feira|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b", re.I)
SUBTITOL = re.compile(r"^([IVX]+|\d+)[.)]\s|^(ver|juzgar|actuar|veure|jutjar|actuar)\b", re.I)


def bon_titol(t):
    w = t.split()
    for k in range(len(w) // 2 + 1, 1, -1):  # títol repetit per l'ombra, sencer o tallat
        pri, res = " ".join(w[:k]), " ".join(w[k:])
        if len(res.split()) >= 2 and (pri.lower().startswith(res.lower()) or res.lower().startswith(pri.lower())):
            t = pri if len(pri) >= len(res) else res
            break
    w = t.split()
    for k in range(len(w) // 2, 1, -1):  # «… del Bé Comú (EBC) del Bé Comú (EBC)»
        if [x.lower() for x in w[-k:]] == [x.lower() for x in w[-2 * k:-k]]:
            t = " ".join(w[:-k]); break
    lletres = [c for c in t if c.isalpha()]
    raros = re.search(r"[a-zà-ÿ][A-ZÀ-Þ]", t)
    if lletres and (sum(c.isupper() for c in lletres) / len(lletres) > 0.6 or raros):
        t = t.lower()
        t = t[0].upper() + t[1:]
    return t.strip(" .·-")
TITOLS_FORA = re.compile(r"^(índice|índex|indice|sumario|sumari|calendari|calendario|agenda|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|gener|febrer|març|maig|juny|juliol|setembre|novembre|desembre)\b", re.I)


CJK_ASCII = re.compile(r"[ -鿿]")
LLIGADURA = re.compile(r"(?<=[a-zà-ÿ])(fl|fi|ff|ffi|ffl) (?=[a-zà-ÿ])")
PARTICIO = re.compile(r"([a-zà-ÿ])[-‐‑¬] (?!(i|y|o|e|u|ni)\b)([a-zà-ÿ])")
CONT = re.compile(r"\(?\s*(viene de la p[aá]g(?:ina)?\.?|ve de la p[aà]g(?:ina)?\.?|v[ée] de la p[aà]g\.?)\s*(\d+)\s*\)?", re.I)
SEGUEIX = re.compile(r"\(?\s*(sigue en la p[aá]g(?:ina)?\.?|contin[uú]a en la p[aá]g(?:ina)?\.?|contin[uú]a a la p[aà]g(?:ina)?\.?|segueix a la p[aà]g(?:ina)?\.?)\s*(\d+)\s*\)?\.?", re.I)


def arregla_glif(c):
    cp = ord(c)
    # fonts amb el ToUnicode trencat: «琀» (U+7400) = «t», «椀» (U+6900) = «i»
    if 0x2000 <= cp <= 0x9FFF and cp & 0xFF == 0 and 0x20 <= cp >> 8 <= 0x7E:
        return chr(cp >> 8)
    return c


def neteja(t):
    t = unicodedata.normalize("NFC", t).replace("­", "").replace("ﬁ", "fi").replace("ﬂ", "fl").replace("ﬀ", "ff")
    t = CJK_ASCII.sub(lambda m: arregla_glif(m.group()), t)
    t = re.sub(r"\s+", " ", t).strip()
    t = LLIGADURA.sub(r"\1", t)
    t = PARTICIO.sub(r"\1\3", t)
    return t


def uneix_linies(linies):
    txt = ""
    for t in linies:
        t = t.rstrip()
        if re.search(r"[a-zà-ÿ][-‐‑¬]$", txt) and re.match(r"\s*[a-zà-ÿ]", t):
            txt = txt[:-1] + t.lstrip()
        else:
            txt = (txt + " " + t.strip()) if txt else t.strip()
    return neteja(txt)


def llegeix(doc):
    """Línies útils de cada pàgina: (pàgina, text, mida, font, negreta, y)."""
    pagines, mides, lithos = [], collections.Counter(), 0
    for np_, pag in enumerate(doc):
        if len(DIES.findall(pag.get_text())) >= 3:  # pàgina de calendari
            pagines.append((np_, []))
            continue
        blocs = []
        for b in pag.get_text("dict")["blocks"]:
            if b.get("type") != 0:
                continue
            ant = None
            linies = []
            for l in b["lines"]:
                sp = [s for s in l["spans"] if s["text"].strip()]
                if not sp:
                    continue
                t = "".join(s["text"] for s in l["spans"])
                clau = (t.strip(), round(l["bbox"][1]))
                if clau == ant:  # línia duplicada (ombra del títol)
                    continue
                ant = clau
                s0 = max(sp, key=lambda s: len(s["text"]))
                mida = max(s["size"] for s in sp)
                font = s0["font"]
                if "Lithos-Black" in font or "LithosPro-Black" in font:
                    lithos += 1
                if "Revue" not in font and not re.search(r"Dingbat", font):
                    for s in sp:
                        mides[round(s["size"], 1)] += len(s["text"])
                linies.append({"t": t, "m": mida, "f": font, "b": bool(s0["flags"] & 16) or "Bold" in font, "y": l["bbox"][1]})
            if linies:
                blocs.append(linies)
        pagines.append((np_, blocs))
    cos = mides.most_common(1)[0][0] if mides else 10
    return pagines, cos, lithos


def articles_pdf(cami):
    doc = fitz.open(cami)
    pagines, cos, lithos = llegeix(doc)
    mode_font = lithos >= 10
    arts = []
    act = None
    estat = "res"  # res | titol | autor | cos | tancat

    def nou(titol, np_):
        nonlocal act, estat
        act = {"t": titol, "pg": np_ + 1, "par": [], "au": "", "tancat": False, "segueix": None}
        arts.append(act)
        estat = "titol"

    def afegeix(art, txt):
        m = SEGUEIX.search(txt)
        if m:
            art["segueix"] = int(m.group(2))
            txt = SEGUEIX.sub("", txt).strip()
        if txt and not re.fullmatch(r"[\d\W]{0,4}", txt):
            art["par"].append(txt)

    capllet = ""
    blocs_plans = []
    for np_, blocs in pagines:
        for linies in blocs:
            # parteix el bloc on hi ha la marca de final (quadradet tipogràfic)
            tros = []
            for l in linies:
                if re.search(r"Dingbat", l["f"]) and len(l["t"].strip()) <= 2:
                    if tros:
                        blocs_plans.append((np_, tros))
                    blocs_plans.append((np_, [l]))
                    tros = []
                else:
                    tros.append(l)
            if tros:
                blocs_plans.append((np_, tros))

    for np_, linies in blocs_plans:
        if True:
            text_bloc = neteja(" ".join(l["t"] for l in linies))
            if not text_bloc:
                continue
            fonts = {l["f"] for l in linies}
            if all("Revue" in f for f in fonts):  # números de pàgina
                continue
            if re.fullmatch(r"[A-ZÀ-ÚÑÇ]", text_bloc) and max(l["m"] for l in linies) >= cos * 1.8:
                capllet = text_bloc  # caplletra
                continue
            if any(re.search(r"Dingbat", f) for f in fonts) and len(text_bloc) <= 2:
                if act:
                    act["tancat"] = True
                estat = "tancat"
                continue
            if mode_font:
                es_titol = all("Lithos-Black" in l["f"] or "LithosPro-Black" in l["f"] for l in linies) and max(l["m"] for l in linies) >= cos
                es_subtitol = all("Lithos" in l["f"] and "Bold" not in l["f"] and "Black" not in l["f"] for l in linies)
                es_autor = all("Lithos" in l["f"] and "Bold" in l["f"] for l in linies)
            else:
                gran = all(l["m"] >= cos * 1.35 for l in linies)
                es_titol = gran and 4 <= len(text_bloc) <= 160 and not re.fullmatch(r"[\d\W]+", text_bloc)
                es_subtitol = es_autor = False
            italica = all("Italic" in l["f"] or l["f"].endswith("I") or "Oblique" in l["f"] for l in linies)

            if es_titol and len(text_bloc) <= 200:
                if act and estat == "titol" and act["pg"] == np_ + 1:
                    act["t"] = neteja(act["t"] + " " + text_bloc)
                elif act and act["par"] and not mode_font and SUBTITOL.match(text_bloc):
                    act["par"].append(text_bloc)
                else:
                    nou(text_bloc, np_)
                continue
            if act and estat == "titol" and es_subtitol and len(text_bloc) <= 160:
                act["t"] = neteja(act["t"] + ": " + text_bloc)
                continue
            if act and estat in ("titol", "autor") and es_autor and len(text_bloc) <= 120:
                act["au"] = neteja((act["au"] + ", " if act["au"] else "") + text_bloc)
                estat = "autor"
                continue
            if act and estat == "autor" and italica and len(text_bloc) <= 80 and not act["par"]:
                act["au"] = neteja(act["au"] + " (" + text_bloc + ")")
                continue
            if not mode_font and act and estat == "titol" and not act["au"] and not act["par"] and len(text_bloc.split()) <= 12 \
                    and not text_bloc.endswith((".", ":", ";")) and not re.match(r"(tabla|índice|índex|nombre|nom):?", text_bloc, re.I):
                act["au"] = text_bloc
                estat = "autor"
                continue
            if max(l["m"] for l in linies) < cos * 0.8:  # notes al peu, peus de foto
                continue
            # continuació d'un article d'una altra pàgina
            m = CONT.search(text_bloc)
            if m:
                pag_orig = int(m.group(2))
                dest = next((a for a in reversed(arts) if not a["tancat"] and a["segueix"] == np_ + 1), None) \
                    or next((a for a in reversed(arts) if not a["tancat"] and a["pg"] <= pag_orig + 2 and a["pg"] >= pag_orig - 4), None)
                if dest:
                    act, estat = dest, "cos"
                    resta = CONT.sub("", text_bloc).strip()
                    if resta:
                        afegeix(act, uneix_linies([l["t"] for l in linies]).replace(m.group(0), "").strip())
                continue
            txt = uneix_linies([l["t"] for l in linies])
            if capllet:
                if re.match(r"[a-zà-ÿ]", txt):
                    txt = capllet + txt
                capllet = ""
            if mode_font and (act is None or estat == "tancat") and re.match(r"[A-ZÀ-ÚÑÇ¿¡«“\"]", txt) and len(txt.split()) >= 25:
                # article amb el títol en imatge: el títol serà l'inici del text
                nou("", np_)
                act["sense_titol"] = True
            if act is None or estat == "tancat":
                continue
            afegeix(act, txt)
            estat = "cos"
    # uneix paràgrafs partits pel salt de pàgina o de columna (acaben sense punt i el següent comença en minúscula)
    for a in arts:
        net = []
        for ptxt in a["par"]:
            if net and not re.search(r"[.!?:;»”\")…]$", net[-1]) and re.match(r"[a-zà-ÿ]", ptxt):
                net[-1] = (net[-1][:-1] + ptxt) if re.search(r"[a-zà-ÿ]-$", net[-1]) else (net[-1] + " " + ptxt)
            else:
                net.append(ptxt)
        a["par"] = net
        while a["par"] and re.match(r"(\(?\s*)?(texto|text|vea|vegeu|véase|ver|més|más|original|versión|versió)\b.{0,160}(https?://|latinoamericana\.org|\.org|\.com)", a["par"][-1], re.I):
            a["par"].pop()  # notes finals amb enllaços
        # signatura al final: «Nom Cognom, Ciutat, País»
        if a["par"] and not a["au"]:
            fi = a["par"][-1]
            if len(fi.split()) <= 12 and not re.search(r"[.!?;:»”]$", fi) and re.match(r"[A-ZÀ-ÚÑ][\w'’.-]+ [A-ZÀ-ÚÑ]", fi):
                a["au"] = fi
                a["par"].pop()
        if a.get("sense_titol") and a["par"]:
            frase = re.split(r"(?<=[.!?…])\s", a["par"][0])[0]
            w = frase.split()
            a["t"] = frase.rstrip(".") if len(w) <= 12 else " ".join(w[:9]) + "…"
    return [a for a in arts if a["par"]]


def main():
    os.makedirs(CAU, exist_ok=True)
    os.makedirs(f"{SORTIDA}/textos", exist_ok=True)
    pdfs = cerca_pdfs()
    print(f"PDF trobats: {len(pdfs)}")
    fonts, index, textos = [], [], collections.defaultdict(dict)
    vistos = set()
    # primer les edicions completes, després les «només textos» (per no duplicar)
    ordre = sorted(pdfs.items(), key=lambda kv: ("solotext" in kv[0].lower(), kv[0]))
    for url, etiqueta in ordre:
        any_ = any_de(url, etiqueta)
        nom = hashlib.md5(url.encode()).hexdigest() + ".pdf"
        cami = f"{CAU}/{nom}"
        if not os.path.exists(cami):
            dades = baixa(url, binari=True)
            if not dades or not dades.startswith(b"%PDF"):
                fonts.append({"url": url, "any": any_, "estat": "no baixat"})
                continue
            open(cami, "wb").write(dades)
        try:
            arts = articles_pdf(cami)
        except Exception as e:
            fonts.append({"url": url, "any": any_, "estat": f"error: {e}"[:200]})
            continue
        n = 0
        for a in arts:
            text = " ".join(a["par"])
            par = len(text.split())
            a["t"] = bon_titol(a["t"])
            if not re.search(r"[A-Za-zÀ-ÿ]{2}", a["au"]):
                a["au"] = ""
            if par < 200 or par > 7000 or TITOLS_FORA.match(a["t"]) or DIES.search(a["t"]) or a["t"].count(":") >= 3:
                continue
            ll = llengua(text)
            if ll not in ("ca", "es"):
                continue
            complet = bool(re.match(r"[«“\"¿¡(\[—–A-ZÀ-ÚÑÇ0-9]", a["par"][0])) and bool(re.search(r"[.!?»”\")…]$", a["par"][-1]))
            if not complet:  # comença o acaba a mitja frase: fora
                continue
            clau = (any_, ll, re.sub(r"\W+", "", a["t"].lower())[:60])
            if clau in vistos:
                continue
            vistos.add(clau)
            id_ = f"{any_}-{ll}-{hashlib.md5((url + a['t']).encode()).hexdigest()[:6]}"
            index.append({
                "id": id_, "a": any_, "l": ll, "t": a["t"], "au": a["au"],
                "tg": temes(text), "p": par, "n": "", "ti": tipus(a["t"], a["par"], text, ll),
                "_d": dificultat(par, text),
                "ok": int(bool(re.match(r"[«“\"¿¡(\[—–A-ZÀ-ÚÑÇ0-9]", a["par"][0])) and bool(re.search(r"[.!?»”\")…]$", a["par"][-1]))),
                "pg": a["pg"], "f": url, "r": text[:240],
            })
            textos[f"{any_}-{ll}"][id_] = a["par"]
            n += 1
        fonts.append({"url": url, "any": any_, "estat": "ok", "textos": n})
        print(f"  {any_} {url.rsplit('/', 1)[-1]}: {n} textos")

    # duplicats: el mateix text en diverses fonts (edició, llibre d'articles, antologia, recull)
    grups = collections.defaultdict(list)
    for x in index:
        cap = re.sub(r"\W", "", " ".join(textos[f"{x['a']}-{x['l']}"][x["id"]])[:400].lower())
        grups[(x["l"], cap)].append(x)
    fora = set()
    for g in grups.values():
        if len(g) < 2:
            continue
        if len({x["a"] for x in g if x["a"]}) >= 3:  # text fix que es repeteix cada any (fitxes, presentacions)
            fora.update(x["id"] for x in g)
            continue
        g.sort(key=lambda x: (x["a"] == 0, -x["a"]))
        fora.update(x["id"] for x in g[1:])
    index = [x for x in index if x["id"] not in fora]
    textos = {k: {i: v for i, v in d.items() if i not in fora} for k, d in textos.items()}
    assigna_cursos(index)
    index.sort(key=lambda x: (x["a"] == 0, -x["a"], x["l"], x["f"], x["pg"]))
    for f in os.listdir(f"{SORTIDA}/textos"):
        os.remove(f"{SORTIDA}/textos/{f}")
    for k, v in textos.items():
        if not v:
            continue
        with open(f"{SORTIDA}/textos/{k}.json", "w", encoding="utf-8") as fh:
            json.dump(v, fh, ensure_ascii=False, separators=(",", ":"))
    with open(f"{SORTIDA}/index.json", "w", encoding="utf-8") as fh:
        json.dump(index, fh, ensure_ascii=False, separators=(",", ":"))
    avui = datetime.date.today().strftime("%d.%m.%Y")
    resum = collections.Counter((x["a"], x["l"]) for x in index)
    with open(f"{SORTIDA}/estat.json", "w", encoding="utf-8") as fh:
        json.dump({"actualitzat": avui, "total": len(index),
                   "per_any": {f"{a}-{l}": n for (a, l), n in sorted(resum.items())},
                   "fonts": fonts}, fh, ensure_ascii=False, indent=1)
    print(f"Total: {len(index)} textos")
    for (a, l), n in sorted(resum.items()):
        print(f"  {a} {l}: {n}")


if __name__ == "__main__":
    main()
