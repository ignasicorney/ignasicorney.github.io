// =============================================================================
// Sardanes i autors (23.11.2026): cercador de tota la base de dades de
// boigperlasardana.cat (sardanes i persones) i l'històric dels aplecs de la
// Bisbal d'Empordà (SomArxiu). Les dades les prepara cada setmana el repo privat
// latdg/sardana (carpeta web/) i es llegeixen amb el token de GitHub de la
// Bitàcola (el mateix dels fitxers adjunts), amb la clau de la Bitàcola.
// =============================================================================
(() => {
  const $ = id => document.getElementById(id);
  if (!$("sardanes")) return;
  const REPO = "latdg/sardana";
  const API = "https://api.github.com/repos/" + REPO + "/contents/web/";
  const MAX = 300;
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = t => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’`]/g, "'");
  // Les dates «AAAA-01-01» de boig per la sardana volen dir «només l'any»
  const data = v => {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ""));
    if (!m) return String(v ?? "");
    if (m[1] === "0000") return "";
    if (m[2] === "00" || (m[2] === "01" && m[3] === "01")) return m[1];
    if (m[3] === "00") return m[2] + "." + m[1];
    return m[3] + "." + m[2] + "." + m[1];
  };
  const any = v => { const m = /^(\d{4})/.exec(String(v || "")); return m && m[1] !== "0000" ? m[1] : ""; };
  const cert = v => !(v == null || v === "" || v === 0 || v === "0" || v === false || /^no$/i.test(String(v)));
  const num = v => { const n = Number(v); return isFinite(n) ? n : 0; };
  const nomDe = v => v && typeof v === "object" ? (Array.isArray(v) ? v.map(nomDe).filter(Boolean).join(", ") : (v.nom || v.titol || "")) : String(v ?? "");

  // ---------------- Estils ----------------
  const css = document.createElement("style");
  css.textContent = `
#sardanes .sa-cap{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;margin-bottom:8px}
#sardanes .sa-cap h2{margin:0}
.sa-enll{display:flex;gap:6px;flex-wrap:wrap}
.sa-enll a{font-size:.85rem;padding:3px 10px;border:1px solid var(--linia);border-radius:999px;background:var(--targeta);color:var(--text);text-decoration:none}
.sa-enll a:hover{border-color:var(--accent);color:var(--accent)}
.sa-estat{color:var(--suau);font-size:.88rem;margin:0 0 10px}
.sa-estat.err{color:#a3161b}
.sa-pest{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.sa-pest button{font:inherit;font-size:.92rem;padding:5px 12px;border:1px solid var(--linia);border-radius:999px;background:var(--targeta);color:var(--text);cursor:pointer}
.sa-pest button.actiu{background:var(--accent);border-color:var(--accent);color:#fff}
.sa-filtres{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.sa-filtres input[type=search]{flex:1 1 260px;min-width:0;padding:7px 10px;border:1px solid var(--linia);border-radius:8px;font:inherit}
.sa-filtres input.curt{flex:0 1 170px}
.sa-filtres select{padding:6px 8px;border:1px solid var(--linia);border-radius:8px;font:inherit;background:var(--targeta)}
.sa-filtres label{font-size:.9rem;color:var(--suau);display:inline-flex;gap:4px;align-items:center}
.sa-compte{font-size:.85rem;color:var(--suau);margin:4px 0}
.sa-taula{width:100%;border-collapse:collapse;font-size:.92rem}
.sa-taula th{text-align:left;font-weight:600;color:var(--suau);border-bottom:1px solid var(--linia);padding:5px 6px;white-space:nowrap}
.sa-taula td{border-bottom:1px solid var(--linia);padding:5px 6px;vertical-align:top}
.sa-taula tr[data-i]{cursor:pointer}
.sa-taula tr[data-i]:hover td{background:#fbfaf7}
.sa-taula td.n{text-align:right;font-variant-numeric:tabular-nums}
.sa-desp{overflow-x:auto}
.sa-fitxa{border:1px solid var(--linia);border-radius:12px;padding:12px 14px;background:#fbfaf7;margin:8px 0 12px}
.sa-fitxa h3{margin:0 0 4px}
.sa-fitxa .sub{color:var(--suau);margin:0 0 8px}
.sa-fitxa dl{display:grid;grid-template-columns:max-content 1fr;gap:3px 12px;margin:0;font-size:.92rem}
.sa-fitxa dt{color:var(--suau)}
.sa-fitxa dd{margin:0}
.sa-fitxa .tanca{float:right}
.sa-accions{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0 0}
.sa-accions a{text-decoration:none}
.sa-corr{margin:0 0 8px;padding:6px 10px;border-left:3px solid var(--accent);background:var(--targeta);font-size:.88rem}
.sa-corr span{color:var(--suau)}
.sa-form{display:grid;gap:8px 14px;grid-template-columns:repeat(auto-fill,minmax(230px,1fr))}
.sa-form label{display:grid;gap:3px;font-size:.88rem;color:var(--suau)}
.sa-form label:has(textarea),.sa-form label.ample,.sa-form .sa-accions,.sa-form .sa-estat{grid-column:1/-1}
.sa-form input,.sa-form textarea{font:inherit;color:var(--text);padding:6px 8px;border:1px solid var(--linia);border-radius:8px;background:var(--targeta)}
.sa-llibre{max-height:70vh;overflow:auto}
.sa-text mark,.sa-taula mark{background:#ffe08a}
.sa-text{white-space:pre-wrap;font-size:.85rem;background:var(--targeta);border:1px solid var(--linia);border-radius:8px;padding:10px;margin-top:10px}
.sa-enllac{background:none;border:0;padding:0;font:inherit;color:var(--accent);cursor:pointer;text-decoration:underline;text-align:left}
.sa-aplec{border:1px solid var(--linia);border-radius:10px;margin:6px 0;background:var(--targeta)}
.sa-aplec>summary{cursor:pointer;padding:8px 12px}
.sa-aplec>div{padding:0 12px 10px}
.sa-graella{display:grid;gap:12px}
@media (min-width:900px){.sa-graella{grid-template-columns:1fr 1fr 1fr}}
.sa-graella h4{margin:0 0 4px}
`;
  document.head.appendChild(css);

  // ---------------- Dades ----------------
  let D = null;           // {meta, sardanes, autors, aplecs, perAutor, autorPerNom}
  let carregant = null;
  let pest = "sardanes";
  let fitxa = null;       // {tipus, i}

  function files(t) {
    if (!t || !Array.isArray(t.camps) || !Array.isArray(t.files)) return [];
    return t.files.map(f => { const o = {}; t.camps.forEach((c, k) => { o[c] = f[k]; }); return o; });
  }

  async function baixa(nom, token) {
    const r = await fetch(API + nom + "?ref=main", { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github.raw+json" }, cache: "no-cache" });
    if (r.status === 401) throw new Error("El token de GitHub de la Bitàcola no és vàlid o ha caducat (el pots canviar des d'una nota: 📎 › Canvia el token).");
    if (r.status === 403 || r.status === 404) {
      const e = new Error("El token de GitHub de la Bitàcola encara no pot llegir latdg/sardana, o les dades encara no s'han generat. A github.com › Settings › Developer settings › Fine-grained tokens, obre el token dels fitxers i afegeix-hi el repositori latdg/sardana (Contents: Read).");
      e.accés = true; throw e;
    }
    if (!r.ok) throw new Error("GitHub ha respost " + r.status + " en llegir " + nom + ".");
    return r.json();
  }

  async function carrega() {
    if (D) return D;
    if (carregant) return carregant;
    carregant = (async () => {
      if (!window.TaulerPrivat || !window.TaulerPrivat.tokenGitHub) throw new Error("Aquesta versió de la Bitàcola no pot llegir el token. Recarrega la pàgina.");
      const t = await window.TaulerPrivat.tokenGitHub();
      if (t.estat === "clau") throw new Error("Cal la clau de la Bitàcola: obre l'Institut i escriu-la, i torna a obrir les sardanes.");
      if (t.estat !== "ok" || !t.token) throw new Error(t.estat === "sense" ? "Encara no hi ha cap token de GitHub desat a la Bitàcola (és el dels fitxers adjunts de les notes)." : "No s'ha pogut llegir el token (sense connexió?).");
      const meta = await baixa("meta.json", t.token);
      const [s, a, ap] = await Promise.all([
        baixa("sardanes.json", t.token),
        baixa("autors.json", t.token),
        meta.taules && meta.taules.aplecs ? baixa("aplecs.json", t.token) : Promise.resolve([])
      ]);
      const corr = await llegeixCorr(t.token);
      D = { meta, sardanes: files(s), autors: files(a), aplecs: Array.isArray(ap) ? ap : [], token: t.token, corr: corr.dades, corrSha: corr.sha };
      aplicaCorr();
      return D;
    })();
    try { return await carregant; } finally { carregant = null; }
  }

  // ---------------- Correccions pròpies (23.11.2026) ----------------
  // Es desen a latdg/sardana/correccions.json i es posen per sobre de les dades
  // de les webs; l'actualització setmanal no les toca.
  const CAMPS = {
    sardanes: [["titol", "Títol"], ["autor", "Autor"], ["tipus", "Tipus"], ["dataEstrena", "Data d'estrena", "data"], ["poblacioEstrena", "Població d'estrena"], ["llocEstrena", "Lloc d'estrena"], ["curts", "Curts", "num"], ["llargs", "Llargs", "num"], ["salts", "Salts", "num"], ["obligada", "Obligada"], ["poblacioRef", "Població referenciada"], ["altres", "Dedicatòria i notes", "llarg"], ["premis", "Premis"], ["autorLletra", "Autor de la lletra"]],
    autors: [["nom", "Nom"], ["naixement", "Naixement", "data"], ["poblacio", "Població de naixement"], ["defuncio", "Defunció", "data"], ["comarca", "Comarca"], ["cobla", "Cobla"], ["rol", "Instrument o paper a la cobla"], ["descripcio", "Descripció", "llarg"]]
  };
  const etiqueta = (col, c) => (CAMPS[col].find(x => x[0] === c) || [c, c])[1];
  const avui = () => new Date().toISOString().slice(0, 10);
  const b64 = t => { const b = new TextEncoder().encode(t); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); };
  const deB64 = t => new TextDecoder().decode(Uint8Array.from(atob(String(t || "").replace(/\s/g, "")), c => c.charCodeAt(0)));
  const URL_CORR = "https://api.github.com/repos/" + REPO + "/contents/correccions.json";

  async function llegeixCorr(token) {
    const r = await fetch(URL_CORR + "?ref=main", { headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }, cache: "no-cache" });
    if (r.status === 404) return { dades: { sardanes: {}, autors: {} }, sha: null };
    if (!r.ok) throw new Error("No s'han pogut llegir les correccions (GitHub " + r.status + ").");
    const j = await r.json();
    let d = {};
    try { d = JSON.parse(deB64(j.content)); } catch (e) { d = {}; }
    return { dades: { sardanes: d.sardanes || {}, autors: d.autors || {} }, sha: j.sha };
  }

  async function desaCorr(missatge, canvi) {
    // canvi(dades) aplica la modificació; si algú ha desat abans (sha antic), es torna a llegir i a aplicar
    for (let intent = 0; intent < 2; intent++) {
      canvi(D.corr);
      const r = await fetch(URL_CORR, { method: "PUT", headers: { Authorization: "Bearer " + D.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
        body: JSON.stringify(Object.assign({ message: missatge, content: b64(JSON.stringify(D.corr, null, 1) + "\n"), branch: "main" }, D.corrSha ? { sha: D.corrSha } : {})) });
      if (r.ok) { D.corrSha = (await r.json()).content.sha; return; }
      if ((r.status === 409 || r.status === 422) && intent === 0) { const c = await llegeixCorr(D.token); D.corr = c.dades; D.corrSha = c.sha; continue; }
      if (r.status === 403 || r.status === 404) throw new Error("El token no té permís per escriure a latdg/sardana (cal «Contents: Read and write»).");
      throw new Error("No s'ha pogut desar la correcció (GitHub " + r.status + ").");
    }
  }

  function aplicaCorr() {
    ["sardanes", "autors"].forEach(col => {
      const perId = new Map(D[col].map((x, i) => [String(x.id), i]));
      D[col].forEach(x => { if (x._orig) { Object.assign(x, x._orig); delete x._orig; } });
      Object.entries(D.corr[col] || {}).forEach(([id, c]) => {
        const i = perId.get(String(id)); if (i == null || !c || !c.camps) return;
        const x = D[col][i]; x._orig = {};
        Object.entries(c.camps).forEach(([k, v]) => { x._orig[k] = x[k]; x[k] = v; });
      });
    });
    indexa();
  }

  function indexa() {
    D.sardanes.forEach(x => { x._t = norm(x.titol); x._a = norm(x.autor); x._q = norm([x.titol, x.autor, x.poblacioEstrena, x.llocEstrena, x.poblacioRef, x.altres, x.autorLletra, x.premis, x.obligada].join(" ")); });
    D.autors.forEach(x => { x._n = norm(x.nom); x._q = norm([x.nom, x.poblacio, x.descripcio, x.cobla, x.comarca].join(" ")); });
    D.perAutor = new Map();
    D.sardanes.forEach((x, i) => { if (!x._a) return; if (!D.perAutor.has(x._a)) D.perAutor.set(x._a, []); D.perAutor.get(x._a).push(i); });
    D.autorPerNom = new Map();
    D.autors.forEach((x, i) => { if (x._n && !D.autorPerNom.has(x._n)) D.autorPerNom.set(x._n, i); });
  }

  // «14.06.1965» -> «1965-06-14»; «06.1965» -> «1965-06-00»; «1965» -> «1965-01-01» (es mostra només l'any)
  function dataIso(t) {
    t = String(t || "").trim();
    let m;
    if ((m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(t))) return m[3] + "-" + m[2].padStart(2, "0") + "-" + m[1].padStart(2, "0");
    if ((m = /^(\d{1,2})[./-](\d{4})$/.exec(t))) return m[2] + "-" + m[1].padStart(2, "0") + "-00";
    if (/^\d{4}$/.test(t)) return t + "-01-01";
    return t;
  }
  const valorForm = (v, tipus) => tipus === "data" ? data(v) : String(v ?? "");
  const valorDesa = (v, tipus) => { v = String(v ?? "").trim(); if (tipus === "data") return v ? dataIso(v) : null; if (tipus === "num") return v === "" ? null : (isFinite(Number(v)) ? Number(v) : v); return v || null; };
  const iguals = (a, b) => String(a ?? "") === String(b ?? "");

  function marcaCorr(col, x) {
    if (!x._orig) return "";
    const c = (D.corr[col] || {})[String(x.id)] || {};
    const det = Object.keys(x._orig).map(k => etiqueta(col, k) + " (abans: " + (valorForm(x._orig[k], (CAMPS[col].find(f => f[0] === k) || [])[2]) || "buit") + ")").join(" · ");
    return '<p class="sa-corr">✎ Corregit per tu' + (c.data ? " el " + esc(data(c.data)) : "") + ": " + esc(det) + (c.nota ? '<br><span>Font: ' + esc(c.nota) + '</span>' : "") + '</p>';
  }

  function formCorr(col, i) {
    const x = D[col][i];
    const c = (D.corr[col] || {})[String(x.id)] || {};
    $("saFitxa").innerHTML = '<div class="sa-fitxa"><h3>✏️ Corregeix: ' + esc(col === "sardanes" ? x.titol : x.nom) + '</h3>' +
      '<p class="sub">Canvia només el que sàpigues que és diferent. Les dates, en format dd.mm.aaaa (o només l\'any).</p>' +
      '<form class="sa-form" id="saForm">' +
      CAMPS[col].map(([k, et, tipus]) => {
        const orig = x._orig && k in x._orig ? x._orig[k] : x[k];
        const v = valorForm(x[k], tipus);
        const ajuda = x._orig && k in x._orig ? ' title="Original: ' + esc(valorForm(orig, tipus) || "buit") + '"' : "";
        return '<label' + ajuda + '><span>' + esc(et) + (x._orig && k in x._orig ? " ✎" : "") + '</span>' +
          (tipus === "llarg" ? '<textarea name="' + k + '" rows="3">' + esc(v) + '</textarea>' : '<input name="' + k + '" value="' + esc(v) + '"' + (tipus === "num" ? ' inputmode="numeric"' : "") + '>') + '</label>';
      }).join("") +
      '<label class="ample"><span>D\'on surt la correcció</span><input name="_nota" value="' + esc(c.nota || "") + '" placeholder="P. ex.: guió de l\'aplec del 2019, partitura, conversa amb l\'autor…"></label>' +
      '<p class="sa-accions"><button type="submit" class="boto">Desa</button><button type="button" class="boto clar" data-cancela>Cancel·la</button>' +
      (x._orig ? '<button type="button" class="boto perill" data-desfes>Torna a les dades originals</button>' : '') + '</p>' +
      '<p class="sa-estat" id="saFormEstat"></p></form></div>';
    const f = $("saForm");
    const torna = () => (col === "sardanes" ? obreSardana(i, true) : obreAutor(i, true));
    f.querySelector("[data-cancela]").addEventListener("click", torna);
    const des = async (missatge, canvi) => {
      f.querySelectorAll("button").forEach(b => { b.disabled = true; });
      $("saFormEstat").textContent = "Desant…";
      try { await desaCorr(missatge, canvi); aplicaCorr(); fitxa = { tipus: col === "sardanes" ? "sardana" : "autor", i }; pinta(); }
      catch (e) { $("saFormEstat").textContent = e.message; $("saFormEstat").className = "sa-estat err"; f.querySelectorAll("button").forEach(b => { b.disabled = false; }); }
    };
    if (x._orig) f.querySelector("[data-desfes]").addEventListener("click", () => des("Desfà la correcció de " + (x.titol || x.nom), d => { delete d[col][String(x.id)]; }));
    f.addEventListener("submit", e => {
      e.preventDefault();
      const camps = {};
      CAMPS[col].forEach(([k, , tipus]) => {
        const orig = x._orig && k in x._orig ? x._orig[k] : x[k];
        const v = valorDesa(f.elements[k].value, tipus);
        if (!iguals(v, orig) && !(tipus === "data" && iguals(data(v), data(orig)))) camps[k] = v;
      });
      const nota = f.elements._nota.value.trim();
      const nom = x.titol || x.nom;
      if (!Object.keys(camps).length) des("Desfà la correcció de " + nom, d => { delete d[col][String(x.id)]; });
      else des("Correcció: " + nom, d => { d[col] = d[col] || {}; d[col][String(x.id)] = { camps, nota, data: avui() }; });
    });
  }

  function pintaCorreccions() {
    const files = [];
    ["sardanes", "autors"].forEach(col => {
      const perId = new Map(D[col].map((x, i) => [String(x.id), i]));
      Object.entries(D.corr[col] || {}).forEach(([id, c]) => { const i = perId.get(id); if (i != null) files.push({ col, i, c, x: D[col][i] }); });
    });
    files.sort((a, b) => String(b.c.data || "").localeCompare(String(a.c.data || "")));
    if (!files.length) { cos().innerHTML = '<p class="buit">Encara no hi has fet cap correcció. A la fitxa de qualsevol sardana o autor hi ha el botó «✏️ Corregeix».</p>'; return; }
    const text = files.map(({ col, c, x }) => {
      const qui = col === "sardanes" ? "Sardana «" + (x._orig && x._orig.titol || x.titol) + "» (" + (x._orig && x._orig.autor || x.autor || "") + "), id " + x.id : "Persona «" + (x._orig && x._orig.nom || x.nom) + "», id " + x.id;
      return qui + ":\n" + Object.entries(c.camps).map(([k, v]) => { const t = (CAMPS[col].find(f => f[0] === k) || [])[2]; return "  - " + etiqueta(col, k) + ": diu «" + (valorForm(x._orig[k], t) || "buit") + "» i hauria de dir «" + (valorForm(v, t) || "buit") + "»"; }).join("\n") + (c.nota ? "\n  Font: " + c.nota : "");
    }).join("\n\n");
    cos().innerHTML = '<p class="sa-compte">' + files.length + (files.length === 1 ? " fitxa corregida" : " fitxes corregides") + '. Les correccions es mantenen encara que les webs actualitzin les dades.</p>' +
      '<p class="sa-accions"><button type="button" class="boto" id="saCopia">📋 Copia-les per enviar-les a les webs</button>' +
      '<a class="boto clar" href="https://boigperlasardana.cat/#coneix-nos/formulari-de-contacte" target="_blank" rel="noopener">Formulari de boig per la sardana</a>' +
      '<a class="boto clar" href="https://somsardana.cat/somsardana/contacte" target="_blank" rel="noopener">Contacte de SomArxiu</a></p>' +
      '<div class="sa-desp"><table class="sa-taula"><thead><tr><th>Fitxa</th><th>Camp</th><th>Abans</th><th>Ara</th><th>Font</th><th>Data</th></tr></thead><tbody>' +
      files.map(({ col, i, c, x }) => Object.entries(c.camps).map(([k, v], n) => { const t = (CAMPS[col].find(f => f[0] === k) || [])[2]; return '<tr' + (n ? '' : ' data-' + (col === "sardanes" ? "s" : "a") + '="' + i + '"') + '><td>' + (n ? '' : esc((col === "sardanes" ? "🎶 " + x.titol : "👤 " + x.nom))) + '</td><td>' + esc(etiqueta(col, k)) + '</td><td>' + esc(valorForm(x._orig[k], t)) + '</td><td>' + esc(valorForm(v, t)) + '</td><td>' + (n ? '' : esc(c.nota || "")) + '</td><td>' + (n ? '' : esc(data(c.data))) + '</td></tr>'; }).join("")).join("") +
      '</tbody></table></div><pre class="sa-text" id="saText">' + esc(text) + '</pre>';
    $("saCopia").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(text); $("saCopia").textContent = "✅ Copiades"; }
      catch (e) { const r = document.createRange(); r.selectNodeContents($("saText")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $("saCopia").textContent = "Text seleccionat: Ctrl+C"; }
    });
  }

  // ---------------- Llibres de l'Aplec 1964-2015 (XAC Premsa) ----------------
  // Text OCR desat a latdg/sardana/dades/xac/text/<any>.txt. La cerca no té en
  // compte espais, accents ni signes, perquè l'OCR sovint espaia les lletres
  // («B i s b a l e n c a») i així també es troba.
  const LLIBRES = {};          // any -> text
  let exemplars = null;        // any -> id del portal
  let llibreAny = "1964";
  const ANYS_LLIBRES = Array.from({ length: 52 }, (_, i) => String(1964 + i));

  async function textRepo(cami) {
    const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + cami + "?ref=main",
      { headers: { Authorization: "Bearer " + D.token, Accept: "application/vnd.github.raw+json" } });
    if (!r.ok) throw new Error("GitHub " + r.status);
    return r.text();
  }
  async function llibre(any_) {
    if (!(any_ in LLIBRES)) LLIBRES[any_] = await textRepo("dades/xac/text/" + any_ + ".txt");
    return LLIBRES[any_];
  }
  async function idsExemplars() {
    if (exemplars) return exemplars;
    exemplars = {};
    try { (await textRepo("dades/xac/exemplars.tsv")).split("\n").forEach(l => { const [a, i] = l.split("\t"); if (a && i) exemplars[a.trim()] = i.trim(); }); } catch (e) {}
    return exemplars;
  }
  // Text esclafat (només lletres i xifres, sense accents) amb la posició original de cada caràcter
  function esclafa(text) {
    let s = "", mapa = [];
    for (let i = 0; i < text.length; i++) {
      const c = text[i].normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (/^[a-z0-9]$/.test(c)) { s += c; mapa.push(i); }
    }
    return { s, mapa };
  }
  function troba(text, q) {
    const k = esclafa(q).s; if (k.length < 3) return [];
    const e = esclafa(text), r = [];
    let p = e.s.indexOf(k);
    while (p >= 0 && r.length < 500) { r.push([e.mapa[p], e.mapa[p + k.length - 1] + 1]); p = e.s.indexOf(k, p + k.length); }
    return r;
  }
  const net = t => t.replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");

  function pintaLlibres() {
    cos().innerHTML =
      '<p class="sa-compte">Llibres de l\'Aplec de la Sardana de la Bisbal del 1964 al 2015, a XAC Premsa (Arxiu Comarcal del Baix Empordà). Text llegit per OCR: pot tenir errors; per a la imatge original, obre el llibre a XAC Premsa. Del 2012 al 2015 no hi ha text, i el del 2011 és parcial.</p>' +
      '<div class="sa-filtres"><input type="search" id="llQ" placeholder="Cerca a tots els llibres: sardana, autor, cobla, persona…" autocomplete="off"><button type="button" class="boto" id="llCerca">Cerca</button></div>' +
      '<div id="llRes"></div>' +
      '<div class="sa-filtres"><label>Llibre de l\'any <select id="llAny">' + ANYS_LLIBRES.map(a => '<option' + (a === llibreAny ? " selected" : "") + '>' + a + '</option>').join("") + '</select></label>' +
      '<input type="search" id="llDins" class="curt" placeholder="Cerca dins d\'aquest llibre" autocomplete="off"><span class="sa-compte" id="llCompte"></span><a class="boto clar" id="llXac" target="_blank" rel="noopener">Obre\'l a XAC Premsa</a></div>' +
      '<pre class="sa-text sa-llibre" id="llText">Carregant…</pre>';
    $("llAny").addEventListener("change", () => { llibreAny = $("llAny").value; mostraLlibre(); });
    $("llDins").addEventListener("input", retarda(() => mostraLlibre(true)));
    $("llCerca").addEventListener("click", cercaLlibres);
    $("llQ").addEventListener("keydown", e => { if (e.key === "Enter") cercaLlibres(); });
    $("llRes").addEventListener("click", e => {
      const b = e.target.closest("[data-any]"); if (!b) return;
      llibreAny = b.dataset.any; $("llAny").value = llibreAny; $("llDins").value = $("llQ").value; mostraLlibre(true);
    });
    mostraLlibre();
  }

  async function mostraLlibre(desplaca) {
    const any_ = llibreAny, pre = $("llText");
    const ids = await idsExemplars();
    $("llXac").href = "https://xacpremsa.cultura.gencat.cat/pandora/viewer.vm?id=" + encodeURIComponent(ids[any_] || "") + "&lang=ca&view=premsa_baix_emporda";
    $("llXac").hidden = !ids[any_];
    let text;
    try { text = net(await llibre(any_)); } catch (e) { pre.textContent = "No s'ha pogut llegir el llibre (" + e.message + ")."; return; }
    if (any_ !== llibreAny) return;
    const q = $("llDins").value.trim(), m = q ? troba(text, q) : [];
    $("llCompte").textContent = q ? (m.length + (m.length === 1 ? " coincidència" : " coincidències")) : "";
    if (!m.length) { pre.textContent = text.replace(/^\s+|\s+$/g, "") || "Aquest llibre no té text."; return; }
    let h = "", p = 0;
    m.forEach(([a, b]) => { h += esc(text.slice(p, a)) + "<mark>" + esc(text.slice(a, b)) + "</mark>"; p = b; });
    pre.innerHTML = h + esc(text.slice(p));
    if (desplaca) { const mk = pre.querySelector("mark"); if (mk) mk.scrollIntoView({ behavior: "smooth", block: "center" }); }
  }

  async function cercaLlibres() {
    const q = $("llQ").value.trim(), res = $("llRes");
    if (esclafa(q).s.length < 3) { res.innerHTML = '<p class="buit">Escriu almenys tres lletres.</p>'; return; }
    res.innerHTML = '<p class="sa-compte">Cercant…</p>';
    const files = [];
    for (let i = 0; i < ANYS_LLIBRES.length; i += 8) {
      const lot = ANYS_LLIBRES.slice(i, i + 8);
      const textos = await Promise.all(lot.map(a => llibre(a).then(t => net(t)).catch(() => "")));
      lot.forEach((a, k) => {
        const m = troba(textos[k], q);
        m.slice(0, 6).forEach(([x, y]) => files.push({ a, abans: textos[k].slice(Math.max(0, x - 90), x), mot: textos[k].slice(x, y), despres: textos[k].slice(y, y + 90), n: m.length }));
      });
      res.innerHTML = '<p class="sa-compte">Cercant… ' + Math.min(i + 8, ANYS_LLIBRES.length) + ' de ' + ANYS_LLIBRES.length + ' llibres</p>';
    }
    const anys = [...new Set(files.map(f => f.a))];
    res.innerHTML = !files.length ? '<p class="buit">No surt a cap llibre.</p>' :
      '<p class="sa-compte">Surt en ' + anys.length + (anys.length === 1 ? ' llibre' : ' llibres') + ': ' + anys.join(", ") + '. Toca una línia per obrir el llibre.</p>' +
      '<div class="sa-desp"><table class="sa-taula"><tbody>' + files.map(f => '<tr data-any="' + f.a + '" style="cursor:pointer"><td><b>' + f.a + '</b></td><td>…' + esc(f.abans.replace(/\s+/g, " ")) + '<mark>' + esc(f.mot) + '</mark>' + esc(f.despres.replace(/\s+/g, " ")) + '…</td></tr>').join("") + '</tbody></table></div>';
  }

  // ---------------- Pintat ----------------
  const cos = () => $("saCos");
  function estat(text, err) { const e = $("saEstat"); e.textContent = text; e.className = "sa-estat" + (err ? " err" : ""); }

  function pinta() {
    document.querySelectorAll("#saPest button").forEach(b => b.classList.toggle("actiu", b.dataset.t === pest));
    if (pest === "sardanes") pintaSardanes();
    else if (pest === "autors") pintaAutors();
    else if (pest === "correccions") pintaCorreccions();
    else if (pest === "llibres") pintaLlibres();
    else pintaAplecs();
  }

  // Sardanes
  function pintaSardanes() {
    cos().innerHTML =
      '<div class="sa-filtres">' +
      '<input type="search" id="saQ" placeholder="Títol, autor, lloc d\'estrena… (paraules en qualsevol ordre)" autocomplete="off">' +
      '<input type="search" id="saPob" class="curt" placeholder="Població d\'estrena" autocomplete="off">' +
      '<input type="search" id="saAny" class="curt" placeholder="Anys (p. ex. 1950-1960)" autocomplete="off">' +
      '<label title="Sardanes amb les particel·les en PDF per descarregar"><input type="checkbox" id="saPdf"> Amb particel·les en PDF</label>' +
      '<select id="saOrd"><option value="titol">Per títol</option><option value="data">Més recents</option><option value="antigues">Més antigues</option><option value="interp">Més interpretades</option><option value="grav">Més enregistrades</option></select>' +
      '</div><div id="saFitxa"></div><p class="sa-compte" id="saCompte"></p><div class="sa-desp" id="saRes"></div>';
    ["saQ", "saPob", "saAny"].forEach(id => $(id).addEventListener("input", retarda(llistaSardanes)));
    $("saOrd").addEventListener("change", llistaSardanes);
    $("saPdf").addEventListener("change", llistaSardanes);
    $("saRes").addEventListener("click", e => { const tr = e.target.closest("tr[data-i]"); if (tr) obreSardana(+tr.dataset.i); });
    llistaSardanes();
    if (fitxa && fitxa.tipus === "sardana") obreSardana(fitxa.i, true);
  }

  function rangAnys(t) {
    const m = /^\s*(\d{4})\s*(?:-|–|a)?\s*(\d{4})?\s*$/.exec(t || "");
    if (!m) return null;
    return [m[1], m[2] || m[1]];
  }

  function llistaSardanes() {
    const q = norm($("saQ").value).split(/\s+/).filter(Boolean);
    const pob = norm($("saPob").value.trim());
    const anys = rangAnys($("saAny").value);
    const ord = $("saOrd").value;
    const nomesPdf = $("saPdf").checked;
    let r = [];
    D.sardanes.forEach((x, i) => {
      if (q.length && !q.every(p => x._q.includes(p))) return;
      if (nomesPdf && !cert(x.pdf)) return;
      if (pob && !norm(x.poblacioEstrena).includes(pob)) return;
      if (anys) { const a = any(x.dataEstrena); if (!a || a < anys[0] || a > anys[1]) return; }
      r.push(i);
    });
    const S = D.sardanes;
    const perData = (a, b) => String(S[a].dataEstrena || "").localeCompare(String(S[b].dataEstrena || ""));
    if (ord === "titol") r.sort((a, b) => S[a]._t.localeCompare(S[b]._t, "ca"));
    else if (ord === "data") r = r.filter(i => any(S[i].dataEstrena)).sort((a, b) => perData(b, a));
    else if (ord === "antigues") r = r.filter(i => any(S[i].dataEstrena)).sort(perData);
    else if (ord === "interp") r.sort((a, b) => num(S[b].interpretacions) - num(S[a].interpretacions));
    else r.sort((a, b) => num(S[b].gravacions) - num(S[a].gravacions));
    $("saCompte").textContent = r.length.toLocaleString("ca") + (r.length === 1 ? " sardana" : " sardanes") + (r.length > MAX ? " (en mostro " + MAX + "; afina la cerca)" : "");
    $("saRes").innerHTML = taulaSardanes(r.slice(0, MAX));
  }

  function taulaSardanes(idx) {
    if (!idx.length) return '<p class="buit">Cap sardana.</p>';
    return '<table class="sa-taula"><thead><tr><th>Títol</th><th>Autor</th><th>Estrena</th><th>Població</th><th title="Interpretacions">Interp.</th><th title="Enregistraments">Enreg.</th></tr></thead><tbody>' +
      idx.map(i => { const x = D.sardanes[i]; return '<tr data-i="' + i + '"><td>' + esc(x.titol) + (cert(x.pdf) ? ' <span title="Particel·les en PDF">📄</span>' : '') + '</td><td>' + esc(x.autor) + '</td><td>' + esc(data(x.dataEstrena)) + '</td><td>' + esc(x.poblacioEstrena) + '</td><td class="n">' + esc(num(x.interpretacions) || "") + '</td><td class="n">' + esc(num(x.gravacions) || "") + '</td></tr>'; }).join("") +
      '</tbody></table>';
  }

  function dl(parells) {
    const p = parells.filter(([, v]) => v !== "" && v != null && v !== 0 && v !== "0");
    return p.length ? "<dl>" + p.map(([k, v]) => "<dt>" + esc(k) + "</dt><dd>" + v + "</dd>").join("") + "</dl>" : "";
  }

  function obreSardana(i, sensScroll) {
    const x = D.sardanes[i]; if (!x) return;
    fitxa = { tipus: "sardana", i };
    const ai = D.autorPerNom.get(x._a);
    const autor = ai != null ? '<button type="button" class="sa-enllac" data-autor="' + ai + '">' + esc(x.autor) + '</button>' : esc(x.autor);
    const mateixAutor = (D.perAutor.get(x._a) || []).length;
    $("saFitxa").innerHTML = '<div class="sa-fitxa"><button type="button" class="boto clar tanca" data-tanca>✕</button>' +
      '<h3>' + esc(x.titol) + '</h3><p class="sub">' + autor + (mateixAutor > 1 ? ' · ' + mateixAutor + ' obres seves a la base de dades' : '') + '</p>' + marcaCorr("sardanes", x) +
      dl([
        ["Tipus", esc(x.tipus)],
        ["Estrena", esc([data(x.dataEstrena), x.poblacioEstrena, x.llocEstrena].filter(Boolean).join(" · "))],
        ["Tirades", (x.curts || x.llargs) ? esc((x.curts || "?") + " curts · " + (x.llargs || "?") + " llargs" + (x.salts ? " · " + x.salts + " salts" : "")) : ""],
        ["Obligada", esc(x.obligada)],
        ["Població referenciada", esc(x.poblacioRef)],
        ["Dedicatòria i notes", esc(x.altres)],
        ["Premis", esc(x.premis)],
        ["Lletra", cert(x.lletra) ? esc("Sí" + (x.autorLletra ? " · " + x.autorLletra : "")) : esc(x.autorLletra)],
        ["Interpretacions", esc(num(x.interpretacions) || "")],
        ["Enregistraments", esc(num(x.gravacions) || "")],
        ["Particel·les", esc(num(x.particeles) ? "En paper a " + num(x.particeles) + (num(x.particeles) === 1 ? " arxiu" : " arxius") : "")]
      ]) +
      '<p class="sa-accions">' +
      (cert(x.pdf) ? '<a class="boto" href="https://cdn.sardamania.cat/particeles/' + encodeURIComponent(x.id) + '.zip" target="_blank" rel="noopener">📄 Descarrega les particel·les (PDF en .zip)</a>' : '') +
      '<button type="button" class="boto clar" data-corregeix="sardanes" data-i="' + i + '">✏️ Corregeix</button>' +
      '<a class="boto clar" href="https://boigperlasardana.cat/sardanes?Titol=' + encodeURIComponent(x.titol || "") + '" target="_blank" rel="noopener" title="Hi ha els arxius que tenen les particel·les (amb el contacte per demanar-les), la lletra i l\'àudio">Obre-la a boig per la sardana</a>' +
      '</p>' +
      (num(x.particeles) && !cert(x.pdf) ? '<p class="sub" style="margin:6px 0 0">Les particel·les no són en PDF: a boig per la sardana, «Veure arxius de particel·les» diu quins arxius i cobles les tenen i com demanar-les.</p>' : '') +
      '</div>';
    if (!sensScroll) $("saFitxa").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Autors
  function obresDe(ai) { const a = D.autors[ai]; return a ? (D.perAutor.get(a._n) || []) : []; }

  function pintaAutors() {
    cos().innerHTML =
      '<div class="sa-filtres">' +
      '<input type="search" id="auQ" placeholder="Nom, població, cobla… (paraules en qualsevol ordre)" autocomplete="off">' +
      '<label><input type="checkbox" id="auComp" checked> Només compositors</label>' +
      '<select id="auOrd"><option value="nom">Per nom</option><option value="obres">Més obres</option><option value="naix">Per naixement</option></select>' +
      '</div><div id="saFitxa"></div><p class="sa-compte" id="saCompte"></p><div class="sa-desp" id="saRes"></div>';
    $("auQ").addEventListener("input", retarda(llistaAutors));
    $("auComp").addEventListener("change", llistaAutors);
    $("auOrd").addEventListener("change", llistaAutors);
    $("saRes").addEventListener("click", e => { const tr = e.target.closest("tr[data-i]"); if (tr) obreAutor(+tr.dataset.i); });
    llistaAutors();
    if (fitxa && fitxa.tipus === "autor") obreAutor(fitxa.i, true);
  }

  function llistaAutors() {
    const q = norm($("auQ").value).split(/\s+/).filter(Boolean);
    const comp = $("auComp").checked;
    const ord = $("auOrd").value;
    const r = [];
    D.autors.forEach((x, i) => {
      if (comp && !cert(x.compositor) && !obresDe(i).length) return;
      if (q.length && !q.every(p => x._q.includes(p))) return;
      r.push(i);
    });
    const A = D.autors;
    if (ord === "nom") r.sort((a, b) => A[a]._n.localeCompare(A[b]._n, "ca"));
    else if (ord === "obres") r.sort((a, b) => obresDe(b).length - obresDe(a).length);
    else r.sort((a, b) => String(any(A[a].naixement) || "9999").localeCompare(String(any(A[b].naixement) || "9999")));
    $("saCompte").textContent = r.length.toLocaleString("ca") + (r.length === 1 ? " persona" : " persones") + (r.length > MAX ? " (en mostro " + MAX + "; afina la cerca)" : "");
    $("saRes").innerHTML = !r.length ? '<p class="buit">Cap persona.</p>' :
      '<table class="sa-taula"><thead><tr><th>Nom</th><th>Naixement</th><th>Defunció</th><th>Població</th><th>Obres</th></tr></thead><tbody>' +
      r.slice(0, MAX).map(i => { const x = A[i]; return '<tr data-i="' + i + '"><td>' + esc(x.nom) + '</td><td>' + esc(data(x.naixement)) + '</td><td>' + esc(data(x.defuncio)) + '</td><td>' + esc(x.poblacio) + '</td><td class="n">' + (obresDe(i).length || "") + '</td></tr>'; }).join("") +
      '</tbody></table>';
  }

  function obreAutor(ai, sensScroll) {
    const x = D.autors[ai]; if (!x) return;
    fitxa = { tipus: "autor", i: ai };
    const obres = obresDe(ai).slice().sort((a, b) => String(D.sardanes[a].dataEstrena || "9999").localeCompare(String(D.sardanes[b].dataEstrena || "9999")));
    const rols = [cert(x.compositor) && "compositor", cert(x.lletrista) && "lletrista", cert(x.llibres) && "autor de llibres", cert(x.instrumentista) && "instrumentista"].filter(Boolean).join(", ");
    const interp = obres.reduce((s, i) => s + num(D.sardanes[i].interpretacions), 0);
    $("saFitxa").innerHTML = '<div class="sa-fitxa"><button type="button" class="boto clar tanca" data-tanca>✕</button>' +
      '<h3>' + esc(x.nom) + '</h3><p class="sub">' + esc([rols, x.comarca].filter(Boolean).join(" · ")) + '</p>' + marcaCorr("autors", x) +
      dl([
        ["Naixement", esc([data(x.naixement), x.poblacio].filter(Boolean).join(" · "))],
        ["Defunció", esc(data(x.defuncio))],
        ["Cobla", esc([x.cobla, x.rol].filter(Boolean).join(" · "))],
        ["Descripció", esc(x.descripcio)],
        ["Obres", esc(obres.length ? obres.length + (interp ? " · " + interp.toLocaleString("ca") + " interpretacions en total" : "") : "")]
      ]) +
      '<p class="sa-accions"><button type="button" class="boto clar" data-corregeix="autors" data-i="' + ai + '">✏️ Corregeix</button></p>' +
      (obres.length ? '<div class="sa-desp" style="margin-top:8px">' + taulaSardanes(obres).replace(/<tr data-i="/g, '<tr data-s="') + '</div>' : '') +
      '</div>';
    if (!sensScroll) $("saFitxa").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Aplecs de la Bisbal (SomArxiu)
  // Línies del programa de SomArxiu que no són una sardana amb títol:
  // «- Tarda», «- Matí», «- Programa lliure» (autor «.») són apartats del programa;
  // «- Lluïment», «- Estrena» (autor «?») són obres que s'hi van tocar sense títol registrat.
  const tipusLinia = i => {
    const t = nomDe(i.sardana).trim(), a = nomDe(i.autorSardana).trim();
    if (a === "?" || (/^-/.test(t) && a === "")) return "sense";
    if (/^-/.test(t) || a.replace(/\./g, "") === "") return "apartat";
    return null;
  };
  const nomLinia = i => {
    const t = nomDe(i.sardana).replace(/^[-\s]+/, "").trim(), n = norm(t);
    if (n === "lluiment" || n === "obligada") return "Obra de lluïment (obligada), títol no registrat";
    if (n === "estrena") return "Estrena, títol no registrat";
    return t + " (títol no registrat)";
  };
  function pintaAplecs() {
    const ap = D.aplecs;
    if (!ap.length) { cos().innerHTML = '<p class="buit">Encara no hi ha l\'històric dels aplecs (es genera amb l\'actualització setmanal).</p>'; return; }
    const sard = new Map(), aut = new Map(), cob = new Map();
    const suma = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
    ap.forEach(a => {
      (a.cobles || []).forEach(c => suma(cob, nomDe(c)));
      (a.interpretacions || []).forEach(i => { if (tipusLinia(i)) return; suma(sard, nomDe(i.sardana) + " — " + nomDe(i.autorSardana)); suma(aut, nomDe(i.autorSardana)); });
    });
    const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    const llista = (t, m, n) => '<div><h4>' + t + '</h4><table class="sa-taula"><tbody>' + top(m, n).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td class="n">' + v + '</td></tr>').join("") + '</tbody></table></div>';
    const ambProg = ap.filter(a => (a.interpretacions || []).length).length;
    cos().innerHTML =
      '<p class="sa-compte">' + ap.length + (ap.length === 1 ? ' aplec' : ' aplecs') + (ap.length === 1 ? ' a la Bisbal d\'Empordà registrat a SomArxiu, ' : ' a la Bisbal d\'Empordà registrats a SomArxiu, ') + ambProg + ' amb el programa.</p>' +
      (sard.size || cob.size ? '<div class="sa-graella">' + (sard.size ? llista("Sardanes més tocades", sard, 20) + llista("Autors més tocats", aut, 15) : "") + (cob.size ? llista("Cobles que hi han tocat més", cob, 15) : "") + '</div>' : '') +
      '<h4 style="margin:14px 0 4px">Aplec per aplec</h4>' +
      ap.map(a => {
        const ints = a.interpretacions || [];
        const nSard = ints.filter(i => tipusLinia(i) !== "apartat").length;
        return '<details class="sa-aplec"><summary><b>' + esc(data(a.dia)) + '</b> · ' + esc(a.titol) + (a.anulada ? ' · <i>anul·lat</i>' : '') + (nSard ? ' · ' + nSard + (nSard === 1 ? ' sardana' : ' sardanes') : '') + '</summary><div>' +
          dl([["Lloc", esc(a.lloc)], ["Cobles", esc(nomDe(a.cobles))], ["Descripció", esc(a.descripcio)]]) +
          (ints.length ? '<div class="sa-desp" style="margin-top:6px"><table class="sa-taula"><thead><tr><th>Sardana</th><th>Autor</th><th>Cobla</th><th>Notes</th></tr></thead><tbody>' +
            ints.map(i => tipusLinia(i) === "apartat" ? '<tr><td colspan="4"><b>' + esc(nomDe(i.sardana).replace(/^[-\s]+/, "")) + '</b></td></tr>' : tipusLinia(i) === "sense" ? '<tr><td colspan="2"><i>' + esc(nomLinia(i)) + '</i></td><td>' + esc(nomDe(i.cobla)) + '</td><td></td></tr>' : '<tr><td>' + esc(nomDe(i.sardana)) + '</td><td>' + esc(nomDe(i.autorSardana)) + '</td><td>' + esc(nomDe(i.cobla)) + '</td><td>' + esc([i.estrenaSardana ? "Estrenada: " + data(i.estrenaSardana) : "", i.altres].filter(x => x && String(x).trim()).join(" · ")) + '</td></tr>').join("") +
            '</tbody></table></div>' : '<p class="buit">Programa no disponible a SomArxiu.</p>') +
          '<p class="sa-accions">' + (a.programaArxiu ? '<button type="button" class="boto" data-programa="' + esc(a.programaArxiu) + '">📄 Programa oficial (PDF)</button>' : '') +
          '<a class="boto clar" href="https://somarxiu.cat/dades/activitats/' + encodeURIComponent(a.id) + '" target="_blank" rel="noopener">Fitxa a SomArxiu</a></p></div></details>';
      }).join("");
  }

  // Programa oficial d'un aplec: còpia pròpia del PDF al repo privat (no depèn de SomArxiu)
  async function obrePrograma(boto) {
    const w = window.open("", "_blank");
    const text = boto.textContent;
    boto.disabled = true; boto.textContent = "Obrint…";
    try {
      const r = await fetch("https://api.github.com/repos/" + REPO + "/contents/" + boto.dataset.programa.split("/").map(encodeURIComponent).join("/") + "?ref=main",
        { headers: { Authorization: "Bearer " + D.token, Accept: "application/vnd.github.raw+json" } });
      if (!r.ok) throw new Error("GitHub " + r.status);
      const url = URL.createObjectURL(new Blob([await r.arrayBuffer()], { type: "application/pdf" }));
      if (w) w.location.href = url; else location.href = url;
    } catch (e) {
      if (w) w.close();
      alert("No s'ha pogut obrir el programa (" + e.message + ").");
    } finally { boto.disabled = false; boto.textContent = text; }
  }

  // ---------------- Utilitats i esdeveniments ----------------
  const ambArticle = d => (/^(01|11)\./.test(d) ? "l'" : "el ") + d;
  function retarda(f) { let t; return () => { clearTimeout(t); t = setTimeout(f, 180); }; }

  $("saPest").addEventListener("click", e => {
    const b = e.target.closest("button[data-t]"); if (!b || !D) return;
    pest = b.dataset.t; fitxa = null; pinta();
  });
  $("sardanes").addEventListener("click", e => {
    if (!D) return;
    if (e.target.closest("[data-tanca]")) { fitxa = null; $("saFitxa").innerHTML = ""; return; }
    const pr = e.target.closest("[data-programa]");
    if (pr) { obrePrograma(pr); return; }
    const co = e.target.closest("[data-corregeix]");
    if (co) { formCorr(co.dataset.corregeix, +co.dataset.i); return; }
    const ra = e.target.closest("tr[data-a]");
    if (ra) { pest = "autors"; fitxa = { tipus: "autor", i: +ra.dataset.a }; pinta(); $("saFitxa").scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
    const au = e.target.closest("[data-autor]");
    if (au) { pest = "autors"; fitxa = { tipus: "autor", i: +au.dataset.autor }; pinta(); $("saFitxa").scrollIntoView({ behavior: "smooth", block: "nearest" }); return; }
    const s = e.target.closest("tr[data-s]");
    if (s) { pest = "sardanes"; fitxa = { tipus: "sardana", i: +s.dataset.s }; pinta(); $("saFitxa").scrollIntoView({ behavior: "smooth", block: "nearest" }); }
  });

  async function obre() {
    if (D) { pinta(); return; }
    estat("Carregant la base de dades…");
    cos().innerHTML = "";
    try {
      await carrega();
      const t = D.meta.taules || {};
      estat((t.sardanes || D.sardanes.length).toLocaleString("ca") + " sardanes i " + (t.autors || D.autors.length).toLocaleString("ca") + " persones · dades de boigperlasardana.cat i SomArxiu, actualitzades " + ambArticle(data(D.meta.actualitzat)));
      pinta();
    } catch (e) {
      estat(e.message || String(e), true);
    }
  }

  $("saBoto").addEventListener("click", () => {
    const obrir = $("sardanes").hidden;
    $("sardanes").hidden = !obrir;
    $("saBoto").setAttribute("aria-expanded", obrir ? "true" : "false");
    $("saBoto").title = obrir ? "Tanca les sardanes" : "Obre les sardanes";
    if (obrir) obre();
  });

  // Per a les proves
  window.__Sardanes = { carrega, data, norm, rangAnys, reinicia: () => { D = null; } };
})();
