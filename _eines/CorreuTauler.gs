// =============================================================================
// CORREU DEL TAULER — Ignasi Corney · 10.11.2026
//
// El mateix fitxer serveix per a qualsevol compte de Google (icorney@xtec.cat,
// ignasicorney@ieslabisbal.cat, el compte de correu de La TdG…). Es posa a
// script.google.com amb la sessió oberta en aquell compte i deixa que el
// tauler (o La TdG redacció) llegeixi, arxivi, esborri, envii i programi correus.
//
// POSADA EN MARXA (una vegada per compte):
//   1. script.google.com > Projecte nou. Enganxa-hi aquest fitxer sencer.
//   2. Configuració del projecte (roda dentada) > Propietats de l'script >
//      Afegeix: nom PIN, valor = la clau de La TdG.
//   3. Implementa > Implementació nova > Tipus: Aplicació web.
//      Executa com a: Jo. Qui hi té accés: Qualsevol usuari.
//      Autoritza els permisos que demani (Gmail).
//   4. Copia l'URL que acaba en /exec i posa-la al tauler (⚙️ Comptes).
//
// OPCIONAL (11.11.2026), per a una adreça d'un altre proveïdor que arriba a
// aquest Gmail per reenviament (p. ex. latdg@laguait.cat a latdg-podcast@gmail.com):
//   REMITENT = latdg@laguait.cat   → els correus surten amb aquesta adreça
//                                    (cal tenir-la a Gmail > «Envia correu com a»)
//   FILTRE   = to:latdg@laguait.cat → només es mostren els correus adreçats a ella
//
// Peticions (POST, cos JSON, sempre amb «pin»):
//   { accio: "compte" }                               → { correu, quota }
//   { accio: "llista", q, max }                       → { fils: [...] }
//   { accio: "llegeix", id, marca }                   → { fil }  (adjunts: [{ nom, mida, tipus }])
//   { accio: "adjunt", id, m, a }                     → { nom, tipus, b64 }: l'adjunt «a» del missatge «m»
//                                                       del fil (12.11.2026, per llegir-lo i baixar-lo al tauler)
//   { accio: "llegit", id, llegit }                   → marca com a llegit / no llegit
//   { accio: "arxiva", id }                           → treu de la safata d'entrada
//   { accio: "desarxiva", id }                        → el torna a la safata d'entrada (12.11.2026, «Desfés»)
//   { accio: "esborra", id }                          → a la paperera (30 dies per recuperar-lo)
//   { accio: "envia", a, cc, cco, assumpte, cos, id, tots }  → envia (o respon al fil «id»)
//   { accio: "programa", ..., quan }                  → l'envia a l'hora «quan» (ISO)
//   { accio: "programats" }                           → { programats: [...] }
//   { accio: "anulla", clau }                         → anul·la un enviament programat
//   { accio: "fitxers", carpeta }                     → els fulls .xlsx d'una carpeta de Drive
//                                                       (per importar les notes al tauler)
//
// CLASSROOM I FORMULARIS (13.11.2026; només al compte d'ieslabisbal.cat):
//   Cal afegir-hi el servei avançat «Google Classroom API» (Serveis > +) i fer una
//   implementació nova (Implementa > Gestiona les implementacions > Edita > Versió nova).
//   { accio: "classroom-cursos" }                     → { cursos: [{ id, nom, seccio }] }
//   { accio: "classroom-tasques", curs }              → { tasques: [{ id, titol, max, data }] }
//   { accio: "classroom-lliuraments", curs, tasca, revisa }
//                                                     → { alumnes: [...], lliuraments: [{ email, estat, nota, feina }] }
//                                                       amb «revisa», de qui no ha lliurat s'obren els documents per veure
//                                                       si hi ha escrit alguna cosa: feina = { escrit, paraules }
//   { accio: "classroom-alumnes", curs }              → { alumnes: [{ email, nom, cognoms }] }
//   { accio: "formulari-crea", titol, text, preguntes } → { id, url, edita }: qüestionari autocorregible
//   { accio: "formulari-respostes", id }              → { max, respostes: [{ email, punts, data }] }
//   { accio: "classroom-publica", curs, titol, descripcio, url, data, esborrany }
//                                                     → { id, enllac }: tasca nova amb el formulari enllaçat
//   { accio: "formulari-tanca", id, quan }            → tanca les respostes ara (sense «quan») o a l'hora «quan» (ISO)
//                                                       (en lloc d'«id» es pot passar «url», p. ex. el d'un qüestionari d'una tasca del Classroom)
//   { accio: "formulari-obre", id }                   → torna a acceptar respostes i anul·la el tancament programat
//   { accio: "formulari-estat", id }                  → { obert, tancament }
//
// VÍDEOS (13.11.2026): la IA mira un fragment d'un vídeo públic de YouTube i en fa les preguntes.
//   Cal la propietat de l'script GEMINI_KEY (la mateixa clau de Gemini de l'assistent).
//   Opcional: GEMINI_MODEL (per defecte, gemini-flash-latest).
//   { accio: "video-preguntes", url, inici, final, sistema, text } → { resposta }: inici i final en segons
//   «classroom-publica» accepta també «video»: l'enllaç del fragment, que s'afegeix com a material de la tasca
//
// MODEL DE RESERVA (14.11.2026): quan Gemini està saturat, el tauler hi passa la mateixa petició.
//   Cal la propietat de l'script GROQ_KEY (clau gratuïta de console.groq.com > API Keys, sense targeta).
//   El model es tria sol entre els que Groq ofereix aquell dia (gpt-oss, Qwen…); opcional: GROQ_MODEL per fixar-ne un.
//   { accio: "ia-reserva", sistema, text, json, imatge } → { resposta, model }  (imatge: { tipus, dades } en base64)
//   Els vídeos no hi poden anar (aquests models no miren YouTube): cal enganxar-ne la transcripció.
// =============================================================================

