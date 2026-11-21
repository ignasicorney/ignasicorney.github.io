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

import html as htmlmod
from concurrent.futures import ThreadPoolExecutor

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


# ---------- arxiu en línia de l'Agenda (un article per pàgina) ----------
ARXIU = "https://servicioskoinonia.org/agenda/archivo/"
ARXIU_LL = {"ca": "catalan/", "es": ""}


def descodifica(b):
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        out = []
        for l in b.split(b"\n"):
            try:
                out.append(l.decode("utf-8"))
            except UnicodeDecodeError:
                out.append(l.decode("cp1252", "replace"))
        return "\n".join(out)


def baixa_bytes(url):
    for i in range(4):
        try:
            r = ses.get(url, timeout=60)
            if r.status_code == 200:
                return r.content
            if r.status_code == 404:
                return None
        except Exception as e:
            print(f"  error {url}: {e}")
        time.sleep(3 * (i + 1))
    return None


def llista_arxiu(pre):
    b = baixa_bytes(ARXIU + pre + "listanyos.php?select=1&opcion=s&Submit=Consultar")
    if not b:
        return {}
    sp = BeautifulSoup(descodifica(b), "html.parser")
    codis = {}
    for a in sp.find_all("a", href=True):
        m = re.search(r"obra\.php\?ncodigo=(\d+)", a["href"])
        if m:
            codis[int(m.group(1))] = neteja(a.get_text(" "))
    return codis


def temes_arxiu(pre):
    """Tema oficial de l'arxiu per a cada article."""
    b = baixa_bytes(ARXIU + pre + "mtemas.php")
    if not b:
        return {}
    sp = BeautifulSoup(descodifica(b), "html.parser")
    sel = sp.find("select", attrs={"name": "tematica"})
    temes = [o.get("value") for o in sel.find_all("option")] if sel else []
    per_codi = collections.defaultdict(list)

    def un(t):
        b2 = baixa_bytes(ARXIU + pre + "listtemas.php?tematica=" + requests.utils.quote(t.encode("cp1252", "ignore")))
        if not b2:
            return t, []
        return t, [int(x) for x in re.findall(rb"obra\.php\?ncodigo=(\d+)", b2)]

    with ThreadPoolExecutor(4) as ex:
        for t, codis in ex.map(un, temes):
            for c in codis:
                if neteja(t) not in per_codi[c]:
                    per_codi[c].append(neteja(t))
    return per_codi


def article_arxiu(pre, codi):
    url = f"{ARXIU}{pre}obra.php?ncodigo={codi}"
    b = baixa_bytes(url)
    if not b:
        return None
    h = descodifica(b)
    sp = BeautifulSoup(h, "html.parser")
    pla = htmlmod.unescape(sp.get_text(" "))
    au = re.search(r"AUTOR:\s*(.+?)\s{2,}", pla)
    an = re.search(r"AÑO:\s*(\d{4})", pla)
    h2 = sp.find("h2")
    if not h2:
        return None
    titol = neteja(h2.get_text(" — ")).strip(" —")
    td = h2.find_parent("td") or sp
    par = []
    for p in td.find_all("p"):
        t = neteja(p.get_text(" "))
        if t and not re.fullmatch(r"[\W\d]{0,3}", t):
            par.append(t)
    if not par:  # text sense <p>: talla pels <br> dobles
        t = td.get_text("\n")
        t = t.split(h2.get_text(), 1)[-1]
        par = [neteja(x) for x in re.split(r"\n\s*\n", t) if neteja(x)]
    while par and re.match(r"(\(?\s*)?(texto|text|vea|vegeu|véase|ver|més|más|original|versión|versió|descargar)\b.{0,160}(https?://|\.org|\.com|pdf|rtf)", par[-1], re.I):
        par.pop()
    autor = neteja(au.group(1)) if au else ""
    if autor.lower() in ("anónimo", "anònim", "anonimo"):
        autor = "Anònim"
    return {"codi": codi, "t": titol, "au": autor, "a": int(an.group(1)) if an else 0, "par": par, "url": url}


