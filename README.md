# Diario de Trading

Proyecto completo: app PWA de diario de trading con activacion por codigo y
bloqueo anti-clonacion via Google Sheets.

## Carpetas

- **/docs** — Lo unico que se publica en internet (GitHub Pages sirve esta
  carpeta). Contiene la landing (`docs/index.html`) y la app completa
  (`docs/app/`: `index.html`, `manifest.json`, `service-worker.js`,
  `config.js` con la URL del Apps Script y el numero de WhatsApp, `/icons`).
- **/panel-codigos** — Herramienta privada (`panel-codigos.html`) para generar
  y activar/desactivar codigos. **Nunca esta dentro de /docs**, asi que
  GitHub Pages jamas la publica — abrela solo en tu propia PC (doble clic en
  el archivo, o sirvela localmente).
- **/backend** — `Code.gs`, el Google Apps Script que conecta todo con tu
  Google Sheet. Instrucciones de instalacion completas dentro del archivo.

## Orden de despliegue

1. **Google Sheets + Apps Script** (`/backend/Code.gs`): crea la hoja con las
   8 columnas, pega el script, corre `setup()` una vez, copia la adminKey del
   log, y publica el script como "Aplicacion web" (Ejecutar como: Yo / Quien
   tiene acceso: Cualquiera). Copia la URL `.../exec`.
2. **Panel de Codigos** (`/panel-codigos/panel-codigos.html`): ábrelo
   localmente, pega la URL del Apps Script y la adminKey, y genera tus 50
   codigos gratis iniciales con el boton de lote.
3. **Editar `/docs/app/config.js`**: pon ahi la URL real del Apps Script y tu
   numero de WhatsApp de contacto.
4. **GitHub Pages**: el repositorio ya esta configurado para publicar la
   carpeta `/docs` de la rama `main`. Cualquier `git push` a `main` actualiza
   el sitio publico automaticamente en `https://<tu-usuario>.github.io/<repo>/`.
   El boton "Descargar" de la landing apunta a `app/index.html` (ruta
   relativa dentro de `/docs`).
5. Prueba todo el flujo en un dispositivo real antes de compartir el enlace
   (activar con un codigo gratis, llenar un trade, exportar el PDF de una
   tarjeta, y confirmar que el respaldo por fechas descarga el JSON
   correcto).

`/panel-codigos` y `/backend` nunca estan dentro de `/docs` — por eso nunca
quedan expuestos en el sitio publicado, sin importar si el repositorio es
privado o publico.