function doGet() {
  return json_({ ok: true, servei: "Correu del tauler" });
}

function doPost(e) {
  let cos;
  try { cos = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: "Petició no vàlida" }); }
  const pin = PropertiesService.getScriptProperties().getProperty("PIN");
  if (!pin || String(cos.pin || "") !== String(pin)) {
    Utilities.sleep(1500);
    return json_({ ok: false, error: "La clau no és correcta.", clau: true });
  }
  try {
    switch (cos.accio) {
      case "compte":
        return json_({ ok: true, correu: Session.getEffectiveUser().getEmail(), quota: MailApp.getRemainingDailyQuota() });

      case "llista": {
        const filtre = PropertiesService.getScriptProperties().getProperty("FILTRE") || "";
        const q = String(cos.q || "in:inbox") + (filtre ? " " + filtre : "");
        const max = Math.min(Math.max(Number(cos.max) || 25, 1), 50);
        const fils = GmailApp.search(q, 0, max).map(function (f) {
          const m = f.getMessages();
          const darrer = m[m.length - 1];
          return {
            id: f.getId(),
            assumpte: f.getFirstMessageSubject() || "(sense assumpte)",
            de: darrer.getFrom(),
            data: darrer.getDate().toISOString(),
            noLlegit: f.isUnread(),
            n: m.length,
            adjunts: m.reduce(function (s, x) { return s + x.getAttachments({ includeInlineImages: false }).length; }, 0),
            fragment: netejaText_(darrer.getPlainBody()).slice(0, 220)
          };
        });
        return json_({ ok: true, fils: fils });
      }

      case "llegeix": {
        const f = GmailApp.getThreadById(String(cos.id));
        if (!f) return json_({ ok: false, error: "No s'ha trobat aquest correu." });
        if (cos.marca) f.markRead();
        return json_({
          ok: true,
          fil: {
            id: f.getId(),
            assumpte: f.getFirstMessageSubject() || "(sense assumpte)",
            enllac: f.getPermalink(),
            missatges: f.getMessages().map(function (m) {
              return {
                de: m.getFrom(), a: m.getTo(), cc: m.getCc(), data: m.getDate().toISOString(),
                cos: m.getPlainBody().slice(0, 30000),
                adjunts: m.getAttachments({ includeInlineImages: false }).map(function (a) { return { nom: a.getName(), mida: a.getSize(), tipus: a.getContentType() }; })
              };
            })
          }
        });
      }

      case "adjunt": {
        const f = GmailApp.getThreadById(String(cos.id));
        if (!f) return json_({ ok: false, error: "No s'ha trobat aquest correu." });
        const m = f.getMessages()[Number(cos.m)];
        const a = m && m.getAttachments({ includeInlineImages: false })[Number(cos.a)];
        if (!a) return json_({ ok: false, error: "No s'ha trobat aquest adjunt." });
        if (a.getSize() > 25 * 1024 * 1024) return json_({ ok: false, error: "L'adjunt fa més de 25 MB: obre'l a Gmail." });
        return json_({ ok: true, nom: a.getName(), tipus: a.getContentType(), b64: Utilities.base64Encode(a.getBytes()) });
      }

      case "llegit": {
        const f = GmailApp.getThreadById(String(cos.id));
        if (cos.llegit === false) f.markUnread(); else f.markRead();
        return json_({ ok: true });
      }

      case "arxiva": GmailApp.getThreadById(String(cos.id)).moveToArchive(); return json_({ ok: true });
      case "desarxiva": GmailApp.getThreadById(String(cos.id)).moveToInbox(); return json_({ ok: true });
      case "esborra": GmailApp.getThreadById(String(cos.id)).moveToTrash(); return json_({ ok: true });

      case "envia":
        envia_(cos);
        return json_({ ok: true });

      case "programa": {
        const quan = new Date(cos.quan);
        if (isNaN(quan.getTime())) return json_({ ok: false, error: "L'hora de l'enviament no és vàlida." });
        if (quan.getTime() < Date.now() - 60000) return json_({ ok: false, error: "L'hora de l'enviament ja ha passat." });
        valida_(cos);
        const clau = "prog_" + Utilities.getUuid();
        const dades = { a: cos.a, cc: cos.cc || "", cco: cos.cco || "", assumpte: cos.assumpte || "", cos: cos.cos || "", id: cos.id || "", tots: !!cos.tots, quan: quan.toISOString() };
        PropertiesService.getScriptProperties().setProperty(clau, JSON.stringify(dades));
        asseguraActivador_();
        return json_({ ok: true, clau: clau });
      }

      case "programats":
        return json_({ ok: true, programats: programats_() });

      case "anulla":
        if (String(cos.clau || "").indexOf("prog_") === 0) PropertiesService.getScriptProperties().deleteProperty(String(cos.clau));
        if (!programats_().length) treuActivador_();
        return json_({ ok: true });

      case "fitxers": {
        const carpeta = DriveApp.getFolderById(String(cos.carpeta));
        const it = carpeta.getFiles(), fitxers = [];
        while (it.hasNext() && fitxers.length < 20) {
          const f = it.next();
          if (!/\.xlsx?$/i.test(f.getName()) && f.getMimeType() !== MimeType.MICROSOFT_EXCEL && f.getMimeType() !== MimeType.GOOGLE_SHEETS) continue;
          const blob = f.getMimeType() === MimeType.GOOGLE_SHEETS
            ? UrlFetchApp.fetch("https://docs.google.com/spreadsheets/d/" + f.getId() + "/export?format=xlsx", { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() } }).getBlob()
            : f.getBlob();
          fitxers.push({ nom: f.getName().replace(/\.xlsx?$/i, "") + ".xlsx", b64: Utilities.base64Encode(blob.getBytes()) });
        }
        return json_({ ok: true, fitxers: fitxers });
      }

      case "classroom-cursos": {
        const cursos = [];
        let pg;
        do {
          const r = Classroom.Courses.list({ teacherId: "me", courseStates: ["ACTIVE"], pageSize: 100, pageToken: pg });
          (r.courses || []).forEach(function (c) { cursos.push({ id: c.id, nom: c.name, seccio: c.section || "" }); });
          pg = r.nextPageToken;
        } while (pg);
        return json_({ ok: true, cursos: cursos });
      }

      case "classroom-tasques": {
        const tasques = [];
        let pg;
        do {
          const r = Classroom.Courses.CourseWork.list(String(cos.curs), { pageSize: 100, pageToken: pg, orderBy: "updateTime desc" });
          (r.courseWork || []).forEach(function (t) {
            const fm = (t.materials || []).filter(function (m) { return m.form && m.form.formUrl; })[0];
            tasques.push({ id: t.id, titol: t.title, max: t.maxPoints || 0, data: String(t.creationTime || "").slice(0, 10), form: fm ? fm.form.formUrl : "" });
          });
          pg = r.nextPageToken;
        } while (pg && tasques.length < 300);
        return json_({ ok: true, tasques: tasques });
      }

      case "classroom-alumnes":
        return json_({ ok: true, alumnes: alumnesCurs_(String(cos.curs)) });

      case "classroom-lliuraments": {
        const alumnes = alumnesCurs_(String(cos.curs)), perId = {};
        alumnes.forEach(function (a) { perId[a.id] = a; });
        const lliuraments = [];
        let pg;
        do {
          const r = Classroom.Courses.CourseWork.StudentSubmissions.list(String(cos.curs), String(cos.tasca), { pageSize: 100, pageToken: pg });
          (r.studentSubmissions || []).forEach(function (l) {
            const a = perId[l.userId]; if (!a) return;
            const nota = l.assignedGrade != null ? l.assignedGrade : (l.draftGrade != null ? l.draftGrade : null);
            const ids = ((l.assignmentSubmission && l.assignmentSubmission.attachments) || []).map(function (x) { return x.driveFile && x.driveFile.id; }).filter(Boolean);
            lliuraments.push({ email: a.email, estat: l.state, nota: nota, ids: ids });
          });
          pg = r.nextPageToken;
        } while (pg);
        if (cos.revisa) revisaFeina_(String(cos.curs), String(cos.tasca), lliuraments);
        lliuraments.forEach(function (l) { delete l.ids; });
        return json_({ ok: true, alumnes: alumnes, lliuraments: lliuraments });
      }

      case "classroom-publica": {
        const t = {
          title: String(cos.titol || "Qüestionari").slice(0, 300),
          description: String(cos.descripcio || ""),
          materials: [{ link: { url: String(cos.url) } }].concat(cos.video ? [{ link: { url: String(cos.video) } }] : []),
          workType: "ASSIGNMENT",
          state: cos.esborrany ? "DRAFT" : "PUBLISHED",
          maxPoints: 10
        };
        const m = String(cos.data || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {   // a les 23:59 d'aquell dia, hora de Catalunya
          const fi = new Date(Utilities.formatDate(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12), "Europe/Madrid", "yyyy-MM-dd'T'23:59:00XXX"));
          t.dueDate = { year: fi.getUTCFullYear(), month: fi.getUTCMonth() + 1, day: fi.getUTCDate() };
          t.dueTime = { hours: fi.getUTCHours(), minutes: fi.getUTCMinutes() };
        }
        const r = Classroom.Courses.CourseWork.create(t, String(cos.curs));
        return json_({ ok: true, id: r.id, enllac: r.alternateLink || "" });
      }

      case "formulari-tanca": {
        const id = formulari_(cos).getId(), quan = cos.quan ? new Date(cos.quan) : null;
        if (!quan || isNaN(quan.getTime()) || quan.getTime() <= Date.now()) {
          tancaFormulari_(id);
          return json_({ ok: true, obert: false, tancament: "" });
        }
        PropertiesService.getScriptProperties().setProperty("tanca_" + id, quan.toISOString());
        const hi = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "tancaFormularis"; });
        if (!hi) ScriptApp.newTrigger("tancaFormularis").timeBased().everyMinutes(5).create();
        return json_({ ok: true, obert: true, tancament: quan.toISOString() });
      }

      case "formulari-obre": {
        const f = formulari_(cos);
        PropertiesService.getScriptProperties().deleteProperty("tanca_" + f.getId());
        f.setAcceptingResponses(true);
        return json_({ ok: true, obert: true, tancament: "" });
      }

      case "formulari-estat": {
        const f = formulari_(cos);
        return json_({ ok: true, obert: f.isAcceptingResponses(), tancament: PropertiesService.getScriptProperties().getProperty("tanca_" + f.getId()) || "" });
      }

      case "formulari-crea": {
        const pr = cos.preguntes || [];
        if (!pr.length) throw new Error("No hi ha preguntes.");
        const form = FormApp.create(String(cos.titol || "Qüestionari"));
        form.setIsQuiz(true);
        form.setCollectEmail(true);
        try { form.setRequireLogin(true); form.setLimitOneResponsePerUser(true); } catch (e) {}
        form.setShowLinkToRespondAgain(false);
        form.setConfirmationMessage("Respostes enviades. Gràcies!");
        if (cos.text) form.setDescription(String(cos.text).slice(0, 4000));
        pr.forEach(function (q) {
          const opcions = (q.opcions || []).map(String);
          const bones = (q.correctes || []).map(Number);
          if (opcions.length < 2) return;
          const it = q.tipus === "multiple" ? form.addCheckboxItem() : form.addMultipleChoiceItem();
          it.setTitle(String(q.enunciat || "").slice(0, 900)).setPoints(Number(q.punts) > 0 ? Number(q.punts) : 1).setRequired(true);
          it.setChoices(opcions.map(function (o, i) { return it.createChoice(o, bones.indexOf(i) >= 0); }));
        });
        return json_({ ok: true, id: form.getId(), url: form.shortenFormUrl(form.getPublishedUrl()), edita: form.getEditUrl() });
      }

      case "video-preguntes": {
        const props = PropertiesService.getScriptProperties();
        const clau = props.getProperty("GEMINI_KEY");
        if (!clau) throw new Error("Falta la propietat GEMINI_KEY a l'script del compte d'ieslabisbal.cat (Configuració del projecte > Propietats de l'script).");
        const model = props.getProperty("GEMINI_MODEL") || "gemini-flash-latest";
        const m = String(cos.url || "").match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})/);
        if (!m) throw new Error("L'enllaç no és d'un vídeo de YouTube.");
        const inici = Math.max(0, Math.floor(Number(cos.inici) || 0)), final = Math.floor(Number(cos.final) || 0);
        if (!(final > inici)) throw new Error("El final del fragment ha de ser posterior a l'inici.");
        const peticio = {
          systemInstruction: { parts: [{ text: String(cos.sistema || "") }] },
          contents: [{ role: "user", parts: [
            { fileData: { fileUri: "https://www.youtube.com/watch?v=" + m[1] }, videoMetadata: { startOffset: inici + "s", endOffset: final + "s" } },
            { text: String(cos.text || "Mira el fragment i prepara les preguntes.") }
          ] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.4 }
        };
        // 13.11.2026: si un model està saturat (503/429/500) es torna a provar i després es passa al següent;
        // si un model ja no existeix o està retirat, es passa directament al següent
        const models = [model].concat(["gemini-flash-latest", "gemini-3.8-flash", "gemini-flash-lite-latest"].filter(function (x) { return x !== model; }));
        let r = null, d = {}, msg = "";
        fora:
        for (let i = 0; i < models.length; i++) {
          for (let intent = 0; intent < 2; intent++) {
            if (intent) Utilities.sleep(4000);
            r = UrlFetchApp.fetch("https://generativelanguage.googleapis.com/v1beta/models/" + models[i] + ":generateContent", {
              method: "post", contentType: "application/json", headers: { "x-goog-api-key": clau },
              payload: JSON.stringify(peticio), muteHttpExceptions: true
            });
            d = {};
            try { d = JSON.parse(r.getContentText()); } catch (e) {}
            if (r.getResponseCode() === 200) break fora;
            msg = (d.error && d.error.message) || ("error " + r.getResponseCode());
            if (/no longer available|not found|not supported|deprecated|retired/i.test(msg)) continue fora;   // model retirat: el següent
            if ([429, 500, 503].indexOf(r.getResponseCode()) < 0) break fora;                                  // un altre error: s'atura
          }
        }
        if (r.getResponseCode() !== 200) {
          if (/api key|api_key/i.test(msg)) throw new Error("La clau GEMINI_KEY no és vàlida; revisa-la a les propietats de l'script.");
          if ([429, 500, 503].indexOf(r.getResponseCode()) >= 0 || /no longer available|not found|deprecated|retired/i.test(msg)) throw new Error("Els models de Gemini estan saturats ara mateix i només Gemini pot mirar vídeos. Enganxa la transcripció del fragment (a YouTube: «…» > «Mostra la transcripció») i les preguntes es faran amb el model de reserva; o torna-ho a provar d'aquí a uns minuts.");
          if (/youtube|video|file/i.test(msg)) throw new Error("La IA no ha pogut obrir el vídeo: ha de ser públic a YouTube (els ocults o privats no hi van). També pots enganxar-ne la transcripció.");
          throw new Error("Gemini: " + msg);
        }
        const parts = (((d.candidates || [])[0] || {}).content || {}).parts || [];
        const text = parts.map(function (p) { return p.text || ""; }).join("").trim();
        if (!text) throw new Error("La IA no ha retornat cap resposta; torna-ho a provar.");
        return json_({ ok: true, resposta: text });
      }

      case "ia-reserva": {
        return json_(Object.assign({ ok: true }, reserva_(cos)));
      }

      case "formulari-respostes": {
        const form = FormApp.openById(String(cos.id));
        let max = 0;
        form.getItems().forEach(function (it) {
          const t = it.getType();
          if (t === FormApp.ItemType.MULTIPLE_CHOICE) max += it.asMultipleChoiceItem().getPoints();
          else if (t === FormApp.ItemType.CHECKBOX) max += it.asCheckboxItem().getPoints();
        });
        const respostes = form.getResponses().map(function (r) {
          let punts = 0;
          r.getGradableItemResponses().forEach(function (ir) { punts += Number(ir.getScore()) || 0; });
          return { email: String(r.getRespondentEmail() || "").toLowerCase(), punts: punts, data: r.getTimestamp().toISOString() };
        });
        return json_({ ok: true, max: max, respostes: respostes });
      }
    }
    return json_({ ok: false, error: "Acció desconeguda" });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message || err) });
  }
}

