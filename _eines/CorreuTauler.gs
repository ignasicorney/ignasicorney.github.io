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
//   { accio: "classroom-lliuraments", curs, tasca }   → { alumnes: [...], lliuraments: [{ email, estat, nota }] }
//   { accio: "classroom-alumnes", curs }              → { alumnes: [{ email, nom, cognoms }] }
//   { accio: "formulari-crea", titol, text, preguntes } → { id, url, edita }: qüestionari autocorregible
//   { accio: "formulari-respostes", id }              → { max, respostes: [{ email, punts, data }] }
//   { accio: "classroom-publica", curs, titol, descripcio, url, data, esborrany }
//                                                     → { id, enllac }: tasca nova amb el formulari enllaçat
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
          (r.courseWork || []).forEach(function (t) { tasques.push({ id: t.id, titol: t.title, max: t.maxPoints || 0, data: String(t.creationTime || "").slice(0, 10) }); });
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
            lliuraments.push({ email: a.email, estat: l.state, nota: nota });
          });
          pg = r.nextPageToken;
        } while (pg);
        return json_({ ok: true, alumnes: alumnes, lliuraments: lliuraments });
      }

      case "classroom-publica": {
        const t = {
          title: String(cos.titol || "Qüestionari").slice(0, 300),
          description: String(cos.descripcio || ""),
          materials: [{ link: { url: String(cos.url) } }],
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

function netejaText_(t) {
  return String(t || "").replace(/\s+/g, " ").trim();
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
