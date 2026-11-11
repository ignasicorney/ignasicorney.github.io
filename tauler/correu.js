// =============================================================================
// GESTOR DE CORREU — 10.11.2026
// Llegeix, arxiva, esborra, envia i programa correus d'un o més comptes de
// Google a través de l'Apps Script «Correu del tauler» de cada compte.
//
//   Correu.munta(element, {
//     comptes: () => [{ nom, url }],         // on és l'Apps Script de cada compte
//     desaComptes: llista => {},             // es crida quan es canvien a ⚙️
//     clau: () => "…",                       // la clau (PIN) de les peticions
//     tasca: ({ text, enllac }) => {}        // opcional: botó «+ Tasca»
//   });
// =============================================================================
(function () {
  "use strict";
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const z = n => String(n).padStart(2, "0");
  const dataCurta = iso => {
    const d = new Date(iso); if (isNaN(d)) return "";
    const avui = new Date();
    if (d.toDateString() === avui.toDateString()) return z(d.getHours()) + ":" + z(d.getMinutes());
    return z(d.getDate()) + "." + z(d.getMonth() + 1) + "." + d.getFullYear();
  };
  const dataLlarga = iso => { const d = new Date(iso); return isNaN(d) ? "" : z(d.getDate()) + "." + z(d.getMonth() + 1) + "." + d.getFullYear() + " · " + z(d.getHours()) + ":" + z(d.getMinutes()); };
  const nomDe = de => { const m = String(de || "").match(/^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/); return m ? m[1] : String(de || ""); };
  const adrecaDe = de => { const m = String(de || "").match(/<([^>]+)>/); return m ? m[1] : String(de || "").trim(); };
  const enllaca = t => esc(t).replace(/(https?:\/\/[^\s<>"']+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // --- Adjunts i signatura (12.11.2026) ---
  const MAMMOTH = "https://cdn.jsdelivr.net/npm/mammoth@1.8.0/mammoth.browser.min.js";
  const SHEETJS = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
  const mida = n => { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " kB"; };
  function classe(nom, tipus) {
    const e = ((String(nom || "").match(/\.([a-z0-9]+)$/i) || [])[1] || "").toLowerCase(), t = String(tipus || "").toLowerCase();
    if (t.indexOf("image/") === 0 || /^(png|jpe?g|gif|webp|bmp|svg)$/.test(e)) return "imatge";
    if (t === "application/pdf" || e === "pdf") return "pdf";
    if (e === "docx" || t.indexOf("wordprocessingml") >= 0) return "docx";
    if (/^(xlsx|xls|ods|csv)$/.test(e) || t.indexOf("spreadsheetml") >= 0 || t === "application/vnd.ms-excel" || t === "text/csv") return "full";
    if (/^html?$/.test(e) || t === "text/html") return "html";
    if (t.indexOf("text/") === 0 || /^(txt|md|json|xml|ics|vcf|log|srt|vtt)$/.test(e) || t === "application/json") return "text";
    if (t.indexOf("audio/") === 0 || /^(mp3|wav|ogg|m4a|opus)$/.test(e)) return "audio";
    if (t.indexOf("video/") === 0 || /^(mp4|webm|mov)$/.test(e)) return "video";
    return "";
  }
  const scripts = {};
  const carregaLib = (src, test) => test() ? Promise.resolve(test()) : (scripts[src] = scripts[src] || new Promise((ok, ko) => {
    const s = document.createElement("script"); s.src = src;
    s.onload = () => test() ? ok(test()) : ko(new Error("No s'ha pogut carregar el lector d'aquest fitxer."));
    s.onerror = () => { delete scripts[src]; ko(new Error("No s'ha pogut carregar el lector d'aquest fitxer.")); };
    document.head.appendChild(s);
  }));
  // La signatura de cada compte (⚙️) s'afegeix al text en escriure un correu
  const sigCos = c => { const s = String((c && c.signatura) || "").replace(/\s+$/, ""); return s.trim() ? "\n\n" + s : ""; };
  const filaCompte = x => '<div class="cr-compte"><div class="fila"><input type="text" class="cr-nom" placeholder="Nom (p. ex. XTEC)" value="' + esc(x.nom) + '" style="flex:0 1 9em"><input type="text" class="cr-url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(x.url) + '"><button type="button" class="boto perill" data-cr="treucompte" title="Treu">✕</button></div>' +
    '<label>Signatura (s\'afegeix sola als correus que s\'escriuen des d\'aquest compte)<textarea class="cr-sig" rows="3" style="min-height:70px" placeholder="Nom i cognoms&#10;Càrrec · Centre">' + esc(x.signatura || "") + "</textarea></label></div>";

  const CSS = `
.cr-eines{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.cr-eines .esq{margin-left:auto;display:flex;gap:6px;flex-wrap:wrap}
.cr-fil{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;padding:8px 6px;border-bottom:1px solid var(--linia,#e3e1db);cursor:pointer}
.cr-fil:hover{background:#faf9f6}
.cr-fil .de{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-fil .dt{color:var(--suau,#6b6b66);font-size:.8rem;white-space:nowrap}
.cr-fil .as{grid-column:1 / -1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-fil .fr{grid-column:1 / -1;color:var(--suau,#6b6b66);font-size:.85rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-fil.nou .de,.cr-fil.nou .as{font-weight:700}
.cr-fil.nou{border-left:3px solid var(--accent,#b4462c)}
.cr-msg{border:1px solid var(--linia,#e3e1db);border-radius:10px;padding:10px 12px;margin:8px 0}
.cr-msg .cap{display:flex;gap:6px 12px;flex-wrap:wrap;color:var(--suau,#6b6b66);font-size:.85rem;margin-bottom:6px}
.cr-msg .cap b{color:var(--text,#1d1d1b)}
.cr-msg .cos{white-space:pre-wrap;word-break:break-word;font-size:.95rem;max-height:60vh;overflow:auto}
.cr-msg .adj{margin-top:6px;font-size:.85rem;color:var(--suau,#6b6b66)}
.cr-form{display:grid;gap:8px;border:1px solid var(--linia,#e3e1db);border-radius:10px;padding:12px;margin-bottom:10px;background:#faf9f6}
.cr-form label{display:grid;gap:3px;font-size:.85rem;color:var(--suau,#6b6b66)}
.cr-form input[type=text],.cr-form input[type=email],.cr-form textarea,.cr-form input[type=datetime-local]{font:inherit;padding:6px 8px;border:1px solid var(--linia,#e3e1db);border-radius:8px;color:var(--text,#1d1d1b);background:#fff;width:100%}
.cr-form textarea{min-height:160px;resize:vertical}
.cr-form .fila{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.cr-form .fila>*{flex:1 1 180px}
.cr-avis{font-size:.85rem;margin:6px 0;color:var(--suau,#6b6b66)}
.cr-avis.err{color:#a3161b}
.cr-buit{color:var(--suau,#6b6b66);padding:10px 0}
.cr-compte-et{display:inline-block;font-size:.7rem;font-weight:700;color:#fff;background:var(--accent,#b4462c);border-radius:4px;padding:0 4px;vertical-align:1px}
.cr-compte{display:grid;gap:4px;padding-bottom:8px;border-bottom:1px dashed var(--linia,#e3e1db)}
.cr-adj{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.cr-adj button{font:inherit;font-size:.85rem;border:1px solid var(--linia,#e3e1db);border-radius:8px;background:#fff;color:var(--text,#1d1d1b);padding:3px 9px;cursor:pointer;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cr-adj button span{color:var(--suau,#6b6b66);font-size:.8rem}
.cr-adj button[aria-pressed=true]{border-color:var(--accent,#b4462c);color:var(--accent,#b4462c)}
.cr-visor{border:1px solid var(--linia,#e3e1db);border-radius:10px;padding:8px;margin-top:8px;background:#fff}
.cr-visor .vc{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:8px}
.cr-visor .vc b{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}
.cr-visor a.boto{text-decoration:none;display:inline-block}
.cr-visor iframe{width:100%;height:70vh;border:0;background:#fff}
.cr-visor img,.cr-visor video{max-width:100%;height:auto}
.cr-visor audio{width:100%}
.cr-visor .doc{max-height:70vh;overflow:auto;font-size:.95rem;line-height:1.5}
.cr-visor .doc pre{white-space:pre-wrap;word-break:break-word;margin:0}
.cr-visor .doc img{max-width:100%}
.cr-visor .doc table{border-collapse:collapse;font-size:.85rem;margin-bottom:12px}
.cr-visor .doc td,.cr-visor .doc th{border:1px solid var(--linia,#e3e1db);padding:2px 6px;vertical-align:top}
.cr-visor .doc h4{margin:10px 0 4px}
`;

  function munta(arrel, op) {
    if (!document.getElementById("cr-estil")) { const st = document.createElement("style"); st.id = "cr-estil"; st.textContent = CSS; document.head.appendChild(st); }
    let compte = (op.comptes() || []).filter(c => c && c.url).length > 1 ? -1 : 0, vista = "llista", filtre = "in:inbox", cerca = "", fils = [], fil = null, avis = "", avisErr = false, carregant = false, redacta = null, configura = false, programats = [];
    const comptes = () => (op.comptes() || []).filter(c => c && c.url);
    // compte = -1: tots els comptes alhora
    const actual = () => { const l = comptes(); if (!l.length) return null; if (compte === -1 && l.length > 1) return null; compte = Math.max(0, Math.min(compte, l.length - 1)); return l[compte]; };
    const tots = () => compte === -1 && comptes().length > 1;
    const deFil = f => comptes()[f && f.ci != null ? f.ci : compte] || actual();
    // Comptador de la safata d'entrada de cada compte (al costat del títol del bloc).
    // «ple»: la llista d'aquell compte ha arribat al màxim que es demana, i per tant n'hi pot haver més.
    const MAX = 30, recompte = new Map(); let carregats = [];
    const esSafata = () => vista !== "programats" && filtre === "in:inbox" && !cerca;
    function compta() {
      if (!op.comptador) return;
      if (esSafata() && !carregant) carregats.forEach(i => {
        const d = fils.filter(f => f.ci === i), ant = recompte.get(i);
        recompte.set(i, { n: d.length, nl: d.filter(f => f.noLlegit).length, ple: !!(ant && ant.ple) });
      });
      const l = comptes(), v = l.map((c, i) => recompte.has(i) ? Object.assign({ nom: c.nom }, recompte.get(i)) : null).filter(Boolean);
      op.comptador(v.length ? { n: v.reduce((s, x) => s + x.n, 0), nl: v.reduce((s, x) => s + x.nl, 0), ple: v.some(x => x.ple), comptes: v } : null);
    }

    async function crida(cos, c) {
      c = c || actual();
      if (!c) throw new Error("Tria un compte.");
      const r = await fetch(c.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ pin: op.clau() }, cos)), redirect: "follow" });
      let d = {};
      try { d = await r.json(); } catch (e) { throw new Error("L'Apps Script del compte no ha respost bé (revisa que estigui implementat com a aplicació web)."); }
      if (!d.ok) throw new Error(d.error || "Error desconegut");
      return d;
    }
    const diu = (t, err) => { avis = t || ""; avisErr = !!err; pinta(); };

    async function carrega() {
      if (!actual() && !tots()) { pinta(); return; }
      carregant = true; pinta();
      const l = comptes(), quins = tots() ? l.map((c, i) => i) : [compte];
      const cos = vista === "programats" ? { accio: "programats" } : { accio: "llista", q: (cerca ? cerca + " " : "") + filtre, max: MAX };
      const res = await Promise.allSettled(quins.map(i => crida(cos, l[i]).then(d => ({ i, d }))));
      const errors = [];
      let tot = [];
      res.forEach((r, k) => {
        if (r.status === "fulfilled") tot = tot.concat((vista === "programats" ? r.value.d.programats : r.value.d.fils || []).map(x => Object.assign(x, { ci: r.value.i })));
        else errors.push((l[quins[k]] || {}).nom + ": " + r.reason.message);
      });
      if (vista === "programats") programats = tot.sort((a, b) => (a.quan || "").localeCompare(b.quan || ""));
      else { fils = tot.sort((a, b) => (b.data || "").localeCompare(a.data || "")); memo.clear(); precarrega(); }
      carregats = vista === "programats" ? [] : quins.filter((i, k) => res[k].status === "fulfilled");
      if (esSafata()) carregats.forEach(i => recompte.set(i, { n: 0, nl: 0, ple: fils.filter(f => f.ci === i).length >= MAX }));
      avis = errors.join(" · "); avisErr = errors.length > 0;
      carregant = false; pinta();
    }
    // Precàrrega: quan arriba la llista, es baixen de fons els fils (sense marcar-los com a llegits)
    // perquè, en prémer un correu, s'obri al moment sense esperar l'Apps Script.
    const memo = new Map(); let gen = 0;
    // Adjunts: el que s'obre es baixa una vegada i es desa mentre la pàgina és oberta
    let visor = null; const adjMemo = new Map();
    const compteFil = () => fil && fil.ci != null ? comptes()[fil.ci] : actual();
    async function obreAdjunt(mi, ai) {
      const m = fil && fil.missatges[mi], a = m && m.adjunts && m.adjunts[ai];
      if (!a || typeof a === "string") return;
      const k = fil.id + "|" + mi + "|" + ai;
      if (visor && visor.k === k) { visor = null; pinta(); return; }
      if (adjMemo.has(k)) { visor = adjMemo.get(k); pinta(); return; }
      const v = { k: k, fid: fil.id, mi: mi, nom: a.nom, classe: classe(a.nom, a.tipus), url: "" };
      visor = v; pinta();
      try {
        const d = await crida({ accio: "adjunt", id: fil.id, m: mi, a: ai }, compteFil());
        const bin = atob(d.b64 || ""), bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const tipus = d.tipus || a.tipus || "application/octet-stream";
        v.nom = d.nom || a.nom; v.classe = classe(v.nom, tipus);
        v.url = URL.createObjectURL(new Blob([bytes], { type: v.classe === "pdf" ? "application/pdf" : tipus }));
        if (v.classe === "text") v.contingut = "<pre>" + enllaca(new TextDecoder("utf-8").decode(bytes)) + "</pre>";
        else if (v.classe === "html") v.srcdoc = new TextDecoder("utf-8").decode(bytes);
        else if (v.classe === "docx") {
          const mam = await carregaLib(MAMMOTH, () => window.mammoth);
          v.contingut = (await mam.convertToHtml({ arrayBuffer: bytes.buffer })).value || "<p>(El document és buit.)</p>";
        } else if (v.classe === "full") {
          const X = await carregaLib(SHEETJS, () => window.XLSX);
          const ll = X.read(bytes, { type: "array" });
          v.contingut = ll.SheetNames.map(n => (ll.SheetNames.length > 1 ? "<h4>" + esc(n) + "</h4>" : "") + X.utils.sheet_to_html(ll.Sheets[n], { header: "", footer: "" })).join("");
        }
        adjMemo.set(k, v);
      } catch (e) { v.err = e.message; }
      if (visor === v) pinta();
    }
    function pintaVisor() {
      const v = visor;
      let h = '<div class="cr-visor"><div class="vc"><b>' + esc(v.nom) + "</b>";
      if (v.url) h += '<a class="boto clar" href="' + v.url + '" download="' + esc(v.nom) + '">⬇ Baixa</a>' + (/^(pdf|imatge|text|audio|video)$/.test(v.classe) ? '<a class="boto clar" href="' + v.url + '" target="_blank" rel="noopener">Obre en una pestanya ↗</a>' : "");
      h += '<button type="button" class="boto clar" data-cr="tancavisor" style="margin-left:auto">✕ Tanca</button></div>';
      if (v.err) h += '<p class="cr-avis err">' + esc(v.err) + (v.url ? " Pots baixar-lo i obrir-lo amb el programa que toqui." : "") + "</p>";
      else if (!v.url) h += '<p class="cr-buit">Obrint «' + esc(v.nom) + "»…</p>";
      else if (v.classe === "imatge") h += '<img src="' + v.url + '" alt="' + esc(v.nom) + '">';
      else if (v.classe === "pdf") h += '<iframe src="' + v.url + '" title="' + esc(v.nom) + '"></iframe>';
      else if (v.classe === "html") h += '<iframe sandbox="" srcdoc="' + esc(v.srcdoc) + '" title="' + esc(v.nom) + '"></iframe>';
      else if (v.classe === "audio") h += '<audio controls src="' + v.url + '"></audio>';
      else if (v.classe === "video") h += '<video controls src="' + v.url + '"></video>';
      else if (v.contingut != null) h += '<div class="doc">' + v.contingut + "</div>";
      else h += '<p class="cr-buit">Aquest tipus de fitxer no es pot llegir aquí. Baixa\'l i obre\'l amb el programa que toqui.</p>';
      return h + "</div>";
    }
    function adjunts(m, mi) {
      const l = m.adjunts || []; if (!l.length) return "";
      if (typeof l[0] === "string") return '<div class="adj">📎 ' + l.map(esc).join(" · ") + " (obre'ls a Gmail; per obrir-los aquí cal actualitzar l'Apps Script del compte)</div>";
      return '<div class="cr-adj">' + l.map((a, ai) => '<button type="button" data-cr="adjunt" data-m="' + mi + '" data-a="' + ai + '" aria-pressed="' + !!(visor && visor.k === fil.id + "|" + mi + "|" + ai) + '" title="Obre «' + esc(a.nom) + '»">📎 ' + esc(a.nom) + " <span>" + mida(a.mida) + "</span></button>").join("") + "</div>" +
        (visor && visor.fid === fil.id && visor.mi === mi ? pintaVisor() : "");
    }
    const clauFil = (id, ci) => (ci != null ? ci : compte) + "|" + id;
    function precarrega() {
      const g = ++gen, cua = fils.map(f => ({ id: f.id, ci: f.ci }));
      const treballa = async () => {
        while (g === gen && cua.length) {
          const x = cua.shift(), k = clauFil(x.id, x.ci); if (memo.has(k)) continue;
          const c = x.ci != null ? comptes()[x.ci] : actual(); if (!c) continue;
          const e = { p: crida({ accio: "llegeix", id: x.id, marca: false }, c).then(d => { d.fil.ci = x.ci != null ? x.ci : compte; return (e.fil = d.fil); }) };
          memo.set(k, e);
          try { await e.p; } catch (err) { memo.delete(k); }
        }
      };
      for (let i = 0; i < 3; i++) treballa();
    }
    async function obre(id, ci, fresc) {
      const k = clauFil(id, ci), e = fresc ? null : memo.get(k);
      const cc = ci != null ? ci : compte, f = fils.find(x => x.id === id && (x.ci != null ? x.ci : compte) === cc);
      if (fresc) memo.delete(k);
      const c = ci != null ? comptes()[ci] : actual();
      if (e && e.fil) {
        vista = "fil"; fil = e.fil; avis = ""; pinta();
        if (f && f.noLlegit) { f.noLlegit = false; crida({ accio: "llegit", id: id, llegit: true }, c).catch(() => {}); }
        return;
      }
      vista = "fil"; fil = null; carregant = true; pinta();
      try { fil = (await crida({ accio: "llegeix", id: id, marca: true }, c)).fil; fil.ci = cc; memo.set(k, { fil: fil }); if (f) f.noLlegit = false; avis = ""; }
      catch (err) { avis = err.message; avisErr = true; vista = "llista"; }
      carregant = false; pinta();
    }
    async function accio(nom, id, text) {
      try {
        await crida({ accio: nom, id: id, llegit: false }, deFil(fil)); memo.delete(clauFil(id, fil && fil.ci));
        fils = fils.filter(x => x.id !== id || nom === "llegit");
        if (nom === "llegit") { const f = fils.find(x => x.id === id); if (f) f.noLlegit = true; }
        vista = "llista"; fil = null; diu(text);
      } catch (e) { diu(e.message, true); }
    }

    function pinta() {
      compta();
      const l = comptes(), c = actual();
      let h = '<div class="cr-eines">';
      if (l.length > 1) h += '<div class="vistes" role="group" aria-label="Compte"><button type="button" data-cr="compte" data-i="-1" aria-pressed="' + tots() + '">Tots</button>' + l.map((x, i) => '<button type="button" data-cr="compte" data-i="' + i + '" aria-pressed="' + (!tots() && x === c) + '">' + esc(x.nom) + "</button>").join("") + "</div>";
      else if (c) h += "<b>" + esc(c.nom) + "</b>";
      const hiHa = c || tots();
      if (hiHa && vista !== "fil") {
        h += '<select data-cr="filtre" aria-label="Què es mostra">' +
          [["is:unread in:inbox", "No llegits"], ["in:inbox", "Safata d'entrada"], ["is:starred", "Destacats"], ["in:sent", "Enviats"], ["programats", "Programats"]]
            .map(([v, t]) => '<option value="' + v + '"' + ((vista === "programats" ? "programats" : filtre) === v ? " selected" : "") + ">" + t + "</option>").join("") + "</select>";
      }
      h += '<div class="esq">';
      if (hiHa) h += '<button type="button" class="boto clar" data-cr="refresca" title="Torna a carregar">↻</button><button type="button" class="boto" data-cr="nou">✏️ Nou</button>';
      h += '<button type="button" class="boto clar" data-cr="comptes" title="Comptes">⚙️</button></div></div>';
      if (hiHa && vista === "llista") h += '<div class="cr-eines"><input type="search" data-cr="cerca" placeholder="Cerca (com a Gmail: from:, subject:…)" value="' + esc(cerca) + '" style="flex:1 1 200px;font:inherit;padding:6px 8px;border:1px solid var(--linia,#e3e1db);border-radius:8px"></div>';
      if (avis) h += '<p class="cr-avis' + (avisErr ? " err" : "") + '">' + esc(avis) + "</p>";

      if (configura || !l.length) {
        const llista = op.comptes() || [];
        h += '<div class="cr-form" data-cr-form="comptes"><b>Comptes de correu</b><p class="cr-avis" style="margin:0">Per a cada compte, l\'URL de l\'Apps Script «Correu del tauler» (acaba en /exec).</p>' +
          (llista.length ? llista : [{ nom: "", url: "" }]).map(filaCompte).join("") +
          '<div class="fila cr-botons"><button type="button" class="boto clar" data-cr="noucompte" style="flex:0 0 auto">+ Compte</button><button type="button" class="boto" data-cr="desacomptes" style="flex:0 0 auto">Desa</button>' + (l.length ? '<button type="button" class="boto clar" data-cr="tancacomptes" style="flex:0 0 auto">Tanca</button>' : "") + "</div></div>";
      }
      if (redacta) {
        const r = redacta;
        const desDe = l[r.ci != null ? r.ci : Math.max(compte, 0)] || {};
        h += '<div class="cr-form" data-cr-form="redacta"><b>' + (r.id ? (r.tots ? "Respon a tots" : "Respon") + ": " + esc(r.assumpte) + " · " + esc(desDe.nom || "") : "Correu nou") + "</b>" +
          (!r.id && l.length > 1 ? '<label>Des de<select class="cr-desde">' + l.map((x, i) => '<option value="' + i + '"' + (i === (r.ci != null ? r.ci : Math.max(compte, 0)) ? " selected" : "") + ">" + esc(x.nom) + "</option>").join("") + "</select></label>" : "") +
          (r.id ? "" : '<label>Per a<input type="text" class="cr-a" value="' + esc(r.a || "") + '" placeholder="adreça@exemple.cat, …"></label>') +
          '<div class="fila"><label>Cc<input type="text" class="cr-cc" value="' + esc(r.cc || "") + '"></label><label>Cco<input type="text" class="cr-cco" value="' + esc(r.cco || "") + '"></label></div>' +
          (r.id ? "" : '<label>Assumpte<input type="text" class="cr-as" value="' + esc(r.assumpte || "") + '"></label>') +
          '<label>Missatge<textarea class="cr-cos">\n' + esc(r.cos || "") + "</textarea></label>" +
          '<div class="fila"><label style="display:flex;gap:8px;align-items:center;color:var(--text,#1d1d1b);flex:0 1 auto"><input type="checkbox" class="cr-prog"' + (r.prog ? " checked" : "") + '> Programa l\'enviament</label><input type="datetime-local" class="cr-quan" value="' + esc(r.quan || "") + '"' + (r.prog ? "" : " hidden") + "></div>" +
          '<div class="fila" style="justify-content:flex-end"><button type="button" class="boto clar" data-cr="cancela" style="flex:0 0 auto">Cancel·la</button><button type="button" class="boto" data-cr="envia" style="flex:0 0 auto">' + (r.prog ? "Programa" : "Envia") + "</button></div></div>";
      }

      if (!hiHa) { h += '<p class="cr-buit">Encara no hi ha cap compte de correu configurat.</p>'; arrel.innerHTML = h; return; }
      if (carregant) h += '<p class="cr-buit">Carregant…</p>';
      else if (vista === "fil" && fil) {
        h += (l.length > 1 ? '<p class="cr-avis" style="margin:0 0 6px">Compte: <b>' + esc((l[fil.ci] || {}).nom || "") + "</b></p>" : "") + '<div class="cr-eines"><button type="button" class="boto clar" data-cr="torna">‹ Torna</button><div class="esq">' +
          '<button type="button" class="boto clar" data-cr="respon">↩︎ Respon</button><button type="button" class="boto clar" data-cr="respontots">↩︎ A tots</button>' +
          (op.tasca ? '<button type="button" class="boto clar" data-cr="tasca">+ Tasca</button>' : "") +
          '<button type="button" class="boto clar" data-cr="nollegit">No llegit</button><button type="button" class="boto" data-cr="arxiva" title="L\'arxiva i surt de la safata">✓ Fet</button><button type="button" class="boto perill" data-cr="esborra" title="A la paperera del compte (30 dies per recuperar-lo)">🗑 Esborra</button></div></div>' +
          '<h3 style="margin:4px 0 6px">' + esc(fil.assumpte) + ' <a href="' + esc(fil.enllac) + '" target="_blank" rel="noopener" style="font-size:.8rem;font-weight:400">obre a Gmail ↗</a></h3>' +
          fil.missatges.map((m, mi) => '<div class="cr-msg"><div class="cap"><b>' + esc(nomDe(m.de)) + "</b><span>" + esc(adrecaDe(m.de)) + "</span><span>" + dataLlarga(m.data) + "</span>" + (m.a ? "<span>Per a: " + esc(m.a) + "</span>" : "") + (m.cc ? "<span>Cc: " + esc(m.cc) + "</span>" : "") + '</div><div class="cos">' + enllaca(m.cos) + "</div>" + adjunts(m, mi) + "</div>").join("");
      } else if (vista === "programats") {
        h += programats.length ? programats.map(p => '<div class="cr-fil" style="cursor:default"><span class="de">' + (tots() ? '<span class="cr-compte-et">' + esc((l[p.ci] || {}).nom || "") + "</span> " : "") + esc(p.id ? "Resposta" : p.a) + '</span><span class="dt">' + dataLlarga(p.quan) + '</span><span class="as">' + esc(p.assumpte || "(resposta)") + '</span><span class="fr"><button type="button" class="boto perill" data-cr="anulla" data-ci="' + p.ci + '" data-clau="' + esc(p.clau) + '">Anul·la</button></span></div>').join("") : '<p class="cr-buit">No hi ha cap correu programat.</p>';
      } else {
        h += fils.length ? fils.map(f => '<div class="cr-fil' + (f.noLlegit ? " nou" : "") + '" data-cr="obre" data-id="' + esc(f.id) + '" data-ci="' + f.ci + '"><span class="de">' + (tots() ? '<span class="cr-compte-et">' + esc((l[f.ci] || {}).nom || "") + "</span> " : "") + esc(nomDe(f.de)) + (f.n > 1 ? " (" + f.n + ")" : "") + '</span><span class="dt">' + (f.adjunts ? "📎 " : "") + dataCurta(f.data) + '</span><span class="as">' + esc(f.assumpte) + '</span><span class="fr">' + esc(f.fragment) + "</span></div>").join("") : '<p class="cr-buit">' + (filtre.indexOf("is:unread") >= 0 && !cerca ? "Cap correu per llegir. Tot al dia! ✓" : "No hi ha cap correu.") + "</p>";
      }
      arrel.innerHTML = h;
    }

    function llegeixFormulari() {
      const f = arrel.querySelector('[data-cr-form="redacta"]'); if (!f || !redacta) return;
      const v = cl => { const el = f.querySelector(cl); return el ? (el.type === "checkbox" ? el.checked : el.value) : undefined; };
      ["a", "cc", "cco"].forEach(k => { const x = v(".cr-" + k); if (x !== undefined) redacta[k] = x; });
      const as = v(".cr-as"); if (as !== undefined) redacta.assumpte = as;
      const dd = v(".cr-desde"); if (dd !== undefined) redacta.ci = Number(dd);
      redacta.cos = v(".cr-cos"); redacta.prog = v(".cr-prog"); redacta.quan = v(".cr-quan");
    }

    arrel.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-cr]"); if (!b || b.tagName === "SELECT" || b.tagName === "INPUT") return;
      const a = b.dataset.cr;
      if (a === "compte") { compte = Number(b.dataset.i); vista = vista === "programats" ? "programats" : "llista"; fil = null; carrega(); }
      else if (a === "refresca") { if (vista === "fil" && fil) obre(fil.id, fil.ci, true); else carrega(); }
      else if (a === "obre") obre(b.dataset.id, b.dataset.ci != null && b.dataset.ci !== "undefined" ? Number(b.dataset.ci) : null);
      else if (a === "torna") { vista = "llista"; fil = null; visor = null; pinta(); }
      else if (a === "arxiva" && fil) accio("arxiva", fil.id, "Arxivat: «" + fil.assumpte + "».");
      else if (a === "esborra" && fil) { if (confirm("Vols enviar «" + fil.assumpte + "» a la paperera del compte? (S'hi podrà recuperar durant 30 dies.)")) accio("esborra", fil.id, "A la paperera: «" + fil.assumpte + "»."); }
      else if (a === "nollegit" && fil) accio("llegit", fil.id, "Marcat com a no llegit.");
      else if (a === "tasca" && fil && op.tasca) { op.tasca({ text: fil.assumpte, enllac: fil.enllac, compte: (deFil(fil) || {}).nom }); diu("Afegit a les tasques: «" + fil.assumpte + "»."); vista = "fil"; pinta(); }
      else if (a === "adjunt" && fil) obreAdjunt(Number(b.dataset.m), Number(b.dataset.a));
      else if (a === "tancavisor") { visor = null; pinta(); }
      else if (a === "nou") { redacta = { a: "", cc: "", cco: "", assumpte: "", cos: sigCos(comptes()[Math.max(compte, 0)]) }; configura = false; pinta(); }
      else if ((a === "respon" || a === "respontots") && fil) {
        const darrer = fil.missatges[fil.missatges.length - 1];
        redacta = { id: fil.id, ci: fil.ci, tots: a === "respontots", assumpte: fil.assumpte, cos: sigCos(compteFil()) + "\n\n— " + nomDe(darrer.de) + ", " + dataLlarga(darrer.data) + ":\n" + darrer.cos.split("\n").slice(0, 40).map(x => "> " + x).join("\n") };
        pinta();
        const t = arrel.querySelector(".cr-cos"); if (t) { t.focus(); t.setSelectionRange(0, 0); }
      }
      else if (a === "cancela") { redacta = null; pinta(); }
      else if (a === "envia" && redacta) {
        llegeixFormulari();
        const r = redacta;
        if (!r.id && !String(r.a || "").trim()) return diu("Falta el destinatari.", true);
        if (!String(r.cos || "").trim()) return diu("El missatge és buit.", true);
        let quan = null;
        if (r.prog) { const d = new Date(r.quan); if (!r.quan || isNaN(d)) return diu("Tria el dia i l'hora de l'enviament.", true); if (d.getTime() < Date.now()) return diu("L'hora de l'enviament ja ha passat.", true); quan = d.toISOString(); }
        b.disabled = true;
        try {
          await crida(Object.assign({ accio: quan ? "programa" : "envia", quan: quan }, { a: r.a, cc: r.cc, cco: r.cco, assumpte: r.assumpte, cos: r.cos, id: r.id || "", tots: !!r.tots }), comptes()[r.ci != null ? r.ci : Math.max(compte, 0)]);
          redacta = null; diu(quan ? "Programat per al " + dataLlarga(quan) + "." : "Enviat.");
        } catch (e) { b.disabled = false; diu(e.message, true); }
      }
      else if (a === "anulla") { try { await crida({ accio: "anulla", clau: b.dataset.clau }, comptes()[Number(b.dataset.ci)] || actual()); programats = programats.filter(p => p.clau !== b.dataset.clau); diu("Enviament anul·lat."); } catch (e) { diu(e.message, true); } }
      else if (a === "comptes") { configura = !configura; redacta = null; pinta(); }
      else if (a === "noucompte") { const f = arrel.querySelector('[data-cr-form="comptes"]'); const t = document.createElement("div"); t.innerHTML = filaCompte({ nom: "", url: "" }); f.querySelector(".cr-botons").before(t.firstChild); }
      else if (a === "treucompte") b.closest(".cr-compte").remove();
      else if (a === "tancacomptes") { configura = false; pinta(); }
      else if (a === "desacomptes") {
        const llista = Array.from(arrel.querySelectorAll(".cr-compte")).map(f => ({ nom: f.querySelector(".cr-nom").value.trim(), url: f.querySelector(".cr-url").value.trim(), signatura: (f.querySelector(".cr-sig") || {}).value || "" })).filter(x => x.nom || x.url);
        if (llista.some(x => !x.nom || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(x.url))) return diu("Cada compte necessita un nom i l'URL de l'Apps Script (https://script.google.com/macros/s/…/exec).", true);
        op.desaComptes(llista); recompte.clear(); configura = false; compte = llista.length > 1 ? -1 : 0; avis = ""; carrega();
      }
    });
    arrel.addEventListener("change", ev => {
      const el = ev.target;
      if (el.dataset.cr === "filtre") { if (el.value === "programats") vista = "programats"; else { vista = "llista"; filtre = el.value; } carrega(); }
      else if (el.classList.contains("cr-prog")) { llegeixFormulari(); pinta(); }
      else if (el.classList.contains("cr-desde") && redacta) {
        // En canviar el compte de sortida, es canvia també la signatura
        const abans = sigCos(comptes()[redacta.ci != null ? redacta.ci : Math.max(compte, 0)]);
        llegeixFormulari();
        const ara = sigCos(comptes()[redacta.ci]), cos = redacta.cos || "";
        if (abans !== ara) { if (!abans) redacta.cos = cos + ara; else if (cos.indexOf(abans) >= 0) redacta.cos = cos.replace(abans, ara); }
        pinta();
      }
    });
    arrel.addEventListener("keydown", ev => { if (ev.target.dataset && ev.target.dataset.cr === "cerca" && ev.key === "Enter") { cerca = ev.target.value.trim(); carrega(); } });
    arrel.addEventListener("search", ev => { if (ev.target.dataset && ev.target.dataset.cr === "cerca") { cerca = ev.target.value.trim(); carrega(); } });

    pinta();
    return { carrega: carrega, pinta: pinta };
  }
  window.Correu = { munta: munta };
})();