// S'executa sola cada 5 minuts mentre hi hagi correus programats.
function enviaProgramats() {
  const bloqueig = LockService.getScriptLock();
  if (!bloqueig.tryLock(20000)) return;
  try {
    const props = PropertiesService.getScriptProperties();
    programats_().forEach(function (p) {
      if (new Date(p.quan).getTime() > Date.now()) return;
      try { envia_(p); props.deleteProperty(p.clau); }
      catch (err) { console.error("No s'ha pogut enviar «" + p.assumpte + "»: " + err); }
    });
    if (!programats_().length) treuActivador_();
  } finally { bloqueig.releaseLock(); }
}

// S'executa sola cada 5 minuts mentre hi hagi formularis amb el tancament programat.
function tancaFormularis() {
  const props = PropertiesService.getScriptProperties(), totes = props.getProperties();
  let queden = 0;
  Object.keys(totes).forEach(function (k) {
    if (k.indexOf("tanca_") !== 0) return;
    if (new Date(totes[k]).getTime() > Date.now()) { queden++; return; }
    try { tancaFormulari_(k.slice(6)); } catch (err) { console.error("No s'ha pogut tancar " + k + ": " + err); props.deleteProperty(k); }
  });
  if (!queden) ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "tancaFormularis") ScriptApp.deleteTrigger(t); });
}

