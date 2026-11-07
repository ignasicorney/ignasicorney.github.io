// Editor del web d'Ignasi Corney Oller.
// Llegeix i desa els fitxers del repositori ignasicorney/ignasicorney.github.io
// directament amb l'API de GitHub, amb la clau (token) de l'usuari.
// Les pàgines estan fetes de blocs: <!-- bloc:tipus {json} --> … <!-- /bloc -->
// L'HTML de cada bloc el genera aquest fitxer (i _eines/blocs.py, que ha de fer el mateix).
"use strict";

const REPO = "ignasicorney/ignasicorney.github.io";
const BRANCA = "main";
const API = "https://api.github.com/repos/" + REPO;
const CLAU_DESADA = "editorWebClau";
const PAGINES = [
  ["index.html", "Inici", "/"],
  ["salutacio/index.html", "Salutació", "/salutacio/"],
  ["publicacions/index.html", "Publicacions", "/publicacions/"],
  ["llibres/index.html", "Llibres", "/llibres/"],
  ["latdg/index.html", "LaTdG", "/latdg/"],
  ["videos/index.html", "Vídeos", "/videos/"],
];
const GALERIES = "_data/galeries.yml";
const TIPUS_CARRUSSEL = { diapos: "Diapositives (una imatge amb peu)", portada: "Portada (tota l'amplada, amb punts)", tira: "Tira (diverses imatges de costat)" };
const POSICIONS = { centre: "Centrada", ample: "A tota l'amplada", esquerra: "A l'esquerra, amb el text al voltant", dreta: "A la dreta, amb el text al voltant" };

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#x27;" }[c]));
const llegeix = k => { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
const escriu = (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} };
const nouId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, "0")).join("");
const dos = n => String(n).padStart(2, "0");
const avui = () => { const d = new Date(); return d.getFullYear() + "-" + dos(d.getMonth() + 1) + "-" + dos(d.getDate()); };

let CLAU = "";
let ACTUAL = null;       // { cami, tipus: "pagina"|"entrada", sha, fm: {..}, extraFm: [...], blocs: [...], url }
let GAL = null, GAL_SHA = null, GAL_BRUT = false;
const PUJADES = new Map(); // id -> { ext, original(base64), web(base64), mini(base64), url (objectURL) }
let BRUT = false;

// ---------- Base64 i UTF-8 ----------
const b64aText = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, "")), c => c.charCodeAt(0)));
const textAb64 = txt => { const b = new TextEncoder().encode(txt); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
const bufferAb64 = buf => { const b = new Uint8Array(buf); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };

// ---------- API de GitHub ----------
async function gh(cami, opcions = {}) {
  const r = await fetch(API + cami, {
    ...opcions,
    headers: { "Authorization": "Bearer " + CLAU, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opcions.body ? { "Content-Type": "application/json" } : {}) },
    cache: "no-store",
  });
  if (r.status === 404 && opcions.permet404) return null;
  let d = null; try { d = await r.json(); } catch (e) {}
  if (!r.ok) {
    if (r.status === 401) throw new Error("La clau no és vàlida o ha caducat.");
    if (r.status === 403 || r.status === 404) throw new Error("La clau no té permís per escriure al web (cal «Contents: Read and write» sobre ignasicorney.github.io).");
    throw new Error((d && d.message) || ("Error " + r.status));
  }
  return d;
}
async function llegeixFitxer(cami) {
  const d = await gh("/contents/" + encodeURI(cami) + "?ref=" + BRANCA, { permet404: true });
  if (!d) return null;
  return { text: b64aText(d.content), sha: d.sha };
}
// Desa diversos fitxers en un sol canvi (commit). canvis: [{cami, text} | {cami, base64} | {cami, esborra:true}]
async function desaCanvis(canvis, missatge) {
  const ref = await gh("/git/ref/heads/" + BRANCA);
  const base = await gh("/git/commits/" + ref.object.sha);
  const arbre = [];
  for (const c of canvis) {
    if (c.esborra) { arbre.push({ path: c.cami, mode: "100644", type: "blob", sha: null }); continue; }
    const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify(c.base64 !== undefined ? { content: c.base64, encoding: "base64" } : { content: c.text, encoding: "utf-8" }) });
    arbre.push({ path: c.cami, mode: "100644", type: "blob", sha: blob.sha });
  }
  const nouArbre = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree: arbre }) });
  const commit = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message: missatge, tree: nouArbre.sha, parents: [ref.object.sha] }) });
  await gh("/git/refs/heads/" + BRANCA, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });
  return commit.sha;
}

