// =============================================================================
// FITXERS ADJUNTS A LES NOTES — La TdG · 21.11.2026
// Es fa servir a Notícies del guió (latdg.github.io/redaccio/noticies/) i a la
// Bitàcola personal (ignasicorney.github.io/tauler/). Hi ha una còpia idèntica
// a cada repo: si es canvia l'una, cal canviar també l'altra.
//
// · Arrossegar o enganxar (Ctrl+V) imatges i fitxers dins d'una caixa de text,
//   o triar-los amb el botó 📎.
// · Els fitxers es desen al repo PRIVAT latdg/noticies, carpeta fitxers/AAAA/MM/,
//   amb un token de GitHub que només té permís sobre aquest repo.
// · El token s'escriu un sol cop: es desa (camuflat) al mateix magatzem privat
//   de les notícies, al «dia» 2099-12-30, i el llegeixen totes dues pàgines.
// · Les fotos grans es redueixen a 2000 px abans de pujar-les.
// =============================================================================
(function () {
  "use strict";
  const REPO = "latdg/noticies";
  const API = "https://api.github.com/repos/" + REPO + "/contents/";
  const CONFIG_DIA = "2099-12-30";
  const MAX_MIDA = 25 * 1024 * 1024;
  const URL_TOKEN = "https://github.com/settings/personal-access-tokens/new";

  let crida = null, token = "", tokenLlegit = false, cua = Promise.resolve();
  const cache = new Map();   // camí → Promise<objectURL>

  const dos = n => String(n).padStart(2, "0");
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const camiApi = p => p.split("/").map(encodeURIComponent).join("/");
  const amaga = t => "v1:" + btoa(t.split("").reverse().join(""));
  const mostra = s => { if (!s || s.indexOf("v1:") !== 0) return ""; try { return atob(s.slice(3)).split("").reverse().join(""); } catch (e) { return ""; } };
  // Codifica nom i tipus perquè no es confonguin amb les marques del guió (* i _)
  const codi = s => encodeURIComponent(String(s || "")).replace(/[_*!'()~|\]\[]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase());
  const decodi = s => { try { return decodeURIComponent(s || ""); } catch (e) { return s || ""; } };

  function midaText(b) {
    b = +b || 0;
    if (b < 1024) return b + " B";
    if (b < 1024 * 1024) return Math.round(b / 1024) + " kB";
    return (b / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
  }
  function icona(tipus, nom) {
    const t = (tipus || "") + " " + (nom || "").toLowerCase();
    if (/pdf/.test(t)) return "📕";
    if (/^image\//.test(tipus)) return "🖼️";
    if (/^audio\/|\.(mp3|wav|ogg|m4a)\b/.test(t)) return "🎧";
    if (/^video\/|\.(mp4|mov|webm|mkv)\b/.test(t)) return "🎬";
    if (/sheet|excel|\.(xlsx?|ods|csv)\b/.test(t)) return "📊";
    if (/presentation|powerpoint|\.(pptx?|odp)\b/.test(t)) return "📽️";
    if (/word|\.(docx?|odt|rtf)\b/.test(t)) return "📝";
    if (/zip|compressed|\.(zip|rar|7z)\b/.test(t)) return "🗜️";
    return "📄";
  }
  function nomNet(nom) {
    const m = String(nom || "fitxer").match(/^(.*?)(\.[a-z0-9]{1,8})?$/i);
    const base = (m[1] || "fitxer").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(0, 60) || "fitxer";
    return base + (m[2] || "").toLowerCase();
  }

  // ---------- Token ----------
  async function llegeixToken() {
    if (tokenLlegit) return token;
    if (!crida) throw new Error("Els fitxers no estan configurats en aquesta pàgina.");
    const d = await crida({ accio: "noticies-llegeix", dia: CONFIG_DIA });
    const e = (d.noticies || []).find(n => n.id === "fitxers");
    token = e ? mostra(e.text) : "";
    tokenLlegit = true;
    return token;
  }
  async function desaToken(t) {
    const d = await crida({ accio: "noticies-llegeix", dia: CONFIG_DIA });
    const llista = (d.noticies || []).filter(n => n.id !== "fitxers");
    if (t) llista.push({ id: "fitxers", titol: "Token dels fitxers adjunts (no esborrar)", text: amaga(t) });
    await crida({ accio: "noticies-desa", dia: CONFIG_DIA, noticies: llista, sha: d.sha });
    token = t; tokenLlegit = true;
  }
  async function provaToken(t) {
    // Prova d'escriptura real: crea (i després esborra) un fitxer petit.
    const cami = "fitxers/.prova-" + Date.now().toString(36);
    const cap = { Authorization: "Bearer " + t, Accept: "application/vnd.github+json", "Content-Type": "application/json" };
    const r = await fetch(API + camiApi(cami), { method: "PUT", headers: cap, body: JSON.stringify({ message: "Prova del token dels fitxers", content: btoa("ok") }) });
    if (r.status === 401) throw new Error("GitHub diu que el token no és vàlid. Copia'l sencer, sense espais.");
    if (r.status === 403 || r.status === 404) throw new Error("El token no té permís d'escriptura a latdg/noticies (cal «Contents: Read and write» i el repo latdg/noticies triat). Si l'organització latdg demana aprovar-lo, aprova'l primer.");
    if (!r.ok) throw new Error("GitHub ha respost " + r.status + ".");
    const j = await r.json().catch(() => ({}));
    if (j.content && j.content.sha) fetch(API + camiApi(cami), { method: "DELETE", headers: cap, body: JSON.stringify({ message: "Esborra la prova", sha: j.content.sha }) }).catch(() => {});
  }

  let dialeg = null;
  function demanaToken(text) {
    return new Promise((resol, rebutja) => {
      if (!dialeg) {
        dialeg = document.createElement("dialog");
        dialeg.className = "fx-dialeg";
        dialeg.innerHTML =
          '<h3 style="margin:0 0 8px">📎 Activar els fitxers adjunts</h3>' +
          '<p class="fx-av" style="margin:0 0 8px"></p>' +
          '<p style="margin:0 0 6px">Només es fa un cop i ja serveix per a tots els aparells i per a totes dues pàgines (Notícies del guió i la Bitàcola).</p>' +
          '<ol style="margin:0 0 10px;padding-left:20px;line-height:1.45">' +
          '<li>Obre <a href="' + URL_TOKEN + '" target="_blank" rel="noopener">aquesta pàgina de GitHub</a>.</li>' +
          '<li><b>Token name:</b> Fitxers de les notes. <b>Expiration:</b> la més llarga que et deixi.</li>' +
          '<li><b>Resource owner:</b> latdg.</li>' +
          '<li><b>Repository access:</b> Only select repositories → <b>latdg/noticies</b>.</li>' +
          '<li><b>Permissions → Repository permissions → Contents:</b> Read and write.</li>' +
          '<li>Prem <b>Generate token</b>, copia\'l i enganxa\'l aquí sota.</li></ol>' +
          '<input type="password" class="fx-tok" placeholder="github_pat_…" autocomplete="off" style="width:100%;font:inherit;padding:8px 10px;border:1px solid #ccc;border-radius:8px">' +
          '<p class="fx-est" style="margin:8px 0 0;font-size:.9rem"></p>' +
          '<div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">' +
          '<button type="button" class="fx-no">Cancel·la</button><button type="button" class="fx-si">Desa el token</button></div>';
        document.body.appendChild(dialeg);
      }
      const inp = dialeg.querySelector(".fx-tok"), est = dialeg.querySelector(".fx-est"), si = dialeg.querySelector(".fx-si");
      dialeg.querySelector(".fx-av").textContent = text || "";
      dialeg.querySelector(".fx-av").hidden = !text;
      inp.value = ""; est.textContent = ""; si.disabled = false;
      const tanca = () => { dialeg.close(); };
      dialeg.querySelector(".fx-no").onclick = () => { tanca(); rebutja(new Error("cancel·lat")); };
      dialeg.oncancel = () => rebutja(new Error("cancel·lat"));
      si.onclick = async () => {
        const t = inp.value.trim();
        if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) { est.textContent = "❌ Això no sembla un token de GitHub (comença per github_pat_)."; return; }
        si.disabled = true; est.textContent = "Comprovant el token…";
        try {
          await provaToken(t);
          est.textContent = "Desant-lo…";
          await desaToken(t);
          tanca(); resol(t);
        } catch (e) { si.disabled = false; est.textContent = "❌ " + e.message; }
      };
      dialeg.showModal();
      setTimeout(() => inp.focus(), 50);
    });
  }
  async function assegura() {
    const t = await llegeixToken();
    return t || demanaToken("");
  }

  // ---------- Pujar ----------
  function aBase64(blob) {
    return new Promise((resol, rebutja) => {
      const r = new FileReader();
      r.onload = () => resol(String(r.result).split(",")[1] || "");
      r.onerror = () => rebutja(new Error("No s'ha pogut llegir el fitxer."));
      r.readAsDataURL(blob);
    });
  }
  async function redueix(file) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || !window.createImageBitmap) return file;
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) { return file; }
    const max = 2000, gran = Math.max(bmp.width, bmp.height);
    if (gran <= max && file.size <= 1.5 * 1024 * 1024) { bmp.close && bmp.close(); return file; }
    const k = Math.min(1, max / gran);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const g = c.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close && bmp.close();
    const b = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
    if (!b || b.size >= file.size) return file;
    const nom = String(file.name || "imatge").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    try { return new File([b], nom, { type: "image/jpeg" }); } catch (e) { b.name = nom; return b; }
  }
  async function pujaUna(file) {
    const t = await assegura();
    let nom = file.name || "";
    if (!nom || /^image\.(png|jpe?g)$/i.test(nom)) {
      const a = new Date();
      nom = "captura-" + a.getFullYear() + dos(a.getMonth() + 1) + dos(a.getDate()) + "-" + dos(a.getHours()) + dos(a.getMinutes()) + dos(a.getSeconds()) + "." + ((file.type || "").split("/")[1] || "bin").replace("jpeg", "jpg");
      try { file = new File([file], nom, { type: file.type }); } catch (e) {}
    }
    const f = await redueix(file);
    if (f.size > MAX_MIDA) throw new Error("«" + nom + "» fa " + midaText(f.size) + ": el màxim és 25 MB.");
    const a = new Date();
    const cami = "fitxers/" + a.getFullYear() + "/" + dos(a.getMonth() + 1) + "/" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) + "-" + nomNet(f.name || nom);
    const contingut = await aBase64(f);
    const fes = () => fetch(API + camiApi(cami), {
      method: "PUT",
      headers: { Authorization: "Bearer " + t, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Fitxer adjunt: " + (f.name || nom), content: contingut })
    });
    let r = await fes();
    if (r.status === 409) { await new Promise(x => setTimeout(x, 1500)); r = await fes(); }
    if (r.status === 401) { tokenLlegit = false; token = ""; throw new Error("El token de GitHub ja no és vàlid (potser ha caducat). Torna-ho a provar i en demanarà un de nou."); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error("GitHub no ha desat «" + nom + "» (" + r.status + (j.message ? ": " + j.message : "") + ")."); }
    const tipus = f.type || file.type || "application/octet-stream";
    cache.set(cami, Promise.resolve(URL.createObjectURL(new Blob([f], { type: tipus }))));
    return { cami: cami, nom: f.name || nom, tipus: tipus, mida: f.size };
  }
  // Els fitxers es pugen d'un en un (GitHub no vol dos commits alhora)
  function puja(file) {
    const p = cua.then(() => pujaUna(file));
    cua = p.catch(() => {});
    return p;
  }

  // ---------- Mostrar ----------
  function url(cami, tipus) {
    if (cache.has(cami)) return cache.get(cami);
    const p = (async () => {
      const t = await llegeixToken();
      if (!t) throw new Error("sense token");
      const r = await fetch(API + camiApi(cami), { headers: { Authorization: "Bearer " + t, Accept: "application/vnd.github.raw" } });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const b = await r.blob();
      return URL.createObjectURL(new Blob([b], { type: tipus || b.type || "application/octet-stream" }));
    })();
    cache.set(cami, p);
    p.catch(() => cache.delete(cami));
    return p;
  }
  function htmlElement(f) {
    const img = /^image\//.test(f.tipus || "");
    const at = ' contenteditable="false" data-fitxer="' + esc(f.cami) + '" data-nom="' + esc(f.nom) + '" data-tipus="' + esc(f.tipus || "") + '"' + (f.mida ? ' data-mida="' + (+f.mida || 0) + '"' : "");
    return img
      ? '<figure class="fx fx-img"' + at + ' title="' + esc(f.nom) + ' · clic per obrir-la"></figure>'
      : '<span class="fx fx-doc"' + at + ' title="Clic per obrir o baixar el fitxer"></span>';
  }
  function element(f) {
    const t = document.createElement("template");
    t.innerHTML = htmlElement(f);
    const el = t.content.firstChild;
    omple(el);
    return el;
  }
  function omple(el) {
    const nom = el.dataset.nom || "fitxer", tipus = el.dataset.tipus || "";
    el.setAttribute("contenteditable", "false");
    if (el.classList.contains("fx-img")) {
      el.innerHTML = "";
      const im = document.createElement("img");
      im.alt = nom; im.draggable = false;
      el.appendChild(im);
      url(el.dataset.fitxer, tipus).then(u => { im.src = u; }).catch(() => { el.classList.add("fx-err"); el.textContent = "🖼️ " + nom + " (no s'ha pogut carregar)"; });
    } else {
      el.textContent = icona(tipus, nom) + " " + nom + (el.dataset.mida ? " · " + midaText(el.dataset.mida) : "");
    }
  }
  function resol(cont) {
    if (!cont) return;
    cont.querySelectorAll(".fx[data-fitxer]").forEach(el => { if (!el.firstChild || el.classList.contains("fx-err")) { el.classList.remove("fx-err"); omple(el); } });
  }
  async function obre(el) {
    const nom = el.dataset.nom || "fitxer", tipus = el.dataset.tipus || "";
    const enPestanya = /^image\/|pdf|^text\/|^audio\/|^video\//.test(tipus);
    const w = enPestanya ? window.open("", "_blank") : null;
    try {
      const u = await url(el.dataset.fitxer, tipus);
      if (w) { w.location.href = u; return; }
      const a = document.createElement("a");
      a.href = u; a.download = nom;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e) {
      if (w) w.close();
      alert("No s'ha pogut obrir «" + nom + "»: " + e.message);
    }
  }

  // ---------- Marca de text (per a Notícies del guió) ----------
  // Un fitxer és un paràgraf sol: [[fitxer:camí|nom|tipus|mida]]
  const MARCA = /^\[\[fitxer:([^|\]\n]+)\|([^|\]\n]*)\|([^|\]\n]*)\|?([0-9]*)\]\]$/;
  function aMarca(el) {
    return "[[fitxer:" + el.dataset.fitxer + "|" + codi(el.dataset.nom) + "|" + codi(el.dataset.tipus) + "|" + (+el.dataset.mida || "") + "]]";
  }
  function deMarca(par) {
    const m = String(par || "").trim().match(MARCA);
    if (!m) return null;
    return htmlElement({ cami: m[1], nom: decodi(m[2]), tipus: decodi(m[3]), mida: m[4] });
  }

  // ---------- Activar una caixa editable ----------
  function posaAlPunt(caixa, x, y) {
    let r = null;
    if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(x, y);
    else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(x, y); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
    if (r && caixa.contains(r.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(r); return true; }
    return false;
  }
  function rangDins(caixa) {
    const s = getSelection();
    if (s.rangeCount && caixa.contains(s.getRangeAt(0).startContainer)) return s.getRangeAt(0);
    const r = document.createRange();
    r.selectNodeContents(caixa); r.collapse(false);
    return r;
  }
  async function insereix(caixa, fitxers, opcions) {
    fitxers = Array.from(fitxers || []).filter(f => f && f.size !== undefined);
    if (!fitxers.length) return;
    let rang = rangDins(caixa);
    for (const f of fitxers) {
      const espera = document.createElement("span");
      espera.className = "fx fx-espera"; espera.contentEditable = "false";
      espera.textContent = "⏳ Pujant " + (f.name || "la imatge") + "…";
      rang.deleteContents();
      rang.insertNode(espera);
      rang = document.createRange(); rang.setStartAfter(espera); rang.collapse(true);
      try {
        const info = await puja(f);
        const el = element(info);
        espera.replaceWith(el);
        // Un espai després, per poder continuar escrivint
        const buit = document.createTextNode(" ");
        el.after(buit);
        rang = document.createRange(); rang.setStartAfter(buit); rang.collapse(true);
        if (opcions && opcions.canvi) opcions.canvi();
      } catch (e) {
        espera.remove();
        if (e.message !== "cancel·lat") alert("📎 " + e.message);
        break;
      }
    }
    const s = getSelection(); s.removeAllRanges(); s.addRange(rang);
  }
  function teFitxers(dt) { return dt && Array.from(dt.types || []).indexOf("Files") >= 0; }
  function activa(caixa, opcions) {
    if (!caixa || caixa.dataset.fxActiu) return;
    caixa.dataset.fxActiu = "1";
    caixa.addEventListener("dragover", e => { if (teFitxers(e.dataTransfer)) { e.preventDefault(); caixa.classList.add("fx-sobre"); } });
    caixa.addEventListener("dragleave", () => caixa.classList.remove("fx-sobre"));
    caixa.addEventListener("drop", e => {
      caixa.classList.remove("fx-sobre");
      if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
      e.preventDefault(); e.stopPropagation();
      caixa.focus();
      posaAlPunt(caixa, e.clientX, e.clientY);
      insereix(caixa, e.dataTransfer.files, opcions);
    });
    caixa.addEventListener("paste", e => {
      const cd = e.clipboardData;
      const fs = cd && cd.files && cd.files.length ? cd.files : null;
      if (!fs) return;
      e.preventDefault(); e.stopPropagation();
      insereix(caixa, fs, opcions);
    }, true);
    caixa.addEventListener("click", e => {
      const el = e.target.closest(".fx[data-fitxer]");
      if (el && caixa.contains(el)) { e.preventDefault(); obre(el); }
    });
    resol(caixa);
  }
  function tria(caixa, opcions) {
    const inp = document.createElement("input");
    inp.type = "file"; inp.multiple = true;
    inp.onchange = () => { caixa.focus(); insereix(caixa, inp.files, opcions); };
    inp.click();
  }

  // Estils comuns
  const css = document.createElement("style");
  css.textContent =
    ".fx{cursor:pointer;user-select:none}" +
    ".fx-img{display:block;margin:8px 0;max-width:100%}" +
    ".fx-img img{display:block;max-width:100%;max-height:420px;border-radius:6px;border:1px solid #e3e1db}" +
    ".fx-doc,.fx-espera{display:inline-block;margin:2px 0;padding:3px 10px;border:1px solid #d8d6cf;border-radius:999px;background:#f4f3ef;font-size:.9em;line-height:1.5;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}" +
    ".fx-espera{color:#6b6b66;cursor:default}" +
    ".fx-err{color:#a3161b}" +
    ".fx-sobre{outline:2px dashed #b4462c;outline-offset:2px}" +
    ".fx-dialeg{max-width:520px;border:1px solid #ccc;border-radius:12px;padding:18px;font:15px/1.45 system-ui,-apple-system,'Segoe UI',sans-serif}" +
    ".fx-dialeg::backdrop{background:rgba(0,0,0,.35)}";
  document.head.appendChild(css);

  window.Fitxers = {
    configura: o => { crida = o.crida; },
    activa, tria, resol, element, htmlElement, aMarca, deMarca, MARCA,
    CONFIG_DIA,
    canviaToken: () => demanaToken("Escriu el token nou.")
  };
})();