// El formulari per «id» o per «url» (cal que sigui teu, o que en siguis editor)
function formulari_(cos) {
  try { return cos.id ? FormApp.openById(String(cos.id)) : FormApp.openByUrl(String(cos.url)); }
  catch (err) { throw new Error("No es pot obrir el formulari: cal que en siguis el propietari o editor."); }
}

function tancaFormulari_(id) {
  FormApp.openById(id).setAcceptingResponses(false).setCustomClosedFormMessage("Aquest qüestionari ja està tancat.");
  PropertiesService.getScriptProperties().deleteProperty("tanca_" + id);
}

function valida_(c) {
  if (!c.id && !String(c.a || "").trim()) throw new Error("Falta el destinatari.");
  if (!String(c.cos || "").trim()) throw new Error("El missatge és buit.");
}

function envia_(c) {
  valida_(c);
  const opcions = {};
  const remitent = PropertiesService.getScriptProperties().getProperty("REMITENT");
  if (remitent) opcions.from = remitent;
  if (c.cc) opcions.cc = c.cc;
  if (c.cco) opcions.bcc = c.cco;
  if (c.id) {
    const f = GmailApp.getThreadById(String(c.id));
    const m = f.getMessages();
    const darrer = m[m.length - 1];
    if (c.tots) darrer.replyAll(c.cos, opcions); else darrer.reply(c.cos, opcions);
  } else {
    GmailApp.sendEmail(c.a, c.assumpte || "(sense assumpte)", c.cos, opcions);
  }
}

