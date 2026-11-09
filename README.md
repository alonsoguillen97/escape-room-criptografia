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

## Fases (≈ 60–75 min)
| # | Fase | Qué hacen | Herramienta |
|---|------|-----------|-------------|
| 1 | El disco robado | Clasificar dispositivos protegidos/legibles + 2 preguntas | — |
| 2 | La nota “cifrada” | Descodificar Base64 → PIN (codificar ≠ cifrar) | PowerShell / CyberChef |
| 3 | Las cuatro llaves | Drag & drop: cifrar/descifrar/firmar/verificar | — |
| 4 | El contrato manipulado | 4 contratos con cambios invisibles; hallar el auténtico por SHA-256 | Get-FileHash |
| 5 | Un solo cambio | Crear mensaje.txt, hashear, cambiar 1000→9000 (efecto avalancha) | Get-FileHash |
| 6 | La copia que miente | Verificar copias contra un manifiesto SHA256SUMS + regla 3-2-1 | Get-FileHash |
| 7 | El mensaje cifrado | Clave = SHA-256("PIN:GRUPO"), descifrar AES-256-CBC | PowerShell + CyberChef |
| 8 | La caja fuerte digital | Crear 7z AES-256 con nombres cifrados e intercambiarlo con otro grupo; validar su testigo | 7-Zip |
| 9 | Informe a dirección | Asignar el control adecuado a 6 situaciones | — |

## Por qué la IA no lo resuelve sola
- Cada grupo tiene un **código aleatorio** y de él dependen PIN, contratos, hashes, copias, clave AES y testigo. Ni otro grupo ni una IA conocen esos datos.
- Las respuestas son **hashes de archivos que solo existen en su ordenador**, un mensaje AES que hay que descifrar con una clave que deben calcular, y un **testigo que solo se consigue intercambiando el .7z con otro grupo**.
- La fase 7 encadena con la 2 (el PIN), así que no pueden saltarse pasos.
- Las preguntas conceptuales sí se pueden preguntar a una IA, pero pesan poco en el tiempo total.
- Límite: un alumno experto podría leer el JS con DevTools. Para 2º SMR es poco probable; si os preocupa, cambia `SECRET` en `core.js` cada curso.

## Competición
- Al terminar, cada equipo obtiene un **código de finalización** firmado (tiempo, puntos, pistas, errores).
- En `profesor.html` → Ranking, pega los códigos para ver el podio. Si un código se ha manipulado, aparece marcado.
- Reiniciar la misión genera un código nuevo y pone el cronómetro a cero.

## Fase 8 sin pareja
Si un grupo se queda sin pareja: prepara de antemano un `.7z` con `testigo_PROF.txt`. El testigo de `PROF` lo ves en el Solucionario.

## Configuración (`js/core.js` → CONFIG)
`DURATION_MIN` (cuenta atrás visual, no bloquea), `TEACHER_PIN`, penalizaciones y bonus, `SECRET`.
