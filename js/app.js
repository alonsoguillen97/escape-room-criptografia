/* =========================================================
   OPERACIÓN CAJA NEGRA — escape room (web del alumnado)
   Cada fase es una sala con objetos interactivos.
   ========================================================= */
(function () {
  "use strict";
  const C = CN.CONFIG;
  const STORE = "cajanegra.v2";
  const app = document.getElementById("app");
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const N = "#101C3A", L = "#A9DB2E", LL = "#EAF8C9", W = "#ffffff", G = "#E4E8ED", R = "#D94444";

  let S = null, D = null, CUR = null; // estado, datos de grupo, sala actual

  /* =============== SONIDO (Web Audio, sin archivos) =============== */
  const Snd = {
    ctx: null,
    tone(f, dur = 0.12, type = "sine", vol = 0.12, delay = 0) {
      if (!S || S.muted) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = this.ctx.currentTime + delay, o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur + 0.02);
      } catch (e) {}
    },
    click() { this.tone(1100, 0.05, "square", 0.04); },
    ok() { [660, 880, 1320].forEach((f, i) => this.tone(f, 0.18, "triangle", 0.12, i * 0.09)); },
    bad() { this.tone(170, 0.25, "sawtooth", 0.12); this.tone(120, 0.3, "sawtooth", 0.1, 0.18); },
    item() { [520, 780].forEach((f, i) => this.tone(f, 0.14, "sine", 0.12, i * 0.08)); },
    open() { this.tone(300, 0.08, "triangle", 0.05); },
    door() { for (let i = 0; i < 8; i++) this.tone(90 + i * 25, 0.12, "square", 0.05, i * 0.07); this.ok(); },
    radio() { this.tone(1800, 0.03, "square", 0.03); },
  };

  /* =============== UTILIDADES UI =============== */
  function toast(msg, type = "ok") {
    const el = document.createElement("div");
    el.className = `toast-item ${type}`; el.textContent = msg;
    document.getElementById("toast").appendChild(el);
    setTimeout(() => el.classList.add("out"), 2800);
    setTimeout(() => el.remove(), 3300);
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
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  const cmd = (code, label = "PowerShell") =>
    `<div class="cmd"><div class="cmd-head"><span>${label}</span><button class="copy" type="button">Copiar</button></div><pre><code>${esc(code)}</code></pre></div>`;
  function files(body, list) {
    const box = document.createElement("div"); box.className = "files";
    box.innerHTML = list.map((f, i) => `<button class="file-btn" type="button" data-i="${i}"><span class="file-ico">${f.name.split(".").pop().toUpperCase()}</span><span>${esc(f.name)}</span><span class="file-dl">↓</span></button>`).join("");
    body.appendChild(box);
    $$("button", box).forEach((b) => (b.onclick = () => { const f = list[+b.dataset.i]; download(f.name, f.content); toast(`Descargado: ${f.name}`, "info"); f.onDownload && f.onDownload(); }));
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest(".copy"); if (!b) return;
    const txt = b.closest(".cmd").querySelector("code").textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(
      () => { b.textContent = "Copiado ✓"; setTimeout(() => (b.textContent = "Copiar"), 1500); },
      () => toast("No se pudo copiar: selecciónalo a mano", "bad"));
  });
  const norm = (s) => s.trim().toUpperCase().replace(/\s+/g, "");
  const hexIn = (s) => s.trim().toLowerCase().replace(/\s+/g, "");
  const CHEF = `<a href="https://gchq.github.io/CyberChef/" target="_blank" rel="noopener">CyberChef</a>`;

  /* ---------- Ventana de objeto (overlay) ---------- */
  let WIN = null;
  function openWin(title, build, { wide = false, icon = "🔎" } = {}) {
    if (WIN) WIN.close(true);
    const ov = document.createElement("div");
    ov.className = "win-ov";
    ov.innerHTML = `<div class="win ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="win-bar"><span class="win-dots"><i></i><i></i><i></i></span><span class="win-title">${icon} ${title}</span><button class="win-x" type="button" aria-label="Cerrar">✕</button></div><div class="win-body"></div></div>`;
    document.body.appendChild(ov);
    const onKey = (e) => { if (e.key === "Escape") close(); };
    function close(silent) {
      document.removeEventListener("keydown", onKey);
      ov.classList.add("closing"); setTimeout(() => ov.remove(), 160);
      WIN = null; if (!silent) refreshRoom();
    }
    document.addEventListener("keydown", onKey);
    $(".win-x", ov).onclick = () => close();
    ov.addEventListener("mousedown", (e) => { if (e.target === ov) close(); });
    WIN = { close, body: $(".win-body", ov) };
    Snd.open();
    build(WIN.body, close);
    setTimeout(() => { const f = $("input, .keypad, button:not(.win-x)", ov); f && f.focus(); }, 60);
  }

  /* ---------- Teclado numérico ---------- */
  function keypad(body, { len, label, onSubmit }) {
    const kp = document.createElement("div");
    kp.className = "keypad"; kp.tabIndex = 0;
    kp.innerHTML = `<div class="kp-screen"><span class="kp-label">${label}</span><span class="kp-val"></span></div><div class="kp-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "C", 0, "OK"].map((k) => `<button type="button" data-k="${k}" class="${k === "OK" ? "ok" : k === "C" ? "clr" : ""}">${k}</button>`).join("")}</div>`;
    body.appendChild(kp);
    let v = "";
    const show = () => ($(".kp-val", kp).textContent = v.padEnd(len, "_").split("").join(" "));
    async function press(k) {
      if (kp.classList.contains("solved")) return;
      Snd.click();
      if (k === "C") v = "";
      else if (k === "OK") {
        if (v.length < len) return;
        if (await onSubmit(v)) { kp.classList.add("solved"); $(".kp-label", kp).textContent = "ACCESO CONCEDIDO"; }
        else { kp.classList.add("err"); setTimeout(() => kp.classList.remove("err"), 600); v = ""; }
      } else if (v.length < len) v += k;
      show();
    }
    $$("button", kp).forEach((b) => (b.onclick = () => press(b.dataset.k)));
    kp.onkeydown = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === "Enter") press("OK"); else if (e.key === "Backspace") press("C"); };
    show();
    return kp;
  }

  /* ---------- Formulario de respuesta ---------- */
  function answer(body, { label, placeholder = "", btn = "Validar", check, mono = true }) {
    const f = document.createElement("form");
    f.className = "answer"; f.noValidate = true;
    f.innerHTML = `<label><span>${label}</span><input type="text" autocomplete="off" spellcheck="false" placeholder="${esc(placeholder)}" class="${mono ? "mono" : ""}"></label><button class="btn" type="submit">${btn}</button>`;
    body.appendChild(f);
    const inp = $("input", f);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const v = inp.value.trim(); if (!v) return inp.focus();
      const ok = await check(v);
      if (!ok) { inp.classList.add("shake"); setTimeout(() => inp.classList.remove("shake"), 500); }
    };
    return f;
  }

  /* ---------- Clasificador (arrastrar o clic) ---------- */
  function sorter(body, { cards, bins, onCheck, btn = "Comprobar" }) {
    const place = {}; let sel = null;
    const wrap = document.createElement("div"); wrap.className = "sorter";
    wrap.innerHTML = `<div class="sort-tray" data-bin=""></div><div class="sort-bins">${bins.map((b) => `<div class="sort-bin" data-bin="${b.id}"><div class="sort-bin-head">${b.label}</div><div class="sort-bin-body"></div></div>`).join("")}</div><button class="btn" type="button">${btn}</button>`;
    body.appendChild(wrap);
    const chip = (c) => `<button type="button" class="sort-card ${sel === c.id ? "selected" : ""}" draggable="true" data-card="${c.id}">${c.t}</button>`;
    function draw() {
      $(".sort-tray", wrap).innerHTML = cards.filter((c) => !place[c.id]).map(chip).join("") || `<span class="muted small">Todo colocado. Pulsa «${btn}».</span>`;
      $$(".sort-bin", wrap).forEach((b) => ($(".sort-bin-body", b).innerHTML = cards.filter((c) => place[c.id] === b.dataset.bin).map(chip).join("")));
      $$(".sort-card", wrap).forEach((el) => {
        el.ondragstart = (e) => e.dataTransfer.setData("text/plain", el.dataset.card);
        el.onclick = (e) => { e.stopPropagation(); sel = sel === el.dataset.card ? null : el.dataset.card; Snd.click(); draw(); };
      });
    }
    $$("[data-bin]", wrap).forEach((z) => {
      z.ondragover = (e) => { e.preventDefault(); z.classList.add("over"); };
      z.ondragleave = () => z.classList.remove("over");
      z.ondrop = (e) => { e.preventDefault(); z.classList.remove("over"); const id = e.dataTransfer.getData("text/plain"); if (z.dataset.bin) place[id] = z.dataset.bin; else delete place[id]; sel = null; draw(); };
      z.onclick = () => { if (!sel) return; if (z.dataset.bin) place[sel] = z.dataset.bin; else delete place[sel]; sel = null; Snd.click(); draw(); };
    });
    $(".btn", wrap).onclick = () => onCheck(place);
    draw();
  }

  /* =============== ESCENAS (ilustraciones de cada sala) =============== */
  const sk = (inner, wall = LL) => `<svg viewBox="0 0 800 420" class="scene-svg" aria-hidden="true"><rect width="800" height="420" fill="${wall}"/><rect y="330" width="800" height="90" fill="${G}"/><g fill="none" stroke="${N}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M0 330H800"/>${inner}</g></svg>`;
  const txt = (x, y, t, size = 14, fill = N, weight = 800, extra = "") => `<text x="${x}" y="${y}" font-family="Manrope, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="none" ${extra}>${t}</text>`;
  const mono = (x, y, t, size = 12, fill = N) => `<text x="${x}" y="${y}" font-family="JetBrains Mono, monospace" font-size="${size}" font-weight="700" fill="${fill}" stroke="none">${t}</text>`;

  const SCENES = {
    oficina: () => sk(`
      <rect x="40" y="50" width="160" height="120" rx="8" fill="#CFE6FF"/><path d="M120 50V170M40 110H200"/>
      <rect x="230" y="60" width="90" height="120" rx="6" fill="${W}"/>${txt(246, 88, "AVISO", 15)}<path d="M246 104h58M246 120h58M246 136h40" stroke-width="4"/>
      <rect x="250" y="250" width="320" height="18" rx="4" fill="${W}"/><path d="M270 268v62M550 268v62"/>
      <rect x="345" y="150" width="130" height="88" rx="8" fill="${N}"/><rect x="357" y="162" width="106" height="64" rx="4" fill="${LL}" stroke="${LL}" stroke-width="2"/>
      <path d="M368 176h20v14h-20zM396 176h20v14h-20zM424 176h20v14h-20z" stroke="${N}" stroke-width="3" fill="${L}"/>${mono(368, 214, "D:\\ E:\\", 11)}
      <path d="M330 238h160l12 12H318z" fill="${W}"/>
      <rect x="512" y="230" width="44" height="20" rx="4" fill="${L}"/><path d="M502 240h10" />
      <g data-unless="door"><rect x="630" y="90" width="130" height="240" rx="6" fill="${W}"/><circle cx="650" cy="215" r="7" fill="${L}"/></g>
      <g data-when="door"><rect x="630" y="90" width="130" height="240" rx="6" fill="${N}"/><path d="M630 90l40 18v240l-40-18" fill="${W}"/>${txt(668, 220, "→", 40, L)}</g>
      <rect x="598" y="190" width="26" height="42" rx="5" fill="${N}"/><circle cx="611" cy="203" r="4" fill="${L}" stroke="${L}"/>`),
    servidores: () => sk(`
      <rect x="60" y="270" width="170" height="14" rx="4" fill="${W}"/><rect x="70" y="170" width="150" height="96" rx="8" fill="${N}"/>${mono(84, 200, "&gt; nota...", 13, L)}${mono(84, 222, "TkFUQSAt", 13, W)}
      <rect x="310" y="55" width="180" height="275" rx="10" fill="${N}"/>
      <g data-unless="rack"><rect x="324" y="70" width="152" height="245" rx="6" fill="#5E6B8C" stroke="${W}" stroke-width="3"/><path d="M340 90l40 60M360 90l60 90" stroke="${W}" stroke-width="3" opacity=".5"/></g>
      <g data-when="rack"><rect x="324" y="78" width="152" height="40" rx="4" fill="${W}"/><rect x="324" y="130" width="152" height="40" rx="4" fill="${L}"/><rect x="324" y="182" width="152" height="40" rx="4" fill="${W}"/><rect x="324" y="234" width="152" height="40" rx="4" fill="${W}"/>
        <circle cx="342" cy="98" r="5" fill="${L}"/><circle cx="342" cy="150" r="5" fill="${N}"/><circle cx="342" cy="202" r="5" fill="${L}"/><circle cx="342" cy="254" r="5" fill="${L}"/>${txt(372, 156, "USB", 15)}</g>
      <rect x="500" y="170" width="28" height="46" rx="5" fill="${W}"/><circle cx="514" cy="184" r="4" fill="${L}"/>
      <rect x="580" y="60" width="180" height="120" rx="8" fill="${W}"/>${txt(594, 88, "BASE64 =", 15)}${mono(594, 112, "A-Z a-z 0-9 + /", 13)}${mono(594, 134, "relleno: =", 13)}${txt(594, 162, "¿cifrado? 🤔", 14)}`, "#DDE6F3"),
    carlos: () => sk(`
      <rect x="60" y="170" width="110" height="80" rx="10" fill="${W}"/><path d="M60 200h110"/><path d="M115 250v80"/><path d="M170 180v-30h22v14h-22" fill="${R}" stroke="${N}"/>${txt(84, 232, "BUZÓN", 13)}
      <rect x="220" y="60" width="130" height="100" rx="6" fill="#E9C994"/><rect x="236" y="74" width="98" height="72" rx="4" fill="#FFF6D8"/>${txt(242, 100, "Descifrador", 13)}${txt(246, 120, "RSA", 13)}<circle cx="285" cy="70" r="5" fill="${R}"/>
      <rect x="330" y="262" width="320" height="16" rx="4" fill="${W}"/><path d="M350 278v52M630 278v52"/>
      <g data-unless="caja"><rect x="420" y="205" width="120" height="57" rx="8" fill="#C7A06A"/><rect x="465" y="222" width="30" height="26" rx="4" fill="${L}"/><path d="M470 222v-8a10 10 0 0 1 20 0v8"/></g>
      <g data-when="caja"><rect x="420" y="225" width="120" height="37" rx="8" fill="#C7A06A"/><path d="M420 225l-10-40h120l10 40" fill="#E2BE88"/>${txt(450, 218, "✉ OK", 14, N)}</g>
      <g data-when="caja"><rect x="665" y="236" width="100" height="26" rx="4" fill="${W}"/>${txt(678, 254, "SALIDA", 12)}<rect x="690" y="215" width="50" height="22" rx="3" fill="${LL}"/></g>`, "#FFFDF5"),
    archivo: () => sk(`
      <rect x="30" y="50" width="190" height="280" rx="6" fill="${W}"/><path d="M30 120h190M30 190h190M30 260h190"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<rect x="${44 + i * 28}" y="66" width="20" height="50" rx="3" fill="${i % 2 ? L : LL}"/><rect x="${44 + i * 28}" y="136" width="20" height="50" rx="3" fill="${i % 2 ? LL : W}"/><rect x="${44 + i * 28}" y="206" width="20" height="50" rx="3" fill="${i % 3 ? L : W}"/>`).join("")}
      <rect x="250" y="285" width="330" height="16" rx="4" fill="${W}"/><path d="M270 301v29M560 301v29"/>
      ${[0, 1, 2, 3].map((i) => `<g transform="rotate(${[-4, 3, -2, 5][i]} ${293 + i * 72} 245)"><rect x="${265 + i * 72}" y="205" width="56" height="75" rx="4" fill="${W}"/><path d="M${275 + i * 72} 222h36M${275 + i * 72} 236h36M${275 + i * 72} 250h24" stroke-width="3"/>${txt(287 + i * 72, 274, String(i + 1), 13)}</g>`).join("")}
      <rect x="615" y="150" width="150" height="180" rx="10" fill="${N}"/><rect x="630" y="168" width="120" height="60" rx="6" fill="${LL}" stroke="${LL}" stroke-width="2"/>${mono(640, 194, "SHA-256", 13)}${mono(640, 214, "VERIF.", 13)}
      <rect x="630" y="250" width="120" height="16" rx="4" fill="${W}"/><path class="laser" d="M630 290h120" stroke="${R}" stroke-width="4"/>`, "#F1F4E6"),
    lab: () => sk(`
      <rect x="40" y="262" width="720" height="16" rx="4" fill="${W}"/><path d="M60 278v52M740 278v52"/>
      <rect x="80" y="140" width="170" height="112" rx="8" fill="${N}"/>${txt(96, 168, "MONITOR A", 12, L)}${mono(96, 196, "1000 EUR", 13, W)}${mono(96, 222, "#a3f9…", 13, W)}
      <rect x="290" y="140" width="170" height="112" rx="8" fill="${N}"/>${txt(306, 168, "MONITOR B", 12, L)}${mono(306, 196, "9000 EUR", 13, W)}${mono(306, 222, "#0c71…", 13, W)}
      <rect x="540" y="110" width="200" height="150" rx="12" fill="${W}"/><rect x="600" y="70" width="80" height="50" rx="6" fill="${L}"/><path d="M640 120v40"/><rect x="590" y="160" width="100" height="40" rx="6" fill="${N}"/>${txt(560, 240, "SELLADORA SHA-256", 12)}
      <g data-when="sello"><rect x="575" y="275" width="130" height="40" rx="6" fill="${L}" transform="rotate(-6 640 295)"/>${txt(588, 302, "SELLADO ✓", 16, N, 800, 'transform="rotate(-6 640 295)"')}</g>`, "#EAF0FA"),
    copias: () => sk(`
      <rect x="60" y="170" width="100" height="160" rx="8" fill="${W}"/>${[0, 1, 2, 3].map((i) => `<rect x="74" y="${186 + i * 34}" width="72" height="22" rx="3" fill="${LL}"/><circle cx="136" cy="${197 + i * 34}" r="4" fill="${L}"/>`).join("")}${txt(88, 322, "NAS", 13)}
      <rect x="190" y="130" width="130" height="200" rx="8" fill="${N}"/>${[0, 1, 2, 3, 4].map((i) => `<rect x="204" y="${146 + i * 34}" width="102" height="22" rx="3" fill="${i === 2 ? L : W}"/>`).join("")}${txt(222, 320, "CINTAS LTO", 12, W)}
      <rect x="360" y="270" width="170" height="14" rx="4" fill="${W}"/><rect x="370" y="170" width="150" height="96" rx="8" fill="${N}"/>${mono(384, 200, "RESTAURAR", 13, L)}${mono(384, 222, "4 copias", 13, W)}
      <rect x="560" y="50" width="200" height="120" rx="8" fill="#CFE6FF"/><path d="M610 120a20 20 0 0 1 8-36 28 28 0 0 1 52 4 18 18 0 0 1 6 32z" fill="${W}"/>${txt(600, 155, "Plan 3-2-1", 14)}
      <g class="van" data-anim="plan"><rect x="560" y="268" width="150" height="50" rx="10" fill="${W}"/><path d="M710 280h30l14 20v18h-44z" fill="${L}"/><circle cx="595" cy="322" r="12" fill="${N}"/><circle cx="700" cy="322" r="12" fill="${N}"/>${txt(575, 298, "OFFSITE", 13)}</g>`, "#F4F6F8"),
    despacho: () => sk(`
      <rect x="80" y="60" width="150" height="110" rx="6" fill="#E9C994"/><rect x="94" y="74" width="122" height="82" fill="#CFE6FF"/><path d="M94 156l40-40 30 26 22-18 30 32" fill="${L}"/>
      <rect x="200" y="262" width="330" height="16" rx="4" fill="${W}"/><path d="M220 278v52M510 278v52"/>
      <rect x="260" y="152" width="150" height="104" rx="8" fill="${N}"/><rect x="272" y="164" width="126" height="70" rx="4" fill="${LL}" stroke="${LL}"/>${txt(282, 190, "✉ 1 nuevo", 13)}${mono(282, 214, "AES-256", 12)}<path d="M320 256v6h30v-6"/>
      <rect x="560" y="105" width="190" height="190" rx="12" fill="#9AA4B8"/>
      <g data-unless="caja"><rect x="575" y="120" width="160" height="160" rx="8" fill="${W}"/><circle cx="655" cy="200" r="46" fill="${LL}"/><circle cx="655" cy="200" r="10" fill="${N}"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<path d="M${655 + 38 * Math.cos((i * Math.PI) / 4)} ${200 + 38 * Math.sin((i * Math.PI) / 4)}L${655 + 46 * Math.cos((i * Math.PI) / 4)} ${200 + 46 * Math.sin((i * Math.PI) / 4)}" stroke-width="3"/>`).join("")}<path d="M712 190v20" stroke-width="7"/></g>
      <g data-when="caja"><rect x="575" y="120" width="160" height="160" rx="8" fill="${N}"/><path d="M575 120l-50 20v160l50-20" fill="${W}"/><rect x="600" y="210" width="110" height="50" rx="6" fill="${L}"/>${txt(612, 241, "DISCO ✓", 15)}</g>`, "#FFF6EC"),
    camara: () => sk(`
      <rect x="40" y="252" width="220" height="16" rx="4" fill="${W}"/><path d="M60 268v62M240 268v62"/><rect x="80" y="200" width="140" height="52" rx="8" fill="${L}"/>${txt(108, 232, "KIT 7-ZIP", 14)}
      <g class="vault-door-s" data-anim="k2"><circle cx="470" cy="190" r="140" fill="#B9C2D3"/><circle cx="470" cy="190" r="112" fill="${W}"/>
        <g class="wheel"><circle cx="470" cy="190" r="22" fill="${N}"/>${[0, 1, 2, 3, 4, 5].map((i) => `<path d="M${470 + 26 * Math.cos((i * Math.PI) / 3)} ${190 + 26 * Math.sin((i * Math.PI) / 3)}L${470 + 80 * Math.cos((i * Math.PI) / 3)} ${190 + 80 * Math.sin((i * Math.PI) / 3)}" stroke-width="9"/>`).join("")}<circle cx="470" cy="190" r="80" stroke-width="6"/></g></g>
      <rect x="690" y="110" width="90" height="190" rx="10" fill="${N}"/>
      <rect x="705" y="128" width="60" height="60" rx="6" fill="${W}"/><path d="M735 145v26" stroke-width="7"/>${txt(712, 205, "LLAVE 1", 11, W)}
      <rect x="705" y="218" width="60" height="60" rx="6" fill="${W}"/><path d="M735 235v26" stroke-width="7"/>${txt(712, 294, "LLAVE 2", 11, W)}
      <g data-when="k1"><rect x="705" y="128" width="60" height="60" rx="6" fill="${L}"/>${txt(722, 166, "✓", 26)}</g>
      <g data-when="k2"><rect x="705" y="218" width="60" height="60" rx="6" fill="${L}"/>${txt(722, 256, "✓", 26)}</g>`, "#E8ECF2"),
    salida: () => sk(`
      <rect x="190" y="90" width="420" height="220" rx="14" fill="${N}"/>${txt(214, 124, "PANEL DE CONTROL · PRINCIPIOS DE SEGURIDAD", 13, L)}
      ${["C", "I", "D", "A", "✗"].map((t, i) => `<rect x="${214 + i * 78}" y="150" width="62" height="120" rx="8" fill="${i === 4 ? "#FFD8D8" : i % 2 ? LL : L}"/>${txt(235 + i * 78, 222, t, 28)}`).join("")}
      <g data-unless="sorted"><rect x="655" y="80" width="115" height="250" rx="6" fill="${W}"/>${txt(668, 70, "SALIDA", 18, R)}<circle cx="672" cy="210" r="7" fill="${R}"/></g>
      <g data-when="sorted"><rect x="655" y="80" width="115" height="250" rx="6" fill="${L}"/><path d="M655 80l35 16v250l-35-16" fill="${W}"/>${txt(668, 70, "SALIDA", 18, "#4b7a00")}${txt(705, 220, "→", 46)}</g>`, "#EEF2E3"),
  };

  /* =============== SALAS =============== */
  const P = (k) => CUR.parts[k];
  const ROOMS = [
    /* ---------------- SALA 1 ---------------- */
    {
      id: "oficina", short: "Oficina", title: "La oficina del empleado", scene: "oficina", keyword: "CIFRADO",
      intro: "Aquí Jefa de Seguridad. El SSD perdido ha aparecido conectado al portátil del atacante. Mira qué ha podido ver… y busca cómo salir de la oficina: la puerta tiene teclado.",
      hints: [
        "Abre el portátil. Hay dos unidades: entra en las dos. En la carpeta Personal hay un pósit con una pista para la puerta.",
        "En RRHH/empleados.csv: filtra por Logística y busca la fecha de alta más antigua. Puedes ordenar la tabla haciendo clic en las cabeceras.",
      ],
      lesson: "El atacante ha leído todo el SSD sin conocer ninguna contraseña: la contraseña de Windows no protege un disco conectado a otro equipo. La unidad <b>E:</b>, cifrada con <b>BitLocker</b>, ha resistido. Para proteger <b>datos en reposo</b> hace falta <b>cifrado</b>.",
      objectives: [
        { key: "drives", label: "Entra en las dos unidades del SSD" },
        { key: "nota", label: "Encuentra el archivo sospechoso de la carpeta Personal" },
        { key: "door", label: "Abre la puerta de la oficina" },
      ],
      hotspots: [
        { id: "laptop", x: 320, y: 140, w: 190, h: 120, label: "Portátil del atacante", done: (a) => a.done("drives") && a.done("nota"), open: openExplorer },
        { id: "poster", x: 225, y: 55, w: 100, h: 130, label: "Aviso", open: (a) => openWin("Aviso de seguridad", (b) => (b.innerHTML = `<div class="paper"><h3>AVISO A TODO EL PERSONAL</h3><p>Recordad que el ordenador de la empresa tiene contraseña.</p><p><b>Por tanto vuestros datos están seguros.</b></p><p class="small muted">— Dirección (2019)</p></div><p class="small muted">¿Seguro? Compruébalo tú mismo con el portátil del atacante.</p>`), { icon: "📌" }) },
        { id: "door", x: 590, y: 180, w: 45, h: 62, label: "Teclado de la puerta", done: (a) => a.done("door"), open: (a) => openWin("Puerta de la oficina", (b, close) => {
          b.insertAdjacentHTML("beforeend", `<p>Código de 6 dígitos.</p>`);
          keypad(b, { len: 6, label: "CÓDIGO", onSubmit: async (v) => { if (v === D.badge) { a.complete("door", "Puerta abierta"); Snd.door(); setTimeout(close, 900); return true; } a.fail("Código incorrecto"); return false; } });
        }, { icon: "🚪" }) },
      ],
    },
    /* ---------------- SALA 2 ---------------- */
    {
      id: "servidores", short: "Servidores", title: "La sala de servidores", scene: "servidores", keyword: "CODIFICACIÓN",
      intro: "Estás en la sala de servidores. El armario rack pide un PIN de 4 dígitos. El autor de la nota que encontraste dice que la «cifró»… Revisa tu inventario.",
      hints: [
        "La nota del inventario está en Base64: no necesitas ninguna contraseña. Mira el monitor de la mesa.",
        "En PowerShell, en la carpeta de Descargas: Get-Content con -Raw y luego [Convert]::FromBase64String. O CyberChef → From Base64.",
      ],
      lesson: "Has leído la nota <b>sin ninguna clave</b>: Base64 es una <b>codificación</b>, solo cambia la forma de representar los datos. <b>Codificar ≠ cifrar.</b> Un cifrado de verdad (AES, RSA…) exige una clave.",
      objectives: [
        { key: "rack", label: "Abre el armario rack" },
        { key: "usb", label: "Recoge lo que hay dentro" },
      ],
      hotspots: [
        { id: "monitor", x: 62, y: 160, w: 168, h: 115, label: "Monitor del técnico", open: () => openWin("Terminal del técnico", (b) => {
          b.innerHTML = `<p>El técnico dejó abierto su manual de descodificación:</p>${cmd(`cd $HOME\\Downloads\n$t = Get-Content .\\nota_recuperada.txt -Raw\n[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($t))`)}<p>Alternativa: ${CHEF} → operación <b>From Base64</b>.</p><p class="small muted">La nota la tienes en tu inventario (abajo).</p>`;
        }, { icon: "🖥️" }) },
        { id: "keypad", x: 492, y: 160, w: 45, h: 66, label: "PIN del rack", done: (a) => a.done("rack"), open: (a) => openWin("Armario rack", (b, close) => {
          keypad(b, { len: 4, label: "PIN", onSubmit: async (v) => { if (v === D.pin) { a.complete("rack", "Armario abierto"); Snd.door(); setTimeout(close, 900); return true; } a.fail("PIN incorrecto"); return false; } });
        }, { icon: "🔢" }) },
        { id: "usb", x: 320, y: 125, w: 160, h: 50, label: "Llavero USB", show: (a) => a.done("rack"), done: (a) => a.done("usb"), open: (a) => { a.give("llavero"); a.complete("usb", "Has cogido el llavero de Carlos"); a.radio("Ese llavero USB es de Carlos, de Finanzas: guarda sus claves criptográficas. Llévalo a su despacho, Ana le ha dejado una carta."); } },
        { id: "board", x: 575, y: 55, w: 190, h: 130, label: "Pizarra", open: () => openWin("Pizarra", (b) => (b.innerHTML = `<div class="paper"><p><b>Base64</b> usa 64 símbolos: <code>A-Z a-z 0-9 + /</code> y rellena con <code>=</code>.</p><p>Convierte cualquier dato binario en texto «imprimible». Se usa en correos, certificados, claves PEM…</p><p>¿Oculta algo? 🤔</p></div>`), { icon: "📋" }) },
      ],
    },
    /* ---------------- SALA 3 ---------------- */
    {
      id: "carlos", short: "Carlos", title: "El despacho de Carlos", scene: "carlos", keyword: "CLAVE",
      intro: "Despacho de Carlos. Ana le dejó una carta cifrada con RSA en el buzón. Recógela y usa el descifrador de la pared: tienes que cargar la clave correcta del llavero. En la carta está la combinación de la caja.",
      hints: [
        "La carta se cifró con la clave PÚBLICA de Carlos. ¿Qué clave la abre?",
        "Abre los archivos .pem del llavero con el Bloc de notas: la primera línea dice PUBLIC o PRIVATE.",
      ],
      lesson: "Lo cifrado con la <b>clave pública</b> de alguien solo se descifra con su <b>clave privada</b>. Por eso la pública se puede repartir y la privada no sale nunca del llavero. Para responder a Ana se usa <b>su</b> clave pública.",
      objectives: [
        { key: "carta", label: "Recoge la carta del buzón" },
        { key: "caja", label: "Descifra la carta y abre la caja" },
        { key: "reply", label: "Responde a Ana de forma segura" },
      ],
      hotspots: [
        { id: "mail", x: 55, y: 140, w: 140, h: 120, label: "Buzón", done: (a) => a.done("carta"), open: (a) => { a.give("carta"); a.complete("carta", "Tienes la carta cifrada de Ana"); openItem("carta"); } },
        { id: "manual", x: 215, y: 55, w: 140, h: 110, label: "Descifrador RSA", show: (a) => a.done("carta"), open: (a) => openWin("Descifrador RSA de Carlos", (b) => {
          b.innerHTML = `<p>Este programa descifra cartas RSA. <b>Elige qué clave del llavero cargar</b>:</p><div class="keys-pick three">${[["carlosPub", "carlos_publica.pem", "pub"], ["carlosPriv", "carlos_privada.pem", "priv"], ["anaPub", "ana_publica.pem", "pub"]].map(([k, t, c]) => `<button type="button" class="keycard ${c}" data-key="${k}"><span>${c === "priv" ? "🔑" : "🗝️"}</span>${t}</button>`).join("")}</div><p class="small muted">Pista: abre los .pem del llavero con el Bloc de notas. La primera línea dice qué tipo de clave es.</p><div class="dec-out"></div>`;
          $$("[data-key]", b).forEach((k) => (k.onclick = async () => {
            const out = $(".dec-out", b);
            if (k.dataset.key !== "carlosPriv") {
              k.classList.add("wrong");
              out.innerHTML = `<div class="scan-screen nomatch"><b>✗ ERROR AL DESCIFRAR</b><br>${k.dataset.key === "anaPub" ? "Esa clave es de Ana, y además es pública: una clave pública no descifra." : "Una clave PÚBLICA sirve para cifrar, no para descifrar."}</div>`;
              return a.fail("Esa clave no abre la carta");
            }
            k.classList.add("correct");
            out.innerHTML = `<div class="scan-screen scanning"><div class="scan-line"></div><div class="scan-out">Descifrando con carlos_privada.pem…</div></div>`;
            const txt = await CN.rsaDecrypt(S.rsa.carlosPriv, S.rsa.cipherB64);
            await sleep(1000);
            out.innerHTML = `<div class="paper mono-paper">${esc(txt)}</div><p class="small muted">Lo que se cifra con la clave <b>pública</b> de Carlos solo se abre con su clave <b>privada</b>.</p>`;
            Snd.ok();
          }));
        }, { icon: "💻", wide: true }) },
        { id: "box", x: 405, y: 175, w: 150, h: 92, label: "Caja con candado", done: (a) => a.done("caja"), open: (a) => openWin("Candado de combinación", (b, close) => {
          b.insertAdjacentHTML("beforeend", `<p>Tres ruedas. La combinación está en la carta de Ana.</p>`);
          wheels(b, 3, async (vals) => { if (vals.join("") === D.combo.join("")) { a.complete("caja", "¡Candado abierto!"); Snd.door(); a.radio("Dentro hay un borrador: Carlos tenía que contestar a Ana. Usa la bandeja de salida."); setTimeout(close, 900); return true; } a.fail("El candado no se abre"); return false; });
        }, { icon: "🔒" }) },
        { id: "tray", x: 650, y: 200, w: 125, h: 75, label: "Bandeja de salida", show: (a) => a.done("caja"), done: (a) => a.done("reply"), open: (a) => openWin("Responder a Ana", (b, close) => {
          b.innerHTML = `<p>Carlos quiere contestar a Ana con información confidencial. <b>¿Con qué clave cierras el sobre?</b></p><div class="keys-pick">${[["pubC", "Pública de Carlos", "pub"], ["privC", "Privada de Carlos", "priv"], ["pubA", "Pública de Ana", "pub"], ["privA", "Privada de Ana", "priv"]].map(([k, t, c]) => `<button type="button" class="keycard ${c}" data-k="${k}"><span>${c === "priv" ? "🔑" : "🗝️"}</span>${t}</button>`).join("")}</div><div class="envelope-anim"></div>`;
          const why = { pubC: "Con tu propia clave pública, solo TÚ podrías abrirlo. Ana no.", privC: "Lo «cifrado» con tu privada lo abre cualquiera con tu pública: eso es firmar, no cifrar.", privA: "Tú no tienes la clave privada de Ana… ni deberías tenerla nunca." };
          $$("[data-k]", b).forEach((k) => (k.onclick = () => {
            if (a.done("reply")) return;
            if (k.dataset.k === "pubA") { k.classList.add("correct"); $(".envelope-anim", b).classList.add("go"); a.complete("reply", "Respuesta enviada: solo Ana podrá leerla"); setTimeout(close, 1400); }
            else { k.classList.add("wrong"); a.fail(why[k.dataset.k]); }
          }));
        }, { icon: "✉️" }) },
      ],
    },
    /* ---------------- SALA 4 ---------------- */
    {
      id: "archivo", short: "Archivo", title: "El archivo de contratos", scene: "archivo", keyword: "INTEGRIDAD",
      intro: "En la mesa hay cuatro copias del contrato de pago. Alguien ha manipulado tres. El verificador SHA-256 tiene la huella del original, pero solo escanea si le das la huella del documento que metes.",
      hints: [
        "Descarga los cuatro contratos (clic en cada uno). Get-FileHash .\\contrato_*.txt te da las cuatro huellas a la vez.",
        "Mete en el verificador cada contrato con los 8 primeros caracteres de SU hash. Tienes que escanear los cuatro: tres serán evidencias.",
      ],
      lesson: "A simple vista los cuatro eran iguales: los cambios eran un espacio de más, un espacio duro o una «а» cirílica. El <b>hash</b> detecta cualquier cambio en un solo byte: es la herramienta para comprobar la <b>integridad</b>.",
      objectives: [
        { key: "auth", label: "Identifica el contrato auténtico" },
        { key: "evid", label: "Registra los 3 contratos manipulados como evidencia" },
      ],
      hotspots: [
        ...[0, 1, 2, 3].map((i) => ({ id: "doc" + i, x: 258 + i * 72, y: 196, w: 66, h: 90, label: `Contrato ${i + 1}`, done: (a) => (a.get("scanned") || []).includes(i), open: () => openWin(`contrato_${i + 1}.txt`, (b) => {
          b.innerHTML = `<pre class="paper mono-paper">${esc(D.contracts[i].content)}</pre><p class="small muted">Parece idéntico a los demás… ¿lo es?</p>`;
          files(b, [D.contracts[i]]);
        }, { icon: "📄" }) })),
        { id: "scanner", x: 608, y: 145, w: 165, h: 192, label: "Verificador SHA-256", done: (a) => a.done("auth") && a.done("evid"), open: openScanner },
      ],
    },
    /* ---------------- SALA 5 ---------------- */
    {
      id: "lab", short: "Laboratorio", title: "El laboratorio de huellas", scene: "lab", keyword: "HASH",
      intro: "Laboratorio de huellas. Antes de autorizar la transferencia hay que demostrar cómo se comporta SHA-256 cuando cambia un solo carácter. Y la selladora solo acepta transferencias con un hash muy concreto…",
      hints: [
        "El contenido debe ser EXACTO. Créalo con el comando Set-Content que aparece en el monitor y pega el hash completo (64 caracteres).",
        "Selladora: copia el script entero, pégalo en PowerShell y pulsa Intro. Él solo prueba números hasta encontrar uno válido.",
      ],
      lesson: "Cambiar <b>un carácter</b> cambia el hash por completo (<b>efecto avalancha</b>), y no hay forma de predecir el resultado: para conseguir un hash concreto solo queda <b>probar y probar</b>. Por eso nadie puede fabricar un documento falso con la misma huella.",
      objectives: [
        { key: "a", label: "Monitor A: hash del mensaje original" },
        { key: "b", label: "Monitor B: hash tras cambiar un carácter" },
        { key: "sello", label: "Consigue el sello de la transferencia" },
      ],
      hotspots: [
        { id: "ma", x: 75, y: 135, w: 180, h: 122, label: "Monitor A", done: (a) => a.done("a"), open: (a) => openWin("Monitor A", (b, close) => {
          b.innerHTML = `<p>Crea <code>mensaje.txt</code> con este contenido exacto y calcula su SHA-256:</p><div class="hashbox"><code>${esc(D.msg1)}</code></div>${cmd(`Set-Content .\\mensaje.txt "${D.msg1}" -NoNewline\nGet-FileHash .\\mensaje.txt -Algorithm SHA256`)}`;
          answer(b, { label: "Hash completo (64 caracteres)", placeholder: "pega aquí el hash", check: async (v) => { if (D.msg1Set.has(hexIn(v))) { a.set("hashA", hexIn(v)); a.complete("a", "Hash A registrado"); close(); return true; } a.fail("Ese hash no corresponde al mensaje"); return false; } });
        }, { icon: "🖥️" }) },
        { id: "mb", x: 285, y: 135, w: 180, h: 122, label: "Monitor B", show: (a) => a.done("a"), done: (a) => a.done("b"), open: (a) => openWin("Monitor B", (b) => {
          b.innerHTML = `<p>Cambia <b>solo</b> <code>1000</code> por <code>9000</code> y vuelve a calcular:</p>${cmd(`Set-Content .\\mensaje.txt "${D.msg2}" -NoNewline\nGet-FileHash .\\mensaje.txt -Algorithm SHA256`)}<div class="diff-out"></div>`;
          const showDiff = () => diffViz($(".diff-out", b), a.get("hashA"), a.get("hashB"));
          if (a.done("b")) return showDiff();
          answer(b, { label: "Nuevo hash completo", placeholder: "pega aquí el hash", check: async (v) => { if (D.msg2Set.has(hexIn(v))) { a.set("hashB", hexIn(v)); $("form", b).remove(); await showDiff(); a.complete("b", "Comparación completada"); return true; } a.fail("Ese hash no corresponde al mensaje modificado"); return false; } });
        }, { icon: "🖥️", wide: true }) },
        { id: "sell", x: 535, y: 65, w: 215, h: 200, label: "Selladora", show: (a) => a.done("b"), done: (a) => a.done("sello"), open: (a) => openWin("Selladora SHA-256", (b, close) => {
          b.innerHTML = `<p>Norma de la empresa: solo se sellan transferencias cuyo SHA-256 <b>empiece por <code>${C.MINING_PREFIX}</code></b>. Para conseguirlo se añade al final <code> #número</code>. ¿Qué número? Nadie lo sabe: hay que probar.</p>
            <div class="hashbox"><code>${esc(D.msg1)} #<span class="hl">?</span></code></div>
            ${cmd(`$base = "${D.msg1}"\n$sha = [Security.Cryptography.SHA256]::Create()\nfor ($n = 0; $n -lt 100000; $n++) {\n  $texto = "$base #$n"\n  $hash = -join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($texto)) | ForEach-Object { $_.ToString("x2") })\n  if ($hash.StartsWith("${C.MINING_PREFIX}")) { "$n  ->  $hash"; break }\n}`)}
            <p class="small muted"><b>Copia el script, pégalo en PowerShell y pulsa Intro.</b> El ordenador prueba números uno a uno (0, 1, 2…) hasta que el hash empieza por <code>${C.MINING_PREFIX}</code>. Así funciona un hash: no se puede adivinar, solo probar.</p><div class="stamp-zone"></div>`;
          answer(b, { label: "Número que consigue el sello", placeholder: "p. ej. 1234", btn: "Sellar", check: async (v) => {
            if (await CN.checkMining(D, v.trim())) { const h = await CN.sha256(D.mineText(v.trim())); $(".stamp-zone", b).innerHTML = `<div class="stamp">SELLADO</div><p class="mono small">${h}</p>`; a.complete("sello", "Transferencia sellada"); Snd.door(); return true; }
            a.fail(`Con ese número el hash no empieza por ${C.MINING_PREFIX}`); return false; } });
        }, { icon: "🔏", wide: true }) },
      ],
    },
    /* ---------------- SALA 6 ---------------- */
    {
      id: "copias", short: "Copias", title: "La sala de copias de seguridad", scene: "copias", keyword: "RESPALDO",
      intro: "Hay que restaurar los datos desde las copias de anoche. Ojo: una de ellas no es fiable. Y luego, diseña un plan de copias que aguante cualquier desastre.",
      hints: [
        "Compara cada copia con su línea de SHA256SUMS.txt: Get-FileHash .\\backup_*.txt",
        "3-2-1: tres copias, en al menos dos tipos de soporte distintos, al menos una fuera de la oficina. Y la que sale fuera… ¿cómo viaja?",
      ],
      lesson: "Una copia sin verificar es una copia en la que no se puede confiar: el <b>manifiesto de hashes</b> detecta la corrupción. La regla <b>3-2-1</b> garantiza la disponibilidad, y la copia que sale del edificio debe ir <b>cifrada</b>: si no, volvemos al SSD de la sala 1.",
      objectives: [
        { key: "verify", label: "Detecta la copia corrupta" },
        { key: "plan", label: "Diseña un plan 3-2-1 seguro" },
      ],
      hotspots: [
        { id: "console", x: 362, y: 160, w: 166, h: 120, label: "Consola de restauración", done: (a) => a.done("verify"), open: (a) => openWin("Consola de restauración", (b, close) => {
          b.innerHTML = `<p>Copias de anoche y su manifiesto de huellas:</p>`;
          files(b, [...D.backups, { name: "SHA256SUMS.txt", content: D.manifest }]);
          b.insertAdjacentHTML("beforeend", `${cmd("Get-Content .\\SHA256SUMS.txt\nGet-FileHash .\\backup_*.txt -Algorithm SHA256 | Format-Table Hash, Path")}<p class="q">Marca la copia corrupta y demuestra su hash real:</p><div class="radio-list">${D.backups.map((x, i) => `<label class="check"><input type="radio" name="bk" value="${i}"><span>${x.name}</span></label>`).join("")}</div>`);
          answer(b, { label: "8 primeros caracteres de su hash REAL (el que tú calculas)", placeholder: "8 caracteres", btn: "Bloquear copia", check: async (v) => {
            const sel = $("input[name=bk]:checked", b);
            if (!sel) { toast("Marca primero una copia", "info"); return false; }
            const i = +sel.value, real = (await CN.sha256(D.backups[i].content)).slice(0, 8);
            if (hexIn(v).slice(0, 8) !== real) { a.fail("Ese no es el hash de esa copia"); return false; }
            if (i !== D.corrupt) { a.fail("Esa copia coincide con el manifiesto: está sana"); return false; }
            a.complete("verify", "Copia corrupta bloqueada"); setTimeout(close, 700); return true; } });
        }, { icon: "🖥️", wide: true }) },
        { id: "plan", x: 555, y: 45, w: 210, h: 130, label: "Plan 3-2-1", done: (a) => a.done("plan"), open: (a) => openWin("Diseña el plan de copias", (b, close) => {
          const LOCS = [
            { t: "Disco interno del servidor", m: "Disco", off: false },
            { t: "NAS del rack", m: "Disco", off: false },
            { t: "Cinta LTO en el armario ignífugo", m: "Cinta", off: false },
            { t: "Nube de un proveedor externo", m: "Nube", off: true },
            { t: "Disco USB en casa del gerente", m: "Disco", off: true },
          ];
          b.innerHTML = `<p>Elige <b>exactamente 3 ubicaciones</b> para las copias y decide cuáles van cifradas.</p><div class="plan">${LOCS.map((l, i) => `<div class="plan-row"><label class="check"><input type="checkbox" data-i="${i}"><span>${l.t}</span></label><span class="tag">${l.m}</span><span class="tag ${l.off ? "off" : ""}">${l.off ? "Fuera" : "Oficina"}</span><label class="lock"><input type="checkbox" data-lock="${i}"><span>🔒 Cifrada</span></label></div>`).join("")}</div><div class="plan-check"></div><button class="btn" type="button">Aprobar plan</button>`;
          $(".btn", b).onclick = () => {
            const sel = $$("[data-i]:checked", b).map((x) => +x.dataset.i);
            const locked = (i) => $(`[data-lock="${i}"]`, b).checked;
            const rules = [
              { ok: sel.length === 3, t: "3 copias" },
              { ok: new Set(sel.map((i) => LOCS[i].m)).size >= 2, t: "2 tipos de soporte distintos" },
              { ok: sel.some((i) => LOCS[i].off), t: "1 copia fuera de la oficina" },
              { ok: sel.filter((i) => LOCS[i].off).every(locked) && sel.length > 0, t: "Las copias que salen fuera van cifradas" },
            ];
            $(".plan-check", b).innerHTML = rules.map((r) => `<span class="rule ${r.ok ? "ok" : "ko"}">${r.ok ? "✓" : "✗"} ${r.t}</span>`).join("");
            if (rules.every((r) => r.ok)) { a.complete("plan", "Plan aprobado: la copia externa sale hacia su destino"); Snd.door(); setTimeout(close, 1400); }
            else a.fail("El plan no cumple todas las reglas");
          };
        }, { icon: "🗂️", wide: true }) },
      ],
    },
    /* ---------------- SALA 7 ---------------- */
    {
      id: "despacho", short: "Despacho", title: "El despacho del director", scene: "despacho", keyword: "SIMÉTRICO",
      intro: "Despacho del director. Su ordenador guarda un correo cifrado con AES que explica cómo abrir la caja fuerte. El director usa el mismo PIN para todo… ¿recuerdas el PIN del armario de servidores?",
      hints: [
        "El PIN es el de la sala 2 (sale de la nota en Base64 del inventario).",
        "CyberChef → AES Decrypt. Key e IV en UTF8 · Mode CBC · Input Hex · Output Raw. Luego gira el dial en el orden que diga el mensaje y pulsa «Fijar» en cada número.",
      ],
      lesson: "Has descifrado con <b>la misma clave</b> con la que se cifró: eso es <b>cifrado simétrico</b>. Es muy rápido, pero obliga a hacer llegar la clave al destinatario de forma segura. HTTPS lo resuelve usando asimétrico para intercambiar la clave y simétrico para los datos.",
      objectives: [
        { key: "pc", label: "Entra en el ordenador del director" },
        { key: "caja", label: "Abre la caja fuerte" },
      ],
      hotspots: [
        { id: "pc", x: 255, y: 145, w: 160, h: 120, label: "Ordenador", done: (a) => a.done("pc"), open: (a) => openWin("Ordenador del director", (b) => {
          const mail = () => {
            b.innerHTML = `<div class="mail"><div class="mail-head"><b>De:</b> seguridad@cited.example · <b>Asunto:</b> Caja fuerte</div><p>Te mando las instrucciones de la caja cifradas con <b>AES-128 CBC</b>, como siempre. La clave ya la sabes: <b>CITEDPIN</b> + el PIN del armario + el código del equipo.</p><div class="hashbox"><span>IV (texto)</span><code>${D.ivText}</code></div><div class="hashbox"><span>MENSAJE CIFRADO (HEX)</span><code class="wrap">${D.cipherHex}</code></div></div><ol class="howto"><li>Abre ${CHEF} → operación <b>AES Decrypt</b>. Es lo mismo que el reto de clase.</li><li><b>Key</b>: la clave en texto, tipo <b>UTF8</b>. Tiene 16 caracteres con este formato: <code>CITEDPIN0000${D.code}</code> (cambia 0000 por el PIN).</li><li><b>IV</b>: <code>${D.ivText}</code>, tipo <b>UTF8</b>.</li><li><b>Mode</b>: CBC · <b>Input</b>: Hex · <b>Output</b>: Raw.</li><li>Pega el mensaje cifrado en la caja <b>Input</b>.</li></ol>`;
          };
          if (a.done("pc")) return mail();
          b.innerHTML = `<div class="login"><div class="login-ava">👤</div><b>Dirección · CITED Data</b><p class="small">El director usa el mismo PIN que el armario de servidores.</p></div>`;
          keypad(b, { len: 4, label: "PIN", onSubmit: async (v) => { if (v === D.pin) { a.complete("pc", "Sesión iniciada"); setTimeout(mail, 700); return true; } a.fail("PIN incorrecto"); return false; } });
        }, { icon: "💻", wide: true }) },
        { id: "safe", x: 555, y: 100, w: 200, h: 200, label: "Caja fuerte", show: (a) => a.done("pc"), done: (a) => a.done("caja"), open: (a) => openWin("Caja fuerte", (b, close) => dial(b, async (seq) => {
          const ok = seq.length === 3 && seq.every((s, i) => s.n === D.dial[i] && s.dir === D.dialDirs[i]);
          if (ok) { a.complete("caja", "¡Caja fuerte abierta!"); Snd.door(); a.radio("Dentro está el disco con la copia de la «caja negra». Bájalo a la cámara acorazada."); setTimeout(close, 1000); return true; }
          a.fail("La caja no se abre: revisa números y sentido de giro"); return false;
        }), { icon: "🧰" }) },
      ],
    },
    /* ---------------- SALA 8 ---------------- */
    {
      id: "camara", short: "Cámara", title: "La cámara acorazada", scene: "camara", keyword: "RECUPERACIÓN",
      intro: "La cámara acorazada se abre con DOS llaves. Para sacar el disco del edificio hay que meterlo en un paquete cifrado con 7-Zip. Llave 1: el testigo del paquete. Llave 2: su tamaño, que solo se ve abriendo el paquete con la contraseña.",
      hints: [
        "7-Zip: clic derecho en la carpeta → 7-Zip → Añadir al archivo… → Formato 7z, AES-256, contraseña y «Cifrar nombres de archivo».",
        "Llave 2: abre vuestro .7z con 7-Zip, escribe la contraseña y mira la columna Tamaño del testigo.",
      ],
      lesson: "Sin la contraseña el paquete es ilegible, y con «cifrar nombres» ni siquiera se ve qué contiene. La <b>clave</b> es lo único que permite recuperar los datos: si se pierde, se pierde todo; si se filtra, se filtra todo.",
      objectives: [
        { key: "kit", label: "Prepara el paquete cifrado con 7-Zip" },
        { key: "k1", label: "Llave 1: el testigo" },
        { key: "k2", label: "Llave 2: el tamaño del testigo" },
      ],
      hotspots: [
        { id: "kit", x: 40, y: 190, w: 225, h: 90, label: "Kit de transporte", done: (a) => a.done("kit"), open: (a) => openWin("Kit de transporte seguro", (b) => {
          const fl = [
            { name: "clientes.txt", content: "LISTADO DE CLIENTES (FICTICIO)\r\nCliente 001 - Alfa Logistica\r\nCliente 002 - Beta Sistemas\r\nCliente 003 - Gamma Consulting\r\n" },
            { name: "facturas.txt", content: "FACTURAS PENDIENTES (FICTICIO)\r\nF-2025-001  1.250 EUR\r\nF-2025-002    830 EUR\r\nF-2025-003  4.100 EUR\r\n" },
            { name: "nominas.txt", content: "NOMINAS (FICTICIO)\r\nEmpleado A  1.600 EUR\r\nEmpleado B  1.750 EUR\r\nEmpleado C  2.100 EUR\r\n" },
            { name: `testigo_${D.code}.txt`, content: D.testigo },
          ];
          b.innerHTML = `<p>Guarda estos archivos en una carpeta <code>CONFIDENCIAL</code>:</p>`;
          files(b, fl);
          b.insertAdjacentHTML("beforeend", `<ol class="howto"><li>Clic derecho en la carpeta → <b>7-Zip → Añadir al archivo…</b></li><li>Formato <b>7z</b> · Método de cifrado <b>AES-256</b></li><li>Contraseña: la que elijáis (¡apuntadla, sin ella no hay vuelta atrás!)</li><li>Activa <b>Cifrar nombres de archivo</b></li><li>Haz doble clic en el <code>.7z</code> creado: ¿te deja ver algo sin la contraseña? Cancela y vuelve a abrirlo, esta vez con ella.</li></ol><label class="check big-check"><input type="checkbox" ${a.done("kit") ? "checked disabled" : ""}><span>Hemos creado el .7z cifrado con nombres cifrados</span></label>`);
          $(".big-check input", b).onchange = (e) => e.target.checked && a.complete("kit", "Paquete preparado");
        }, { icon: "🧳", wide: true }) },
        { id: "k1", x: 698, y: 120, w: 75, h: 78, label: "Llave 1", show: (a) => a.done("kit"), done: (a) => a.done("k1"), open: (a) => openWin("Llave 1 · el testigo", (b, close) => {
          b.innerHTML = `<p>Abre el paquete <b>con la contraseña</b> y lee el valor TESTIGO de <code>testigo_${D.code}.txt</code>.</p>`;
          answer(b, { label: "Testigo", placeholder: "6 caracteres", btn: "Girar llave", check: async (v) => { if (norm(v) === D.token) { a.complete("k1", "Llave 1 girada"); setTimeout(close, 600); return true; } a.fail("Ese no es el testigo"); return false; } });
        }, { icon: "🗝️" }) },
        { id: "k2", x: 698, y: 208, w: 75, h: 78, label: "Llave 2", show: (a) => a.done("k1"), done: (a) => a.done("k2"), open: (a) => openWin("Llave 2 · el paquete", (b, close) => {
          b.innerHTML = `<p>Abre vuestro <code>.7z</code> con 7-Zip (doble clic) y escribe la contraseña. En la lista aparece <code>testigo_${D.code}.txt</code> con su <b>Tamaño</b> en bytes.</p><p class="small muted">Si «Cifrar nombres» está activado, sin la contraseña ni siquiera se ve la lista.</p>`;
          answer(b, { label: "Tamaño del testigo (bytes)", placeholder: "p. ej. 120", btn: "Girar llave", check: async (v) => { if (+v.replace(/\D/g, "") === D.testigoSize) { a.complete("k2", "Llave 2 girada"); setTimeout(close, 600); return true; } a.fail("Ese no es el tamaño del testigo"); return false; } });
        }, { icon: "🗝️" }) },
      ],
    },
    /* ---------------- SALA 9 ---------------- */
    {
      id: "salida", short: "Salida", title: "El panel de salida", scene: "salida", keyword: "CONFIDENCIALIDAD",
      intro: "Última puerta. El panel de control solo libera la salida si clasificas cada medida que has usado según el principio de seguridad que protege. Lo que no protege nada, a la papelera.",
      hints: [
        "C = que nadie no autorizado lo lea · I = detectar cambios · D = que los datos sigan disponibles · A = demostrar quién lo hizo.",
        "Base64 y los archivos ocultos no protegen nada.",
      ],
      lesson: "<b>Confidencialidad</b> → cifrado · <b>Integridad</b> → hash · <b>Disponibilidad</b> → copias · <b>Autenticidad</b> → firma con clave privada.",
      objectives: [{ key: "sorted", label: "Clasifica las medidas en el panel" }, { key: "exit", label: "Sal del edificio" }],
      hotspots: [
        { id: "panel", x: 190, y: 85, w: 425, h: 230, label: "Panel de control", done: (a) => a.done("sorted"), open: (a) => openWin("Panel de control", (b, close) => {
          const cards = a.shuffle([
            { id: "bitlocker", t: "Unidad E: con BitLocker", bin: "C" },
            { id: "aes", t: "Correo cifrado con AES-256", bin: "C" },
            { id: "7z", t: "Paquete 7z con AES-256", bin: "C" },
            { id: "rsa", t: "Carta cifrada con la pública de Carlos", bin: "C" },
            { id: "hash", t: "Verificador SHA-256 de contratos", bin: "I" },
            { id: "sums", t: "Manifiesto SHA256SUMS", bin: "I" },
            { id: "321", t: "Plan de copias 3-2-1", bin: "D" },
            { id: "firma", t: "Firmar con la clave privada de Ana", bin: "A" },
            { id: "b64", t: "Nota en Base64", bin: "X" },
            { id: "hidden", t: "Archivos marcados como ocultos", bin: "X" },
          ]);
          if (a.done("sorted")) { b.innerHTML = `<p>Panel completado. La puerta de salida está abierta.</p>`; return; }
          sorter(b, {
            cards, btn: "Enviar al panel",
            bins: [{ id: "C", label: "Confidencialidad" }, { id: "I", label: "Integridad" }, { id: "D", label: "Disponibilidad" }, { id: "A", label: "Autenticidad" }, { id: "X", label: "🗑 No protege" }],
            onCheck: (place) => {
              if (Object.keys(place).length < cards.length) return toast("Coloca todas las tarjetas", "info");
              const bad = cards.filter((c) => place[c.id] !== c.bin).length;
              if (bad) return a.fail(`${bad} medida${bad > 1 ? "s" : ""} mal clasificada${bad > 1 ? "s" : ""}`);
              a.complete("sorted", "¡Panel desbloqueado! La salida está abierta"); Snd.door(); setTimeout(close, 900);
            },
          });
        }, { icon: "🎛️", wide: true }) },
        { id: "exit", x: 650, y: 75, w: 125, h: 260, label: "SALIDA", show: (a) => a.done("sorted"), open: (a) => a.complete("exit", "¡Fuera!") },
      ],
    },
  ];

  /* =============== OBJETOS DEL INVENTARIO =============== */
  const ITEMS = {
    nota: { name: "Nota sospechosa", icon: "📝", desc: "Encontrada en D:\\Personal. Su autor dice que está «cifrada».", files: () => [{ name: "nota_recuperada.txt", content: D.noteB64 }] },
    llavero: { name: "Llavero USB de Carlos", icon: "🔑", desc: "Tres claves RSA en formato PEM. Ábrelas con el Bloc de notas.", files: () => [{ name: "carlos_publica.pem", content: S.rsa.carlosPub }, { name: "carlos_privada.pem", content: S.rsa.carlosPriv }, { name: "ana_publica.pem", content: S.rsa.anaPub }] },
    carta: { name: "Carta cifrada de Ana", icon: "✉️", desc: "Cifrada con RSA-OAEP y codificada en Base64 para poder enviarla como texto.", files: () => [{ name: "carta_cifrada.txt", content: S.rsa.cipherB64 }], extra: () => `<div class="hashbox"><span>CONTENIDO</span><code class="wrap">${S.rsa.cipherB64}</code></div>` },
  };
  function openItem(id) {
    const it = ITEMS[id];
    openWin(it.name, (b) => { b.innerHTML = `<p>${it.desc}</p>${it.extra ? it.extra() : ""}`; files(b, it.files()); }, { icon: it.icon });
  }
  function renderInv() {
    const el = $("#inv"); if (!el || !S) return;
    el.hidden = false;
    $(".inv-items", el).innerHTML = S.inv.length ? S.inv.map((id) => `<button type="button" class="inv-item" data-item="${id}" title="${ITEMS[id].name}"><span>${ITEMS[id].icon}</span><em>${ITEMS[id].name}</em></button>`).join("") : `<span class="muted small">Vacío</span>`;
    $$(".inv-item", el).forEach((b) => (b.onclick = () => openItem(b.dataset.item)));
  }

  /* =============== MECÁNICAS ESPECIALES =============== */
  // Sala 1: explorador de archivos del SSD
  function openExplorer(a) {
    const fsD = {
      Clientes: [{ name: "clientes_2025.txt", content: "CLIENTES ACTIVOS (DATOS FICTICIOS)\r\nAlfa Logistica S.L.  - contrato 48.000 EUR\r\nBeta Sistemas S.A.   - contrato 12.500 EUR\r\nGamma Consulting     - contrato 30.200 EUR\r\n" }],
      Facturas: [{ name: "facturas_T3.txt", content: "FACTURAS T3 (FICTICIO)\r\nF-0931  Alfa Logistica   4.100 EUR  PAGADA\r\nF-0932  Beta Sistemas      830 EUR  PENDIENTE\r\nF-0933  Gamma Consulting 1.250 EUR  PENDIENTE\r\n" }],
      RRHH: [{ name: "empleados.csv", content: D.employeesCsv, table: true }, { name: "nominas_octubre.txt", content: "NOMINAS OCTUBRE (FICTICIO)\r\nTotal plantilla: 14 personas\r\nImporte total: 31.940 EUR\r\nTransferencia programada el dia 28\r\n" }],
      Personal: [{ name: "postit.txt", content: "Recordatorio para mi:\r\nel codigo de la puerta de la oficina es el numero de TARJETA\r\ndel empleado de Logistica con MAS antiguedad.\r\n(Ya se que no deberia apuntarlo aqui...)\r\n" }, { name: "nota_recuperada.txt", content: D.noteB64, nota: true }],
    };
    openWin("Explorador · equipo del atacante", (b) => {
      b.innerHTML = `<div class="explorer"><aside class="ex-side"><button type="button" data-drive="D">💾 SSD_EMPLEADO (D:)</button><button type="button" data-drive="E">🔒 BACKUP_FIN (E:)</button></aside><div class="ex-main"><div class="ex-path">Este equipo</div><div class="ex-view"><p class="muted">Selecciona una unidad del SSD conectado.</p></div></div></div>`;
      const view = $(".ex-view", b), path = $(".ex-path", b);
      const seen = new Set(a.get("seen") || []);
      const mark = (k) => { seen.add(k); a.set("seen", [...seen]); if (seen.has("D") && seen.has("E")) a.complete("drives", "Has revisado las dos unidades"); };
      function folder(name) {
        path.textContent = `D:\\${name}`;
        view.innerHTML = `<button type="button" class="ex-up">⬑ Volver</button>` + fsD[name].map((f, i) => `<button type="button" class="ex-item" data-f="${i}"><span class="ex-ico">${f.table ? "📊" : "📄"}</span>${f.name}</button>`).join("");
        $(".ex-up", view).onclick = driveD;
        $$("[data-f]", view).forEach((x) => (x.onclick = () => openFile(name, fsD[name][+x.dataset.f])));
      }
      function openFile(dir, f) {
        Snd.click();
        path.textContent = `D:\\${dir}\\${f.name}`;
        let content;
        if (f.table) {
          const rows = f.content.trim().split(/\r\n/).map((r) => r.split(";"));
          content = `<table class="ex-table"><thead><tr>${rows[0].map((h, i) => `<th data-c="${i}">${h} ⇅</th>`).join("")}</tr></thead><tbody>${rows.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
        } else content = `<pre class="paper mono-paper">${esc(f.content)}</pre>`;
        view.innerHTML = `<button type="button" class="ex-up">⬑ Volver</button>${content}`;
        $(".ex-up", view).onclick = () => folder(dir);
        files(view, [f]);
        if (f.table) {
          let dirSort = 1;
          $$("th", view).forEach((th) => (th.onclick = () => {
            const i = +th.dataset.c, tb = $("tbody", view);
            const key = (tr) => { const t = tr.children[i].textContent; const m = t.match(/^(\d{2})\/(\d{4})$/); return m ? +m[2] * 100 + +m[1] : t; };
            const trs = $$("tr", tb).sort((x, y) => (key(x) > key(y) ? 1 : key(x) < key(y) ? -1 : 0) * dirSort);
            dirSort *= -1; trs.forEach((tr) => tb.appendChild(tr));
          }));
        }
        if (f.nota) { a.give("nota"); a.complete("nota", "Archivo sospechoso guardado en el inventario"); a.radio("Esa nota parece texto sin sentido… su autor presume de haberla «cifrado». Guárdala: te hará falta en la sala de servidores."); }
      }
      function driveD() {
        mark("D");
        path.textContent = "D:\\  (sin cifrar)";
        view.innerHTML = Object.keys(fsD).map((n) => `<button type="button" class="ex-item" data-dir="${n}"><span class="ex-ico">📁</span>${n}</button>`).join("");
        $$("[data-dir]", view).forEach((x) => (x.onclick = () => { Snd.click(); folder(x.dataset.dir); }));
      }
      function driveE() {
        mark("E");
        path.textContent = "E:\\";
        view.innerHTML = `<div class="bitlocker"><div class="bl-ico">🔒</div><h3>Esta unidad está protegida por BitLocker</h3><p>Escribe la clave de recuperación de 48 dígitos para desbloquear la unidad.</p><input class="mono" placeholder="______-______-______-______-______-______-______-______" disabled><p class="small muted">El atacante no tiene la clave. Sin ella, el contenido es ruido aleatorio.</p></div>`;
        a.radio("¿Ves la diferencia? E: está cifrada con BitLocker y es ilegible. D: no estaba cifrada: el atacante lo lee todo, aunque el portátil tuviera contraseña de Windows.");
      }
      $("[data-drive=D]", b).onclick = () => { Snd.click(); driveD(); };
      $("[data-drive=E]", b).onclick = () => { Snd.bad(); driveE(); };
    }, { icon: "🗂️", wide: true });
  }

  // Sala 3: candado de ruedas
  function wheels(body, n, onTry) {
    const vals = Array(n).fill(0);
    const w = document.createElement("div"); w.className = "wheels";
    w.innerHTML = vals.map((_, i) => `<div class="wheel-col"><button type="button" data-i="${i}" data-d="1" aria-label="Subir rueda ${i + 1}">▲</button><div class="wheel-num" data-n="${i}"><span class="prev">9</span><b>0</b><span class="next">1</span></div><button type="button" data-i="${i}" data-d="-1" aria-label="Bajar rueda ${i + 1}">▼</button></div>`).join("") + `<button type="button" class="btn big wheel-go">ABRIR</button>`;
    body.appendChild(w);
    const draw = () => vals.forEach((v, i) => { const el = $(`[data-n="${i}"]`, w); el.innerHTML = `<span class="prev">${(v + 9) % 10}</span><b>${v}</b><span class="next">${(v + 1) % 10}</span>`; });
    $$("[data-d]", w).forEach((b) => (b.onclick = () => { const i = +b.dataset.i; vals[i] = (vals[i] + +b.dataset.d + 10) % 10; Snd.click(); const el = $(`[data-n="${i}"]`, w); el.classList.remove("spin"); void el.offsetWidth; el.classList.add("spin"); draw(); }));
    $(".wheel-go", w).onclick = async () => { if (!(await onTry(vals.slice()))) { w.classList.add("err"); setTimeout(() => w.classList.remove("err"), 600); } else w.classList.add("solved"); };
  }

  // Sala 4: verificador
  function openScanner(a) {
    openWin("Verificador SHA-256", (b) => {
      const scanned = () => a.get("scanned") || [];
      b.innerHTML = `<div class="hashbox"><span>HUELLA DEL ORIGINAL FIRMADO</span><code>${D.contractOrigHash.toUpperCase()}</code></div>${cmd("Get-FileHash .\\contrato_*.txt -Algorithm SHA256 | Format-List Path, Hash")}<p class="q">1 · Coloca un contrato en la bandeja</p><div class="tray-docs">${D.contracts.map((c, i) => `<button type="button" class="doc-thumb" data-d="${i}"><span>📄</span>contrato_${i + 1}<em></em></button>`).join("")}</div><p class="q">2 · Declara su huella y escanea</p><div class="scan-screen"><div class="scan-line"></div><div class="scan-out">Bandeja vacía</div></div>`;
      let sel = null;
      const drawDocs = () => $$(".doc-thumb", b).forEach((d) => {
        const i = +d.dataset.d; d.classList.toggle("selected", sel === i);
        const st = scanned().includes(i) ? (i === D.authentic ? "AUTÉNTICO" : "EVIDENCIA") : "";
        d.classList.toggle("is-auth", st === "AUTÉNTICO"); d.classList.toggle("is-evid", st === "EVIDENCIA"); $("em", d).textContent = st;
      });
      $$(".doc-thumb", b).forEach((d) => (d.onclick = () => { sel = +d.dataset.d; Snd.click(); $(".scan-out", b).textContent = `En bandeja: contrato_${sel + 1}.txt`; drawDocs(); }));
      drawDocs();
      answer(b, { label: "8 primeros caracteres del hash del contrato en bandeja", placeholder: "8 caracteres", btn: "ESCANEAR", check: async (v) => {
        if (sel === null) { toast("Pon primero un contrato en la bandeja", "info"); return false; }
        const c = D.contracts[sel];
        if (hexIn(v).slice(0, 8) !== c.hash.slice(0, 8) || hexIn(v).length < 8) { a.fail("La huella declarada no es la de ese contrato"); return false; }
        const scr = $(".scan-screen", b); scr.classList.add("scanning"); $(".scan-out", b).textContent = "Escaneando…";
        await sleep(1300); scr.classList.remove("scanning");
        const orig = D.contractOrigHash;
        const cmp = [...c.hash.slice(0, 32)].map((ch, k) => `<i class="${ch === orig[k] ? "m" : "x"}">${ch}</i>`).join("");
        const list = scanned(); if (!list.includes(sel)) { list.push(sel); a.set("scanned", list); }
        if (sel === D.authentic) { scr.classList.add("match"); $(".scan-out", b).innerHTML = `<b>✓ COINCIDE CON EL ORIGINAL</b><div class="cmp">${cmp}…</div>`; a.complete("auth", `contrato_${sel + 1} es el auténtico`); }
        else { scr.classList.add("nomatch"); Snd.bad(); $(".scan-out", b).innerHTML = `<b>✗ MANIPULADO · registrado como evidencia</b><div class="cmp">${cmp}…</div>`; toast("Evidencia registrada", "info"); }
        setTimeout(() => scr.classList.remove("match", "nomatch"), 1800);
        if (list.filter((i) => i !== D.authentic).length >= 3) a.complete("evid", "Las 3 manipulaciones están documentadas");
        drawDocs(); $("input", b).value = "";
        return true;
      } });
    }, { icon: "🔬", wide: true });
  }

  // Sala 5: comparación visual de hashes
  async function diffViz(el, h1, h2) {
    let same = 0;
    el.innerHTML = `<div class="diff"><div class="diff-row"><span>1000</span><div class="d1"></div></div><div class="diff-row"><span>9000</span><div class="d2"></div></div><p class="diff-count"></p></div>`;
    const d1 = $(".d1", el), d2 = $(".d2", el);
    for (let i = 0; i < 64; i++) {
      const m = h1[i] === h2[i]; if (m) same++;
      d1.insertAdjacentHTML("beforeend", `<i class="${m ? "m" : ""}">${h1[i]}</i>`);
      d2.insertAdjacentHTML("beforeend", `<i class="${m ? "m" : "x"}">${h2[i]}</i>`);
      if (i % 4 === 0) { Snd.tone(400 + i * 12, 0.03, "square", 0.02); await sleep(25); }
    }
    $(".diff-count", el).innerHTML = `Solo coinciden <b>${same} de 64</b> posiciones (por puro azar se esperan unas 4). <b>Un carácter cambiado → hash completamente distinto.</b>`;
  }

  // Sala 7: dial de caja fuerte
  function dial(body, onTry) {
    let v = 0, last = null, seq = [], timer = null;
    const w = document.createElement("div"); w.className = "dial-wrap";
    const ticks = Array.from({ length: 40 }, (_, i) => { const ang = (i * 9 - 90) * Math.PI / 180, r1 = i % 5 ? 92 : 84; return `<path d="M${120 + r1 * Math.cos(ang)} ${120 + r1 * Math.sin(ang)}L${120 + 100 * Math.cos(ang)} ${120 + 100 * Math.sin(ang)}" stroke="${N}" stroke-width="${i % 5 ? 2 : 4}"/>${i % 5 ? "" : `<text x="${120 + 70 * Math.cos(ang)}" y="${125 + 70 * Math.sin(ang)}" text-anchor="middle" font-family="JetBrains Mono" font-size="13" font-weight="700" fill="${N}">${i}</text>`}`; }).join("");
    w.innerHTML = `<div class="dial-box"><svg viewBox="0 0 240 240" class="dial-svg"><path d="M120 2l9 14h-18z" fill="${R}"/><g class="dial-rot"><circle cx="120" cy="120" r="104" fill="${LL}" stroke="${N}" stroke-width="5"/>${ticks}<circle cx="120" cy="120" r="26" fill="${L}" stroke="${N}" stroke-width="5"/></g></svg><div class="dial-num">00</div></div>
      <div class="dial-ctrl"><button type="button" class="btn ghost" data-dir="I">⟲ Izquierda</button><button type="button" class="btn ghost" data-dir="D">Derecha ⟳</button></div>
      <div class="dial-ctrl"><button type="button" class="btn" data-fix>Fijar número</button><button type="button" class="btn ghost" data-reset>Reiniciar</button></div><div class="dial-log"></div>`;
    body.appendChild(w);
    const draw = () => { $(".dial-rot", w).style.transform = `rotate(${-v * 9}deg)`; $(".dial-num", w).textContent = String(v).padStart(2, "0"); $(".dial-log", w).innerHTML = [0, 1, 2].map((i) => `<span class="${seq[i] ? "on" : ""}">${seq[i] ? `${seq[i].dir === "D" ? "Der." : "Izq."} ${seq[i].n}` : "—"}</span>`).join(""); };
    const step = (dir) => { last = dir; v = (v + (dir === "D" ? 1 : -1) + 40) % 40; Snd.click(); draw(); };
    $$("[data-dir]", w).forEach((b) => {
      const start = (e) => { e.preventDefault(); step(b.dataset.dir); clearInterval(timer); let t = 0; timer = setInterval(() => { if (++t > 3) step(b.dataset.dir); }, 90); };
      const stop = () => clearInterval(timer);
      b.addEventListener("pointerdown", start); ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => b.addEventListener(ev, stop));
      b.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); step(b.dataset.dir); } });
    });
    $("[data-fix]", w).onclick = async () => {
      if (!last) return toast("Gira el dial primero", "info");
      seq.push({ dir: last, n: v }); last = null; Snd.tone(900, 0.08, "triangle", 0.1); draw();
      if (seq.length === 3) { const ok = await onTry(seq); if (!ok) { w.classList.add("err"); setTimeout(() => w.classList.remove("err"), 600); seq = []; draw(); } else w.classList.add("solved"); }
    };
    $("[data-reset]", w).onclick = () => { seq = []; last = null; draw(); };
    draw();
  }

  /* =============== ESTADO =============== */
  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch (e) { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) {} }
  function clear() { try { localStorage.removeItem(STORE); } catch (e) {} }
  function newState(team) {
    return { v: 2, groupCode: CN.generateGroupCode(), team, current: 0, score: C.START_SCORE, hintsUsed: 0, hintsByRoom: {}, errorsByRoom: {}, totalErrors: 0, completed: [], keywords: [], parts: {}, inv: [], rsa: null, startTime: Date.now(), endTime: null, finished: false, muted: false };
  }

  /* =============== HUD =============== */
  const topbar = document.getElementById("topbar");
  function addScore(delta) {
    S.score += delta;
    const el = $("#hudScore"); el.textContent = S.score;
    el.parentElement.classList.remove("bump-up", "bump-down"); void el.offsetWidth;
    el.parentElement.classList.add(delta >= 0 ? "bump-up" : "bump-down");
  }
  function updateHUD() {
    topbar.hidden = false;
    $("#hudGroup").textContent = S.groupCode;
    $("#hudTeam").textContent = S.team;
    $("#hudScore").textContent = S.score;
    $("#muteBtn").textContent = S.muted ? "🔇" : "🔊";
    const done = S.completed.length, total = ROOMS.length, cur = Math.min(S.current, total - 1);
    $("#hudStage").textContent = S.finished ? "MISIÓN COMPLETADA" : `SALA ${cur + 1} DE ${total}`;
    $("#hudPct").textContent = Math.round((done / total) * 100) + "%";
    $("#progressFill").style.width = (done / total) * 100 + "%";
    $("#stageMap").innerHTML = ROOMS.map((r, i) => `<li class="${S.completed.includes(i) ? "done" : i === cur && !S.finished ? "current" : ""}" title="${r.title}"><span>${S.completed.includes(i) ? "✓" : i + 1}</span><em>${r.short}</em></li>`).join("");
  }
  $("#muteBtn").onclick = () => { if (!S) return; S.muted = !S.muted; save(); updateHUD(); };
  $("#saveBtn").onclick = () => saveToFile();

  /* ---------- Guardar / cargar partida (para continuar otro día u otro PC) ---------- */
  async function saveToFile() {
    if (!S) return;
    download(`partida_${S.groupCode}.cajanegra`, await CN.makeSave(S));
    toast("Partida guardada en Descargas. Guárdala en tu USB o en la nube.", "info");
  }
  function loadButton() {
    return `<label class="btn ghost load-btn"><input type="file" accept=".cajanegra,.txt,application/json" hidden>📂 Cargar partida guardada</label>`;
  }
  function bindLoad(root) {
    const inp = $(".load-btn input", root); if (!inp) return;
    inp.onchange = async () => {
      const f = inp.files[0]; if (!f) return;
      const r = await CN.readSave(await f.text());
      inp.value = "";
      if (!r) return modal({ title: "Archivo no válido", body: "<p>Ese archivo no es una partida de Operación Caja Negra.</p>" });
      if (r.tampered) return modal({ title: "Partida manipulada", body: "<p>El archivo ha sido modificado y no se puede cargar.</p>" });
      S = r.state; save(); toast(`Partida de ${S.team} cargada`, "ok"); boot();
    };
  }

  /* =============== MOTOR DE SALAS =============== */
  let radioTimer = null;
  function radio(text) {
    const el = $("#radioText"); if (!el) return;
    clearInterval(radioTimer); el.textContent = ""; let i = 0;
    $(".radio", app).classList.add("live"); Snd.radio();
    radioTimer = setInterval(() => { el.textContent = text.slice(0, ++i); if (i >= text.length) { clearInterval(radioTimer); $(".radio", app)?.classList.remove("live"); } }, 18);
  }
  function makeApi(room, idx) {
    const parts = (S.parts[room.id] = S.parts[room.id] || {});
    const api = {
      get: (k) => parts[k], set: (k, v) => { parts[k] = v; save(); },
      done: (k) => !!parts["obj:" + k],
      complete: (k, msg) => {
        if (parts["obj:" + k]) return;
        parts["obj:" + k] = true; save(); Snd.ok(); toast(msg || "Objetivo completado", "ok");
        refreshRoom();
        if (room.objectives.every((o) => parts["obj:" + o.key])) completeRoom(room, idx);
      },
      fail: (msg) => {
        S.errorsByRoom[room.id] = (S.errorsByRoom[room.id] || 0) + 1; S.totalErrors++;
        addScore(-C.PENALTY_WRONG); save(); Snd.bad(); toast(`${msg} · −${C.PENALTY_WRONG}`, "bad");
        document.body.classList.remove("alarm"); void document.body.offsetWidth; document.body.classList.add("alarm");
      },
      give: (id) => { if (S.inv.includes(id)) return; S.inv.push(id); save(); renderInv(); Snd.item(); toast(`Nuevo objeto: ${ITEMS[id].name}`, "item"); const b = $(`[data-item="${id}"]`); b && b.classList.add("new"); },
      radio,
      shuffle: (arr) => CN.rng(S.groupCode + "|" + room.id).shuffle(arr),
    };
    return api;
  }
  function renderRoom(idx) {
    const room = ROOMS[idx];
    S.current = idx; save();
    CUR = { room, idx, api: makeApi(room, idx), parts: S.parts[room.id] };
    updateHUD(); renderInv();
    app.innerHTML = `<section class="room enter">
      <div class="room-head"><span class="eyebrow">SALA ${idx + 1} DE ${ROOMS.length}</span><h2>${room.title}</h2></div>
      <div class="room-grid">
        <div class="scene card"><div class="scene-inner">${SCENES[room.scene]()}<div class="hs-layer"></div></div><p class="scene-tip">Haz clic en los objetos marcados para investigar. ¿Te falta teoría? <a href="apuntes.html" target="_blank" rel="noopener">📘 Apuntes</a></p></div>
        <aside class="side">
          <div class="card radio"><div class="radio-head"><span class="radio-led"></span>RADIO · JEFA DE SEGURIDAD</div><p id="radioText"></p></div>
          <div class="card objectives"><h3>Objetivos</h3><ul></ul></div>
          <div class="hint-zone"><button class="btn ghost hint-btn" type="button">💡 Pista <small>−${C.PENALTY_HINT}</small></button><div class="hints"></div></div>
        </aside>
      </div>
    </section>`;
    $(".hint-btn", app).onclick = () => askHint(room);
    refreshRoom(); renderHints(room);
    radio(room.intro);
    window.scrollTo({ top: 0 });
    if (S.completed.includes(idx)) showRoomDone(room, idx, false);
  }
  function refreshRoom() {
    if (!CUR) return;
    const { room, api } = CUR;
    const layer = $(".hs-layer", app); if (!layer) return;
    layer.innerHTML = room.hotspots.filter((h) => !h.show || h.show(api)).map((h) => `<button type="button" class="hs ${h.done && h.done(api) ? "done" : ""}" data-hs="${h.id}" style="left:${(h.x / 800) * 100}%;top:${(h.y / 420) * 100}%;width:${(h.w / 800) * 100}%;height:${(h.h / 420) * 100}%" aria-label="${h.label}"><span class="hs-label">${h.done && h.done(api) ? "✓ " : ""}${h.label}</span></button>`).join("");
    $$(".hs", layer).forEach((b) => (b.onclick = () => { const h = room.hotspots.find((x) => x.id === b.dataset.hs); h.open(api); }));
    $$("[data-when]", app).forEach((g) => (g.style.display = api.done(g.dataset.when) ? "" : "none"));
    $$("[data-unless]", app).forEach((g) => (g.style.display = api.done(g.dataset.unless) ? "none" : ""));
    $$("[data-anim]", app).forEach((g) => g.classList.toggle("run", api.done(g.dataset.anim)));
    $(".objectives ul", app).innerHTML = room.objectives.map((o) => `<li class="${api.done(o.key) ? "ok" : ""}"><span class="obj-box">${api.done(o.key) ? "✓" : ""}</span>${o.label}</li>`).join("");
  }
  function renderHints(room) {
    const n = S.hintsByRoom[room.id] || 0;
    $(".hints", app).innerHTML = room.hints.slice(0, n).map((h, i) => `<div class="hint"><b>Pista ${i + 1}</b> ${h}</div>`).join("");
    const btn = $(".hint-btn", app);
    if (n >= room.hints.length) { btn.disabled = true; btn.textContent = "Sin más pistas"; }
  }
  async function askHint(room) {
    const n = S.hintsByRoom[room.id] || 0;
    if (n >= room.hints.length) return;
    if (!(await modal({ title: "¿Pedir una pista por radio?", body: `<p>Cuesta <b>${C.PENALTY_HINT} puntos</b>. Orienta, no da la solución.</p><p class="small muted">Quedan ${room.hints.length - n} en esta sala.</p>`, ok: "Pedir pista", cancel: "Mejor no" }))) return;
    S.hintsByRoom[room.id] = n + 1; S.hintsUsed++; addScore(-C.PENALTY_HINT); save(); renderHints(room);
  }
  function completeRoom(room, idx) {
    if (S.completed.includes(idx)) return;
    S.completed.push(idx); S.keywords.push(room.keyword);
    let bonus = false;
    if (!S.errorsByRoom[room.id]) { addScore(C.BONUS_CLEAN); bonus = true; }
    save(); updateHUD();
    setTimeout(() => showRoomDone(room, idx, true, bonus), 1100);
  }
  function showRoomDone(room, idx, animate, bonus = false) {
    if (WIN) WIN.close(true);
    const last = idx === ROOMS.length - 1;
    const ov = document.createElement("div");
    ov.className = "done-ov";
    ov.innerHTML = `<div class="done-card card ${animate ? "pop" : ""}"><div class="done-badge">✓ SALA ${idx + 1} SUPERADA</div><h2>${room.title}</h2><p>${room.lesson}</p>${bonus ? `<p class="bonus">+${C.BONUS_CLEAN} puntos · sala sin errores</p>` : ""}<div class="keyword"><span>PALABRA RECUPERADA</span><strong>${room.keyword}</strong></div><button class="btn big" type="button">${last ? "SALIR DEL EDIFICIO 🔓" : "SIGUIENTE SALA →"}</button></div>`;
    document.body.appendChild(ov);
    if (animate) confetti(30);
    $("button", ov).focus();
    $("button", ov).onclick = () => { ov.remove(); last ? finishGame() : transition(() => renderRoom(idx + 1)); };
  }
  function transition(fn) {
    const t = document.createElement("div"); t.className = "wipe"; document.body.appendChild(t);
    Snd.door(); setTimeout(fn, 450); setTimeout(() => t.remove(), 1000);
  }

  /* =============== PANTALLAS =============== */
  function renderIntro() {
    topbar.hidden = true; $("#inv").hidden = true;
    app.innerHTML = `<section class="intro">
      <div class="intro-card card">
        <span class="eyebrow">SEGURIDAD INFORMÁTICA · UD2 · ESCAPE ROOM</span>
        <h1>OPERACIÓN<br><span class="hl">CAJA NEGRA</span></h1>
        <p class="lead">La empresa <b>CITED Data</b> ha sufrido un incidente. Un SSD con información confidencial ha acabado en manos de un atacante y varios archivos han sido manipulados. Vuestro equipo está <b>encerrado en el edificio</b> hasta que lo arregle todo.</p>
        <div class="rooms-preview">${ROOMS.map((r, i) => `<div><span>${i + 1}</span>${r.short}</div>`).join("")}</div>
        <div class="mission">
          <div><b>Cada sala es distinta</b><ul><li>investiga los objetos</li><li>usa herramientas reales</li><li>recoge objetos para salas posteriores</li><li>escucha la radio</li></ul></div>
          <div><b>Necesitaréis</b><ul><li>PowerShell</li><li>CyberChef (navegador)</li><li>7-Zip</li><li>un USB o la nube para guardar la partida</li></ul></div>
        </div>
        <div class="rules"><span>🏆 Gana el equipo con más puntos</span><span>🎯 ${C.START_SCORE} puntos</span><span>✗ Error −${C.PENALTY_WRONG}</span><span>💡 Pista −${C.PENALTY_HINT}</span><span>★ Sala limpia +${C.BONUS_CLEAN}</span></div>
        <p class="small muted">Cada equipo recibe datos distintos. Copiar a otro equipo o preguntarle a una IA no sirve: hay que calcularlo de verdad. Activad el sonido 🔊. Al acabar la clase pulsad 💾 para guardar la partida en un archivo. Tenéis los <a href="apuntes.html" target="_blank" rel="noopener">📘 apuntes</a> siempre a mano (botón 📘 arriba).</p>
        <form class="start" id="startForm"><label><span>Nombre del equipo</span><input id="teamName" maxlength="30" required autocomplete="off" placeholder="p. ej. Los Hashers"></label><button class="btn big" type="submit">ENTRAR EN EL EDIFICIO</button></form>
        <div class="load-row">¿Venís de otra clase? ${loadButton()}</div>
      </div></section>`;
    bindLoad(app);
    $("#startForm").onsubmit = async (e) => {
      e.preventDefault();
      const team = $("#teamName").value.trim(); if (!team) return $("#teamName").focus();
      S = newState(team); save();
      await boot();
      await modal({ title: `Código de equipo: ${S.groupCode}`, body: `<p>Aparece siempre arriba. Vuestros archivos y soluciones dependen de él.</p><p class="small muted">Al final de cada clase, pulsad 💾 (arriba) para descargar la partida y continuar otro día, aunque sea en otro ordenador.</p>`, ok: "¡Adelante!" });
    };
  }
  function renderResume(saved) {
    topbar.hidden = true; $("#inv").hidden = true;
    const room = ROOMS[Math.min(saved.current, ROOMS.length - 1)];
    app.innerHTML = `<section class="intro"><div class="intro-card card narrow">
      <h2>¿QUIERES CONTINUAR LA MISIÓN?</h2>
      <div class="resume-grid"><div><span>EQUIPO</span><b>${esc(saved.team)}</b></div><div><span>CÓDIGO</span><b>${saved.groupCode}</b></div><div><span>PUNTOS</span><b>${saved.score}</b></div><div><span>${saved.finished ? "ESTADO" : "SALA"}</span><b>${saved.finished ? "Completada" : room.title}</b></div></div>
      <div class="row-actions"><button class="btn big" id="cont">CONTINUAR</button><button class="btn ghost big" id="reset">REINICIAR</button></div><div class="load-row">${loadButton()}</div></div></section>`;
    bindLoad(app);
    $("#cont").onclick = () => { S = saved; boot(); };
    $("#reset").onclick = async () => {
      if (await modal({ title: "¿Reiniciar la misión?", body: "<p>Se pierde todo el progreso, se genera un <b>código nuevo</b> (datos nuevos) y la puntuación vuelve a 1000.</p>", ok: "Sí, reiniciar", cancel: "Cancelar" })) { clear(); S = null; renderIntro(); }
    };
  }
  async function boot() {
    app.innerHTML = `<div class="loading"><div class="spinner"></div>Generando claves y evidencias de vuestro equipo…</div>`;
    D = await CN.deriveGroup(S.groupCode);
    if (!S.rsa) { S.rsa = await CN.makeRSA(D.letter); save(); }
    updateHUD();
    if (S.finished) return renderFinal();
    renderRoom(Math.min(S.current, ROOMS.length - 1));
  }
  function finishGame() {
    if (!S.finished) { S.finished = true; S.endTime = Date.now(); save(); }
    transition(renderFinal);
  }
  async function renderFinal() {
    CUR = null; updateHUD(); $("#inv").hidden = true;
    const elapsed = Math.round((S.endTime - S.startTime) / 1000);
    const code = await CN.makeFinishCode({ group: S.groupCode, team: S.team, elapsed, score: S.score, hints: S.hintsUsed, errors: S.totalErrors, end: S.endTime });
    app.innerHTML = `<section class="final">
      <div class="vault" aria-hidden="true"><div class="vault-body"><div class="vault-inside">${S.keywords.map((k) => `<span>${k}</span>`).join("")}</div><div class="vault-door"><div class="dial"></div></div></div></div>
      <div class="card final-card">
        <span class="eyebrow">MISIÓN COMPLETADA</span>
        <h1>SISTEMA <span class="hl">RECUPERADO</span></h1>
        <div class="stats"><div><span>SALAS</span><b>${S.completed.length}/${ROOMS.length}</b></div><div><span>PUNTOS</span><b>${S.score}</b></div><div><span>PISTAS</span><b>${S.hintsUsed}</b></div><div><span>ERRORES</span><b>${S.totalErrors}</b></div></div>
        <div class="achieved"><b>Habéis conseguido:</b><ul><li>demostrar que una contraseña de Windows no cifra un disco</li><li>leer una nota «cifrada» que solo estaba codificada</li><li>descifrar con RSA eligiendo la clave privada correcta</li><li>detectar manipulaciones invisibles con SHA-256</li><li>sellar una transferencia probando cientos de hashes</li><li>verificar copias y diseñar un plan 3-2-1</li><li>descifrar AES y abrir una caja fuerte</li><li>proteger datos con 7-Zip y AES-256</li></ul></div>
        <div class="kw-list">${S.keywords.map((k) => `<span>${k}</span>`).join("")}</div>
        <div class="summary"><div><b>Confidencialidad</b> → cifrado</div><div><b>Integridad</b> → hash</div><div><b>Disponibilidad</b> → copias</div><div><b>Autenticidad</b> → firma</div></div>
        <div class="finish-code"><span>CÓDIGO DE FINALIZACIÓN · entrégalo al profesor para el ranking</span>${cmd(code, "Equipo " + esc(S.team) + " · " + S.groupCode)}</div>
        <button class="btn big" id="finBtn" type="button">FINALIZAR MISIÓN</button>
      </div></section>`;
    confetti(80); Snd.door();
    $("#finBtn").onclick = () => { confetti(80); modal({ title: "¡Habéis escapado!", body: `<p>Puntuación final: <b>${S.score} puntos</b>.</p><p>Copiad el código de finalización y entregádselo al profesor.</p>`, ok: "Hecho" }); };
  }
  function confetti(n) {
    const wrap = document.createElement("div"); wrap.className = "confetti";
    for (let i = 0; i < n; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw"; p.style.background = [L, N, LL, W][i % 4];
      p.style.animationDelay = Math.random() * 0.8 + "s"; p.style.animationDuration = 2 + Math.random() * 1.5 + "s";
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap); setTimeout(() => wrap.remove(), 4500);
  }

  /* =============== ARRANQUE =============== */
  if (!window.crypto || !crypto.subtle) { app.innerHTML = `<div class="card intro-card narrow"><h2>Navegador no compatible</h2><p>Abre la web desde https:// (GitHub Pages) o desde localhost.</p></div>`; return; }
  const saved = load();
  if (saved && saved.groupCode) renderResume(saved); else renderIntro();
})();