function programats_() {
  const props = PropertiesService.getScriptProperties().getProperties();
  return Object.keys(props).filter(function (k) { return k.indexOf("prog_") === 0; }).map(function (k) {
    const p = JSON.parse(props[k]); p.clau = k; return p;
  }).sort(function (x, y) { return x.quan < y.quan ? -1 : 1; });
}

function asseguraActivador_() {
  const hi = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "enviaProgramats"; });
  if (!hi) ScriptApp.newTrigger("enviaProgramats").timeBased().everyMinutes(5).create();
}

function treuActivador_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === "enviaProgramats") ScriptApp.deleteTrigger(t); });
}

// Mira si qui no ha lliurat la tasca té feina feta als seus documents: compara el text de les seves
// còpies amb el de la plantilla de la tasca (Documents de Google) o, per a altres fitxers, si s'han modificat.
function revisaFeina_(curs, tasca, lliuraments) {
  const pendents = lliuraments.filter(function (l) { return l.estat !== "TURNED_IN" && l.estat !== "RETURNED"; });
  if (!pendents.length) return;
  const capc = { headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true };
  const API = "https://www.googleapis.com/drive/v3/files/";
  const mots = function (t) { return String(t || "").replace(/\s+/g, " ").trim().split(" ").filter(String).length; };
  // Text de la plantilla (els documents que hi vas adjuntar)
  let plantilla = "";
  try {
    const t = Classroom.Courses.CourseWork.get(curs, tasca);
    const pids = (t.materials || []).map(function (m) { return m.driveFile && m.driveFile.driveFile && m.driveFile.driveFile.id; }).filter(Boolean);
    if (pids.length) plantilla = UrlFetchApp.fetchAll(pids.map(function (id) { return Object.assign({ url: API + id + "/export?mimeType=text/plain" }, capc); }))
      .map(function (r) { return r.getResponseCode() === 200 ? r.getContentText() : ""; }).join("\n");
  } catch (err) {}
  const motsPlantilla = mots(plantilla);
  const ids = [];
  pendents.forEach(function (l) { l.ids.forEach(function (id) { ids.push(id); }); });
  if (!ids.length) { pendents.forEach(function (l) { l.feina = { escrit: false, paraules: 0 }; }); return; }
  const meta = {};
  UrlFetchApp.fetchAll(ids.map(function (id) { return Object.assign({ url: API + id + "?fields=id,mimeType,createdTime,modifiedTime" }, capc); }))
    .forEach(function (r, i) { if (r.getResponseCode() === 200) meta[ids[i]] = JSON.parse(r.getContentText()); });
  const docs = ids.filter(function (id) { return meta[id] && meta[id].mimeType === "application/vnd.google-apps.document"; });
  const text = {};
  for (let i = 0; i < docs.length; i += 20) {   // de 20 en 20, per no saturar Drive
    const tros = docs.slice(i, i + 20);
    UrlFetchApp.fetchAll(tros.map(function (id) { return Object.assign({ url: API + id + "/export?mimeType=text/plain" }, capc); }))
      .forEach(function (r, j) { text[tros[j]] = r.getResponseCode() === 200 ? r.getContentText() : null; });
  }
  pendents.forEach(function (l) {
    let escrit = false, paraules = 0;
    l.ids.forEach(function (id) {
      const m = meta[id]; if (!m) return;
      if (text[id] != null) {
        const n = mots(text[id]) - motsPlantilla;
        if (n > paraules) paraules = n;
        if (n >= 3) escrit = true;
      } else if (new Date(m.modifiedTime) - new Date(m.createdTime) > 120000) escrit = true;   // altres fitxers: modificats després de crear-se
    });
    l.feina = { escrit: escrit, paraules: Math.max(0, paraules) };
  });
}