def titol_net(t, text):
    """Títols en majúscules → majúscula inicial, i els noms propis com surten al text."""
    lletres = [c for c in t if c.isalpha()]
    if not lletres or sum(c.isupper() for c in lletres) / len(lletres) < 0.7:
        return t
    propis = collections.Counter()
    for m in re.finditer(r"(?<![.!?¿¡«\"“]\s)(?<!^)\b([A-ZÀ-ÚÑÇ][a-zà-ÿ·’'-]+)", text):
        propis[m.group(1).lower()] += 1
    minus = collections.Counter(w.lower() for w in re.findall(r"\b[a-zà-ÿ·’'-]+\b", text))
    def paraula(w, primera):
        base = w.lower()
        nucli = re.sub(r"^(l’|l'|d’|d'|s’|s')", "", base)
        pref = base[:len(base) - len(nucli)]
        if propis[nucli] >= 2 and propis[nucli] > minus[nucli]:
            return pref + nucli[:1].upper() + nucli[1:]
        if primera:
            return base[:1].upper() + base[1:]
        return base
    parts = re.split(r"(\s+|—)", t.strip())
    out, primera = [], True
    for w in parts:
        if not w.strip() or w == "—":
            out.append(w); primera = primera or w == "—"; continue
        nova = paraula(w, primera)
        if primera:
            nova = nova[:1].upper() + nova[1:]
        out.append(nova); primera = bool(re.search(r"[.:?!]$", w))
    return "".join(out)


def autor_net(au):
    """«Vigil, José María» → «José María Vigil» (també amb diversos autors separats per «;» o « y »)."""
    def un(x):
        x = x.strip()
        m = re.fullmatch(r"([^,]+),\s*([^,]+)", x)
        return f"{m.group(2).strip()} {m.group(1).strip()}" if m and len(x.split()) <= 6 else x
    return "; ".join(un(x) for x in re.split(r";", au) if x.strip()).strip(" ,;")


FINAL_OK = re.compile(r"[.!?»”\")…]$")


def poleix(par, titol):
    """Treu del principi el títol repetit i del final els llocs, signatures, enllaços i notes."""
    par = [x for x in par if x.strip()]
    clau = re.sub(r"\W", "", titol.lower())
    while par and re.sub(r"\W", "", par[0].lower()) == clau:
        par.pop(0)
    while par:
        fi = par[-1]
        curt = len(fi.split()) <= 14 and not FINAL_OK.search(fi)
        enllac = re.search(r"https?://|www\.|\.(org|com|net|br|es|cat)\b", fi) and len(fi.split()) <= 25
        nota = re.match(r"(\[?\d{1,2}[\].)]\s|\*|notas?\b|notes?\b|bibliograf)", fi, re.I) and len(par) > 3
        if curt or enllac or nota:
            par.pop()
        else:
            break
    return par


def complet(par):
    return bool(par) and bool(re.match(r"[«“\"'‘¿¡(\[—–\-A-ZÀ-ÚÑÇ0-9…]", par[0])) and bool(FINAL_OK.search(par[-1]))


def recull_arxiu(anteriors):
    """Articles de l'arxiu; els que ja teníem de l'any passat no es tornen a baixar."""
    res = []
    for ll, pre in ARXIU_LL.items():
        codis = llista_arxiu(pre)
        print(f"Arxiu {ll}: {len(codis)} articles a la llista")
        if not codis:
            continue
        temes_of = temes_arxiu(pre)
        nous = [c for c in codis if (ll, c) not in anteriors]
        print(f"  ja els teníem: {len(codis) - len(nous)}; a baixar: {len(nous)}")
        with ThreadPoolExecutor(6) as ex:
            for art in ex.map(lambda c: article_arxiu(pre, c), nous):
                if art:
                    art["l_arxiu"] = ll
                    res.append(art)
        for c in codis:
            if (ll, c) in anteriors:
                art = dict(anteriors[(ll, c)])
                res.append(art)
        for art in res:
            if art.get("l_arxiu") == ll:
                art["to"] = temes_of.get(art["codi"], [])
    return res


# ---------- web nova: archivosagenda.org (arxius digitalitzats, fins a l'any en curs) ----------
WEB = "https://www.archivosagenda.org/"
WEB_LLISTES = {"es": WEB + "es/articulos-espanol", "ca": WEB + "ca/articicles-catala"}