// ---------- Generació de l'HTML dels blocs (igual que _eines/blocs.py) ----------
function htmlBloc(b) {
  if (b.tipus === "text") return "<!-- bloc:text -->\n" + '<div class="text">\n' + b.html.trim() + "\n</div>" + "\n<!-- /bloc -->";
  if (b.tipus === "imatges") {
    const d = { pos: b.pos, rodo: !!b.rodo, imatges: b.imatges.map(netejaImatge) };
    const figs = d.imatges.map(i => {
      const web = "/assets/img/web/" + i.f + ".jpg";
      const alt = i.alt || i.peu || "";
      const a = i.enllac ? '<a href="' + esc(i.enllac) + '">'
        : '<a href="' + web + '" data-original="/assets/img/originals/' + i.f + "." + i.ext + '" data-peu="' + esc(i.peu || alt) + '">';
      const cap = i.peu ? "<figcaption>" + esc(i.peu) + "</figcaption>" : "";
      return '<figure style="width:' + (parseInt(i.amplada, 10) || 600) + 'px">' + a + '<img src="' + web + '" alt="' + esc(alt) + '" loading="lazy"></a>' + cap + "</figure>";
    });
    const cls = "imatges pos-" + d.pos + (d.rodo ? " rodo" : "");
    return "<!-- bloc:imatges " + jsonBloc(d) + " -->\n" + '<div class="' + cls + '">' + figs.join("") + "</div>" + "\n<!-- /bloc -->";
  }
  if (b.tipus === "carrussel") {
    const d = { nom: b.nom, tipus: b.tipusC, titol: b.titol || "" };
    return "<!-- bloc:carrussel " + jsonBloc(d) + " -->\n" + '{% include carrussel.html nom="' + d.nom + '" tipus="' + d.tipus + '" titol="' + esc(d.titol) + '" %}' + "\n<!-- /bloc -->";
  }
  if (b.tipus === "video") {
    const d = { id: b.id, titol: b.titol || "" };
    return "<!-- bloc:video " + jsonBloc(d) + " -->\n" + '{% include video.html id="' + d.id + '" titol="' + esc(d.titol) + '" %}' + "\n<!-- /bloc -->";
  }
  return b.cru;
}
function netejaImatge(i) {
  const o = { f: i.f, ext: i.ext };
  if (i.alt) o.alt = i.alt;
  if (i.peu) o.peu = i.peu;
  if (i.enllac) o.enllac = i.enllac;
  o.amplada = parseInt(i.amplada, 10) || 600;
  return o;
}
// JSON dins del comentari del bloc (sense "--", que el tancaria)
const jsonBloc = d => JSON.stringify(d).replace(/--/g, "-\\u002d");

// ---------- Lectura d'una pàgina en blocs ----------
function separaFm(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: {}, extra: [], cos: text };
  const fm = {}, extra = [];
  m[1].split("\n").forEach(l => {
    const k = l.match(/^(title|description):\s*(.*)$/);
    if (k) { let v = k[2].trim(); try { if (v.startsWith('"')) v = JSON.parse(v); } catch (e) {} fm[k[1]] = v; }
    else if (l.trim()) extra.push(l);
  });
  return { fm, extra, cos: text.slice(m[0].length) };
}
function llegeixBlocs(cos) {
  const blocs = [];
  const re = /<!-- bloc:(\w+)(?: (\{.*?\}))? -->\n([\s\S]*?)\n<!-- \/bloc -->/g;
  let m, ultim = 0;
  while ((m = re.exec(cos))) {
    const entre = cos.slice(ultim, m.index).trim();
    if (entre) blocs.push({ tipus: "html", cru: entre });
    ultim = re.lastIndex;
    const tipus = m[1];
    let d = {}; try { d = m[2] ? JSON.parse(m[2]) : {}; } catch (e) {}
    if (tipus === "text") {
      const t = m[3].replace(/^<div class="text">\n?/, "").replace(/\n?<\/div>$/, "");
      blocs.push({ tipus: "text", html: t });
    } else if (tipus === "imatges") {
      blocs.push({ tipus: "imatges", pos: d.pos || "centre", rodo: !!d.rodo, imatges: (d.imatges || []).map(i => ({ ...i })) });
    } else if (tipus === "carrussel") {
      blocs.push({ tipus: "carrussel", nom: d.nom, tipusC: d.tipus || "diapos", titol: d.titol || "" });
    } else if (tipus === "video") {
      blocs.push({ tipus: "video", id: d.id || "", titol: d.titol || "" });
    } else {
      blocs.push({ tipus: "html", cru: m[0] });
    }
  }
  const resta = cos.slice(ultim).trim();
  if (resta) blocs.push({ tipus: "html", cru: resta });
  return blocs;
}
function composaFitxer(a) {
  const fm = ["---"];
  if (a.tipus === "pagina") fm.push("layout: default");
  fm.push("title: " + JSON.stringify(a.fm.title || ""));
  if (a.fm.description) fm.push("description: " + JSON.stringify(a.fm.description));
  a.extra.filter(l => !/^layout:/.test(l)).forEach(l => fm.push(l));
  fm.push("---");
  return fm.join("\n") + "\n" + a.blocs.map(htmlBloc).join("\n\n") + "\n";
}

