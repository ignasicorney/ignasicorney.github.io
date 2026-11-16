// =============================================================================
// Fórmula 1 (17.11.2026): proper GP amb compte enrere i sessions en hora local,
// temps al circuit, classificacions, darrer GP i calendari (Jolpica / API d'Ergast,
// Open-Meteo). A dins, amb la clau de La TdG, un monitor per a un sol directe de vídeo.
// =============================================================================
(() => {
  const $ = id => document.getElementById(id);
  if (!$("f1")) return;
  const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const API = "https://api.jolpi.ca/ergast/f1/";
  const DIES = ["dg.", "dl.", "dt.", "dc.", "dj.", "dv.", "ds."];
  const dd = n => String(n).padStart(2, "0");
  const data = d => dd(d.getDate()) + "." + dd(d.getMonth() + 1) + "." + d.getFullYear();
  const hora = d => dd(d.getHours()) + ":" + dd(d.getMinutes());
  const diaHora = d => DIES[d.getDay()] + " " + data(d) + ", " + hora(d);
  const quan = s => (s && s.date) ? new Date(s.date + "T" + (s.time || "12:00:00Z")) : null;
  const ls = {
    get(k, def) { try { const v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); } catch (e) { return def; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  };
  const teClau = () => { try { return !!localStorage.getItem("tauler.clau"); } catch (e) { return false; } };

  // ---------------- Estils ----------------
  const css = document.createElement("style");
  css.textContent = `
#f1 .f1-cap{display:flex;align-items:center;justify-content:space-between;gap:8px 16px;flex-wrap:wrap;margin-bottom:12px}
#f1 .f1-cap h2{margin:0}
.f1-enll{display:flex;gap:6px;flex-wrap:wrap}
.f1-enll a{font-size:.85rem;padding:3px 10px;border:1px solid var(--linia);border-radius:999px;background:var(--targeta);color:var(--text);text-decoration:none;white-space:nowrap}
.f1-enll a:hover{border-color:var(--accent);color:var(--accent)}
.f1-proper{border:1px solid var(--linia);border-radius:12px;padding:14px;background:#fbfaf7;display:grid;gap:12px}
@media (min-width:860px){.f1-proper{grid-template-columns:1.2fr 1fr}}
.f1-gp{margin:0;font-size:1.25rem}
.f1-lloc{color:var(--suau);margin:2px 0 8px}
.f1-compte{font-size:1.9rem;font-weight:700;font-variant-numeric:tabular-nums;line-height:1.2}
.f1-compte small{display:block;font-size:.85rem;font-weight:400;color:var(--suau)}
.f1-viu{display:inline-flex;align-items:center;gap:6px;color:#e10600;font-weight:700}
.f1-viu i,.f1-led.on{width:10px;height:10px;border-radius:50%;background:#e10600;display:inline-block;animation:f1pols 1.2s infinite}
@keyframes f1pols{50%{opacity:.3}}
.f1-ses{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:.92rem}
.f1-ses li{display:flex;justify-content:space-between;gap:10px;padding:4px 8px;border-radius:6px;background:var(--targeta);border:1px solid var(--linia)}
.f1-ses li.fet{opacity:.55}
.f1-ses li.ara{border-color:#e10600;color:#e10600;font-weight:600}
.f1-ses li.cursa{font-weight:600}
.f1-temps{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;font-size:.85rem}
.f1-temps span{border:1px solid var(--linia);border-radius:8px;padding:3px 8px;background:var(--targeta)}
.f1-graella{display:grid;gap:12px;margin-top:12px}
@media (min-width:860px){.f1-graella{grid-template-columns:1.3fr 1fr}}
.f1-caixa{border:1px solid var(--linia);border-radius:12px;padding:12px;min-width:0}
.f1-caixa h3{margin:0 0 8px;font-size:1rem}
.f1-pest{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px}
.f1-pest button{font:inherit;font-size:.85rem;padding:3px 10px;border:1px solid var(--linia);border-radius:999px;background:var(--targeta);color:var(--text);cursor:pointer}
.f1-pest button.actiu{background:var(--accent);border-color:var(--accent);color:#fff}
.f1-taula{width:100%;border-collapse:collapse;font-size:.88rem}
.f1-taula th,.f1-taula td{padding:4px 6px;border-bottom:1px solid var(--linia);text-align:left;vertical-align:middle}
.f1-taula th{font-size:.75rem;color:var(--suau);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.f1-taula td.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.f1-taula .eq{display:inline-block;width:4px;height:14px;border-radius:2px;margin-right:6px;vertical-align:-2px}
.f1-taula small{color:var(--suau)}
.f1-cal{list-style:none;margin:0;padding:0;display:grid;gap:4px;font-size:.88rem;max-height:520px;overflow:auto}
.f1-cal li{display:grid;grid-template-columns:2.4em 1fr;gap:2px 8px;padding:5px 8px;border-radius:8px;border:1px solid var(--linia)}
.f1-cal li.fet{opacity:.6}
.f1-cal li.proper{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent) inset}
.f1-cal b.r{color:var(--suau);font-weight:600}
.f1-cal .gu{grid-column:2;color:var(--suau);font-size:.8rem}
.f1-sprint{font-size:.7rem;border:1px solid var(--accent);color:var(--accent);border-radius:6px;padding:0 5px;margin-left:4px;vertical-align:1px}
.f1-directe{margin-top:12px;border:1px solid var(--linia);border-radius:12px;padding:12px}
.f1-dir-cap{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px}
.f1-dir-cap h3{margin:0;font-size:1rem}
.f1-monitor{background:#16161a;border-radius:12px;padding:10px;color:#e8e8e8}
.f1-mon-barra{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:8px;font-size:.88rem}
.f1-mon-barra .nom{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:600;letter-spacing:.02em}
.f1-led{width:10px;height:10px;border-radius:50%;background:#555;display:inline-block}
.f1-mon-barra button,.f1-mon-barra a{font:inherit;font-size:.8rem;padding:3px 9px;border:1px solid #444;border-radius:6px;background:#26262c;color:#e8e8e8;cursor:pointer;text-decoration:none}
.f1-mon-barra button:hover,.f1-mon-barra a:hover{border-color:#e10600}
.f1-mon-barra button:disabled{opacity:.4;cursor:default}
.f1-pantalla{position:relative;aspect-ratio:16/9;background:#000;border-radius:8px;overflow:hidden}
.f1-pantalla video,.f1-pantalla iframe{position:absolute;inset:0;width:100%;height:100%;border:0;background:#000}
.f1-nosenyal{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;color:#777;font-size:.9rem;letter-spacing:.12em;text-align:center;padding:12px;background:repeating-linear-gradient(90deg,#1b1b1f 0 12%,#222228 12% 24%)}
.f1-nosenyal b{font-size:1.1rem;color:#999}
.f1-form{display:flex;gap:6px;flex-wrap:wrap;margin-top:10px}
.f1-form input{font:inherit;padding:6px 10px;border:1px solid var(--linia);border-radius:8px;min-width:0}
.f1-form #f1Nom{flex:1 1 150px}
.f1-form #f1Url{flex:3 1 300px}
.f1-auto{display:flex;gap:4px 12px;flex-wrap:wrap;align-items:center;margin-top:10px;font-size:.88rem}
.f1-auto span{color:var(--suau)}
.f1-auto label{display:inline-flex;gap:4px;align-items:center;cursor:pointer}
.f1-fonts{list-style:none;margin:10px 0 0;padding:0;display:flex;gap:6px;flex-wrap:wrap}
.f1-fonts li{display:flex;align-items:center;border:1px solid var(--linia);border-radius:999px;background:var(--targeta);overflow:hidden}
.f1-fonts li.actiu{border-color:var(--accent)}
.f1-fonts button{font:inherit;font-size:.85rem;border:0;background:none;padding:3px 10px;cursor:pointer;color:var(--text)}
.f1-fonts button.treu{padding:3px 8px;color:var(--suau);border-left:1px solid var(--linia)}
.f1-fonts button:hover{color:var(--accent)}
`;
  document.head.appendChild(css);

  // ---------------- Noms en català ----------------
  const GP = {
    "Australian": "GP d'Austràlia", "Chinese": "GP de la Xina", "Japanese": "GP del Japó", "Bahrain": "GP de Bahrain",
    "Saudi Arabian": "GP de l'Aràbia Saudita", "Miami": "GP de Miami", "Canadian": "GP del Canadà", "Monaco": "GP de Mònaco",
    "Barcelona-Catalunya": "GP de Barcelona-Catalunya", "Barcelona Catalunya": "GP de Barcelona-Catalunya", "Austrian": "GP d'Àustria",
    "British": "GP de la Gran Bretanya", "Belgian": "GP de Bèlgica", "Hungarian": "GP d'Hongria", "Dutch": "GP dels Països Baixos",
    "Italian": "GP d'Itàlia", "Spanish": "GP d'Espanya", "Azerbaijan": "GP de l'Azerbaidjan", "Singapore": "GP de Singapur",
    "United States": "GP dels Estats Units", "Mexico City": "GP de Ciutat de Mèxic", "Mexican": "GP de Mèxic", "São Paulo": "GP de São Paulo",
    "Las Vegas": "GP de Las Vegas", "Qatar": "GP de Qatar", "Abu Dhabi": "GP d'Abu Dhabi", "Emilia Romagna": "GP d'Emília-Romanya"
  };
  const nomGP = r => { const k = String(r.raceName || "").replace(/\s*Grand Prix\s*$/i, "").trim(); return GP[k] || r.raceName || ""; };
  const PAIS = { "Australia": "Austràlia", "China": "Xina", "Japan": "Japó", "Bahrain": "Bahrain", "Saudi Arabia": "Aràbia Saudita", "USA": "Estats Units", "United States": "Estats Units", "Canada": "Canadà", "Monaco": "Mònaco", "Spain": "Espanya", "Austria": "Àustria", "UK": "Regne Unit", "Belgium": "Bèlgica", "Hungary": "Hongria", "Netherlands": "Països Baixos", "Italy": "Itàlia", "Azerbaijan": "Azerbaidjan", "Singapore": "Singapur", "Mexico": "Mèxic", "Brazil": "Brasil", "Qatar": "Qatar", "UAE": "Emirats Àrabs Units" };
  const lloc = r => { const l = (r.Circuit && r.Circuit.Location) || {}; return [l.locality, PAIS[l.country] || l.country].filter(Boolean).join(" · "); };
  const COLOR = { mclaren: "#ff8000", ferrari: "#e8002d", red_bull: "#3671c6", mercedes: "#27f4d2", aston_martin: "#229971", alpine: "#ff87bc", williams: "#64c4ff", rb: "#6692ff", haas: "#b6babd", sauber: "#52e252", audi: "#bb0a30", cadillac: "#8a8d8f" };
  const color = c => COLOR[(c && c.constructorId) || ""] || "#999";

  // ---------------- Dades (amb memòria de 10 minuts) ----------------
  async function api(cami, minuts) {
    const k = "tauler.f1.api." + cami;
    const c = ls.get(k, null);
    if (c && Date.now() - c.t < minuts * 60000) return c.d;
    try {
      const r = await fetch(API + cami, { cache: "no-cache" });
      if (!r.ok) throw new Error("HTTP " + r.status);
      const d = (await r.json()).MRData;
      ls.set(k, { t: Date.now(), d });
      return d;
    } catch (e) { if (c) return c.d; throw e; }
  }

  const SESS = [["FirstPractice", "FP1", 60], ["SecondPractice", "FP2", 60], ["ThirdPractice", "FP3", 60],
    ["SprintQualifying", "Classificació sprint", 45], ["Sprint", "Cursa sprint", 60], ["Qualifying", "Classificació", 60]];
  function sessions(r) {
    const l = SESS.filter(([k]) => r[k]).map(([k, n, m]) => ({ n, d: quan(r[k]), m }));
    l.push({ n: "Cursa", d: quan(r), m: 120, cursa: true });
    return l.filter(s => s.d).sort((a, b) => a.d - b.d);
  }

  let CAL = [], PROPER = null, rellotge = null;

  function triaProper() {
    const ara = Date.now();
    PROPER = CAL.find(r => { const c = quan(r); return c && c.getTime() + 3 * 3600000 > ara; }) || null;
  }

  function pintaCompte() {
    const el = $("f1Compte");
    if (!el || !PROPER) return;
    const ara = Date.now();
    const ss = sessions(PROPER);
    const viu = ss.find(s => ara >= s.d && ara < s.d.getTime() + s.m * 60000);
    const seg = ss.find(s => s.d > ara);
    if (viu) el.innerHTML = '<span class="f1-viu"><i></i>EN DIRECTE · ' + esc(viu.n) + "</span><small>Ha començat a les " + hora(viu.d) + "</small>";
    else if (seg) {
      let t = Math.max(0, Math.floor((seg.d - ara) / 1000));
      const d = Math.floor(t / 86400); t %= 86400;
      const h = Math.floor(t / 3600); t %= 3600;
      const m = Math.floor(t / 60), s = t % 60;
      el.innerHTML = (d ? d + " d " : "") + dd(h) + ":" + dd(m) + ":" + dd(s) + "<small>fins a " + esc(/^FP/.test(seg.n) ? seg.n : seg.n.toLowerCase()) + " · " + esc(diaHora(seg.d)) + "</small>";
    } else el.innerHTML = '<small>La cursa ja s\'ha acabat.</small>';
    document.querySelectorAll("#f1Ses li[data-t]").forEach(li => {
      const t = +li.dataset.t, m = +li.dataset.m;
      li.classList.toggle("fet", ara >= t + m * 60000);
      li.classList.toggle("ara", ara >= t && ara < t + m * 60000);
    });
  }

  const TEMPS = c => c === 0 ? "☀️" : c <= 2 ? "🌤️" : c === 3 ? "☁️" : c <= 48 ? "🌫️" : c <= 57 ? "🌦️" : c <= 67 ? "🌧️" : c <= 77 ? "🌨️" : c <= 82 ? "🌧️" : c <= 86 ? "🌨️" : "⛈️";
  async function tempsCircuit(r) {
    const el = $("f1Temps");
    const loc = r.Circuit && r.Circuit.Location;
    const ss = sessions(r);
    if (!el || !loc || !ss.length) return;
    const ini = ss[0].d, fi = ss[ss.length - 1].d;
    if (ini - Date.now() > 14 * 86400000) { el.innerHTML = '<span>Previsió del temps al circuit: a partir de dues setmanes abans.</span>'; return; }
    const iso = d => d.toISOString().slice(0, 10);
    const ahir = new Date(Date.now() - 86400000);
    const de = ini < ahir ? ahir : ini;
    try {
      const u = "https://api.open-meteo.com/v1/forecast?latitude=" + loc.lat + "&longitude=" + loc.long +
        "&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&start_date=" + iso(de) + "&end_date=" + iso(fi);
      const j = await (await fetch(u)).json();
      const D = j.daily;
      if (!D || !D.time) throw 0;
      el.innerHTML = D.time.map((t, i) => {
        const [a, m, d] = t.split("-");
        const w = DIES[new Date(+a, +m - 1, +d).getDay()];
        return "<span title=\"Temps al circuit (hora local del circuit)\">" + w + " " + d + "." + m + " " + TEMPS(D.weather_code[i]) + " " + Math.round(D.temperature_2m_min[i]) + "–" + Math.round(D.temperature_2m_max[i]) + " °C" +
          (D.precipitation_probability_max[i] != null ? " · 💧" + D.precipitation_probability_max[i] + " %" : "") + "</span>";
      }).join("");
    } catch (e) { el.innerHTML = ""; }
  }

  function pintaProper() {
    const el = $("f1Proper");
    if (!PROPER) {
      const ult = CAL[CAL.length - 1];
      el.innerHTML = '<div><h3 class="f1-gp">Temporada acabada</h3><p class="f1-lloc">' + (ult ? "Darrera cursa: " + esc(nomGP(ult)) + " · " + data(quan(ult)) : "") + "</p></div>";
      return;
    }
    const r = PROPER, ss = sessions(r);
    const sprint = !!r.Sprint;
    el.innerHTML =
      '<div><p class="f1-lloc" style="margin:0">Ronda ' + esc(r.round) + " de " + CAL.length + (sprint ? ' <span class="f1-sprint">SPRINT</span>' : "") + "</p>" +
      '<h3 class="f1-gp">' + esc(nomGP(r)) + "</h3>" +
      '<p class="f1-lloc">' + esc((r.Circuit && r.Circuit.circuitName) || "") + " · " + esc(lloc(r)) + "</p>" +
      '<div class="f1-compte" id="f1Compte"></div>' +
      '<div class="f1-temps" id="f1Temps"></div></div>' +
      '<ul class="f1-ses" id="f1Ses">' + ss.map(s => '<li data-t="' + s.d.getTime() + '" data-m="' + s.m + '"' + (s.cursa ? ' class="cursa"' : "") + "><span>" + (s.cursa ? "🏁 " : "") + esc(s.n) + "</span><span>" + esc(diaHora(s.d)) + "</span></li>").join("") + "</ul>";
    pintaCompte();
    tempsCircuit(r);
  }

  function pintaCal(guanyadors) {
    const ara = Date.now();
    $("f1Cal").innerHTML = CAL.map(r => {
      const ss = sessions(r), c = quan(r);
      const fet = c && c.getTime() + 3 * 3600000 < ara;
      const g = guanyadors[r.round];
      const ini = ss[0].d;
      const dies = (ini.getMonth() === c.getMonth() ? dd(ini.getDate()) : dd(ini.getDate()) + "." + dd(ini.getMonth() + 1)) + "–" + data(c);
      return '<li class="' + (fet ? "fet" : "") + (r === PROPER ? " proper" : "") + '"><b class="r">R' + esc(r.round) + "</b><span><b>" + esc(nomGP(r)) + "</b>" + (r.Sprint ? '<span class="f1-sprint">S</span>' : "") + "</span>" +
        '<span class="gu">' + esc(dies) + " · " + esc(lloc(r)) + (g ? " · 🏆 " + esc(g) : "") + "</span></li>";
    }).join("");
    const p = $("f1Cal").querySelector(".proper");
    if (p) $("f1Cal").scrollTop = Math.max(0, p.offsetTop - $("f1Cal").offsetTop - 60);
  }

  // ---------------- Classificacions i darrer GP ----------------
  let pest = "pilots";
  async function pintaTaula() {
    const el = $("f1Taula");
    el.innerHTML = '<p class="buit">Carregant…</p>';
    try {
      if (pest === "pilots") {
        const d = await api("current/driverStandings.json", 10);
        const L = d.StandingsTable.StandingsLists[0];
        if (!L) { el.innerHTML = '<p class="buit">Encara no hi ha classificació.</p>'; return; }
        const p1 = +L.DriverStandings[0].points;
        el.innerHTML = '<p class="font" style="margin:0 0 6px">Després de la ronda ' + esc(L.round) + "</p>" +
          '<table class="f1-taula"><thead><tr><th>#</th><th>Pilot</th><th>Equip</th><th class="n">Punts</th><th class="n">Dif.</th><th class="n">Vict.</th></tr></thead><tbody>' +
          L.DriverStandings.map(x => { const c = (x.Constructors || [])[x.Constructors.length - 1] || {}; return "<tr><td>" + esc(x.positionText || x.position) + "</td><td><span class=\"eq\" style=\"background:" + color(c) + "\"></span>" + esc(x.Driver.givenName) + " <b>" + esc(x.Driver.familyName) + "</b></td><td><small>" + esc(c.name || "") + '</small></td><td class="n"><b>' + esc(x.points) + '</b></td><td class="n"><small>' + (+x.points === p1 ? "—" : "−" + (p1 - +x.points)) + '</small></td><td class="n">' + esc(x.wins) + "</td></tr>"; }).join("") + "</tbody></table>";
      } else if (pest === "equips") {
        const d = await api("current/constructorStandings.json", 10);
        const L = d.StandingsTable.StandingsLists[0];
        if (!L) { el.innerHTML = '<p class="buit">Encara no hi ha classificació.</p>'; return; }
        const p1 = +L.ConstructorStandings[0].points;
        el.innerHTML = '<p class="font" style="margin:0 0 6px">Després de la ronda ' + esc(L.round) + "</p>" +
          '<table class="f1-taula"><thead><tr><th>#</th><th>Equip</th><th class="n">Punts</th><th class="n">Dif.</th><th class="n">Vict.</th></tr></thead><tbody>' +
          L.ConstructorStandings.map(x => "<tr><td>" + esc(x.positionText || x.position) + '</td><td><span class="eq" style="background:' + color(x.Constructor) + '"></span><b>' + esc(x.Constructor.name) + '</b></td><td class="n"><b>' + esc(x.points) + '</b></td><td class="n"><small>' + (+x.points === p1 ? "—" : "−" + (p1 - +x.points)) + '</small></td><td class="n">' + esc(x.wins) + "</td></tr>").join("") + "</tbody></table>";
      } else {
        const d = await api("current/last/results.json", 10);
        const r = d.RaceTable.Races[0];
        if (!r) { el.innerHTML = '<p class="buit">Encara no hi ha resultats.</p>'; return; }
        el.innerHTML = '<p class="font" style="margin:0 0 6px"><b>' + esc(nomGP(r)) + "</b> · " + esc(data(quan(r))) + "</p>" +
          '<table class="f1-taula"><thead><tr><th>#</th><th>Pilot</th><th>Equip</th><th class="n">Temps / estat</th><th class="n">Punts</th></tr></thead><tbody>' +
          r.Results.map(x => "<tr><td>" + esc(x.positionText) + '</td><td><span class="eq" style="background:' + color(x.Constructor) + '"></span>' + esc(x.Driver.givenName) + " <b>" + esc(x.Driver.familyName) + "</b>" + (x.FastestLap && x.FastestLap.rank === "1" ? ' <small title="Volta ràpida">⏱️</small>' : "") + "</td><td><small>" + esc(x.Constructor.name) + '</small></td><td class="n"><small>' + esc(x.Time ? x.Time.time : x.status) + '</small></td><td class="n">' + esc(x.points) + "</td></tr>").join("") + "</tbody></table>";
      }
    } catch (e) { el.innerHTML = '<p class="buit">No s\'han pogut carregar les dades ara mateix. Torna-ho a provar d\'aquí a una estona.</p>'; }
  }
  $("f1Pest").addEventListener("click", e => {
    const b = e.target.closest("button[data-t]");
    if (!b) return;
    pest = b.dataset.t;
    $("f1Pest").querySelectorAll("button").forEach(x => x.classList.toggle("actiu", x === b));
    pintaTaula();
  });

  async function carrega() {
    try {
      const d = await api("current.json", 60);
      CAL = d.RaceTable.Races || [];
      triaProper();
      pintaProper();
      let g = {};
      try {
        const w = await api("current/results/1.json?limit=100", 30);
        (w.RaceTable.Races || []).forEach(r => { const x = r.Results && r.Results[0]; if (x) g[r.round] = x.Driver.givenName + " " + x.Driver.familyName; });
      } catch (e) { }
      pintaCal(g);
    } catch (e) {
      $("f1Proper").innerHTML = '<p class="buit">No s\'ha pogut carregar el calendari ara mateix. Torna-ho a provar d\'aquí a una estona.</p>';
    }
    pintaTaula();
  }

  // ---------------- Directe (amb clau) ----------------
  const v = $("f1Video"), fr = $("f1Frame");
  let hls = null, actual = null;
  const avis = t => { $("f1Avis").hidden = !t; $("f1Avis").innerHTML = t || ""; };

  function tipus(url) {
    let u;
    try { u = new URL(url.trim()); } catch (e) { return null; }
    if (!/^https?:$/.test(u.protocol)) return null;
    const h = u.hostname.replace(/^(www|m)\./, "");
    if (/\.m3u8$/i.test(u.pathname) || /m3u8/i.test(u.search)) return { t: "hls", src: u.href };
    if (/\.(mp4|webm|ogv|mov|mkv)$/i.test(u.pathname)) return { t: "video", src: u.href };
    if (h === "youtu.be") return { t: "frame", src: "https://www.youtube-nocookie.com/embed/" + u.pathname.slice(1).split("/")[0] + "?autoplay=1" };
    if (h.endsWith("youtube.com") || h.endsWith("youtube-nocookie.com")) {
      let id = u.searchParams.get("v");
      const m = u.pathname.match(/\/(live|embed|shorts)\/([\w-]+)/);
      if (!id && m) id = m[2];
      if (id) return { t: "frame", src: "https://www.youtube-nocookie.com/embed/" + id + "?autoplay=1" };
      const ch = u.pathname.match(/\/channel\/([\w-]+)/);
      if (ch) return { t: "frame", src: "https://www.youtube.com/embed/live_stream?channel=" + ch[1] + "&autoplay=1" };
    }
    if (h === "twitch.tv") { const c = u.pathname.split("/")[1]; if (c) return { t: "frame", src: "https://player.twitch.tv/?channel=" + encodeURIComponent(c) + "&parent=" + location.hostname }; }
    return { t: "frame", src: u.href };
  }

  function atura() {
    if (typeof aturaRec === "function") aturaRec();
    if (hls) { try { hls.destroy(); } catch (e) { } hls = null; }
    v.pause(); v.removeAttribute("src"); v.load(); v.hidden = true;
    fr.src = "about:blank"; fr.hidden = true;
    $("f1NoSenyal").hidden = false;
    $("f1Led").className = "f1-led";
    $("f1MonNom").textContent = "Sense senyal";
    $("f1Fora").hidden = true;
    $("f1Pip").disabled = true;
    actual = null;
    pintaFonts();
    if (typeof recBoto === "function") recBoto();
  }

  let hlsCarrega = null;
  const carregaHls = () => hlsCarrega || (hlsCarrega = new Promise((ok, ko) => {
    if (window.Hls) return ok(window.Hls);
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hls.js@1";
    s.onload = () => ok(window.Hls); s.onerror = () => { hlsCarrega = null; ko(); };
    document.head.appendChild(s);
  }));

  async function posa(nom, url) {
    const t = tipus(url || "");
    if (!t) { avis("L'enllaç no és vàlid: ha de començar per https://"); return; }
    atura();
    avis("");
    actual = url.trim();
    $("f1MonNom").textContent = nom || new URL(t.src).hostname;
    $("f1Fora").href = actual; $("f1Fora").hidden = false;
    $("f1NoSenyal").hidden = true;
    $("f1Led").className = "f1-led on";
    if (location.protocol === "https:" && /^http:/i.test(t.src)) avis("Aquest enllaç és http:// i el navegador sol bloquejar-lo dins d'una pàgina https://. Si no es veu, fes servir «↗ Obre a part».");
    ls.set("tauler.f1.darrera", { nom: nom || "", url: actual });
    if (t.t === "frame") { fr.hidden = false; fr.src = t.src; pintaFonts(); return; }
    v.hidden = false; $("f1Pip").disabled = !document.pictureInPictureEnabled;
    const falla = () => { $("f1Led").className = "f1-led"; avis("No arriba el senyal. Pot ser que el directe no hagi començat, que l'enllaç hagi caducat o que el servei no deixi reproduir-lo fora del seu web; prova «↗ Obre a part»."); };
    if (t.t === "hls" && !v.canPlayType("application/vnd.apple.mpegurl")) {
      try {
        const H = await carregaHls();
        if (!H || !H.isSupported()) { falla(); return; }
        hls = new H({ lowLatencyMode: true });
        hls.on(H.Events.ERROR, (ev, d) => { if (d && d.fatal) falla(); });
        hls.loadSource(t.src); hls.attachMedia(v);
        hls.on(H.Events.MANIFEST_PARSED, () => v.play().catch(() => { }));
      } catch (e) { falla(); }
    } else {
      v.onerror = falla;
      v.src = t.src;
      v.play().catch(() => { });
    }
    pintaFonts();
  }

  const fonts = () => ls.get("tauler.f1.fonts", []);
  function pintaFonts() {
    const l = fonts();
    $("f1Fonts").innerHTML = l.map((f, i) => '<li' + (f.url === actual ? ' class="actiu"' : "") + '><button type="button" data-p="' + i + '" title="' + esc(f.url) + '">▶ ' + esc(f.nom || f.url) + '</button><button type="button" class="treu" data-x="' + i + '" title="Treu-lo de la llista">✕</button></li>').join("");
  }
  $("f1Fonts").addEventListener("click", e => {
    const p = e.target.closest("[data-p]"), x = e.target.closest("[data-x]");
    const l = fonts();
    if (p) { const f = l[+p.dataset.p]; if (f) { $("f1Nom").value = f.nom || ""; $("f1Url").value = f.url; posa(f.nom, f.url); } }
    if (x) { const f = l[+x.dataset.x]; if (f && confirm("Vols treure «" + (f.nom || f.url) + "» de la llista?")) { l.splice(+x.dataset.x, 1); ls.set("tauler.f1.fonts", l); pintaFonts(); } }
  });
  $("f1Form").addEventListener("submit", e => { e.preventDefault(); posa($("f1Nom").value.trim(), $("f1Url").value); });
  $("f1Desa").addEventListener("click", () => {
    const nom = $("f1Nom").value.trim(), url = $("f1Url").value.trim();
    if (!tipus(url)) { avis("Escriu primer un enllaç vàlid (https://…)."); return; }
    const l = fonts().filter(f => f.url !== url);
    l.push({ nom: nom || new URL(url).hostname, url });
    ls.set("tauler.f1.fonts", l);
    avis(""); pintaFonts();
  });
  $("f1Atura").addEventListener("click", atura);

  // Gravació del que es veu (només vídeo directe .m3u8/.mp4; les pàgines inserides no es poden gravar)
  let rec = null, trossos = [], recIni = 0, recRell = null;
  const recTipus = () => ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
  function recBoto() {
    const b = $("f1Grava");
    if (rec) { const s = Math.floor((Date.now() - recIni) / 1000); b.textContent = "⏹ Atura " + dd(Math.floor(s / 3600)) + ":" + dd(Math.floor(s / 60) % 60) + ":" + dd(s % 60); }
    else b.textContent = "⏺ Grava";
    b.disabled = !rec && (v.hidden || !window.MediaRecorder);
  }
  function aturaRec() { if (rec && rec.state !== "inactive") rec.stop(); }
  $("f1Grava").addEventListener("click", () => {
    if (rec) { aturaRec(); return; }
    let st;
    try { st = (v.captureStream || v.mozCaptureStream).call(v); } catch (e) { st = null; }
    if (!st) { avis("Aquest senyal no es pot gravar des del navegador (el servei ho impedeix)."); return; }
    const tipusRec = recTipus();
    try { rec = new MediaRecorder(st, tipusRec ? { mimeType: tipusRec } : undefined); }
    catch (e) { rec = null; avis("El navegador no permet gravar aquest senyal."); return; }
    trossos = []; recIni = Date.now();
    const nomRec = ($("f1MonNom").textContent || "directe").replace(/[^\w\-À-ÿ ]+/g, "").trim().replace(/\s+/g, "_") || "directe";
    const ara = new Date(), segell = dd(ara.getDate()) + "." + dd(ara.getMonth() + 1) + "." + ara.getFullYear() + "_" + dd(ara.getHours()) + "." + dd(ara.getMinutes());
    rec.ondataavailable = e => { if (e.data && e.data.size) trossos.push(e.data); };
    rec.onstop = () => {
      clearInterval(recRell);
      const tipusF = rec.mimeType || tipusRec || "video/webm";
      const b = new Blob(trossos, { type: tipusF });
      rec = null; trossos = []; recBoto();
      if (!b.size) { avis("La gravació ha quedat buida: el servei no deixa capturar la imatge."); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = "F1_" + nomRec + "_" + segell + (tipusF.includes("mp4") ? ".mp4" : ".webm");
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    };
    rec.start(5000);
    avis("");
    recRell = setInterval(recBoto, 1000); recBoto();
  });
  v.addEventListener("playing", () => {
    recBoto();
    if (autoPendent && !rec) { autoPendent = null; $("f1Grava").click(); autoRec = !!rec; }
  });

  // Gravació automàtica de les sessions marcades (amb la pàgina i la F1 oberta)
  const AUTO = ["FP1", "FP2", "FP3", "Classificació sprint", "Cursa sprint", "Classificació", "Cursa"];
  let autoPendent = null, autoRec = false, autoFi = 0, autoFetes = ls.get("tauler.f1.autoFetes", []);
  const autoTria = () => ls.get("tauler.f1.auto", ["FP1", "FP2", "FP3", "Cursa sprint", "Cursa"]);
  function pintaAuto() {
    const t = autoTria();
    $("f1Auto").innerHTML = "<span>Grava sola:</span>" + AUTO.map(n => '<label><input type="checkbox" value="' + esc(n) + '"' + (t.includes(n) ? " checked" : "") + "> " + esc(n) + "</label>").join("");
  }
  $("f1Auto").addEventListener("change", () => {
    ls.set("tauler.f1.auto", [...$("f1Auto").querySelectorAll("input:checked")].map(i => i.value));
  });
  let pantallaViva = null;
  function autoComprova() {
    if (!PROPER || !teClau()) return;
    const d = ls.get("tauler.f1.darrera", null);
    if (!d || !d.url) return;
    const ara = Date.now(), t = autoTria();
    sessions(PROPER).forEach(se => {
      if (!t.includes(se.n)) return;
      const ini = se.d.getTime(), fi = ini + (se.m + 15) * 60000, clau = String(ini);
      if (ara >= ini - 5 * 60000 && ara < fi && !rec && !autoPendent && !autoFetes.includes(clau)) {
        autoFetes = autoFetes.concat(clau).slice(-40); ls.set("tauler.f1.autoFetes", autoFetes);
        autoPendent = clau; autoFi = fi;
        if ("wakeLock" in navigator && !pantallaViva) navigator.wakeLock.request("screen").then(w => { pantallaViva = w; }).catch(() => { });
        posa(d.nom, d.url);
        if (!v.hidden && !v.paused) { autoPendent = null; $("f1Grava").click(); autoRec = !!rec; }
      }
    });
    if (autoFi && ara >= autoFi) {
      autoFi = 0; autoPendent = null;
      if (autoRec && rec) aturaRec();
      autoRec = false;
      if (pantallaViva) { pantallaViva.release().catch(() => { }); pantallaViva = null; }
    }
  }
  $("f1Full").addEventListener("click", () => { const p = $("f1Pantalla"); (p.requestFullscreen || p.webkitRequestFullscreen || (() => { })).call(p); });
  $("f1Pip").addEventListener("click", () => { if (!v.hidden && document.pictureInPictureEnabled) v.requestPictureInPicture().catch(() => { }); });

  function directe() {
    const obert = teClau();
    $("f1DirTancat").hidden = obert;
    $("f1DirObert").hidden = !obert;
    $("f1Candau").textContent = obert ? "🔓" : "🔒";
    if (obert) {
      const d = ls.get("tauler.f1.darrera", null);
      if (d && !$("f1Url").value) { $("f1Nom").value = d.nom || ""; $("f1Url").value = d.url || ""; }
      pintaFonts();
      pintaAuto();
    }
  }

  // ---------------- Obre i tanca ----------------
  let carregat = 0;
  $("f1Boto").addEventListener("click", () => {
    const obrir = $("f1").hidden;
    $("f1").hidden = !obrir;
    $("f1Boto").setAttribute("aria-expanded", obrir ? "true" : "false");
    $("f1Boto").title = obrir ? "Tanca la Fórmula 1" : "Obre la Fórmula 1";
    clearInterval(rellotge);
    if (!obrir) { atura(); return; }
    directe();
    if (Date.now() - carregat > 10 * 60000) { carregat = Date.now(); carrega(); }
    else { triaProper(); pintaProper(); }
    rellotge = setInterval(() => {
      const abans = PROPER;
      triaProper();
      if (PROPER !== abans) { pintaProper(); return; }
      pintaCompte();
      autoComprova();
    }, 1000);
    $("f1").scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