def files_llista_web(url):
    b = baixa_bytes(url)
    if not b:
        return []
    sp = BeautifulSoup(descodifica(b), "html.parser")
    res = []
    for tr in sp.find_all("tr"):
        tds = tr.find_all("td")
        if len(tds) < 2:
            continue
        m = re.search(r"(19|20)\d\d", tds[0].get_text())
        enll = None
        for td in tds[1:]:
            a = td.find("a", href=True)
            if a and len(a.get_text(strip=True)) > 3:
                enll = a
                break
        if not m or not enll:
            continue
        au = neteja(tds[2].get_text(" ")) if len(tds) > 2 else ""
        tema = neteja(tds[3].get_text(" ")) if len(tds) > 3 else ""
        res.append({"url": urljoin(url, enll["href"]), "a": int(m.group(0)), "t": neteja(enll.get_text(" ")),
                    "au": au, "to": [tema] if tema else []})
    return res


def llista_web(ll):
    base = WEB_LLISTES[ll]
    files = files_llista_web(base)
    if len(files) < 200:  # si la taula es carrega per parts, any per any
        vistos = {f["url"] for f in files}
        for any_ in range(1992, datetime.date.today().year + 2):
            for f in files_llista_web(f"{base}?year={any_}"):
                if f["url"] not in vistos:
                    vistos.add(f["url"]); files.append(f)
    return list({f["url"]: f for f in files}.values())


def article_web(fila):
    b = baixa_bytes(fila["url"])
    if not b:
        return None
    sp = BeautifulSoup(descodifica(b), "html.parser")
    for x in sp.find_all(["script", "style", "nav", "header", "footer", "form"]):
        x.decompose()
    h1s = sp.find_all("h1")
    if not h1s:
        return None
    clau_t = re.sub(r"\W", "", fila["t"].lower())[:30]
    h1 = next((h for h in h1s if re.sub(r"\W", "", h.get_text().lower())[:30] == clau_t), h1s[-1])
    cont = h1
    while cont.parent is not None and len(cont.find_all("p")) < 3:
        cont = cont.parent
    par, inici = [], True
    au_net = re.sub(r"\W", "", fila["au"].lower())
    for p in cont.find_all(["p", "h2", "h3", "h4", "blockquote", "li"]):
        if p.find_parent(["p", "blockquote", "li"]) is not None and p.name != "blockquote":
            continue
        if h1 in p.parents:
            continue
        trossos = [neteja(x) for x in re.split(r"(?<=[.!?»”:])\s*\n+", p.get_text("\n"))] if p.find("br") else [neteja(p.get_text(" "))]
        for t in trossos:
          t = neteja(t.replace("\n", " "))
          if not t or re.fullmatch(r"[\W\d]{0,3}", t):
            continue
          # capçalera de l'article: autor i lloc, abans del primer paràgraf llarg
          if inici and (re.sub(r"\W", "", t.lower()) == au_net or (len(t.split()) <= 8 and not re.search(r"[.!?»]$", t))):
            continue
          inici = False
          if not par or par[-1] != t:
            par.append(t)
    while par and re.match(r"(\(?\s*)?(texto|text|vea|vegeu|véase|ver|més|más|original|versión|versió|descargar|descarregar)\b.{0,160}(https?://|\.org|\.com|pdf)", par[-1], re.I):
        par.pop()
    if not par:
        return None
    return {"codi": fila["url"], "t": fila["t"], "au": fila["au"], "a": fila["a"], "par": par, "url": fila["url"], "to": fila["to"]}


def recull_web(anteriors):
    res = []
    for ll in WEB_LLISTES:
        files = llista_web(ll)
        print(f"Web nova {ll}: {len(files)} articles a la llista")
        nous = [f for f in files if ("web", f["url"]) not in anteriors]
        print(f"  ja els teníem: {len(files) - len(nous)}; a baixar: {len(nous)}")
        with ThreadPoolExecutor(6) as ex:
            for art in ex.map(article_web, nous):
                if art:
                    art["l_arxiu"] = ll
                    res.append(art)
        for f in files:
            if ("web", f["url"]) in anteriors:
                res.append(dict(anteriors[("web", f["url"])], to=f["to"]))
        mostra = next((a for a in res if a["l_arxiu"] == ll), None)
        if mostra:
            print(f"  mostra: {mostra['a']} «{mostra['t'][:60]}» — {mostra['au'][:40]} — {len(mostra['par'])} paràgrafs — «{mostra['par'][0][:80]}» … «{mostra['par'][-1][-60:]}»")
    return res


