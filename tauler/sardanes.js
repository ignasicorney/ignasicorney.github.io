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
  const data = v => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || "")); return m ? (m[1] === "0000" ? "" : (m[3] === "00" ? (m[2] === "00" ? m[1] : m[2] + "." + m[1]) : m[3] + "." + m[2] + "." + m[1])) : String(v ?? ""); };
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
      const sardanes = files(s), autors = files(a);
      sardanes.forEach(x => { x._t = norm(x.titol); x._a = norm(x.autor); x._q = norm([x.titol, x.autor, x.poblacioEstrena, x.llocEstrena, x.poblacioRef, x.altres, x.autorLletra, x.premis, x.obligada].join(" ")); });
      autors.forEach(x => { x._n = norm(x.nom); x._q = norm([x.nom, x.poblacio, x.descripcio, x.cobla, x.comarca].join(" ")); });
      const perAutor = new Map();
      sardanes.forEach((x, i) => { if (!x._a) return; if (!perAutor.has(x._a)) perAutor.set(x._a, []); perAutor.get(x._a).push(i); });
      const autorPerNom = new Map();
      autors.forEach((x, i) => { if (x._n && !autorPerNom.has(x._n)) autorPerNom.set(x._n, i); });
      D = { meta, sardanes, autors, aplecs: Array.isArray(ap) ? ap : [], perAutor, autorPerNom };
      return D;
    })();
    try { return await carregant; } finally { carregant = null; }
  }

  // ---------------- Pintat ----------------
  const cos = () => $("saCos");
  function estat(text, err) { const e = $("saEstat"); e.textContent = text; e.className = "sa-estat" + (err ? " err" : ""); }

  function pinta() {
    document.querySelectorAll("#saPest button").forEach(b => b.classList.toggle("actiu", b.dataset.t === pest));
    if (pest === "sardanes") pintaSardanes();
    else if (pest === "autors") pintaAutors();
    else pintaAplecs();
  }

  // Sardanes
  function pintaSardanes() {
    cos().innerHTML =
      '<div class="sa-filtres">' +
      '<input type="search" id="saQ" placeholder="Títol, autor, lloc d\'estrena… (paraules en qualsevol ordre)" autocomplete="off">' +
      '<input type="search" id="saPob" class="curt" placeholder="Població d\'estrena" autocomplete="off">' +
      '<input type="search" id="saAny" class="curt" placeholder="Anys (p. ex. 1950-1960)" autocomplete="off">' +
      '<select id="saOrd"><option value="titol">Per títol</option><option value="data">Més recents</option><option value="antigues">Més antigues</option><option value="interp">Més interpretades</option><option value="grav">Més enregistrades</option></select>' +
      '</div><div id="saFitxa"></div><p class="sa-compte" id="saCompte"></p><div class="sa-desp" id="saRes"></div>';
    ["saQ", "saPob", "saAny"].forEach(id => $(id).addEventListener("input", retarda(llistaSardanes)));
    $("saOrd").addEventListener("change", llistaSardanes);
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
    let r = [];
    D.sardanes.forEach((x, i) => {
      if (q.length && !q.every(p => x._q.includes(p))) return;
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
      idx.map(i => { const x = D.sardanes[i]; return '<tr data-i="' + i + '"><td>' + esc(x.titol) + '</td><td>' + esc(x.autor) + '</td><td>' + esc(data(x.dataEstrena)) + '</td><td>' + esc(x.poblacioEstrena) + '</td><td class="n">' + esc(num(x.interpretacions) || "") + '</td><td class="n">' + esc(num(x.gravacions) || "") + '</td></tr>'; }).join("") +
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
      '<h3>' + esc(x.titol) + '</h3><p class="sub">' + autor + (mateixAutor > 1 ? ' · ' + mateixAutor + ' obres seves a la base de dades' : '') + '</p>' +
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
        ["Particel·les", esc(num(x.particeles) || "")]
      ]) + '</div>';
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
      '<h3>' + esc(x.nom) + '</h3><p class="sub">' + esc([rols, x.comarca].filter(Boolean).join(" · ")) + '</p>' +
      dl([
        ["Naixement", esc([data(x.naixement), x.poblacio].filter(Boolean).join(" · "))],
        ["Defunció", esc(data(x.defuncio))],
        ["Cobla", esc([x.cobla, x.rol].filter(Boolean).join(" · "))],
        ["Descripció", esc(x.descripcio)],
        ["Obres", esc(obres.length ? obres.length + (interp ? " · " + interp.toLocaleString("ca") + " interpretacions en total" : "") : "")]
      ]) +
      (obres.length ? '<div class="sa-desp" style="margin-top:8px">' + taulaSardanes(obres).replace(/<tr data-i="/g, '<tr data-s="') + '</div>' : '') +
      '</div>';
    if (!sensScroll) $("saFitxa").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Aplecs de la Bisbal (SomArxiu)
  function pintaAplecs() {
    const ap = D.aplecs;
    if (!ap.length) { cos().innerHTML = '<p class="buit">Encara no hi ha l\'històric dels aplecs (es genera amb l\'actualització setmanal).</p>'; return; }
    const sard = new Map(), aut = new Map(), cob = new Map();
    const suma = (m, k) => { if (k) m.set(k, (m.get(k) || 0) + 1); };
    ap.forEach(a => {
      (a.cobles || []).forEach(c => suma(cob, nomDe(c)));
      (a.interpretacions || []).forEach(i => { suma(sard, nomDe(i.sardana) + " — " + nomDe(i.autorSardana)); suma(aut, nomDe(i.autorSardana)); });
    });
    const top = (m, n) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
    const llista = (t, m, n) => '<div><h4>' + t + '</h4><table class="sa-taula"><tbody>' + top(m, n).map(([k, v]) => '<tr><td>' + esc(k) + '</td><td class="n">' + v + '</td></tr>').join("") + '</tbody></table></div>';
    const ambProg = ap.filter(a => (a.interpretacions || []).length).length;
    cos().innerHTML =
      '<p class="sa-compte">' + ap.length + (ap.length === 1 ? ' aplec' : ' aplecs') + ' a la Bisbal d\'Empordà registrats a SomArxiu, ' + ambProg + ' amb el programa.</p>' +
      (sard.size || cob.size ? '<div class="sa-graella">' + (sard.size ? llista("Sardanes més tocades", sard, 20) + llista("Autors més tocats", aut, 15) : "") + (cob.size ? llista("Cobles que hi han tocat més", cob, 15) : "") + '</div>' : '') +
      '<h4 style="margin:14px 0 4px">Aplec per aplec</h4>' +
      ap.map(a => {
        const ints = a.interpretacions || [];
        return '<details class="sa-aplec"><summary><b>' + esc(data(a.dia)) + '</b> · ' + esc(a.titol) + (a.anulada ? ' · <i>anul·lat</i>' : '') + (ints.length ? ' · ' + ints.length + ' sardanes' : '') + '</summary><div>' +
          dl([["Lloc", esc(a.lloc)], ["Cobles", esc(nomDe(a.cobles))], ["Descripció", esc(a.descripcio)]]) +
          (ints.length ? '<div class="sa-desp" style="margin-top:6px"><table class="sa-taula"><thead><tr><th>Sardana</th><th>Autor</th><th>Cobla</th><th>Notes</th></tr></thead><tbody>' +
            ints.map(i => '<tr><td>' + esc(nomDe(i.sardana)) + '</td><td>' + esc(nomDe(i.autorSardana)) + '</td><td>' + esc(nomDe(i.cobla)) + '</td><td>' + esc([i.estrenaSardana, i.altres].filter(Boolean).join(" ")) + '</td></tr>').join("") +
            '</tbody></table></div>' : '<p class="buit">Programa no disponible a SomArxiu.</p>') +
          '<p><a href="https://somarxiu.cat/dades/activitats/' + encodeURIComponent(a.id) + '" target="_blank" rel="noopener">Fitxa a SomArxiu</a></p></div></details>';
      }).join("");
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