// ---------- Neteja del text enganxat o escrit ----------
const PERMESOS = { P: "p", H2: "h2", H3: "h3", B: "b", STRONG: "b", I: "i", EM: "i", U: "u", A: "a", UL: "ul", OL: "ol", LI: "li", BR: "br", BLOCKQUOTE: "blockquote" };
function netejaHtml(arrel) {
  const fora = n => {
    if (n.nodeType === 3) return n.textContent.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    if (n.nodeType !== 1) return "";
    let dins = Array.from(n.childNodes).map(fora).join("");
    const st = n.getAttribute("style") || "";
    let t = PERMESOS[n.tagName];
    if (n.tagName === "DIV") t = "p";
    if (n.tagName === "SPAN" || !t) {
      if (/italic/.test(st)) dins = "<i>" + dins + "</i>";
      if (/font-weight:\s*(bold|[6-9]00)/.test(st)) dins = "<b>" + dins + "</b>";
      return dins;
    }
    if (t === "br") return "<br>";
    if (t === "a") { const h = n.getAttribute("href") || ""; return h ? '<a href="' + esc(h) + '">' + dins + "</a>" : dins; }
    if (["p", "h2", "h3", "li", "ul", "ol", "blockquote"].includes(t)) {
      if (!dins.replace(/<br>|\s|&nbsp;/g, "")) return "";
      return "\n<" + t + ">" + dins.trim() + "</" + t + ">";
    }
    return dins ? "<" + t + ">" + dins + "</" + t + ">" : "";
  };
  let h = Array.from(arrel.childNodes).map(fora).join("");
  // text solt (fora de paràgrafs) a dins d'un paràgraf
  h = h.split("\n").map(l => l.trim()).filter(Boolean).map(l => /^<(p|h2|h3|ul|ol|li|blockquote|\/ul|\/ol)\b/.test(l) ? l : "<p>" + l + "</p>").join("\n");
  return h.replace(/<\/?(ul|ol)>/g, m => "\n" + m + "\n").replace(/\n+/g, "\n").trim();
}

// ---------- Imatges noves: es redueixen al navegador ----------
async function preparaImatge(fitxer) {
  const ext = (fitxer.name.split(".").pop() || "jpg").toLowerCase().replace("jpeg", "jpeg");
  if (!/^(jpe?g|png|webp|gif)$/.test(ext)) throw new Error("«" + fitxer.name + "» no és una imatge JPG, PNG, WEBP o GIF. (Les fotos HEIC de l'iPhone, desa-les abans com a JPG.)");
  const bmp = await createImageBitmap(fitxer, { imageOrientation: "from-image" });
  const redueix = async (max, q) => {
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, "image/jpeg", q));
    return bufferAb64(await blob.arrayBuffer());
  };
  const id = nouId();
  const p = { ext, original: bufferAb64(await fitxer.arrayBuffer()), web: await redueix(1600, 0.82), mini: await redueix(600, 0.78), url: URL.createObjectURL(fitxer), amplada: Math.min(bmp.width, 600), nom: fitxer.name };
  PUJADES.set(id, p);
  return { id, p };
}
const srcMini = f => PUJADES.has(f) ? PUJADES.get(f).url : "/assets/img/mini/" + f + ".jpg";
function demanaFitxers(multiple) {
  return new Promise(res => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/jpeg,image/png,image/webp,image/gif"; inp.multiple = !!multiple;
    inp.onchange = () => res(Array.from(inp.files || []));
    inp.click();
  });
}
async function afegeixImatges(multiple) {
  const fitxers = await demanaFitxers(multiple);
  const fetes = [];
  for (const f of fitxers) {
    estat("Preparant «" + f.name + "»…");
    try { fetes.push(await preparaImatge(f)); } catch (e) { alert(e.message); }
  }
  estat(fetes.length ? "Imatges preparades. Es pujaran en desar." : "");
  return fetes;
}

// ---------- Estat ----------
function estat(t) { $("estat").textContent = t; }
function marcaBrut() { BRUT = true; $("desa").disabled = false; estat("✏️ Hi ha canvis sense desar."); }
window.addEventListener("beforeunload", e => { if (BRUT) { e.preventDefault(); e.returnValue = ""; } });

