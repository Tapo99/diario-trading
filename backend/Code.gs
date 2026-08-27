/**
 * ============================================================
 * DIARIO DE TRADING - Backend (Google Apps Script)
 * ============================================================
 *
 * INSTALACION:
 * 1. Crea una Google Sheet nueva. En la fila 1 escribe estos 8
 *    encabezados, uno por columna, en este orden exacto:
 *    codigo | tipo | estado | usado | deviceId | creado | usado_en | nota
 * 2. En esa hoja, ve a Extensiones -> Apps Script.
 * 3. Borra el codigo de ejemplo y pega este archivo completo.
 * 4. Ejecuta la funcion setup() UNA SOLA VEZ manualmente (menu
 *    "Ejecutar" -> selecciona "setup" -> Ejecutar). Te va a pedir
 *    autorizar permisos, es tu propia cuenta, es seguro.
 * 5. Revisa el log de ejecucion (Ver -> Registros) y copia la
 *    adminKey que se imprime ahi. Guardala en un lugar seguro:
 *    es la clave que usa panel-codigos.html para administrar.
 * 6. Implementar -> Nueva implementacion -> tipo "Aplicacion web".
 *    - Ejecutar como: Yo
 *    - Quien tiene acceso: Cualquier usuario
 * 7. Copia la URL que te entrega (…/exec) y pegala en config.js
 *    de la app (APPS_SCRIPT_URL) y en panel-codigos.html.
 *
 * Si mas adelante cambias el codigo de este archivo, tienes que
 * hacer Implementar -> Gestionar implementaciones -> editar (lapiz)
 * -> Nueva version, para que los cambios queden publicados en la
 * misma URL.
 * ============================================================
 */

const COLUMNS = ["codigo", "tipo", "estado", "usado", "deviceId", "creado", "usado_en", "nota"];
const ADMIN_KEY_PROP = "ADMIN_KEY";

/**
 * Ejecutar UNA SOLA VEZ, a mano, desde el editor. Genera una
 * adminKey secreta y la guarda en las Propiedades del Script.
 * Si ya existe una, no la pisa (para no invalidar tu Panel).
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let key = props.getProperty(ADMIN_KEY_PROP);
  if (key) {
    Logger.log("Ya existe una adminKey guardada. No se genero una nueva.");
    Logger.log("adminKey actual: " + key);
    return;
  }
  key = Utilities.getUuid().replace(/-/g, "");
  props.setProperty(ADMIN_KEY_PROP, key);
  Logger.log("adminKey generada. Guardala en un lugar seguro, no se vuelve a mostrar sola:");
  Logger.log(key);
}

function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function isValidAdminKey_(key) {
  const stored = PropertiesService.getScriptProperties().getProperty(ADMIN_KEY_PROP);
  return !!stored && key === stored;
}

function readRows_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  const values = sheet.getRange(2, 1, lastRow - 1, COLUMNS.length).getValues();
  return values.map((row, idx) => {
    const obj = {};
    COLUMNS.forEach((col, i) => (obj[col] = row[i]));
    obj._row = idx + 2; // fila real en la hoja, para poder actualizarla despues
    return obj;
  });
}

function findRowByCode_(code) {
  const rows = readRows_();
  return rows.find((r) => String(r.codigo) === String(code)) || null;
}

function generateCode_() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * action=check&code=123456&deviceId=xxxx
 */
function actionCheck_(params) {
  const code = params.code;
  const deviceId = params.deviceId;

  if (!code || !deviceId) {
    return jsonResponse_({ ok: false, reason: "invalid" });
  }

  const row = findRowByCode_(code);
  if (!row) {
    return jsonResponse_({ ok: false, reason: "invalid" });
  }

  if (String(row.estado).toLowerCase() === "inactivo") {
    return jsonResponse_({ ok: false, reason: "inactive" });
  }

  const usado = row.usado === true || String(row.usado).toUpperCase() === "TRUE";

  if (usado) {
    if (String(row.deviceId) === String(deviceId)) {
      return jsonResponse_({ ok: true });
    }
    return jsonResponse_({ ok: false, reason: "used_elsewhere" });
  }

  // usado=false y estado=activo -> se acepta y se amarra a este deviceId
  const sheet = getSheet_();
  sheet.getRange(row._row, COLUMNS.indexOf("usado") + 1).setValue(true);
  sheet.getRange(row._row, COLUMNS.indexOf("deviceId") + 1).setValue(deviceId);
  sheet.getRange(row._row, COLUMNS.indexOf("usado_en") + 1).setValue(new Date());

  return jsonResponse_({ ok: true });
}

/**
 * action=add&adminKey=...&code=(opcional)&tipo=...&estado=activo|inactivo&nota=...
 */
function actionAdd_(params) {
  if (!isValidAdminKey_(params.adminKey)) {
    return jsonResponse_({ ok: false, reason: "unauthorized" });
  }

  const sheet = getSheet_();
  let code = params.code;
  if (!code) {
    // genera un codigo de 6 digitos que no exista todavia
    do {
      code = generateCode_();
    } while (findRowByCode_(code));
  }

  const tipo = params.tipo || "pagado";
  const estado = params.estado === "inactivo" ? "inactivo" : "activo";
  const nota = params.nota || "";

  sheet.appendRow([code, tipo, estado, false, "", new Date(), "", nota]);

  return jsonResponse_({ ok: true, code: code, tipo: tipo, estado: estado });
}

/**
 * action=setActive&adminKey=...&code=...&active=true|false
 */
function actionSetActive_(params) {
  if (!isValidAdminKey_(params.adminKey)) {
    return jsonResponse_({ ok: false, reason: "unauthorized" });
  }

  const row = findRowByCode_(params.code);
  if (!row) {
    return jsonResponse_({ ok: false, reason: "invalid" });
  }

  const active = String(params.active) === "true";
  const sheet = getSheet_();
  sheet.getRange(row._row, COLUMNS.indexOf("estado") + 1).setValue(active ? "activo" : "inactivo");

  return jsonResponse_({ ok: true });
}

/**
 * action=list&adminKey=...
 */
function actionList_(params) {
  if (!isValidAdminKey_(params.adminKey)) {
    return jsonResponse_({ ok: false, reason: "unauthorized" });
  }

  const rows = readRows_().map((r) => {
    const copy = Object.assign({}, r);
    delete copy._row;
    return copy;
  });

  return jsonResponse_({ ok: true, rows: rows });
}

function doGet(e) {
  const params = (e && e.parameter) || {};
  const action = params.action;

  try {
    switch (action) {
      case "check":
        return actionCheck_(params);
      case "add":
        return actionAdd_(params);
      case "setActive":
        return actionSetActive_(params);
      case "list":
        return actionList_(params);
      default:
        return jsonResponse_({ ok: false, reason: "unknown_action" });
    }
  } catch (err) {
    return jsonResponse_({ ok: false, reason: "server_error", message: String(err) });
  }
}
