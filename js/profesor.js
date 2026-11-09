/* Panel del profesor: ranking a partir de códigos de finalización + solucionario por grupo */
(function () {
  "use strict";
  const KEY = "cajanegra.ranking.v1";
  const root = document.getElementById("t");
  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let list = [];
  try { list = JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) {}
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };

  function gate() {
    if (sessionStorage.getItem("cn-prof") === "1") return main();
    root.innerHTML = `<div class="card gate"><span class="eyebrow">PANEL DEL PROFESOR</span><h2>Operación Caja Negra</h2><form id="g"><label><span>PIN</span><input id="pin" type="password" autocomplete="off"></label><br><button class="btn" type="submit">Entrar</button></form></div>`;
    $("#g").onsubmit = (e) => {
      e.preventDefault();
      if ($("#pin").value === CN.CONFIG.TEACHER_PIN) { sessionStorage.setItem("cn-prof", "1"); main(); }
      else $("#pin").classList.add("shake");
    };
  }

  function main() {
    root.innerHTML = `<span class="eyebrow">PANEL DEL PROFESOR</span><h1>OPERACIÓN <span class="hl">CAJA NEGRA</span></h1>
      <div class="tabs" role="tablist"><button class="btn" role="tab" data-tab="rank" aria-selected="true">🏆 Ranking</button><button class="btn" role="tab" data-tab="sol" aria-selected="false">🔎 Solucionario</button></div>
      <section class="card panel" id="view"></section>`;
    root.querySelectorAll("[data-tab]").forEach((b) => (b.onclick = () => {
      root.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      b.dataset.tab === "rank" ? rank() : sol();
    }));
    rank();
  }

  function sorted() {
    return list.slice().sort((a, b) => (b.valid - a.valid) || (a.elapsed - b.elapsed) || (b.score - a.score));
  }

  function rank() {
    const v = $("#view");
    const s = sorted().filter((x) => x.valid);
    const pod = [s[1], s[0], s[2]];
    v.innerHTML = `
      <h2>Ranking por tiempo</h2>
      <p class="muted small">Pega los códigos de finalización (uno por línea). Se ordena por tiempo; a igualdad, por puntos.</p>
      <textarea id="codes" placeholder="CN.xxxxx.XXXXXXXX"></textarea>
      <div class="toolbar"><button class="btn" id="add">Añadir códigos</button><button class="btn ghost" id="clr">Vaciar ranking</button></div>
      ${s.length ? `<div class="podium">${pod.map((x, i) => x ? `<div class="pod p${[2, 1, 3][i]}"><div class="bar">${[2, 1, 3][i]}</div><b>${esc(x.team)}</b><span>${CN.fmtTime(x.elapsed)} · ${x.score} pts</span></div>` : "<div></div>").join("")}</div>` : ""}
      <table><thead><tr><th>#</th><th>Equipo</th><th>Grupo</th><th>Tiempo</th><th>Puntos</th><th>Pistas</th><th>Errores</th><th></th></tr></thead><tbody>
      ${sorted().map((x, i) => `<tr class="${x.valid ? "" : "invalid"}"><td>${x.valid ? i + 1 : "✗"}</td><td>${esc(x.team)}</td><td class="mono">${esc(x.group)}</td><td class="mono">${CN.fmtTime(x.elapsed)}</td><td>${x.score}</td><td>${x.hints}</td><td>${x.errors}</td><td>${x.valid ? "✓" : "Código manipulado"}</td></tr>`).join("") || `<tr><td colspan="8">Aún no hay equipos.</td></tr>`}
      </tbody></table>`;
    $("#add").onclick = async () => {
      const lines = $("#codes").value.split(/\s+/).filter(Boolean);
      let added = 0;
      for (const l of lines) {
        const r = await CN.parseFinishCode(l);
        if (!r) continue;
        list = list.filter((x) => x.group !== r.group);
        list.push(r); added++;
      }
      persist(); rank();
      if (!added && lines.length) alert("Ningún código reconocido.");
    };
    $("#clr").onclick = () => { if (confirm("¿Vaciar el ranking?")) { list = []; persist(); rank(); } };
  }

  function sol() {
    const v = $("#view");
    v.innerHTML = `<h2>Solucionario por grupo</h2><p class="muted small">Escribe el código de grupo que aparece en la pantalla del alumno. Usa <b>PROF</b> para preparar tu propio .7z de emergencia (fase 8) si algún grupo se queda sin pareja.</p>
      <form id="f" class="answer"><label><span>Código de grupo</span><input id="gc" class="mono" maxlength="4" placeholder="XXXX"></label><button class="btn" type="submit">Ver soluciones</button></form><div id="out" style="margin-top:18px"></div>`;
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const code = $("#gc").value.trim().toUpperCase();
      if (code.length !== 4) return;
      const d = await CN.deriveGroup(code);
      const item = (t, val) => `<div><b>${t}</b>${val}</div>`;
      $("#out").innerHTML = `<div class="sol">
        ${item("FASE 1 · Disco", "Legibles: SSD sin cifrar, archivos ocultos, ZIP sin contraseña · Q1: «Nada, si no estaba cifrado» · Q2: cifrar la unidad")}
        ${item("FASE 2 · Base64", `PIN: <code>${d.pin}</code> · Q1: no hace falta clave · Q2: AES-256`)}
        ${item("FASE 3 · Llaves", "Cifra: pública de Carlos · Descifra: privada de Carlos · Firma: privada de Ana · Verifica: pública de Ana")}
        ${item("FASE 4 · Contrato", `Auténtico: <code>contrato_${d.authentic + 1}.txt</code> · Prueba: 6 primeros del hash de contrato_${d.askIdx + 1} = <code>${d.contracts[d.askIdx].hash.slice(0, 6).toUpperCase()}</code>`)}
        ${item("FASE 5 · Avalancha", `«${esc(d.msg1)}» → <code>${d.msg1Hash.slice(0, 8)}</code> · «${esc(d.msg2)}» → <code>${d.msg2Hash.slice(0, 8)}</code> (sin salto de línea; se aceptan también variantes del Bloc de notas)`)}
        ${item("FASE 6 · Copias", `Copia corrupta: <code>${d.corruptName}</code>`)}
        ${item("FASE 7 · AES", `Texto: <code>${esc(d.keyText)}</code><br>Clave: <code>${d.keyHex}</code><br>Código caja fuerte: <code>${d.vault}</code>`)}
        ${item("FASE 8 · 7-Zip", `Testigo de este grupo: <code>${d.token}</code> (lo que debe introducir OTRO grupo junto con el código ${code})`)}
        ${item("FASE 9 · Informe", "Portátil → BitLocker · ISO → hash · Contrato aprobado → firma · Solo Carlos → pública de Carlos · Correo + teléfono → 7z AES · Ransomware → copias 3-2-1")}
      </div>`;
    };
  }

  gate();
})();
