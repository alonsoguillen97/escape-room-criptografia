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
    return list.slice().sort((a, b) => (b.valid - a.valid) || (b.score - a.score) || (a.end - b.end));
  }

  function rank() {
    const v = $("#view");
    const s = sorted().filter((x) => x.valid);
    const pod = [s[1], s[0], s[2]];
    v.innerHTML = `
      <h2>Ranking por puntos</h2>
      <p class="muted small">Pega los códigos de finalización (uno por línea). Se ordena por puntos; si hay empate, gana quien terminó antes.</p>
      <textarea id="codes" placeholder="CN.xxxxx.XXXXXXXX"></textarea>
      <div class="toolbar"><button class="btn" id="add">Añadir códigos</button><button class="btn ghost" id="clr">Vaciar ranking</button></div>
      ${s.length ? `<div class="podium">${pod.map((x, i) => x ? `<div class="pod p${[2, 1, 3][i]}"><div class="bar">${[2, 1, 3][i]}</div><b>${esc(x.team)}</b><span>${x.score} pts</span></div>` : "<div></div>").join("")}</div>` : ""}
      <table><thead><tr><th>#</th><th>Equipo</th><th>Grupo</th><th>Puntos</th><th>Terminó</th><th>Pistas</th><th>Errores</th><th></th></tr></thead><tbody>
      ${sorted().map((x, i) => `<tr class="${x.valid ? "" : "invalid"}"><td>${x.valid ? i + 1 : "✗"}</td><td>${esc(x.team)}</td><td class="mono">${esc(x.group)}</td><td>${x.score}</td><td class="mono">${new Date(x.end).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>${x.hints}</td><td>${x.errors}</td><td>${x.valid ? "✓" : "Código manipulado"}</td></tr>`).join("") || `<tr><td colspan="8">Aún no hay equipos.</td></tr>`}
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
    v.innerHTML = `<h2>Solucionario por grupo</h2><p class="muted small">Escribe el código de grupo que aparece en la pantalla del alumno.</p>
      <form id="f" class="answer"><label><span>Código de grupo</span><input id="gc" class="mono" maxlength="4" placeholder="XXXX"></label><button class="btn" type="submit">Ver soluciones</button></form><div id="out" style="margin-top:18px"></div>`;
    $("#f").onsubmit = async (e) => {
      e.preventDefault();
      const code = $("#gc").value.trim().toUpperCase();
      if (code.length !== 4) return;
      $("#out").innerHTML = `<p class="muted">Calculando…</p>`;
      const d = await CN.deriveGroup(code);
      const nonce = await CN.firstNonce(d);
      const corruptHash = (await CN.sha256(d.backups[d.corrupt].content)).slice(0, 8);
      const item = (t, val) => `<div><b>${t}</b>${val}</div>`;
      $("#out").innerHTML = `<div class="sol">
        ${item("SALA 1 · Oficina", `Abrir D: y E: en el portátil · nota en D:\\Personal · Código de la puerta: <code>${d.badge}</code> (tarjeta de ${esc(d.badgeOwner)}, Logística más antiguo)`)}
        ${item("SALA 2 · Servidores", `PIN del rack (Base64): <code>${d.pin}</code> · luego clic en el llavero USB`)}
        ${item("SALA 3 · Carlos", `Descifrar con <b>carlos_privada.pem</b> (CyberChef: From Base64 → RSA Decrypt, RSA-OAEP, SHA-1) · Combinación: <code>${d.combo.join("-")}</code> · Responder con <b>pública de Ana</b>`)}
        ${item("SALA 4 · Archivo", `Auténtico: <code>contrato_${d.authentic + 1}</code> · Huellas (8): ${d.contracts.map((c, i) => `${i + 1}=<code>${c.hash.slice(0, 8)}</code>`).join(" · ")} · hay que escanear los 4`)}
        ${item("SALA 5 · Laboratorio", `A: <code>${d.msg1Hash}</code><br>B: <code>${d.msg2Hash}</code><br>Sello: número <code>${nonce}</code> (vale cualquier número cuyo hash empiece por ${CN.CONFIG.MINING_PREFIX})`)}
        ${item("SALA 6 · Copias", `Corrupta: <code>${d.corruptName}</code> · su hash real (8): <code>${corruptHash}</code> · Plan válido: p. ej. NAS + Cinta + Nube con 🔒`)}
        ${item("SALA 7 · Despacho", `Texto: <code>${esc(d.keyText)}</code><br>Clave: <code>${d.keyHex}</code><br>Dial: Derecha ${d.dial[0]} → Izquierda ${d.dial[1]} → Derecha ${d.dial[2]}`)}
        ${item("SALA 8 · Cámara", `Llave 1 (testigo): <code>${d.token}</code> · Llave 2: Size = <code>${d.testigoSize}</code> bytes y un Method que contenga <code>7zAES</code>`)}
        ${item("SALA 9 · Salida", "C: BitLocker, AES, 7z, carta RSA · I: verificador SHA-256, SHA256SUMS · D: plan 3-2-1 · A: firma de Ana · Papelera: Base64, ocultos")}
      </div>`;
    };
  }

  gate();
})();
