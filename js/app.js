/* =========================================================
   OPERACIÓN CAJA NEGRA — web del alumnado
   ========================================================= */
(function () {
  "use strict";
  const C = CN.CONFIG;
  const STORE = "cajanegra.v1";
  const app = document.getElementById("app");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let S = null; // estado guardado
  let D = null; // datos derivados del grupo

  /* ---------------- Ilustraciones (trazo grueso navy) ---------------- */
  const N = "#101C3A", L = "#A9DB2E", LL = "#EAF8C9", W = "#ffffff", R = "#D94444";
  const g = (inner) => `<svg viewBox="0 0 200 150" aria-hidden="true"><g fill="none" stroke="${N}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${inner}</g></svg>`;
  const ART = {
    box: g(`<path d="M40 55 L100 30 L160 55 L160 110 L100 135 L40 110 Z" fill="${N}"/><path d="M40 55 L100 80 L160 55" stroke="${W}" stroke-width="4"/><path d="M100 80 V135" stroke="${W}" stroke-width="4"/><path d="M52 72 L88 87 V103 L52 88 Z" fill="${L}" stroke="${L}"/><circle cx="130" cy="95" r="10" fill="${L}" stroke="${L}"/>`),
    ssd: g(`<rect x="34" y="34" width="112" height="78" rx="14" fill="${LL}"/><rect x="52" y="52" width="76" height="26" rx="6" fill="${W}"/><path d="M62 65h34"/><circle cx="124" cy="96" r="6" fill="${L}"/><path d="M146 72h16c10 0 14 8 14 16v26"/><rect x="167" y="112" width="18" height="16" rx="3" fill="${L}"/><path d="M22 30l10 10M18 52h12M30 16l4 12" stroke="${R}"/>`),
    note: g(`<path d="M50 20h72l28 28v86H50Z" fill="${W}"/><path d="M122 20v28h28" fill="${LL}"/><path d="M64 76h70M64 94h56M64 112h64" stroke-width="6" stroke-dasharray="10 7"/><text x="62" y="60" font-family="monospace" font-size="15" font-weight="700" fill="${N}" stroke="none">TkFUQQ==</text>`),
    keys: g(`<circle cx="62" cy="58" r="24" fill="${L}"/><circle cx="62" cy="58" r="8" fill="${W}"/><path d="M86 62h70M136 62v16M150 62v12"/><circle cx="76" cy="104" r="20" fill="${W}"/><circle cx="76" cy="104" r="7" fill="${LL}"/><path d="M96 108h60M142 108v14M130 108v10"/>`),
    docs: g(`<rect x="26" y="34" width="62" height="84" rx="8" fill="${W}"/><rect x="44" y="24" width="62" height="84" rx="8" fill="${LL}"/><path d="M56 46h36M56 62h36M56 78h24"/><circle cx="128" cy="78" r="28" fill="${W}"/><path d="M148 98l26 26" stroke-width="9"/><path d="M116 78l8 8 16-16" stroke="${L}" stroke-width="7"/>`),
    avalanche: g(`<rect x="16" y="22" width="64" height="38" rx="8" fill="${LL}"/><text x="25" y="49" font-family="monospace" font-size="18" font-weight="700" fill="${N}" stroke="none">1000</text><rect x="16" y="90" width="64" height="38" rx="8" fill="${W}"/><text x="25" y="117" font-family="monospace" font-size="18" font-weight="700" fill="${R}" stroke="none">9000</text><path d="M86 41h22M86 109h22"/><path d="M102 34l8 7-8 7M102 102l8 7-8 7"/><rect x="116" y="28" width="70" height="26" rx="6" fill="${L}"/><rect x="116" y="96" width="70" height="26" rx="6" fill="${N}"/><path d="M126 41h10M142 41h6M154 41h22"/><path d="M126 109h18M150 109h4M160 109h16" stroke="${W}"/>`),
    backup: g(`<rect x="20" y="30" width="70" height="90" rx="10" fill="${LL}"/><path d="M34 52h42M34 70h42M34 88h28"/><rect x="110" y="30" width="70" height="90" rx="10" fill="${W}"/><path d="M124 52h42M124 70h42"/><path d="M124 88h14" stroke="${R}"/><path d="M90 75h20" stroke-dasharray="4 6"/><circle cx="145" cy="100" r="10" fill="${R}" stroke="${R}"/><path d="M141 96l8 8M149 96l-8 8" stroke="${W}" stroke-width="3"/>`),
    envelope: g(`<rect x="22" y="40" width="120" height="82" rx="10" fill="${W}"/><path d="M22 48l60 42 60-42"/><rect x="116" y="70" width="60" height="50" rx="8" fill="${L}"/><path d="M128 70V56a18 18 0 0 1 36 0v14"/><circle cx="146" cy="92" r="6" fill="${N}"/><path d="M146 98v10"/>`),
    safe: g(`<rect x="32" y="22" width="130" height="108" rx="12" fill="${LL}"/><rect x="46" y="36" width="102" height="80" rx="8" fill="${W}"/><circle cx="97" cy="76" r="24" fill="${L}"/><circle cx="97" cy="76" r="6" fill="${N}"/><path d="M97 52v8M97 92v8M73 76h8M113 76h8"/><path d="M48 130v10M146 130v10"/>`),
    report: g(`<rect x="44" y="26" width="104" height="112" rx="10" fill="${W}"/><rect x="72" y="16" width="48" height="20" rx="6" fill="${L}"/><path d="M62 62l8 8 14-14M62 92l8 8 14-14M62 122l8 8 14-14" stroke="${L}" stroke-width="7"/><path d="M96 64h36M96 94h36M96 124h24"/>`),
  };

  /* ---------------- Utilidades UI ---------------- */
  function toast(msg, type = "ok") {
    const el = document.createElement("div");
    el.className = `toast-item ${type}`;
    el.textContent = msg;
    document.getElementById("toast").appendChild(el);
    setTimeout(() => el.classList.add("out"), 2600);
    setTimeout(() => el.remove(), 3100);
  }
  function modal({ title, body, ok = "Aceptar", cancel = null }) {
    return new Promise((resolve) => {
      const m = document.getElementById("modal");
      m.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="mt"><h3 id="mt">${title}</h3><div class="modal-body">${body}</div><div class="modal-actions">${cancel ? `<button class="btn ghost" data-r="0">${cancel}</button>` : ""}<button class="btn" data-r="1">${ok}</button></div></div>`;
      m.hidden = false;
      $$("button", m).forEach((b) => (b.onclick = () => { m.hidden = true; resolve(b.dataset.r === "1"); }));
      $("button[data-r='1']", m).focus();
    });
  }
  function download(name, content) {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const cmd = (code, label = "PowerShell") =>
    `<div class="cmd"><div class="cmd-head"><span>${label}</span><button class="copy keep" type="button">Copiar</button></div><pre><code>${esc(code)}</code></pre></div>`;
  const fileList = (files) =>
    `<div class="files">${files.map((f, i) => `<button class="file-btn keep" type="button" data-file="${i}"><span class="file-ico">${f.name.split(".").pop().toUpperCase()}</span><span class="file-name">${esc(f.name)}</span><span class="file-dl">↓</span></button>`).join("")}</div>`;
  function bindFiles(body, files) {
    $$("[data-file]", body).forEach((b) => (b.onclick = () => { const f = files[+b.dataset.file]; download(f.name, f.content); toast(`Descargado: ${f.name}`); }));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".copy");
    if (!b) return;
    const txt = b.closest(".cmd").querySelector("code").textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
      () => { b.textContent = "Copiado ✓"; setTimeout(() => (b.textContent = "Copiar"), 1500); },
      () => toast("No se pudo copiar: selecciónalo a mano", "bad")
    );
  });

  /* ---------------- Constructores de pasos ---------------- */
  function mcq(question, options, explain = "") {
    return (body, api) => {
      const opts = api.shuffle(options);
      body.insertAdjacentHTML("beforeend",
        `<p class="q">${question}</p><div class="options">${opts.map((o, i) => `<button type="button" class="opt" ${o.ok ? "data-ok" : ""}><span class="opt-letter">${"ABCDEF"[i]}</span><span class="opt-text">${o.t}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join("")}</div>${explain ? `<div class="explain">${explain}</div>` : ""}`);
      bindOptions(body, api, "Respuesta incorrecta");
    };
  }
  function bindOptions(body, api, wrongMsg) {
    $$(".opt", body).forEach((b) => (b.onclick = () => {
      if (api.solved() || b.classList.contains("wrong")) return;
      if (b.hasAttribute("data-ok")) { b.classList.add("correct"); api.solve(); }
      else { b.classList.add("wrong"); b.setAttribute("aria-label", b.textContent + " (incorrecta)"); api.wrong(wrongMsg); }
    }));
  }
  function answer({ label, placeholder = "", check, mono = true }) {
    return (body, api) => {
      const form = document.createElement("form");
      form.className = "answer";
      form.noValidate = true;
      form.innerHTML = `<label><span>${label}</span><input type="text" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" class="${mono ? "mono" : ""}"></label><button class="btn" type="submit">Validar</button>`;
      body.appendChild(form);
      const input = $("input", form);
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (api.solved()) return;
        const v = input.value.trim();
        if (!v) { input.focus(); return; }
        if (await check(v)) api.solve(v);
        else { input.classList.add("shake"); setTimeout(() => input.classList.remove("shake"), 500); api.wrong("No es correcto. Revisa el procedimiento"); }
      };
    };
  }
  const chain = (...fns) => (body, api) => fns.forEach((f) => (typeof f === "string" ? body.insertAdjacentHTML("beforeend", f) : f(body, api)));
  const norm = (s) => s.trim().toUpperCase().replace(/\s+/g, "");
  const hexPrefixCheck = (set, n = 8) => (v) => v.trim().length >= n && set.has(v.trim().toLowerCase().slice(0, n));

  /* ---- Fase 1: clasificar dispositivos ---- */
  function classifyDevices(body, api) {
    const items = api.shuffle([
      { t: "SSD externo sin cifrar (el portátil tenía contraseña de Windows)", a: "e" },
      { t: "Portátil apagado con BitLocker activado", a: "p" },
      { t: "USB con un archivo .7z cifrado con AES-256 y contraseña robusta", a: "p" },
      { t: "USB con los archivos marcados como “ocultos”", a: "e" },
      { t: "Disco con una carpeta comprimida en .zip sin contraseña", a: "e" },
      { t: "Contenedor VeraCrypt desmontado", a: "p" },
    ]);
    body.insertAdjacentHTML("beforeend", `<p>El atacante tiene acceso físico a todos estos dispositivos. ¿Cuáles podría leer?</p>
      <div class="classify">${items.map((it, i) => `<div class="cls-row" data-ans="${it.a}"><span class="cls-text">${it.t}</span><div class="seg" role="group" aria-label="Clasificación"><button type="button" data-v="e" aria-pressed="false">🔓 Legible</button><button type="button" data-v="p" aria-pressed="false">🔒 Protegido</button></div></div>`).join("")}</div>
      <button class="btn" type="button" data-act="check">Comprobar</button>`);
    const rows = $$(".cls-row", body);
    const set = (row, v) => $$("button", row).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === v)));
    rows.forEach((row) => $$("button", row).forEach((b) => (b.onclick = () => { row.classList.remove("bad"); set(row, b.dataset.v); })));
    if (api.solved()) rows.forEach((row) => set(row, row.dataset.ans));
    $("[data-act=check]", body).onclick = () => {
      if (api.solved()) return;
      const sel = rows.map((r) => $("[aria-pressed=true]", r)?.dataset.v);
      if (sel.some((v) => !v)) return toast("Clasifica todos los dispositivos", "info");
      const bad = rows.filter((r, i) => sel[i] !== r.dataset.ans);
      if (bad.length) api.wrong(`${bad.length} mal clasificado${bad.length > 1 ? "s" : ""}`);
      else api.solve();
    };
  }

  /* ---- Fase 3: arrastrar llaves ---- */
  function keysDnD(body, api) {
    const CARDS = { pubA: "Pública de Ana", privA: "Privada de Ana", pubC: "Pública de Carlos", privC: "Privada de Carlos" };
    const SLOTS = [
      { t: "Ana cifra el mensaje para Carlos con…", a: "pubC" },
      { t: "Carlos descifra el mensaje con…", a: "privC" },
      { t: "Ana firma el contrato con…", a: "privA" },
      { t: "Carlos verifica la firma de Ana con…", a: "pubA" },
    ];
    const order = api.shuffle(Object.keys(CARDS));
    const place = {}; // slot -> card
    if (api.solved()) SLOTS.forEach((s, i) => (place[i] = s.a));
    let selected = null;
    body.insertAdjacentHTML("beforeend", `<p>Arrastra cada llave a su hueco (o haz clic en una llave y luego en el hueco).</p><div class="tray" data-zone="tray"></div><div class="slots">${SLOTS.map((s, i) => `<div class="slot-row"><span>${s.t}</span><div class="slot" data-zone="${i}" tabindex="0" role="button" aria-label="${s.t}"></div></div>`).join("")}</div><button class="btn" type="button" data-act="check">Comprobar</button>`);
    const tray = $(".tray", body);
    const card = (k) => `<button type="button" class="keycard ${k.startsWith("priv") ? "priv" : "pub"} ${selected === k ? "selected" : ""}" draggable="true" data-card="${k}"><span class="key-ico">${k.startsWith("priv") ? "🔑" : "🗝️"}</span>${CARDS[k]}</button>`;
    function moveTo(k, zone) {
      Object.keys(place).forEach((s) => place[s] === k && delete place[s]);
      if (zone !== "tray") place[zone] = k; // si había otra, vuelve a la bandeja automáticamente
      selected = null;
      draw();
    }
    function draw() {
      const used = Object.values(place);
      tray.innerHTML = order.filter((k) => !used.includes(k)).map(card).join("") || `<span class="muted small">Todas las llaves colocadas</span>`;
      $$(".slot", body).forEach((sl) => { const k = place[sl.dataset.zone]; sl.innerHTML = k ? card(k) : `<span class="slot-empty">Suelta aquí</span>`; sl.classList.toggle("filled", !!k); sl.classList.remove("bad"); });
      $$(".keycard", body).forEach((c) => {
        c.ondragstart = (e) => { e.dataTransfer.setData("text/plain", c.dataset.card); c.classList.add("dragging"); };
        c.ondragend = () => c.classList.remove("dragging");
        c.onclick = (e) => { e.stopPropagation(); if (api.solved()) return; selected = selected === c.dataset.card ? null : c.dataset.card; draw(); };
      });
    }
    $$("[data-zone]", body).forEach((z) => {
      z.ondragover = (e) => { e.preventDefault(); z.classList.add("over"); };
      z.ondragleave = () => z.classList.remove("over");
      z.ondrop = (e) => { e.preventDefault(); z.classList.remove("over"); if (api.solved()) return; moveTo(e.dataTransfer.getData("text/plain"), z.dataset.zone); };
      const act = () => { if (selected && !api.solved()) moveTo(selected, z.dataset.zone); };
      z.onclick = act;
      z.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); act(); } };
    });
    draw();
    $("[data-act=check]", body).onclick = () => {
      if (api.solved()) return;
      if (Object.keys(place).length < 4) return toast("Coloca las cuatro llaves", "info");
      const bad = SLOTS.map((s, i) => (place[i] !== s.a ? i : -1)).filter((i) => i >= 0);
      if (bad.length) { api.wrong(`${bad.length} llave${bad.length > 1 ? "s" : ""} en sitio incorrecto`); }
      else api.solve();
    };
  }

  /* ---- Fase 8: testigo de otro grupo ---- */
  function tokenExchange(body, api) {
    const form = document.createElement("form");
    form.className = "answer two";
    form.innerHTML = `<label><span>Código del OTRO grupo</span><input class="mono" maxlength="4" autocomplete="off" placeholder="XXXX"></label><label><span>Testigo que hay dentro de su .7z</span><input class="mono" maxlength="6" autocomplete="off" placeholder="6 caracteres"></label><button class="btn" type="submit">Validar</button>`;
    body.appendChild(form);
    const [ic, it] = $$("input", form);
    if (api.solved() && typeof api.value() === "string") { const [a, b] = api.value().split(":"); ic.value = a; it.value = b; }
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (api.solved()) return;
      const c = norm(ic.value), t = norm(it.value);
      if (!c || !t) return toast("Rellena los dos campos", "info");
      if (c === S.groupCode) return toast("Tiene que ser el testigo de OTRO grupo", "info");
      if ((await CN.token(c)) === t) api.solve(`${c}:${t}`);
      else api.wrong("Ese testigo no corresponde a ese grupo");
    };
  }

  /* ---- Fase 9: informe final ---- */
  function finalReport(body, api) {
    const CONTROLS = [
      "Cifrado completo del disco (BitLocker)",
      "Comparar su hash SHA-256",
      "Firma digital con la clave privada de la directora",
      "Cifrar con la clave pública de Carlos",
      "Archivo 7z con AES-256 y contraseña enviada por otro canal",
      "Copias 3-2-1 verificadas con hash",
      "Codificarlo en Base64",
      "Marcar los archivos como ocultos",
    ];
    const CASES = api.shuffle([
      { t: "Los portátiles de la empresa pueden perderse en un viaje.", a: 0 },
      { t: "Has descargado una ISO y quieres saber si está alterada.", a: 1 },
      { t: "Hay que demostrar que un contrato lo aprobó la directora y no se ha tocado.", a: 2 },
      { t: "Enviar a Carlos un documento que solo él pueda leer.", a: 3 },
      { t: "Mandar varios archivos a un cliente por correo; la contraseña se la darás por teléfono.", a: 4 },
      { t: "Que un ransomware no nos deje sin datos.", a: 5 },
    ]);
    const opts = api.shuffle(CONTROLS.map((t, i) => ({ t, i })));
    body.insertAdjacentHTML("beforeend", `<p>Redacta el informe para la dirección: elige el control adecuado para cada situación. Sobran opciones.</p><div class="report">${CASES.map((c, n) => `<label class="rep-row" data-ans="${c.a}"><span class="rep-num">${n + 1}</span><span class="rep-text">${c.t}</span><select><option value="">— Elige un control —</option>${opts.map((o) => `<option value="${o.i}">${o.t}</option>`).join("")}</select></label>`).join("")}</div><button class="btn" type="button" data-act="check">Enviar informe</button>`);
    const rows = $$(".rep-row", body);
    if (api.solved()) rows.forEach((r) => ($("select", r).value = r.dataset.ans));
    $("[data-act=check]", body).onclick = () => {
      if (api.solved()) return;
      const vals = rows.map((r) => $("select", r).value);
      if (vals.some((v) => v === "")) return toast("Completa todas las situaciones", "info");
      const bad = rows.filter((r, i) => vals[i] !== r.dataset.ans).length;
      if (bad) api.wrong(`${bad} control${bad > 1 ? "es" : ""} incorrecto${bad > 1 ? "s" : ""}`);
      else api.solve();
    };
  }

  /* ---------------- Definición de fases ---------------- */
  const STAGES = [
    {
      id: "disco", short: "Disco", title: "El disco robado", art: "ssd", keyword: "CIFRADO",
      story: () => `Un empleado ha perdido un <b>SSD externo</b> con <code>clientes.xlsx</code>, <code>facturas.pdf</code>, <code>contratos.pdf</code> y <code>nominas.xlsx</code>. El portátil tenía contraseña de Windows, pero el disco <b>no estaba cifrado</b>. Un atacante lo conecta a su propio ordenador.`,
      hints: [
        "Piensa qué pasa si conectas el disco a OTRO ordenador: el Windows del dueño ni siquiera arranca, así que su contraseña no interviene.",
        "Solo está protegido lo que necesita una clave para leerse: BitLocker, VeraCrypt, 7z con AES… Ocultar o comprimir no es cifrar.",
      ],
      feedback: "Una contraseña de usuario no protege los datos frente a acceso físico. Para proteger datos <b>en reposo</b> necesitamos <b>cifrado</b>.",
      steps: () => [
        { key: "clasifica", title: "Analiza los dispositivos incautados", build: classifyDevices },
        { key: "q1", title: "El SSD del empleado", build: mcq("¿Qué impide que el atacante lea directamente los archivos del SSD?", [
          { t: "La contraseña de Windows protege automáticamente el contenido del disco." },
          { t: "Nada: si el almacenamiento no estaba cifrado, los archivos se leen tal cual.", ok: true },
          { t: "El RAID impide acceder a los datos." },
          { t: "El sistema operativo bloquea cualquier acceso desde otro ordenador." },
        ]) },
        { key: "q2", title: "Medida correctora", build: mcq("Si mañana se pierde otro disco igual, ¿qué medida habría evitado la fuga?", [
          { t: "Cifrar la unidad completa (BitLocker To Go, VeraCrypt…).", ok: true },
          { t: "Poner una contraseña de Windows más larga." },
          { t: "Marcar los archivos como ocultos." },
          { t: "Formatear el disco en NTFS en lugar de FAT32." },
        ]) },
      ],
    },
    {
      id: "nota", short: "Nota", title: "La nota “cifrada”", art: "note", keyword: "CODIFICACIÓN",
      story: () => `En el SSD aparece <code>nota_recuperada.txt</code>. Parece texto sin sentido y su autor presume de que está “cifrada”. Averigua qué contiene… y si de verdad estaba protegida. <b>Apunta lo que encuentres: lo necesitarás más adelante.</b>`,
      hints: [
        "No necesitas ninguna contraseña. Ese texto acabado en “=” tiene pinta de Base64. Prueba la operación “From Base64” en CyberChef o el comando de PowerShell.",
        "Ejecuta el comando en la carpeta donde se descargó el archivo (normalmente: cd $HOME\\Downloads).",
      ],
      feedback: "Base64 es una <b>codificación</b>: cambia la forma de representar los datos, pero cualquiera puede revertirla sin clave. <b>Codificar ≠ cifrar.</b>",
      steps: (d) => [
        { key: "pin", title: "Descodifica la nota", build: chain(
          (body) => {
            body.insertAdjacentHTML("beforeend", `<p>Descarga la evidencia y descubre qué dice.</p>${fileList([{ name: "nota_recuperada.txt" }])}<p><b>Opción 1</b> · PowerShell, en la carpeta de descargas:</p>${cmd(`cd $HOME\\Downloads\n$t = Get-Content .\\nota_recuperada.txt -Raw\n[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($t))`)}<p><b>Opción 2</b> · <a href="https://gchq.github.io/CyberChef/" target="_blank" rel="noopener">CyberChef</a> → operación <b>From Base64</b>.</p>`);
            bindFiles(body, [{ name: "nota_recuperada.txt", content: d.noteB64 }]);
          },
          answer({ label: "PIN del armario de servidores", placeholder: "4 dígitos", check: (v) => v.replace(/\D/g, "") === d.pin })
        ) },
        { key: "q1", title: "¿Estaba protegida?", build: mcq("Para leer la nota, ¿has necesitado alguna clave?", [
          { t: "No: Base64 es una codificación y cualquiera puede revertirla.", ok: true },
          { t: "Sí: la clave era el propio nombre del archivo." },
          { t: "Sí: PowerShell usa automáticamente la contraseña de Windows." },
          { t: "No, porque Base64 es un cifrado, aunque débil." },
        ]) },
        { key: "q2", title: "Detecta el cifrado real", build: mcq("¿Cuál de estos SÍ protege la confidencialidad de un archivo?", [
          { t: "AES-256 con una contraseña robusta.", ok: true },
          { t: "Convertirlo a Base64." },
          { t: "Pasarlo a hexadecimal." },
          { t: "Comprimirlo en ZIP sin contraseña." },
        ]) },
      ],
    },
    {
      id: "llaves", short: "Llaves", title: "Las cuatro llaves", art: "keys", keyword: "CLAVE",
      story: () => `Ana y Carlos tienen cada uno un <b>par de claves</b>: una pública y una privada. Ana quiere enviar a Carlos un mensaje confidencial y, además, <b>firmar</b> un contrato para que Carlos pueda comprobar que es suyo.`,
      hints: [
        "Para enviar algo a Carlos debes usar una clave que Carlos pueda compartir con todo el mundo.",
        "Firmar = demostrar que eres tú: solo lo puede hacer quien tiene la clave privada. Verificar la firma lo puede hacer cualquiera con la clave pública del firmante.",
      ],
      feedback: "La clave pública puede compartirse; la privada queda bajo control exclusivo de su propietario. <b>Cifrar</b>: pública del destinatario. <b>Firmar</b>: privada del emisor.",
      steps: () => [
        { key: "dnd", title: "Coloca cada llave en su sitio", build: keysDnD },
        { key: "q1", title: "La llave que nunca sale de casa", build: mcq("¿Qué clave no debería compartir Carlos nunca?", [
          { t: "Su clave privada.", ok: true },
          { t: "Su clave pública." },
          { t: "Ninguna: puede compartir ambas si confía en la persona." },
          { t: "Las dos, siempre." },
        ]) },
        { key: "q2", title: "Interceptación", build: mcq("Eva intercepta el mensaje cifrado y además tiene la clave pública de Carlos. ¿Puede leerlo?", [
          { t: "No: solo la clave privada de Carlos puede descifrarlo.", ok: true },
          { t: "Sí: con la clave pública se descifra lo que se cifró con ella." },
          { t: "Sí, si también conoce el algoritmo usado." },
          { t: "Solo si el mensaje es corto." },
        ]) },
      ],
    },
    {
      id: "contrato", short: "Contrato", title: "El contrato manipulado", art: "docs", keyword: "INTEGRIDAD",
      story: () => `Se han recuperado <b>cuatro copias</b> del mismo contrato. Solo una coincide con el original firmado; las demás se han manipulado de forma muy sutil. Tienes la huella SHA-256 del original.`,
      hints: [
        "No necesitas interpretar el contenido: a simple vista parecen iguales. Compara su huella SHA-256.",
        "Get-FileHash .\\contrato_*.txt calcula los cuatro de una vez. Compara los primeros y los últimos caracteres con el hash original.",
      ],
      feedback: "El hash permite comprobar la <b>integridad</b> de un archivo. Si cambia un solo byte (un espacio, una letra de otro alfabeto…), el hash cambia.",
      steps: (d) => [
        { key: "pick", title: "Encuentra el contrato auténtico", build: (body, api) => {
          body.insertAdjacentHTML("beforeend", `${fileList(d.contracts)}<div class="hashbox"><span>SHA-256 DEL CONTRATO ORIGINAL</span><code>${d.contractOrigHash.toUpperCase()}</code></div><p>En PowerShell, dentro de la carpeta de descargas:</p>${cmd("Get-FileHash .\\contrato_*.txt -Algorithm SHA256 | Format-List Path, Hash")}<p class="q">¿Qué contrato coincide con el original?</p><div class="options grid4">${d.contracts.map((c, i) => `<button type="button" class="opt" ${i === d.authentic ? "data-ok" : ""}><span class="opt-letter">${i + 1}</span><span class="opt-text">contrato_${i + 1}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join("")}</div>`);
          bindFiles(body, d.contracts);
          bindOptions(body, api, "Ese hash no coincide");
        } },
        { key: "proof", title: "Demuestra que lo has calculado", build: answer({
          label: `6 primeros caracteres del hash de <code>contrato_${d.askIdx + 1}.txt</code>`, placeholder: "6 caracteres",
          check: (v) => norm(v).length >= 6 && norm(v).slice(0, 6) === d.contracts[d.askIdx].hash.slice(0, 6).toUpperCase(),
        }) },
        { key: "q1", title: "¿Se ve a simple vista?", build: mcq("Abre los contratos falsos con el Bloc de notas. ¿Por qué no basta con mirarlos?", [
          { t: "Porque un cambio puede ser invisible (un espacio, una letra de otro alfabeto) y el hash lo detecta igualmente.", ok: true },
          { t: "Porque el Bloc de notas no puede abrir archivos manipulados." },
          { t: "Porque el hash también descifra el contenido." },
          { t: "Sí basta: si se ven iguales, son iguales." },
        ]) },
      ],
    },
    {
      id: "avalancha", short: "Avalancha", title: "Un solo cambio", art: "avalanche", keyword: "HASH",
      story: () => `Vas a comprobar con tus propios ojos qué le ocurre a un hash cuando cambias <b>un único carácter</b> de un archivo.`,
      hints: [
        "El contenido debe ser EXACTAMENTE el indicado (mayúsculas, dos puntos, espacios). Si dudas, crea el archivo con el comando Set-Content que se muestra.",
        "Compara ambos hashes carácter por carácter: ¿cuántos coinciden en la misma posición?",
      ],
      feedback: "Un cambio mínimo en la entrada produce un hash completamente distinto (<b>efecto avalancha</b>). Y a partir del hash no se puede reconstruir el mensaje: es de un solo sentido.",
      steps: (d) => [
        { key: "h1", title: "Crea mensaje.txt y calcula su hash", build: chain(
          `<p>Crea un archivo <code>mensaje.txt</code> con este contenido exacto:</p><div class="hashbox"><code>${esc(d.msg1)}</code></div><p>Con el Bloc de notas o directamente:</p>${cmd(`Set-Content .\\mensaje.txt "${d.msg1}" -NoNewline\nGet-FileHash .\\mensaje.txt -Algorithm SHA256`)}`,
          answer({ label: "8 primeros caracteres del hash", placeholder: "8 caracteres", check: hexPrefixCheck(d.msg1Prefixes) })
        ) },
        { key: "h2", title: "Cambia 1000 por 9000", build: chain(
          `<p>Modifica <b>solo</b> <code>1000</code> por <code>9000</code> y vuelve a calcular el hash.</p>${cmd(`Set-Content .\\mensaje.txt "${d.msg2}" -NoNewline\nGet-FileHash .\\mensaje.txt -Algorithm SHA256`)}`,
          answer({ label: "8 primeros caracteres del nuevo hash", placeholder: "8 caracteres", check: hexPrefixCheck(d.msg2Prefixes) })
        ) },
        { key: "q1", title: "¿Qué ha pasado?", build: mcq("¿Qué ha ocurrido con el hash?", [
          { t: "Solo han cambiado algunos caracteres." },
          { t: "Ha permanecido prácticamente igual." },
          { t: "Ha cambiado completamente.", ok: true },
          { t: "El hash ha dejado de funcionar." },
        ]) },
        { key: "q2", title: "¿Y al revés?", build: mcq("Alguien solo tiene el hash del mensaje. ¿Puede “descifrarlo” para obtener el texto original?", [
          { t: "No: una función hash es de un solo sentido; no se descifra.", ok: true },
          { t: "Sí, con la clave pública adecuada." },
          { t: "Sí, porque SHA-256 es un cifrado simétrico." },
          { t: "Solo si el archivo es de texto." },
        ]) },
      ],
    },
    {
      id: "backup", short: "Copias", title: "La copia que miente", art: "backup", keyword: "RESPALDO",
      story: () => `Para recuperar los datos del SSD perdido vas a usar las <b>copias de seguridad</b> de anoche. El sistema de copias genera un manifiesto <code>SHA256SUMS.txt</code> con la huella de cada archivo. Antes de restaurar nada, toca verificar.`,
      hints: [
        "Abre SHA256SUMS.txt: cada línea es «hash  nombre_de_archivo». Calcula el hash de cada copia y busca la que no coincide.",
        "Get-FileHash .\\backup_*.txt calcula todos. Compara cada uno con su línea del manifiesto.",
      ],
      feedback: "Una copia que no se verifica es una copia en la que no se puede confiar. El hash comprueba la <b>integridad</b> del respaldo; la regla <b>3-2-1</b> y el <b>cifrado</b> de las copias completan la protección.",
      steps: (d) => [
        { key: "corrupt", title: "Verifica las copias", build: (body, api) => {
          const files = [...d.backups, { name: "SHA256SUMS.txt", content: d.manifest }];
          body.insertAdjacentHTML("beforeend", `${fileList(files)}${cmd("Get-Content .\\SHA256SUMS.txt\nGet-FileHash .\\backup_*.txt -Algorithm SHA256 | Format-Table Hash, Path")}<p class="q">¿Qué copia está corrupta?</p><div class="options grid2">${d.backups.map((b, i) => `<button type="button" class="opt" ${i === d.corrupt ? "data-ok" : ""}><span class="opt-letter">${i + 1}</span><span class="opt-text">${b.name}</span><span class="opt-mark" aria-hidden="true"></span></button>`).join("")}</div>`);
          bindFiles(body, files);
          bindOptions(body, api, "Esa copia coincide con el manifiesto");
        } },
        { key: "q1", title: "¿Y ahora qué?", build: mcq("Has detectado una copia corrupta. ¿Qué haces?", [
          { t: "No restaurarla: recuperar ese archivo desde otra copia (otro soporte o ubicación) y revisar el sistema de copias.", ok: true },
          { t: "Restaurarla igualmente: solo ha cambiado un número." },
          { t: "Recalcular el hash y escribirlo en el manifiesto para que coincida." },
          { t: "Borrar el manifiesto, que es el que está mal." },
        ]) },
        { key: "q2", title: "Regla 3-2-1", build: mcq("¿Qué plan cumple la regla 3-2-1?", [
          { t: "3 copias de los datos, en 2 soportes distintos, 1 de ellas fuera de la oficina.", ok: true },
          { t: "3 copias en el mismo disco externo, en 2 carpetas, 1 comprimida." },
          { t: "Un RAID 1 con 2 discos y 1 SAI." },
          { t: "2 copias en la nube y 1 contraseña para las dos." },
        ]) },
        { key: "q3", title: "La copia que viaja", build: mcq("La copia externa viaja cada viernes en un disco USB a casa del gerente. ¿Qué le falta?", [
          { t: "Cifrarla: una copia contiene la misma información confidencial que el original.", ok: true },
          { t: "Comprimirla para que ocupe menos." },
          { t: "Ponerle un nombre que no llame la atención." },
          { t: "Nada: las copias de seguridad no hace falta protegerlas." },
        ]) },
      ],
    },
    {
      id: "simetrico", short: "AES", title: "El mensaje cifrado", art: "envelope", keyword: "SIMÉTRICO",
      story: (d) => `En el correo del director aparece un mensaje cifrado con <b>AES-256</b>. Según el procedimiento interno, la clave es el <b>SHA-256</b> del texto <code>PIN:GRUPO</code>, usando el PIN del armario de servidores que descubriste en la fase 2. Para vuestro grupo: <code>&lt;PIN&gt;:${d.code}</code>.`,
      hints: [
        "El PIN es el número de 4 dígitos de la nota en Base64 (fase 2). El texto queda, por ejemplo, 1234:" + "ABCD" + " — sin espacios. Su SHA-256 (64 caracteres hexadecimales) es la clave.",
        "En CyberChef: operación «AES Decrypt». Key → tipo HEX, IV → tipo HEX, Mode: CBC, Input: Hex, Output: Raw. Pega el texto cifrado en la caja Input.",
      ],
      feedback: "Has descifrado con la <b>misma clave</b> que se usó para cifrar: eso es <b>cifrado simétrico</b>. Es rápido, pero hay que hacer llegar la clave de forma segura. HTTPS lo resuelve combinando asimétrico (para intercambiar la clave) y simétrico (para los datos).",
      steps: (d) => [
        { key: "key", title: "Obtén la clave AES", build: chain(
          `<p>Calcula el SHA-256 del texto <code>PIN:${d.code}</code> (sustituye PIN por el tuyo).</p>${cmd(`$s = "PIN:${d.code}"\n-join ([Security.Cryptography.SHA256]::Create().ComputeHash([Text.Encoding]::UTF8.GetBytes($s)) | ForEach-Object { $_.ToString("x2") })`)}<p>O en <a href="https://gchq.github.io/CyberChef/" target="_blank" rel="noopener">CyberChef</a> con la operación <b>SHA2</b> (tamaño 256).</p>`,
          answer({ label: "Clave (64 caracteres hexadecimales)", placeholder: "64 caracteres", check: (v) => v.trim().toLowerCase().replace(/\s/g, "") === d.keyHex })
        ) },
        { key: "vault", title: "Descifra el mensaje", build: chain(
          `<div class="hashbox"><span>IV (HEX)</span><code>${d.ivHex}</code></div><div class="hashbox"><span>MENSAJE CIFRADO (HEX)</span><code class="wrap">${d.cipherHex}</code></div><ol class="howto"><li>Abre <a href="https://gchq.github.io/CyberChef/" target="_blank" rel="noopener">CyberChef</a> y arrastra la operación <b>AES Decrypt</b>.</li><li><b>Key</b>: tu clave, tipo HEX. <b>IV</b>: el de arriba, tipo HEX.</li><li><b>Mode</b>: CBC · <b>Input</b>: Hex · <b>Output</b>: Raw.</li><li>Pega el mensaje cifrado en la caja <b>Input</b>.</li></ol>`,
          answer({ label: "Código de la caja fuerte", placeholder: "6 caracteres", check: (v) => norm(v) === d.vault })
        ) },
        { key: "q1", title: "¿Qué tipo de cifrado?", build: mcq("Para descifrar has usado la misma clave con la que se cifró. Esto es…", [
          { t: "Cifrado simétrico.", ok: true },
          { t: "Cifrado asimétrico." },
          { t: "Una función hash." },
          { t: "Una firma digital." },
        ]) },
        { key: "q2", title: "El punto débil", build: mcq("¿Cuál es el gran problema del cifrado simétrico?", [
          { t: "Hay que hacer llegar la clave al destinatario de forma segura.", ok: true },
          { t: "Es mucho más lento que el asimétrico." },
          { t: "No se puede usar con archivos." },
          { t: "Cualquiera puede descifrarlo sin la clave." },
        ]) },
      ],
    },
    {
      id: "caja", short: "7-Zip", title: "La caja fuerte digital", art: "safe", keyword: "RECUPERACIÓN",
      story: () => `La empresa necesita sacar documentos confidenciales de sus instalaciones. Vais a preparar un archivo cifrado con <b>7-Zip (AES-256)</b> y a <b>intercambiarlo con otro grupo</b>. Dentro irá vuestro <b>testigo</b>: el otro grupo solo podrá leerlo si le dais la contraseña.`,
      hints: [
        "En 7-Zip: clic derecho sobre la carpeta → 7-Zip → Añadir al archivo… La zona «Encriptación» está abajo a la derecha.",
        "El testigo está dentro del .7z del otro grupo, en testigo_XXXX.txt. Necesitas su código de grupo (las 4 letras) y el valor TESTIGO.",
      ],
      feedback: "El cifrado protege la <b>confidencialidad</b> de los datos almacenados. Sin la clave, el contenido es irrecuperable: la clave debe protegerse (y guardarse) correctamente.",
      steps: (d) => {
        const files = [
          { name: "clientes.txt", content: "LISTADO DE CLIENTES (FICTICIO)\r\nCliente 001 - Alfa Logistica\r\nCliente 002 - Beta Sistemas\r\nCliente 003 - Gamma Consulting\r\n" },
          { name: "facturas.txt", content: "FACTURAS PENDIENTES (FICTICIO)\r\nF-2025-001  1.250 EUR\r\nF-2025-002    830 EUR\r\nF-2025-003  4.100 EUR\r\n" },
          { name: "nominas.txt", content: "NOMINAS (FICTICIO)\r\nEmpleado A  1.600 EUR\r\nEmpleado B  1.750 EUR\r\nEmpleado C  2.100 EUR\r\n" },
          { name: `testigo_${d.code}.txt`, content: `TESTIGO DE SEGURIDAD\r\nCODIGO DE GRUPO: ${d.code}\r\nTESTIGO: ${d.token}\r\n` },
        ];
        return [
          { key: "make", title: "Prepara el archivo cifrado", build: chain(
            (body) => { body.insertAdjacentHTML("beforeend", `<p>Descarga los cuatro archivos y guárdalos en una carpeta llamada <code>CONFIDENCIAL</code>.</p>${fileList(files)}<ol class="howto"><li>Clic derecho en la carpeta → <b>7-Zip → Añadir al archivo…</b></li><li>Formato: <b>7z</b> · Método de cifrado: <b>AES-256</b></li><li>Contraseña: la que elija el grupo (¡no la digáis en voz alta!)</li><li>Activa <b>Cifrar nombres de archivo</b></li></ol>`); bindFiles(body, files); },
            mcq("¿Qué opción de 7-Zip impide ver qué archivos hay dentro sin la contraseña?", [
              { t: "Cifrar nombres de archivo.", ok: true },
              { t: "Nivel de compresión: Ultra." },
              { t: "Crear archivo SFX." },
              { t: "Formato ZIP." },
            ])
          ) },
          { key: "try", title: "Intercambio: intenta abrirlo sin contraseña", build: mcq("Pasad vuestro .7z a otro grupo y recibid el suyo. Intentad abrir el suyo SIN contraseña. ¿Qué veis?", [
            { t: "7-Zip pide la contraseña y ni siquiera se ven los nombres de los archivos.", ok: true },
            { t: "Se ven los archivos y se pueden abrir, pero salen en Base64." },
            { t: "7-Zip lo abre si lo ejecutas como administrador." },
            { t: "Se abre, porque el archivo se creó en el mismo aula." },
          ], "Si se veían los nombres, el otro grupo olvidó activar «Cifrar nombres de archivo»: el contenido sigue protegido, pero los nombres revelan información.") },
          { key: "token", title: "Recupera el testigo del otro grupo", build: chain(`<p>Pedid la contraseña al otro grupo, abrid su archivo y leed su <code>testigo_XXXX.txt</code>.</p>`, tokenExchange) },
          { key: "q1", title: "La pieza clave", build: mcq("¿Qué elemento permite recuperar el contenido cifrado?", [
            { t: "El hash." },
            { t: "La clave/contraseña.", ok: true },
            { t: "El nombre del archivo." },
            { t: "El RAID." },
          ]) },
        ];
      },
    },
    {
      id: "informe", short: "Informe", title: "Informe a dirección", art: "report", keyword: "CONFIDENCIALIDAD",
      story: () => `Último paso: la dirección de CITED Data quiere un plan para que el incidente no se repita. Tu informe desbloqueará el sistema.`,
      hints: [
        "Pregúntate en cada caso: ¿quiero ocultar el contenido (confidencialidad), detectar cambios (integridad), demostrar autoría o no perder los datos?",
        "Base64 y los archivos ocultos no protegen nada: descártalos.",
      ],
      feedback: "Confidencialidad → cifrado · Integridad → hash · Autoría → firma · Disponibilidad → copias.",
      steps: () => [{ key: "report", title: "Elige el control para cada situación", build: finalReport }],
    },
  ];

  /* ---------------- Estado ---------------- */
  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(STORE); } catch (e) {} }
  function newState(team) {
    return {
      v: 1, groupCode: CN.generateGroupCode(), team, currentStage: 0, score: C.START_SCORE,
      hintsUsed: 0, hintsByStage: {}, errorsByStage: {}, totalErrors: 0,
      completedStages: [], keywords: [], parts: {}, startTime: Date.now(), endTime: null, finished: false,
    };
  }
  const parts = (id) => (S.parts[id] = S.parts[id] || {});

  /* ---------------- HUD ---------------- */
  const topbar = document.getElementById("topbar");
  function addScore(delta) {
    S.score += delta;
    const el = $("#hudScore");
    el.textContent = S.score;
    el.parentElement.classList.remove("bump-up", "bump-down");
    void el.offsetWidth;
    el.parentElement.classList.add(delta >= 0 ? "bump-up" : "bump-down");
  }
  function updateHUD() {
    topbar.hidden = false;
    $("#hudGroup").textContent = S.groupCode;
    $("#hudTeam").textContent = S.team;
    $("#hudScore").textContent = S.score;
    const done = S.completedStages.length, total = STAGES.length;
    const cur = Math.min(S.currentStage, total - 1);
    $("#hudStage").textContent = S.finished ? "MISIÓN COMPLETADA" : `FASE ${cur + 1} DE ${total}`;
    $("#hudPct").textContent = Math.round((done / total) * 100) + "%";
    $("#progressFill").style.width = (done / total) * 100 + "%";
    $("#stageMap").innerHTML = STAGES.map((st, i) => {
      const cls = S.completedStages.includes(i) ? "done" : i === cur && !S.finished ? "current" : "";
      return `<li class="${cls}" title="${st.title}"><span>${S.completedStages.includes(i) ? "✓" : i + 1}</span><em>${st.short}</em></li>`;
    }).join("");
  }
  function tick() {
    if (!S) return;
    const el = $("#hudTimer");
    const end = S.endTime || Date.now();
    const elapsed = (end - S.startTime) / 1000;
    if (S.finished) { el.textContent = CN.fmtTime(elapsed); el.parentElement.classList.remove("over"); return; }
    const remaining = C.DURATION_MIN * 60 - elapsed;
    el.textContent = remaining >= 0 ? CN.fmtTime(remaining) : "+" + CN.fmtTime(-remaining);
    el.parentElement.classList.toggle("over", remaining < 0);
    el.parentElement.classList.toggle("low", remaining >= 0 && remaining < 600);
  }
  setInterval(tick, 1000);

  /* ---------------- Motor de fases ---------------- */
  function decorateSolved(art, value) {
    art.classList.add("solved");
    $(".step-status", art).textContent = "Resuelto ✓";
    $$("input, select, button:not(.keep)", art).forEach((el) => (el.disabled = true));
    $$("[data-ok]", art).forEach((el) => el.classList.add("correct"));
    if (typeof value === "string") { const inp = $("form.answer:not(.two) input", art); if (inp && !inp.value) inp.value = value; }
  }
  function refreshLocks(stepsEl) {
    let blocked = false;
    $$(".step", stepsEl).forEach((art) => {
      const locked = blocked && !art.classList.contains("solved");
      art.classList.toggle("locked", locked);
      art.inert = locked;
      if (locked) $(".step-status", art).textContent = "Bloqueado";
      else if (!art.classList.contains("solved")) $(".step-status", art).textContent = "En curso";
      if (!art.classList.contains("solved")) blocked = true;
    });
  }
  function makeApi(st, step, art, idx, steps) {
    const ps = parts(st.id);
    return {
      solved: () => ps[step.key] !== undefined,
      value: () => ps[step.key],
      shuffle: (arr) => CN.rng(S.groupCode + "|" + st.id + "|" + step.key).shuffle(arr),
      solve: (value = true) => {
        if (ps[step.key] !== undefined) return;
        ps[step.key] = value;
        save();
        decorateSolved(art, value);
        toast("Correcto ✓", "ok");
        refreshLocks(art.parentElement);
        if (steps.every((s) => ps[s.key] !== undefined)) completeStage(st, idx);
        else { const next = art.nextElementSibling; if (next) setTimeout(() => next.scrollIntoView({ behavior: "smooth", block: "start" }), 300); }
      },
      wrong: (msg) => {
        S.errorsByStage[st.id] = (S.errorsByStage[st.id] || 0) + 1;
        S.totalErrors++;
        addScore(-C.PENALTY_WRONG);
        save();
        toast(`${msg} · −${C.PENALTY_WRONG} puntos`, "bad");
      },
    };
  }
  function renderStage(idx) {
    const st = STAGES[idx];
    S.currentStage = idx;
    save();
    updateHUD();
    app.innerHTML = `<section class="stage" data-stage="${st.id}">
      <div class="stage-hero card">
        <div class="hero-art">${ART[st.art]}</div>
        <div class="hero-text"><span class="eyebrow">FASE ${idx + 1} DE ${STAGES.length}</span><h2>${st.title}</h2><p class="lead">${st.story(D)}</p></div>
      </div>
      <div class="hint-bar"><div class="hints" aria-live="polite"></div><button class="btn ghost hint-btn keep" type="button">💡 Pista <small>−${C.PENALTY_HINT}</small></button></div>
      <div class="steps"></div>
      <div class="stage-done" hidden></div>
    </section>`;
    const stepsEl = $(".steps", app);
    const steps = st.steps(D);
    steps.forEach((step, i) => {
      const art = document.createElement("article");
      art.className = "step card";
      art.innerHTML = `<header class="step-head"><span class="step-num">${i + 1}</span><h3>${step.title}</h3><span class="step-status">En curso</span></header><div class="step-body"></div>`;
      stepsEl.appendChild(art);
      const api = makeApi(st, step, art, idx, steps);
      step.build($(".step-body", art), api);
      if (api.solved()) decorateSolved(art, api.value());
    });
    refreshLocks(stepsEl);
    renderHints(st);
    $(".hint-btn", app).onclick = () => askHint(st);
    if (S.completedStages.includes(idx)) showStageDone(st, idx, false);
    window.scrollTo({ top: 0 });
  }
  function renderHints(st) {
    const n = S.hintsByStage[st.id] || 0;
    $(".hints", app).innerHTML = st.hints.slice(0, n).map((h, i) => `<div class="hint"><b>Pista ${i + 1}</b> ${h}</div>`).join("");
    const btn = $(".hint-btn", app);
    if (n >= st.hints.length) { btn.disabled = true; btn.innerHTML = "Sin más pistas"; }
  }
  async function askHint(st) {
    const n = S.hintsByStage[st.id] || 0;
    if (n >= st.hints.length) return;
    const ok = await modal({ title: "¿Usar una pista?", body: `<p>Te costará <b>${C.PENALTY_HINT} puntos</b>. Las pistas orientan, no dan la solución.</p><p class="small muted">Pistas restantes en esta fase: ${st.hints.length - n}</p>`, ok: "Ver pista", cancel: "Mejor no" });
    if (!ok) return;
    S.hintsByStage[st.id] = n + 1;
    S.hintsUsed++;
    addScore(-C.PENALTY_HINT);
    save();
    renderHints(st);
  }
  function completeStage(st, idx) {
    if (S.completedStages.includes(idx)) return;
    S.completedStages.push(idx);
    S.keywords.push(st.keyword);
    let bonus = false;
    if (!S.errorsByStage[st.id]) { addScore(C.BONUS_CLEAN); bonus = true; }
    save();
    updateHUD();
    showStageDone(st, idx, true, bonus);
  }
  function showStageDone(st, idx, animate, bonus = false) {
    const box = $(".stage-done", app);
    const last = idx === STAGES.length - 1;
    box.hidden = false;
    box.className = "stage-done card" + (animate ? " pop" : "");
    box.innerHTML = `<div class="done-badge">✓ FASE SUPERADA</div><p>${st.feedback}</p>${bonus ? `<p class="bonus">+${C.BONUS_CLEAN} puntos · fase sin errores</p>` : ""}<div class="keyword"><span>PALABRA RECUPERADA</span><strong>${st.keyword}</strong></div><button class="btn big keep" type="button">${last ? "ABRIR EL SISTEMA 🔓" : "CONTINUAR →"}</button>`;
    $(".hint-btn", app).disabled = true;
    $("button", box).onclick = () => (last ? finishGame() : renderStage(idx + 1));
    if (animate) setTimeout(() => box.scrollIntoView({ behavior: "smooth", block: "center" }), 250);
  }

  /* ---------------- Pantallas ---------------- */
  function renderIntro() {
    topbar.hidden = true;
    app.innerHTML = `<section class="intro">
      <div class="intro-card card">
        <div class="intro-art">${ART.box}</div>
        <span class="eyebrow">SEGURIDAD INFORMÁTICA · UD2</span>
        <h1>OPERACIÓN<br><span class="hl">CAJA NEGRA</span></h1>
        <p class="lead">La empresa <b>CITED Data</b> ha sufrido un incidente de seguridad. Se ha encontrado un dispositivo con información confidencial y hay indicios de que algunos archivos han sido manipulados.</p>
        <div class="mission">
          <div><b>Tu equipo deberá</b><ul><li>identificar los riesgos</li><li>recuperar información</li><li>comprobar la integridad de archivos</li><li>proteger los datos</li></ul></div>
          <div><b>Vais a necesitar</b><ul><li>PowerShell</li><li>CyberChef (navegador)</li><li>7-Zip</li><li>otro grupo con el que colaborar</li></ul></div>
        </div>
        <div class="rules">
          <span>⏱ Gana el equipo que termine antes</span><span>🎯 Empezáis con ${C.START_SCORE} puntos</span><span>✗ Error −${C.PENALTY_WRONG}</span><span>💡 Pista −${C.PENALTY_HINT}</span><span>★ Fase limpia +${C.BONUS_CLEAN}</span>
        </div>
        <p class="small muted">Cada equipo recibe un código y <b>datos distintos</b>: copiar la respuesta de otro equipo, o pedírsela a una IA, no sirve. Hay que calcular de verdad.</p>
        <form class="start" id="startForm"><label><span>Nombre del equipo</span><input id="teamName" maxlength="30" required autocomplete="off" placeholder="p. ej. Los Hashers"></label><button class="btn big" type="submit">INICIAR MISIÓN</button></form>
      </div>
    </section>`;
    $("#startForm").onsubmit = async (e) => {
      e.preventDefault();
      const team = $("#teamName").value.trim();
      if (!team) return $("#teamName").focus();
      S = newState(team);
      save();
      await boot();
      await modal({ title: `Vuestro código de grupo: ${S.groupCode}`, body: `<p>Aparecerá siempre arriba. Vuestros archivos y respuestas dependen de él.</p><p class="small muted">Si reiniciáis la misión se generará un código nuevo y el tiempo volverá a empezar.</p>`, ok: "¡Vamos!" });
    };
  }
  function renderResume(saved) {
    topbar.hidden = true;
    const stage = STAGES[Math.min(saved.currentStage, STAGES.length - 1)];
    app.innerHTML = `<section class="intro"><div class="intro-card card narrow">
      <div class="intro-art small">${ART.box}</div>
      <h2>¿QUIERES CONTINUAR LA MISIÓN?</h2>
      <div class="resume-grid"><div><span>EQUIPO</span><b>${esc(saved.team)}</b></div><div><span>GRUPO</span><b>${saved.groupCode}</b></div><div><span>PUNTOS</span><b>${saved.score}</b></div><div><span>${saved.finished ? "ESTADO" : "FASE"}</span><b>${saved.finished ? "Completada" : stage.title}</b></div></div>
      <div class="row-actions"><button class="btn big" id="cont">CONTINUAR</button><button class="btn ghost big" id="reset">REINICIAR</button></div>
    </div></section>`;
    $("#cont").onclick = () => { S = saved; boot(); };
    $("#reset").onclick = async () => {
      if (await modal({ title: "¿Reiniciar la misión?", body: "<p>Se perderá todo el progreso, se generará un <b>código de grupo nuevo</b> (con datos nuevos) y el cronómetro volverá a cero.</p>", ok: "Sí, reiniciar", cancel: "Cancelar" })) { clear(); S = null; renderIntro(); }
    };
  }
  async function boot() {
    app.innerHTML = `<div class="loading">Preparando la misión…</div>`;
    D = await CN.deriveGroup(S.groupCode);
    updateHUD(); tick();
    if (S.finished) return renderFinal();
    renderStage(Math.min(S.currentStage, STAGES.length - 1));
  }
  async function finishGame() {
    if (!S.finished) { S.finished = true; S.endTime = Date.now(); save(); }
    renderFinal();
  }
  async function renderFinal() {
    updateHUD(); tick();
    const elapsed = Math.round((S.endTime - S.startTime) / 1000);
    const code = await CN.makeFinishCode({ group: S.groupCode, team: S.team, elapsed, score: S.score, hints: S.hintsUsed, errors: S.totalErrors, end: S.endTime });
    app.innerHTML = `<section class="final">
      <div class="vault" aria-hidden="true"><div class="vault-body"><div class="vault-inside">${STAGES.map((s) => `<span>${s.keyword}</span>`).join("")}</div><div class="vault-door"><div class="dial"></div></div></div></div>
      <div class="card final-card">
        <span class="eyebrow">MISIÓN COMPLETADA</span>
        <h1>SISTEMA <span class="hl">RECUPERADO</span></h1>
        <div class="stats"><div><span>TIEMPO</span><b>${CN.fmtTime(elapsed)}</b></div><div><span>PUNTOS</span><b>${S.score}</b></div><div><span>PISTAS</span><b>${S.hintsUsed}</b></div><div><span>ERRORES</span><b>${S.totalErrors}</b></div></div>
        <div class="achieved"><b>Habéis conseguido:</b><ul>
          <li>identificar un almacenamiento sin protección</li><li>distinguir codificar de cifrar</li><li>usar claves públicas y privadas</li><li>comprobar la integridad de archivos y copias con SHA-256</li><li>descifrar con AES-256 (simétrico)</li><li>proteger información con 7-Zip</li></ul></div>
        <div class="kw-list">${S.keywords.map((k) => `<span>${k}</span>`).join("")}</div>
        <div class="summary"><div><b>Confidencialidad</b> → cifrado</div><div><b>Integridad</b> → hash</div><div><b>Autoría</b> → firma (clave privada)</div><div><b>Acceso al contenido cifrado</b> → clave</div></div>
        <div class="finish-code"><span>CÓDIGO DE FINALIZACIÓN · entrégalo al profesor para el ranking</span>${cmd(code, "Equipo " + esc(S.team) + " · " + S.groupCode)}</div>
        <button class="btn big keep" id="finBtn" type="button">FINALIZAR MISIÓN</button>
      </div>
    </section>`;
    confetti();
    $("#finBtn").onclick = () => { confetti(); modal({ title: "¡Buen trabajo, equipo!", body: `<p>Tiempo final: <b>${CN.fmtTime(elapsed)}</b> · ${S.score} puntos.</p><p>Copiad el código de finalización y entregádselo al profesor.</p>`, ok: "Hecho" }); };
  }
  function confetti() {
    const wrap = document.createElement("div");
    wrap.className = "confetti";
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = [L, N, LL, "#fff"][i % 4];
      p.style.animationDelay = Math.random() * 0.8 + "s";
      p.style.animationDuration = 2 + Math.random() * 1.5 + "s";
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(() => wrap.remove(), 4500);
  }

  /* ---------------- Arranque ---------------- */
  if (!window.crypto || !crypto.subtle) {
    app.innerHTML = `<div class="card narrow pad"><h2>Navegador no compatible</h2><p>Abre la web desde https:// (por ejemplo GitHub Pages) o desde localhost.</p></div>`;
    return;
  }
  const saved = load();
  if (saved && saved.groupCode) renderResume(saved); else renderIntro();
})();