// ---------- Entrada ----------
async function entra() {
  CLAU = $("clau").value.trim();
  if (!CLAU) { $("clauEstat").textContent = "Enganxa la clau."; return; }
  $("clauEstat").textContent = "Comprovant…";
  try {
    const r = await gh("");
    if (!r.permissions || !r.permissions.push) throw new Error("La clau no té permís d'escriptura.");
    escriu(CLAU_DESADA, $("recorda").checked ? CLAU : "");
    $("clauBox").hidden = true; $("panell").hidden = false; $("peu").hidden = false;
    await carregaGaleries();
    await omplenaSelector();
    const demanat = decodeURIComponent(location.hash.slice(1));
    obre(demanat && $("quin").querySelector('option[value="' + CSS.escape(demanat) + '"]') ? demanat : PAGINES[0][0]);
  } catch (e) {
    CLAU = "";
    $("clauEstat").textContent = "❌ " + (e instanceof TypeError ? "No s'ha pogut connectar amb GitHub." : e.message);
  }
}

async function omplenaSelector(seleccio) {
  const posts = (await gh("/contents/_posts?ref=" + BRANCA, { permet404: true })) || [];
  const entrades = posts.filter(p => /\.(html|md)$/.test(p.name)).sort((a, b) => b.name.localeCompare(a.name));
  const s = $("quin");
  s.innerHTML = '<optgroup label="Seccions">' + PAGINES.map(p => '<option value="' + p[0] + '">' + p[1] + "</option>").join("") + "</optgroup>" +
    '<optgroup label="Blog">' + (entrades.length ? entrades.map(p => '<option value="' + esc(p.path) + '">' + esc(p.name.slice(0, 10).split("-").reverse().join(".") + " · " + p.name.slice(11).replace(/\.(html|md)$/, "").replace(/-/g, " ")) + "</option>").join("") : '<option disabled>(encara no hi ha entrades)</option>') + "</optgroup>";
  if (seleccio) s.value = seleccio;
}

async function carregaGaleries() {
  const f = await llegeixFitxer(GALERIES);
  GAL = f ? (jsyaml.load(f.text) || {}) : {};
  GAL_SHA = f ? f.sha : null;
  GAL_BRUT = false;
}