// Alumnes d'un curs del Classroom: id, correu, nom i cognoms
function alumnesCurs_(curs) {
  const l = [];
  let pg;
  do {
    const r = Classroom.Courses.Students.list(curs, { pageSize: 100, pageToken: pg });
    (r.students || []).forEach(function (s) {
      const p = s.profile || {}, n = p.name || {};
      l.push({ id: s.userId, email: String(p.emailAddress || "").toLowerCase(), nom: n.givenName || "", cognoms: n.familyName || "", complet: n.fullName || "" });
    });
    pg = r.nextPageToken;
  } while (pg);
  return l;
}

// Model de reserva (Groq) per a l'Assistent quan Gemini està saturat (14.11.2026)
const GROQ_ = "https://api.groq.com/openai/v1/";
function modelsGroq_(clau) {
  const cache = CacheService.getScriptCache();
  const desat = cache.get("groq_models");
  if (desat) return JSON.parse(desat);
  const r = UrlFetchApp.fetch(GROQ_ + "models", { headers: { Authorization: "Bearer " + clau }, muteHttpExceptions: true });
  if (r.getResponseCode() === 401) throw new Error("La clau GROQ_KEY no és vàlida; revisa-la a les propietats de l'script.");
  if (r.getResponseCode() !== 200) return [];
  let d = {};
  try { d = JSON.parse(r.getContentText()); } catch (e) {}
  const ids = (d.data || []).filter(function (m) { return m && m.id && m.active !== false; }).map(function (m) { return m.id; })
    .filter(function (id) { return !/whisper|guard|tts|playai|orpheus|distil|compound|allam/i.test(id); });
  cache.put("groq_models", JSON.stringify(ids), 21600);
  return ids;
}
function reserva_(cos) {
  const props = PropertiesService.getScriptProperties();
  const clau = props.getProperty("GROQ_KEY");
  if (!clau) throw new Error("Gemini està saturat i el model de reserva no està configurat: falta la propietat GROQ_KEY a l'script del compte d'ieslabisbal.cat.");
  const json = !!cos.json, ambImatge = !!(cos.imatge && cos.imatge.dades);
  const tots = modelsGroq_(clau);
  // Ordre de preferència: models grans primer; amb imatge, només els que en llegeixen
  const ordre = ambImatge ? [/scout|maverick|vision|vl\b|-vl/i] : [/gpt-oss-120b/i, /qwen/i, /kimi/i, /llama-4|scout|maverick/i, /gpt-oss/i, /llama/i, /./];
  let models = [];
  ordre.forEach(function (re) { tots.forEach(function (id) { if (re.test(id) && models.indexOf(id) < 0) models.push(id); }); });
  const fix = props.getProperty("GROQ_MODEL");
  if (fix && !ambImatge) models = [fix].concat(models.filter(function (x) { return x !== fix; }));
  models = models.slice(0, 4);
  if (!models.length) throw new Error(ambImatge ? "Gemini està saturat i el model de reserva no llegeix imatges; torna-ho a provar d'aquí a uns minuts." : "Gemini està saturat i Groq no respon ara mateix; torna-ho a provar d'aquí a uns minuts.");
  let contingut = String(cos.text || "");
  if (ambImatge) contingut = [
    { type: "text", text: contingut },
    { type: "image_url", image_url: { url: "data:" + (cos.imatge.tipus || "image/jpeg") + ";base64," + cos.imatge.dades } }
  ];
  const missatges = [];
  if (cos.sistema) missatges.push({ role: "system", content: String(cos.sistema) + (json ? "\nRespon només amb un objecte JSON vàlid." : "") });
  missatges.push({ role: "user", content: contingut });
  let msg = "";
  for (let i = 0; i < models.length; i++) {
    for (let intent = 0; intent < 2; intent++) {
      if (intent) Utilities.sleep(3000);
      const peticio = { model: models[i], messages: missatges, temperature: 0.4 };
      if (json && intent === 0) peticio.response_format = { type: "json_object" };   // el 2n intent, sense (alguns models no l'admeten)
      const r = UrlFetchApp.fetch(GROQ_ + "chat/completions", {
        method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + clau },
        payload: JSON.stringify(peticio), muteHttpExceptions: true
      });
      let d = {};
      try { d = JSON.parse(r.getContentText()); } catch (e) {}
      if (r.getResponseCode() === 200) {
        const text = String((((d.choices || [])[0] || {}).message || {}).content || "").trim();
        if (text) return { resposta: text, model: models[i] };
        msg = "resposta buida"; continue;
      }
      msg = (d.error && d.error.message) || ("error " + r.getResponseCode());
      if (r.getResponseCode() === 401) throw new Error("La clau GROQ_KEY no és vàlida; revisa-la a les propietats de l'script.");
      if (r.getResponseCode() === 404 || /decommissioned|not found|does not exist/i.test(msg)) { CacheService.getScriptCache().remove("groq_models"); break; }
      if (r.getResponseCode() === 400 && intent === 0) continue;   // es torna a provar sense el format JSON
      if ([429, 500, 502, 503].indexOf(r.getResponseCode()) < 0) break;   // un altre error: el model següent
    }
  }
  throw new Error("Gemini i el model de reserva estan saturats ara mateix; torna-ho a provar d'aquí a uns minuts. (" + msg + ")");
}

function netejaText_(t) {
  return String(t || "").replace(/\s+/g, " ").trim();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
