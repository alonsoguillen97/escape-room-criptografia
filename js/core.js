/* =========================================================
   OPERACIÓN CAJA NEGRA — núcleo compartido (alumno + profesor)
   Sin backend: todo se deriva del código de grupo de forma
   determinista, así cada grupo tiene datos (y respuestas) distintos.
   ========================================================= */
(function (global) {
  "use strict";

  const CONFIG = {
    SECRET: "CAJA-NEGRA|2SMR|UD2|v2", // cámbialo cada curso
    TEACHER_PIN: "2SMR",              // PIN del panel del profesor
    PENALTY_WRONG: 25,
    PENALTY_HINT: 50,
    BONUS_CLEAN: 50,
    START_SCORE: 1000,
    MINING_PREFIX: "000",             // sala 5: el hash debe empezar así
  };

  const enc = new TextEncoder();
  const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
  const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((x) => parseInt(x, 16)));
  const toB64 = (buf) => { let s = ""; new Uint8Array(buf).forEach((b) => (s += String.fromCharCode(b))); return btoa(s); };

  async function sha256Bytes(bytes) { return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)); }
  async function sha256(text) { return toHex(await sha256Bytes(enc.encode(text))); }

  /* ---------- PRNG determinista ---------- */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
    return function () { h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function rng(seed) {
    const r = mulberry32(xmur3(seed)());
    return {
      next: r,
      int: (a, b) => a + Math.floor(r() * (b - a + 1)),
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      shuffle: (arr) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
    };
  }

  const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  function generateGroupCode() {
    const b = crypto.getRandomValues(new Uint8Array(4));
    return Array.from(b, (x) => ALPH[x % ALPH.length]).join("");
  }

  async function token(code) {
    return (await sha256(CONFIG.SECRET + "#TESTIGO#" + code)).slice(0, 6).toUpperCase();
  }

  /* ---------- Variantes de archivo (Bloc de notas / PowerShell) ---------- */
  function utf16le(str) {
    const out = new Uint8Array(2 + str.length * 2);
    out[0] = 0xff; out[1] = 0xfe;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); out[2 + i * 2] = c & 255; out[3 + i * 2] = c >> 8; }
    return out;
  }
  async function fileHashes(text) {
    const out = new Set();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    for (const v of [text, text + "\r\n", text + "\n", text + " ", text + " \r\n"]) {
      const b = enc.encode(v);
      const wb = new Uint8Array(bom.length + b.length); wb.set(bom); wb.set(b, bom.length);
      out.add(toHex(await sha256Bytes(b)));
      out.add(toHex(await sha256Bytes(wb)));
      out.add(toHex(await sha256Bytes(utf16le(v))));
    }
    return out;
  }

  /* ---------- Datos de cada grupo ---------- */
  const FIRST = ["Laura", "Marcos", "Irene", "Pablo", "Nuria", "Hugo", "Sara", "Diego", "Elena", "Rubén", "Alba", "Iván", "Marta", "Óscar", "Lucía", "Adrián"];
  const LAST = ["G.", "M.", "R.", "S.", "P.", "T.", "L.", "V.", "C.", "N."];
  const DEPTS = ["Ventas", "RRHH", "IT", "Finanzas", "Marketing"];
  const cache = {};

  async function deriveGroup(code) {
    if (cache[code]) return cache[code];
    const r = rng(CONFIG.SECRET + "#" + code);
    const d = { code };

    /* SALA 1 · Oficina: explorador del SSD */
    const names = r.shuffle(FIRST);
    const years = r.shuffle([2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023]);
    const emps = [];
    for (let i = 0; i < 14; i++) {
      const dept = i < 4 ? "Logística" : r.pick(DEPTS);
      emps.push({ id: "E" + String(i + 1).padStart(3, "0"), name: `${names[i]} ${r.pick(LAST)}`, dept, year: years[i], month: r.int(1, 12), card: String(r.int(100000, 999999)) });
    }
    const logi = emps.filter((e) => e.dept === "Logística").sort((a, b) => a.year - b.year);
    d.badge = logi[0].card;
    d.badgeOwner = logi[0].name;
    d.employees = r.shuffle(emps).map((e, i) => ({ ...e, id: "E" + String(i + 1).padStart(3, "0") }));
    d.employeesCsv = "id;nombre;departamento;fecha_alta;tarjeta\r\n" + d.employees.map((e) => `${e.id};${e.name};${e.dept};${String(e.month).padStart(2, "0")}/${e.year};${e.card}`).join("\r\n") + "\r\n";

    /* SALA 2 · Servidores: nota en Base64 */
    d.pin = String(r.int(1000, 9999));
    const note =
      `NOTA - GRUPO ${code}\r\n` +
      `Para: equipo de sistemas de CITED Data\r\n` +
      `El PIN del armario de servidores es ${d.pin}\r\n` +
      `Lo dejo \"cifrado\" para que nadie lo lea.\r\n`;
    d.noteB64 = btoa(note);

    /* SALA 3 · Buzón de Carlos: RSA real (las claves se generan en el navegador) */
    d.combo = [r.int(0, 9), r.int(0, 9), r.int(0, 9)];
    d.letter = `Carlos: la combinacion del candado de la caja es ${d.combo.join("-")}. Que no la vea nadie. - Ana (${code})`;

    /* SALA 4 · Archivo: contratos manipulados */
    d.amount = r.int(12, 89) * 100;
    d.supplier = r.int(10, 99);
    const contract = ["CONTRATO DE SERVICIOS - CITED Data", `GRUPO: ${code}`, `Transferencia autorizada: ${d.amount} EUR`, `Destino: PROVEEDOR ${d.supplier}`, "Firmado: Direccion financiera"].join("\r\n") + "\r\n";
    const tampers = [
      (t) => t.replace("Transferencia autorizada:", "Transferencia autorizada: "),
      (t) => t.replace(`PROVEEDOR ${d.supplier}`, `PROVEEDOR ${d.supplier} `),
      (t) => t.replace("Transferencia", "Trаnsferencia"),
      (t) => t.replace(`${d.amount} EUR`, `${d.amount} EUR`),
    ];
    const chosen = r.shuffle(tampers).slice(0, 3);
    d.authentic = r.int(0, 3);
    d.contracts = [];
    let f = 0;
    for (let i = 0; i < 4; i++) {
      const content = i === d.authentic ? contract : chosen[f++](contract);
      d.contracts.push({ name: `contrato_${i + 1}.txt`, content, hash: await sha256(content) });
    }
    d.contractOrigHash = await sha256(contract);
    d.askIdx = r.pick([0, 1, 2, 3].filter((i) => i !== d.authentic));

    /* SALA 5 · Laboratorio: avalancha + sellado */
    d.msg1 = `TRANSFERENCIA ${code}: 1000 EUR`;
    d.msg2 = `TRANSFERENCIA ${code}: 9000 EUR`;
    d.msg1Hash = await sha256(d.msg1);
    d.msg2Hash = await sha256(d.msg2);
    d.msg1Set = await fileHashes(d.msg1);
    d.msg2Set = await fileHashes(d.msg2);
    d.mineText = (n) => `${d.msg1} #${n}`;

    /* SALA 6 · Copias de seguridad */
    const bnames = ["backup_clientes.txt", "backup_facturas.txt", "backup_nominas.txt", "backup_contratos.txt"];
    d.backups = [];
    const manifest = [];
    d.corrupt = r.int(0, bnames.length - 1);
    for (let i = 0; i < bnames.length; i++) {
      const lines = [`COPIA DE SEGURIDAD - CITED Data - GRUPO ${code}`, `Archivo: ${bnames[i]}`];
      for (let j = 1; j <= 5; j++) lines.push(`Registro ${String(j).padStart(3, "0")}: ${r.int(100, 9999)} EUR`);
      const good = lines.join("\r\n") + "\r\n";
      manifest.push(`${await sha256(good)}  ${bnames[i]}`);
      const content = i === d.corrupt ? good.replace(/Registro 003: (\d)/, (m, x) => `Registro 003: ${(+x + 1) % 10 || 1}`) : good;
      d.backups.push({ name: bnames[i], content });
    }
    d.manifest = manifest.join("\r\n") + "\r\n";
    d.corruptName = bnames[d.corrupt];

    /* SALA 7 · Despacho: AES-256 → combinación del dial */
    d.keyText = `${d.pin}:${code}`;
    d.keyHex = await sha256(d.keyText);
    const iv = new Uint8Array(16).map(() => r.int(0, 255));
    d.ivHex = toHex(iv);
    d.dial = [r.int(5, 39), r.int(5, 39), r.int(5, 39)];
    d.dialDirs = ["D", "I", "D"];
    const plain = `GRUPO ${code} :: CAJA FUERTE DEL DIRECTOR :: gira a la DERECHA hasta ${d.dial[0]}, luego a la IZQUIERDA hasta ${d.dial[1]} y por ultimo a la DERECHA hasta ${d.dial[2]}.`;
    const key = await crypto.subtle.importKey("raw", fromHex(d.keyHex), { name: "AES-CBC" }, false, ["encrypt"]);
    d.cipherHex = toHex(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, enc.encode(plain))));

    /* SALA 8 · Cámara: testigo dentro del .7z (longitud variable por grupo) */
    d.token = await token(code);
    const ref = Array.from({ length: r.int(6, 40) }, () => r.pick(ALPH.split(""))).join("");
    d.testigo = `TESTIGO DE SEGURIDAD\r\nCODIGO DE GRUPO: ${code}\r\nTESTIGO: ${d.token}\r\nREFERENCIA: ${ref}\r\n`;
    d.testigoSize = enc.encode(d.testigo).length;

    cache[code] = d;
    return d;
  }

  /* ---------- RSA (sala 3): claves reales, generadas una vez por navegador ---------- */
  async function makeRSA(plain) {
    const gen = () => crypto.subtle.generateKey({ name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-1" }, true, ["encrypt", "decrypt"]);
    const pem = (buf, label) => `-----BEGIN ${label}-----\r\n${toB64(buf).match(/.{1,64}/g).join("\r\n")}\r\n-----END ${label}-----\r\n`;
    const c = await gen(), a = await gen();
    const ct = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, c.publicKey, enc.encode(plain));
    return {
      carlosPub: pem(await crypto.subtle.exportKey("spki", c.publicKey), "PUBLIC KEY"),
      carlosPriv: pem(await crypto.subtle.exportKey("pkcs8", c.privateKey), "PRIVATE KEY"),
      anaPub: pem(await crypto.subtle.exportKey("spki", a.publicKey), "PUBLIC KEY"),
      cipherB64: toB64(ct),
    };
  }

  /* ---------- Sala 5: sellado ---------- */
  async function checkMining(d, n) {
    if (!/^\d{1,9}$/.test(String(n))) return false;
    return (await sha256(d.mineText(n))).startsWith(CONFIG.MINING_PREFIX);
  }
  async function firstNonce(d) {
    for (let n = 0; n < 200000; n++) if ((await sha256(d.mineText(n))).startsWith(CONFIG.MINING_PREFIX)) return n;
    return -1;
  }

  /* ---------- Código de finalización (ranking) ---------- */
  function b64urlEncode(str) {
    let bin = ""; enc.encode(str).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "=";
    return new TextDecoder().decode(Uint8Array.from(atob(s), (c) => c.charCodeAt(0)));
  }
  async function makeFinishCode(res) {
    const team = String(res.team || "").replace(/[|]/g, "/").slice(0, 40);
    const payload = [res.group, team, res.elapsed, res.score, res.hints, res.errors, res.end].join("|");
    const chk = (await sha256(CONFIG.SECRET + "#FIN#" + payload)).slice(0, 8).toUpperCase();
    return `CN.${b64urlEncode(payload)}.${chk}`;
  }
  async function parseFinishCode(code) {
    try {
      const [p, body, chk] = code.trim().split(".");
      if (p !== "CN" || !body || !chk) return null;
      const payload = b64urlDecode(body);
      const ok = (await sha256(CONFIG.SECRET + "#FIN#" + payload)).slice(0, 8).toUpperCase() === chk.toUpperCase();
      const [group, team, elapsed, score, hints, errors, end] = payload.split("|");
      return { valid: ok, group, team, elapsed: +elapsed, score: +score, hints: +hints, errors: +errors, end: +end };
    } catch (e) { return null; }
  }

  /* ---------- Archivo de partida guardada (firmado) ---------- */
  async function makeSave(state) {
    const body = JSON.stringify(state);
    return JSON.stringify({ app: "cajanegra", v: 2, state, chk: await sha256(CONFIG.SECRET + "#SAVE#" + body) });
  }
  async function readSave(text) {
    try {
      const o = JSON.parse(text);
      if (o.app !== "cajanegra" || !o.state) return null;
      if ((await sha256(CONFIG.SECRET + "#SAVE#" + JSON.stringify(o.state))) !== o.chk) return { tampered: true };
      return { state: o.state };
    } catch (e) { return null; }
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
  }

  global.CN = { CONFIG, sha256, rng, generateGroupCode, deriveGroup, token, makeRSA, checkMining, firstNonce, makeFinishCode, parseFinishCode, makeSave, readSave, fmtTime };
})(window);