async function obre(cami) {
  if (BRUT && !confirm("Hi ha canvis sense desar. Els vols perdre?")) { $("quin").value = ACTUAL ? ACTUAL.cami : cami; return; }
  estat("Obrint…");
  const f = await llegeixFitxer(cami);
  if (!f) { estat("❌ No s'ha trobat " + cami); return; }
  const { fm, extra, cos } = separaFm(f.text);
  const pag = PAGINES.find(p => p[0] === cami);
  const m = cami.match(/_posts\/(\d{4}-\d{2}-\d{2})-(.+)\.(html|md)$/);
  ACTUAL = { cami, sha: f.sha, fm, extra, tipus: pag ? "pagina" : "entrada", blocs: llegeixBlocs(cos), url: pag ? pag[2] : m ? "/blog/" + m[1].replace(/-/g, "/") + "/" + m[2] + "/" : "/blog/" };
  if (m && m[3] === "md" && !/<!-- bloc:/.test(cos)) ACTUAL.blocs = [{ tipus: "text", html: cos.trim().split(/\n{2,}/).map(p => /^</.test(p) ? p : "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join("\n") }];
  ACTUAL.data = m ? m[1] : null;
  ACTUAL.slug = m ? m[2] : null;
  $("quin").value = cami;
  location.hash = encodeURIComponent(cami);
  pintaMeta();
  pintaBlocs();
  BRUT = false; $("desa").disabled = true;
  estat("");
}

function pintaMeta() {
  const a = ACTUAL;
  $("titol").value = a.fm.title || "";
  $("descripcio").value = a.fm.description || "";
  $("dataBox").hidden = a.tipus !== "entrada";
  $("data").value = a.data || avui();
  $("perill").hidden = a.tipus !== "entrada" || a.nova;
  $("veure").href = a.url;
  $("veure").hidden = !!a.nova;
  $("metaNota").textContent = a.tipus === "pagina" ? "El títol surt a la pestanya del navegador i a Google; el títol visible és el del primer bloc de text." : "";
}
["titol", "descripcio", "data"].forEach(id => $(id).addEventListener("input", () => {
  if (id === "titol") ACTUAL.fm.title = $("titol").value;
  if (id === "descripcio") ACTUAL.fm.description = $("descripcio").value;
  if (id === "data") ACTUAL.data = $("data").value;
  marcaBrut();
}));

// ---------- Pintar els blocs ----------
const NOMS = { text: "📝 Text", imatges: "🖼️ Imatges", carrussel: "🎞️ Carrussel", video: "▶️ Vídeo", html: "🧩 Codi (no editable aquí)" };
function pintaBlocs() {
  const cont = $("blocs");
  cont.innerHTML = "";
  ACTUAL.blocs.forEach((b, i) => cont.appendChild(pintaBloc(b, i)));
}
function capBloc(b, i) {
  const n = ACTUAL.blocs.length;
  const cap = document.createElement("div");
  cap.className = "cap";
  cap.innerHTML = "<h2>" + NOMS[b.tipus] + "</h2>" +
    '<button type="button" class="icona" data-a="amunt" title="Puja el bloc"' + (i === 0 ? " disabled" : "") + ">↑</button>" +
    '<button type="button" class="icona" data-a="avall" title="Baixa el bloc"' + (i === n - 1 ? " disabled" : "") + ">↓</button>" +
    '<button type="button" class="icona" data-a="treu" title="Treu el bloc">🗑️</button>';
  cap.addEventListener("click", e => {
    const a = e.target.closest("button") && e.target.closest("button").dataset.a;
    if (!a) return;
    if (a === "amunt" || a === "avall") { const j = a === "amunt" ? i - 1 : i + 1; [ACTUAL.blocs[i], ACTUAL.blocs[j]] = [ACTUAL.blocs[j], ACTUAL.blocs[i]]; }
    if (a === "treu") { if (!confirm("Segur que vols treure aquest bloc?")) return; ACTUAL.blocs.splice(i, 1); }
    pintaBlocs(); marcaBrut();
  });
  return cap;
}
function peuInsereix(i) {
  const d = document.createElement("div");
  d.className = "insereix";
  d.innerHTML = "Insereix a sota: " + ["text", "imatges", "carrussel", "video"].map(t => '<button type="button" class="suau" data-nou="' + t + '">' + NOMS[t] + "</button>").join("");
  d.addEventListener("click", e => { const t = e.target.closest("button"); if (t) nouBloc(t.dataset.nou, i + 1); });
  return d;
}
function pintaBloc(b, i) {
  const el = document.createElement("div");
  el.className = "bloc b-" + b.tipus;
  el.appendChild(capBloc(b, i));
  if (b.tipus === "text") pintaText(el, b);
  else if (b.tipus === "imatges") pintaImatges(el, b);
  else if (b.tipus === "carrussel") pintaCarrussel(el, b);
  else if (b.tipus === "video") pintaVideo(el, b);
  else { const p = document.createElement("p"); p.className = "font"; p.textContent = "Aquest tros de la pàgina és codi especial i es manté tal com està."; el.appendChild(p); }
  el.appendChild(peuInsereix(i));
  return el;
}

function pintaText(el, b) {
  el.appendChild($("tplEines").content.cloneNode(true));
  const t = document.createElement("div");
  t.className = "text"; t.contentEditable = "true"; t.innerHTML = b.html;
  el.appendChild(t);
  const desa = () => { b.html = netejaHtml(t); };
  t.addEventListener("input", () => { desa(); marcaBrut(); });
  t.addEventListener("blur", desa);
  t.addEventListener("paste", e => {
    e.preventDefault();
    const txt = (e.clipboardData || window.clipboardData).getData("text/plain");
    document.execCommand("insertHTML", false, txt.split(/\n{2,}|\r\n\r\n/).map(p => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join(""));
  });
  el.querySelector(".eines").addEventListener("mousedown", e => e.preventDefault());
  el.querySelector(".eines").addEventListener("click", e => {
    const bt = e.target.closest("button"); if (!bt) return;
    t.focus();
    const o = bt.dataset.ordre;
    if (o === "enllac") { const u = prompt("Adreça de l'enllaç (deixa-ho buit per treure'l):", "https://"); if (u === null) return; if (!u || u === "https://") document.execCommand("unlink"); else document.execCommand("createLink", false, u); }
    else if (o === "h2" || o === "h3" || o === "p") document.execCommand("formatBlock", false, o);
    else if (o === "cita") document.execCommand("formatBlock", false, "blockquote");
    else document.execCommand(o);
    desa(); marcaBrut();
  });
  document.execCommand("defaultParagraphSeparator", false, "p");
}

function pintaImatges(el, b) {
  const op = document.createElement("div");
  op.className = "opcions";
  op.innerHTML = '<label>Posició <select data-k="pos">' + Object.entries(POSICIONS).map(([k, v]) => '<option value="' + k + '"' + (b.pos === k ? " selected" : "") + ">" + v + "</option>").join("") + "</select></label>" +
    '<label class="fila" style="gap:6px"><input type="checkbox" data-k="rodo"' + (b.rodo ? " checked" : "") + "> Cantonades arrodonides</label>";
  op.addEventListener("change", e => { const k = e.target.dataset.k; if (k === "pos") b.pos = e.target.value; if (k === "rodo") b.rodo = e.target.checked; marcaBrut(); });
  el.appendChild(op);
  const p = document.createElement("p"); p.className = "font";
  p.textContent = "Si n'hi poses més d'una, surten de costat. L'amplada és en píxels (la columna de text en fa uns 930).";
  el.appendChild(p);
  const ll = document.createElement("div"); ll.className = "llistaImg"; el.appendChild(ll);
  const pinta = () => {
    ll.innerHTML = "";
    b.imatges.forEach((im, k) => ll.appendChild(filaImatge(im, k, b.imatges, pinta, true)));
    const af = document.createElement("div"); af.className = "fila";
    af.innerHTML = '<button type="button" class="suau">➕ Afegeix imatges</button>';
    af.querySelector("button").onclick = async () => {
      for (const { id, p } of await afegeixImatges(true)) b.imatges.push({ f: id, ext: p.ext, alt: "", amplada: p.amplada });
      pinta(); marcaBrut();
    };
    ll.appendChild(af);
  };
  pinta();
}

// Fila d'una imatge (bloc d'imatges o carrussel)
function filaImatge(im, k, llista, repinta, solta) {
  const d = document.createElement("div"); d.className = "img";
  const nova = PUJADES.has(im.f) ? '<span class="nova">nova</span>' : "";
  d.innerHTML = '<img class="miniatura" alt="" src="' + srcMini(im.f) + '">' +
    '<div class="camps">' +
    (solta
      ? '<label class="llarg">Descripció (per a qui no hi veu i per a Google)' + nova + ' <input type="text" data-k="alt" value="' + esc(im.alt || "") + '"></label>' +
        '<label class="llarg">Peu visible a sota (opcional) <input type="text" data-k="peu" value="' + esc(im.peu || "") + '"></label>' +
        '<label>Enllaç en clicar-la (opcional) <input type="url" data-k="enllac" value="' + esc(im.enllac || "") + '" placeholder="https://…"></label>' +
        '<label>Amplada (px) <input type="number" min="60" max="1400" step="10" data-k="amplada" value="' + (parseInt(im.amplada, 10) || 600) + '"></label>'
      : '<label class="llarg">Títol del peu' + nova + ' <input type="text" data-k="peu" value="' + esc(im.peu || "") + '"></label>' +
        '<label class="llarg">Descripció (segona línia, opcional) <input type="text" data-k="desc" value="' + esc(im.desc || "") + '"></label>') +
    "</div>" +
    '<div class="accions">' +
    '<button type="button" class="icona" data-a="amunt" title="Abans"' + (k === 0 ? " disabled" : "") + ">↑</button>" +
    '<button type="button" class="icona" data-a="avall" title="Després"' + (k === llista.length - 1 ? " disabled" : "") + ">↓</button>" +
    '<button type="button" class="icona" data-a="canvia" title="Canvia la imatge per una altra">🔁</button>' +
    '<button type="button" class="icona" data-a="treu" title="Treu-la">🗑️</button></div>';
  d.addEventListener("input", e => { const kk = e.target.dataset.k; if (!kk) return; im[kk] = e.target.value; solta ? marcaBrut() : (GAL_BRUT = true, marcaBrut()); });
  d.querySelector(".accions").addEventListener("click", async e => {
    const a = e.target.closest("button") && e.target.closest("button").dataset.a; if (!a) return;
    if (a === "amunt" || a === "avall") { const j = a === "amunt" ? k - 1 : k + 1; [llista[k], llista[j]] = [llista[j], llista[k]]; }
    if (a === "treu") { if (!confirm("Treure aquesta imatge d'aquí? (L'original es conserva al repositori.)")) return; llista.splice(k, 1); }
    if (a === "canvia") { const [n] = await afegeixImatges(false); if (!n) return; im.f = n.id; im.ext = n.p.ext; }
    if (!solta) GAL_BRUT = true;
    repinta(); marcaBrut();
  });
  return d;
}

function pintaCarrussel(el, b) {
  const noms = Object.keys(GAL);
  const op = document.createElement("div"); op.className = "opcions";
  op.innerHTML = '<label>Quin carrussel <select data-k="nom">' + noms.map(n => '<option value="' + esc(n) + '"' + (n === b.nom ? " selected" : "") + ">" + esc(n.replace(/_/g, " ")) + " (" + GAL[n].length + ")</option>").join("") + "</select></label>" +
    '<label>Estil <select data-k="tipusC">' + Object.entries(TIPUS_CARRUSSEL).map(([k, v]) => '<option value="' + k + '"' + (b.tipusC === k ? " selected" : "") + ">" + v + "</option>").join("") + "</select></label>" +
    '<label style="flex:1">Nom per a lectors de pantalla <input type="text" data-k="titol" value="' + esc(b.titol) + '"></label>';
  op.addEventListener("change", e => { const k = e.target.dataset.k; if (!k) return; b[k] = e.target.value; marcaBrut(); if (k === "nom") pinta(); });
  op.addEventListener("input", e => { if (e.target.dataset.k === "titol") { b.titol = e.target.value; marcaBrut(); } });
  el.appendChild(op);
  const p = document.createElement("p"); p.className = "font";
  p.textContent = "Les imatges del carrussel són les mateixes allà on el facis servir. Canviar-ne una aquí la canvia a tot arreu.";
  el.appendChild(p);
  const det = document.createElement("details");
  det.innerHTML = "<summary>Imatges d'aquest carrussel</summary>";
  const ll = document.createElement("div"); ll.className = "llistaImg"; ll.style.marginTop = "10px"; det.appendChild(ll);
  el.appendChild(det);
  function pinta() {
    const g = GAL[b.nom] || (GAL[b.nom] = []);
    ll.innerHTML = "";
    g.forEach((im, k) => ll.appendChild(filaImatge(im, k, g, pinta, false)));
    const af = document.createElement("div"); af.className = "fila";
    af.innerHTML = '<button type="button" class="suau">➕ Afegeix imatges al carrussel</button>';
    af.querySelector("button").onclick = async () => {
      for (const { id, p } of await afegeixImatges(true)) g.push({ f: id, ext: p.ext, peu: "" });
      GAL_BRUT = true; pinta(); marcaBrut();
    };
    ll.appendChild(af);
  }
  pinta();
}

function pintaVideo(el, b) {
  const op = document.createElement("div"); op.className = "opcions";
  op.innerHTML = '<label style="flex:1">Enllaç o codi del vídeo de YouTube <input type="text" data-k="id" value="' + esc(b.id) + '" placeholder="https://www.youtube.com/watch?v=…"></label>' +
    '<label style="flex:1">Títol del vídeo <input type="text" data-k="titol" value="' + esc(b.titol) + '"></label>';
  const prev = document.createElement("img");
  prev.style.cssText = "width:240px;border-radius:6px;background:#222;aspect-ratio:16/9;object-fit:cover";
  const pp = () => { prev.src = b.id ? "https://i.ytimg.com/vi/" + b.id + "/hqdefault.jpg" : ""; };
  op.addEventListener("input", e => {
    const k = e.target.dataset.k; if (!k) return;
    if (k === "id") { const v = e.target.value.trim(); const m = v.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); b.id = m ? m[1] : v; pp(); }
    else b.titol = e.target.value;
    marcaBrut();
  });
  el.appendChild(op); el.appendChild(prev); pp();
}

function nouBloc(tipus, on) {
  const b = tipus === "text" ? { tipus, html: "<p></p>" }
    : tipus === "imatges" ? { tipus, pos: "centre", rodo: false, imatges: [] }
    : tipus === "carrussel" ? { tipus, nom: Object.keys(GAL)[0] || "nou", tipusC: "diapos", titol: "" }
    : { tipus: "video", id: "", titol: "" };
  if (tipus === "carrussel") {
    const nom = prompt("Nom del carrussel. Escriu el d'un que ja existeixi (" + Object.keys(GAL).join(", ") + ") o un de nou:", "");
    if (!nom) return;
    b.nom = nom.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    if (!GAL[b.nom]) { GAL[b.nom] = []; GAL_BRUT = true; }
    b.titol = nom.trim();
  }
  ACTUAL.blocs.splice(on === undefined ? ACTUAL.blocs.length : on, 0, b);
  pintaBlocs(); marcaBrut();
  const els = $("blocs").children; const el = els[on === undefined ? els.length - 1 : on];
  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
}
document.querySelector(".afegeix").addEventListener("click", e => { const t = e.target.closest("button"); if (t) nouBloc(t.dataset.nou); });

// ---------- Entrades del blog ----------
const slug = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/l·l/g, "ll").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "entrada";
$("novaEntrada").onclick = () => {
  if (BRUT && !confirm("Hi ha canvis sense desar. Els vols perdre?")) return;
  ACTUAL = { cami: null, nova: true, sha: null, fm: { title: "" }, extra: [], tipus: "entrada", blocs: [{ tipus: "text", html: "<p></p>" }], data: avui(), url: "/blog/" };
  pintaMeta(); pintaBlocs();
  BRUT = false; $("desa").disabled = true;
  estat("Entrada nova: posa-hi títol i text, i desa.");
  $("titol").focus();
};
$("esborraEntrada").onclick = async () => {
  if (!confirm("Esborrar l'entrada «" + (ACTUAL.fm.title || "") + "» del blog? Desapareixerà del web (es podria recuperar de l'historial de GitHub).")) return;
  try {
    estat("Esborrant…");
    await desaCanvis([{ cami: ACTUAL.cami, esborra: true }], "Blog: esborra «" + ACTUAL.fm.title + "»");
    BRUT = false;
    await omplenaSelector();
    obre(PAGINES[0][0]);
    estat("🗑️ Entrada esborrada. Desapareixerà del web en un o dos minuts.");
  } catch (e) { estat("❌ " + e.message); }
};

// ---------- Desar ----------
$("desa").onclick = async () => {
  const a = ACTUAL;
  if (!(a.fm.title || "").trim()) { alert("Falta el títol."); $("titol").focus(); return; }
  if (a.tipus === "entrada" && !/^\d{4}-\d{2}-\d{2}$/.test(a.data || "")) { alert("Falta la data."); return; }
  document.querySelectorAll("#blocs .text").forEach(t => t.blur());
  $("desa").disabled = true;
  try {
    estat("Comprovant que ningú no l'hagi canviat mentrestant…");
    if (a.cami && !a.nova) {
      const ara = await llegeixFitxer(a.cami);
      if (ara && ara.sha !== a.sha && !confirm("Aquesta pàgina s'ha canviat des d'un altre lloc mentre l'editaves. Si continues, la teva versió substituirà l'altra. Continuar?")) { $("desa").disabled = false; estat("No s'ha desat."); return; }
    }
    if (GAL_BRUT && GAL_SHA) {
      const ara = await llegeixFitxer(GALERIES);
      if (ara && ara.sha !== GAL_SHA && !confirm("Els carrussels s'han canviat des d'un altre lloc. Si continues, els teus canvis substituiran els altres. Continuar?")) { $("desa").disabled = false; estat("No s'ha desat."); return; }
    }
    const canvis = [];
    let cami = a.cami;
    if (a.tipus === "entrada") {
      const nouCami = "_posts/" + a.data + "-" + (a.slug && !a.nova ? a.slug : slug(a.fm.title)) + ".html";
      if (cami && cami !== nouCami) canvis.push({ cami, esborra: true });
      cami = nouCami;
    }
    canvis.push({ cami, text: composaFitxer(a) });
    if (GAL_BRUT) canvis.push({ cami: GALERIES, text: "# Carrussels del web. Es pot editar des de /editor/\n" + jsyaml.dump(GAL, { lineWidth: -1, quotingType: '"', forceQuotes: true }) });
    // imatges noves que es facin servir
    const usades = new Set();
    a.blocs.forEach(b => { if (b.tipus === "imatges") b.imatges.forEach(i => usades.add(i.f)); });
    Object.values(GAL).forEach(g => (g || []).forEach(i => usades.add(i.f)));
    let n = 0;
    for (const [id, p] of PUJADES) {
      if (!usades.has(id)) continue;
      canvis.push({ cami: "assets/img/originals/" + id + "." + p.ext, base64: p.original });
      canvis.push({ cami: "assets/img/web/" + id + ".jpg", base64: p.web });
      canvis.push({ cami: "assets/img/mini/" + id + ".jpg", base64: p.mini });
      n++;
    }
    estat("Desant" + (n ? " i pujant " + n + (n === 1 ? " imatge" : " imatges") : "") + "…");
    const nom = a.tipus === "entrada" ? "Blog: " + a.fm.title : "Edita " + (PAGINES.find(p => p[0] === cami) || [0, cami])[1];
    await desaCanvis(canvis, nom);
    for (const [id] of PUJADES) if (usades.has(id)) PUJADES.delete(id);
    BRUT = false;
    if (a.tipus === "entrada") await omplenaSelector(cami);
    await carregaGaleries();
    await obre(cami);
    estat("✅ Desat. Es veurà al web en un o dos minuts.");
  } catch (e) {
    $("desa").disabled = false;
    estat("❌ No s'ha pogut desar: " + e.message);
  }
};

// ---------- Inici ----------
$("entra").onclick = entra;
$("clau").addEventListener("keydown", e => { if (e.key === "Enter") entra(); });
$("quin").addEventListener("change", e => obre(e.target.value));
const desada = llegeix(CLAU_DESADA);
if (desada) { $("clau").value = desada; entra(); }