def carrega_anteriors():
    """Articles de l'arxiu que ja hi ha a tauler/aula (per no tornar-los a baixar)."""
    try:
        idx = json.load(open(f"{SORTIDA}/index.json", encoding="utf-8"))
    except Exception:
        return {}
    textos = {}
    for f in os.listdir(f"{SORTIDA}/textos") if os.path.isdir(f"{SORTIDA}/textos") else []:
        try:
            textos.update(json.load(open(f"{SORTIDA}/textos/{f}", encoding="utf-8")))
        except Exception:
            pass
    ant = {}
    for x in idx:
        if "archivosagenda.org" in x.get("f", "") and x["id"] in textos:
            ant[("web", x["f"])] = {"codi": x["f"], "t": x["t"], "au": x["au"], "a": x["a"], "par": textos[x["id"]],
                                    "url": x["f"], "l_arxiu": x["l"], "to": x.get("to", [])}
            continue
        m = re.search(r"ncodigo=(\d+)", x.get("f", ""))
        if m and x["id"] in textos:
            ll = "ca" if "/catalan/" in x["f"] else "es"
            ant[(ll, int(m.group(1)))] = {"codi": int(m.group(1)), "t": x["t"], "au": x["au"], "a": x["a"],
                                          "par": textos[x["id"]], "url": x["f"], "l_arxiu": ll}
    return ant


def main():
    os.makedirs(CAU, exist_ok=True)
    os.makedirs(f"{SORTIDA}/textos", exist_ok=True)
    anteriors = carrega_anteriors()
    web = recull_web(anteriors)
    arxiu = web + recull_arxiu(anteriors)  # primer la web nova; de l'arxiu antic, només el que no hi sigui
    pdfs = cerca_pdfs()
    print(f"PDF trobats: {len(pdfs)}")
    fonts, index, textos = [], [], collections.defaultdict(dict)
    vistos = set()
    max_arxiu = collections.Counter()
    cobert = collections.Counter()
    for art in arxiu:
        art["par"] = poleix(art["par"], art["t"])
        if not complet(art["par"]):
            continue
        text = " ".join(art["par"])
        par = len(text.split())
        if par < 80 or par > 9000:
            continue
        ll = llengua(text) or art["l_arxiu"]
        if ll not in ("ca", "es"):
            continue
        any_ = art["a"]
        if any_:
            max_arxiu[ll] = max(max_arxiu[ll], any_)

        if isinstance(art["codi"], str):
            id_ = f"{any_}-{ll}-w{hashlib.md5(art['codi'].encode()).hexdigest()[:8]}"
        else:
            id_ = f"{any_}-{ll}-k{art['codi']}"
        clau_t = (any_, ll, re.sub(r"\W+", "", art["t"].lower())[:60])
        if clau_t in vistos:
            continue
        cobert[(any_, ll)] += 1
        vistos.add(clau_t)
        index.append({
            "id": id_, "a": any_, "l": ll, "t": titol_net(art["t"], text), "au": autor_net(art["au"]),
            "tg": temes(text), "to": art.get("to", []), "p": par, "n": "", "ti": tipus(art["t"], art["par"], text, ll),
            "_d": dificultat(par, text), "ok": 1, "pg": 0, "f": art["url"], "r": text[:240],
        })
        textos[f"{any_}-{ll}"][id_] = art["par"]
    print(f"Arxiu: {len(index)} textos; darrer any a l'arxiu: {dict(max_arxiu)}")
    fonts.append({"url": ARXIU, "estat": "ok", "textos": len(index)})
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
            if any_ and cobert[(any_, "ca")] + cobert[(any_, "es")] >= 20:
                break  # aquest any ja és a les webs de l'Agenda, article per article
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
