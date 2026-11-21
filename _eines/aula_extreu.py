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


def nivell(paraules, text):
    frases = [f for f in re.split(r"[.!?…]+\s", text) if f.strip()]
    mfr = paraules / max(1, len(frases))
    mpar = sum(len(w) for w in text.split()) / max(1, paraules)
    punts = (mfr > 24) + (mfr > 32) + (mpar > 5.2) + (paraules > 1500)
    return ["Assequible", "Mitjà", "Exigent", "Exigent", "Exigent"][punts]


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
    lletres = [c for c in t if c.isalpha()]
    raros = re.search(r"[a-zà-ÿ][A-ZÀ-Þ]", t)
    if lletres and (sum(c.isupper() for c in lletres) / len(lletres) > 0.6 or raros):
        t = t.lower()
        t = t[0].upper() + t[1:]
    return t.strip(" .·-")
TITOLS_FORA = re.compile(r"^(índice|índex|indice|sumario|sumari|calendari|calendario|agenda|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre|gener|febrer|març|maig|juny|juliol|setembre|novembre|desembre)\b", re.I)


def neteja(t):
    t = unicodedata.normalize("NFC", t).replace("­", "").replace("ﬁ", "fi").replace("ﬂ", "fl")
    return re.sub(r"\s+", " ", t).strip()


def articles_pdf(cami):
    doc = fitz.open(cami)
    pagines, mides = [], collections.Counter()
    for np_, pag in enumerate(doc):
        d = pag.get_text("dict")
        text_pag = pag.get_text()
        if len(DIES.findall(text_pag)) >= 3:  # pàgina de calendari
            pagines.append((np_, []))
            continue
        blocs = []
        for b in d["blocks"]:
            if b.get("type") != 0:
                continue
            linies = []
            for l in b["lines"]:
                sp = [s for s in l["spans"] if s["text"].strip()]
                if not sp:
                    continue
                t = "".join(s["text"] for s in l["spans"])
                mida = max(s["size"] for s in sp)
                for s in sp:
                    mides[round(s["size"], 1)] += len(s["text"])
                linies.append((t, mida))
            if linies:
                blocs.append(linies)
        pagines.append((np_, blocs))
    if not mides:
        return []
    cos = mides.most_common(1)[0][0]
    arts, act = [], None

    def tanca():
        if act and act["par"]:
            arts.append(act)

    for np_, blocs in pagines:
        if not blocs:
            continue
        for linies in blocs:
            gran = [t for t, m in linies if m >= cos * 1.35]
            text_bloc = neteja(" ".join(t for t, _ in linies))
            if gran and len(gran) == len(linies) and act and act["par"] and SUBTITOL.match(text_bloc):
                act["par"].append(text_bloc)  # subapartat (I. Veure, 2. …) dins del mateix article
                continue
            if gran and len(gran) == len(linies) and 4 <= len(text_bloc) <= 160 and not re.fullmatch(r"[\d\W]+", text_bloc):
                if act and not act["par"]:
                    act["t"] = neteja(act["t"] + " " + text_bloc)  # títol en diverses línies
                    continue
                tanca()
                act = {"t": text_bloc, "pg": np_ + 1, "par": [], "au": ""}
                continue
            if act is None:
                continue
            if max(m for _, m in linies) < cos * 0.8:  # notes al peu, capçaleres petites
                continue
            # desguionat de línies
            txt = ""
            for t, _ in linies:
                t = t.rstrip()
                if txt.endswith("-") and re.search(r"[a-zà-ÿ]-$", txt):
                    txt = txt[:-1] + t.lstrip()
                else:
                    txt = (txt + " " + t.strip()) if txt else t.strip()
            txt = neteja(txt)
            if not txt or re.fullmatch(r"\d{1,3}", txt):
                continue
            if not act["par"] and not act["au"] and len(txt.split()) <= 12 and not txt.endswith((".", ":", ";")) and not re.match(r"(tabla|índice|índex|nombre|nom):?", txt, re.I):
                act["au"] = txt
                continue
            act["par"].append(txt)
    tanca()
    return arts


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
            if par < 200 or par > 7000 or TITOLS_FORA.match(a["t"]) or DIES.search(a["t"]) or a["t"].count(":") >= 3:
                continue
            ll = llengua(text)
            if ll not in ("ca", "es"):
                continue
            clau = (any_, ll, re.sub(r"\W+", "", a["t"].lower())[:60])
            if clau in vistos:
                continue
            vistos.add(clau)
            id_ = f"{any_}-{ll}-{hashlib.md5((url + a['t']).encode()).hexdigest()[:6]}"
            index.append({
                "id": id_, "a": any_, "l": ll, "t": a["t"], "au": a["au"],
                "tg": temes(text), "p": par, "n": nivell(par, text),
                "pg": a["pg"], "f": url, "r": text[:240],
            })
            textos[f"{any_}-{ll}"][id_] = a["par"]
            n += 1
        fonts.append({"url": url, "any": any_, "estat": "ok", "textos": n})
        print(f"  {any_} {url.rsplit('/', 1)[-1]}: {n} textos")

    index.sort(key=lambda x: (x["a"] == 0, -x["a"], x["l"], x["f"], x["pg"]))
    for k, v in textos.items():
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
