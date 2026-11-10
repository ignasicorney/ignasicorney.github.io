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
`;

  function munta(arrel, op) {
    if (!document.getElementById("cr-estil")) { const st = document.createElement("style"); st.id = "cr-estil"; st.textContent = CSS; document.head.appendChild(st); }
    let compte = 0, vista = "llista", filtre = "is:unread in:inbox", cerca = "", fils = [], fil = null, avis = "", avisErr = false, carregant = false, redacta = null, configura = false, programats = [];
    const comptes = () => (op.comptes() || []).filter(c => c && c.url);
    const actual = () => { const l = comptes(); if (!l.length) return null; compte = Math.min(compte, l.length - 1); return l[compte]; };

    async function crida(cos, c) {
      c = c || actual();
      if (!c) throw new Error("No hi ha cap compte configurat.");
      const r = await fetch(c.url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ pin: op.clau() }, cos)), redirect: "follow" });
      let d = {};
      try { d = await r.json(); } catch (e) { throw new Error("L'Apps Script del compte no ha respost bé (revisa que estigui implementat com a aplicació web)."); }
      if (!d.ok) throw new Error(d.error || "Error desconegut");
      return d;
    }
    const diu = (t, err) => { avis = t || ""; avisErr = !!err; pinta(); };

    async function carrega() {
      if (!actual()) { pinta(); return; }
      carregant = true; pinta();
      try {
        if (vista === "programats") programats = (await crida({ accio: "programats" })).programats || [];
        else fils = (await crida({ accio: "llista", q: (cerca ? cerca + " " : "") + filtre, max: 30 })).fils || [];
        avis = ""; avisErr = false;
      } catch (e) { avis = e.message; avisErr = true; }
      carregant = false; pinta();
    }
    async function obre(id) {
      vista = "fil"; fil = null; carregant = true; pinta();
      try { fil = (await crida({ accio: "llegeix", id: id, marca: true })).fil; const f = fils.find(x => x.id === id); if (f) f.noLlegit = false; avis = ""; }
      catch (e) { avis = e.message; avisErr = true; vista = "llista"; }
      carregant = false; pinta();
    }
    async function accio(nom, id, text) {
      try {
        await crida({ accio: nom, id: id, llegit: false });
        fils = fils.filter(x => x.id !== id || nom === "llegit");
        if (nom === "llegit") { const f = fils.find(x => x.id === id); if (f) f.noLlegit = true; }
        vista = "llista"; fil = null; diu(text);
      } catch (e) { diu(e.message, true); }
    }

    function pinta() {
      const l = comptes(), c = actual();
      let h = '<div class="cr-eines">';
      if (l.length > 1) h += '<div class="vistes" role="group" aria-label="Compte">' + l.map((x, i) => '<button type="button" data-cr="compte" data-i="' + i + '" aria-pressed="' + (x === c) + '">' + esc(x.nom) + "</button>").join("") + "</div>";
      else if (c) h += "<b>" + esc(c.nom) + "</b>";
      if (c && vista !== "fil") {
        h += '<select data-cr="filtre" aria-label="Què es mostra">' +
          [["is:unread in:inbox", "No llegits"], ["in:inbox", "Safata d'entrada"], ["is:starred", "Destacats"], ["in:sent", "Enviats"], ["programats", "Programats"]]
            .map(([v, t]) => '<option value="' + v + '"' + ((vista === "programats" ? "programats" : filtre) === v ? " selected" : "") + ">" + t + "</option>").join("") + "</select>";
      }
      h += '<div class="esq">';
      if (c) h += '<button type="button" class="boto clar" data-cr="refresca" title="Torna a carregar">↻</button><button type="button" class="boto" data-cr="nou">✏️ Nou</button>';
      h += '<button type="button" class="boto clar" data-cr="comptes" title="Comptes">⚙️</button></div></div>';
      if (c && vista === "llista") h += '<div class="cr-eines"><input type="search" data-cr="cerca" placeholder="Cerca (com a Gmail: from:, subject:…)" value="' + esc(cerca) + '" style="flex:1 1 200px;font:inherit;padding:6px 8px;border:1px solid var(--linia,#e3e1db);border-radius:8px"></div>';
      if (avis) h += '<p class="cr-avis' + (avisErr ? " err" : "") + '">' + esc(avis) + "</p>";

      if (configura || !l.length) {
        const llista = op.comptes() || [];
        h += '<div class="cr-form" data-cr-form="comptes"><b>Comptes de correu</b><p class="cr-avis" style="margin:0">Per a cada compte, l\'URL de l\'Apps Script «Correu del tauler» (acaba en /exec).</p>' +
          (llista.length ? llista : [{ nom: "", url: "" }]).map(x => '<div class="fila cr-compte"><input type="text" class="cr-nom" placeholder="Nom (p. ex. XTEC)" value="' + esc(x.nom) + '" style="flex:0 1 9em"><input type="text" class="cr-url" placeholder="https://script.google.com/macros/s/…/exec" value="' + esc(x.url) + '"><button type="button" class="boto perill" data-cr="treucompte" title="Treu">✕</button></div>').join("") +
          '<div class="fila"><button type="button" class="boto clar" data-cr="noucompte" style="flex:0 0 auto">+ Compte</button><button type="button" class="boto" data-cr="desacomptes" style="flex:0 0 auto">Desa</button>' + (l.length ? '<button type="button" class="boto clar" data-cr="tancacomptes" style="flex:0 0 auto">Tanca</button>' : "") + "</div></div>";
      }
      if (redacta) {
        const r = redacta;
        h += '<div class="cr-form" data-cr-form="redacta"><b>' + (r.id ? (r.tots ? "Respon a tots" : "Respon") + ": " + esc(r.assumpte) : "Correu nou") + " · " + esc((c || {}).nom || "") + "</b>" +
          (r.id ? "" : '<label>Per a<input type="text" class="cr-a" value="' + esc(r.a || "") + '" placeholder="adreça@exemple.cat, …"></label>') +
          '<div class="fila"><label>Cc<input type="text" class="cr-cc" value="' + esc(r.cc || "") + '"></label><label>Cco<input type="text" class="cr-cco" value="' + esc(r.cco || "") + '"></label></div>' +
          (r.id ? "" : '<label>Assumpte<input type="text" class="cr-as" value="' + esc(r.assumpte || "") + '"></label>') +
          '<label>Missatge<textarea class="cr-cos">' + esc(r.cos || "") + "</textarea></label>" +
          '<div class="fila"><label style="display:flex;gap:8px;align-items:center;color:var(--text,#1d1d1b);flex:0 1 auto"><input type="checkbox" class="cr-prog"' + (r.prog ? " checked" : "") + '> Programa l\'enviament</label><input type="datetime-local" class="cr-quan" value="' + esc(r.quan || "") + '"' + (r.prog ? "" : " hidden") + "></div>" +
          '<div class="fila" style="justify-content:flex-end"><button type="button" class="boto clar" data-cr="cancela" style="flex:0 0 auto">Cancel·la</button><button type="button" class="boto" data-cr="envia" style="flex:0 0 auto">' + (r.prog ? "Programa" : "Envia") + "</button></div></div>";
      }

      if (!c) { h += '<p class="cr-buit">Encara no hi ha cap compte de correu configurat.</p>'; arrel.innerHTML = h; return; }
      if (carregant) h += '<p class="cr-buit">Carregant…</p>';
      else if (vista === "fil" && fil) {
        h += '<div class="cr-eines"><button type="button" class="boto clar" data-cr="torna">‹ Torna</button><div class="esq">' +
          '<button type="button" class="boto clar" data-cr="respon">↩︎ Respon</button><button type="button" class="boto clar" data-cr="respontots">↩︎ A tots</button>' +
          (op.tasca ? '<button type="button" class="boto clar" data-cr="tasca">+ Tasca</button>' : "") +
          '<button type="button" class="boto clar" data-cr="nollegit">No llegit</button><button type="button" class="boto" data-cr="arxiva" title="L\'arxiva i surt de la safata">✓ Fet</button><button type="button" class="boto perill" data-cr="esborra" title="A la paperera del compte (30 dies per recuperar-lo)">🗑 Esborra</button></div></div>' +
          '<h3 style="margin:4px 0 6px">' + esc(fil.assumpte) + ' <a href="' + esc(fil.enllac) + '" target="_blank" rel="noopener" style="font-size:.8rem;font-weight:400">obre a Gmail ↗</a></h3>' +
          fil.missatges.map(m => '<div class="cr-msg"><div class="cap"><b>' + esc(nomDe(m.de)) + "</b><span>" + esc(adrecaDe(m.de)) + "</span><span>" + dataLlarga(m.data) + "</span>" + (m.a ? "<span>Per a: " + esc(m.a) + "</span>" : "") + (m.cc ? "<span>Cc: " + esc(m.cc) + "</span>" : "") + '</div><div class="cos">' + enllaca(m.cos) + "</div>" + (m.adjunts && m.adjunts.length ? '<div class="adj">📎 ' + m.adjunts.map(esc).join(" · ") + " (obre'ls a Gmail)</div>" : "") + "</div>").join("");
      } else if (vista === "programats") {
        h += programats.length ? programats.map(p => '<div class="cr-fil" style="cursor:default"><span class="de">' + esc(p.id ? "Resposta" : p.a) + '</span><span class="dt">' + dataLlarga(p.quan) + '</span><span class="as">' + esc(p.assumpte || "(resposta)") + '</span><span class="fr"><button type="button" class="boto perill" data-cr="anulla" data-clau="' + esc(p.clau) + '">Anul·la</button></span></div>').join("") : '<p class="cr-buit">No hi ha cap correu programat.</p>';
      } else {
        h += fils.length ? fils.map(f => '<div class="cr-fil' + (f.noLlegit ? " nou" : "") + '" data-cr="obre" data-id="' + esc(f.id) + '"><span class="de">' + esc(nomDe(f.de)) + (f.n > 1 ? " (" + f.n + ")" : "") + '</span><span class="dt">' + (f.adjunts ? "📎 " : "") + dataCurta(f.data) + '</span><span class="as">' + esc(f.assumpte) + '</span><span class="fr">' + esc(f.fragment) + "</span></div>").join("") : '<p class="cr-buit">' + (filtre.indexOf("is:unread") >= 0 && !cerca ? "Cap correu per llegir. Tot al dia! ✓" : "No hi ha cap correu.") + "</p>";
      }
      arrel.innerHTML = h;
    }

    function llegeixFormulari() {
      const f = arrel.querySelector('[data-cr-form="redacta"]'); if (!f || !redacta) return;
      const v = cl => { const el = f.querySelector(cl); return el ? (el.type === "checkbox" ? el.checked : el.value) : undefined; };
      ["a", "cc", "cco"].forEach(k => { const x = v(".cr-" + k); if (x !== undefined) redacta[k] = x; });
      const as = v(".cr-as"); if (as !== undefined) redacta.assumpte = as;
      redacta.cos = v(".cr-cos"); redacta.prog = v(".cr-prog"); redacta.quan = v(".cr-quan");
    }

    arrel.addEventListener("click", async ev => {
      const b = ev.target.closest("[data-cr]"); if (!b || b.tagName === "SELECT" || b.tagName === "INPUT") return;
      const a = b.dataset.cr;
      if (a === "compte") { compte = Number(b.dataset.i); vista = vista === "programats" ? "programats" : "llista"; fil = null; carrega(); }
      else if (a === "refresca") { if (vista === "fil" && fil) obre(fil.id); else carrega(); }
      else if (a === "obre") obre(b.dataset.id);
      else if (a === "torna") { vista = "llista"; fil = null; pinta(); }
      else if (a === "arxiva" && fil) accio("arxiva", fil.id, "Arxivat: «" + fil.assumpte + "».");
      else if (a === "esborra" && fil) { if (confirm("Vols enviar «" + fil.assumpte + "» a la paperera del compte? (S'hi podrà recuperar durant 30 dies.)")) accio("esborra", fil.id, "A la paperera: «" + fil.assumpte + "»."); }
      else if (a === "nollegit" && fil) accio("llegit", fil.id, "Marcat com a no llegit.");
      else if (a === "tasca" && fil && op.tasca) { op.tasca({ text: fil.assumpte, enllac: fil.enllac, compte: (actual() || {}).nom }); diu("Afegit a les tasques: «" + fil.assumpte + "»."); vista = "fil"; pinta(); }
      else if (a === "nou") { redacta = { a: "", cc: "", cco: "", assumpte: "", cos: "" }; configura = false; pinta(); }
      else if ((a === "respon" || a === "respontots") && fil) {
        const darrer = fil.missatges[fil.missatges.length - 1];
        redacta = { id: fil.id, tots: a === "respontots", assumpte: fil.assumpte, cos: "\n\n— " + nomDe(darrer.de) + ", " + dataLlarga(darrer.data) + ":\n" + darrer.cos.split("\n").slice(0, 40).map(x => "> " + x).join("\n") };
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
          await crida(Object.assign({ accio: quan ? "programa" : "envia", quan: quan }, { a: r.a, cc: r.cc, cco: r.cco, assumpte: r.assumpte, cos: r.cos, id: r.id || "", tots: !!r.tots }));
          redacta = null; diu(quan ? "Programat per al " + dataLlarga(quan) + "." : "Enviat.");
        } catch (e) { b.disabled = false; diu(e.message, true); }
      }
      else if (a === "anulla") { try { await crida({ accio: "anulla", clau: b.dataset.clau }); programats = programats.filter(p => p.clau !== b.dataset.clau); diu("Enviament anul·lat."); } catch (e) { diu(e.message, true); } }
      else if (a === "comptes") { configura = !configura; redacta = null; pinta(); }
      else if (a === "noucompte") { const f = arrel.querySelector('[data-cr-form="comptes"]'); const fila = document.createElement("div"); fila.className = "fila cr-compte"; fila.innerHTML = '<input type="text" class="cr-nom" placeholder="Nom (p. ex. XTEC)" style="flex:0 1 9em"><input type="text" class="cr-url" placeholder="https://script.google.com/macros/s/…/exec"><button type="button" class="boto perill" data-cr="treucompte" title="Treu">✕</button>'; f.querySelector(".fila:last-child").before(fila); }
      else if (a === "treucompte") b.closest(".cr-compte").remove();
      else if (a === "tancacomptes") { configura = false; pinta(); }
      else if (a === "desacomptes") {
        const llista = Array.from(arrel.querySelectorAll(".cr-compte")).map(f => ({ nom: f.querySelector(".cr-nom").value.trim(), url: f.querySelector(".cr-url").value.trim() })).filter(x => x.nom || x.url);
        if (llista.some(x => !x.nom || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(x.url))) return diu("Cada compte necessita un nom i l'URL de l'Apps Script (https://script.google.com/macros/s/…/exec).", true);
        op.desaComptes(llista); configura = false; compte = 0; avis = ""; carrega();
      }
    });
    arrel.addEventListener("change", ev => {
      const el = ev.target;
      if (el.dataset.cr === "filtre") { if (el.value === "programats") vista = "programats"; else { vista = "llista"; filtre = el.value; } carrega(); }
      else if (el.classList.contains("cr-prog")) { llegeixFormulari(); pinta(); }
    });
    arrel.addEventListener("keydown", ev => { if (ev.target.dataset && ev.target.dataset.cr === "cerca" && ev.key === "Enter") { cerca = ev.target.value.trim(); carrega(); } });
    arrel.addEventListener("search", ev => { if (ev.target.dataset && ev.target.dataset.cr === "cerca") { cerca = ev.target.value.trim(); carrega(); } });

    pinta();
    return { carrega: carrega, pinta: pinta };
  }
  window.Correu = { munta: munta };
})();
