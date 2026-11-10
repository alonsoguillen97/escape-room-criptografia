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

## Salas (≈ 90–120 min, se puede repartir en varias clases)
Cada sala es una escena ilustrada con objetos clicables, objetivos, radio con mensajes, inventario y sonido.

| # | Sala | Mecánica | Herramienta real |
|---|------|----------|------------------|
| 1 | Oficina | Explorador de archivos del SSD robado (D: legible, E: BitLocker). Deducir el código de la puerta desde un CSV | — |
| 2 | Servidores | Descodificar la nota Base64 → teclado del rack | PowerShell / CyberChef |
| 3 | Despacho de Carlos | Carta cifrada con **RSA real**: elegir en el descifrador del juego qué clave del llavero la abre → candado de ruedas → responder con la clave adecuada | Bloc de notas (.pem) |
| 4 | Archivo | Verificador: escanear los 4 contratos declarando su hash; detectar el auténtico y 3 evidencias | Get-FileHash |
| 5 | Laboratorio | Efecto avalancha visual + **selladora**: script de PowerShell (copiar y pegar) que busca un número cuyo hash empiece por 00 | PowerShell |
| 6 | Copias | Bloquear la copia corrupta con manifiesto SHA256SUMS + diseñar un plan 3-2-1 con copias externas cifradas | Get-FileHash |
| 7 | Despacho del director | PIN de la sala 2 → correo cifrado con AES-128 CBC (clave e IV en texto, como el reto de clase) → dial de caja fuerte | CyberChef |
| 8 | Cámara acorazada | Cifrar su propio paquete con 7-Zip; llave 1 = testigo, llave 2 = tamaño del testigo visto en 7-Zip | 7-Zip |
| 9 | Salida | Clasificar las medidas usadas en C / I / D / A / no protege | — |

Probado con CyberChef real (AES-CBC) y PowerShell 5.1. Los alumnos tienen apuntes de consulta en `apuntes.html` (botón 📘).

## Por qué la IA no lo resuelve sola
- Cada grupo tiene un **código aleatorio** y de él dependen PIN, contratos, hashes, copias, clave AES y testigo. Ni otro grupo ni una IA conocen esos datos.
- Las respuestas son **hashes de archivos que solo existen en su ordenador**, un mensaje AES que hay que descifrar con una clave que deben calcular, y el tamaño de un testigo que solo se ve abriendo su propio .7z cifrado.
- La sala 7 encadena con la 2 (el PIN) y la 3 con la 2 (el llavero), así que no pueden saltarse pasos.
- Las preguntas conceptuales sí se pueden preguntar a una IA, pero pesan poco en el tiempo total.
- Límite: un alumno experto podría leer el JS con DevTools. Para 2º SMR es poco probable; si os preocupa, cambia `SECRET` en `core.js` cada curso.

## Competición
- Al terminar, cada equipo obtiene un **código de finalización** firmado (tiempo, puntos, pistas, errores).
- En `profesor.html` → Ranking, pega los códigos para ver el podio. Si un código se ha manipulado, aparece marcado.
- Gana el equipo con más puntos; en caso de empate, el que terminó antes.
- Reiniciar la misión genera un código nuevo y devuelve la puntuación a 1000.

## Varias sesiones de clase
No hay temporizador. Al final de cada clase los equipos pulsan 💾 y descargan `partida_XXXX.cajanegra`. En la siguiente clase la cargan con «Cargar partida guardada» (funciona en otro ordenador). El archivo está firmado: si lo editan, no se carga.

## Configuración (`js/core.js` → CONFIG)
`TEACHER_PIN`, penalizaciones y bonus, `SECRET`.
