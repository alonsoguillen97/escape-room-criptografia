# Operación Caja Negra — Escape room de criptografía (2º SMR · UD2)

Web estática (HTML/CSS/JS vanilla, sin backend). Funciona en GitHub Pages.

## Archivos
```
index.html        Web del alumnado
profesor.html     Panel del profesor (ranking + solucionario). PIN por defecto: 2SMR
css/styles.css
js/core.js        Lógica compartida y CONFIG (secreto, PIN, duración, puntos)
js/app.js         Fases y motor del juego
js/profesor.js
```

## Publicar en GitHub Pages
1. Crea un repositorio y sube todos los archivos (sin la carpeta `.claude`).
2. Settings → Pages → Branch `main` / root → Save.
3. Alumnado: `https://<usuario>.github.io/<repo>/` · Profesor: `.../profesor.html`.

> Necesita https o localhost (la Web Crypto API no funciona abriendo el archivo con doble clic en algunos navegadores).
> Prueba local: `python -m http.server 8765` y abre http://localhost:8765

## Salas (≈ 75–90 min)
Cada sala es una escena ilustrada con objetos clicables, objetivos, radio con mensajes, inventario y sonido.

| # | Sala | Mecánica | Herramienta real |
|---|------|----------|------------------|
| 1 | Oficina | Explorador de archivos del SSD robado (D: legible, E: BitLocker). Deducir el código de la puerta desde un CSV | — |
| 2 | Servidores | Descodificar la nota Base64 → teclado del rack | PowerShell / CyberChef |
| 3 | Despacho de Carlos | Descifrar una carta **RSA real** eligiendo la clave correcta del llavero → candado de ruedas → responder con la clave adecuada | CyberChef (RSA Decrypt) |
| 4 | Archivo | Verificador: escanear los 4 contratos declarando su hash; detectar el auténtico y 3 evidencias | Get-FileHash |
| 5 | Laboratorio | Efecto avalancha visual + **selladora**: buscar por fuerza bruta un número cuyo hash empiece por 000 | PowerShell (bucle) |
| 6 | Copias | Bloquear la copia corrupta con manifiesto SHA256SUMS + diseñar un plan 3-2-1 con copias externas cifradas | Get-FileHash |
| 7 | Despacho del director | Clave = SHA-256("PIN:GRUPO") → descifrar AES-256 → dial de caja fuerte (sentido y número) | PowerShell + CyberChef |
| 8 | Cámara acorazada | Doble llave: vuestro testigo + el de otro equipo sacado de su .7z cifrado | 7-Zip |
| 9 | Salida | Clasificar las medidas usadas en C / I / D / A / no protege | — |

Probado con CyberChef real (RSA-OAEP SHA-1 y AES-CBC) y PowerShell 5.1.

## Por qué la IA no lo resuelve sola
- Cada grupo tiene un **código aleatorio** y de él dependen PIN, contratos, hashes, copias, clave AES y testigo. Ni otro grupo ni una IA conocen esos datos.
- Las respuestas son **hashes de archivos que solo existen en su ordenador**, un mensaje AES que hay que descifrar con una clave que deben calcular, y un **testigo que solo se consigue intercambiando el .7z con otro grupo**.
- La sala 7 encadena con la 2 (el PIN) y la 3 con la 2 (el llavero), así que no pueden saltarse pasos.
- Las preguntas conceptuales sí se pueden preguntar a una IA, pero pesan poco en el tiempo total.
- Límite: un alumno experto podría leer el JS con DevTools. Para 2º SMR es poco probable; si os preocupa, cambia `SECRET` en `core.js` cada curso.

## Competición
- Al terminar, cada equipo obtiene un **código de finalización** firmado (tiempo, puntos, pistas, errores).
- En `profesor.html` → Ranking, pega los códigos para ver el podio. Si un código se ha manipulado, aparece marcado.
- Reiniciar la misión genera un código nuevo y pone el cronómetro a cero.

## Sala 8 sin pareja
Si un grupo se queda sin pareja: prepara de antemano un `.7z` con `testigo_PROF.txt`. El testigo de `PROF` lo ves en el Solucionario.

## Configuración (`js/core.js` → CONFIG)
`DURATION_MIN` (cuenta atrás visual, no bloquea), `TEACHER_PIN`, penalizaciones y bonus, `SECRET`.
