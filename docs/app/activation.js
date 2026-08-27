// ============================================================
// Pantalla de bloqueo por codigo + validacion contra Google Apps Script.
// ============================================================
(function () {
  const REASON_MESSAGES = {
    invalid: "Ese codigo no existe. Revisa que este bien escrito.",
    inactive: "Ese codigo todavia no esta activo. Escribenos para confirmarlo.",
    used_elsewhere: "Ese codigo ya fue usado en otro dispositivo.",
    network: "No hay conexion a internet. Necesitas conectarte una sola vez para activar la app.",
    unknown: "Ocurrio un error al validar el codigo. Intenta de nuevo.",
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function getDigits() {
    const inputs = document.querySelectorAll(".code-digit");
    return Array.from(inputs).map((i) => i.value.trim()).join("");
  }

  function setupDigitInputs() {
    const inputs = document.querySelectorAll(".code-digit");
    inputs.forEach((input, idx) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/[^0-9]/g, "").slice(0, 1);
        if (input.value && idx < inputs.length - 1) {
          inputs[idx + 1].focus();
        }
        updateSubmitState();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && idx > 0) {
          inputs[idx - 1].focus();
        }
      });
      input.addEventListener("paste", (e) => {
        e.preventDefault();
        const text = (e.clipboardData.getData("text") || "").replace(/[^0-9]/g, "");
        for (let i = 0; i < inputs.length; i++) {
          inputs[i].value = text[i] || "";
        }
        updateSubmitState();
        const next = inputs[Math.min(text.length, inputs.length - 1)];
        if (next) next.focus();
      });
    });
  }

  function updateSubmitState() {
    const btn = $("#activation-submit");
    const digits = getDigits();
    btn.disabled = digits.length !== 6;
  }

  function showError(msg) {
    const el = $("#activation-error");
    el.textContent = msg;
    el.hidden = !msg;
  }

  async function checkCode(code, deviceId) {
    const url = new URL(window.APP_CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set("action", "check");
    url.searchParams.set("code", code);
    url.searchParams.set("deviceId", deviceId);
    const res = await fetch(url.toString(), { method: "GET" });
    if (!res.ok) throw new Error("bad_response");
    return res.json();
  }

  async function handleSubmit() {
    const code = getDigits();
    if (code.length !== 6) return;

    showError("");
    const btn = $("#activation-submit");
    btn.disabled = true;
    btn.textContent = "Verificando...";

    try {
      const deviceId = await window.DiarioDB.getDeviceId();
      const data = await checkCode(code, deviceId);

      if (data.ok) {
        await window.DiarioDB.saveActivation({ code, deviceId });
        window.dispatchEvent(new CustomEvent("app:activated"));
      } else {
        showError(REASON_MESSAGES[data.reason] || REASON_MESSAGES.unknown);
      }
    } catch (err) {
      showError(REASON_MESSAGES.network);
    } finally {
      btn.textContent = "Activar";
      updateSubmitState();
    }
  }

  function renderConfigTexts() {
    const whatsappEl = $("#activation-whatsapp");
    const contactoEl = $("#activation-contacto-text");
    if (whatsappEl) {
      const numero = window.APP_CONFIG.WHATSAPP_NUMERO;
      whatsappEl.textContent = "+" + numero;
      whatsappEl.href = "https://wa.me/" + numero;
    }
    if (contactoEl) contactoEl.textContent = window.APP_CONFIG.TEXTO_CONTACTO;
  }

  async function init() {
    const activation = await window.DiarioDB.getActivation();
    if (activation && activation.activated) {
      window.dispatchEvent(new CustomEvent("app:activated"));
      return;
    }

    $("#screen-activation").hidden = false;
    renderConfigTexts();
    setupDigitInputs();
    updateSubmitState();
    $("#activation-form").addEventListener("submit", (e) => {
      e.preventDefault();
      handleSubmit();
    });
  }

  window.DiarioActivation = { init };
})();
