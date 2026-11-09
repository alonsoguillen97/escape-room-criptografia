/* =========================================================
   OPERACIÓN CAJA NEGRA — núcleo compartido (alumno + profesor)
   Sin backend: todo se deriva del código de grupo de forma
   determinista, así cada grupo tiene datos (y respuestas) distintos.
   ========================================================= */
(function (global) {
  "use strict";

  const CONFIG = {
    SECRET: "CAJA-NEGRA|2SMR|UD2|v1", // cámbialo si reutilizas la actividad otro curso
    DURATION_MIN: 75,                 // cuenta atrás visual (no bloquea)
    TEACHER_PIN: "2SMR",              // PIN del panel del profesor
    PENALTY_WRONG: 25,
    PENALTY_HINT: 50,
    BONUS_CLEAN: 50,
    START_SCORE: 1000,
  };

  const enc = new TextEncoder();
  const toHex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
  const fromHex = (hex) => new Uint8Array(hex.match(/../g).map((x) => parseInt(x, 16)));

  async function sha256Bytes(bytes) {
    return new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  }
  async function sha256(text) {
    return toHex(await sha256Bytes(enc.encode(text)));
  }

  /* ---------- PRNG determinista (semilla = texto) ---------- */
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
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
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
      },
    };
  }

  const ALPH = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin 0/O ni 1/I
  function generateGroupCode() {
    const b = crypto.getRandomValues(new Uint8Array(4));
    return Array.from(b, (x) => ALPH[x % ALPH.length]).join("");
  }

  /* ---------- Testigo de grupo (fase 7-Zip) ---------- */
  async function token(code) {
    return (await sha256(CONFIG.SECRET + "#TESTIGO#" + code)).slice(0, 6).toUpperCase();
  }

  /* ---------- Variantes de archivo (Bloc de notas / PowerShell) ---------- */
  function utf16le(str) {
    const out = new Uint8Array(2 + str.length * 2);
    out[0] = 0xff; out[1] = 0xfe;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      out[2 + i * 2] = c & 255;
      out[3 + i * 2] = c >> 8;
    }
    return out;
  }
  async function fileHashPrefixes(text, len = 8) {
    const out = new Set();
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    for (const v of [text, text + "\r\n", text + "\n", text + " ", text + " \r\n"]) {
      const b = enc.encode(v);
      const withBom = new Uint8Array(bom.length + b.length);
      withBom.set(bom); withBom.set(b, bom.length);
      out.add(toHex(await sha256Bytes(b)).slice(0, len));
      out.add(toHex(await sha256Bytes(withBom)).slice(0, len));
      out.add(toHex(await sha256Bytes(utf16le(v))).slice(0, len));
    }
    return out;
  }

  /* ---------- Datos derivados de cada grupo ---------- */
  const cache = {};
  async function deriveGroup(code) {
    if (cache[code]) return cache[code];
    const r = rng(CONFIG.SECRET + "#" + code);
    const d = { code };

    // FASE 2 · Base64
    d.pin = String(r.int(1000, 9999));
    const note =
      `NOTA RECUPERADA - GRUPO ${code}\r\n` +
      `Para: equipo de sistemas de CITED Data\r\n` +
      `El PIN del armario de servidores es ${d.pin}\r\n` +
      `Lo dejo aqui \"cifrado\" para que nadie lo lea.\r\n`;
    d.noteB64 = btoa(note);

    // FASE 4 · Contratos manipulados
    d.amount = r.int(12, 89) * 100;
    d.supplier = r.int(10, 99);
    const contract =
      [
        "CONTRATO DE SERVICIOS - CITED Data",
        `GRUPO: ${code}`,
        `Transferencia autorizada: ${d.amount} EUR`,
        `Destino: PROVEEDOR ${d.supplier}`,
        "Firmado: Direccion financiera",
      ].join("\r\n") + "\r\n";
    const tampers = [
      (t) => t.replace("Transferencia autorizada:", "Transferencia autorizada: "), // doble espacio
      (t) => t.replace(`PROVEEDOR ${d.supplier}`, `PROVEEDOR ${d.supplier} `),    // espacio final
      (t) => t.replace("Transferencia", "Trаnsferencia"),                   // 'a' cirílica
      (t) => t.replace(`${d.amount} EUR`, `${d.amount} EUR`),               // espacio duro
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
    const fakes = [0, 1, 2, 3].filter((i) => i !== d.authentic);
    d.askIdx = r.pick(fakes);

    // FASE 5 · Efecto avalancha
    d.msg1 = `TRANSFERENCIA ${code}: 1000 EUR`;
    d.msg2 = `TRANSFERENCIA ${code}: 9000 EUR`;
    d.msg1Hash = await sha256(d.msg1);
    d.msg2Hash = await sha256(d.msg2);
    d.msg1Prefixes = await fileHashPrefixes(d.msg1);
    d.msg2Prefixes = await fileHashPrefixes(d.msg2);

    // FASE 6 · Verificación de copias de seguridad (manifiesto SHA-256)
    const names = ["backup_clientes.txt", "backup_facturas.txt", "backup_nominas.txt", "backup_contratos.txt"];
    d.backups = [];
    const manifest = [];
    d.corrupt = r.int(0, names.length - 1);
    for (let i = 0; i < names.length; i++) {
      const lines = [`COPIA DE SEGURIDAD - CITED Data - GRUPO ${code}`, `Archivo: ${names[i]}`];
      for (let j = 1; j <= 5; j++) lines.push(`Registro ${String(j).padStart(3, "0")}: ${r.int(100, 9999)} EUR`);
      const good = lines.join("\r\n") + "\r\n";
      manifest.push(`${await sha256(good)}  ${names[i]}`);
      // la copia corrupta tiene un solo dígito alterado
      const content = i === d.corrupt ? good.replace(/Registro 003: (\d)/, (m, x) => `Registro 003: ${(+x + 1) % 10 || 1}`) : good;
      d.backups.push({ name: names[i], content });
    }
    d.manifest = manifest.join("\r\n") + "\r\n";
    d.corruptName = names[d.corrupt];

    // FASE 7 · AES-256 (simétrico). La clave sale del PIN de la fase 2.
    d.keyText = `${d.pin}:${code}`;
    d.keyHex = await sha256(d.keyText);
    const iv = new Uint8Array(16).map(() => r.int(0, 255));
    d.ivHex = toHex(iv);
    d.vault = Array.from({ length: 6 }, () => r.pick(ALPH.split(""))).join("");
    const plain = `GRUPO ${code} :: CODIGO DE LA CAJA FUERTE = ${d.vault} :: Has descifrado con la MISMA clave que se uso para cifrar.`;
    const key = await crypto.subtle.importKey("raw", fromHex(d.keyHex), { name: "AES-CBC" }, false, ["encrypt"]);
    d.cipherHex = toHex(new Uint8Array(await crypto.subtle.encrypt({ name: "AES-CBC", iv }, key, enc.encode(plain))));

    // FASE 8 · Testigo para el intercambio 7-Zip
    d.token = await token(code);

    cache[code] = d;
    return d;
  }

  /* ---------- Código de finalización (ranking) ---------- */
  function b64urlEncode(str) {
    let bin = "";
    enc.encode(str).forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  function b64urlDecode(s) {
    s = s.replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    const bin = atob(s);
    return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
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
    } catch (e) {
      return null;
    }
  }

  function fmtTime(sec) {
    sec = Math.max(0, Math.floor(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  global.CN = {
    CONFIG, sha256, rng, generateGroupCode, deriveGroup, token,
    makeFinishCode, parseFinishCode, fmtTime,
  };
})(window);
