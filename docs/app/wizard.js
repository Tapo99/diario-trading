// ============================================================
// Wizard "Agregar nuevo trading" de 9 pasos.
// ============================================================
(function () {
  const QUESTIONS = [
    {
      key: "configuracion",
      titulo: "Configuracion del Trade",
      pregunta: "Describe la estrategia y la configuracion que utilizaste para este trade.",
    },
    {
      key: "justificacion",
      titulo: "Justificacion",
      pregunta: "Cual fue la razon principal por la que entraste en este trade?",
    },
    {
      key: "emociones",
      titulo: "Emociones y Psicologia",
      pregunta: "Como te sentiste antes, durante y despues del trade?",
    },
    {
      key: "riesgo",
      titulo: "Gestion de Riesgo",
      pregunta: "Como determinaste el tamano de tu posicion y los niveles de riesgo?",
    },
    {
      key: "resultado",
      titulo: "Resultado y Reflexion",
      pregunta: "El trade fue una ganancia, una perdida o un punto de equilibrio? Que aprendiste de este trade?",
      conSelector: true,
    },
    {
      key: "lecciones",
      titulo: "Lecciones Aprendidas",
      pregunta: "Que aprendizajes puedes obtener de este trade?",
    },
    {
      key: "condiciones",
      titulo: "Condiciones del Mercado",
      pregunta: "Hubo condiciones del mercado o noticias que afectaran el trade?",
    },
    {
      key: "planes",
      titulo: "Planes Futuros",
      pregunta: "Como influira este trade en tus decisiones futuras?",
    },
  ];

  const LAST_NUMBERED_STEP = QUESTIONS.length + 1; // paso 1 (fecha) + 8 preguntas = 9 pasos numerados
  const FINAL_STEP = LAST_NUMBERED_STEP + 1; // resumen, sin numero propio en la barra de progreso

  const RESULTADO_LABELS = {
    ganancia: "Ganancia",
    perdida: "Perdida",
    equilibrio: "Equilibrio",
  };

  let state = null;
  let editingTradeId = null;
  let editingCreatedAt = null;

  function blankState() {
    return {
      step: 1,
      fecha: "",
      imagenBlob: null,
      imagenTipo: "",
      imagenPreviewUrl: "",
      respuestas: {},
      resultado: "",
      monto: "",
    };
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  function todayStr() {
    const d = new Date();
    const tz = d.getTimezoneOffset() * 60000;
    return new Date(d - tz).toISOString().slice(0, 10);
  }

  function render() {
    const root = $("#wizard-root");
    root.innerHTML = "";

    if (editingTradeId) {
      const banner = document.createElement("div");
      banner.className = "edit-banner";
      const label = document.createElement("span");
      label.textContent = "Editando un trade guardado";
      const cancelLink = document.createElement("button");
      cancelLink.type = "button";
      cancelLink.className = "edit-cancel-link";
      cancelLink.textContent = "Cancelar edicion";
      cancelLink.addEventListener("click", () => {
        editingTradeId = null;
        editingCreatedAt = null;
        state = blankState();
        render();
        window.dispatchEvent(new CustomEvent("app:navigate", { detail: { tab: "diario" } }));
      });
      banner.appendChild(label);
      banner.appendChild(cancelLink);
      root.appendChild(banner);
    }

    const progress = document.createElement("div");
    progress.className = "wizard-progress";
    progress.textContent =
      state.step <= LAST_NUMBERED_STEP ? `Paso ${state.step} de ${LAST_NUMBERED_STEP}` : "Resumen";
    root.appendChild(progress);

    if (state.step === 1) {
      root.appendChild(renderStep1());
    } else if (state.step >= 2 && state.step <= LAST_NUMBERED_STEP) {
      root.appendChild(renderQuestionStep(QUESTIONS[state.step - 2]));
    } else {
      root.appendChild(renderFinalStep());
    }
  }

  function renderNavButtons(container, { nextDisabled, nextLabel, onNext }) {
    const nav = document.createElement("div");
    nav.className = "wizard-nav";

    if (state.step > 1) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "btn btn-secondary";
      back.textContent = "Atras";
      back.addEventListener("click", () => {
        state.step -= 1;
        render();
      });
      nav.appendChild(back);
    } else {
      nav.appendChild(document.createElement("span"));
    }

    const next = document.createElement("button");
    next.type = "button";
    next.className = "btn btn-primary";
    next.textContent = nextLabel || "Siguiente";
    next.disabled = !!nextDisabled;
    next.addEventListener("click", onNext);
    nav.appendChild(next);

    container.appendChild(nav);
  }

  function renderStep1() {
    const wrap = document.createElement("div");
    wrap.className = "wizard-card";

    const h = document.createElement("h2");
    h.textContent = "Fecha del trade";
    wrap.appendChild(h);

    const label = document.createElement("label");
    label.className = "field-label";
    label.textContent = "Fecha (obligatoria)";
    wrap.appendChild(label);

    const dateInput = document.createElement("input");
    dateInput.type = "date";
    dateInput.className = "field-input";
    dateInput.max = todayStr();
    dateInput.value = state.fecha;
    wrap.appendChild(dateInput);

    const imgLabel = document.createElement("label");
    imgLabel.className = "field-label";
    imgLabel.style.marginTop = "20px";
    imgLabel.textContent = "Imagen (opcional)";
    wrap.appendChild(imgLabel);

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "field-input";
    wrap.appendChild(fileInput);

    const preview = document.createElement("img");
    preview.className = "image-preview";
    preview.hidden = !state.imagenPreviewUrl;
    if (state.imagenPreviewUrl) preview.src = state.imagenPreviewUrl;
    wrap.appendChild(preview);

    dateInput.addEventListener("input", () => {
      state.fecha = dateInput.value;
      updateNextDisabled();
    });

    fileInput.addEventListener("change", () => {
      const file = fileInput.files[0];
      if (!file) return;
      state.imagenBlob = file;
      state.imagenTipo = file.type;
      state.imagenPreviewUrl = URL.createObjectURL(file);
      preview.src = state.imagenPreviewUrl;
      preview.hidden = false;
    });

    function updateNextDisabled() {
      nextBtnRef.disabled = !state.fecha;
    }

    renderNavButtons(wrap, {
      nextDisabled: !state.fecha,
      onNext: () => {
        state.step += 1;
        render();
      },
    });

    const nextBtnRef = wrap.querySelector(".wizard-nav .btn-primary");
    return wrap;
  }

  function renderQuestionStep(question) {
    const wrap = document.createElement("div");
    wrap.className = "wizard-card";

    const h = document.createElement("h2");
    h.textContent = question.titulo;
    wrap.appendChild(h);

    const p = document.createElement("p");
    p.className = "field-question";
    p.textContent = question.pregunta;
    wrap.appendChild(p);

    let chipRow = null;
    let montoInput = null;
    let montoLabel = null;
    if (question.conSelector) {
      chipRow = document.createElement("div");
      chipRow.className = "chip-row";
      ["ganancia", "perdida", "equilibrio"].forEach((val) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip chip-" + val;
        chip.textContent = RESULTADO_LABELS[val];
        if (state.resultado === val) chip.classList.add("chip-selected");
        chip.addEventListener("click", () => {
          state.resultado = val;
          chipRow.querySelectorAll(".chip").forEach((c) => c.classList.remove("chip-selected"));
          chip.classList.add("chip-selected");
          updateMontoLabel();
          updateNextDisabled();
        });
        chipRow.appendChild(chip);
      });
      wrap.appendChild(chipRow);

      montoLabel = document.createElement("label");
      montoLabel.className = "field-label";
      wrap.appendChild(montoLabel);

      montoInput = document.createElement("input");
      montoInput.type = "number";
      montoInput.step = "0.01";
      montoInput.min = "0";
      montoInput.className = "field-input";
      montoInput.placeholder = "0.00";
      montoInput.value = state.monto;
      wrap.appendChild(montoInput);

      montoInput.addEventListener("input", () => {
        state.monto = montoInput.value;
        updateNextDisabled();
      });

      function updateMontoLabel() {
        if (state.resultado === "perdida") {
          montoLabel.textContent = "Cuanto perdiste ($, obligatorio)";
        } else if (state.resultado === "equilibrio") {
          montoLabel.textContent = "Monto (opcional, puede quedar en 0)";
        } else {
          montoLabel.textContent = "Cuanto ganaste ($, obligatorio)";
        }
      }
      updateMontoLabel();
    }

    const textarea = document.createElement("textarea");
    textarea.className = "field-textarea";
    textarea.rows = 6;
    textarea.value = state.respuestas[question.key] || "";
    textarea.placeholder = "Escribe tu respuesta aqui...";
    wrap.appendChild(textarea);

    textarea.addEventListener("input", () => {
      state.respuestas[question.key] = textarea.value;
      updateNextDisabled();
    });

    function isValid() {
      const textOk = textarea.value.trim().length > 0;
      if (question.conSelector) {
        const montoRequerido = state.resultado === "ganancia" || state.resultado === "perdida";
        const montoOk = !montoRequerido || (state.monto !== "" && Number(state.monto) >= 0);
        return textOk && !!state.resultado && montoOk;
      }
      return textOk;
    }

    function updateNextDisabled() {
      nextBtnRef.disabled = !isValid();
    }

    renderNavButtons(wrap, {
      nextDisabled: !isValid(),
      onNext: () => {
        state.step += 1;
        render();
      },
    });

    const nextBtnRef = wrap.querySelector(".wizard-nav .btn-primary");
    return wrap;
  }

  function renderFinalStep() {
    const wrap = document.createElement("div");
    wrap.className = "wizard-card";

    const h = document.createElement("h2");
    h.textContent = "Resumen";
    wrap.appendChild(h);

    const list = document.createElement("ul");
    list.className = "summary-list";

    const answeredCount = QUESTIONS.filter(
      (q) => (state.respuestas[q.key] || "").trim().length > 0
    ).length;

    const items = [
      ["Fecha", formatDateEs(state.fecha)],
      ["Imagen adjunta", state.imagenBlob ? "Si" : "No"],
      ["Preguntas respondidas", `${answeredCount} de ${QUESTIONS.length}`],
      ["Resultado", RESULTADO_LABELS[state.resultado] || "-"],
      ["Monto", state.monto !== "" ? "$" + Number(state.monto).toFixed(2) : "-"],
    ];

    items.forEach(([label, value]) => {
      const li = document.createElement("li");
      li.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      list.appendChild(li);
    });

    wrap.appendChild(list);

    renderNavButtons(wrap, {
      nextLabel: editingTradeId ? "Guardar cambios" : "Guardar en el Diario",
      onNext: async () => {
        await saveTrade();
      },
    });

    return wrap;
  }

  function formatDateEs(isoDate) {
    if (!isoDate) return "-";
    const [y, m, d] = isoDate.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  }

  async function saveTrade() {
    const monto = state.monto !== "" ? Number(state.monto) : 0;
    if (editingTradeId) {
      const trade = {
        id: editingTradeId,
        fecha: state.fecha,
        createdAt: editingCreatedAt,
        imagenBlob: state.imagenBlob,
        imagenTipo: state.imagenTipo,
        respuestas: { ...state.respuestas },
        resultado: state.resultado,
        monto,
      };
      await window.DiarioDB.updateTrade(trade);
    } else {
      const trade = {
        id: crypto.randomUUID(),
        fecha: state.fecha,
        createdAt: Date.now(),
        imagenBlob: state.imagenBlob,
        imagenTipo: state.imagenTipo,
        respuestas: { ...state.respuestas },
        resultado: state.resultado,
        monto,
      };
      await window.DiarioDB.addTrade(trade);
    }
    if (state.imagenPreviewUrl) URL.revokeObjectURL(state.imagenPreviewUrl);
    editingTradeId = null;
    editingCreatedAt = null;
    resetAndGoToDiario();
  }

  function resetAndGoToDiario() {
    state = blankState();
    render();
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { tab: "diario" } }));
  }

  function startEdit(trade) {
    editingTradeId = trade.id;
    editingCreatedAt = trade.createdAt;
    state = {
      step: 1,
      fecha: trade.fecha,
      imagenBlob: trade.imagenBlob || null,
      imagenTipo: trade.imagenTipo || "",
      imagenPreviewUrl: trade.imagenBlob ? URL.createObjectURL(trade.imagenBlob) : "",
      respuestas: { ...trade.respuestas },
      resultado: trade.resultado,
      monto: trade.monto != null ? String(trade.monto) : "",
    };
    render();
    window.dispatchEvent(new CustomEvent("app:navigate", { detail: { tab: "agregar" } }));
  }

  function init() {
    state = blankState();
    render();
  }

  window.DiarioWizard = { init, startEdit };
})();
